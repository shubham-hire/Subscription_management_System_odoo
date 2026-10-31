import { Injectable } from '@nestjs/common';
import { InvoiceStatus, Prisma, SubscriptionStatus } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';
import { addPeriod } from '../domain/billing-dates';
import { computeInvoiceTotals, computeLine } from '../domain/pricing';

export interface BillingRunResult {
  status?: 'ok' | 'already_running';
  run_id: number | null;
  created: number;
  skipped: number;
  failed: number;
  activated: number;
  auto_closed: number;
}

const LOCK_KEY = 'brightloop-billing-run';

/** A discount rule resolved for this run, with its product scope. */
interface DiscountRule {
  id: number;
  name: string;
  type: 'fixed' | 'percentage';
  value: Prisma.Decimal;
  minQuantity: number;
  minPurchase: Prisma.Decimal;
  maxUses: number;
  baseTimesUsed: number;
  scope: 'product' | 'subscription';
  productIds: Set<number>;
}

type SubWithLines = Prisma.SubscriptionGetPayload<{
  include: {
    plan: true;
    lines: { include: { tax: true, product: { include: { variants: true } } } };
  };
}>;
type SubLine = SubWithLines['lines'][number];

/** One computed invoice line plus the rule (if any) that discounted it. */
interface ComputedLine {
  result: ReturnType<typeof computeLine>;
  discountName: string | null;
  ruleId: number | null;
}

function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/** D15: "today or earlier" in the server's timezone — date-only values stored
 * as UTC midnight must still count as due during the local day. */
function startOfTomorrow(): Date {
  const t = startOfToday();
  t.setDate(t.getDate() + 1);
  return t;
}

function minOf(a: Prisma.Decimal, b: Prisma.Decimal): Prisma.Decimal {
  return a.lt(b) ? a : b;
}

@Injectable()
export class BillingService {
  constructor(private prisma: PrismaService) {}

  /**
   * INV-01..04, §6.2, D9, D18. Idempotent: the unique (subscription_id,
   * period_start) constraint makes double billing impossible; the catch-up
   * loop bills every missed period exactly once. Per-subscription
   * transactions isolate failures.
   */
  async run(userId: number): Promise<BillingRunResult> {
    // Advisory lock: two concurrent runs (nervous double-click, two staff,
    // a future cron colliding with a manual run) must not double-work or
    // double-increment discount counters. The DB constraint still guarantees
    // no duplicates — this makes concurrent runs cheap and honest.
    //
    // Session-scoped locks are held per CONNECTION; Prisma pools them, so the
    // lock + unlock must happen on the same session. Wrapping the run in one
    // interactive transaction pins that session (and crash-safety comes free:
    // a dead process drops the connection, releasing the lock). The run's own
    // per-period transactions work fine alongside — the outer tx holds no
    // table locks. Timeout raised above a worst-case full run (~1 min at 5k).
    return this.prisma.$transaction(
      async (lockTx) => {
        const locked = await lockTx.$queryRaw<{ locked: boolean }[]>`
          SELECT pg_try_advisory_lock(hashtext(${LOCK_KEY})) AS locked`;
        if (!locked[0]?.locked) {
          return {
            status: 'already_running' as const,
            run_id: null, created: 0, skipped: 0, failed: 0, activated: 0, auto_closed: 0,
          };
        }
        try {
          return await this.runLocked(userId);
        } finally {
          await lockTx.$queryRaw`SELECT pg_advisory_unlock(hashtext(${LOCK_KEY}))`;
        }
      },
      { timeout: 180_000, maxWait: 10_000 },
    );
  }

  private async runLocked(userId: number): Promise<BillingRunResult> {
    const today = startOfToday();

    // ── Housekeeping (D9), step 1: activate confirmed subs past start ──
    const activated = await this.prisma.subscription.updateMany({
      where: { status: SubscriptionStatus.confirmed, startDate: { lt: startOfTomorrow() } },
      data: { status: SubscriptionStatus.active },
    });

    // ── Billing loop: Active subscriptions due today or earlier ──
    // Runs BEFORE auto-close so an expired auto-close subscription still gets
    // its final period invoiced (the service was delivered).
    const due = await this.prisma.subscription.findMany({
      where: {
        status: SubscriptionStatus.active,
        nextBillingDate: { lt: startOfTomorrow() },
      },
      include: {
        plan: true,
        lines: { include: { tax: true, product: { include: { variants: true } } } },
      },
    });

    const rules = await this.activeDiscountRules(today);
    const usageState = new Map<number, number>(); // ruleId → applications this run (max_uses enforcement)
    let created = 0;
    let skipped = 0;
    let failed = 0;

    for (const sub of due) {
      try {
        const result = await this.billSubscription(sub, rules, usageState, today);
        created += result.created;
        skipped += result.skipped;
      } catch (err) {
        failed += 1;
        console.error(`[billing] subscription ${sub.id} failed:`, err);
      }
    }

    // ── Housekeeping (D9), step 2: auto-close expired subs AFTER billing ──
    const expired = await this.prisma.subscription.findMany({
      where: {
        status: { in: [SubscriptionStatus.active, SubscriptionStatus.paused] },
        expiryDate: { lt: startOfTomorrow() },
        plan: { autoClose: true },
      },
      select: { id: true },
    });
    let autoClosed = 0;
    for (const sub of expired) {
      const res = await this.prisma.subscription.updateMany({
        where: { id: sub.id, status: { in: [SubscriptionStatus.active, SubscriptionStatus.paused] } },
        data: { status: SubscriptionStatus.closed },
      });
      autoClosed += res.count;
      if (res.count) {
        await this.prisma.subscriptionStatusHistory.create({
          data: {
            subscriptionId: sub.id,
            fromStatus: SubscriptionStatus.active,
            toStatus: SubscriptionStatus.closed,
            changedBy: userId,
          },
        });
      }
    }

    const run = await this.prisma.billingRun.create({
      data: {
        triggeredBy: userId,
        createdCount: created,
        skippedCount: skipped,
        failedCount: failed,
        log: `activated=${activated.count} autoClosed=${autoClosed} due=${due.length}`,
      },
    });

    return { run_id: run.id, created, skipped, failed, activated: activated.count, auto_closed: autoClosed };
  }

  /** Rules active today (usage limits enforced in pickDiscount against run-scoped state). */
  private async activeDiscountRules(today: Date): Promise<DiscountRule[]> {
    const rules = await this.prisma.discount.findMany({
      where: {
        isActive: true,
        startDate: { lte: today },
        endDate: { gte: today },
      },
      include: { products: { select: { productId: true } } },
    });
    return rules.map((r) => ({
      id: r.id,
      name: r.name,
      type: r.type,
      value: r.value,
      minQuantity: r.minQuantity,
      minPurchase: r.minPurchase,
      maxUses: r.maxUses,
      baseTimesUsed: r.timesUsed,
      scope: r.scope,
      productIds: new Set(r.products.map((p) => p.productId)),
    }));
  }

  /**
   * Bill one subscription: catch-up over every missed period, one invoice per
   * period. Each PERIOD runs in its own transaction — an already-invoiced
   * period (crash recovery) or a concurrent-run race must not abort the work
   * for later periods, and already-billed periods stay billed.
   */
  private async billSubscription(
    sub: SubWithLines,
    rules: DiscountRule[],
    usageState: Map<number, number>,
    today: Date,
  ): Promise<{ created: number; skipped: number }> {
    let nextBilling: Date = sub.nextBillingDate;
    let created = 0;
    let skipped = 0;
    let guard = 0; // hard stop against a pathological schedule

    // Auto-close plans terminate at expiry (SUB-08) — never bill a period
    // starting at/after it. Plans without auto_close keep billing monthly
    // while Active (renewal-by-inaction; only manual close stops them).
    const horizon = sub.plan.autoClose ? sub.expiryDate : startOfTomorrow();

    while (nextBilling < startOfTomorrow() && nextBilling < horizon && guard++ < 100) {
      const periodStart = new Date(nextBilling);
      const periodEnd = addPeriod(periodStart, sub.plan.billingPeriod);

      // One pass: compute every line + its best discount rule (§6.3/D1).
      // Pure — usage is only recorded once the invoice actually lands.
      const subscriptionSubtotal = sub.lines.reduce(
        (acc, l) => acc.plus(new Prisma.Decimal(l.unitPrice).mul(l.quantity)),
        new Prisma.Decimal(0),
      );
      const computed: ComputedLine[] = sub.lines.map((line) => {
        const best = this.pickDiscount(rules, line, lineSubtotalOf(line), subscriptionSubtotal, usageState);
        const result = computeLine({
          unit_price: line.unitPrice.toString(),
          quantity: line.quantity,
          tax_percent: line.tax ? Number(line.tax.percentage) : 0,
          discount_amount: best ? best.amount.toString() : '0',
        });
        return { result, discountName: best ? best.rule.name : null, ruleId: best ? best.rule.id : null };
      });
      const totals = computeInvoiceTotals(computed.map((c) => c.result));

      const dueDate = new Date(periodStart);
      dueDate.setDate(dueDate.getDate() + sub.paymentTermsDays);

      const advance = addPeriod(periodStart, sub.plan.billingPeriod);
      let outcome: 'created' | 'skipped';
      try {
        outcome = await this.prisma.$transaction(async (tx) => {
          // Pre-check skip (INV-03 recovery path): an invoice for this period
          // may already exist from a crashed earlier run. Checking first keeps
          // the transaction healthy — a P2002 here would abort it entirely.
          const existing = await tx.invoice.findUnique({
            where: { subscriptionId_periodStart: { subscriptionId: sub.id, periodStart } },
            select: { id: true },
          });
          if (existing) return 'skipped' as const;

          await tx.invoice.create({
            data: {
              subscriptionId: sub.id,
              customerId: sub.customerId,
              status: InvoiceStatus.confirmed, // D18: system-generated → payable immediately
              periodStart,
              periodEnd,
              issueDate: today,
              dueDate,
              subtotal: new Prisma.Decimal(totals.subtotal),
              discountTotal: new Prisma.Decimal(totals.discount_total),
              taxTotal: new Prisma.Decimal(totals.tax_total),
              total: new Prisma.Decimal(totals.total),
              lines: {
                create: sub.lines.map((line, i) => ({
                  productId: line.productId,
                  description: describeLine(line),
                  quantity: line.quantity,
                  unitPrice: new Prisma.Decimal(line.unitPrice),
                  discountAmount: new Prisma.Decimal(computed[i].result.discount_amount),
                  discountName: computed[i].discountName, // DSC-08
                  taxAmount: new Prisma.Decimal(computed[i].result.tax_amount),
                  lineTotal: new Prisma.Decimal(computed[i].result.line_total),
                })),
              },
            },
          });

          // Usage counters for rules applied this period (§6.3, same transaction)
          for (const c of computed) {
            if (c.ruleId !== null) {
              await tx.discount.update({ where: { id: c.ruleId }, data: { timesUsed: { increment: 1 } } });
            }
          }

          // Advance the schedule atomically with the invoice (INV-04)
          await tx.subscription.update({
            where: { id: sub.id },
            data: { nextBillingDate: advance },
          });
          return 'created' as const;
        });
      } catch (err) {
        if ((err as { code?: string })?.code === 'P2002') {
          // Lost a race with a concurrent run — the constraint held (INV-03).
          // Advance the schedule separately so this period is never retried.
          outcome = 'skipped';
          await this.prisma.subscription.update({
            where: { id: sub.id },
            data: { nextBillingDate: advance },
          });
        } else {
          throw err;
        }
      }

      if (outcome === 'created') {
        created += 1;
        for (const c of computed) {
          if (c.ruleId !== null) usageState.set(c.ruleId, (usageState.get(c.ruleId) ?? 0) + 1);
        }
      } else {
        skipped += 1;
      }

      nextBilling = advance;
    }

    return { created, skipped };
  }

  /**
   * Best single discount for one line (§6.3/D1): scope + qty + purchase
   * minimums; largest saving wins; ties go to the first rule. Pure — the
   * caller records usage only after the invoice lands (a skipped period
   * must not consume a capped rule's budget).
   */
  private pickDiscount(
    rules: DiscountRule[],
    line: SubLine,
    lineSubtotal: Prisma.Decimal,
    subscriptionSubtotal: Prisma.Decimal,
    usageState: Map<number, number>,
  ): { rule: DiscountRule; amount: Prisma.Decimal } | null {
    let best: { rule: DiscountRule; amount: Prisma.Decimal } | null = null;

    for (const rule of rules) {
      if (rule.minQuantity > line.quantity) continue;
      const purchaseBase = rule.scope === 'subscription' ? subscriptionSubtotal : lineSubtotal;
      if (rule.minPurchase.gt(purchaseBase)) continue;
      if (rule.scope === 'product' && !rule.productIds.has(line.productId)) continue;
      // DSC-05: usage limit — DB counter plus invoices already landed this run
      if (rule.maxUses > 0 && rule.baseTimesUsed + (usageState.get(rule.id) ?? 0) >= rule.maxUses) continue;

      const amount =
        rule.type === 'fixed'
          ? minOf(rule.value, lineSubtotal)
          : lineSubtotal.mul(rule.value).div(100);

      if (!best || amount.gt(best.amount)) best = { rule, amount };
    }

    return best;
  }
}

function lineSubtotalOf(line: SubLine): Prisma.Decimal {
  return new Prisma.Decimal(line.unitPrice).mul(line.quantity);
}

function describeLine(line: SubLine): string {
  const variant = line.variantId
    ? line.product.variants.find((v) => v.id === line.variantId)
    : undefined;
  return variant ? `${line.product.name} (${variant.attribute}: ${variant.value})` : line.product.name;
}

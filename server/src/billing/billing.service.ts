import { Injectable } from '@nestjs/common';
import { InvoiceStatus, Prisma, SubscriptionStatus } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';
import { addPeriod } from '../domain/billing-dates';
import { computeInvoiceTotals, computeLine } from '../domain/pricing';

export interface BillingRunResult {
  run_id: number;
  created: number;
  skipped: number;
  failed: number;
  activated: number;
  auto_closed: number;
}

/** A discount rule resolved for this run, with its product scope. */
interface DiscountRule {
  id: number;
  name: string;
  type: 'fixed' | 'percentage';
  value: Prisma.Decimal;
  minQuantity: number;
  minPurchase: Prisma.Decimal;
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
}

function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
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
    const today = startOfToday();

    // ── Housekeeping (D9): activate confirmed past start, auto-close expired ──
    const activated = await this.prisma.subscription.updateMany({
      where: { status: SubscriptionStatus.confirmed, startDate: { lte: today } },
      data: { status: SubscriptionStatus.active },
    });

    const expired = await this.prisma.subscription.findMany({
      where: {
        status: { in: [SubscriptionStatus.active, SubscriptionStatus.paused] },
        expiryDate: { lte: today },
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

    // ── Billing loop: Active subscriptions due today or earlier ──
    const due = await this.prisma.subscription.findMany({
      where: {
        status: SubscriptionStatus.active,
        nextBillingDate: { lte: today },
      },
      include: {
        plan: true,
        lines: { include: { tax: true, product: { include: { variants: true } } } },
      },
    });

    const rules = await this.activeDiscountRules(today);
    let created = 0;
    let skipped = 0;
    let failed = 0;

    for (const sub of due) {
      try {
        const result = await this.prisma.$transaction((tx) => this.billSubscription(tx, sub, rules, today));
        created += result.created;
        skipped += result.skipped;
      } catch (err) {
        failed += 1;
        console.error(`[billing] subscription ${sub.id} failed:`, err);
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

  /** Rules active today and under their usage limit (§6.3). */
  private async activeDiscountRules(today: Date): Promise<DiscountRule[]> {
    const rules = await this.prisma.discount.findMany({
      where: {
        isActive: true,
        startDate: { lte: today },
        endDate: { gte: today },
        OR: [{ maxUses: 0 }, { timesUsed: { lt: this.prisma.discount.fields.maxUses } }],
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
      scope: r.scope,
      productIds: new Set(r.products.map((p) => p.productId)),
    }));
  }

  /**
   * Bill one subscription: catch-up over every missed period, one invoice per
   * period, all inside the caller's transaction.
   */
  private async billSubscription(
    tx: Prisma.TransactionClient,
    sub: SubWithLines,
    rules: DiscountRule[],
    today: Date,
  ): Promise<{ created: number; skipped: number }> {
    let nextBilling: Date = sub.nextBillingDate;
    let created = 0;
    let skipped = 0;
    let guard = 0; // hard stop against a pathological schedule

    while (nextBilling <= today && guard++ < 100) {
      const periodStart = new Date(nextBilling);
      const periodEnd = addPeriod(periodStart, sub.plan.billingPeriod);

      // One pass: compute every line + its best discount rule (§6.3/D1)
      const subscriptionSubtotal = sub.lines.reduce(
        (acc, l) => acc.plus(new Prisma.Decimal(l.unitPrice).mul(l.quantity)),
        new Prisma.Decimal(0),
      );
      const usedRules = new Map<number, number>();
      const computed: ComputedLine[] = sub.lines.map((line) => {
        const best = this.pickDiscount(rules, line, lineSubtotalOf(line), subscriptionSubtotal, usedRules);
        const result = computeLine({
          unit_price: line.unitPrice.toString(),
          quantity: line.quantity,
          tax_percent: line.tax ? Number(line.tax.percentage) : 0,
          discount_amount: best ? best.amount.toString() : '0',
        });
        return { result, discountName: best ? best.rule.name : null };
      });
      const totals = computeInvoiceTotals(computed.map((c) => c.result));

      const dueDate = new Date(periodStart);
      dueDate.setDate(dueDate.getDate() + sub.paymentTermsDays);

      try {
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
        created += 1;
      } catch (err) {
        if ((err as { code?: string })?.code === 'P2002') {
          // Already billed for this period — skip, never double-bill (INV-03)
          skipped += 1;
        } else {
          throw err;
        }
      }

      // Usage counters for rules applied this period (§6.3, same transaction)
      for (const [ruleId, times] of usedRules) {
        if (times > 0) {
          await tx.discount.update({ where: { id: ruleId }, data: { timesUsed: { increment: times } } });
        }
      }

      // Advance the schedule; the loop continues while still behind (INV-04)
      nextBilling = addPeriod(nextBilling, sub.plan.billingPeriod);
      await tx.subscription.update({
        where: { id: sub.id },
        data: { nextBillingDate: nextBilling },
      });
    }

    return { created, skipped };
  }

  /**
   * Best single discount for one line (§6.3/D1): scope + qty + purchase
   * minimums; largest saving wins; ties go to the first rule. Records usage
   * into `usedRules` (incremented by the caller in the same transaction).
   */
  private pickDiscount(
    rules: DiscountRule[],
    line: SubLine,
    lineSubtotal: Prisma.Decimal,
    subscriptionSubtotal: Prisma.Decimal,
    usedRules: Map<number, number>,
  ): { rule: DiscountRule; amount: Prisma.Decimal } | null {
    let best: { rule: DiscountRule; amount: Prisma.Decimal } | null = null;

    for (const rule of rules) {
      if (rule.minQuantity > line.quantity) continue;
      const purchaseBase = rule.scope === 'subscription' ? subscriptionSubtotal : lineSubtotal;
      if (rule.minPurchase.gt(purchaseBase)) continue;
      if (rule.scope === 'product' && !rule.productIds.has(line.productId)) continue;

      const amount =
        rule.type === 'fixed'
          ? minOf(rule.value, lineSubtotal)
          : lineSubtotal.mul(rule.value).div(100);

      if (!best || amount.gt(best.amount)) best = { rule, amount };
    }

    if (best) usedRules.set(best.rule.id, (usedRules.get(best.rule.id) ?? 0) + 1);
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

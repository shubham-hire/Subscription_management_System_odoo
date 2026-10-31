/**
 * Scale seed (Step 7 / PRD §9.1): 500 subscriptions + ~1,200 invoices so the
 * <2s performance target can be proven. Run AFTER `prisma db seed`:
 *   npx ts-node prisma/seed-scale.ts
 * Restartable: wipes its own previous scale data (keeps SUB-000001 fixture),
 * assigns numbers explicitly, then syncs the DB sequences.
 */
import { PrismaClient, SubscriptionStatus } from '@prisma/client';

const prisma = new PrismaClient();

const SUBS = 500;
const CUSTOMERS = 450;
const FIXTURE_SUB = 'SUB-000001';

const nextNumber = (prefix: string, n: number) => `${prefix}-${String(n).padStart(6, '0')}`;

async function maxNumber(prefix: string, table: 'subscriptions' | 'invoices'): Promise<number> {
  const rows = await prisma.$queryRawUnsafe<{ number: string }[]>(
    `SELECT number FROM "${table}" WHERE number LIKE '${prefix}-%' ORDER BY number DESC LIMIT 1`,
  );
  if (!rows.length) return 0;
  return parseInt(rows[0].number.slice(prefix.length + 1), 10);
}

async function main() {
  const day = (offset: number) => new Date(Date.now() + offset * 86_400_000);

  // ── Restartable: wipe our own previous scale data ──
  const scaleSubIds = (
    await prisma.subscription.findMany({
      where: { number: { not: FIXTURE_SUB } },
      select: { id: true },
    })
  ).map((s) => s.id);
  if (scaleSubIds.length) {
    const scaleInvoices = await prisma.invoice.findMany({ where: { subscriptionId: { in: scaleSubIds } }, select: { id: true } });
    const scaleInvoiceIds = scaleInvoices.map((i) => i.id);
    await prisma.payment.deleteMany({ where: { invoiceId: { in: scaleInvoiceIds } } });
    await prisma.invoiceLine.deleteMany({ where: { invoiceId: { in: scaleInvoiceIds } } });
    await prisma.invoice.deleteMany({ where: { id: { in: scaleInvoiceIds } } });
    await prisma.subscriptionLine.deleteMany({ where: { subscriptionId: { in: scaleSubIds } } });
    await prisma.subscriptionStatusHistory.deleteMany({ where: { subscriptionId: { in: scaleSubIds } } });
    await prisma.subscription.deleteMany({ where: { id: { in: scaleSubIds } } });
    console.log(`Cleared previous scale data (${scaleSubIds.length} subs).`);
  }

  // ── Customers (bulk) ──
  const customerCount = await prisma.customer.count();
  if (customerCount < CUSTOMERS) {
    const rows = Array.from({ length: CUSTOMERS - customerCount }, (_, i) => ({
      name: `Contact ${customerCount + i + 1}`,
      company: `Customer Co ${customerCount + i + 1} Pvt Ltd`,
      email: `co${customerCount + i + 1}@example.test`,
      phone: `+91 90${String(10000000 + customerCount + i).slice(0, 8)}`,
      billingAddress: `${customerCount + i + 1} MG Road, Bengaluru`,
    }));
    await prisma.customer.createMany({ data: rows, skipDuplicates: true });
  }

  const customers = await prisma.customer.findMany({ select: { id: true }, orderBy: { id: 'asc' } });
  const product = await prisma.product.findFirstOrThrow({ select: { id: true, salesPrice: true, taxId: true } });
  const plan = await prisma.plan.findFirstOrThrow({ select: { id: true, minQuantity: true } });

  // ── Subscriptions: realistic status mix, explicit numbers ──
  const statusPool: SubscriptionStatus[] = [
    ...Array<SubscriptionStatus>(380).fill('active'),
    ...Array<SubscriptionStatus>(40).fill('confirmed'),
    ...Array<SubscriptionStatus>(30).fill('draft'),
    ...Array<SubscriptionStatus>(20).fill('quotation'),
    ...Array<SubscriptionStatus>(10).fill('paused'),
    ...Array<SubscriptionStatus>(20).fill('closed'),
  ];

  let subNo = await maxNumber('SUB', 'subscriptions');
  let invNo = await maxNumber('INV', 'invoices');

  const subRows = statusPool.map((status, i) => {
    const customer = customers[i % customers.length];
    const start = day(-90 + (i % 80));
    const expiry = new Date(start);
    expiry.setMonth(expiry.getMonth() + 1);
    return {
      number: nextNumber('SUB', ++subNo),
      customerId: customer.id,
      planId: plan.id,
      status,
      startDate: start,
      expiryDate: expiry,
      nextBillingDate: day((i % 12) - 6), // 6 days overdue → 5 ahead (catch-up demo)
      paymentTermsDays: [0, 15, 30][i % 3],
      createdBy: 2,
    };
  });
  await prisma.subscription.createMany({ data: subRows });

  const subs = await prisma.subscription.findMany({
    select: { id: true, customerId: true, startDate: true },
    where: { number: { not: FIXTURE_SUB } },
    orderBy: { id: 'asc' },
  });

  // ── Lines (1–2 per sub) ──
  const lineRows = subs.flatMap((sub, i) => {
    const rows = [
      {
        subscriptionId: sub.id,
        productId: product.id,
        quantity: plan.minQuantity + (i % 3),
        unitPrice: product.salesPrice,
        taxId: product.taxId,
      },
    ];
    if (i % 4 === 0) {
      rows.push({ subscriptionId: sub.id, productId: product.id, quantity: 1, unitPrice: product.salesPrice, taxId: product.taxId });
    }
    return rows;
  });
  await prisma.subscriptionLine.createMany({ data: lineRows });

  // ── Invoices: 1–3 monthly periods per billable sub ──
  const billable = subs.filter((s) => subs.indexOf(s) % 10 !== 3 && subs.indexOf(s) % 10 !== 6); // ~80%
  const subtotal = product.salesPrice.mul(2);
  const discount = subtotal.mul(0.1);
  const tax = subtotal.minus(discount).mul(0.18);
  const total = subtotal.minus(discount).plus(tax);

  const invoiceRows = billable.flatMap((sub, i) => {
    const periods = 1 + (i % 3);
    return Array.from({ length: periods }, (_, p) => {
      const periodStart = new Date(sub.startDate);
      periodStart.setMonth(periodStart.getMonth() + p);
      const periodEnd = new Date(periodStart);
      periodEnd.setMonth(periodEnd.getMonth() + 1);
      const due = new Date(periodStart);
      due.setDate(due.getDate() + 15);
      const mode = i % 3; // 0: fully paid, 1: half paid (overdue), 2: unpaid (overdue)
      return {
        number: nextNumber('INV', ++invNo),
        subscriptionId: sub.id,
        customerId: sub.customerId,
        status: mode === 0 ? ('paid' as const) : ('confirmed' as const),
        periodStart,
        periodEnd,
        issueDate: periodStart,
        dueDate: due,
        subtotal,
        discountTotal: discount,
        taxTotal: tax,
        total,
        amountPaid: mode === 0 ? total : mode === 1 ? total.div(2) : subtotal.mul(0),
      };
    });
  });
  for (let i = 0; i < invoiceRows.length; i += 500) {
    await prisma.invoice.createMany({ data: invoiceRows.slice(i, i + 500) });
  }

  // ── Payments for paid invoices ──
  const paid = await prisma.invoice.findMany({ where: { status: 'paid' }, select: { id: true, amountPaid: true, issueDate: true } });
  const paymentRows = paid.map((inv) => ({
    invoiceId: inv.id,
    method: 'bank_transfer' as const,
    amount: inv.amountPaid,
    paymentDate: inv.issueDate,
    note: 'Scale seed',
    recordedBy: 2,
  }));
  for (let i = 0; i < paymentRows.length; i += 500) {
    await prisma.payment.createMany({ data: paymentRows.slice(i, i + 500) });
  }

  // ── Sync sequences so DB-default inserts (B's billing run) continue after ours ──
  await prisma.$executeRawUnsafe(`SELECT setval('subscription_number_seq', ${subNo})`);
  await prisma.$executeRawUnsafe(`SELECT setval('invoice_number_seq', ${invNo})`);

  const [subCount, invCount] = await Promise.all([prisma.subscription.count(), prisma.invoice.count()]);
  console.log(`Scale seed complete: ${subCount} subscriptions, ${invCount} invoices (seq at SUB-${subNo}, INV-${invNo}).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

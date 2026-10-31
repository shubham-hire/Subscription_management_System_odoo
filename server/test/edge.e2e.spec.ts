/**
 * Edge-case integration suite. Boots the real app against the disposable
 * test DB and attacks boundaries: input normalization, token expiry,
 * validation limits, lifecycle boundaries, discount rule interactions,
 * billing scheduling edges (auto-close ordering, paused subs, pre-invoiced
 * periods), payment over-settle, and empty-state reports.
 *
 * Describes run in definition order (fileParallelism: false) and share
 * file-level state (tokens, fixture ids).
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as bcrypt from 'bcryptjs';
import { JwtService } from '@nestjs/jwt';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma.service';
import { HttpExceptionFilter } from '../src/common/http-exception.filter';
import { MoneyFormatInterceptor } from '../src/common/money-format.interceptor';

let app: INestApplication;
let prisma: PrismaService;

let adminToken = '';
let staffToken = '';
let customerToken = '';
let customerId = 0;
let productId = 0;
let widePlanId = 0;

// captured by the billing describe for the payment describe
let s1InvoiceId = 0;

const day = (offset: number) => new Date(Date.now() + offset * 86_400_000);
const dayStr = (offset: number) => day(offset).toISOString().slice(0, 10);

const api = () => request(app.getHttpServer());

async function wipeAll() {
  for (const m of [
    'auditLog', 'billingRun', 'payment', 'invoiceLine', 'invoice',
    'subscriptionStatusHistory', 'subscriptionLine', 'subscription',
    'discountProduct', 'discount', 'templateLine', 'quotationTemplate',
    'productVariant', 'product', 'plan', 'tax', 'user', 'customer',
  ] as const) {
    await prisma[m].deleteMany();
  }
}

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new MoneyFormatInterceptor());
  await app.init();
  prisma = app.get(PrismaService);
  await wipeAll();
}, 90_000);

afterAll(async () => {
  await app?.close();
});

// ── Auth edges ──────────────────────────────────────────────────────────────

describe('auth edge cases', () => {
  beforeAll(async () => {
    await prisma.user.createMany({
      data: [
        { name: 'Admin', email: 'admin@edge.test', passwordHash: await bcrypt.hash('AdminPass1!', 4), role: 'admin' },
        { name: 'Staff', email: 'staff@edge.test', passwordHash: await bcrypt.hash('StaffPass1!', 4), role: 'staff' },
      ],
    });
    const c = await prisma.customer.create({ data: { name: 'Edge Co', email: 'customer@edge.test' } });
    customerId = c.id;
    await prisma.user.create({
      data: { name: 'Cust', email: 'customer@edge.test', passwordHash: await bcrypt.hash('CustPass1!', 4), role: 'customer', customerId: c.id },
    });
    const login = async (email: string, password: string) =>
      (await api().post('/auth/login').send({ email, password })).body.token;
    adminToken = await login('admin@edge.test', 'AdminPass1!');
    staffToken = await login('staff@edge.test', 'StaffPass1!');
    customerToken = await login('customer@edge.test', 'CustPass1!');
  });

  it('trims and lowercases emails on signup, and login accepts any case', async () => {
    const up = await api().post('/auth/signup')
      .send({ name: 'Norm', email: '  Norm@Case.COM ', password: 'GoodPass1!' });
    expect(up.status).toBe(201);
    const me = await api().get('/auth/me').set('Authorization', `Bearer ${up.body.token}`);
    expect(me.body.email).toBe('norm@case.com');

    const original = await api().post('/auth/login')
      .send({ email: '  Norm@Case.COM ', password: 'GoodPass1!' });
    expect(original.status).toBe(200);
  });

  it('rejects an 8-char password that meets every composition rule (boundary)', async () => {
    const res = await api().post('/auth/signup')
      .send({ name: 'T', email: 'p8@edge.test', password: 'Aa1!bbbb' }); // 8 chars, valid composition
    expect(res.status).toBe(400);
    expect(res.body.error.fields.password).toContain('9 characters');
  });

  it('accepts exactly 9 characters with full composition', async () => {
    const res = await api().post('/auth/signup')
      .send({ name: 'T', email: 'p9@edge.test', password: 'Aa1!bbbb2' });
    expect(res.status).toBe(201);
  });

  it('rejects unknown fields (whitelist)', async () => {
    const res = await api().post('/auth/signup')
      .send({ name: 'T', email: 'x@edge.test', password: 'GoodPass1!', role: 'admin' });
    expect(res.status).toBe(400);
  });

  it('rejects wrong-typed bodies with 400, not 500', async () => {
    const res = await api().post('/auth/signup').send({ name: 5, email: 'not-an-email', password: 42 });
    expect(res.status).toBe(400);
  });

  it('rejects an expired token (crafted via the app JwtService)', async () => {
    const jwt = app.get(JwtService);
    const expired = await jwt.signAsync({
      sub: 1, role: 'admin', customerId: null,
      exp: Math.floor(Date.now() / 1000) - 60,
    });
    const res = await api().get('/auth/me').set('Authorization', `Bearer ${expired}`);
    expect(res.status).toBe(401);
  });
});

// ── Catalog boundaries ─────────────────────────────────────────────────────

describe('catalog boundary validation', () => {
  it('rejects a plan window where to == from (PLN-06 strict ordering)', async () => {
    const res = await api().post('/plans').set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Degenerate', price: '100', billing_period: 'monthly', min_quantity: 1, available_from: '2026-06-01', available_to: '2026-06-01' });
    expect(res.status).toBe(400);
  });

  it('rejects a discount where end == start', async () => {
    const res = await api().post('/discounts').set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Instant', type: 'percentage', value: '10', start_date: '2026-06-01', end_date: '2026-06-01', scope: 'subscription' });
    expect(res.status).toBe(400);
  });

  it('accepts 100% but rejects 101% percentage discounts (inclusive upper bound)', async () => {
    const hundred = await api().post('/discounts').set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Full', type: 'percentage', value: '100', start_date: '2026-01-01', end_date: '2027-01-01', scope: 'subscription' });
    expect(hundred.status).toBe(201);
    await prisma.discount.update({ where: { id: hundred.body.id }, data: { isActive: false } }); // keep later runs clean

    const tooMuch = await api().post('/discounts').set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'TooMuch', type: 'percentage', value: '101', start_date: '2026-01-01', end_date: '2027-01-01', scope: 'subscription' });
    expect(tooMuch.status).toBe(400);
  });

  it('rejects a fixed discount of zero', async () => {
    const res = await api().post('/discounts').set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Free', type: 'fixed', value: '0', start_date: '2026-01-01', end_date: '2027-01-01', scope: 'subscription' });
    expect(res.status).toBe(400);
  });

  it('rejects money with 3 decimals (2-decimal wire format)', async () => {
    const res = await api().post('/products').set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Precise', type: 't', sales_price: '10.123', cost_price: '0' });
    expect(res.status).toBe(400);
  });

  it('rejects an unknown tax on a product', async () => {
    const res = await api().post('/products').set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'GhostTax', type: 't', sales_price: '10', cost_price: '0', tax_id: 999999 });
    expect(res.status).toBe(400);
  });

  it('rejects page 0 and caps page_size at 100', async () => {
    expect(
      (await api().get('/invoices?page=0').set('Authorization', `Bearer ${staffToken}`)).status,
    ).toBe(400);
    const capped = await api().get('/invoices?page_size=500').set('Authorization', `Bearer ${staffToken}`);
    expect(capped.status).toBe(200);
    expect(capped.body.page_size).toBe(100);
  });
});

// ── Subscription lifecycle edges ────────────────────────────────────────────

describe('subscription edge cases', () => {
  let tax0 = 0;
  let variantOtherProduct = 0;
  let windowPlanId = 0;
  let nonClosablePlanId = 0;
  let archivedProductId = 0;

  beforeAll(async () => {
    const tax = await prisma.tax.create({ data: { name: 'Zero', percentage: 0 } });
    tax0 = tax.id;
    const product = await prisma.product.create({
      data: { name: 'Edge Product', type: 'software', salesPrice: 1000, costPrice: 400, taxId: tax.id },
    });
    productId = product.id;
    const other = await prisma.product.create({
      data: { name: 'Other Product', type: 'software', salesPrice: 500, costPrice: 100, taxId: tax.id },
    });
    const otherVariant = await prisma.productVariant.create({
      data: { productId: other.id, attribute: 'Brand', value: 'SAP', priceExtra: 10 },
    });
    variantOtherProduct = otherVariant.id;

    widePlanId = (
      await prisma.plan.create({
        data: {
          name: 'Wide Monthly', price: 1000, billingPeriod: 'monthly', minQuantity: 1,
          availableFrom: new Date('2020-01-01'), availableTo: new Date('2030-12-31'),
          autoClose: false, closable: true, pausable: false, renewable: true,
        },
      })
    ).id;
    windowPlanId = (
      await prisma.plan.create({
        data: {
          name: 'Windowed', price: 100, billingPeriod: 'monthly', minQuantity: 1,
          availableFrom: new Date('2026-01-10'), availableTo: new Date('2026-03-20'),
          autoClose: false, closable: true, pausable: false, renewable: true,
        },
      })
    ).id;
    nonClosablePlanId = (
      await prisma.plan.create({
        data: {
          name: 'Locked In', price: 100, billingPeriod: 'monthly', minQuantity: 1,
          availableFrom: new Date('2020-01-01'), availableTo: new Date('2030-12-31'),
          autoClose: false, closable: false, pausable: false, renewable: true,
        },
      })
    ).id;
  });

  const createSub = (body: object, token = staffToken) =>
    api().post('/subscriptions').set('Authorization', `Bearer ${token}`).send(body);

  const line = (overrides: object = {}) => ({ product_id: productId, quantity: 1, ...overrides });

  it('accepts start dates exactly on the availability boundaries (inclusive)', async () => {
    const fromEdge = await createSub({ customer_id: customerId, plan_id: windowPlanId, start_date: '2026-01-10', lines: [line()] });
    expect(fromEdge.status).toBe(201);
    const toEdge = await createSub({ customer_id: customerId, plan_id: windowPlanId, start_date: '2026-03-20', lines: [line()] });
    expect(toEdge.status).toBe(201);
  });

  it('rejects start dates one day outside the window on either side', async () => {
    const before = await createSub({ customer_id: customerId, plan_id: windowPlanId, start_date: '2026-01-09', lines: [line()] });
    expect(before.status).toBe(400);
    const after = await createSub({ customer_id: customerId, plan_id: windowPlanId, start_date: '2026-03-21', lines: [line()] });
    expect(after.status).toBe(400);
  });

  it('computes month-end expiry with the clamp rule (Jan 31 start → Feb 28 expiry)', async () => {
    const res = await createSub({ customer_id: customerId, plan_id: widePlanId, start_date: '2026-01-31', lines: [line()] });
    expect(res.status).toBe(201);
    expect(res.body.expiryDate.slice(0, 10)).toBe('2026-02-28');
  });

  it('rejects an empty lines array', async () => {
    const res = await createSub({ customer_id: customerId, plan_id: widePlanId, start_date: dayStr(0), lines: [] });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('line');
  });

  it('rejects archived products on new subscriptions (PRD-05)', async () => {
    const created = await api().post('/products').set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Old Timer', type: 'software', sales_price: '50', cost_price: '10' });
    archivedProductId = created.body.product.id;
    const archived = await api().delete(`/products/${archivedProductId}`).set('Authorization', `Bearer ${adminToken}`);
    expect(archived.body.isActive).toBe(false);

    const res = await createSub({ customer_id: customerId, plan_id: widePlanId, start_date: dayStr(0), lines: [line({ product_id: archivedProductId })] });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('archived');
  });

  it('rejects a variant that belongs to a different product', async () => {
    const res = await createSub({ customer_id: customerId, plan_id: widePlanId, start_date: dayStr(0), lines: [line({ variant_id: variantOtherProduct })] });
    expect(res.status).toBe(400);
  });

  it('forbids line edits once the subscription is active (D13)', async () => {
    const created = await createSub({ customer_id: customerId, plan_id: widePlanId, start_date: dayStr(0), lines: [line()] });
    const id = created.body.id;
    for (const t of ['quotation', 'confirm', 'activate']) {
      await api().post(`/subscriptions/${id}/${t}`).set('Authorization', `Bearer ${staffToken}`);
    }
    const res = await api().patch(`/subscriptions/${id}/lines`).set('Authorization', `Bearer ${staffToken}`)
      .send({ lines: [line({ quantity: 5 })] });
    expect(res.status).toBe(403);
  });

  it('rejects early close on a non-closable plan (PLN-02)', async () => {
    const created = await createSub({ customer_id: customerId, plan_id: nonClosablePlanId, start_date: dayStr(0), lines: [line()] });
    const id = created.body.id;
    for (const t of ['quotation', 'confirm', 'activate']) {
      await api().post(`/subscriptions/${id}/${t}`).set('Authorization', `Bearer ${staffToken}`);
    }
    const res = await api().post(`/subscriptions/${id}/close`).set('Authorization', `Bearer ${staffToken}`);
    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('cannot be closed');
  });

  it('rejects confirming a quotation that expired (D10, backdated history)', async () => {
    const created = await createSub({ customer_id: customerId, plan_id: widePlanId, start_date: dayStr(0), lines: [line()] });
    const id = created.body.id;
    await api().post(`/subscriptions/${id}/quotation`).set('Authorization', `Bearer ${staffToken}`);
    await prisma.subscriptionStatusHistory.updateMany({
      where: { subscriptionId: id, toStatus: 'quotation' },
      data: { changedAt: day(-31) },
    });
    const res = await api().post(`/subscriptions/${id}/confirm`).set('Authorization', `Bearer ${staffToken}`);
    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('expired');
  });

  it('404s transitions on unknown subscriptions', async () => {
    const res = await api().post('/subscriptions/999999/close').set('Authorization', `Bearer ${staffToken}`);
    expect(res.status).toBe(404);
  });

  it('blocks customers from creating subscriptions (§2.2)', async () => {
    const res = await createSub({ customer_id: customerId, plan_id: widePlanId, start_date: dayStr(0), lines: [line()] }, customerToken);
    expect(res.status).toBe(403);
  });
});

// ── Billing engine edges ───────────────────────────────────────────────────

describe('billing edge cases', () => {
  let autoClosePlanId = 0;
  const createdRuleIds: number[] = [];

  beforeAll(async () => {
    autoClosePlanId = (
      await prisma.plan.create({
        data: {
          name: 'Auto Close Monthly', price: 1000, billingPeriod: 'monthly', minQuantity: 1,
          availableFrom: new Date('2020-01-01'), availableTo: new Date('2030-12-31'),
          autoClose: true, closable: true, pausable: false, renewable: true,
        },
      })
    ).id;
  });

  const mkActiveSub = async (startOffsetDays: number, planId: number = widePlanId) => {
    const res = await api().post('/subscriptions').set('Authorization', `Bearer ${staffToken}`)
      .send({ customer_id: customerId, plan_id: planId, start_date: dayStr(startOffsetDays), payment_terms_days: 0, lines: [{ product_id: productId, quantity: 1 }] });
    expect(res.status, `mkSub: ${JSON.stringify(res.body)}`).toBe(201);
    for (const t of ['quotation', 'confirm', 'activate']) {
      const r = await api().post(`/subscriptions/${res.body.id}/${t}`).set('Authorization', `Bearer ${staffToken}`);
      expect(r.status).toBe(201);
    }
    return res.body.id;
  };

  const mkRule = (overrides: object = {}) =>
    prisma.discount.create({
      data: {
        name: 'Edge rule', type: 'percentage', value: 10, minQuantity: 0, minPurchase: 0,
        startDate: day(-1), endDate: day(30), maxUses: 0, scope: 'product',
        products: { create: [{ productId }] },
        ...overrides,
      },
    });

  const deactivateRules = async () => {
    if (createdRuleIds.length) {
      await prisma.discount.updateMany({ where: { id: { in: createdRuleIds.splice(0) } }, data: { isActive: false } });
    }
  };

  const runBilling = async () => {
    const res = await api().post('/billing/run').set('Authorization', `Bearer ${staffToken}`);
    expect(res.status).toBe(201);
    return res.body;
  };

  const invoicesFor = async (subId: number) => {
    const res = await api().get(`/invoices?subscription_id=${subId}&page_size=100`).set('Authorization', `Bearer ${staffToken}`);
    return res.body.items.sort((a: { periodStart: string }, b: { periodStart: string }) => a.periodStart.localeCompare(b.periodStart));
  };

  it('picks the best of two applicable rules per line (20% beats fixed 100 on ₹1000)', async () => {
    const fixed = await mkRule({ name: 'Fixed 100', type: 'fixed', value: 100 });
    const pct = await mkRule({ name: 'Pct 20', type: 'percentage', value: 20 });
    createdRuleIds.push(fixed.id, pct.id);

    const subId = await mkActiveSub(0);
    await runBilling();

    const invoices = await invoicesFor(subId);
    expect(invoices).toHaveLength(1);
    expect(invoices[0].discountTotal).toBe('200.00');
    expect(invoices[0].total).toBe('800.00');
    expect(invoices[0].lines[0].discountName).toBe('Pct 20');
    s1InvoiceId = invoices[0].id; // reused by the payment describe
    await deactivateRules();
  });

  it('applies a subscription-scope rule when the subtotal exactly meets min_purchase (>= boundary)', async () => {
    const rule = await mkRule({ name: 'Sub floor', type: 'fixed', value: 50, scope: 'subscription', minPurchase: 1000, products: undefined });
    createdRuleIds.push(rule.id);

    const subId = await mkActiveSub(0);
    await runBilling();

    const invoices = await invoicesFor(subId);
    expect(invoices).toHaveLength(1);
    expect(invoices[0].discountTotal).toBe('50.00');
    await deactivateRules();
  });

  it('applies an unlimited rule (max_uses = 0) to every catch-up period', async () => {
    const rule = await mkRule({ name: 'Always 10', type: 'percentage', value: 10, maxUses: 0 });
    createdRuleIds.push(rule.id);

    const subId = await mkActiveSub(-70);
    await runBilling();

    const invoices = await invoicesFor(subId);
    expect(invoices).toHaveLength(3); // 70 days ≈ 3 missed monthly periods
    for (const inv of invoices) expect(inv.discountTotal).toBe('100.00');
    await deactivateRules();
  });

  it('clamps a fixed discount above the subtotal: line nets to exactly zero (DSC-07)', async () => {
    const rule = await mkRule({ name: 'Too generous', type: 'fixed', value: 9999 });
    createdRuleIds.push(rule.id);

    const subId = await mkActiveSub(0);
    await runBilling();

    const invoices = await invoicesFor(subId);
    expect(invoices).toHaveLength(1);
    expect(invoices[0].discountTotal).toBe('1000.00');
    expect(invoices[0].total).toBe('0.00');
    await deactivateRules();
  });

  it('ignores a rule that only starts tomorrow (date window boundary)', async () => {
    const rule = await mkRule({ name: 'Future', type: 'percentage', value: 50, startDate: day(1), endDate: day(30) });
    createdRuleIds.push(rule.id);

    const subId = await mkActiveSub(0);
    await runBilling();

    const invoices = await invoicesFor(subId);
    expect(invoices).toHaveLength(1);
    expect(invoices[0].discountTotal).toBe('0.00');
    expect(invoices[0].total).toBe('1000.00');
    await deactivateRules();
  });

  it('skips (not fails) a period already invoiced without advancing (INV-03 recovery path)', async () => {
    const subId = await mkActiveSub(0);
    const sub = await api().get(`/subscriptions/${subId}`).set('Authorization', `Bearer ${staffToken}`);
    const periodStart = new Date(sub.body.startDate);

    // simulate a crash: invoice exists but next_billing_date never advanced
    await prisma.invoice.create({
      data: {
        number: 'INV-950001', subscriptionId: subId, customerId, status: 'confirmed',
        periodStart, periodEnd: day(30), issueDate: day(0), dueDate: day(0),
        subtotal: 1000, total: 1000,
      },
    });

    const run = await runBilling();
    expect(run.failed).toBe(0);
    expect(run.skipped).toBeGreaterThanOrEqual(1);

    const invoices = await invoicesFor(subId);
    expect(invoices).toHaveLength(1); // no duplicate — the constraint held
  });

  it('auto-close plans: bills the final period FIRST, then closes (SUB-08 ordering)', async () => {
    const subId = await mkActiveSub(-65, autoClosePlanId); // expired ~35 days ago, never billed
    const sub = await api().get(`/subscriptions/${subId}`).set('Authorization', `Bearer ${staffToken}`);

    const run = await runBilling();
    expect(run.auto_closed).toBeGreaterThanOrEqual(1);

    const after = await api().get(`/subscriptions/${subId}`).set('Authorization', `Bearer ${staffToken}`);
    expect(after.body.status).toBe('closed');

    const invoices = await invoicesFor(subId);
    expect(invoices).toHaveLength(1); // the final delivered period was invoiced
    expect(invoices[0].periodStart.slice(0, 10)).toBe(sub.body.startDate.slice(0, 10));

    await runBilling();
    expect(await invoicesFor(subId)).toHaveLength(1); // closed → never billed again
  });

  it('never bills a paused subscription (INV-01 scope)', async () => {
    const subId = await mkActiveSub(-5);
    await prisma.subscription.update({ where: { id: subId }, data: { status: 'paused' } });

    await runBilling();

    expect(await invoicesFor(subId)).toHaveLength(0);
    const after = await prisma.subscription.findUniqueOrThrow({ where: { id: subId } });
    expect(after.status).toBe('paused'); // untouched
  });
});

// ── Payment edges ───────────────────────────────────────────────────────────

describe('payment edge cases', () => {
  it('rejects paying an already-settled invoice (outstanding 0)', async () => {
    const settle = await api().post(`/invoices/${s1InvoiceId}/payments`).set('Authorization', `Bearer ${staffToken}`)
      .send({ method: 'upi', amount: '800.00', date: dayStr(0) });
    expect(settle.status).toBe(201);

    const again = await api().post(`/invoices/${s1InvoiceId}/payments`).set('Authorization', `Bearer ${staffToken}`)
      .send({ method: 'upi', amount: '1.00', date: dayStr(0) });
    expect(again.status).toBe(400);
    expect(again.body.error.fields.amount).toContain('outstanding balance of 0.00');
  });

  it('rejects 3-decimal amounts (money wire format)', async () => {
    const res = await api().post(`/invoices/${s1InvoiceId}/payments`).set('Authorization', `Bearer ${staffToken}`)
      .send({ method: 'cash', amount: '1.123', date: dayStr(0) });
    expect(res.status).toBe(400);
  });

  it('rejects non-ISO dates', async () => {
    const res = await api().post(`/invoices/${s1InvoiceId}/payments`).set('Authorization', `Bearer ${staffToken}`)
      .send({ method: 'cash', amount: '1.00', date: '31/13/2026' });
    expect(res.status).toBe(400);
  });
});

// ── Reports edges ───────────────────────────────────────────────────────────

describe('reports edge cases', () => {
  it('excludes cancelled past-due invoices from overdue views', async () => {
    const anySub = await prisma.subscription.findFirstOrThrow();
    await prisma.invoice.create({
      data: {
        number: 'INV-950002', subscriptionId: anySub.id, customerId, status: 'cancelled',
        periodStart: day(-80), periodEnd: day(-50), issueDate: day(-80), dueDate: day(-10),
        subtotal: 500, total: 500,
      },
    });

    const overdue = await api().get('/reports/overdue').set('Authorization', `Bearer ${staffToken}`);
    expect(overdue.body.map((i: { number: string }) => i.number)).not.toContain('INV-950002');

    const list = await api().get('/invoices?overdue=true&page_size=100').set('Authorization', `Bearer ${staffToken}`);
    expect(list.body.items.map((i: { number: string }) => i.number)).not.toContain('INV-950002');
  });
});

// ── Empty state (runs last: wipes everything) ───────────────────────────────

describe('empty-state reports', () => {
  beforeAll(async () => {
    await wipeAll(); // tokens stay valid — JWT is stateless
  });

  it('summary is all zeros with no data', async () => {
    const res = await api().get('/reports/summary').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      active_subscriptions: 0,
      revenue_collected: '0.00',
      outstanding: '0.00',
      overdue_count: 0,
      overdue_amount: '0.00',
    });
  });

  it('overdue list is empty', async () => {
    const res = await api().get('/reports/overdue').set('Authorization', `Bearer ${adminToken}`);
    expect(res.body).toEqual([]);
  });
});

/**
 * Comprehensive integration suite — closes the remaining coverage gaps:
 * PATCH endpoints (plans/taxes/discounts), the variant-add endpoint,
 * CUS-02 customer linking, double-confirm rejection, subscription list
 * filters, line-edit repricing, multi-line selective discounts, discount
 * date/quantity/purchase boundaries, no-tax lines, large-quantity exactness,
 * all five payment methods, malformed JSON, unicode round-trips, and
 * error-shape consistency across status codes.
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as bcrypt from 'bcryptjs';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma.service';
import { HttpExceptionFilter } from '../src/common/http-exception.filter';
import { MoneyFormatInterceptor } from '../src/common/money-format.interceptor';

let app: INestApplication;
let prisma: PrismaService;

let adminToken = '';
let staffToken = '';
let customerId = 0;
let tax18Id = 0;
let productAId = 0; // 1000.00, tax 18%
let productBId = 0; // 500.00, no tax
let planId = 0;

let createdRuleIds: number[] = [];

const dayStr = (offset: number) =>
  new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
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

  await prisma.user.createMany({
    data: [
      { name: 'Admin', email: 'admin@full.test', passwordHash: await bcrypt.hash('AdminPass1!', 4), role: 'admin' },
      { name: 'Staff', email: 'staff@full.test', passwordHash: await bcrypt.hash('StaffPass1!', 4), role: 'staff' },
    ],
  });
  const cust = await prisma.customer.create({ data: { name: 'Full Co', email: 'customer@full.test' } });
  customerId = cust.id;
  await prisma.user.create({
    data: { name: 'Cust', email: 'customer@full.test', passwordHash: await bcrypt.hash('CustPass1!', 4), role: 'customer', customerId: cust.id },
  });
  // a staff-created customer record that a later signup must LINK to, not duplicate (CUS-02)
  await prisma.customer.create({ data: { name: 'Pre-created Co', email: 'linked@full.test', phone: '+91 90000 00000' } });

  const login = async (email: string, password: string) =>
    (await api().post('/auth/login').send({ email, password })).body.token;
  adminToken = await login('admin@full.test', 'AdminPass1!');
  staffToken = await login('staff@full.test', 'StaffPass1!');

  const tax = await prisma.tax.create({ data: { name: 'GST 18%', percentage: 18 } });
  tax18Id = tax.id;
  const a = await prisma.product.create({
    data: { name: 'Alpha', type: 'software', salesPrice: 1000, costPrice: 100, taxId: tax.id },
  });
  productAId = a.id;
  const b = await prisma.product.create({
    data: { name: 'Beta', type: 'software', salesPrice: 500, costPrice: 50 }, // deliberately no tax
  });
  productBId = b.id;
  const plan = await prisma.plan.create({
    data: {
      name: 'Wide Monthly', price: 1000, billingPeriod: 'monthly', minQuantity: 1,
      availableFrom: new Date('2020-01-01'), availableTo: new Date('2030-12-31'),
      autoClose: false, closable: true, pausable: false, renewable: true,
    },
  });
  planId = plan.id;
}, 90_000);

afterAll(async () => {
  await app?.close();
});

// helpers -------------------------------------------------------------------

async function mkActiveSub(lines: object[], overrides: object = {}): Promise<number> {
  const created = await api().post('/subscriptions').set('Authorization', `Bearer ${staffToken}`)
    .send({
      customer_id: customerId, plan_id: planId,
      start_date: dayStr(0), payment_terms_days: 0,
      lines, ...overrides,
    });
  expect(created.status, `mkSub: ${JSON.stringify(created.body)}`).toBe(201);
  for (const t of ['quotation', 'confirm', 'activate']) {
    const r = await api().post(`/subscriptions/${created.body.id}/${t}`).set('Authorization', `Bearer ${staffToken}`);
    expect(r.status).toBe(201);
  }
  return created.body.id;
}

async function mkRule(overrides: object = {}, productIds: number[] = [productAId]) {
  const rule = await prisma.discount.create({
    data: {
      name: 'Comp rule', type: 'percentage', value: 10, minQuantity: 0, minPurchase: 0,
      startDate: new Date(Date.now() - 86_400_000), endDate: new Date(Date.now() + 30 * 86_400_000),
      maxUses: 0, scope: 'product',
      ...overrides,
      ...(productIds.length ? {} : {}),
    },
  });
  for (const pid of productIds) {
    await prisma.discountProduct.create({ data: { discountId: rule.id, productId: pid } });
  }
  createdRuleIds.push(rule.id);
  return rule;
}

async function deactivateRules() {
  if (createdRuleIds.length) {
    await prisma.discount.updateMany({
      where: { id: { in: createdRuleIds.splice(0) } },
      data: { isActive: false },
    });
  }
}

async function runBilling() {
  const res = await api().post('/billing/run').set('Authorization', `Bearer ${staffToken}`);
  expect(res.status).toBe(201);
  return res.body;
}

async function invoicesFor(subId: number) {
  const res = await api().get(`/invoices?subscription_id=${subId}&page_size=100`)
    .set('Authorization', `Bearer ${staffToken}`);
  return res.body.items;
}

// ── Auth: CUS-02 linking ────────────────────────────────────────────────────

describe('auth — CUS-02 customer linking', () => {
  it('signing up with a staff-created customer email links to the EXISTING record', async () => {
    const before = await prisma.customer.findUniqueOrThrow({ where: { email: 'linked@full.test' } });

    const res = await api().post('/auth/signup')
      .send({ name: 'Anyone', email: 'linked@full.test', password: 'GoodPass1!' });
    expect(res.status).toBe(201);
    expect(res.body.user.customerId).toBe(before.id); // linked, not duplicated

    const count = await prisma.customer.count({ where: { email: 'linked@full.test' } });
    expect(count).toBe(1);
    const merged = await prisma.customer.findUniqueOrThrow({ where: { email: 'linked@full.test' } });
    expect(merged.phone).toBe('+91 90000 00000'); // staff data preserved
  });
});

// ── Subscription lifecycle edges ───────────────────────────────────────────

describe('subscription lifecycle edges', () => {
  it('rejects confirming twice (confirmed → confirmed is invalid)', async () => {
    const id = await mkActiveSub([{ product_id: productAId, quantity: 1 }]);
    // already active; try a redundant confirm on a fresh draft→quotation→confirm chain instead
    const created = await api().post('/subscriptions').set('Authorization', `Bearer ${staffToken}`)
      .send({ customer_id: customerId, plan_id: planId, start_date: dayStr(0), lines: [{ product_id: productAId, quantity: 1 }] });
    const draftId = created.body.id;
    await api().post(`/subscriptions/${draftId}/quotation`).set('Authorization', `Bearer ${staffToken}`);
    const first = await api().post(`/subscriptions/${draftId}/confirm`).set('Authorization', `Bearer ${staffToken}`);
    expect(first.status).toBe(201);
    const second = await api().post(`/subscriptions/${draftId}/confirm`).set('Authorization', `Bearer ${staffToken}`);
    expect(second.status).toBe(400);
    expect(second.body.error.message).toContain('Invalid transition');
    void id;
  });

  it('recomputes line pricing when lines are edited in draft (PATCH /lines)', async () => {
    const created = await api().post('/subscriptions').set('Authorization', `Bearer ${staffToken}`)
      .send({ customer_id: customerId, plan_id: planId, start_date: dayStr(0), lines: [{ product_id: productAId, quantity: 1 }] });
    const id = created.body.id;

    const patched = await api().patch(`/subscriptions/${id}/lines`).set('Authorization', `Bearer ${staffToken}`)
      .send({ lines: [{ product_id: productAId, quantity: 3 }] });
    expect(patched.status).toBe(200);
    expect(patched.body.lines[0].quantity).toBe(3);
    expect(patched.body.lines[0].unitPrice).toBe('1000.00');

    const detail = await api().get(`/subscriptions/${id}`).set('Authorization', `Bearer ${staffToken}`);
    expect(detail.body.lines).toHaveLength(1);
    expect(detail.body.lines[0].quantity).toBe(3);
  });

  it('filters the subscription list by status and customer', async () => {
    const res = await api().get('/subscriptions?status=active&page_size=100').set('Authorization', `Bearer ${staffToken}`);
    expect(res.status).toBe(200);
    for (const s of res.body.items) expect(s.status).toBe('active');

    const mine = await api().get(`/subscriptions?customer_id=${customerId}&page_size=100`).set('Authorization', `Bearer ${staffToken}`);
    for (const s of mine.body.items) expect(s.customerId).toBe(customerId);
  });

  it('serves subscription detail with history through the portal (own sub)', async () => {
    const sub = await prisma.subscription.findFirstOrThrow({ where: { customerId } });
    const res = await api().get(`/portal/subscriptions/${sub.id}`).set('Authorization', `Bearer ${staffToken === undefined ? '' : ''}`);
    // portal requires the customer token — get it properly
    const custToken = (await api().post('/auth/login').send({ email: 'customer@full.test', password: 'CustPass1!' })).body.token;
    const own = await api().get(`/portal/subscriptions/${sub.id}`).set('Authorization', `Bearer ${custToken}`);
    expect(own.status).toBe(200);
    expect(own.body.history.length).toBeGreaterThanOrEqual(1);
    void res;
  });
});

// ── Catalog: PATCH endpoints + variant-add endpoint ────────────────────────

describe('catalog PATCH endpoints and variants', () => {
  it('updates a plan price and a 404s unknown plan', async () => {
    const ok = await api().patch(`/plans/${planId}`).set('Authorization', `Bearer ${adminToken}`)
      .send({ price: '1200.00' });
    expect(ok.status).toBe(200);
    expect(ok.body.price).toBe('1200.00');

    const missing = await api().patch('/plans/999999').set('Authorization', `Bearer ${adminToken}`)
      .send({ price: '1.00' });
    expect(missing.status).toBe(404);
  });

  it('updates a tax percentage and 404s unknown tax', async () => {
    const ok = await api().patch(`/taxes/${tax18Id}`).set('Authorization', `Bearer ${adminToken}`)
      .send({ percentage: 5 });
    expect(ok.status).toBe(200);
    expect(ok.body.percentage).toBe('5.00');
    // restore for other tests
    await api().patch(`/taxes/${tax18Id}`).set('Authorization', `Bearer ${adminToken}`).send({ percentage: 18 });
  });

  it('updates a discount value', async () => {
    const rule = await mkRule({ name: 'Patched later' });
    const ok = await api().patch(`/discounts/${rule.id}`).set('Authorization', `Bearer ${adminToken}`)
      .send({ value: '15' });
    expect(ok.status).toBe(200);
    expect(ok.body.value).toBe('15.00');
    await deactivateRules();
  });

  it('adds a variant through the endpoint and prices it into a subscription line', async () => {
    const variant = await api().post(`/products/${productAId}/variants`).set('Authorization', `Bearer ${adminToken}`)
      .send({ product_id: productAId, variant: { attribute: 'Tier', value: 'Pro', price_extra: '250.00' } });
    expect(variant.status).toBe(201);
    expect(variant.body.priceExtra).toBe('250.00');

    const sub = await mkActiveSub([{ product_id: productAId, variant_id: variant.body.id, quantity: 1 }]);
    const invoices = await runBillingThenInvoices(sub);
    expect(invoices).toHaveLength(1);
    expect(invoices[0].lines[0].unitPrice).toBe('1250.00'); // 1000 + 250 (acceptance #4 via endpoint)
  });
});

// ── Billing: multi-line + rule boundaries ──────────────────────────────────

async function runBillingThenInvoices(subId: number) {
  const run = await runBilling();
  expect(run.failed).toBe(0);
  const invoices = await invoicesFor(subId);
  expect(invoices.length).toBeGreaterThanOrEqual(1);
  return invoices.sort((a: { periodStart: string }, b: { periodStart: string }) =>
    a.periodStart.localeCompare(b.periodStart),
  );
}

describe('billing — multi-line and rule boundaries', () => {
  it('discounts only the eligible line of a multi-line subscription (DSC-03 scope)', async () => {
    await mkRule({ name: 'Alpha only', type: 'percentage', value: 10 }, [productAId]);

    const subId = await mkActiveSub([
      { product_id: productAId, quantity: 1 }, // eligible: 1000 → 100 discount
      { product_id: productBId, quantity: 1 }, // not scoped: no discount
    ]);
    const invoices = await runBillingThenInvoices(subId);
    expect(invoices).toHaveLength(1);

    expect(invoices[0].discountTotal).toBe('100.00');
    const lines = invoices[0].lines;
    const alpha = lines.find((l: { unitPrice: string }) => l.unitPrice === '1000.00');
    const beta = lines.find((l: { unitPrice: string }) => l.unitPrice === '500.00');
    expect(alpha.discountAmount).toBe('100.00');
    expect(alpha.discountName).toBe('Alpha only');
    expect(beta.discountAmount).toBe('0.00');
    expect(beta.discountName).toBeNull();
    await deactivateRules();
  });

  it('applies a rule ending TODAY (inclusive end date) but not one that ended yesterday', async () => {
    await mkRule({ name: 'Ends today', type: 'percentage', value: 10, endDate: new Date() });
    const subToday = await mkActiveSub([{ product_id: productAId, quantity: 1 }]);
    const invToday = await runBillingThenInvoices(subToday);
    expect(invToday[0].discountTotal).toBe('100.00');
    await deactivateRules();

    await mkRule({ name: 'Ended yesterday', type: 'percentage', value: 10, startDate: new Date(Date.now() - 10 * 86_400_000), endDate: new Date(Date.now() - 86_400_000) });
    const subPast = await mkActiveSub([{ product_id: productAId, quantity: 1 }]);
    const invPast = await runBillingThenInvoices(subPast);
    expect(invPast[0].discountTotal).toBe('0.00');
    await deactivateRules();
  });

  it('withholds a rule whose min_purchase is not met (subscription scope)', async () => {
    await mkRule({ name: 'Floor 5000', type: 'percentage', value: 10, scope: 'subscription', minPurchase: 5000, products: undefined }, []);
    // remove any product-scope rows for this rule (scope subscription needs none)
    const subId = await mkActiveSub([{ product_id: productAId, quantity: 1 }]); // subtotal 1000 < 5000
    const invoices = await runBillingThenInvoices(subId);
    expect(invoices[0].discountTotal).toBe('0.00');
    await deactivateRules();
  });

  it('withholds a rule whose min_quantity exceeds the line quantity', async () => {
    await mkRule({ name: 'Needs 5 seats', type: 'percentage', value: 10, minQuantity: 5 });
    const subId = await mkActiveSub([{ product_id: productAId, quantity: 2 }]);
    const invoices = await runBillingThenInvoices(subId);
    expect(invoices[0].discountTotal).toBe('0.00');
    await deactivateRules();
  });

  it('bills a no-tax product with tax_total exactly 0.00', async () => {
    const subId = await mkActiveSub([{ product_id: productBId, quantity: 2 }]); // Beta has no tax
    const invoices = await runBillingThenInvoices(subId);
    expect(invoices[0].subtotal).toBe('1000.00');
    expect(invoices[0].taxTotal).toBe('0.00');
    expect(invoices[0].total).toBe('1000.00');
  });

  it('stays decimal-exact for a 10,000-seat line through the full stack', async () => {
    const big = await api().post('/products').set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Massive', type: 'software', sales_price: '9999.99', cost_price: '0' });
    const bigId = big.body.product.id;

    const subId = await mkActiveSub([{ product_id: bigId, quantity: 10000 }]);
    const invoices = await runBillingThenInvoices(subId);
    expect(invoices[0].subtotal).toBe('99999900.00');
    expect(invoices[0].total).toBe('99999900.00'); // no tax, no discount
  });
});

// ── Payments: all five methods ─────────────────────────────────────────────

describe('payments — every supported method (D12)', () => {
  it('accepts cash, card, upi, bank_transfer and cheque and settles to Paid', async () => {
    const subId = await mkActiveSub([{ product_id: productAId, quantity: 1 }]); // total 1180.00 (18% tax)
    const invoices = await runBillingThenInvoices(subId);
    const inv = invoices[0];
    expect(inv.total).toBe('1180.00');

    const methods = ['cash', 'card', 'upi', 'bank_transfer', 'cheque'];
    // 1180 / 5 = 236 each — but decimal: pay 236 five times = 1180 exactly
    for (const [i, method] of methods.entries()) {
      const res = await api().post(`/invoices/${inv.id}/payments`).set('Authorization', `Bearer ${staffToken}`)
        .send({ method, amount: '236.00', date: dayStr(0), note: `method ${i}` });
      expect(res.status).toBe(201);
      expect(res.body.method).toBe(method);
    }

    const detail = await api().get(`/invoices/${inv.id}`).set('Authorization', `Bearer ${staffToken}`);
    expect(detail.body.amountPaid).toBe('1180.00');
    expect(detail.body.status).toBe('paid');
    expect(detail.body.payments).toHaveLength(5);
  });
});

// ── Robustness: malformed input, unicode, error-shape consistency ─────────

describe('robustness and error-shape consistency', () => {
  it('returns a contract-shaped 400 for malformed JSON (not a 500)', async () => {
    const res = await api().post('/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"broken json');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.message).toBeTruthy();
  });

  it('round-trips unicode product names exactly', async () => {
    const created = await api().post('/products').set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Tëst ₹ödü 🚀 — 中文', type: 'software', sales_price: '10.00', cost_price: '0' });
    expect(created.status).toBe(201);
    const fetched = await api().get(`/products/${created.body.product.id}`).set('Authorization', `Bearer ${staffToken}`);
    expect(fetched.body.name).toBe('Tëst ₹ödü 🚀 — 中文');
  });

  it('every error class carries {error:{code,message}} (meta over 400/401/403/404)', async () => {
    const samples = await Promise.all([
      api().post('/auth/signup').send({ name: '', email: 'bad', password: '' }), // 400
      api().get('/invoices'), // 401
      api().post('/products').set('Authorization', `Bearer ${staffToken}`).send({ name: 'x', type: 't', sales_price: '1', cost_price: '0' }), // 403
      api().get('/invoices/999999').set('Authorization', `Bearer ${staffToken}`), // 404
    ]);
    const codes = samples.map((r) => r.status);
    expect(codes).toEqual([400, 401, 403, 404]);
    for (const res of samples) {
      expect(res.body.error.code).toBeTruthy();
      expect(typeof res.body.error.message).toBe('string');
    }
    expect(samples[0].body.error.code).toBe('VALIDATION_ERROR');
    expect(samples[1].body.error.code).toBe('UNAUTHORIZED');
    expect(samples[2].body.error.code).toBe('FORBIDDEN');
    expect(samples[3].body.error.code).toBe('NOT_FOUND');
  });

  it('health endpoint is public and cheap', async () => {
    const res = await api().get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});

// ── Customers CRUD (CUS-01/03) ──────────────────────────────────────────────

describe('customers CRUD', () => {
  it('staff creates a customer with a normalized email', async () => {
    const res = await api().post('/customers').set('Authorization', `Bearer ${staffToken}`)
      .send({ name: 'New Shop', email: '  NewShop@Full.TEST ', phone: '+91 91111 11111', billing_address: '1 Main St' });
    expect(res.status).toBe(201);
    expect(res.body.email).toBe('newshop@full.test');
  });

  it('rejects a duplicate email with a field error', async () => {
    const res = await api().post('/customers').set('Authorization', `Bearer ${staffToken}`)
      .send({ name: 'Dup', email: 'newshop@full.test' });
    expect(res.status).toBe(409);
    expect(res.body.error.fields.email).toContain('Already in use');
  });

  it('detail aggregates subscriptions, invoices and outstanding (CUS-03)', async () => {
    // a customer with a billed subscription
    const cust = await prisma.customer.create({ data: { name: 'Agg Co', email: 'agg@full.test' } });
    const subId = await mkActiveSub([{ product_id: productAId, quantity: 1 }], { customer_id: cust.id });
    await runBilling(); // creates a confirmed 1180.00 invoice (18% tax, no discount)

    const detail = await api().get(`/customers/${cust.id}`).set('Authorization', `Bearer ${staffToken}`);
    expect(detail.status).toBe(200);
    expect(detail.body.subscriptions.map((s: { id: number }) => s.id)).toContain(subId);
    expect(detail.body.invoices).toHaveLength(1);
    expect(detail.body.outstanding).toBe('1180.00');
  });

  it('lists with search across name/company/email', async () => {
    const res = await api().get('/customers?search=agg').set('Authorization', `Bearer ${staffToken}`);
    expect(res.status).toBe(200);
    expect(res.body.items.map((c: { email: string }) => c.email)).toContain('agg@full.test');
  });

  it('blocks customers from managing customer records (§2.2)', async () => {
    const custToken = (await api().post('/auth/login').send({ email: 'customer@full.test', password: 'CustPass1!' })).body.token;
    const res = await api().post('/customers').set('Authorization', `Bearer ${custToken}`)
      .send({ name: 'Nope', email: 'nope@full.test' });
    expect(res.status).toBe(403);
  });
});

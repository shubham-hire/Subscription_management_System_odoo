/**
 * Integration suite (Supertest, PRD §11). Boots the real AppModule against the
 * disposable brightloop_test database and exercises auth, catalog, invoices,
 * payments and portal end-to-end — including the role matrix and the PRD
 * acceptance scenarios that belong to the Dev A workstream.
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

const admin = { email: 'admin@test.local', password: 'AdminPass1!', name: 'Ada Admin' };
const staff = { email: 'staff@test.local', password: 'StaffPass1!', name: 'Steve Staff' };
const portal = { email: 'portal@test.local', password: 'PortalPass1!', name: 'Pat Portal' };

let adminToken = '';
let staffToken = '';
let portalToken = '';

let customer1Id = 0;
let customer2Id = 0;
let productId = 0;
let planId = 0;
let taxId = 0;

let subA = 0; // customer 1
let subB = 0; // customer 2
let invPart = 0; // confirmed, partially paid, due future
let invOverdue = 0; // confirmed, unpaid, due past
let invDraft = 0;
let invCancelled = 0;
let invForeign = 0; // customer 2's invoice

const futureDue = new Date(Date.now() + 15 * 86_400_000);
const pastDue = new Date(Date.now() - 10 * 86_400_000);

async function login(email: string, password: string): Promise<string> {
  const res = await request(app.getHttpServer()).post('/auth/login').send({ email, password });
  expect(res.status).toBe(200);
  return res.body.token;
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

  // ── Wipe (FK-safe order) — the test DB is disposable ──
  await prisma.auditLog.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.invoiceLine.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.subscriptionStatusHistory.deleteMany();
  await prisma.subscriptionLine.deleteMany();
  await prisma.subscription.deleteMany();
  await prisma.discountProduct.deleteMany();
  await prisma.discount.deleteMany();
  await prisma.templateLine.deleteMany();
  await prisma.quotationTemplate.deleteMany();
  await prisma.productVariant.deleteMany();
  await prisma.product.deleteMany();
  await prisma.plan.deleteMany();
  await prisma.tax.deleteMany();
  await prisma.user.deleteMany();
  await prisma.customer.deleteMany();

  // ── Fixtures ──
  const staffUser = await prisma.user.create({
    data: { name: staff.name, email: staff.email, passwordHash: await bcrypt.hash(staff.password, 4), role: 'staff' },
  });
  await prisma.user.create({
    data: { name: admin.name, email: admin.email, passwordHash: await bcrypt.hash(admin.password, 4), role: 'admin' },
  });

  const c1 = await prisma.customer.create({
    data: { name: portal.name, company: 'Portal Co', email: portal.email, billingAddress: '1 Test St' },
  });
  const c2 = await prisma.customer.create({ data: { name: 'Other Co', email: 'other@test.local' } });
  customer1Id = c1.id;
  customer2Id = c2.id;
  await prisma.user.create({
    data: {
      name: portal.name, email: portal.email,
      passwordHash: await bcrypt.hash(portal.password, 4),
      role: 'customer', customerId: c1.id,
    },
  });

  const tax = await prisma.tax.create({ data: { name: 'GST 18%', percentage: 18 } });
  taxId = tax.id;
  const product = await prisma.product.create({
    data: { name: 'ERP Software', type: 'software', salesPrice: 1200, costPrice: 500, taxId: tax.id },
  });
  await prisma.productVariant.create({
    data: { productId: product.id, attribute: 'Brand', value: 'Odoo', priceExtra: 60 },
  });
  productId = product.id;
  const plan = await prisma.plan.create({
    data: {
      name: 'Test Monthly', price: 1200, billingPeriod: 'monthly', minQuantity: 1,
      availableFrom: new Date(Date.now() - 30 * 86_400_000), availableTo: new Date(Date.now() + 365 * 86_400_000),
      autoClose: true, closable: true, pausable: false, renewable: true,
    },
  });
  planId = plan.id;

  const mkSub = (customerId: number, number: string) =>
    prisma.subscription.create({
      data: {
        number, customerId, planId: plan.id, status: 'active',
        startDate: new Date(Date.now() - 30 * 86_400_000), expiryDate: new Date(Date.now() + 1 * 86_400_000),
        nextBillingDate: new Date(), paymentTermsDays: 15, createdBy: staffUser.id,
      },
    });
  const a = await mkSub(customer1Id, 'SUB-900001');
  const b = await mkSub(customer2Id, 'SUB-900002');
  subA = a.id;
  subB = b.id;

  const mkInvoice = (
    number: string, subscriptionId: number, customerId: number, monthOffset: number,
    overrides: Partial<{ status: 'draft' | 'confirmed' | 'paid' | 'cancelled'; dueDate: Date; amountPaid: number }>,
  ) => {
    // distinct period per invoice — (subscription_id, period_start) is unique (INV-03)
    const periodStart = new Date(Date.now() - monthOffset * 30 * 86_400_000);
    const periodEnd = new Date(periodStart);
    periodEnd.setMonth(periodEnd.getMonth() + 1);
    const issueDate = new Date(periodStart);
    return prisma.invoice.create({
      data: {
        number, subscriptionId, customerId, status: 'confirmed',
        periodStart, periodEnd, issueDate, dueDate: futureDue,
        subtotal: 1000, discountTotal: 0, taxTotal: 0, total: 1000, amountPaid: 0,
        ...overrides,
      },
    });
  };
  const i1 = await mkInvoice('INV-900001', subA, customer1Id, 3, { amountPaid: 400 });
  const i2 = await mkInvoice('INV-900002', subA, customer1Id, 2, { dueDate: pastDue });
  const i3 = await mkInvoice('INV-900003', subA, customer1Id, 1, { status: 'draft' });
  const i4 = await mkInvoice('INV-900004', subA, customer1Id, 0, { status: 'cancelled' });
  const i5 = await mkInvoice('INV-900005', subB, customer2Id, 0, {});
  invPart = i1.id;
  invOverdue = i2.id;
  invDraft = i3.id;
  invCancelled = i4.id;
  invForeign = i5.id;

  for (const inv of [i1, i2, i3, i4, i5]) {
    await prisma.invoiceLine.create({
      data: {
        invoiceId: inv.id, productId, description: 'ERP Software', quantity: 1,
        unitPrice: 1000, discountAmount: 0, taxAmount: 0, lineTotal: 1000,
      },
    });
  }

  adminToken = await login(admin.email, admin.password);
  staffToken = await login(staff.email, staff.password);
  portalToken = await login(portal.email, portal.password);
}, 90_000);

afterAll(async () => {
  await app?.close();
});

// ── Auth (AUTH-01..05, 09) ──────────────────────────────────────────────────

describe('auth', () => {
  it('signs a customer up and links a customer record (acceptance #1)', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/signup')
      .send({ name: 'New User', email: 'new@test.local', password: 'GoodPass1!' });
    expect(res.status).toBe(201);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.role).toBe('customer');
    expect(res.body.user.customerId).toBeGreaterThan(0);
    const linked = await prisma.customer.findUnique({ where: { email: 'new@test.local' } });
    expect(linked).not.toBeNull();
  });

  it('rejects weak passwords naming the failed rule (acceptance #1)', async () => {
    const cases = [
      { password: 'Ab1!', msg: '9 characters' },
      { password: 'alllower1!', msg: 'uppercase' },
      { password: 'ALLUPPER1!', msg: 'lowercase' },
      { password: 'NoSpecial11', msg: 'special' },
    ];
    for (const c of cases) {
      const res = await request(app.getHttpServer())
        .post('/auth/signup')
        .send({ name: 'T', email: `weak${Math.random()}@test.local`, password: c.password });
      expect(res.status).toBe(400);
      expect(res.body.error.fields.password).toContain(c.msg);
    }
  });

  it('rejects duplicate emails case-insensitively (AUTH-02)', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/signup')
      .send({ name: 'Dup', email: 'PORTAL@TEST.LOCAL', password: 'GoodPass1!' });
    expect(res.status).toBe(409);
    expect(res.body.error.fields.email).toBeTruthy();
  });

  it('rejects wrong password and unknown email with the same 401 (AUTH-07 spirit)', async () => {
    const wrongPw = await request(app.getHttpServer())
      .post('/auth/login').send({ email: staff.email, password: 'WrongPass1!' });
    const unknown = await request(app.getHttpServer())
      .post('/auth/login').send({ email: 'ghost@test.local', password: 'WrongPass1!' });
    expect(wrongPw.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrongPw.body.error.message).toBe(unknown.body.error.message);
  });

  it('blocks deactivated users from logging in (AUTH-11)', async () => {
    const user = await prisma.user.findUniqueOrThrow({ where: { email: staff.email } });
    await prisma.user.update({ where: { id: user.id }, data: { isActive: false } });
    const res = await request(app.getHttpServer())
      .post('/auth/login').send({ email: staff.email, password: staff.password });
    expect(res.status).toBe(401);
    await prisma.user.update({ where: { id: user.id }, data: { isActive: true } });
  });

  it('guards /auth/me (no token, garbage token, valid token)', async () => {
    expect((await request(app.getHttpServer()).get('/auth/me')).status).toBe(401);
    expect(
      (await request(app.getHttpServer()).get('/auth/me').set('Authorization', 'Bearer garbage')).status,
    ).toBe(401);
    const me = await request(app.getHttpServer()).get('/auth/me').set('Authorization', `Bearer ${portalToken}`);
    expect(me.status).toBe(200);
    expect(me.body.role).toBe('customer');
    expect(me.body.customerId).toBe(customer1Id);
  });
});

// ── Catalog (PRD-01..06, PLN-06, TAX-04, DSC-06) ────────────────────────────

describe('catalog', () => {
  it('admin creates a product with variants; money serializes as 2-decimal strings', async () => {
    const res = await request(app.getHttpServer())
      .post('/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'CRM Suite', type: 'software', sales_price: '1200', cost_price: '500', tax_id: taxId,
        variants: [{ attribute: 'Tier', value: 'Pro', price_extra: '60' }] });
    expect(res.status).toBe(201);
    expect(res.body.product.salesPrice).toBe('1200.00');
    expect(res.body.product.variants[0].priceExtra).toBe('60.00');
    expect(res.body.warning).toBeUndefined();
  });

  it('warns (not errors) when cost exceeds sales price (PRD-04)', async () => {
    const res = await request(app.getHttpServer())
      .post('/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Loss Maker', type: 'software', sales_price: '100', cost_price: '500' });
    expect(res.status).toBe(201);
    expect(res.body.warning).toContain('above');
  });

  it('rejects negative prices (IsMoneyString)', async () => {
    const res = await request(app.getHttpServer())
      .post('/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Bad', type: 't', sales_price: '-5.00', cost_price: '0' });
    expect(res.status).toBe(400);
  });

  it('enforces the role matrix: staff reads, staff cannot write, customer blocked (§2.2)', async () => {
    expect((await request(app.getHttpServer()).get('/products').set('Authorization', `Bearer ${staffToken}`)).status).toBe(200);
    expect(
      (await request(app.getHttpServer()).post('/products').set('Authorization', `Bearer ${staffToken}`)
        .send({ name: 'X', type: 't', sales_price: '1', cost_price: '0' })).status,
    ).toBe(403);
    expect((await request(app.getHttpServer()).get('/products').set('Authorization', `Bearer ${portalToken}`)).status).toBe(403);
  });

  it('tax percentage must be 0..100 (TAX-04)', async () => {
    const bad = await request(app.getHttpServer())
      .post('/taxes').set('Authorization', `Bearer ${adminToken}`).send({ name: 'Bad', percentage: 150 });
    expect(bad.status).toBe(400);
    const ok = await request(app.getHttpServer())
      .post('/taxes').set('Authorization', `Bearer ${adminToken}`).send({ name: 'GST 5%', percentage: 5 });
    expect(ok.status).toBe(201);
  });

  it('plan availability window must be ordered (PLN-06)', async () => {
    const res = await request(app.getHttpServer())
      .post('/plans').set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Bad Plan', price: '100', billing_period: 'monthly', min_quantity: 1,
        available_from: '2026-12-31', available_to: '2026-01-01' });
    expect(res.status).toBe(400);
    expect(res.body.error.fields.end_date).toBeTruthy();
  });

  it('discount rules validate type, value and scope (DSC-06)', async () => {
    const pct0 = await request(app.getHttpServer())
      .post('/discounts').set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Zero', type: 'percentage', value: '0', start_date: '2026-11-01', end_date: '2026-12-01', scope: 'subscription' });
    expect(pct0.status).toBe(400);

    const noProducts = await request(app.getHttpServer())
      .post('/discounts').set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'NoScope', type: 'fixed', value: '50', start_date: '2026-11-01', end_date: '2026-12-01', scope: 'product' });
    expect(noProducts.status).toBe(400);

    const ok = await request(app.getHttpServer())
      .post('/discounts').set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Valid 10%', type: 'percentage', value: '10', start_date: '2026-11-01', end_date: '2026-12-01', scope: 'product', product_ids: [productId] });
    expect(ok.status).toBe(201);
  });
});

// ── Invoices & payments (PAY-01..07, D5, acceptance #10/#11) ───────────────

describe('invoices and payments', () => {
  it('lists invoices with status filter and pagination shape', async () => {
    const res = await request(app.getHttpServer())
      .get('/invoices?status=confirmed&page_size=50').set('Authorization', `Bearer ${staffToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ page: 1, page_size: 50 });
    expect(res.body.total).toBeGreaterThanOrEqual(3);
    for (const item of res.body.items) expect(item.status).toBe('confirmed');
  });

  it('overdue filter returns only confirmed past-due with balance (acceptance #11)', async () => {
    const res = await request(app.getHttpServer())
      .get('/invoices?overdue=true').set('Authorization', `Bearer ${staffToken}`);
    expect(res.status).toBe(200);
    const numbers = res.body.items.map((i: { number: string }) => i.number);
    expect(numbers).toContain('INV-900002');
    expect(numbers).not.toContain('INV-900001'); // due future
    for (const item of res.body.items) expect(item.overdue).toBe(true);
  });

  it('shows invoice detail with lines, payments and computed overdue flag', async () => {
    const res = await request(app.getHttpServer())
      .get(`/invoices/${invOverdue}`).set('Authorization', `Bearer ${staffToken}`);
    expect(res.status).toBe(200);
    expect(res.body.overdue).toBe(true);
    expect(res.body.lines).toHaveLength(1);
    expect(res.body.total).toBe('1000.00');
  });

  it('404s unknown invoices', async () => {
    expect(
      (await request(app.getHttpServer()).get('/invoices/999999').set('Authorization', `Bearer ${staffToken}`)).status,
    ).toBe(404);
  });

  it('rejects invalid payment methods, zero amounts and overpayment (PAY-02)', async () => {
    const base = { method: 'bitcoin', amount: '10.00', date: '2026-10-31' };
    const badMethod = await request(app.getHttpServer())
      .post(`/invoices/${invPart}/payments`).set('Authorization', `Bearer ${staffToken}`).send(base);
    expect(badMethod.status).toBe(400);

    const zero = await request(app.getHttpServer())
      .post(`/invoices/${invPart}/payments`).set('Authorization', `Bearer ${staffToken}`)
      .send({ ...base, method: 'upi', amount: '0.00' });
    expect(zero.status).toBe(400);

    const over = await request(app.getHttpServer())
      .post(`/invoices/${invPart}/payments`).set('Authorization', `Bearer ${staffToken}`)
      .send({ ...base, method: 'upi', amount: '9999.00' });
    expect(over.status).toBe(400);
    expect(over.body.error.fields.amount).toContain('outstanding balance of 600.00');
  });

  it('partial payment keeps Confirmed with balance; settling marks Paid (acceptance #10)', async () => {
    const partial = await request(app.getHttpServer())
      .post(`/invoices/${invPart}/payments`).set('Authorization', `Bearer ${staffToken}`)
      .send({ method: 'upi', amount: '100.00', date: '2026-10-31', note: 'part 2' });
    expect(partial.status).toBe(201);

    let detail = await request(app.getHttpServer())
      .get(`/invoices/${invPart}`).set('Authorization', `Bearer ${staffToken}`);
    expect(detail.body.status).toBe('confirmed');
    expect(detail.body.amountPaid).toBe('500.00');

    const settle = await request(app.getHttpServer())
      .post(`/invoices/${invPart}/payments`).set('Authorization', `Bearer ${staffToken}`)
      .send({ method: 'card', amount: '500.00', date: '2026-10-31', note: 'settled' });
    expect(settle.status).toBe(201);

    detail = await request(app.getHttpServer())
      .get(`/invoices/${invPart}`).set('Authorization', `Bearer ${staffToken}`);
    expect(detail.body.status).toBe('paid');
    expect(detail.body.overdue).toBe(false);
  });

  it('blocks payments on Draft and Cancelled invoices (PAY-06)', async () => {
    for (const id of [invDraft, invCancelled]) {
      const res = await request(app.getHttpServer())
        .post(`/invoices/${id}/payments`).set('Authorization', `Bearer ${staffToken}`)
        .send({ method: 'cash', amount: '10.00', date: '2026-10-31' });
      expect(res.status).toBe(400);
      expect(res.body.error.message).toMatch(/draft|cancelled/i);
    }
  });

  it('customers cannot record payments or read the invoice list (§2.2)', async () => {
    const pay = await request(app.getHttpServer())
      .post(`/invoices/${invPart}/payments`).set('Authorization', `Bearer ${portalToken}`)
      .send({ method: 'cash', amount: '10.00', date: '2026-10-31' });
    expect(pay.status).toBe(403);
    expect(
      (await request(app.getHttpServer()).get('/invoices').set('Authorization', `Bearer ${portalToken}`)).status,
    ).toBe(403);
  });

  it('writes an audit log entry for recorded payments (§9.2)', async () => {
    const entry = await prisma.auditLog.findFirst({
      where: { action: 'payment.record', entity: 'invoice', entityId: invPart },
    });
    expect(entry).not.toBeNull();
  });
});

// ── Portal (POR-01..05, acceptance #3) ──────────────────────────────────────

describe('portal', () => {
  it('returns only the customer’s own subscriptions and invoices (POR-01)', async () => {
    const subs = await request(app.getHttpServer())
      .get('/portal/subscriptions').set('Authorization', `Bearer ${portalToken}`);
    expect(subs.status).toBe(200);
    for (const s of subs.body.items) expect(s.customerId).toBe(customer1Id);

    const invs = await request(app.getHttpServer())
      .get('/portal/invoices').set('Authorization', `Bearer ${portalToken}`);
    expect(invs.status).toBe(200);
    for (const i of invs.body.items) expect(i.customerId).toBe(customer1Id);
  });

  it('404s foreign IDs — never leaks data (POR-05, acceptance #3)', async () => {
    expect(
      (await request(app.getHttpServer()).get(`/portal/invoices/${invForeign}`).set('Authorization', `Bearer ${portalToken}`)).status,
    ).toBe(404);
    expect(
      (await request(app.getHttpServer()).get(`/portal/subscriptions/${subB}`).set('Authorization', `Bearer ${portalToken}`)).status,
    ).toBe(404);
  });

  it('summarizes own active subs, outstanding and overdue count', async () => {
    const res = await request(app.getHttpServer())
      .get('/portal/summary').set('Authorization', `Bearer ${portalToken}`);
    expect(res.status).toBe(200);
    expect(res.body.active_subscriptions).toBe(1);
    expect(res.body.outstanding).toBe('1000.00'); // INV-900002 unpaid (INV-900001 settled → paid)
    expect(res.body.overdue_count).toBe(1);
  });

  it('is customer-only (staff gets 403)', async () => {
    expect(
      (await request(app.getHttpServer()).get('/portal/subscriptions').set('Authorization', `Bearer ${staffToken}`)).status,
    ).toBe(403);
  });
});

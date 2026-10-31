/**
 * Module-level integration tests for the newer endpoints: users (AUTH-08/11),
 * payments list (PAY-07), invoice cancel (§5.2), pause/resume (SUB-04/PLN-02),
 * subscription/invoice name includes, portal draft-hiding, null variant_id,
 * and overdue pagination. Self-contained fixtures.
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
let customerToken = '';
let customerId = 0;
let productId = 0;
let widePlanId = 0;
let pausablePlanId = 0;
let lockedPlanId = 0;

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

async function mkConfirmedInvoice(
  subId: number, custId: number, number: string,
  overrides: Partial<{ status: 'draft' | 'confirmed' | 'paid' | 'cancelled'; dueDate: Date; total: number }> = {},
) {
  const invoice = await prisma.invoice.create({
    data: {
      number, subscriptionId: subId, customerId: custId, status: 'confirmed',
      periodStart: new Date(Date.now() - 30 * 86_400_000), periodEnd: new Date(),
      issueDate: new Date(Date.now() - 30 * 86_400_000), dueDate: new Date(Date.now() + 15 * 86_400_000),
      subtotal: 1000, total: overrides.total ?? 1000,
      ...overrides,
    },
  });
  await prisma.invoiceLine.create({
    data: { invoiceId: invoice.id, description: 'Line', quantity: 1, unitPrice: 1000, lineTotal: overrides.total ?? 1000 },
  });
  return invoice;
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

  await prisma.user.create({
    data: { name: 'Admin', email: 'admin@mod.test', passwordHash: await bcrypt.hash('AdminPass1!', 4), role: 'admin' },
  });
  await prisma.user.create({
    data: { name: 'Staff', email: 'staff@mod.test', passwordHash: await bcrypt.hash('StaffPass1!', 4), role: 'staff' },
  });
  const cust = await prisma.customer.create({ data: { name: 'Mod Co', email: 'customer@mod.test' } });
  customerId = cust.id;
  await prisma.user.create({
    data: { name: 'Cust', email: 'customer@mod.test', passwordHash: await bcrypt.hash('CustPass1!', 4), role: 'customer', customerId: cust.id },
  });

  const tax = await prisma.tax.create({ data: { name: 'GST 0%', percentage: 0 } });
  const product = await prisma.product.create({
    data: { name: 'Mod Product', type: 'software', salesPrice: 1000, costPrice: 100, taxId: tax.id },
  });
  productId = product.id;
  const mkPlan = (name: string, pausable: boolean) =>
    prisma.plan.create({
      data: {
        name, price: 1000, billingPeriod: 'monthly', minQuantity: 1,
        availableFrom: new Date('2020-01-01'), availableTo: new Date('2030-12-31'),
        autoClose: false, closable: true, pausable, renewable: true,
      },
    });
  widePlanId = (await mkPlan('Wide', false)).id;
  pausablePlanId = (await mkPlan('Pausable', true)).id;
  lockedPlanId = (await mkPlan('Locked', false)).id;

  const login = async (email: string, password: string) =>
    (await api().post('/auth/login').send({ email, password })).body.token;
  adminToken = await login('admin@mod.test', 'AdminPass1!');
  staffToken = await login('staff@mod.test', 'StaffPass1!');
  customerToken = await login('customer@mod.test', 'CustPass1!');
}, 90_000);

afterAll(async () => {
  await app?.close();
});

// ── Users (AUTH-08/11) ──────────────────────────────────────────────────────

describe('users administration', () => {
  it('admin creates staff; hash never leaks; staff logs in immediately', async () => {
    const created = await api().post('/users').set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'New Staff', email: 'new@mod.test', password: 'TempPass1!' });
    expect(created.status).toBe(201);
    expect(created.body.role).toBe('staff');
    expect(created.body.isActive).toBe(true);
    expect(JSON.stringify(created.body)).not.toContain('passwordHash');

    const login = await api().post('/auth/login').send({ email: 'new@mod.test', password: 'TempPass1!' });
    expect(login.status).toBe(200);
  });

  it('rejects duplicate emails with a field error', async () => {
    const res = await api().post('/users').set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Dup', email: 'new@mod.test', password: 'TempPass1!' });
    expect(res.status).toBe(409);
    expect(res.body.error.fields.email).toContain('Already in use');
  });

  it('staff cannot manage users (§2.2)', async () => {
    expect(
      (await api().get('/users').set('Authorization', `Bearer ${staffToken}`)).status,
    ).toBe(403);
    expect(
      (await api().post('/users').set('Authorization', `Bearer ${staffToken}`)
        .send({ name: 'X', email: 'x@mod.test', password: 'TempPass1!' })).status,
    ).toBe(403);
  });

  it('search filters by name and email', async () => {
    const res = await api().get('/users?search=new').set('Authorization', `Bearer ${adminToken}`);
    const emails = res.body.items.map((u: { email: string }) => u.email);
    expect(emails).toContain('new@mod.test');
    expect(emails).not.toContain('admin@mod.test');
  });

  it('deactivation blocks login immediately; reactivation restores it (AUTH-11)', async () => {
    const user = await prisma.user.findUniqueOrThrow({ where: { email: 'new@mod.test' } });

    const off = await api().patch(`/users/${user.id}`).set('Authorization', `Bearer ${adminToken}`)
      .send({ is_active: false });
    expect(off.body.isActive).toBe(false);
    expect((await api().post('/auth/login').send({ email: 'new@mod.test', password: 'TempPass1!' })).status).toBe(401);

    await api().patch(`/users/${user.id}`).set('Authorization', `Bearer ${adminToken}`).send({ is_active: true });
    expect((await api().post('/auth/login').send({ email: 'new@mod.test', password: 'TempPass1!' })).status).toBe(200);
  });

  it('401 without a token and 404 for unknown user updates', async () => {
    expect((await api().get('/users')).status).toBe(401);
    expect(
      (await api().patch('/users/999999').set('Authorization', `Bearer ${adminToken}`)
        .send({ is_active: false })).status,
    ).toBe(404);
  });
});

// ── Payments list (PAY-07) ─────────────────────────────────────────────────

describe('payments list', () => {
  let invA = 0;
  let invB = 0;
  let subA = 0;

  beforeAll(async () => {
    const sub = await prisma.subscription.create({
      data: {
        customerId, planId: widePlanId, status: 'active',
        startDate: new Date(Date.now() - 30 * 86_400_000),
        expiryDate: new Date(Date.now() + 86_400_000),
        nextBillingDate: new Date(),
        lines: { create: [{ productId, quantity: 1, unitPrice: 1000 }] },
      },
    });
    subA = sub.id;
    const a = await mkConfirmedInvoice(sub.id, customerId, 'INV-970001');
    const b = await mkConfirmedInvoice(sub.id, customerId, 'INV-970002');
    invA = a.id;
    invB = b.id;
    for (const [inv, amt] of [[a, '400.00'], [a, '300.00'], [b, '100.00']] as const) {
      await api().post(`/invoices/${inv.id}/payments`).set('Authorization', `Bearer ${staffToken}`)
        .send({ method: 'upi', amount: amt, date: dayStr(0) });
    }
  });

  it('lists payments with invoice and customer details (PAY-07)', async () => {
    const res = await api().get('/payments?page_size=50').set('Authorization', `Bearer ${staffToken}`);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(3);
    const mine = res.body.items.filter((p: { invoiceId: number }) => p.invoiceId === invA);
    expect(mine).toHaveLength(2);
    for (const p of mine) {
      expect(p.invoice.number).toBe('INV-970001');
      expect(p.invoice.customer.name).toBe('Mod Co');
    }
  });

  it('filters by invoice_id', async () => {
    const res = await api().get(`/payments?invoice_id=${invB}`).set('Authorization', `Bearer ${staffToken}`);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].amount).toBe('100.00');
  });
});

// ── Invoice cancel (§5.2) ──────────────────────────────────────────────────

describe('invoice cancellation', () => {
  it('cancels a payment-free confirmed invoice and writes an audit entry', async () => {
    const sub = await prisma.subscription.findFirstOrThrow({ where: { id: { not: undefined } }, take: 1 });
    const inv = await mkConfirmedInvoice(sub.id, customerId, 'INV-970003');

    const res = await api().post(`/invoices/${inv.id}/cancel`).set('Authorization', `Bearer ${staffToken}`);
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('cancelled');

    const audit = await prisma.auditLog.findFirst({ where: { action: 'invoice.cancel', entityId: inv.id } });
    expect(audit).not.toBeNull();
  });

  it('blocks cancelling an invoice that already has payments (§5.2)', async () => {
    const sub = await prisma.subscription.findFirstOrThrow();
    const inv = await mkConfirmedInvoice(sub.id, customerId, 'INV-970004');
    await api().post(`/invoices/${inv.id}/payments`).set('Authorization', `Bearer ${staffToken}`)
      .send({ method: 'cash', amount: '100.00', date: dayStr(0) });

    const res = await api().post(`/invoices/${inv.id}/cancel`).set('Authorization', `Bearer ${staffToken}`);
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/payment/i);
  });

  it('blocks cancelling a paid invoice', async () => {
    const sub = await prisma.subscription.findFirstOrThrow();
    const inv = await mkConfirmedInvoice(sub.id, customerId, 'INV-970005', { status: 'paid', amountPaid: 1000 });
    const res = await api().post(`/invoices/${inv.id}/cancel`).set('Authorization', `Bearer ${staffToken}`);
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/paid|credit note/i);
  });

  it('404s unknown invoices', async () => {
    expect(
      (await api().post('/invoices/999999/cancel').set('Authorization', `Bearer ${staffToken}`)).status,
    ).toBe(404);
  });

  it('customers cannot cancel (§2.2)', async () => {
    const sub = await prisma.subscription.findFirstOrThrow();
    const inv = await mkConfirmedInvoice(sub.id, customerId, 'INV-970006');
    expect(
      (await api().post(`/invoices/${inv.id}/cancel`).set('Authorization', `Bearer ${customerToken}`)).status,
    ).toBe(403);
  });
});

// ── Pause / resume (SUB-04, PLN-02) ────────────────────────────────────────

describe('pause and resume', () => {
  it('pauses and resumes on a pausable plan, through the API routes', async () => {
    const created = await api().post('/subscriptions').set('Authorization', `Bearer ${staffToken}`)
      .send({ customer_id: customerId, plan_id: pausablePlanId, start_date: dayStr(0), lines: [{ product_id: productId, quantity: 1 }] });
    const id = created.body.id;
    for (const t of ['quotation', 'confirm', 'activate']) {
      await api().post(`/subscriptions/${id}/${t}`).set('Authorization', `Bearer ${staffToken}`);
    }

    const paused = await api().post(`/subscriptions/${id}/pause`).set('Authorization', `Bearer ${staffToken}`);
    expect(paused.status).toBe(201);
    expect(paused.body.status).toBe('paused');

    const resumed = await api().post(`/subscriptions/${id}/resume`).set('Authorization', `Bearer ${staffToken}`);
    expect(resumed.status).toBe(201);
    expect(resumed.body.status).toBe('active');

    const history = await api().get(`/subscriptions/${id}`).set('Authorization', `Bearer ${staffToken}`);
    const pairs = history.body.history.map((h: { fromStatus: string; toStatus: string }) => `${h.fromStatus}->${h.toStatus}`);
    expect(pairs).toContain('active->paused');
    expect(pairs).toContain('paused->active');
  });

  it('rejects pause on a non-pausable plan (PLN-02 + PLN-05)', async () => {
    const created = await api().post('/subscriptions').set('Authorization', `Bearer ${staffToken}`)
      .send({ customer_id: customerId, plan_id: lockedPlanId, start_date: dayStr(0), lines: [{ product_id: productId, quantity: 1 }] });
    const id = created.body.id;
    for (const t of ['quotation', 'confirm', 'activate']) {
      await api().post(`/subscriptions/${id}/${t}`).set('Authorization', `Bearer ${staffToken}`);
    }
    const res = await api().post(`/subscriptions/${id}/pause`).set('Authorization', `Bearer ${staffToken}`);
    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('cannot be paused');
  });

  it('rejects pausing a draft subscription (invalid transition)', async () => {
    const created = await api().post('/subscriptions').set('Authorization', `Bearer ${staffToken}`)
      .send({ customer_id: customerId, plan_id: pausablePlanId, start_date: dayStr(0), lines: [{ product_id: productId, quantity: 1 }] });
    const res = await api().post(`/subscriptions/${created.body.id}/pause`).set('Authorization', `Bearer ${staffToken}`);
    expect(res.status).toBe(400);
  });
});

// ── Includes, portal draft-hiding, null variant, overdue pagination ────────

describe('list includes and wire details', () => {
  it('subscription list carries customer and plan names', async () => {
    const res = await api().get('/subscriptions?page_size=5').set('Authorization', `Bearer ${staffToken}`);
    const withNames = res.body.items.filter(
      (s: { customer?: { name: string }; plan?: { name: string } }) => s.customer?.name && s.plan?.name,
    );
    expect(withNames.length).toBeGreaterThan(0);
  });

  it('invoice detail carries the subscription number', async () => {
    const sub = await prisma.subscription.findFirstOrThrow();
    const inv = await mkConfirmedInvoice(sub.id, customerId, 'INV-970007');
    const res = await api().get(`/invoices/${inv.id}`).set('Authorization', `Bearer ${staffToken}`);
    expect(res.body.subscription?.number).toBe(sub.number);
  });

  it('hides DRAFT invoices from the portal list and detail (friend fix)', async () => {
    const sub = await prisma.subscription.findFirstOrThrow({ where: { customerId } });
    const draft = await mkConfirmedInvoice(sub.id, customerId, 'INV-970008', { status: 'draft' });
    const id_of_draft = draft.id;
    const confirmed = await mkConfirmedInvoice(sub.id, customerId, 'INV-970009');

    const list = await api().get('/portal/invoices').set('Authorization', `Bearer ${customerToken}`);
    const numbers = list.body.map((i: { number: string }) => i.number);
    expect(numbers).toContain('INV-970009');
    expect(numbers).not.toContain('INV-970008');

    // explicit status=draft is honored (customer's own data); the DEFAULT list
    // is what hides drafts, and the detail endpoint 404s them always
    expect(
      (await api().get(`/portal/invoices/${id_of_draft}`).set('Authorization', `Bearer ${customerToken}`)).status,
    ).toBe(404);
    void confirmed;
  });

  it('accepts lines with an explicit null variant_id (friend fix)', async () => {
    const res = await api().post('/subscriptions').set('Authorization', `Bearer ${staffToken}`)
      .send({
        customer_id: customerId, plan_id: widePlanId, start_date: dayStr(0),
        lines: [{ product_id: productId, variant_id: null, quantity: 1 }],
      });
    expect(res.status).toBe(201);
    expect(res.body.lines[0].variantId).toBeNull();
  });

  it('creates subscriptions with NO variant field at all', async () => {
    const res = await api().post('/subscriptions').set('Authorization', `Bearer ${staffToken}`)
      .send({ customer_id: customerId, plan_id: widePlanId, start_date: dayStr(0), lines: [{ product_id: productId, quantity: 2 }] });
    expect(res.status).toBe(201);
    expect(res.body.lines[0].unitPrice).toBe('1000.00');
  });
});

describe('overdue pagination', () => {
  it('respects page and page_size and echoes the envelope', async () => {
    const p1 = await api().get('/reports/overdue?page=1&page_size=2').set('Authorization', `Bearer ${staffToken}`);
    expect(p1.status).toBe(200);
    expect(p1.body.items.length).toBeLessThanOrEqual(2);
    expect(p1.body.total).toBeGreaterThanOrEqual(p1.body.items.length);
    expect(p1.body.page).toBe(1);
    expect(p1.body.page_size).toBe(2);

    const p2 = await api().get('/reports/overdue?page=2&page_size=2').set('Authorization', `Bearer ${staffToken}`);
    const p1Numbers = p1.body.items.map((i: { id: number }) => i.id);
    const p2Numbers = p2.body.items.map((i: { id: number }) => i.id);
    expect(p1Numbers.some((n: number) => p2Numbers.includes(n))).toBe(false); // no overlap
  });

  it('caps page_size at 100', async () => {
    const res = await api().get('/reports/overdue?page_size=500').set('Authorization', `Bearer ${staffToken}`);
    expect(res.body.page_size).toBe(100);
  });
});

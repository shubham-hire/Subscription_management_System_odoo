/**
 * Billing & subscriptions integration tests — PRD acceptance scenarios
 * #4 (variant pricing), #7 (transitions), #8 (no double/skipped billing),
 * #9 (discount auto-apply and stop). Self-contained: wipes the disposable
 * test DB and builds its own fixtures.
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
let staffToken = '';

const day = (offset: number) => new Date(Date.now() + offset * 86_400_000);

let subId = 0; // the catch-up subscription used for billing assertions

// Not async — awaiting request(server) would execute a GET (supertest thenable).
const api = () => request(app.getHttpServer());

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

  // ── Wipe (FK-safe) ──
  for (const m of [
    'auditLog', 'payment', 'invoiceLine', 'invoice', 'subscriptionStatusHistory',
    'subscriptionLine', 'subscription', 'discountProduct', 'discount',
    'templateLine', 'quotationTemplate', 'productVariant', 'product', 'plan', 'tax', 'user', 'customer',
  ] as const) {
    await prisma[m].deleteMany();
  }

  // ── Fixtures: staff user, wide-window plan (no auto-close), product+variant, tax, discount ──
  await prisma.user.create({
    data: {
      name: 'Staff', email: 'staff@bill.test',
      passwordHash: await bcrypt.hash('StaffPass1!', 4), role: 'staff',
    },
  });
  const customer = await prisma.customer.create({
    data: { name: 'Billing Co', email: 'billing@test.local' },
  });
  const tax = await prisma.tax.create({ data: { name: 'GST 10%', percentage: 10 } });
  const product = await prisma.product.create({
    data: { name: 'ERP Software', type: 'software', salesPrice: 1000, costPrice: 500, taxId: tax.id },
  });
  await prisma.productVariant.create({
    data: { productId: product.id, attribute: 'Brand', value: 'Odoo', priceExtra: 100 },
  });
  const plan = await prisma.plan.create({
    data: {
      name: 'Wide Monthly', price: 1000, billingPeriod: 'monthly', minQuantity: 2,
      availableFrom: new Date('2020-01-01'), availableTo: new Date('2030-12-31'),
      autoClose: false, closable: true, pausable: false, renewable: true,
    },
  });
  const discount = await prisma.discount.create({
    data: {
      name: 'Seats 10%', type: 'percentage', value: 10, minQuantity: 2,
      startDate: day(-30), endDate: day(30), maxUses: 2, scope: 'product',
    },
  });
  await prisma.discountProduct.create({ data: { discountId: discount.id, productId: product.id } });

  const login = await request(app.getHttpServer())
    .post('/auth/login').send({ email: 'staff@bill.test', password: 'StaffPass1!' });
  staffToken = login.body.token;

  // ── The subscription under test: started 70 days ago → ~3 monthly periods due ──
  const sub = await api()
    .post('/subscriptions')
    .set('Authorization', `Bearer ${staffToken}`)
    .send({
      customer_id: customer.id, plan_id: plan.id,
      start_date: day(-70).toISOString().slice(0, 10),
      payment_terms_days: 0,
      lines: [{ product_id: product.id, variant_id: 1, quantity: 2 }],
    });
  expect(sub.status).toBe(201);
  subId = sub.body.id;

  // lifecycle to active
  for (const t of ['quotation', 'confirm', 'activate']) {
    const r = await api().post(`/subscriptions/${subId}/${t}`).set('Authorization', `Bearer ${staffToken}`);
    expect(r.status, `transition ${t}: ${JSON.stringify(r.body)}`).toBe(201);
  }
}, 90_000);

afterAll(async () => {
  await app?.close();
});

describe('acceptance #4 — variant pricing', () => {
  it('adds the variant price extra to the unit price (1000 + 100 = 1100)', async () => {
    const res = await api().get(`/subscriptions/${subId}`).set('Authorization', `Bearer ${staffToken}`);
    expect(res.body.lines[0].unitPrice).toBe('1100.00');
  });

  it('enforces the plan minimum quantity (PLN-04)', async () => {
    const customer = await prisma.customer.findFirstOrThrow();
    const plan = await prisma.plan.findFirstOrThrow();
    const res = await api()
      .post('/subscriptions')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        customer_id: customer.id, plan_id: plan.id,
        start_date: day(0).toISOString().slice(0, 10),
        lines: [{ product_id: (await prisma.product.findFirstOrThrow()).id, quantity: 1 }],
      });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('minimum');
  });
});

describe('acceptance #7 — lifecycle transitions', () => {
  it('rejects invalid jumps and records every valid transition in history', async () => {
    const draft = await api()
      .post('/subscriptions')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        customer_id: (await prisma.customer.findFirstOrThrow()).id,
        plan_id: (await prisma.plan.findFirstOrThrow()).id,
        start_date: day(0).toISOString().slice(0, 10),
        lines: [{ product_id: (await prisma.product.findFirstOrThrow()).id, quantity: 2 }],
      });
    const draftId = draft.body.id;

    // invalid: draft -> active
    const jump = await api().post(`/subscriptions/${draftId}/activate`).set('Authorization', `Bearer ${staffToken}`);
    expect(jump.status).toBe(400);
    expect(jump.body.error.message).toContain('Invalid transition');

    // valid chain: draft -> quotation -> confirmed
    await api().post(`/subscriptions/${draftId}/quotation`).set('Authorization', `Bearer ${staffToken}`);
    await api().post(`/subscriptions/${draftId}/confirm`).set('Authorization', `Bearer ${staffToken}`);

    const detail = await api().get(`/subscriptions/${draftId}`).set('Authorization', `Bearer ${staffToken}`);
    const history = detail.body.history.map((h: { fromStatus: string; toStatus: string }) => `${h.fromStatus}->${h.toStatus}`);
    expect(history).toContain('draft->quotation');
    expect(history).toContain('quotation->confirmed');
    expect(detail.body.status).toBe('confirmed');
  });
});

describe('acceptance #8 — no double billing, no skipped periods', () => {
  it('bills every missed period exactly once, then a second run creates nothing', async () => {
    const run1 = await api().post('/billing/run').set('Authorization', `Bearer ${staffToken}`);
    expect(run1.status).toBe(201);
    expect(run1.body.created).toBeGreaterThanOrEqual(3);
    expect(run1.body.failed).toBe(0);

    const mine = await api()
      .get(`/invoices?subscription_id=${subId}&page_size=50`)
      .set('Authorization', `Bearer ${staffToken}`);
    // 70 days ≈ 3 monthly periods: start, start+1mo, start+2mo (start+3mo is future)
    expect(mine.body.total).toBe(3);
    const periods = mine.body.items.map((i: { periodStart: string }) => i.periodStart.slice(0, 10));
    expect(new Set(periods).size).toBe(3); // distinct periods — no duplicates

    const run2 = await api().post('/billing/run').set('Authorization', `Bearer ${staffToken}`);
    expect(run2.status).toBe(201);
    expect(run2.body.created).toBe(0); // idempotent — nothing new (acceptance #8)
    expect(run2.body.skipped).toBe(0);
  });
});

describe('acceptance #9 — discount applies automatically and stops at the limit', () => {
  it('applies the rule per period until max_uses is exhausted, then stops', async () => {
    const mine = await api()
      .get(`/invoices?subscription_id=${subId}&page_size=50&status=confirmed`)
      .set('Authorization', `Bearer ${staffToken}`);
    const invoices = mine.body.items.sort((a: { periodStart: string }, b: { periodStart: string }) =>
      a.periodStart.localeCompare(b.periodStart),
    );
    expect(invoices.length).toBe(3);

    // line: 2 × 1100 = 2200 subtotal; 10% = 220 discount; tax 10% of 1980 = 198; total 2178
    expect(invoices[0].discountTotal).toBe('220.00');
    expect(invoices[0].total).toBe('2178.00');
    expect(invoices[0].lines[0].discountName).toBe('Seats 10%');

    // max_uses = 2 → second period discounted, third not
    expect(invoices[1].discountTotal).toBe('220.00');
    expect(invoices[2].discountTotal).toBe('0.00');
    expect(invoices[2].total).toBe('2420.00'); // full price, no discount

    const discount = await prisma.discount.findFirstOrThrow();
    expect(discount.timesUsed).toBe(2); // capped at max_uses
  });
});

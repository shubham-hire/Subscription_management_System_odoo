/**
 * Demo-day hardening tests: CORS preflight, concurrent billing runs, and
 * concurrent payments on one invoice — the three ways the live demo could
 * actually fail. Self-contained fixtures.
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
let subId = 0;
let invoiceId = 0;

const dayStr = (offset: number) =>
  new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
const api = () => request(app.getHttpServer());

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  // main.ts wires CORS in bootstrap; the test app must mirror it to test it
  app.enableCors({ origin: 'http://localhost:5173' });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new MoneyFormatInterceptor());
  await app.init();
  prisma = app.get(PrismaService);

  for (const m of [
    'auditLog', 'billingRun', 'payment', 'invoiceLine', 'invoice',
    'subscriptionStatusHistory', 'subscriptionLine', 'subscription',
    'discountProduct', 'discount', 'templateLine', 'quotationTemplate',
    'productVariant', 'product', 'plan', 'tax', 'user', 'customer',
  ] as const) {
    await prisma[m].deleteMany();
  }

  await prisma.user.create({
    data: { name: 'Staff', email: 'staff@hard.test', passwordHash: await bcrypt.hash('StaffPass1!', 4), role: 'staff' },
  });
  const customer = await prisma.customer.create({ data: { name: 'Hard Co', email: 'hard@test.local' } });
  const tax = await prisma.tax.create({ data: { name: 'GST 0%', percentage: 0 } });
  const product = await prisma.product.create({
    data: { name: 'Demo Product', type: 'software', salesPrice: 1000, costPrice: 0, taxId: tax.id },
  });
  const plan = await prisma.plan.create({
    data: {
      name: 'Hard Monthly', price: 1000, billingPeriod: 'monthly', minQuantity: 1,
      availableFrom: new Date('2020-01-01'), availableTo: new Date('2030-12-31'),
      autoClose: false, closable: true, pausable: false, renewable: true,
    },
  });

  const sub = await prisma.subscription.create({
    data: {
      customerId: customer.id, planId: plan.id, status: 'active',
      startDate: new Date(), expiryDate: new Date(Date.now() + 30 * 86_400_000), nextBillingDate: new Date(),
      paymentTermsDays: 0,
      lines: { create: [{ productId: product.id, quantity: 1, unitPrice: 1000 }] },
    },
  });
  subId = sub.id;

  const invoice = await prisma.invoice.create({
    data: {
      number: 'INV-990001', subscriptionId: sub.id, customerId: customer.id,
      status: 'confirmed', periodStart: new Date(), periodEnd: new Date(Date.now() + 30 * 86_400_000),
      issueDate: new Date(), dueDate: new Date(Date.now() + 15 * 86_400_000),
      subtotal: 1000, total: 1000, amountPaid: 0,
      lines: { create: [{ productId: product.id, description: 'Demo', quantity: 1, unitPrice: 1000, lineTotal: 1000 }] },
    },
  });
  invoiceId = invoice.id;

  staffToken = (
    await api().post('/auth/login').send({ email: 'staff@hard.test', password: 'StaffPass1!' })
  ).body.token;
}, 90_000);

afterAll(async () => {
  await app?.close();
});

describe('CORS preflight (the frontend depends on this)', () => {
  it('answers OPTIONS with 204 and the allow-origin header', async () => {
    const res = await api().options('/auth/login')
      .set('Origin', 'http://localhost:5173')
      .set('Access-Control-Request-Method', 'POST');
    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    expect(res.headers['access-control-allow-methods']).toContain('POST');
  });
});

describe('concurrent billing runs (advisory lock)', () => {
  it('admits exactly one of two simultaneous runs', async () => {
    // make something due
    await api().post('/subscriptions').set('Authorization', `Bearer ${staffToken}`)
      .send({ customer_id: (await prisma.customer.findFirstOrThrow()).id, plan_id: (await prisma.plan.findFirstOrThrow()).id, start_date: dayStr(0), lines: [{ product_id: (await prisma.product.findFirstOrThrow()).id, quantity: 1 }] })
      .then(async (created) => {
        for (const t of ['quotation', 'confirm', 'activate']) {
          await api().post(`/subscriptions/${created.body.id}/${t}`).set('Authorization', `Bearer ${staffToken}`);
        }
      });

    // fire two runs at the same instant
    const [a, b] = await Promise.all([
      api().post('/billing/run').set('Authorization', `Bearer ${staffToken}`),
      api().post('/billing/run').set('Authorization', `Bearer ${staffToken}`),
    ]);
    expect(a.status).toBe(201);
    expect(b.status).toBe(201);

    const statuses = [a.body.status, b.body.status].sort();
    expect(statuses).toEqual(['already_running', undefined]); // one locked out
    const created = [a.body.created, b.body.created];
    expect(created.filter((c) => c > 0)).toHaveLength(1); // exactly one did the work
  });

  it('releases the lock — the next run is admitted again', async () => {
    const next = await api().post('/billing/run').set('Authorization', `Bearer ${staffToken}`);
    expect(next.status).toBe(201);
    expect(next.body.status).toBeUndefined(); // not locked out
  });
});

describe('concurrent payments on one invoice (row lock)', () => {
  it('serializes payers — an overpaying second request is rejected with the live balance', async () => {
    // outstanding 1000; two simultaneous 600s — both pass a stale check, only one may land
    const body = { method: 'upi', amount: '600.00', date: dayStr(0) };
    const [a, b] = await Promise.all([
      api().post(`/invoices/${invoiceId}/payments`).set('Authorization', `Bearer ${staffToken}`).send(body),
      api().post(`/invoices/${invoiceId}/payments`).set('Authorization', `Bearer ${staffToken}`).send(body),
    ]);

    const codes = [a.status, b.status].sort();
    expect(codes).toEqual([201, 400]); // exactly one succeeded
    const rejected = a.status === 400 ? a : b;
    expect(rejected.body.error.fields.amount).toContain('outstanding balance of 400.00');

    // the invoice holds exactly one payment — no overpayment
    const detail = await api().get(`/invoices/${invoiceId}`).set('Authorization', `Bearer ${staffToken}`);
    expect(detail.body.amountPaid).toBe('600.00');
    expect(detail.body.payments).toHaveLength(1);
  });

  it('lets two sequential partial payments fill the exact balance', async () => {
    const p1 = await api().post(`/invoices/${invoiceId}/payments`).set('Authorization', `Bearer ${staffToken}`)
      .send({ method: 'cash', amount: '200.00', date: dayStr(0) });
    expect(p1.status).toBe(201);

    const p2 = await api().post(`/invoices/${invoiceId}/payments`).set('Authorization', `Bearer ${staffToken}`)
      .send({ method: 'card', amount: '200.00', date: dayStr(0) });
    expect(p2.status).toBe(201);

    const detail = await api().get(`/invoices/${invoiceId}`).set('Authorization', `Bearer ${staffToken}`);
    expect(detail.body.amountPaid).toBe('1000.00');
    expect(detail.body.status).toBe('paid');
  });
});

import Decimal from 'decimal.js';
import type {
  AuthResponse,
  User,
  LoginPayload,
  SignupPayload,
  Product,
  Plan,
  Tax,
  Discount,
  Customer,
  Subscription,
  SubscriptionAction,
  SubscriptionStatus,
  CreateSubscriptionPayload,
  Invoice,
  InvoiceStatus,
  Payment,
  RecordPaymentPayload,
  BillingRunSummary,
  ReportSummary,
  OverdueInvoice,
  PaginatedResponse,
  PaginationParams,
  CreateProductPayload,
  UpdateProductPayload,
  CreatePlanPayload,
  UpdatePlanPayload,
  CreateTaxPayload,
  UpdateTaxPayload,
  CreateDiscountPayload,
  UpdateDiscountPayload,
  CreateCustomerPayload,
  StatusHistoryEntry,
  InvoiceLine,
  PaymentTerms,
} from '@/types';
import { PAYMENT_TERMS_DAYS } from '@/types';
import { ApiError } from '@/api/client';
import { todayIST, addDays, addPeriod, daysBetween } from '@/lib/dates';

/**
 * In-memory mock database.
 * VITE_USE_MOCKS=true activates these handlers.
 */

// ─── Deterministic PRNG so the demo data is stable across reloads ───

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20261031);
const pick = <T,>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];
const randInt = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1));

// ─── Users ───

interface MockUser extends User {
  password: string;
}

const MOCK_USERS: MockUser[] = [
  {
    id: '1',
    email: 'admin@brightloop.dev',
    name: 'Admin User',
    role: 'admin',
    password: 'Admin@1234',
  },
  {
    id: '2',
    email: 'staff@brightloop.dev',
    name: 'Staff User',
    role: 'staff',
    password: 'Staff@1234',
  },
  {
    id: '3',
    email: 'customer@brightloop.dev',
    name: 'Rohit Khond',
    role: 'customer',
    customer_id: 'cust_1',
    password: 'Customer@1234',
  },
];

let mockUserIdCounter = MOCK_USERS.length;

// ─── Catalog Seed ───

let MOCK_PRODUCTS: Product[] = [
  {
    id: 'prod_1',
    name: 'Cloud CRM Suite',
    description: 'Enterprise customer relationship management platform with automation.',
    status: 'active',
    sales_price: '1499.00',
    cost_price: '400.00',
    tax_id: 'tax_1',
    variants: [
      { id: 'var_1', product_id: 'prod_1', attribute: 'Brand', value: 'Odoo', price_extra: '560.00' },
      { id: 'var_2', product_id: 'prod_1', attribute: 'Brand', value: 'Zoho', price_extra: '220.00' },
    ],
    created_at: '2026-01-15T10:00:00.000Z',
  },
  {
    id: 'prod_2',
    name: 'Brightloop Analytics',
    description: 'Real-time billing, churn, and revenue intelligence reporting.',
    status: 'active',
    sales_price: '2499.00',
    cost_price: '700.00',
    tax_id: 'tax_1',
    variants: [
      { id: 'var_3', product_id: 'prod_2', attribute: 'Tier', value: 'Plus', price_extra: '450.00' },
    ],
    created_at: '2026-02-01T12:00:00.000Z',
  },
  {
    id: 'prod_3',
    name: 'Developer API Gateway',
    description: 'High-throughput webhook infrastructure and developer sandbox.',
    status: 'active',
    sales_price: '999.00',
    cost_price: '250.00',
    tax_id: 'tax_4',
    variants: [],
    created_at: '2026-02-20T08:30:00.000Z',
  },
];

let MOCK_PLANS: Plan[] = [
  {
    id: 'plan_1',
    product_id: 'prod_1',
    product_name: 'Cloud CRM Suite',
    name: 'CRM Starter Monthly',
    billing_interval: 'month',
    interval_count: 1,
    price: '499.00',
    trial_days: 7,
    min_quantity: 1,
    auto_close: false,
    closable: true,
    pausable: false,
    renewable: true,
    available_from: null,
    available_to: null,
    status: 'active',
    created_at: '2026-01-16T10:00:00.000Z',
  },
  {
    id: 'plan_2',
    product_id: 'prod_1',
    product_name: 'Cloud CRM Suite',
    name: 'CRM Pro Monthly',
    billing_interval: 'month',
    interval_count: 1,
    price: '1999.00',
    trial_days: 14,
    min_quantity: 2,
    auto_close: false,
    closable: true,
    pausable: true,
    renewable: true,
    available_from: null,
    available_to: null,
    status: 'active',
    created_at: '2026-01-16T10:05:00.000Z',
  },
  {
    id: 'plan_3',
    product_id: 'prod_1',
    product_name: 'Cloud CRM Suite',
    name: 'CRM Enterprise Annual',
    billing_interval: 'year',
    interval_count: 1,
    price: '19999.00',
    trial_days: 30,
    min_quantity: 5,
    auto_close: true,
    closable: false,
    pausable: false,
    renewable: true,
    available_from: null,
    available_to: null,
    status: 'active',
    created_at: '2026-01-16T10:10:00.000Z',
  },
  {
    id: 'plan_4',
    product_id: 'prod_2',
    product_name: 'Brightloop Analytics',
    name: 'Analytics Growth',
    billing_interval: 'month',
    interval_count: 1,
    price: '2499.00',
    trial_days: 14,
    min_quantity: 1,
    auto_close: true,
    closable: true,
    pausable: true,
    renewable: false,
    available_from: null,
    available_to: null,
    status: 'active',
    created_at: '2026-02-02T11:00:00.000Z',
  },
];

let MOCK_TAXES: Tax[] = [
  { id: 'tax_1', name: 'GST 18%', rate: '18.00', is_inclusive: false, status: 'active', created_at: '2026-01-10T00:00:00.000Z' },
  { id: 'tax_2', name: 'SGST 9%', rate: '9.00', is_inclusive: false, status: 'active', created_at: '2026-01-10T00:00:00.000Z' },
  { id: 'tax_3', name: 'CGST 9%', rate: '9.00', is_inclusive: false, status: 'active', created_at: '2026-01-10T00:00:00.000Z' },
  { id: 'tax_4', name: 'Digital Services VAT 5%', rate: '5.00', is_inclusive: true, status: 'active', created_at: '2026-02-15T00:00:00.000Z' },
];

let MOCK_DISCOUNTS: Discount[] = [
  {
    id: 'disc_1', code: 'WELCOME500', name: 'Welcome Sign-up Bonus', type: 'fixed', value: '500.00',
    scope: 'subscription', min_purchase: '1000.00', start_date: '2026-01-01', end_date: '2026-12-31',
    max_uses: 100, times_used: 12, status: 'active', created_at: '2026-01-15T00:00:00.000Z',
  },
  {
    id: 'disc_2', code: 'ANNUAL20', name: 'Annual Subscription Saver', type: 'percentage', value: '20.00',
    scope: 'product', product_ids: ['prod_1'], min_quantity: 3, start_date: '2026-01-01', end_date: '2026-12-31',
    max_uses: 50, times_used: 8, status: 'active', created_at: '2026-01-15T00:00:00.000Z',
  },
  {
    id: 'disc_3', code: 'STARTUP10', name: 'Early Stage Startup Perk', type: 'percentage', value: '10.00',
    scope: 'subscription', start_date: '2026-02-01', end_date: '2026-12-31',
    max_uses: 200, times_used: 31, status: 'active', created_at: '2026-02-01T00:00:00.000Z',
  },
];

// ─── Customers ───

const COMPANY_NAMES = [
  'Acme Retail', 'Sunrise Traders', 'Kumar Electronics', 'Bluestone Cafe', 'GreenLeaf Organics',
  'Metro Hardware', 'Pixel Studios', 'Sharma Textiles', 'Nova Bookstore', 'Zenith Fitness',
  'Lotus Pharmaceuticals', 'Everest Logistics', 'Spice Garden Restaurants', 'Quantum Labs',
  'Silverline Jewellers', 'Oceanic Exports', 'Crimson Interiors', 'Falcon Motors', 'Harbor Supplies',
  'Aurora Beauty', 'Summit Sports', 'Cascade Foods', 'Vertex Solutions', 'Monarch Fashion',
  'Ivory Learning', 'Terra Farms', 'Pulse Media', 'Granite Constructions', 'Willow Wellness',
  'Northstar Travel', 'Ember Energy', 'Quill Stationery', 'Maple Bakery', 'Cobalt Chemicals',
  'Jade Plant Nursery', 'Onyx Security', 'Prism Optics', 'Marble Architects', 'Flint Tools',
  'Solstice Events',
];

let MOCK_CUSTOMERS: Customer[] = COMPANY_NAMES.map((name, i) => ({
  id: `cust_${i + 1}`,
  name: `${name.split(' ')[0]} Contact`,
  company: name,
  email: i === 0 ? 'customer@brightloop.dev' : `contact${i + 1}@${name.toLowerCase().replace(/[^a-z]/g, '')}.in`,
  phone: `+91 9${randInt(100000000, 999999999)}`,
  billing_address: `${randInt(1, 200)}, ${pick(['MG Road', 'Park Street', 'Anna Salai', 'Brigade Road', 'FC Road', 'Linking Road'])}, ${pick(['Mumbai', 'Bengaluru', 'Chennai', 'Pune', 'Delhi', 'Hyderabad'])} ${randInt(400001, 600099)}`,
  tax_id: `27AAB${randInt(1000, 9999)}C1Z${randInt(1, 9)}`,
  created_at: '2026-01-20T09:00:00.000Z',
}));

// ─── Pricing engine (mirrors PRD §6.1 — Decimal only) ───

function getUnitPrice(product: Product, variantId?: string | null): string {
  const base = new Decimal(product.sales_price ?? '0');
  const extra = variantId
    ? new Decimal(product.variants?.find((v) => v.id === variantId)?.price_extra ?? '0')
    : new Decimal(0);
  return base.plus(extra).toFixed(2);
}

interface ComputedInvoice {
  lines: InvoiceLine[];
  subtotal: string;
  discount_total: string;
  tax_total: string;
  total: string;
}

function computeInvoice(sub: Subscription, today: string): ComputedInvoice {
  const d = (v: string | number) => new Decimal(v);
  let subtotal = new Decimal(0);
  let discountTotal = new Decimal(0);
  let taxTotal = new Decimal(0);

  // Lines with their computed parts
  const parts = sub.lines.map((line) => {
    const product = MOCK_PRODUCTS.find((p) => p.id === line.product_id);
    const tax = line.tax_id ? MOCK_TAXES.find((t) => t.id === line.tax_id) : undefined;
    const lineSubtotal = d(line.unit_price).times(line.quantity).toDecimalPlaces(2);
    subtotal = subtotal.plus(lineSubtotal);
    return { line, product, tax, lineSubtotal, discount: new Decimal(0), discountName: undefined as string | undefined };
  });

  // Discount selection: a subscription-scope rule wins and distributes pro-rata (D6),
  // otherwise the single best product-scope rule per line (D1).
  const subScope = MOCK_DISCOUNTS.find(
    (r) =>
      r.status === 'active' &&
      r.scope === 'subscription' &&
      isRuleLive(r, today) &&
      (r.min_purchase ? subtotal.gte(d(r.min_purchase)) : true),
  );

  if (subScope) {
    // Largest-remainder distribution of a fixed amount, or a percentage of the whole
    let pool = subScope.type === 'fixed'
      ? Decimal.min(d(subScope.value), subtotal)
      : subtotal.times(d(subScope.value)).div(100).toDecimalPlaces(2);
    const totalSub = subtotal.equals(0) ? new Decimal(1) : subtotal;
    const raw = parts.map((p) => p.lineSubtotal.div(totalSub).times(pool));
    const floored = raw.map((r) => r.toDecimalPlaces(2, Decimal.ROUND_DOWN));
    let remainder = pool.minus(floored.reduce((a, b) => a.plus(b), new Decimal(0))).toDecimalPlaces(2);
    // Give remainder paise to the largest lines
    const order = parts.map((_, i) => i).sort((a, b) => raw[b].minus(raw[a]).toNumber());
    let ri = 0;
    while (remainder.gt(0) && order.length) {
      const idx = order[ri % order.length];
      floored[idx] = floored[idx].plus(0.01);
      remainder = remainder.minus(0.01);
      ri++;
    }
    parts.forEach((p, i) => {
      p.discount = floored[i];
      p.discountName = subScope.name;
    });
  } else {
    parts.forEach((p) => {
      const best = MOCK_DISCOUNTS.filter(
        (r) =>
          r.status === 'active' &&
          r.scope === 'product' &&
          (r.product_ids ?? []).includes(p.line.product_id) &&
          isRuleLive(r, today) &&
          (r.min_quantity ? p.line.quantity >= r.min_quantity : true) &&
          (r.min_purchase ? p.lineSubtotal.gte(d(r.min_purchase)) : true),
      )
        .map((r) => ({
          r,
          saving:
            r.type === 'fixed'
              ? Decimal.min(d(r.value), p.lineSubtotal)
              : p.lineSubtotal.times(d(r.value)).div(100).toDecimalPlaces(2),
        }))
        .sort((a, b) => b.saving.minus(a.saving).toNumber())[0];
      if (best) {
        p.discount = best.saving;
        p.discountName = best.r.name;
      }
    });
  }

  // Never negative (DSC-07)
  const builtLines: InvoiceLine[] = parts.map((p, i) => {
    const taxable = p.lineSubtotal.minus(p.discount);
    const taxAmount = taxable.times(d(p.tax?.rate ?? '0')).div(100).toDecimalPlaces(2);
    subtotal = subtotal; // already summed
    discountTotal = discountTotal.plus(p.discount);
    taxTotal = taxTotal.plus(taxAmount);
    return {
      id: `invl_${sub.id}_${i}`,
      product_id: p.line.product_id,
      description: `${p.product?.name ?? 'Item'}${p.line.variant_label ? ` · ${p.line.variant_label}` : ''}`,
      quantity: p.line.quantity,
      unit_price: p.line.unit_price,
      discount_amount: p.discount.toFixed(2),
      discount_name: p.discountName,
      tax_rate: p.tax?.rate ?? '0.00',
      tax_amount: taxAmount.toFixed(2),
      line_total: taxable.plus(taxAmount).toFixed(2),
    };
  });

  discountTotal = Decimal.min(discountTotal, subtotal);
  return {
    lines: builtLines,
    subtotal: subtotal.toFixed(2),
    discount_total: discountTotal.toFixed(2),
    tax_total: taxTotal.toFixed(2),
    total: subtotal.minus(discountTotal).plus(taxTotal).toFixed(2),
  };
}

function isRuleLive(r: Discount, today: string): boolean {
  if (r.start_date && today < r.start_date) return false;
  if (r.end_date && today > r.end_date) return false;
  if (r.max_uses != null && (r.times_used ?? 0) >= r.max_uses) return false;
  return true;
}

// ─── Subscriptions + invoices seed ───

let subCounter = 0;
let invCounter = 0;
let MOCK_SUBSCRIPTIONS: Subscription[] = [];
let MOCK_INVOICES: Invoice[] = [];
let MOCK_PAYMENTS: Payment[] = [];
const invoiceKeys = new Set<string>(); // `${subscription_id}:${period_start}` — no double billing

function nextSubNumber(): string {
  subCounter += 1;
  return `SUB-${String(subCounter).padStart(6, '0')}`;
}
function nextInvNumber(): string {
  invCounter += 1;
  return `INV-${String(invCounter).padStart(6, '0')}`;
}

function makeHistory(statuses: SubscriptionStatus[], startISO: string): StatusHistoryEntry[] {
  const chain: Array<SubscriptionStatus | null> = [null, ...statuses.slice(0, -1)];
  return statuses.map((to, i) => ({
    id: `hist_${subCounter}_${i}`,
    from_status: chain[i],
    to_status: to,
    changed_by: pick(['Staff User', 'Admin User']),
    changed_at: new Date(Date.parse(`${addDays(startISO, i * randInt(1, 5))}T10:${String(randInt(10, 59))}:00.000Z`)).toISOString(),
  }));
}

function seedSubscription(today: string): void {
  subCounter += 1;
  const id = `sub_${subCounter}`;
  const customer = MOCK_CUSTOMERS[randInt(0, MOCK_CUSTOMERS.length - 1)];
  const plan = MOCK_PLANS[randInt(0, MOCK_PLANS.length - 1)];
  const product = MOCK_PRODUCTS.find((p) => p.id === plan.product_id)!;

  const bucket = subCounter % 20;
  let status: SubscriptionStatus =
    bucket <= 13 ? 'active'
    : bucket === 14 ? 'closed'
    : bucket === 15 ? 'confirmed'
    : bucket === 16 ? 'quotation'
    : bucket === 17 ? 'draft'
    : bucket === 18 ? 'active'
    : 'paused';

  const startOffset = randInt(10, 150);
  const start_date = addDays(today, -startOffset);
  const quantity = Math.max(plan.min_quantity ?? 1, randInt(1, 3));
  const variant = product.variants?.length && rand() > 0.4 ? pick(product.variants) : undefined;
  const taxId = product.tax_id ?? 'tax_1';
  const terms = pick<PaymentTerms>(['immediate', 'net_15', 'net_30']);

  const sub: Subscription = {
    id,
    number: nextSubNumber(),
    customer_id: customer.id,
    customer_name: customer.company ?? customer.name,
    plan_id: plan.id,
    plan_name: plan.name,
    status,
    start_date,
    expiry_date: addPeriod(start_date, plan.billing_interval, plan.interval_count),
    next_billing_date: start_date,
    payment_terms: terms,
    lines: [
      {
        id: `subl_${id}_1`,
        product_id: product.id,
        product_name: product.name,
        variant_id: variant?.id ?? null,
        variant_label: variant ? `${variant.attribute}: ${variant.value}` : undefined,
        quantity,
        unit_price: getUnitPrice(product, variant?.id),
        tax_id: taxId,
      },
    ],
    history: [],
    created_at: new Date(Date.parse(`${start_date}T09:00:00.000Z`)).toISOString(),
  };

  const periodsElapsed = Math.max(1, Math.floor(startOffset / 30));
  sub.expiry_date = addPeriod(start_date, plan.billing_interval, Math.min(periodsElapsed + 1, 6));

  // Lifecycle + history per status
  if (status === 'active') {
    sub.history = makeHistory(['draft', 'quotation', 'confirmed', 'active'], start_date);
    // 40% are due now (billing run will pick them up), rest bill later this month
    sub.next_billing_date =
      rand() < 0.4
        ? addDays(today, -randInt(0, 4))
        : addDays(today, randInt(1, 24));
  } else if (status === 'paused') {
    sub.history = makeHistory(['draft', 'quotation', 'confirmed', 'active', 'paused'], start_date);
    sub.next_billing_date = addDays(today, randInt(5, 20));
  } else if (status === 'closed') {
    sub.history = makeHistory(['draft', 'quotation', 'confirmed', 'active', 'closed'], start_date);
    sub.next_billing_date = start_date;
  } else if (status === 'confirmed') {
    sub.history = makeHistory(['draft', 'quotation', 'confirmed'], start_date);
    sub.next_billing_date = addDays(today, randInt(0, 6));
  } else if (status === 'quotation') {
    sub.history = makeHistory(['draft', 'quotation'], start_date);
    sub.quotation_expires_at = addDays(today, randInt(-5, 25));
  } else {
    sub.history = makeHistory(['draft'], start_date);
  }

  MOCK_SUBSCRIPTIONS.push(sub);

  // Historical invoices for live/closed subs
  if (status === 'active' || status === 'paused' || status === 'closed') {
    const pastCount = status === 'closed' ? randInt(1, 2) : Math.min(periodsElapsed, randInt(1, 3));
    for (let k = pastCount; k >= 1; k--) {
      const periodStart = addPeriod(start_date, plan.billing_interval, pastCount - k);
      if (periodStart >= today) continue;
      const computed = computeInvoice(sub, periodStart);
      const issue = periodStart;
      const due = addDays(issue, PAYMENT_TERMS_DAYS[terms]);
      const bucketP = randInt(0, 9);
      let invStatus: InvoiceStatus = bucketP <= 5 ? 'paid' : bucketP <= 7 ? 'confirmed' : 'draft';
      if (invStatus === 'confirmed' && daysBetween(due, today) > 0 && rand() < 0.6) {
        invStatus = 'confirmed'; // stays confirmed with balance → overdue
      }
      const amountPaid =
        invStatus === 'paid'
          ? computed.total
          : invStatus === 'confirmed' && rand() < 0.4
            ? new Decimal(computed.total).times(0.4).toDecimalPlaces(2).toFixed(2)
            : '0.00';

      createSeedInvoice(sub, computed, invStatus, issue, due, periodStart, amountPaid);
    }
  }
}

function createSeedInvoice(
  sub: Subscription,
  computed: ReturnType<typeof computeInvoice>,
  status: InvoiceStatus,
  issue: string,
  due: string,
  periodStart: string,
  amountPaid: string,
): Invoice {
  const inv: Invoice = {
    id: `inv_${invCounter + 1}`,
    number: nextInvNumber(),
    subscription_id: sub.id,
    subscription_number: sub.number,
    customer_id: sub.customer_id,
    customer_name: sub.customer_name,
    status,
    period_start: periodStart,
    period_end: addDays(addPeriod(periodStart, 'month', 1), -1),
    issue_date: issue,
    due_date: due,
    subtotal: computed.subtotal,
    discount_total: computed.discount_total,
    tax_total: computed.tax_total,
    total: computed.total,
    amount_paid: amountPaid,
    lines: computed.lines,
  };
  MOCK_INVOICES.push(inv);
  invoiceKeys.add(`${sub.id}:${periodStart}`);

  if (amountPaid !== '0.00') {
    MOCK_PAYMENTS.push({
      id: `pay_${MOCK_PAYMENTS.length + 1}`,
      invoice_id: inv.id,
      invoice_number: inv.number,
      method: pick(['cash', 'card', 'upi', 'bank_transfer', 'cheque'] as Payment['method'][]),
      amount: amountPaid,
      payment_date: addDays(due, -randInt(0, 10)),
      note: '',
      recorded_by: 'Staff User',
    });
  }
  return inv;
}

(function seed() {
  const today = todayIST();
  for (let i = 0; i < 300; i++) seedSubscription(today);
})();

// ─── Helpers ───

function createMockToken(user: User): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = btoa(
    JSON.stringify({ sub: user.id, email: user.email, role: user.role, exp: Math.floor(Date.now() / 1000) + 86400 }),
  );
  return `${header}.${payload}.mock-signature`;
}

function delay(ms = 300): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function paginate<T>(items: T[], params?: PaginationParams): PaginatedResponse<T> {
  const page = Number(params?.page) || 1;
  const pageSize = Number(params?.page_size) || 20;
  const start = (page - 1) * pageSize;
  return {
    items: items.slice(start, start + pageSize),
    total: items.length,
    page,
    page_size: pageSize,
  };
}

function stripPassword(u: MockUser): User {
  const { password: _, ...safe } = u;
  return safe;
}

// ─── Handlers ───

export const mockHandlers = {
  // ─── Auth ───
  async login(payload: LoginPayload): Promise<AuthResponse> {
    await delay();
    const user = MOCK_USERS.find(
      (u) => u.email === payload.email.toLowerCase().trim() && u.password === payload.password,
    );
    if (!user) {
      throw new ApiError(401, { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' });
    }
    return { access_token: createMockToken(user), user: stripPassword(user) };
  },

  async signup(payload: SignupPayload): Promise<AuthResponse> {
    await delay();
    const email = payload.email.toLowerCase().trim();
    const exists = MOCK_USERS.find((u) => u.email === email);
    if (exists) {
      throw new ApiError(422, {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed.',
        fields: { email: 'This email is already in use' },
      });
    }
    // Link to an existing customer record by email (CUS-02)
    const linked = MOCK_CUSTOMERS.find((c) => c.email === email);
    mockUserIdCounter += 1;
    const newUser: MockUser = {
      id: String(mockUserIdCounter),
      email,
      name: payload.name,
      role: 'customer',
      customer_id: linked?.id ?? null,
      password: payload.password,
    };
    MOCK_USERS.push(newUser);
    return { access_token: createMockToken(newUser), user: stripPassword(newUser) };
  },

  async me(token: string): Promise<User> {
    await delay(150);
    try {
      const payload = JSON.parse(atob(token.split('.')[1])) as { sub: string };
      const user = MOCK_USERS.find((u) => u.id === payload.sub);
      if (!user) throw new Error('not found');
      return stripPassword(user);
    } catch {
      throw new ApiError(401, { code: 'UNAUTHORIZED', message: 'Invalid or expired token.' });
    }
  },

  // ─── Users (admin) ───
  async getUsers(params?: PaginationParams): Promise<PaginatedResponse<User>> {
    await delay();
    return paginate(MOCK_USERS.map(stripPassword), params);
  },

  async createStaff(payload: { name: string; email: string; password: string }): Promise<User> {
    await delay();
    const email = payload.email.toLowerCase().trim();
    if (MOCK_USERS.some((u) => u.email === email)) {
      throw new ApiError(422, {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed.',
        fields: { email: 'This email is already in use' },
      });
    }
    mockUserIdCounter += 1;
    const user: MockUser = {
      id: String(mockUserIdCounter),
      email,
      name: payload.name,
      role: 'staff',
      password: payload.password,
    };
    MOCK_USERS.push(user);
    return stripPassword(user);
  },

  // ─── Products ───
  async getProducts(params?: PaginationParams): Promise<PaginatedResponse<Product>> {
    await delay();
    return paginate(MOCK_PRODUCTS, params);
  },

  async createProduct(payload: CreateProductPayload): Promise<Product> {
    await delay();
    const existing = MOCK_PRODUCTS.find((p) => p.name.toLowerCase() === payload.name.trim().toLowerCase());
    if (existing) {
      throw new ApiError(422, {
        code: 'VALIDATION_ERROR',
        message: 'A product with this name already exists.',
        fields: { name: 'Product name must be unique' },
      });
    }
    const newProduct: Product = {
      id: `prod_${Date.now()}`,
      name: payload.name.trim(),
      description: payload.description || '',
      status: payload.status,
      sales_price: payload.sales_price ?? '0.00',
      cost_price: payload.cost_price ?? '0.00',
      tax_id: payload.tax_id ?? null,
      variants: payload.variants ?? [],
      created_at: new Date().toISOString(),
    };
    MOCK_PRODUCTS = [newProduct, ...MOCK_PRODUCTS];
    return newProduct;
  },

  async updateProduct(id: string, payload: UpdateProductPayload): Promise<Product> {
    await delay();
    const index = MOCK_PRODUCTS.findIndex((p) => p.id === id);
    if (index === -1) {
      throw new ApiError(404, { code: 'NOT_FOUND', message: 'Product not found.' });
    }
    if (payload.name) {
      const duplicate = MOCK_PRODUCTS.find(
        (p) => p.id !== id && p.name.toLowerCase() === payload.name!.trim().toLowerCase(),
      );
      if (duplicate) {
        throw new ApiError(422, {
          code: 'VALIDATION_ERROR',
          message: 'A product with this name already exists.',
          fields: { name: 'Product name must be unique' },
        });
      }
    }
    const updated: Product = { ...MOCK_PRODUCTS[index], ...payload };
    MOCK_PRODUCTS[index] = updated;
    if (payload.name) {
      MOCK_PLANS = MOCK_PLANS.map((plan) =>
        plan.product_id === id ? { ...plan, product_name: payload.name } : plan,
      );
    }
    return updated;
  },

  async createVariant(productId: string, payload: { attribute: string; value: string; price_extra: string }): Promise<Product> {
    await delay();
    const product = MOCK_PRODUCTS.find((p) => p.id === productId);
    if (!product) throw new ApiError(404, { code: 'NOT_FOUND', message: 'Product not found.' });
    const variant = {
      id: `var_${Date.now()}`,
      product_id: productId,
      attribute: payload.attribute,
      value: payload.value,
      price_extra: payload.price_extra,
    };
    product.variants = [...(product.variants ?? []), variant];
    return product;
  },

  // ─── Plans ───
  async getPlans(params?: PaginationParams): Promise<PaginatedResponse<Plan>> {
    await delay();
    return paginate(MOCK_PLANS, params);
  },

  async createPlan(payload: CreatePlanPayload): Promise<Plan> {
    await delay();
    const product = MOCK_PRODUCTS.find((p) => p.id === payload.product_id);
    if (!product) {
      throw new ApiError(422, {
        code: 'VALIDATION_ERROR',
        message: 'Invalid product selected.',
        fields: { product_id: 'Selected product does not exist' },
      });
    }
    const newPlan: Plan = {
      id: `plan_${Date.now()}`,
      ...payload,
      product_name: product.name,
      created_at: new Date().toISOString(),
    };
    MOCK_PLANS = [newPlan, ...MOCK_PLANS];
    return newPlan;
  },

  async updatePlan(id: string, payload: UpdatePlanPayload): Promise<Plan> {
    await delay();
    const index = MOCK_PLANS.findIndex((p) => p.id === id);
    if (index === -1) throw new ApiError(404, { code: 'NOT_FOUND', message: 'Plan not found.' });
    let productName = MOCK_PLANS[index].product_name;
    if (payload.product_id && payload.product_id !== MOCK_PLANS[index].product_id) {
      const product = MOCK_PRODUCTS.find((p) => p.id === payload.product_id);
      if (product) productName = product.name;
    }
    const updated: Plan = { ...MOCK_PLANS[index], ...payload, product_name: productName };
    MOCK_PLANS[index] = updated;
    return updated;
  },

  // ─── Taxes ───
  async getTaxes(params?: PaginationParams): Promise<PaginatedResponse<Tax>> {
    await delay();
    return paginate(MOCK_TAXES, params);
  },

  async createTax(payload: CreateTaxPayload): Promise<Tax> {
    await delay();
    if (new Decimal(payload.rate).lt(0) || new Decimal(payload.rate).gt(100)) {
      throw new ApiError(422, {
        code: 'VALIDATION_ERROR',
        message: 'Tax percentage must be between 0 and 100.',
        fields: { rate: 'Must be between 0 and 100' },
      });
    }
    const newTax: Tax = { id: `tax_${Date.now()}`, ...payload, created_at: new Date().toISOString() };
    MOCK_TAXES = [newTax, ...MOCK_TAXES];
    return newTax;
  },

  async updateTax(id: string, payload: UpdateTaxPayload): Promise<Tax> {
    await delay();
    const index = MOCK_TAXES.findIndex((t) => t.id === id);
    if (index === -1) throw new ApiError(404, { code: 'NOT_FOUND', message: 'Tax not found.' });
    const updated: Tax = { ...MOCK_TAXES[index], ...payload };
    MOCK_TAXES[index] = updated;
    return updated;
  },

  // ─── Discounts ───
  async getDiscounts(params?: PaginationParams): Promise<PaginatedResponse<Discount>> {
    await delay();
    return paginate(MOCK_DISCOUNTS, params);
  },

  async createDiscount(payload: CreateDiscountPayload): Promise<Discount> {
    await delay();
    const existing = MOCK_DISCOUNTS.find((d) => d.code.toUpperCase() === payload.code.trim().toUpperCase());
    if (existing) {
      throw new ApiError(422, {
        code: 'VALIDATION_ERROR',
        message: 'A discount with this code already exists.',
        fields: { code: 'Discount code must be unique' },
      });
    }
    const newDiscount: Discount = {
      id: `disc_${Date.now()}`,
      ...payload,
      code: payload.code.trim().toUpperCase(),
      times_used: 0,
      created_at: new Date().toISOString(),
    };
    MOCK_DISCOUNTS = [newDiscount, ...MOCK_DISCOUNTS];
    return newDiscount;
  },

  async updateDiscount(id: string, payload: UpdateDiscountPayload): Promise<Discount> {
    await delay();
    const index = MOCK_DISCOUNTS.findIndex((d) => d.id === id);
    if (index === -1) throw new ApiError(404, { code: 'NOT_FOUND', message: 'Discount not found.' });
    if (payload.code) {
      const duplicate = MOCK_DISCOUNTS.find(
        (d) => d.id !== id && d.code.toUpperCase() === payload.code!.trim().toUpperCase(),
      );
      if (duplicate) {
        throw new ApiError(422, {
          code: 'VALIDATION_ERROR',
          message: 'A discount with this code already exists.',
          fields: { code: 'Discount code must be unique' },
        });
      }
    }
    const updated: Discount = {
      ...MOCK_DISCOUNTS[index],
      ...payload,
      code: payload.code ? payload.code.trim().toUpperCase() : MOCK_DISCOUNTS[index].code,
    };
    MOCK_DISCOUNTS[index] = updated;
    return updated;
  },

  // ─── Customers ───
  async getCustomers(params?: PaginationParams & { search?: string }): Promise<PaginatedResponse<Customer>> {
    await delay();
    let items = MOCK_CUSTOMERS;
    if (params?.search) {
      const q = params.search.toLowerCase();
      items = items.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.company ?? '').toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q),
      );
    }
    return paginate(items, params);
  },

  async createCustomer(payload: CreateCustomerPayload): Promise<Customer> {
    await delay();
    const email = payload.email.toLowerCase().trim();
    if (MOCK_CUSTOMERS.some((c) => c.email === email)) {
      throw new ApiError(422, {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed.',
        fields: { email: 'A customer with this email already exists' },
      });
    }
    const customer: Customer = {
      id: `cust_${Date.now()}`,
      ...payload,
      email,
      created_at: new Date().toISOString(),
    };
    MOCK_CUSTOMERS = [customer, ...MOCK_CUSTOMERS];
    return customer;
  },

  // ─── Subscriptions ───
  async getSubscriptions(
    params?: PaginationParams & { status?: SubscriptionStatus | 'all'; customer_id?: string; search?: string },
  ): Promise<PaginatedResponse<Subscription>> {
    await delay();
    let items = [...MOCK_SUBSCRIPTIONS].sort((a, b) => b.created_at.localeCompare(a.created_at));
    if (params?.status && params.status !== 'all') {
      items = items.filter((s) => s.status === params.status);
    }
    if (params?.customer_id) {
      items = items.filter((s) => s.customer_id === params.customer_id);
    }
    if (params?.search) {
      const q = params.search.toLowerCase();
      items = items.filter(
        (s) =>
          s.number.toLowerCase().includes(q) ||
          (s.customer_name ?? '').toLowerCase().includes(q) ||
          (s.plan_name ?? '').toLowerCase().includes(q),
      );
    }
    return paginate(items, params);
  },

  async getSubscription(id: string): Promise<Subscription> {
    await delay(200);
    const sub = MOCK_SUBSCRIPTIONS.find((s) => s.id === id);
    if (!sub) throw new ApiError(404, { code: 'NOT_FOUND', message: 'Subscription not found.' });
    return sub;
  },

  async createSubscription(payload: CreateSubscriptionPayload, actor: string): Promise<Subscription> {
    await delay(400);
    const customer = MOCK_CUSTOMERS.find((c) => c.id === payload.customer_id);
    if (!customer) {
      throw new ApiError(422, {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed.',
        fields: { customer_id: 'Select a customer' },
      });
    }
    const plan = MOCK_PLANS.find((p) => p.id === payload.plan_id);
    if (!plan || plan.status !== 'active') {
      throw new ApiError(422, {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed.',
        fields: { plan_id: 'Select an active plan' },
      });
    }
    // Availability window (PLN-03)
    if (plan.available_from && payload.start_date < plan.available_from) {
      throw new ApiError(422, {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed.',
        fields: { start_date: `Plan is only available from ${plan.available_from}` },
      });
    }
    if (plan.available_to && payload.start_date > plan.available_to) {
      throw new ApiError(422, {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed.',
        fields: { start_date: `Plan is only available until ${plan.available_to}` },
      });
    }
    if (!payload.lines.length) {
      throw new ApiError(422, {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed.',
        fields: { lines: 'Add at least one line' },
      });
    }
    for (const line of payload.lines) {
      if (line.quantity < (plan.min_quantity ?? 1)) {
        throw new ApiError(422, {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed.',
          fields: { lines: `Minimum quantity for this plan is ${plan.min_quantity ?? 1}` },
        });
      }
    }

    subCounter += 1;
    const sub: Subscription = {
      id: `sub_${subCounter}`,
      number: nextSubNumber(),
      customer_id: customer.id,
      customer_name: customer.company ?? customer.name,
      plan_id: plan.id,
      plan_name: plan.name,
      status: 'draft',
      start_date: payload.start_date,
      expiry_date: addPeriod(payload.start_date, plan.billing_interval, plan.interval_count),
      next_billing_date: payload.start_date,
      payment_terms: payload.payment_terms,
      lines: payload.lines.map((line, i) => {
        const product = MOCK_PRODUCTS.find((p) => p.id === line.product_id)!;
        const variant = line.variant_id ? product.variants?.find((v) => v.id === line.variant_id) : undefined;
        return {
          id: `subl_sub_${subCounter}_${i}`,
          product_id: line.product_id,
          product_name: product.name,
          variant_id: line.variant_id ?? null,
          variant_label: variant ? `${variant.attribute}: ${variant.value}` : undefined,
          quantity: line.quantity,
          unit_price: getUnitPrice(product, line.variant_id),
          tax_id: line.tax_id ?? product.tax_id ?? null,
        };
      }),
      history: [
        {
          id: `hist_sub_${subCounter}_0`,
          from_status: null,
          to_status: 'draft',
          changed_by: actor,
          changed_at: new Date().toISOString(),
        },
      ],
      created_at: new Date().toISOString(),
    };
    MOCK_SUBSCRIPTIONS = [sub, ...MOCK_SUBSCRIPTIONS];
    return sub;
  },

  async transitionSubscription(id: string, action: SubscriptionAction, actor: string): Promise<Subscription> {
    await delay(250);
    const today = todayIST();
    const sub = MOCK_SUBSCRIPTIONS.find((s) => s.id === id);
    if (!sub) throw new ApiError(404, { code: 'NOT_FOUND', message: 'Subscription not found.' });
    const plan = MOCK_PLANS.find((p) => p.id === sub.plan_id);

    let to: SubscriptionStatus;
    switch (action) {
      case 'confirm':
        if (sub.status === 'draft') to = 'quotation';
        else if (sub.status === 'quotation') {
          // Expired quotations can't be confirmed (D10)
          if (sub.quotation_expires_at && sub.quotation_expires_at < today) {
            throw new ApiError(422, {
              code: 'QUOTATION_EXPIRED',
              message: 'This quotation has expired. Edit and renew it before confirming.',
            });
          }
          to = 'confirmed';
        } else {
          throw new ApiError(422, {
            code: 'INVALID_TRANSITION',
            message: `Cannot confirm a subscription in ${sub.status} status.`,
          });
        }
        break;
      case 'activate':
        if (sub.status !== 'confirmed') {
          throw new ApiError(422, {
            code: 'INVALID_TRANSITION',
            message: 'Only confirmed subscriptions can be activated.',
          });
        }
        if (sub.start_date > today) {
          throw new ApiError(422, {
            code: 'START_DATE_IN_FUTURE',
            message: 'Start date has not been reached yet.',
          });
        }
        to = 'active';
        break;
      case 'pause':
        if (sub.status !== 'active') {
          throw new ApiError(422, { code: 'INVALID_TRANSITION', message: 'Only active subscriptions can be paused.' });
        }
        if (!plan?.pausable) {
          throw new ApiError(422, { code: 'PLAN_NOT_PAUSABLE', message: 'This plan does not allow pausing.' });
        }
        to = 'paused';
        break;
      case 'resume':
        if (sub.status !== 'paused') {
          throw new ApiError(422, { code: 'INVALID_TRANSITION', message: 'Only paused subscriptions can be resumed.' });
        }
        to = 'active';
        break;
      case 'close':
        if (sub.status !== 'active' && sub.status !== 'paused') {
          throw new ApiError(422, { code: 'INVALID_TRANSITION', message: 'Only active or paused subscriptions can be closed early.' });
        }
        if (!plan?.closable) {
          throw new ApiError(422, { code: 'PLAN_NOT_CLOSABLE', message: 'This plan does not allow closing early.' });
        }
        to = 'closed';
        break;
      case 'renew':
        if (sub.status !== 'closed') {
          throw new ApiError(422, { code: 'INVALID_TRANSITION', message: 'Only closed subscriptions can be renewed.' });
        }
        if (!plan?.renewable) {
          throw new ApiError(422, { code: 'PLAN_NOT_RENEWABLE', message: 'This plan is not renewable.' });
        }
        to = 'active';
        sub.start_date = sub.expiry_date;
        sub.expiry_date = addPeriod(sub.start_date, plan.billing_interval, plan.interval_count);
        sub.next_billing_date = sub.start_date;
        break;
    }

    const prev = sub.status;
    sub.status = to;
    sub.history.push({
      id: `hist_${sub.id}_${sub.history.length}`,
      from_status: prev,
      to_status: to,
      changed_by: actor,
      changed_at: new Date().toISOString(),
    });
    return sub;
  },

  // ─── Billing ───
  async runBilling(actor: string): Promise<BillingRunSummary> {
    await delay(600);
    const today = todayIST();
    const summary: BillingRunSummary = { created: 0, skipped: 0, failed: 0, invoice_numbers: [] };

    // Housekeeping (D9): activate confirmed subs past start date, auto-close expired
    for (const sub of MOCK_SUBSCRIPTIONS) {
      const plan = MOCK_PLANS.find((p) => p.id === sub.plan_id);
      if (sub.status === 'confirmed' && sub.start_date <= today) {
        sub.status = 'active';
        sub.history.push({
          id: `hist_${sub.id}_${sub.history.length}`,
          from_status: 'confirmed',
          to_status: 'active',
          changed_by: 'system',
          changed_at: new Date().toISOString(),
        });
      }
      if (sub.status === 'active' && plan?.auto_close && sub.expiry_date < today) {
        sub.status = 'closed';
        sub.history.push({
          id: `hist_${sub.id}_${sub.history.length}`,
          from_status: 'active',
          to_status: 'closed',
          changed_by: 'system',
          changed_at: new Date().toISOString(),
        });
      }
    }

    for (const sub of MOCK_SUBSCRIPTIONS) {
      if (sub.status !== 'active') continue;
      if (sub.next_billing_date > today) {
        summary.skipped += 1;
        continue;
      }
      const key = `${sub.id}:${sub.next_billing_date}`;
      const plan = MOCK_PLANS.find((p) => p.id === sub.plan_id)!;
      try {
        if (invoiceKeys.has(key)) {
          summary.skipped += 1;
          continue;
        }
        const computed = computeInvoice(sub, sub.next_billing_date);
        const terms = PAYMENT_TERMS_DAYS[sub.payment_terms];
        const inv = createSeedInvoice(
          sub,
          computed,
          'draft',
          today,
          addDays(today, terms),
          sub.next_billing_date,
          '0.00',
        );
        inv.number = nextInvNumber();
        invoiceKeys.add(key);
        summary.created += 1;
        summary.invoice_numbers.push(inv.number);
        // Advance billing date in the same "transaction" (INV-04)
        sub.next_billing_date = addPeriod(
          sub.next_billing_date,
          plan.billing_interval,
          plan.interval_count,
        );
      } catch {
        summary.failed += 1;
      }
    }
    void actor;
    return summary;
  },

  // ─── Invoices ───
  async getInvoices(
    params?: PaginationParams & {
      status?: InvoiceStatus | 'all';
      overdue?: boolean;
      customer_id?: string;
      subscription_id?: string;
      search?: string;
    },
  ): Promise<PaginatedResponse<Invoice>> {
    await delay();
    const today = todayIST();
    let items = [...MOCK_INVOICES].sort((a, b) => b.issue_date.localeCompare(a.issue_date));
    if (params?.status && params.status !== 'all') {
      items = items.filter((i) => i.status === params.status);
    }
    if (params?.overdue) {
      items = items.filter(
        (i) => i.status === 'confirmed' && new Decimal(i.total).minus(i.amount_paid).gt(0) && i.due_date < today,
      );
    }
    if (params?.customer_id) items = items.filter((i) => i.customer_id === params.customer_id);
    if (params?.subscription_id) items = items.filter((i) => i.subscription_id === params.subscription_id);
    if (params?.search) {
      const q = params.search.toLowerCase();
      items = items.filter(
        (i) =>
          i.number.toLowerCase().includes(q) ||
          (i.customer_name ?? '').toLowerCase().includes(q) ||
          (i.subscription_number ?? '').toLowerCase().includes(q),
      );
    }
    return paginate(items, params);
  },

  async getInvoice(id: string): Promise<Invoice> {
    await delay(200);
    const inv = MOCK_INVOICES.find((i) => i.id === id);
    if (!inv) throw new ApiError(404, { code: 'NOT_FOUND', message: 'Invoice not found.' });
    return inv;
  },

  async transitionInvoice(id: string, action: 'confirm' | 'cancel'): Promise<Invoice> {
    await delay(250);
    const inv = MOCK_INVOICES.find((i) => i.id === id);
    if (!inv) throw new ApiError(404, { code: 'NOT_FOUND', message: 'Invoice not found.' });
    if (action === 'confirm') {
      if (inv.status !== 'draft') {
        throw new ApiError(422, { code: 'INVALID_TRANSITION', message: 'Only draft invoices can be confirmed.' });
      }
      inv.status = 'confirmed';
    } else {
      if (inv.status !== 'draft' && inv.status !== 'confirmed') {
        throw new ApiError(422, { code: 'INVALID_TRANSITION', message: 'Only draft or confirmed invoices can be cancelled.' });
      }
      if (new Decimal(inv.amount_paid).gt(0)) {
        throw new ApiError(422, {
          code: 'HAS_PAYMENTS',
          message: 'Invoices with recorded payments cannot be cancelled.',
        });
      }
      inv.status = 'cancelled';
    }
    return inv;
  },

  // ─── Payments ───
  async getPayments(params?: PaginationParams & { invoice_id?: string; customer_id?: string }): Promise<PaginatedResponse<Payment>> {
    await delay();
    let items = [...MOCK_PAYMENTS].sort((a, b) => b.payment_date.localeCompare(a.payment_date));
    if (params?.invoice_id) items = items.filter((p) => p.invoice_id === params.invoice_id);
    if (params?.customer_id) {
      const invoiceCustomer = new Map(MOCK_INVOICES.map((i) => [i.id, i.customer_id]));
      items = items.filter((p) => invoiceCustomer.get(p.invoice_id) === params.customer_id);
    }
    return paginate(items, params);
  },

  async recordPayment(invoiceId: string, payload: RecordPaymentPayload, actor: string): Promise<Payment> {
    await delay(300);
    const inv = MOCK_INVOICES.find((i) => i.id === invoiceId);
    if (!inv) throw new ApiError(404, { code: 'NOT_FOUND', message: 'Invoice not found.' });
    if (inv.status === 'draft' || inv.status === 'cancelled') {
      throw new ApiError(422, {
        code: 'INVALID_INVOICE_STATUS',
        message: `Payments cannot be recorded against a ${inv.status} invoice.`,
      });
    }
    const amount = new Decimal(payload.amount);
    if (amount.lte(0)) {
      throw new ApiError(422, {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed.',
        fields: { amount: 'Payment must be above zero' },
      });
    }
    const balance = new Decimal(inv.total).minus(inv.amount_paid);
    if (amount.gt(balance)) {
      throw new ApiError(422, {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed.',
        fields: { amount: `Payment exceeds the outstanding balance of ₹${balance.toFixed(2)}` },
      });
    }

    const payment: Payment = {
      id: `pay_${Date.now()}`,
      invoice_id: invoiceId,
      invoice_number: inv.number,
      method: payload.method,
      amount: amount.toFixed(2),
      payment_date: payload.payment_date,
      note: payload.note ?? '',
      recorded_by: actor,
    };
    MOCK_PAYMENTS.push(payment);
    inv.amount_paid = new Decimal(inv.amount_paid).plus(amount).toFixed(2);
    if (new Decimal(inv.amount_paid).gte(inv.total)) {
      inv.status = 'paid';
    }
    return payment;
  },

  // ─── Reports ───
  async getReportSummary(): Promise<ReportSummary> {
    await delay(250);
    const today = todayIST();
    const active = MOCK_SUBSCRIPTIONS.filter((s) => s.status === 'active').length;
    const revenueCollected = MOCK_PAYMENTS
      .reduce((acc, p) => acc.plus(p.amount), new Decimal(0))
      .toFixed(2);
    const live = MOCK_INVOICES.filter((i) => i.status === 'confirmed' || i.status === 'paid');
    const outstanding = live
      .reduce((acc, i) => acc.plus(new Decimal(i.total).minus(i.amount_paid)), new Decimal(0))
      .toFixed(2);
    const overdue = MOCK_INVOICES.filter(
      (i) => i.status === 'confirmed' && new Decimal(i.total).minus(i.amount_paid).gt(0) && i.due_date < today,
    );
    const overdueAmount = overdue
      .reduce((acc, i) => acc.plus(new Decimal(i.total).minus(i.amount_paid)), new Decimal(0))
      .toFixed(2);
    return {
      active_subscriptions: active,
      revenue_collected: revenueCollected,
      outstanding,
      overdue_count: overdue.length,
      overdue_amount: overdueAmount,
    };
  },

  async getOverdueInvoices(): Promise<OverdueInvoice[]> {
    await delay(250);
    const today = todayIST();
    return MOCK_INVOICES.filter(
      (i) => i.status === 'confirmed' && new Decimal(i.total).minus(i.amount_paid).gt(0) && i.due_date < today,
    )
      .map((i) => {
        const customer = MOCK_CUSTOMERS.find((c) => c.id === i.customer_id);
        return {
          ...i,
          days_overdue: daysBetween(i.due_date, today),
          customer_email: customer?.email,
          customer_phone: customer?.phone,
        };
      })
      .sort((a, b) => b.days_overdue - a.days_overdue);
  },

  // ─── Portal (object-level scoping via user.customer_id, D8) ───
  async getPortalSubscriptions(customerId: string | null | undefined, params?: PaginationParams): Promise<PaginatedResponse<Subscription>> {
    await delay();
    const items = MOCK_SUBSCRIPTIONS.filter((s) => s.customer_id === customerId);
    return paginate(items, params);
  },

  async getPortalInvoices(customerId: string | null | undefined, params?: PaginationParams): Promise<PaginatedResponse<Invoice>> {
    await delay();
    const items = MOCK_INVOICES.filter(
      (i) => i.customer_id === customerId && i.status !== 'draft',
    );
    return paginate(items, params);
  },
};

/** Check if mocks are enabled */
export function isMockEnabled(): boolean {
  return import.meta.env.VITE_USE_MOCKS === 'true';
}

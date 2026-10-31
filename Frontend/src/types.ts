// ─── Shared types — mirror of the live API wire format (docs/api-contract.md) ───
// Entities = camelCase (what GET endpoints return). Mutation payloads = snake_case
// (what our Nest DTOs accept). Money is ALWAYS a 2-decimal string (D4).

export type Role = 'admin' | 'staff' | 'customer';

export interface User {
  id: number;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
  /** Portal users link to a customer record — object-level auth (D8) */
  customerId: number | null;
  createdAt?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

export interface PaginationParams {
  page?: number;
  page_size?: number;
}

/** Standard API error shape from the backend */
export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    fields?: Record<string, string>;
  };
}

/** Auth payloads */
export interface LoginPayload {
  email: string;
  password: string;
}

export interface SignupPayload {
  name: string;
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: {
    id: number;
    role: Role;
    customerId: number | null;
  };
}

// ─── Catalog ────────────────────────────────────────────────────────────────

export interface ProductVariant {
  id: number;
  productId: number;
  attribute: string; // e.g. "Brand"
  value: string; // e.g. "Odoo"
  priceExtra: string; // e.g. "560.00"
}

export interface Product {
  id: number;
  name: string;
  type: string;
  salesPrice: string;
  costPrice: string;
  notes: string | null;
  taxId: number | null;
  isActive: boolean;
  variants: ProductVariant[];
  tax?: { id: number; name: string; percentage: string; isActive: boolean } | null;
}

export interface Plan {
  id: number;
  name: string;
  price: string; // informational — totals compute from lines (D2)
  billingPeriod: 'daily' | 'weekly' | 'monthly' | 'yearly';
  minQuantity: number;
  availableFrom: string;
  availableTo: string;
  autoClose: boolean;
  closable: boolean;
  pausable: boolean;
  renewable: boolean;
  isActive: boolean;
}

export interface Tax {
  id: number;
  name: string;
  percentage: string;
  isActive: boolean;
}

export interface Discount {
  id: number;
  name: string;
  type: 'percentage' | 'fixed';
  value: string;
  minPurchase: string;
  minQuantity: number;
  startDate: string;
  endDate: string;
  maxUses: number; // 0 = unlimited
  timesUsed: number;
  scope: 'product' | 'subscription';
  isActive: boolean;
  products?: { discountId: number; productId: number }[];
}

// ─── Catalog mutation payloads (snake_case — matches the Nest DTOs) ─────────

export interface CreateProductPayload {
  name: string;
  type: string;
  sales_price: string;
  cost_price: string;
  notes?: string | undefined;
  tax_id?: number | undefined;
  variants?: { attribute: string; value: string; price_extra: string }[];
}
export type UpdateProductPayload = Partial<CreateProductPayload> & { sales_price?: string };

export interface CreatePlanPayload {
  name: string;
  price: string;
  billing_period: Plan['billingPeriod'];
  min_quantity: number;
  available_from: string;
  available_to: string;
  auto_close?: boolean;
  closable?: boolean;
  pausable?: boolean;
  renewable?: boolean;
}
export type UpdatePlanPayload = Partial<CreatePlanPayload>;

export interface CreateTaxPayload {
  name: string;
  percentage: number;
  is_active?: boolean;
}
export type UpdateTaxPayload = Partial<CreateTaxPayload>;

export interface CreateDiscountPayload {
  name: string;
  type: 'percentage' | 'fixed';
  value: string;
  min_purchase?: string;
  min_quantity?: number;
  start_date: string;
  end_date: string;
  max_uses?: number;
  scope: 'product' | 'subscription';
  product_ids?: number[];
  is_active?: boolean;
}
export type UpdateDiscountPayload = Partial<CreateDiscountPayload>;

// ─── Customers ──────────────────────────────────────────────────────────────

export interface CustomerInvoiceSummary {
  id: number;
  number: string;
  status: 'draft' | 'confirmed' | 'paid' | 'cancelled';
  total: string;
  amountPaid: string;
}

export interface CustomerSubscriptionSummary {
  id: number;
  number: string;
  status: 'draft' | 'quotation' | 'confirmed' | 'active' | 'paused' | 'closed';
  startDate: string;
  expiryDate: string;
}

export interface Customer {
  id: number;
  name: string;
  company: string | null;
  email: string;
  phone: string | null;
  billingAddress: string | null;
  taxId: string | null;
  /** present on GET /customers/:id (CUS-03) */
  subscriptions?: CustomerSubscriptionSummary[];
  invoices?: CustomerInvoiceSummary[];
  outstanding?: string;
}

export interface CreateCustomerPayload {
  name: string;
  email: string;
  company?: string;
  phone?: string;
  billing_address?: string;
  tax_id?: string;
}
export type UpdateCustomerPayload = Partial<CreateCustomerPayload>;

// ─── Users (admin) ──────────────────────────────────────────────────────────

export interface CreateUserPayload {
  name: string;
  email: string;
  password: string;
  role?: 'staff' | 'admin';
}

export interface UpdateUserPayload {
  name?: string;
  is_active?: boolean;
}

// ─── Subscriptions ──────────────────────────────────────────────────────────

export type SubscriptionStatus =
  | 'draft'
  | 'quotation'
  | 'confirmed'
  | 'active'
  | 'paused'
  | 'closed';

/** UX labels for payment terms — mapped to days in the payload builder. */
export type PaymentTerms = 'immediate' | 'net_15' | 'net_30';

export const PAYMENT_TERMS_DAYS: Record<PaymentTerms, number> = {
  immediate: 0,
  net_15: 15,
  net_30: 30,
};

export interface SubscriptionLine {
  id: number;
  productId: number;
  variantId: number | null;
  quantity: number;
  unitPrice: string; // product salesPrice + variant extra
  taxId: number | null;
  /** present on detail endpoints — used to render the variant label */
  product?: { id: number; name: string; type: string; variants?: ProductVariant[] };
}

export interface StatusHistoryEntry {
  id: number;
  subscriptionId: number;
  fromStatus: SubscriptionStatus;
  toStatus: SubscriptionStatus;
  changedBy: number | null;
  changedAt: string;
}

export interface Subscription {
  id: number;
  number: string; // SUB-000123
  customerId: number;
  planId: number;
  status: SubscriptionStatus;
  startDate: string;
  expiryDate: string; // start + 1 billing period (D3)
  nextBillingDate: string;
  paymentTermsDays: number;
  createdBy: number | null;
  lines: SubscriptionLine[];
  /** present on list + detail endpoints */
  plan?: Plan;
  customer?: { id: number; name: string; company: string | null; email: string };
  history?: StatusHistoryEntry[];
  /** staff detail also carries related invoices */
  invoices?: { id: number; number: string; status: 'draft' | 'confirmed' | 'paid' | 'cancelled'; total: string }[];
}

export interface CreateSubscriptionPayload {
  customer_id: number;
  plan_id: number;
  start_date: string;
  payment_terms_days?: number;
  lines: Array<{
    product_id: number;
    variant_id?: number | null;
    quantity: number;
    tax_id?: number | null;
  }>;
}

export type SubscriptionAction = 'quotation' | 'confirm' | 'activate' | 'pause' | 'resume' | 'close';

// ─── Invoices ───────────────────────────────────────────────────────────────

export type InvoiceStatus = 'draft' | 'confirmed' | 'paid' | 'cancelled';

export interface InvoiceLine {
  id: number;
  invoiceId: number;
  productId: number | null;
  description: string;
  quantity: number;
  unitPrice: string;
  discountAmount: string;
  discountName: string | null;
  taxAmount: string;
  lineTotal: string;
}

export interface InvoicePayment {
  id: number;
  invoiceId: number;
  method: 'cash' | 'card' | 'upi' | 'bank_transfer' | 'cheque';
  amount: string;
  paymentDate: string;
  note: string | null;
  recordedBy: number | null;
}

export interface Invoice {
  id: number;
  number: string; // INV-000123
  subscriptionId: number;
  customerId: number;
  status: InvoiceStatus;
  periodStart: string;
  periodEnd: string;
  issueDate: string;
  dueDate: string;
  subtotal: string;
  discountTotal: string;
  taxTotal: string;
  total: string;
  amountPaid: string;
  /** computed server-side (D5) */
  overdue?: boolean;
  lines: InvoiceLine[];
  /** present on detail endpoints */
  payments?: InvoicePayment[];
  customer?: { id: number; name: string; company: string | null; email: string };
  subscription?: { id: number; number: string };
}

export interface RecordPaymentPayload {
  method: InvoicePayment['method'];
  amount: string;
  date: string;
  note?: string;
}

export interface BillingRunSummary {
  status?: 'ok' | 'already_running';
  run_id: number | null;
  created: number;
  skipped: number;
  failed: number;
  activated: number;
  auto_closed: number;
}

// ─── Reports ────────────────────────────────────────────────────────────────

/** GET /reports/summary — snake_case as the API returns it */
export interface ReportSummary {
  active_subscriptions: number;
  revenue_collected: string;
  outstanding: string;
  overdue_count: number;
  overdue_amount: string;
}

/** GET /reports/overdue item — snake_case fields as returned */
export interface OverdueInvoice {
  id: number;
  number: string;
  customer: { id: number; name: string; company: string | null; email: string; phone: string | null };
  subscription_number: string | null;
  total: string;
  amount_paid: string;
  balance: string;
  due_date: string;
  days_overdue: number;
  overdue: boolean;
}

/** GET /payments item */
export interface Payment {
  id: number;
  invoiceId: number;
  method: 'cash' | 'card' | 'upi' | 'bank_transfer' | 'cheque';
  amount: string;
  paymentDate: string;
  note: string | null;
  recordedBy: number | null;
  invoice?: {
    id: number;
    number: string;
    customerId: number;
    customer: { id: number; name: string; company: string | null };
  };
}

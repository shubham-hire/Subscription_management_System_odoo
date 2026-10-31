// ─── Shared types used across the entire application ───

export type Role = 'admin' | 'staff' | 'customer';

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  /** Portal users link to a customer record — object-level auth (D8) */
  customer_id?: string | null;
  is_active?: boolean;
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
  access_token: string;
  user: User;
}

// ─── Catalog Domain Types ───

export interface ProductVariant {
  id: string;
  product_id: string;
  attribute: string; // e.g. "Brand"
  value: string; // e.g. "Odoo"
  price_extra: string; // e.g. "560.00"
}

export interface Product {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'closed';
  /** Effective unit price = sales_price + selected variant price_extra (PRD-03) */
  sales_price?: string;
  cost_price?: string;
  tax_id?: string | null;
  variants?: ProductVariant[];
  created_at: string;
}

export interface Plan {
  id: string;
  product_id: string;
  product_name?: string;
  name: string;
  billing_interval: 'day' | 'week' | 'month' | 'year';
  interval_count: number;
  /** Informational — totals compute from subscription lines (D2) */
  price: string;
  trial_days: number;
  min_quantity?: number;
  auto_close?: boolean;
  closable?: boolean;
  pausable?: boolean;
  renewable?: boolean;
  available_from?: string | null;
  available_to?: string | null;
  status: 'active' | 'paused' | 'closed';
  created_at: string;
}

export interface Tax {
  id: string;
  name: string;
  rate: string; // e.g. "18.00"
  is_inclusive: boolean;
  status: 'active' | 'closed';
  created_at: string;
}

export interface Discount {
  id: string;
  code: string;
  name: string;
  type: 'percentage' | 'fixed';
  value: string; // e.g. "20.00" or "500.00"
  /** 'subscription' = whole subscription (pro-rata), 'product' = specific products */
  scope?: 'product' | 'subscription';
  product_ids?: string[];
  min_purchase?: string;
  min_quantity?: number;
  start_date?: string | null;
  end_date?: string | null;
  max_uses?: number | null;
  times_used?: number;
  status: 'active' | 'closed';
  created_at: string;
}

// ─── Catalog Mutation Payloads ───

export type CreateProductPayload = Omit<Product, 'id' | 'created_at'>;
export type UpdateProductPayload = Partial<CreateProductPayload>;

export type CreatePlanPayload = Omit<Plan, 'id' | 'created_at' | 'product_name'>;
export type UpdatePlanPayload = Partial<CreatePlanPayload>;

export type CreateTaxPayload = Omit<Tax, 'id' | 'created_at'>;
export type UpdateTaxPayload = Partial<CreateTaxPayload>;

export type CreateDiscountPayload = Omit<Discount, 'id' | 'created_at'>;
export type UpdateDiscountPayload = Partial<CreateDiscountPayload>;

// ─── Customers ───

export interface Customer {
  id: string;
  name: string;
  company?: string;
  email: string;
  phone?: string;
  billing_address?: string;
  tax_id?: string;
  created_at: string;
}

export type CreateCustomerPayload = Omit<Customer, 'id' | 'created_at'>;

// ─── Subscriptions ───

export type SubscriptionStatus =
  | 'draft'
  | 'quotation'
  | 'confirmed'
  | 'active'
  | 'paused'
  | 'closed';

export type PaymentTerms = 'immediate' | 'net_15' | 'net_30';

export const PAYMENT_TERMS_DAYS: Record<PaymentTerms, number> = {
  immediate: 0,
  net_15: 15,
  net_30: 30,
};

export interface SubscriptionLine {
  id: string;
  product_id: string;
  product_name?: string;
  variant_id?: string | null;
  variant_label?: string;
  quantity: number;
  unit_price: string; // product sales_price + variant extra
  tax_id?: string | null;
}

export interface StatusHistoryEntry {
  id: string;
  from_status: SubscriptionStatus | null;
  to_status: SubscriptionStatus;
  changed_by: string;
  changed_at: string;
}

export interface Subscription {
  id: string;
  number: string; // SUB-000123
  customer_id: string;
  customer_name?: string;
  plan_id: string;
  plan_name?: string;
  status: SubscriptionStatus;
  start_date: string;
  expiry_date: string; // start + 1 billing period (D3)
  next_billing_date: string;
  payment_terms: PaymentTerms;
  lines: SubscriptionLine[];
  history: StatusHistoryEntry[];
  quotation_expires_at?: string | null;
  created_at: string;
}

export interface CreateSubscriptionPayload {
  customer_id: string;
  plan_id: string;
  start_date: string;
  payment_terms: PaymentTerms;
  lines: Array<{
    product_id: string;
    variant_id?: string | null;
    quantity: number;
    tax_id?: string | null;
  }>;
}

export type SubscriptionAction =
  | 'confirm'
  | 'activate'
  | 'pause'
  | 'resume'
  | 'close'
  | 'renew';

// ─── Invoices ───

export type InvoiceStatus = 'draft' | 'confirmed' | 'paid' | 'cancelled';

export interface InvoiceLine {
  id: string;
  product_id: string;
  description: string;
  quantity: number;
  unit_price: string;
  discount_amount: string;
  discount_name?: string;
  tax_rate: string;
  tax_amount: string;
  line_total: string; // subtotal - discount + tax
}

export interface Invoice {
  id: string;
  number: string; // INV-000123
  subscription_id: string;
  subscription_number?: string;
  customer_id: string;
  customer_name?: string;
  status: InvoiceStatus;
  period_start: string;
  period_end: string;
  issue_date: string;
  due_date: string;
  subtotal: string;
  discount_total: string;
  tax_total: string;
  total: string;
  amount_paid: string;
  lines: InvoiceLine[];
}

export interface Payment {
  id: string;
  invoice_id: string;
  invoice_number?: string;
  method: 'cash' | 'card' | 'upi' | 'bank_transfer' | 'cheque';
  amount: string;
  payment_date: string;
  note?: string;
  recorded_by: string;
}

export interface RecordPaymentPayload {
  method: Payment['method'];
  amount: string;
  payment_date: string;
  note?: string;
}

export interface BillingRunSummary {
  created: number;
  skipped: number;
  failed: number;
  invoice_numbers: string[];
}

// ─── Reports ───

export interface ReportSummary {
  active_subscriptions: number;
  revenue_collected: string;
  outstanding: string;
  overdue_count: number;
  overdue_amount: string;
}

export interface OverdueInvoice extends Invoice {
  days_overdue: number;
  customer_email?: string;
  customer_phone?: string;
}

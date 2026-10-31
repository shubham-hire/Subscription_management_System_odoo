import { apiClient } from '@/api/client';
import type {
  Customer,
  Subscription,
  SubscriptionAction,
  SubscriptionStatus,
  Invoice,
  InvoiceStatus,
  Payment,
  RecordPaymentPayload,
  BillingRunSummary,
  ReportSummary,
  OverdueInvoice,
  User,
  PaginatedResponse,
  PaginationParams,
  CreateCustomerPayload,
  CreateSubscriptionPayload,
} from '@/types';

function buildQuery(params?: object): string {
  if (!params) return '';
  const search = new URLSearchParams();
  Object.entries(params as Record<string, unknown>).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') search.set(k, String(v));
  });
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

// ─── Users (admin) ───

export async function getUsers(params?: PaginationParams): Promise<PaginatedResponse<User>> {
  return apiClient<PaginatedResponse<User>>(`/users${buildQuery(params)}`);
}

export async function createStaff(payload: { name: string; email: string; password: string }): Promise<User> {
  return apiClient<User>('/users', { method: 'POST', body: JSON.stringify(payload) });
}

// ─── Customers ───

export async function getCustomers(
  params?: PaginationParams & { search?: string },
): Promise<PaginatedResponse<Customer>> {
  return apiClient<PaginatedResponse<Customer>>(`/customers${buildQuery(params)}`);
}

export async function createCustomer(payload: CreateCustomerPayload): Promise<Customer> {
  return apiClient<Customer>('/customers', { method: 'POST', body: JSON.stringify(payload) });
}

// ─── Subscriptions ───

export async function getSubscriptions(
  params?: PaginationParams & { status?: SubscriptionStatus | 'all'; customer_id?: number; search?: string },
): Promise<PaginatedResponse<Subscription>> {
  return apiClient<PaginatedResponse<Subscription>>(`/subscriptions${buildQuery(params)}`);
}

export async function getSubscription(id: number): Promise<Subscription> {
  return apiClient<Subscription>(`/subscriptions/${id}`);
}

export async function createSubscription(payload: CreateSubscriptionPayload): Promise<Subscription> {
  return apiClient<Subscription>('/subscriptions', { method: 'POST', body: JSON.stringify(payload) });
}

export async function transitionSubscription(id: number, action: SubscriptionAction): Promise<Subscription> {
  return apiClient<Subscription>(`/subscriptions/${id}/${action}`, { method: 'POST' });
}

// ─── Billing & Invoices ───

export async function runBilling(): Promise<BillingRunSummary> {
  return apiClient<BillingRunSummary>('/billing/run', { method: 'POST' });
}

export async function getInvoices(
  params?: PaginationParams & {
    status?: InvoiceStatus | 'all';
    overdue?: boolean;
    customer_id?: number;
    subscription_id?: number;
    search?: string;
  },
): Promise<PaginatedResponse<Invoice>> {
  return apiClient<PaginatedResponse<Invoice>>(`/invoices${buildQuery(params)}`);
}

export async function getInvoice(id: number): Promise<Invoice> {
  return apiClient<Invoice>(`/invoices/${id}`);
}

export async function transitionInvoice(id: number, action: 'confirm' | 'cancel'): Promise<Invoice> {
  return apiClient<Invoice>(`/invoices/${id}/${action}`, { method: 'POST' });
}

// ─── Payments ───

export async function getPayments(
  params?: PaginationParams & { invoice_id?: number; customer_id?: number },
): Promise<PaginatedResponse<Payment>> {
  return apiClient<PaginatedResponse<Payment>>(`/payments${buildQuery(params)}`);
}

export async function recordPayment(invoiceId: number, payload: RecordPaymentPayload): Promise<Payment> {
  return apiClient<Payment>(`/invoices/${invoiceId}/payments`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// ─── Reports ───

export async function getReportSummary(): Promise<ReportSummary> {
  return apiClient<ReportSummary>('/reports/summary');
}

export async function getOverdueInvoices(): Promise<PaginatedResponse<OverdueInvoice>> {
  return apiClient<PaginatedResponse<OverdueInvoice>>('/reports/overdue');
}

// ─── Portal (customer-scoped by the backend via the JWT) ───

export async function getPortalSubscriptions(params?: PaginationParams): Promise<PaginatedResponse<Subscription>> {
  return apiClient<PaginatedResponse<Subscription>>(`/portal/subscriptions${buildQuery(params)}`);
}

export async function getPortalInvoices(params?: PaginationParams): Promise<PaginatedResponse<Invoice>> {
  return apiClient<PaginatedResponse<Invoice>>(`/portal/invoices${buildQuery(params)}`);
}


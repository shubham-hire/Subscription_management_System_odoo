import { apiClient, getToken } from '@/api/client';
import { mockHandlers, isMockEnabled } from '@/api/mocks';
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

function actorName(): string {
  try {
    const token = getToken();
    if (!token) return 'unknown';
    const payload = JSON.parse(atob(token.split('.')[1])) as { email?: string };
    return payload.email ?? 'unknown';
  } catch {
    return 'unknown';
  }
}

// ─── Users (admin) ───

export async function getUsers(params?: PaginationParams): Promise<PaginatedResponse<User>> {
  if (isMockEnabled()) return mockHandlers.getUsers(params);
  return apiClient<PaginatedResponse<User>>(`/users${buildQuery(params)}`);
}

export async function createStaff(payload: { name: string; email: string; password: string }): Promise<User> {
  if (isMockEnabled()) return mockHandlers.createStaff(payload);
  return apiClient<User>('/users', { method: 'POST', body: JSON.stringify(payload) });
}

// ─── Customers ───

export async function getCustomers(
  params?: PaginationParams & { search?: string },
): Promise<PaginatedResponse<Customer>> {
  if (isMockEnabled()) return mockHandlers.getCustomers(params);
  return apiClient<PaginatedResponse<Customer>>(`/customers${buildQuery(params)}`);
}

export async function createCustomer(payload: CreateCustomerPayload): Promise<Customer> {
  if (isMockEnabled()) return mockHandlers.createCustomer(payload);
  return apiClient<Customer>('/customers', { method: 'POST', body: JSON.stringify(payload) });
}

// ─── Subscriptions ───

export async function getSubscriptions(
  params?: PaginationParams & { status?: SubscriptionStatus | 'all'; customer_id?: string; search?: string },
): Promise<PaginatedResponse<Subscription>> {
  if (isMockEnabled()) return mockHandlers.getSubscriptions(params);
  return apiClient<PaginatedResponse<Subscription>>(`/subscriptions${buildQuery(params)}`);
}

export async function getSubscription(id: string): Promise<Subscription> {
  if (isMockEnabled()) return mockHandlers.getSubscription(id);
  return apiClient<Subscription>(`/subscriptions/${id}`);
}

export async function createSubscription(payload: CreateSubscriptionPayload): Promise<Subscription> {
  if (isMockEnabled()) return mockHandlers.createSubscription(payload, actorName());
  return apiClient<Subscription>('/subscriptions', { method: 'POST', body: JSON.stringify(payload) });
}

export async function transitionSubscription(id: string, action: SubscriptionAction): Promise<Subscription> {
  if (isMockEnabled()) return mockHandlers.transitionSubscription(id, action, actorName());
  return apiClient<Subscription>(`/subscriptions/${id}/${action}`, { method: 'POST' });
}

// ─── Billing & Invoices ───

export async function runBilling(): Promise<BillingRunSummary> {
  if (isMockEnabled()) return mockHandlers.runBilling(actorName());
  return apiClient<BillingRunSummary>('/billing/run', { method: 'POST' });
}

export async function getInvoices(
  params?: PaginationParams & {
    status?: InvoiceStatus | 'all';
    overdue?: boolean;
    customer_id?: string;
    subscription_id?: string;
    search?: string;
  },
): Promise<PaginatedResponse<Invoice>> {
  if (isMockEnabled()) return mockHandlers.getInvoices(params);
  return apiClient<PaginatedResponse<Invoice>>(`/invoices${buildQuery(params)}`);
}

export async function getInvoice(id: string): Promise<Invoice> {
  if (isMockEnabled()) return mockHandlers.getInvoice(id);
  return apiClient<Invoice>(`/invoices/${id}`);
}

export async function transitionInvoice(id: string, action: 'confirm' | 'cancel'): Promise<Invoice> {
  if (isMockEnabled()) return mockHandlers.transitionInvoice(id, action);
  return apiClient<Invoice>(`/invoices/${id}/${action}`, { method: 'POST' });
}

// ─── Payments ───

export async function getPayments(
  params?: PaginationParams & { invoice_id?: string; customer_id?: string },
): Promise<PaginatedResponse<Payment>> {
  if (isMockEnabled()) return mockHandlers.getPayments(params);
  return apiClient<PaginatedResponse<Payment>>(`/payments${buildQuery(params)}`);
}

export async function recordPayment(invoiceId: string, payload: RecordPaymentPayload): Promise<Payment> {
  if (isMockEnabled()) return mockHandlers.recordPayment(invoiceId, payload, actorName());
  return apiClient<Payment>(`/invoices/${invoiceId}/payments`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// ─── Reports ───

export async function getReportSummary(): Promise<ReportSummary> {
  if (isMockEnabled()) return mockHandlers.getReportSummary();
  return apiClient<ReportSummary>('/reports/summary');
}

export async function getOverdueInvoices(): Promise<OverdueInvoice[]> {
  if (isMockEnabled()) return mockHandlers.getOverdueInvoices();
  return apiClient<OverdueInvoice[]>('/reports/overdue');
}

// ─── Portal (customer-scoped by the backend via the JWT) ───

export async function getPortalSubscriptions(params?: PaginationParams): Promise<PaginatedResponse<Subscription>> {
  if (isMockEnabled()) return mockHandlers.getPortalSubscriptions(currentCustomerId(), params);
  return apiClient<PaginatedResponse<Subscription>>(`/portal/subscriptions${buildQuery(params)}`);
}

export async function getPortalInvoices(params?: PaginationParams): Promise<PaginatedResponse<Invoice>> {
  if (isMockEnabled()) return mockHandlers.getPortalInvoices(currentCustomerId(), params);
  return apiClient<PaginatedResponse<Invoice>>(`/portal/invoices${buildQuery(params)}`);
}

function currentCustomerId(): string | null {
  try {
    const token = getToken();
    if (!token) return null;
    const payload = JSON.parse(atob(token.split('.')[1])) as { sub: string };
    // Mock user store: customer_id is resolved server-side; for mocks we look it up
    return mockCustomerId(payload.sub);
  } catch {
    return null;
  }
}

function mockCustomerId(userId: string): string | null {
  const known: Record<string, string> = { '3': 'cust_1' };
  return known[userId] ?? null;
}

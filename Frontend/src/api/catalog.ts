import { apiClient } from '@/api/client';
import type {
  Product,
  Plan,
  Tax,
  Discount,
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
} from '@/types';

function buildQuery(params?: PaginationParams): string {
  if (!params) return '';
  const search = new URLSearchParams();
  if (params.page !== undefined) search.set('page', String(params.page));
  if (params.page_size !== undefined) search.set('page_size', String(params.page_size));
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

// ─── Products ───

export async function getProducts(params?: PaginationParams): Promise<PaginatedResponse<Product>> {
  return apiClient<PaginatedResponse<Product>>(`/products${buildQuery(params)}`);
}

export async function createProduct(payload: CreateProductPayload): Promise<Product> {
  return apiClient<Product>('/products', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateProduct(id: number, payload: UpdateProductPayload): Promise<Product> {
  return apiClient<Product>(`/products/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

// ─── Plans ───

export async function getPlans(params?: PaginationParams): Promise<PaginatedResponse<Plan>> {
  return apiClient<PaginatedResponse<Plan>>(`/plans${buildQuery(params)}`);
}

export async function createPlan(payload: CreatePlanPayload): Promise<Plan> {
  return apiClient<Plan>('/plans', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updatePlan(id: number, payload: UpdatePlanPayload): Promise<Plan> {
  return apiClient<Plan>(`/plans/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

// ─── Taxes ───

export async function getTaxes(params?: PaginationParams): Promise<PaginatedResponse<Tax>> {
  return apiClient<PaginatedResponse<Tax>>(`/taxes${buildQuery(params)}`);
}

export async function createTax(payload: CreateTaxPayload): Promise<Tax> {
  return apiClient<Tax>('/taxes', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateTax(id: number, payload: UpdateTaxPayload): Promise<Tax> {
  return apiClient<Tax>(`/taxes/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

// ─── Discounts ───

export async function getDiscounts(params?: PaginationParams): Promise<PaginatedResponse<Discount>> {
  return apiClient<PaginatedResponse<Discount>>(`/discounts${buildQuery(params)}`);
}

export async function createDiscount(payload: CreateDiscountPayload): Promise<Discount> {
  return apiClient<Discount>('/discounts', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateDiscount(id: number, payload: UpdateDiscountPayload): Promise<Discount> {
  return apiClient<Discount>(`/discounts/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

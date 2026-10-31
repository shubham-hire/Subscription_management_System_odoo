import { apiClient } from '@/api/client';
import { mockHandlers, isMockEnabled } from '@/api/mocks';
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
  if (isMockEnabled()) {
    return mockHandlers.getProducts(params);
  }
  return apiClient<PaginatedResponse<Product>>(`/products${buildQuery(params)}`);
}

export async function createProduct(payload: CreateProductPayload): Promise<Product> {
  if (isMockEnabled()) {
    return mockHandlers.createProduct(payload);
  }
  return apiClient<Product>('/products', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateProduct(id: string, payload: UpdateProductPayload): Promise<Product> {
  if (isMockEnabled()) {
    return mockHandlers.updateProduct(id, payload);
  }
  return apiClient<Product>(`/products/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

// ─── Plans ───

export async function getPlans(params?: PaginationParams): Promise<PaginatedResponse<Plan>> {
  if (isMockEnabled()) {
    return mockHandlers.getPlans(params);
  }
  return apiClient<PaginatedResponse<Plan>>(`/plans${buildQuery(params)}`);
}

export async function createPlan(payload: CreatePlanPayload): Promise<Plan> {
  if (isMockEnabled()) {
    return mockHandlers.createPlan(payload);
  }
  return apiClient<Plan>('/plans', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updatePlan(id: string, payload: UpdatePlanPayload): Promise<Plan> {
  if (isMockEnabled()) {
    return mockHandlers.updatePlan(id, payload);
  }
  return apiClient<Plan>(`/plans/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

// ─── Taxes ───

export async function getTaxes(params?: PaginationParams): Promise<PaginatedResponse<Tax>> {
  if (isMockEnabled()) {
    return mockHandlers.getTaxes(params);
  }
  return apiClient<PaginatedResponse<Tax>>(`/taxes${buildQuery(params)}`);
}

export async function createTax(payload: CreateTaxPayload): Promise<Tax> {
  if (isMockEnabled()) {
    return mockHandlers.createTax(payload);
  }
  return apiClient<Tax>('/taxes', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateTax(id: string, payload: UpdateTaxPayload): Promise<Tax> {
  if (isMockEnabled()) {
    return mockHandlers.updateTax(id, payload);
  }
  return apiClient<Tax>(`/taxes/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

// ─── Discounts ───

export async function getDiscounts(params?: PaginationParams): Promise<PaginatedResponse<Discount>> {
  if (isMockEnabled()) {
    return mockHandlers.getDiscounts(params);
  }
  return apiClient<PaginatedResponse<Discount>>(`/discounts${buildQuery(params)}`);
}

export async function createDiscount(payload: CreateDiscountPayload): Promise<Discount> {
  if (isMockEnabled()) {
    return mockHandlers.createDiscount(payload);
  }
  return apiClient<Discount>('/discounts', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateDiscount(id: string, payload: UpdateDiscountPayload): Promise<Discount> {
  if (isMockEnabled()) {
    return mockHandlers.updateDiscount(id, payload);
  }
  return apiClient<Discount>(`/discounts/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

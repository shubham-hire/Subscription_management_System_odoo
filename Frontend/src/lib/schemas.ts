import { z } from 'zod';

/**
 * Shared password regex: 9+ chars, uppercase, lowercase, special character.
 * Used in both signup validation and the live password checklist.
 */
export const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[^A-Za-z0-9]).{9,}$/;

/** Individual password rules for the live checklist UI */
export const PASSWORD_RULES = [
  { id: 'length', label: 'At least 9 characters', test: (v: string) => v.length >= 9 },
  { id: 'uppercase', label: 'One uppercase letter', test: (v: string) => /[A-Z]/.test(v) },
  { id: 'lowercase', label: 'One lowercase letter', test: (v: string) => /[a-z]/.test(v) },
  { id: 'special', label: 'One special character', test: (v: string) => /[^A-Za-z0-9]/.test(v) },
] as const;

export const loginSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});

export const signupSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name is too long'),
  email: z.string().min(1, 'Email is required').email('Enter a valid email'),
  password: z
    .string()
    .min(1, 'Password is required')
    .regex(PASSWORD_REGEX, 'Password does not meet all requirements'),
});

export type LoginFormValues = z.infer<typeof loginSchema>;
export type SignupFormValues = z.infer<typeof signupSchema>;

// ─── Catalog Schemas ───

export const productSchema = z.object({
  name: z.string().min(1, 'Product name is required').max(100, 'Name is too long'),
  description: z.string().max(500, 'Description is too long'),
  status: z.enum(['active', 'closed']),
});

export const planSchema = z.object({
  product_id: z.string().min(1, 'Select a product'),
  name: z.string().min(1, 'Plan name is required').max(100, 'Name is too long'),
  billing_interval: z.enum(['day', 'week', 'month', 'year']),
  interval_count: z.number().int().min(1, 'Must be at least 1'),
  price: z
    .string()
    .min(1, 'Price is required')
    .regex(/^\d+(\.\d{1,2})?$/, 'Enter a valid amount (e.g. 999.00)'),
  trial_days: z.number().int().min(0, 'Cannot be negative'),
  status: z.enum(['active', 'paused', 'closed']),
});

export const taxSchema = z.object({
  name: z.string().min(1, 'Tax name is required').max(100, 'Name is too long'),
  rate: z
    .string()
    .min(1, 'Tax rate is required')
    .regex(/^\d+(\.\d{1,2})?$/, 'Enter a valid percentage (e.g. 18.00)'),
  is_inclusive: z.boolean(),
  status: z.enum(['active', 'closed']),
});

export const discountSchema = z.object({
  code: z
    .string()
    .min(2, 'Code must be at least 2 characters')
    .max(30, 'Code is too long')
    .regex(/^[A-Z0-9_-]+$/, 'Uppercase letters, numbers, and dashes only'),
  name: z.string().min(1, 'Discount name is required').max(100, 'Name is too long'),
  type: z.enum(['percentage', 'fixed']),
  value: z
    .string()
    .min(1, 'Value is required')
    .regex(/^\d+(\.\d{1,2})?$/, 'Enter a valid number (e.g. 20.00 or 500.00)'),
  status: z.enum(['active', 'closed']),
});


export type ProductFormValues = z.infer<typeof productSchema>;
export type PlanFormValues = z.infer<typeof planSchema>;
export type TaxFormValues = z.infer<typeof taxSchema>;
export type DiscountFormValues = z.infer<typeof discountSchema>;

// ─── Customer Schema ───

export const customerSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name is too long'),
  company: z.string().max(100, 'Company is too long').optional().or(z.literal('')),
  email: z.string().min(1, 'Email is required').email('Enter a valid email'),
  phone: z.string().max(20, 'Phone is too long').optional().or(z.literal('')),
  billing_address: z.string().max(300, 'Address is too long').optional().or(z.literal('')),
  tax_id: z.string().max(30, 'Tax/GST ID is too long').optional().or(z.literal('')),
});

export type CustomerFormValues = z.infer<typeof customerSchema>;

// ─── Payment Schema ───

export const paymentSchema = z.object({
  invoice_id: z.string().min(1, 'Select an invoice'),
  method: z.enum(['cash', 'card', 'upi', 'bank_transfer', 'cheque']),
  amount: z
    .string()
    .min(1, 'Amount is required')
    .regex(/^\d+(\.\d{1,2})?$/, 'Enter a valid amount (e.g. 1500.00)'),
  payment_date: z.string().min(1, 'Payment date is required'),
  note: z.string().max(250, 'Note is too long').optional().or(z.literal('')),
});

export type PaymentFormValues = z.infer<typeof paymentSchema>;

// ─── User / Staff Schema ───

export const staffSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name is too long'),
  email: z.string().min(1, 'Email is required').email('Enter a valid email'),
  password: z
    .string()
    .min(1, 'Password is required')
    .regex(PASSWORD_REGEX, 'Password must be 9+ chars with uppercase, lowercase, & special symbol'),
});

export type StaffFormValues = z.infer<typeof staffSchema>;


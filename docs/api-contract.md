# API Contract — v1 (frozen at T+2.5)

Base URL: `http://localhost:4000` · JSON only · JWT bearer: `Authorization: Bearer <token>`

**Error format (every endpoint):**

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "...", "fields": { "email": "Already in use" } } }
```

Codes: `VALIDATION_ERROR` (400), `UNAUTHORIZED` (401), `FORBIDDEN` (403), `NOT_FOUND` (404), `CONFLICT` (409), `INTERNAL` (500).

**Pagination (all lists):** `?page=1&page_size=20` → `{ "items": [...], "total": 123, "page": 1, "page_size": 20 }`
**Money:** always strings with 2 decimals (`"1234.50"`) — never numbers.

## Auth (public)

| Endpoint | Body | Response |
| --- | --- | --- |
| `POST /auth/signup` | `{name, email, password}` | `201 {token, user}` — user = `{id, name, email, role:"customer", customer_id}` |
| `POST /auth/login` | `{email, password}` | `200 {token, user}` |
| `GET /auth/me` | — | `200 {id, name, email, role, customer_id}` |

Errors: weak password / duplicate email → 400 with `fields.{password,email}`.

## Catalog (admin write, staff read)

`GET/POST /products` · `GET/PATCH/DELETE /products/:id` · `POST /products/:id/variants` · `GET/POST /plans` · `GET/PATCH /plans/:id` · `GET/POST /taxes` · `PATCH /taxes/:id` · `GET/POST /discounts` · `PATCH /discounts/:id`

```json
// Product
{ "id": 1, "name": "ERP Software", "type": "software", "sales_price": "2999.00", "cost_price": "1500.00", "notes": "", "tax_id": 1, "is_active": true,
  "variants": [ { "id": 1, "attribute": "Brand", "value": "Odoo", "price_extra": "560.00" } ] }
// Plan
{ "id": 1, "name": "Business Monthly", "price": "2999.00", "billing_period": "monthly", "min_quantity": 1,
  "available_from": "2026-11-01", "available_to": "2027-10-31",
  "auto_close": true, "closable": true, "pausable": false, "renewable": true, "is_active": true }
// Tax      { "id": 1, "name": "GST 18%", "percentage": 18, "is_active": true }
// Discount { "id": 1, "name": "Bulk seats 10%", "type": "percentage", "value": 10, "min_purchase": "0", "min_quantity": 2,
//            "start_date": "2026-11-01", "end_date": "2026-12-31", "max_uses": 100, "times_used": 0,
//            "scope": "product", "product_ids": [1], "is_active": true }
```

Validation: plan `available_to > available_from` (PLN-06) · tax 0–100 (TAX-04) · discount pct 1–100, fixed > 0, dates ordered (DSC-06) · cost > sales price → 200 with warning field, not an error (PRD-04).

## Customers (staff/admin — CUS-01/03)

`GET /customers?search=&page=` → `{items,total,page,page_size}` (search across name/company/email) · `GET /customers/:id` · `POST /customers` · `PATCH /customers/:id`

```json
// POST/PATCH body: { name, email, company?, phone?, billing_address?, tax_id? }
// email is trimmed+lowercased; duplicate → 409 CONFLICT with fields.email
{ "id": 7, "name": "New Shop", "company": null, "email": "newshop@full.test", "phone": "+91 91111 11111",
  "billingAddress": "1 Main St", "taxId": null,
  "subscriptions": [ { "id": 3, "number": "SUB-000003", "status": "active", "startDate": "...", "expiryDate": "..." } ],
  "invoices": [ { "id": 2, "number": "INV-000002", "status": "confirmed", "total": "1180.00", "amountPaid": "0.00" } ],
  "outstanding": "1180.00" }
```

## Invoices (staff/admin)

| Endpoint | Notes |
| --- | --- |
| `GET /invoices?status=&overdue=&customer_id=&page=` | `status ∈ draft,confirmed,paid,cancelled` · `overdue=true` filter |
| `GET /invoices/:id` | includes `lines[]`, `payments[]` |
| `POST /invoices/:id/payments` | `{method, amount, date, note}` → 201 payment; invoice response reflects `amount_paid`, `status` |

```json
{ "id": 5, "number": "INV-000005", "subscription_id": 2, "customer_id": 1,
  "status": "confirmed", "period_start": "2026-11-01", "period_end": "2026-11-30",
  "issue_date": "2026-11-01", "due_date": "2026-11-16",
  "subtotal": "3559.00", "discount_total": "355.90", "tax_total": "576.56", "total": "3779.66",
  "amount_paid": "1000.00", "overdue": false,
  "lines": [ { "id": 9, "description": "ERP Software (Odoo)", "quantity": 1, "unit_price": "3559.00",
               "discount_amount": "355.90", "discount_name": "Bulk seats 10%", "tax_amount": "576.56", "line_total": "3779.66" } ],
  "payments": [ { "id": 3, "method": "upi", "amount": "1000.00", "payment_date": "2026-11-03", "note": "" } ] }
```

Payment errors: amount ≤ 0 → 400 · amount > outstanding → 400 `fields.amount: "Exceeds outstanding balance"` · invoice Draft/Cancelled → 400 · methods: `cash|card|upi|bank_transfer|cheque` (D12).

## Portal (customer role only)

`GET /portal/subscriptions` · `GET /portal/invoices` — same shapes, server-scoped to `req.user.customer_id`; foreign IDs → 404.

## Owned by Dev B (shapes agreed here, implementation B's)

`POST /subscriptions` + transitions (`/confirm|activate|pause|resume|close|renew`) · `POST /billing/run` → `{created, skipped, failed, run_id}` · invoice `confirm|cancel|send` · `GET /reports/summary` · `GET /reports/overdue`

```json
// Subscription
{ "id": 2, "number": "SUB-000002", "customer_id": 1, "plan_id": 1, "status": "active",
  "start_date": "2026-11-01", "expiry_date": "2026-11-30", "next_billing_date": "2026-11-01",
  "payment_terms_days": 15, "lines": [ { "product_id": 1, "variant_id": 1, "quantity": 2,
  "unit_price": "3559.00", "tax_id": 1 } ],
  "history": [ { "from_status": "draft", "to_status": "quotation", "changed_by": 2, "changed_at": "..." } ] }
```

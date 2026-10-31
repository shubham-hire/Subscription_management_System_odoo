# Product Requirements Document: Subscription Management System

**Project:** Brightloop Subscription Management System (SMS) **Author:** Shubham **Version:** 1.0 (Draft) **Status:** For review

---

## 1. Overview

### 1.1 Purpose

Brightloop Software sells software on subscription (monthly or yearly plans, add-ons, product variants). Today subscriptions live in a spreadsheet, renewals are remembered by whoever notices first, invoices are typed by hand, payments are matched by scrolling bank statements, and revenue reports are built manually each quarter. This product replaces that with one platform that runs the full subscription lifecycle: catalog setup, quotation, subscription, recurring invoicing, payment collection and revenue reporting.

### 1.2 Problem Statement

- Renewals are missed.
- Invoices go out wrong or late.
- Payments are hard to match to invoices.
- Nobody can state the company's recurring revenue.
- Quarter-end reporting takes days.

### 1.3 Goals

1. Automate invoice generation from active subscriptions with no manual typing, no double billing and no skipped billing.
2. Provide role-based access for Admin, Staff and Customers (self-service portal).
3. Give finance one dashboard for active subscriptions, revenue, payments, outstanding amounts and overdue invoices.
4. Respond to every page in under 2 seconds with thousands of subscriptions.
5. Run fully on a local environment (local database, local email catcher, local PDF generation) with no mandatory cloud dependency.

### 1.4 Non-Goals (v1)

- Real payment gateway integration (payments are recorded manually; a gateway is a future extension).
- Multi-currency and multi-company support.
- Native mobile apps (the web UI must be responsive).
- Dunning automation beyond overdue flagging and reminder emails.
- Revenue recognition or accounting-ledger features.

### 1.5 Success Metrics

| Metric | Target |
| --- | --- |
| Invoices created without manual typing | 100% |
| Duplicate invoices for the same subscription period | 0 (enforced by database constraint) |
| Page response time with 5,000+ subscriptions | < 2 seconds |
| Time for finance to answer "active subs, revenue, owed, overdue" | < 1 minute (one dashboard) |
| Customers able to view own subscriptions and invoices without emailing staff | 100% |

---

## 2. Users and Roles

### 2.1 Personas

| Persona | Description | Main needs |
| --- | --- | --- |
| **Admin** | Controls the whole system | Configure products, plans, taxes, discounts; add staff; see everything |
| **Internal Staff** | Sales reps, billing and support team | Create quotes and subscriptions, run and send invoices, record payments, chase overdue invoices |
| **Customer** | Small shop to large company | See and manage own subscriptions and invoices through a portal |
| **Finance Lead** | Usually Admin or a Staff user with report access | One place to see subscriptions, revenue, payments and overdue invoices |

### 2.2 Permission Matrix

| Capability | Admin | Staff | Customer |
| --- | --- | --- | --- |
| Add or deactivate staff users | Yes | No | No |
| Create or edit products, variants, plans | Yes | View only | View plans in portal |
| Create or edit taxes | Yes | No | No |
| Create or edit discount rules | Yes | No (can apply existing) | No |
| Create or edit quotation templates | Yes | Yes | No |
| Create customers and subscriptions | Yes | Yes | Own subscription requests only |
| Confirm, cancel, send, print invoices | Yes | Yes | Print own only |
| Record payments | Yes | Yes | No |
| View dashboard and reports | Yes | Yes | No |
| View own subscriptions and invoices | Yes | Yes | Yes (own data only) |
| Pause, close or renew a subscription | Yes | Yes | Only if the plan allows, on own subscription |

All permissions are enforced on the backend for every endpoint. Hiding a menu item is not sufficient.

---

## 3. Assumptions and Resolved Ambiguities

The source problem statement leaves several points open. The decisions below are binding for v1 and should be documented in the README.

| # | Ambiguity in the source | Decision for v1 |
| --- | --- | --- |
| 1 | Password must be "more than eight characters" | Minimum **9 characters**, plus uppercase, lowercase and special character |
| 2 | Invoice has a "cancel" action but states only Draft, Confirmed, Paid | Add a **Cancelled** state |
| 3 | Plans can be "paused" but the subscription lifecycle has no Paused state | Add **Paused** as a subscription state; allowed only when the plan's `pausable` flag is true |
| 4 | "Overdue" is a key report but not an invoice state | **Computed** condition: due date before today and not fully paid |
| 5 | Discount "limit on how many times it can be used" | **Total** usage count across all customers (not per customer) |
| 6 | Tax inclusive or exclusive not stated | Taxes are **exclusive** (added on top of line amount) |
| 7 | Partial payments not mentioned, but "outstanding" implies them | **Supported**: invoice is Paid when the sum of payments is at least the total |
| 8 | Currency not stated for "560" | Single currency, **INR (₹)**, configurable symbol |
| 9 | Staff-created customers vs self-signup customers | A staff-created customer record can be **linked to a portal login** by matching email on signup |
| 10 | Staff "limited access" is vague | Defined by the permission matrix in section 2.2 |
| 11 | Billing frequencies include daily and weekly | Billing job runs **daily** and handles every period type |
| 12 | "Some plans close on their own" | Plan flag `auto_close`: subscriptions on that plan move to Closed on expiry date |

---

## 4. Functional Requirements

Priority: **P0** = must have, **P1** = should have, **P2** = nice to have.

### 4.1 Authentication and Account Management

| ID | Requirement | Priority |
| --- | --- | --- |
| AUTH-01 | A visitor can sign up with name, email and password; the account is created with the Customer role | P0 |
| AUTH-02 | Email must be unique (case-insensitive); duplicate signups are rejected with a clear message | P0 |
| AUTH-03 | Password rules: at least 9 characters, one uppercase, one lowercase, one special character; validated on client and server | P0 |
| AUTH-04 | Passwords are stored hashed (bcrypt or argon2), never in plain text | P0 |
| AUTH-05 | Login with email and password; session via JWT or secure cookie with expiry | P0 |
| AUTH-06 | Forgot password: a single-use reset link with a time limit (for example 30 minutes) is sent to the registered email | P0 |
| AUTH-07 | Reset flow does not reveal whether an email exists (same message either way) | P1 |
| AUTH-08 | Only Admin can create Staff accounts (name, email, temporary password, forced change at first login) | P0 |
| AUTH-09 | Role-based route guards on the frontend and role checks on every API endpoint | P0 |
| AUTH-10 | Login rate limiting or temporary lockout after repeated failures | P1 |
| AUTH-11 | Admin can deactivate a staff account without deleting history | P1 |

### 4.2 Product Catalog

| ID | Requirement | Priority |
| --- | --- | --- |
| PRD-01 | Admin can create, edit, archive and list products with name, type, sales price, cost price and notes | P0 |
| PRD-02 | A product can have variants defined by an attribute (for example Brand) and value (for example Odoo) with a **price extra** (for example +560) | P0 |
| PRD-03 | Effective unit price = product sales price + selected variant price extra | P0 |
| PRD-04 | Sales price and cost price must be zero or more; cost price above sales price shows a warning (not an error) | P1 |
| PRD-05 | Archived products cannot be added to new subscriptions but remain on historic records | P0 |
| PRD-06 | Search and filter products by name and type | P1 |

### 4.3 Plans

| ID | Requirement | Priority |
| --- | --- | --- |
| PLN-01 | Admin can create a plan with name, price, billing period (**daily, weekly, monthly, yearly**), minimum quantity, available-from and available-to dates | P0 |
| PLN-02 | Per-plan behavior flags set by Admin: `auto_close`, `closable` (can be closed early), `pausable`, `renewable` | P0 |
| PLN-03 | A plan is selectable for new subscriptions only within its availability window | P0 |
| PLN-04 | Minimum quantity is enforced when adding lines to a subscription on that plan | P0 |
| PLN-05 | The UI shows only the actions the plan allows (for example no Pause button when `pausable` is false); the API also rejects disallowed actions | P0 |
| PLN-06 | Available-to date must be after available-from date | P0 |

### 4.4 Taxes

| ID | Requirement | Priority |
| --- | --- | --- |
| TAX-01 | Admin can create tax rules with name, percentage and active flag | P0 |
| TAX-02 | Taxes can be assigned per product (default) and overridden per subscription line | P0 |
| TAX-03 | Tax is calculated automatically on each invoice line; totals are computed on the server | P0 |
| TAX-04 | Tax percentage must be between 0 and 100 | P0 |

### 4.5 Quotation Templates

| ID | Requirement | Priority |
| --- | --- | --- |
| TPL-01 | Admin or Staff can create a template with name, plan, product lines (product, variant, quantity) and **validity in days** | P0 |
| TPL-02 | Creating a subscription from a template copies the plan and lines; staff can then edit them | P0 |
| TPL-03 | Quotation expiry date = creation date + template validity days | P0 |
| TPL-04 | Expired quotations cannot be confirmed without being renewed or edited | P1 |

### 4.6 Customers

| ID | Requirement | Priority |
| --- | --- | --- |
| CUS-01 | Staff and Admin can create and edit customer records (name, company, email, phone, billing address, tax ID) | P0 |
| CUS-02 | Customer email is unique; a signup with a matching email links to the existing customer record | P0 |
| CUS-03 | Customer detail page lists subscriptions, invoices, payments and outstanding balance | P1 |

### 4.7 Subscriptions

| ID | Requirement | Priority |
| --- | --- | --- |
| SUB-01 | Each subscription gets a unique auto-generated number (for example SUB-000123) | P0 |
| SUB-02 | Fields: customer, plan, start date, expiry date, payment terms (for example Immediate, Net 15, Net 30), order lines | P0 |
| SUB-03 | Each line holds product, variant, quantity, unit price, tax, discount and computed amount | P0 |
| SUB-04 | Lifecycle: **Draft → Quotation → Confirmed → Active → Closed**, plus **Paused** (from Active, if plan allows) | P0 |
| SUB-05 | Only valid transitions are allowed; every transition is recorded with user and timestamp (status history) | P0 |
| SUB-06 | Status is clearly visible on list and detail pages (badge plus filter) | P0 |
| SUB-07 | Confirmed subscriptions become Active on start date (automatically or by action) | P0 |
| SUB-08 | Subscription auto-closes on expiry date when the plan has `auto_close` | P0 |
| SUB-09 | Renew action creates a new term (or extends expiry) when the plan is `renewable` | P1 |
| SUB-10 | Close early is allowed only when the plan is `closable`; stops future invoicing | P0 |
| SUB-11 | Pause stops invoice generation until resumed; the next billing date is recalculated on resume | P1 |
| SUB-12 | Expiry date must be after start date | P0 |
| SUB-13 | Customers can view their own subscriptions in the portal and perform allowed actions | P0 |

### 4.8 Invoicing

| ID | Requirement | Priority |
| --- | --- | --- |
| INV-01 | The billing job creates an invoice for every Active subscription whose next billing date is today or earlier | P0 |
| INV-02 | The invoice is pre-filled: customer details, product lines, quantities, prices, taxes, discounts and totals | P0 |
| INV-03 | **No double billing:** a unique constraint on (subscription, billing period start) makes duplicates impossible | P0 |
| INV-04 | **No skipped billing:** invoice creation and next-billing-date advance happen in one transaction; a catch-up run bills any missed periods | P0 |
| INV-05 | Invoice states: **Draft → Confirmed → Paid**, plus Cancelled | P0 |
| INV-06 | Staff can confirm, cancel, send (email with PDF) and print any invoice | P0 |
| INV-07 | Confirmed invoices are immutable (no edits to lines or amounts); corrections require cancel and reissue | P1 |
| INV-08 | Each invoice has a unique number, issue date and due date derived from payment terms | P0 |
| INV-09 | Manual "Run billing now" action for Admin and Staff, showing a results summary (created, skipped, failed) | P0 |
| INV-10 | Bulk actions: confirm or send multiple selected invoices | P1 |
| INV-11 | PDF invoice generated locally with company details, line items, tax breakdown and totals | P0 |
| INV-12 | Overdue reminder email to the customer | P2 |

### 4.9 Discounts

| ID | Requirement | Priority |
| --- | --- | --- |
| DSC-01 | Only Admin can create, edit and deactivate discount rules | P0 |
| DSC-02 | Rule fields: name, type (fixed amount or percentage), value, minimum purchase amount, minimum quantity, start date, end date, maximum usage count | P0 |
| DSC-03 | Scope: specific products or the entire subscription | P0 |
| DSC-04 | An applicable discount is applied automatically on the next invoice with no manual step | P0 |
| DSC-05 | Each application increments the usage counter; the rule stops when expired or the usage limit is reached | P0 |
| DSC-06 | Percentage must be 1 to 100; fixed value must be above 0; end date after start date | P0 |
| DSC-07 | A discount never makes a line or invoice total negative | P0 |
| DSC-08 | Invoice lines show the discount applied and the rule name | P1 |

### 4.10 Payments

| ID | Requirement | Priority |
| --- | --- | --- |
| PAY-01 | Record a payment against an invoice with method (cash, card, UPI, bank transfer, cheque), amount, date and note | P0 |
| PAY-02 | Payment amount must be above 0 and must not exceed the outstanding balance | P0 |
| PAY-03 | Partial payments are allowed; the invoice becomes Paid when total payments are at least the invoice total | P0 |
| PAY-04 | Invoice list shows paid, partially paid and outstanding clearly, with amount paid and balance due | P0 |
| PAY-05 | Overdue invoices are highlighted and filterable | P0 |
| PAY-06 | Payments cannot be recorded against Draft or Cancelled invoices | P0 |
| PAY-07 | Payment history per invoice and per customer | P1 |

### 4.11 Customer Portal

| ID | Requirement | Priority |
| --- | --- | --- |
| POR-01 | After login, a customer sees only their own subscriptions, invoices and payments | P0 |
| POR-02 | A customer can view subscription details, status and next billing date | P0 |
| POR-03 | A customer can download or print their own invoices | P0 |
| POR-04 | A customer can pause, close or renew a subscription when the plan allows | P1 |
| POR-05 | Object-level authorization: changing an ID in the URL never exposes another customer's data | P0 |

### 4.12 Reporting and Dashboard

| ID | Requirement | Priority |
| --- | --- | --- |
| RPT-01 | Dashboard KPIs: active subscriptions, MRR, revenue collected, outstanding amount, overdue invoice count and amount | P0 |
| RPT-02 | Filters: date range, customer, plan, product, subscription status, invoice status | P0 |
| RPT-03 | Summary view (totals and breakdown by plan and by month) plus detailed list view | P0 |
| RPT-04 | Overdue invoices list sorted by days overdue, with customer contact details | P0 |
| RPT-05 | Charts: revenue by month, subscriptions by status | P1 |
| RPT-06 | Export current report view to CSV | P1 |
| RPT-07 | All report queries respond in under 2 seconds with 5,000+ subscriptions | P0 |

---

## 5. State Machines

### 5.1 Subscription

`Draft → Quotation → Confirmed → Active → Closed`

| From | To | Trigger | Condition |
| --- | --- | --- | --- |
| Draft | Quotation | Send or save as quotation | Has customer, plan and at least one line |
| Quotation | Confirmed | Customer or staff confirms | Quotation not expired |
| Confirmed | Active | Start date reached or manual activate | Start date is today or earlier |
| Active | Paused | Pause | Plan `pausable` |
| Paused | Active | Resume | None |
| Active or Paused | Closed | Close early | Plan `closable` |
| Active | Closed | Expiry date reached | Plan `auto_close` |
| Closed | Active (new term) | Renew | Plan `renewable` |

### 5.2 Invoice

`Draft → Confirmed → Paid`, with `Draft or Confirmed → Cancelled`.

| From | To | Trigger |
| --- | --- | --- |
| Draft | Confirmed | Staff confirms |
| Confirmed | Paid | Payments total at least invoice total |
| Draft or Confirmed | Cancelled | Staff cancels (not allowed once any payment is recorded) |

---

## 6. Business Rules and Calculations

### 6.1 Pricing

- Unit price = product sales price + variant price extra.
- Line subtotal = unit price × quantity.
- Line discount = per applicable discount rule (fixed amount or percentage of the line or subscription subtotal).
- Line tax = (line subtotal − line discount) × tax percentage.
- Invoice total = sum of (line subtotal − line discount + line tax).
- All money values use fixed-point decimals with 2 places, never floating point.

### 6.2 Billing Schedule

- Next billing date starts at the subscription start date.
- After each invoice, advance by one billing period (day, week, month or year). Month-end rule: if the original day does not exist in the target month, use the last day of that month.
- The daily job processes every Active subscription with next billing date at or before today, in batches.
- Each subscription is billed in its own transaction so one failure does not block the others; failures are logged and shown in the run summary.

### 6.3 Discount Application

- On invoice generation, find active rules where today is within the date range, usage count is below the limit, and the minimum quantity or purchase amount is met.
- If several rules apply to the same line, apply the single best discount (largest saving) unless stacking is enabled by Admin (P2).
- Usage counter is incremented in the same transaction as invoice creation.

### 6.4 Due Date and Overdue

- Due date = invoice date + payment terms days.
- Overdue = invoice Confirmed, balance above 0 and due date before today.

### 6.5 Numbering

- Subscription numbers and invoice numbers are sequential, unique and generated in the database to avoid race conditions.

---

## 7. Data Model

| Table | Key fields |
| --- | --- |
| `users` | id, name, email (unique), password\_hash, role (admin, staff, customer), is\_active, customer\_id (nullable), created\_at |
| `password_resets` | id, user\_id, token\_hash, expires\_at, used\_at |
| `customers` | id, name, company, email (unique), phone, billing\_address, tax\_id |
| `products` | id, name, type, sales\_price, cost\_price, notes, tax\_id, is\_active |
| `product_variants` | id, product\_id, attribute, value, price\_extra |
| `plans` | id, name, price, billing\_period, min\_quantity, available\_from, available\_to, auto\_close, closable, pausable, renewable, is\_active |
| `taxes` | id, name, percentage, is\_active |
| `quotation_templates` | id, name, plan\_id, validity\_days |
| `template_lines` | id, template\_id, product\_id, variant\_id, quantity |
| `subscriptions` | id, number (unique), customer\_id, plan\_id, status, start\_date, expiry\_date, next\_billing\_date, payment\_terms\_days, created\_by |
| `subscription_lines` | id, subscription\_id, product\_id, variant\_id, quantity, unit\_price, tax\_id, discount\_id |
| `subscription_status_history` | id, subscription\_id, from\_status, to\_status, changed\_by, changed\_at |
| `discounts` | id, name, type, value, min\_purchase, min\_quantity, start\_date, end\_date, max\_uses, times\_used, scope, is\_active |
| `discount_products` | discount\_id, product\_id |
| `invoices` | id, number (unique), subscription\_id, customer\_id, status, period\_start, period\_end, issue\_date, due\_date, subtotal, discount\_total, tax\_total, total, amount\_paid |
| `invoice_lines` | id, invoice\_id, product\_id, description, quantity, unit\_price, discount\_amount, tax\_amount, line\_total |
| `payments` | id, invoice\_id, method, amount, payment\_date, note, recorded\_by |
| `billing_runs` | id, run\_at, triggered\_by, created\_count, skipped\_count, failed\_count, log |
| `audit_log` | id, user\_id, action, entity, entity\_id, timestamp |

**Key constraints and indexes**

- Unique: `users.email`, `customers.email`, `subscriptions.number`, `invoices.number`.
- Unique: `invoices (subscription_id, period_start)` to prevent double billing.
- Check constraints: amounts at or above 0, percentage between 0 and 100, end date after start date.
- Indexes: `subscriptions (status, next_billing_date)`, `subscriptions (customer_id)`, `invoices (status, due_date)`, `invoices (customer_id)`, `payments (invoice_id)`, `payments (payment_date)`.

---

## 8. API Design (REST)

All endpoints return JSON, use pagination (`page`, `page_size`), and require authentication except signup, login and reset.

| Area | Endpoints |
| --- | --- |
| Auth | `POST /auth/signup`, `POST /auth/login`, `POST /auth/forgot-password`, `POST /auth/reset-password`, `POST /auth/logout`, `GET /auth/me` |
| Users (Admin) | `GET/POST /users`, `PATCH /users/:id` |
| Products | `GET/POST /products`, `GET/PATCH/DELETE /products/:id`, `POST /products/:id/variants` |
| Plans | `GET/POST /plans`, `GET/PATCH /plans/:id` |
| Taxes | `GET/POST /taxes`, `PATCH /taxes/:id` |
| Discounts | `GET/POST /discounts`, `PATCH /discounts/:id` |
| Templates | `GET/POST /templates`, `GET/PATCH /templates/:id` |
| Customers | `GET/POST /customers`, `GET/PATCH /customers/:id` |
| Subscriptions | `GET/POST /subscriptions`, `GET/PATCH /subscriptions/:id`, `POST /subscriptions/:id/{confirm,activate,pause,resume,close,renew}`, `POST /subscriptions/from-template/:templateId` |
| Invoices | `GET /invoices`, `GET /invoices/:id`, `POST /invoices/:id/{confirm,cancel,send}`, `GET /invoices/:id/pdf`, `POST /billing/run` |
| Payments | `GET /payments`, `POST /invoices/:id/payments` |
| Reports | `GET /reports/summary`, `GET /reports/revenue`, `GET /reports/overdue`, `GET /reports/subscriptions`, `GET /reports/export.csv` |
| Portal | `GET /portal/subscriptions`, `GET /portal/invoices`, `GET /portal/invoices/:id/pdf` |

Standard error format: `{ "error": { "code": "VALIDATION_ERROR", "message": "...", "fields": { "email": "Already in use" } } }`.

---

## 9. Non-Functional Requirements

### 9.1 Performance

- Every page and API call responds in under 2 seconds with 5,000+ subscriptions and 20,000+ invoices.
- Server-side pagination on all lists; no unbounded queries.
- Aggregates (SUM, COUNT, GROUP BY) computed in the database.
- Indexes as listed in section 7; verify with EXPLAIN on the heaviest queries.
- A seed script generates test data at this scale to prove the target.

### 9.2 Security

- Hashed passwords, parameterized queries (no string-built SQL), output escaping.
- Role and object-level authorization on every endpoint.
- Reset tokens stored hashed, single use, time limited.
- CORS restricted, security headers set, secrets in environment variables.
- Audit log for sensitive actions (role changes, discount edits, invoice cancel, payment recording).

### 9.3 Validation (client and server)

| Field | Rule |
| --- | --- |
| Email | Valid format, unique, trimmed and lowercased |
| Password | At least 9 characters, uppercase, lowercase, special character |
| Prices, costs, amounts | Numeric, zero or more (payments above 0), two decimals |
| Quantity | Positive integer, at least the plan's minimum |
| Dates | Valid; end after start; availability windows respected |
| Percentages | 0 to 100 (discount 1 to 100) |
| Payment | Not above outstanding balance; invoice must be Confirmed |
| Required fields | Inline error messages beside the field, not only a generic toast |

### 9.4 Reliability and Data Integrity

- Database transactions for invoice creation, payment recording and discount usage.
- Idempotent billing job: running it twice in a row produces no extra invoices.
- Daily database backup script (local dump).

### 9.5 Offline and Local-First

- Local PostgreSQL (SQLite acceptable for early prototype).
- Local SMTP catcher (Mailpit or MailHog) for email in development.
- Local PDF generation (no external API).
- All fonts, icons and libraries bundled; the app runs with no internet access.

### 9.6 Usability and Accessibility

- Responsive from 360px mobile to wide desktop.
- Keyboard navigable, visible focus states, sufficient color contrast, labels on all inputs.

---

## 10. UI and UX Requirements

### 10.1 Design System

- One consistent color palette: a primary brand color, neutral grays, and semantic colors (green for Paid/Active, amber for Pending/Paused, red for Overdue/Cancelled, blue for Draft/Quotation).
- One type scale and spacing scale (4 or 8 px grid) used everywhere.
- Reusable components: buttons, form fields, tables, status badges, modals, toasts, empty states.

### 10.2 Navigation

- **Desktop:** left sidebar plus top bar (user menu, search). **Mobile:** collapsible hamburger menu.
- Sidebar groups (shown by role):
  - **Dashboard**
  - **Sales:** Subscriptions, Quotation Templates, Customers
  - **Billing:** Invoices, Payments
  - **Catalog (Admin):** Products, Plans, Taxes, Discounts
  - **Reports:** Revenue, Overdue, Subscriptions
  - **Settings (Admin):** Users and Staff, Company details
- Customer portal has its own simple navigation: My Subscriptions, My Invoices, Profile.
- Breadcrumbs on detail pages; the active menu item is highlighted.

### 10.3 Key Screens

1. Login, Signup, Forgot and Reset password
2. Dashboard (KPI cards, filters, charts, overdue list)
3. Subscription list (status filters) and detail (lines, status stepper, history, actions, related invoices)
4. Invoice list (status and overdue filters, bulk actions) and detail (lines, totals, payments, PDF preview)
5. Record payment dialog
6. Product, plan, tax, discount, template management forms
7. Customer list and detail
8. Billing run page with results summary
9. Customer portal pages

### 10.4 Interaction Standards

- Confirmation dialog for destructive or irreversible actions (cancel, close).
- Loading skeletons and clear empty states.
- Inline validation errors, success toasts, and disabled buttons while submitting to prevent double clicks.
- Status shown as a stepper on subscription detail (Draft → Quotation → Confirmed → Active → Closed).

---

## 11. Technical Approach

| Layer | Recommended | Alternative |
| --- | --- | --- |
| Frontend | React + Vite + Tailwind CSS | Django templates + Bootstrap |
| Backend | Node.js + Express/NestJS | Django + DRF or FastAPI |
| Database | PostgreSQL | SQLite (prototype only) |
| ORM and migrations | Prisma | Django ORM or SQLAlchemy |
| Auth | JWT or secure cookie + bcrypt | Django auth |
| Scheduler | node-cron | Celery beat or APScheduler |
| PDF | PDFKit or Puppeteer | WeasyPrint or ReportLab |
| Email (dev) | Nodemailer + Mailpit | Django email + Mailpit |
| Validation | Zod (shared client and server schemas) | DRF serializers |
| Testing | Vitest/Jest, Supertest, Playwright | pytest |

No trendy technology is added unless it solves a concrete problem. PostgreSQL is chosen over a document store because billing needs transactions and constraints.

---

## 12. Milestones

| Phase | Scope | Output |
| --- | --- | --- |
| 1. Foundation | Repo, schema, migrations, seed script (5,000+ subscriptions), design system | Running skeleton with data |
| 2. Auth and roles | Signup, login, reset, role guards, staff creation | Secure access layer |
| 3. Catalog | Products, variants, plans, taxes, discounts | Admin configuration complete |
| 4. Sales | Customers, templates, subscriptions, state machine, history | Quote-to-active flow |
| 5. Billing | Invoice generation job, confirm/cancel/send/print, discount application | Automated billing |
| 6. Payments | Payment recording, paid and outstanding logic, overdue detection | Collections tracking |
| 7. Portal | Customer views and allowed actions | Self-service |
| 8. Reporting | Dashboard, filters, summary, CSV export, performance tuning | Finance view under 2 seconds |
| 9. Hardening | Validation audit, security review, tests, README, demo script | Release candidate |

---

## 13. Acceptance Criteria (Key Scenarios)

1. **Signup:** registering with an existing email is rejected; a weak password shows which rule failed; a valid signup logs the user in as Customer.
2. **Reset:** requesting a reset delivers a link to the local mail catcher; the link works once and expires.
3. **Roles:** a Staff user cannot open Discounts or Users; a Customer calling another customer's invoice URL gets 403 or 404.
4. **Variant pricing:** adding the Odoo variant (+560) to a product raises the line's unit price by exactly 560.
5. **Plan rules:** a plan with `pausable = false` shows no Pause action and the API rejects it.
6. **Template:** creating a subscription from a template pre-fills the plan and lines and sets quotation validity.
7. **Lifecycle:** invalid transitions (for example Draft to Active) are rejected; every valid transition appears in history.
8. **Billing:** running the billing job twice on the same day creates each invoice only once; after skipping several days, a catch-up run bills the missed periods exactly once each.
9. **Discount:** a percentage discount valid for the period appears on the next invoice automatically; after its usage limit or end date, it no longer applies.
10. **Payments:** a partial payment leaves the invoice Confirmed with a balance; a payment above the balance is rejected; completing payment marks it Paid.
11. **Overdue:** a Confirmed invoice past due with a balance shows in the overdue report.
12. **Dashboard:** with 5,000+ subscriptions, the dashboard and all lists load in under 2 seconds.
13. **Offline:** the full app works with the internet disabled.

---

## 14. Risks and Mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Double or missed invoices | Revenue loss, customer distrust | Unique constraint, transactional billing, catch-up logic, tests |
| Slow dashboards at scale | Fails the 2-second goal | Indexes, DB aggregates, pagination, seed-data load testing |
| Authorization gaps | Data leak between customers | Centralized permission checks, object-level tests |
| Date edge cases (month-end, leap year) | Wrong billing dates | Dedicated unit tests for the billing-date function |
| Scope creep (gateway, multi-currency) | Missed deadline | Non-goals list; P2 items only after P0 and P1 |
| Floating-point money errors | Incorrect totals | Decimal types only |

---

## 15. Open Questions

1. Should customers be able to self-subscribe to a plan from the portal, or only view subscriptions created by staff?
2. Should multiple discounts be allowed to stack on one invoice line?
3. Are invoice numbers required to follow a specific format or financial-year reset?
4. Is a refund or credit note flow needed for cancelled paid invoices?
5. Does proration apply when a customer changes quantity mid-term?
6. Which payment methods should be supported at launch?

---

## 16. Future Enhancements

- Payment gateway integration (Razorpay, Stripe) with webhooks
- Automated dunning emails and WhatsApp reminders
- Proration and mid-term plan upgrades or downgrades
- Credit notes and refunds
- Multi-currency and multi-company support
- Churn, cohort and MRR movement analytics
- Public API keys for integrations

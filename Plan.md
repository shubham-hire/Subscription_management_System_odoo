# Build Plan — Brightloop Subscription Management System

**Team:** 3 people · 2 backend + 1 frontend · **8-hour build** · single delivery: a working demo
**Stack (locked):** NestJS + Prisma + PostgreSQL · React + Vite + Tailwind CSS · JWT auth · Docker (Postgres)
**Sources:** `PRD Subscription Management System (Brightloop Software).md` (requirements) · `Subscription_Management_System.pdf` (problem statement)

> **Read this first.** In 8 hours we cannot build the PRD; we build the **demo slice** below, flawlessly. Everything else is stretch. When behind, cut from the Cut List — never from the demo path.

---

## 1. What we ship (MVP demo slice) — and what we don't

### IN (must be perfect by T+7)

| # | Capability | PRD refs |
| --- | --- | --- |
| 1 | Signup / login with roles (admin, staff, customer); password rule enforced; backend role guards | AUTH-01..05, 09 |
| 2 | Admin: create product + variant (**Odoo +560** demo case), plan, tax, discount rule | PRD-01..03, PLN-01/02, TAX-01..03, DSC-01..03 |
| 3 | Staff: create customer + subscription with lines → Quotation → Confirmed → Active (valid transitions only, history recorded) | SUB-01..07 |
| 4 | **Run billing now**: invoices generated for due Active subs — pre-filled, taxes + discount auto-applied, **run twice = zero duplicates** (unique constraint), run summary counts | INV-01..05, 09 |
| 5 | Record payment (partial allowed) → Paid at full amount; outstanding balance; overdue computed & filterable | PAY-01..06 |
| 6 | Dashboard KPIs: active subs, revenue collected, outstanding, overdue count + amount; overdue list sorted by days overdue | RPT-01, 04 |
| 7 | Customer portal: sees **own** subscriptions + invoices only (object-level auth); print-friendly invoice view | POR-01..03, 05 |

### OUT of MVP (do not build; do not discuss mid-crunch)

Password reset/forgot · email sending (log to console instead) · server-side PDF (browser print view) · pause/resume · renew · templates UI · CSV export · charts · bulk actions · MRR normalization · audit log UI · multi-currency · 5,000-row seed (300–500 instead) · rate limiting · staff forced password change

### Cut List (cut in this order when behind)

1. Charts / any visual polish beyond demo path
2. CSV export, bulk actions
3. Quotation-template → subscription flow
4. Pause / resume / renew actions
5. Portal self-actions (keep portal read-only)
6. Seed scale-up (300 subs is enough to claim speed)
7. **Never cut:** no-duplicate billing · role/object-level guards · the 7 demo-path capabilities

### Stretch (only if T+6 checkpoint is green)

Pause/resume (+ plan `pausable` flag) · renew · template flow · forgot-password with console/Mailpit link · server PDF · one revenue chart · 5k seed + EXPLAIN proof

---

## 2. Binding decisions (resolve PRD open points — do not re-debate)

| # | Decision |
| --- | --- |
| D1 | Discounts **auto-apply at invoice generation** (PRD §6.3 wins). No hand-picked discount on subscription lines. Best single rule per line. |
| D2 | `plans.price` is **informational** — all totals compute from subscription lines (product sales price + variant extra). |
| D3 | `expiry_date = start_date + 1 billing period` (month-end rule: clamp to last day), editable on create. |
| D4 | Invoice total math per PRD §6.1, in **integer paise / `Decimal`** (decimal.js) — never floats. Server computes totals. |
| D5 | Overdue = status Confirmed **and** balance > 0 **and** due date < today (§6.4 definition). |
| D6 | Subscription-scope discount: distributed **pro-rata across lines pre-tax** (largest remainder, 2dp), so §6.1 line formula stays intact. |
| D7 | JWT bearer token, 24h expiry. Logout = client discards. No refresh tokens, no revocation. |
| D8 | Roles: `admin`, `staff`, `customer`. A user links to a customer row via `users.customer_id`; portal queries always filter by it. |
| D9 | "Run billing now" also does housekeeping in one transaction set: activate Confirmed subs past start date, auto-close expired `auto_close` subs. No cron in MVP. |
| D10 | Quotation validity: template validity days if from template, else 30 days from creation. Expired quotations can't be confirmed. |
| D11 | No customer self-subscribe (portal is read-only in MVP). |
| D12 | Payment methods fixed: cash, card, UPI, bank transfer, cheque. |
| D13 | Line edits allowed only in Draft/Quotation. Mid-term add-on changes = v2 (PDF's "switch on/off" noted as future work). |
| D14 | `min_quantity` enforced per line. Taxes exclusive, per product default, overridable per line. |
| D15 | Timezone: **Asia/Kolkata (IST)** defines "today"; timestamps stored UTC. |
| D16 | Closed subscriptions keep their outstanding invoices collectible. |
| D17 | Invoice numbering: DB sequence, format `INV-000123` / `SUB-000123`. |

*(These supersede the PRD's Open Questions §15 for this build; PRD stays the reference for everything else.)*

---

## 3. Repo layout & environment

```
odoo_hackathon/
├── docker-compose.yml          # postgres:16 (+ mailpit, commented out for MVP)
├── server/                     # NestJS
│   ├── prisma/schema.prisma    # single source of truth for DB (Dev A owns)
│   ├── prisma/seed.ts          # demo catalog + 300–500 subs
│   └── src/
│       ├── common/             # guards (Roles, OwnCustomer), error filter, decimal utils
│       ├── auth/               # signup, login, me
│       ├── catalog/            # products, variants, plans, taxes, discounts
│       ├── sales/              # customers, subscriptions (+ transitions, history)
│       ├── billing/            # run-billing service, invoices, pricing calc
│       ├── payments/           # record payment, balances
│       ├── reports/            # dashboard aggregates, overdue
│       └── portal/             # customer-scoped reads
├── web/                        # React + Vite + Tailwind
│   └── src/
│       ├── api/                # typed client + error handling (PRD §8 error format)
│       ├── components/ui/      # badge, table, dialog, toast, field
│       ├── features/           # auth, dashboard, catalog, subscriptions, invoices, payments, portal
│       └── routes/             # role-based routing
└── docs/
    ├── api-contract.md         # frozen at T+2.5 (copy of PRD §8 + response shapes)
    └── demo-script.md          # §7 of this plan, extracted
```

**Conventions**

- API contract = PRD §8 table verbatim + the response/error shapes below. Frontend codes against mocks until endpoints land.
- Error format (every endpoint): `{ "error": { "code": "VALIDATION_ERROR", "message": "...", "fields": { "email": "Already in use" } } }`
- All lists: `?page=&page_size=` (default 20), server-side pagination only.
- Trunk-based: push to `main` directly during the crunch; prefix commits `feat|fix|chore(scope):`. No PRs, no reviews — the checkpoint syncs are the review.
- Money: `Decimal` end-to-end; serialize as string `"1234.50"`.

---

## 4. Who does what

| Dev | Owns | Also |
| --- | --- | --- |
| **A — Platform** (backend) | Repo, Docker, **Prisma schema + migrations + seed**, auth + role guards, catalog CRUD (products/variants, plans, taxes, discounts), perf/indexes | Schema changes are A's alone — requests go through the T+2/T+4/T+6 syncs |
| **B — Domain** (backend) | Pricing/state-machine/billing-date logic (pure + unit-tested), subscriptions + transitions + history, billing run + invoices, payments, reports aggregates | Writes `docs/api-contract.md` response shapes with C at T0 |
| **C — Frontend** (all UI) | Design system, API client + mocks, auth screens, app shell, dashboard, catalog admin, subscription flow, invoices + payment dialog, portal | Owns the demo machine + demo script; UI cut decisions are C's alone |

**Dependency rule:** B's first 2.5 hours are pure functions (no DB) while A lands the schema; C's first 2.5 hours are mocks. **Nobody waits on anybody before T+2.5.**

---

## 5. Hour-by-hour schedule

### Phase 0 — Night-before prep (~2h, optional but the single biggest lever)

- [ ] **A:** repo scaffold, `docker-compose.yml`, NestJS + Prisma boots, `.env` scheme, lint
- [ ] **B:** implement + unit-test pure modules against PRD §5/§6: `computeInvoice(lines, taxes, discounts)`, `canTransition(from, to, plan)`, `addPeriod(date, period)` incl. month-end & leap-year cases
- [ ] **C:** Vite + Tailwind scaffold, tokens (PRD §10.1 palette), router, mock API layer, login/signup screens
- [ ] **All:** paste PRD §8 into `docs/api-contract.md`, sketch JSON response shapes per endpoint (30 min call)

### T0 → T+1 — Foundations

| Dev | Work |
| --- | --- |
| A | Full Prisma schema (PRD §7 + D-decisions), migrate, seed v1: admin, staff, customer login, one product+variant, one plan, one tax |
| B | Wire pure modules into services; `customers` CRUD; subscription entity + create endpoint |
| C | Auth screens live against mock; token storage; role-based shell (sidebar per PRD §10.2); dashboard skeleton |

*Sync T+0:15 — 10 min contract walkthrough.*

### T+1 → T+2.5 — Core endpoints / core screens

| Dev | Work |
| --- | --- |
| A | `POST /auth/signup|login`, `GET /auth/me`, RolesGuard; minimal `GET/POST /users` (admin) |
| B | Subscription CRUD + transitions (`confirm`, `activate`, `close`) with validation, history writes, plan-flag checks (`closable`) |
| C | Products/variants list + create forms (mock→live flip); subscription create flow with lines + live price math preview |

### ⏱ T+2.5 — **Contract freeze + standup (all, 15 min)**
Endpoints/shapes are now frozen. Changes only via a sync. Flip C's mocks to live endpoints from here.

### T+2.5 → T+4 — Catalog & billing engine

| Dev | Work |
| --- | --- |
| A | Catalog CRUD: plans (flags, availability), taxes, discounts (+ validation D14) |
| B | **Billing run service**: select due Active subs → per-sub transaction → invoice lines via `computeInvoice` → advance `next_billing_date` → unique `(subscription_id, period_start)` → summary `{created, skipped, failed}`; housekeeping per D9 |
| C | Subscription detail (status stepper, lines, history, actions); plans/taxes/discounts admin screens |

### ⏱ T+4 — **Mid-point integration (all, 30 min) — gate**
On the demo machine: login as staff → create product → create subscription → confirm → activate → run billing. Fix all friction before continuing. **If behind: apply Cut List now, not later.**

### T+4 → T+5.5 — Payments & invoices

| Dev | Work |
| --- | --- |
| A | `POST /invoices/:id/payments` (validations PAY-02/06), invoice list/detail endpoints with status/overdue filters + pagination |
| B | Invoice confirm/cancel; confirmed-immutability; overdue computation; report aggregate queries (SQL `GROUP BY`) |
| C | Invoice list (filters, status/overdue badges) + detail + **record-payment dialog** + toasts |

### T+5.5 → T+6.5 — Dashboard, portal, scale

| Dev | Work |
| --- | --- |
| A | Portal endpoints (scoped via `users.customer_id`, object-level checks), indexes per PRD §7, seed 300–500 subs via `createMany` |
| B | `GET /reports/summary` + `/reports/overdue`; pair with C on dashboard wiring |
| C | Dashboard KPIs + overdue list live; portal: My Subscriptions / My Invoices; invoice print view |

### ⏱ T+6 — **Demo-path rehearsal (all, 15 min).** Green → stretch list. Yellow/red → cut + fix.

### T+6.5 → T+7.5 — Freeze & harden (all)

- [ ] Feature freeze. Walk PRD acceptance scenarios 1–13; fix blockers on the demo path only (in MVP: 1, 3, 4, 5, 7, 8, 10, 11)
- [ ] README: run instructions (`docker compose up`, migrate, seed, start both apps) — a judge must be able to run it
- [ ] C: visual pass on demo screens only (empty/loading/error states, badges per §10.1)
- [ ] A: fresh-DB reset script (drop → migrate → seed) verified once

### T+7.5 → T+8 — Dry run

- [ ] Timed full demo on the demo machine, fresh DB, one browser profile per role
- [ ] Commit + tag. Demo script and presenter assignments locked (§7)

---

## 6. Definition of Done (per feature, crunch edition)

1. Endpoint enforces **role** (and **ownership** for portal routes) — tested once with a wrong-role call.
2. Validation errors return the standard error format with `fields`; UI shows them inline.
3. Lists paginate server-side; UI shows loading / empty / error states.
4. Money rendered as ₹ with 2 decimals from string decimals — never float math.
5. The feature was exercised **on the demo path** at least once end-to-end.

---

## 7. Demo script (~6 min, mirrors the PDF's "month at Brightloop")

| # | Scene (say this) | Actor | Action | Proof point |
| --- | --- | --- | --- | --- |
| 1 | "A new customer finds Brightloop online" | Customer | Signup (show weak-password rejection, then valid) | AUTH rules; role lands in portal |
| 2 | "Not everyone sees the same things" | Admin | Log in → sidebar shows Catalog/Users; point out customer portal lacks them | Role guards |
| 3 | "Admin launches a new product" | Admin | Create product + **Odoo variant +₹560**, plan, 18% tax, 10% discount rule | Catalog config |
| 4 | "A sales rep turns a quote into a subscription" | Staff | Create customer + subscription w/ variant line → Quotation → Confirm → Activate | Lifecycle + history |
| 5 | "Billing day — hundreds due at once" | Staff | Click **Run billing** → invoices appear with tax + discount; **click again → 0 created** | No double billing |
| 6 | "The money comes in" | Staff | Record partial payment → balance stays; complete payment → Paid; show overdue filter | Payments logic |
| 7 | "The finance lead's questions, answered in one screen" | Admin | Dashboard KPIs + overdue list (seeded 300+ subs, still instant) | RPT + performance |
| 8 | "No more emailing anyone" | Customer | Portal: own subscriptions + invoices, print an invoice (ownership enforced) | Portal + object auth |

**Presenting:** one driver (C, on the demo machine), one narrator walking the PDF scenes (whoever is most comfortable), one person on standby for judge questions / DB reset.

---

## 8. Risks (8-hour specific)

| Risk | Mitigation |
| --- | --- |
| Schema churn mid-crunch breaks two other devs | A owns schema; changes announced only at the three syncs; migrations additive where possible |
| Contract drift between BE and FE | Freeze at T+2.5; C's mocks share the exact response shapes; error format fixed in `common/` |
| NestJS boilerplate eats Hour 1–2 | Phase-0 prep; escape hatch: drop to one Express app with the same folder layout (decide by T+2 standup, not later) |
| Billing job complexity | B's pure functions are tested before wiring; the unique constraint makes double-billing impossible even under bugs; catch-up loop is the same query |
| Frontend surface too large for one dev | Demo-order build; screens not on the demo path get list-only or nothing |
| Environment fails on site | Phase-0 checklist; demo machine runs everything locally with a verified reset script |
| Scope debate mid-crunch | §1 cut list and §2 decisions are pre-made; the answer to "should we also…" is "stretch list" |

**Syncs (all hands, timeboxed):** T+0:15 contract · T+2.5 freeze · T+4 integration gate · T+6 rehearsal · T+7.5 dry run. Otherwise heads-down; use the group chat.

---

## 9. After the hackathon

The PRD's 9-phase milestone plan (§12) remains the roadmap for the full product: portal actions, pause/renew, templates, forgot-password + Mailpit, server PDF, CSV/charts, 5k-seed performance proof, and hardening. This sprint's code is the foundation — keep migrations clean.

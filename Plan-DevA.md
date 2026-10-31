# Dev A Runbook — Platform Workstream

Companion to [Plan.md](Plan.md) (team plan). This is Dev A's personal checklist for the 8-hour build, with every dependency on **Dev B** flagged inline. During execution, the assistant announces each flag live.

**Legend**

| Flag | Meaning | Action |
| --- | --- | --- |
| `✅` | No dependency — heads down | Build |
| `→ PING B #n` | B is now unblocked | Send the copy-paste message below **immediately**, then continue |
| `⏸ NEEDS B` | You are blocked on B | Switch to the listed fallback task until B's message arrives |

**Iron rule:** you are the only person who edits `prisma/schema.prisma` or creates migrations. If B needs a field, that request happens at a sync (T+0:15 / T+2.5 / T+4 / T+6) — never as a self-serve edit. Every ping assumes work is pushed to `main`.

---

## The ping protocol (copy-paste messages)

| # | Trigger | Message to send |
| --- | --- | --- |
| 1 | Schema migrated | `🔔 A: schema on main — pull, run: npm i && npx prisma migrate dev && npx prisma generate. Models you need: subscriptions, subscription_lines, invoices, invoice_lines, discounts, subscription_status_history. Don't edit schema.prisma — request fields at a sync.` |
| 2 | Seed v1 in | `🔔 A: seed v1 in — logins: admin@brightloop.test / staff@brightloop.test / customer@brightloop.test (all "Passw0rd!"). Catalog: product with Odoo variant +560, 1 monthly plan, 18% tax, 10% discount rule (min qty 2).` |
| 3 | Auth + guard live | `🔔 A: auth + guard on main — POST /auth/signup, /auth/login, GET /auth/me live. Decorate endpoints with @Roles('admin','staff',...); req.user = { id, role, customer_id }.` |
| 5 | Catalog CRUD + seed | `🔔 A: catalog CRUD live (products/variants, plans, taxes, discounts) + seeded 18% tax + 10% discount rule — billing run has data to consume. Shapes in docs/api-contract.md.` |
| 6 | Scale seed in | `🔔 A: 500 subs + ~1200 invoices in DB — reports can be load-tested now.` |

## The ⏸ moments (you wait on B)

| # | Blocked on | Fallback while waiting |
| --- | --- | --- |
| W1 | B's invoice confirm/cancel + billing run (needed to e2e-test `POST /invoices/:id/payments`) | Build invoice DTOs, pagination helper, overdue filter; unit-test the payment validator against a seeded Confirmed invoice; if still waiting, start Step 7 (portal) early |
| W2 | B's schema field requests | Nothing — they come only at syncs; say "noted, at the sync" |

---

## Checklist

### Step 0 — Env (done)
- [x] Node ≥ 20, npm, Docker daemon up

### Step 1 — Team scaffold → after commit, tell C
- [ ] `docker-compose.yml` (postgres:16; Mailpit commented out)
- [ ] `server/` NestJS + Prisma boots; `web/` Vite+React+TS+Tailwind boots
- [ ] `docs/api-contract.md` (PRD §8 + shapes), `docs/demo-script.md` (Plan.md §7), README quickstart, `.gitignore`
- [ ] `server/src/domain/` pure-function skeletons + failing tests (B's starting point)
- [ ] Commit → `✅ no B dependency; C can pull now`

### Step 2 — Schema + seed → **PING B #1 then #2** (critical path)
- [ ] Full schema: PRD §7's 19 tables + Plan.md D1–D17 (`Decimal` money, unique `(subscription_id, period_start)`, `users.customer_id`, status history, billing_runs, audit_log)
- [ ] Check constraints per PRD §7; indexes per PRD §7 (Step 7 adds the rest if pressed)
- [ ] `migrate dev` clean; seed v1 (3 logins, product + Odoo variant +560, 1 plan, tax, discount rule)
- [ ] Commit → ping #1 → ping #2

### Step 3 — common/ + auth → **PING B #3**
- [ ] PrismaService, global error filter (`{error:{code,message,fields}}`), `@Roles()` + RolesGuard, decimal utils
- [ ] `POST /auth/signup|login`, `GET /auth/me`; AUTH-02/03 validations; bcrypt; JWT 24h (D7)
- [ ] Commit → ping #3

### Step 4 — Catalog CRUD → **PING B #5**
- [ ] Products + variants (price extra), plans (flags + PLN-06), taxes (TAX-04), discounts (DSC-06, scope)
- [ ] Admin-only; list endpoints paginated (staff can read)
- [ ] Commit → ping #5

### Step 5 — Contract freeze (sync T+2.5)
- [ ] Diff built endpoints vs `docs/api-contract.md`; raise drift at sync; freeze

### Step 6 — Invoices + payments → **⏸ W1 inside**
- [ ] `GET /invoices` (status/overdue filters, pagination), `GET /invoices/:id`
- [ ] `POST /invoices/:id/payments` (PAY-02/06)
- [ ] E2E test **⏸ W1** — needs B's billing run; use fallback until it lands
- [ ] Commit (endpoints land even if e2e waits)

### Step 7 — Portal + scale → **PING B #6**
- [ ] Portal endpoints scoped via `users.customer_id`; foreign-customer access → 403/404
- [ ] Indexes per PRD §7; scale seed 500 subs / ~1200 invoices
- [ ] Commit → ping #6

### Step 8 — Verify
- [ ] Fresh-DB reset script run twice; wrong-role 403 matrix; validation rejections; builds pass
- [ ] Tell B data is final for report verification

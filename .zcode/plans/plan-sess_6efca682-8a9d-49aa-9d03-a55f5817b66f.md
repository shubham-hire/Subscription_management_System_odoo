# Dev A Guided Build — Full Team Scaffold + Dependency-Narrated Execution

## Context

We're executing the 8-hour hackathon build in [Plan.md](Plan.md) (NestJS + Prisma + Postgres, React + Vite + Tailwind; 2 backend + 1 frontend). You are **Dev A (Platform)** — your workstream is the critical path: Dev B blocks on your schema/auth/seed, and one of your tasks (payments endpoint) blocks on Dev B's invoice confirm/cancel. You asked for a plan that (a) covers your full workstream, (b) scaffolds the whole repo so B and C start unblocked (full team scaffold), and (c) has me **explicitly announce every dependency moment as we build** — when to ping B, when you must wait for B, and what to do while waiting.

## Deliverables

1. **`Plan-DevA.md`** — your personal runbook: task-by-task checklist with dependency flags (`→ PING B` / `⏸ NEEDS B` / fallback tasks), copy-paste chat messages for each ping, and the schema-ownership rule.
2. **The actual implementation** (this session), executed in the order below. At each step I open with a dependency banner — e.g. "🔔 PING B now: schema migrated — send this message: …" or "⏸ payments testing needs B's invoice confirm; meanwhile do X". The runbook's flags are what I'll be following live.

## Execution order (maps to Plan.md §5 timeline)

**Step 0 — Env verify (~2 min):** node ≥ 20, Docker daemon running. Fix or flag before anything else.

**Step 1 — Team scaffold:** `docker-compose.yml` (postgres:16, port 5432; Mailpit commented out), `.gitignore`, monorepo layout (`server/`, `web/`, `docs/`), NestJS + Prisma wired and booting, Vite + React + TS + Tailwind shell booting, `README.md` (currently empty — quickstart: compose up → migrate → seed → run both), `docs/api-contract.md` seeded from PRD §8, `docs/demo-script.md` extracted from Plan.md §7. Commit. **→ C can pull and start the UI immediately; → B can start pure functions.**

**Step 2 — Schema + seed (the critical handoff):** full `prisma/schema.prisma` — all 19 tables from PRD §7 with Plan.md §2 decisions applied (D1–D17: auto-discounts, informational plan price, `Decimal` money, unique `(subscription_id, period_start)`, status history, `users.customer_id`). `prisma migrate dev` clean. Seed v1: admin/staff/customer logins, 1 product + Odoo variant (+560), 1 plan, 18% tax, 1 discount rule. **🔔 PING B #1** ("schema on main, pull + migrate + regenerate client") then **PING B #2** (credentials + catalog contents). Commit.

**Step 3 — common/ + auth:** PrismaService, global error filter producing PRD §8 format (`{error:{code,message,fields}}`), `RolesGuard` + `@Roles()` decorator, decimal helpers, bcrypt + JWT auth module (`signup`, `login`, `me`; password rule per AUTH-03; duplicate-email per AUTH-02). **🔔 PING B #3** ("guard live — decorate endpoints, `req.user = {id, role, customer_id}`"). Commit.

**Step 4 — Catalog CRUD:** products + variants (price-extra), plans (behavior flags + availability window validation PLN-06), taxes (0–100), discounts (DSC-06 rules, scope via `discount_products`). All admin-only via guard. Seed catalog enriched. **🔔 PING B #5** ("catalog data in seed — billing run has something to consume"). Commit.

**Step 5 — Contract freeze support (sync T+2.5):** I verify every endpoint built so far matches `docs/api-contract.md` shapes and flag any drift for the sync.

**Step 6 — Invoices read + payments, with the one ⏸:** `GET /invoices` (status/overdue filters, pagination), `GET /invoices/:id`, `POST /invoices/:id/payments` (PAY-02/06 validations: amount > 0, ≤ outstanding, invoice Confirmed). **⏸ NEEDS B #1:** end-to-end payment testing requires B's invoice confirm + billing run. **Fallback while waiting:** build DTOs/validation/pagination infrastructure and unit-test the payment validator with a seeded Confirmed invoice; if B's billing run lands, test through it. Commit.

**Step 7 — Portal + scale:** portal endpoints scoped by `users.customer_id` (POR-05 object-level), indexes from PRD §7, scale seed (300–500 subs + invoices via `createMany`). **🔔 PING B #6** ("data's in — verify report queries + <2s"). Commit.

**Step 8 — Verification (see below).**

**Not in scope (owned by B/C):** billing run service, transitions/pricing pure functions (I scaffold only skeletons + failing tests in `server/src/domain/` with TODOs from PRD §6 so B starts on red tests), reports module, payments endpoint *for* B, any web UI beyond the shell + auth screens + one demo page for C.

## Verification

- `docker compose up -d` → `prisma migrate dev` + `db seed` on a **fresh DB**, twice (proves reset script).
- Auth: signup (weak-password 400 with field error, duplicate email 400), login → JWT, `me` returns role; staff hitting `POST /products` → 403; customer hitting admin routes → 403 (wrong-role matrix).
- Catalog: CRUD round-trip per entity + validation rejections (PLN-06 date order, TAX-04 range, DSC-06 bounds).
- Payments: >outstanding rejected, ≤0 rejected, Draft invoice rejected (seeded Confirmed invoice for the happy path).
- Portal: customer token requesting another customer's invoice → 403/404.
- Scale seed count check + one timed list query; `npm run build` passes in server and web.
- Git log shows one commit per step (trunk-based per Plan.md).

## During execution — how I narrate dependencies

Every step I run opens with one of: `🔔 PING B #n` (B is unblocked — send the copy-paste message from the runbook now), `⏸ NEEDS B` (you're blocked on B — here's the fallback task until they land), or `✅ no dependency` (heads down). The runbook also lists the two reverse moments where you wait on B (invoice confirm before payments e2e; sync-only schema requests).

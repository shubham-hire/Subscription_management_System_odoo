# Work Done — Brightloop Subscription Management System

*Complete build log for the hackathon delivery. Every claim here is verifiable: commit hashes are referenced, all tests run green at `12ccfb6`, and the demo path was drilled end-to-end on a fresh database at 5k scale.*

## 1. Summary

A subscription-management platform covering the full lifecycle: catalog → quotation → subscription → recurring invoicing → payment collection → finance reporting → customer portal. Built as a **modular monolith** (NestJS + Prisma + PostgreSQL backend, React + Vite + Tailwind frontend, 100% local — no cloud dependencies).

| Deliverable | State |
| --- | --- |
| Backend (12 NestJS modules + domain layer) | ✅ Complete, 20 API route groups |
| Database (19 tables, migrations, constraint-enforced invariants) | ✅ Complete |
| Frontend shell (auth screens, dashboard, API client, design tokens) | ✅ Scaffolded for Dev C |
| Automated tests | ✅ **144 green** (36 unit · 34 domain · 74 integration) |
| Performance at scale | ✅ 5,001 subs / 8,000 invoices: worst page **149 ms** (target 2 s) |
| System design review + scaling roadmap | ✅ `docs/design/brightloop-sms.md` |
| Demo script + contract docs | ✅ `docs/demo-script.md`, `docs/api-contract.md` |

## 2. What was built (by area)

### Platform & schema (Dev A)
- **Monorepo scaffold** (`6305961`): docker-compose (Postgres 16), NestJS server, Vite+React+Tailwind web shell, API contract + demo-script docs, README quickstart.
- **Prisma schema** (`95a9007`): 19 tables with the design's core invariant — `unique (subscription_id, period_start)` makes double billing *impossible by construction* — plus 13 CHECK constraints (date ordering, percentage ranges, positive amounts), race-free `SUB-`/`INV-` DB sequences, and composite indexes per the PRD.
- **Seeds**: v1 (role logins, catalog incl. the Odoo +₹560 variant, demo fixture) and a restartable scale seed (`SCALE=5000`) with explicit numbering + sequence sync.

### Auth & platform services (Dev A)
- Signup / login / me (`dd1a2a1`): password policy (≥9 chars + upper + lower + special, per-rule errors), case-insensitive trimmed emails (DTO-level normalization), customer-record linking on signup, bcrypt hashing, 24 h JWT.
- Global guards (`JwtAuthGuard` → `RolesGuard`), contract error format on every failure (`{error:{code,message,fields}}`), global money-format interceptor (2-decimal strings), Decimal money end-to-end (`d860d64`).

### Catalog, subscriptions, billing, payments, portal, reports (Dev A + absorbed Dev B)
- **Catalog** (`96e1c31`): products + variants (price extra), plans (behavior flags + availability window), taxes, discount rules (product/subscription scope) — admin-write, staff-read role gates, all PRD validations.
- **Domain layer** (`7ef8d5b`): pure, DB-free functions — `addPeriod` (month-end clamp, leap years), `computeLine`/`computeInvoiceTotals` (decimal math, discount clamped at subtotal), `validateTransition` (state machine + plan flags + quotation expiry).
- **Subscriptions** (`71a93ba`): create with snapshot pricing (sales price + variant extra), plan-window and min-quantity enforcement, full lifecycle `draft→quotation→confirmed→active→closed` with per-transition history, line edits locked outside draft/quotation.
- **Billing engine** (`f354f4c`, `eaef691`): catch-up loop over missed periods, **auto-applied discounts** (best single rule per line, usage caps enforced within a run), housekeeping (activate past-start subs, auto-close expired), **per-period transactions** so a crashed period loses nothing, pre-check skips for crash recovery, schedule advance even when losing a race.
- **Invoices & payments** (`4a14b20`): list/detail with computed overdue (confirmed + balance + past-due), partial payments with exact-balance rejections, Paid flip at full settlement, audit logging.
- **Portal** (`c876eda`): customer-scoped subscriptions/invoices/summary; foreign IDs return 404 (object-level authorization, tested).
- **Reports** (`8ad67a5`): dashboard KPIs and overdue list sorted by days-overdue with customer contacts — all aggregates in the database.

### Test suites (`a7da3d0`, `7961cc5`, `f5f146a`)
- **Unit (36)**: money-string validation, money-format interceptor (incl. Prisma's bundled decimal.js via duck-typing), password rules, overdue truth table.
- **Domain (34)**: calendar edges (year rollover, 31→30-day clamps, leap day), rounding edges (half-paisa, ₹0.01, large quantities), state-machine boundaries (same-state, expiry-at-now, flag enforcement).
- **Integration (74, Supertest vs a disposable DB)**: full role matrix, PRD acceptance scenarios #1–#11, concurrency edges, and demo-day hardening (below).

### Demo-day hardening (`f5f146a`) — verified by tests
- **CORS** for the frontend origin (the app was unreachable from the browser without it).
- **Payment row lock** (`SELECT … FOR UPDATE`): simultaneous payers serialize; a double-clicked partial payment can no longer overpay.
- **Billing advisory lock** (session-pinned inside one transaction): parallel "Run billing" clicks → exactly one runs, the rest get `already_running`; lock auto-releases on crash.

### System design & docs (`7e59436`, `12ccfb6`)
- System-design review with a decisions table (solves/worsens/change-triggers), failure stress-test, scaling-ladder position, and a numbered roadmap — `docs/design/brightloop-sms.md`.
- README judge section with measured numbers; PRD ambiguity log; runbooks (`Plan.md`, `Plan-DevA.md`, `Plan-B.md`).

## 3. Bugs the test suites caught and fixed

The tests paid for themselves — eight real defects found before the demo:

| # | Bug | Root cause | Fix |
| --- | --- | --- | --- |
| 1 | Valid emails with whitespace rejected | `IsEmail` ran before normalization | DTO-level trim+lowercase |
| 2 | A skipped billing period aborted the whole transaction | P2002 poisons a Postgres tx | Per-period transactions + pre-check skips |
| 3 | Subscriptions started *today* weren't billed same-day | UTC-midnight vs IST-midnight boundary | "Before tomorrow starts" day semantics |
| 4 | Fresh quotation instantly "expired" | Expiry measured from subscription start | Measured from the draft→quotation history timestamp |
| 5 | Discount caps ignored mid-catch-up | Stale usage read at run start | Run-scoped usage state |
| 6 | Auto-close cancelled the final invoice | Housekeeping ran before billing | Bill first (with expiry horizon), close after |
| 7 | `instanceof Decimal` false across Prisma's bundled copy | Different decimal.js instances | Shape-based detection |
| 8 | Advisory lock leaked across pooled connections | Session locks need one session | Lock held inside one interactive transaction |

## 4. Measured performance (5,001 subs / 8,000 invoices, fresh DB)

| Endpoint | p50 latency | PRD target |
| --- | --- | --- |
| Dashboard summary (KPIs) | **11–25 ms** | < 2 s |
| Overdue report (full list + contacts) | **149 ms** | < 2 s |
| Invoice/subscription lists | **18–21 ms** | < 2 s |
| Customer portal | **5 ms** | < 2 s |

Central demo proof, drilled on a fresh database at 5k scale: billing run created **679 invoices, 0 failures**; the immediate second run created **0** — no double billing, enforced by the database constraint, not by app discipline.

## 5. How this scales (summary — full analysis in the design doc)

Decisions carry numeric change-triggers: the monolith holds until billing needs its own scaling curve; Postgres alone handles ~500× current write load; keyset pagination and nightly rollups are pre-designed for the ~50k-invoice trigger; queues/sharding are explicitly rejected at today's numbers. Position on the scaling ladder: rung 1–2, deliberately.

## 6. Known deferrals (documented, each with its trigger)

Daily billing cron (`BILLING_CRON` toggle planned) · automated backups · token revocation < 24 h · auth rate limiting · statement timeout · audit-log expansion · keyset pagination · KPI rollups · queue-backed email/PDF — see `docs/design/brightloop-sms.md` §7.

## 7. Commit trail

20 commits from `47e6941` (first commit) to `12ccfb6` (final docs), all pushed to `origin/main`. Build log: scaffold → schema → auth → catalog → money-format → invoices/payments → portal → tests → domain → subscriptions → billing → reports → billing fixes → design review → demo hardening → 5k-scale docs.

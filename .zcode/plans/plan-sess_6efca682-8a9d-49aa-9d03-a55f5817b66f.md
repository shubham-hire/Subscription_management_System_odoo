# B's Absorption Plan — Dev A takes the backend, ~4 hours

## Context

Dev B had to leave. Their workstream — domain pure functions, subscriptions lifecycle, the billing engine, and reports — is the only thing standing between the demo path and completion. Dev C continues 100% frontend against the **frozen contract** in `docs/api-contract.md` (they must not wait on you). You absorb all of B's backend solo. Decisions locked: ~4h left · billing-run invoices are created **Confirmed** directly (new decision **D18**) · pause/resume/renew, template flow, and forgot-password are **officially cut**.

**Deliverable:** `Plan-B.md` (this plan, saved as a file) + the implementation executed live with me narrating, same style as the Dev A runbook.

## The 4-hour schedule (blocks in execution order)

**Block 1 (~40 min) — Domain functions, make B's 13 red tests green.**
`server/src/domain/` — skeletons and exact specs already exist, tests in `domain.spec.ts` encode them:
- `billing-dates.ts` `addPeriod(date, period)` — month-end clamp (Jan 31 → Feb 28/29 incl. leap), daily/weekly/monthly/yearly; no mutation.
- `pricing.ts` `computeLine` / `computeInvoiceTotals` — decimal.js, string money, discount clamped at subtotal (DSC-07), tax exclusive (D14).
- `transitions.ts` `validateTransition` — the §5.1 map + plan flags (`pausable`/`closable`/`renewable`) + quotation expiry (D10).
Gate: `npm run test:domain` green before anything else.

**Block 2 (~45 min) — Subscriptions module** (`server/src/sales/`): `POST /subscriptions` (staff/admin), `GET /subscriptions` + `/:id` (staff/admin; customer-own via portal already done), `POST /subscriptions/:id/{confirm,activate,close}`.
- Create: validate customer exists, plan within availability window (PLN-03), per-line: `unit_price = product.salesPrice + variant.priceExtra` (PRD-03, snapshot), quantity ≥ plan.min_quantity (D14), tax defaults `product.taxId`; `expiry = start + 1 period` via `addPeriod` (D3), `next_billing_date = start`, status `draft`, number via DB default.
- Transitions: `validateTransition` from domain + write `subscription_status_history` row (user + timestamp, SUB-05) + update status. Invalid → 400 with the domain error string (acceptance #7).
- Line edits only in draft/quotation (D13) — PATCH lines endpoint, guarded by status.

**Block 3 (~60 min) — Billing engine** (`server/src/billing/`): `POST /billing/run` (staff/admin) — demo scene 5.
One service, per-subscription transactions (INV-04, §6.2):
1. **Housekeeping** (D9): confirmed subs with `startDate ≤ today` → active; active subs on `auto_close` plans with `expiryDate ≤ today` → closed.
2. **Billing loop**: active subs with `nextBillingDate ≤ today`; while true (catch-up for missed periods): build invoice lines from subscription lines; **auto-apply discounts** (§6.3/D1: rules active by date range, `times_used < max_uses`, min qty/purchase met, scope `product` via `discount_products` or `subscription`; best single rule per line by largest saving); compute via `computeLine`/`computeInvoiceTotals`; create invoice **status Confirmed (D18)**, `period_start = nextBillingDate`, number via DB default; increment `times_used` in the same transaction; `nextBillingDate = addPeriod(nextBillingDate, plan.billingPeriod)`.
3. **Idempotency**: unique `(subscription_id, period_start)` → on conflict skip (acceptance #8: run twice → 0 created). Failures don't block the loop (per-sub transaction); count into summary.
4. Record `billing_runs` row + return `{created, skipped, failed, run_id}`.

**Block 4 (~30 min) — Reports** (`server/src/reports/`): `GET /reports/summary` (active subs count, revenue collected = Σ`amountPaid`, outstanding = Σ(`total`−`amountPaid`) where confirmed, overdue count + amount) and `GET /reports/overdue` (confirmed, balance>0, due<today, ordered by dueDate, with customer contact + days overdue — RPT-04). DB aggregates only (§9.1); admin+staff roles.

**Block 5 (~40 min) — Tests + demo-path verification**
- Extend `test/api.e2e.spec.ts` (or new `test/billing.e2e.spec.ts`): variant pricing +560 (acceptance #4), invalid transition rejected + history written (#7), billing run twice → 0 created (#8), catch-up bills missed periods once, discount auto-applies and stops at limit (#9).
- Full walkthrough on dev DB: create sub → confirm → activate → run billing → pay (mirrors scenes 4–6).
- `npm run test:all` green.

**Final 25 min — buffer** for C's integration questions.

## Coordination with C (do this first — 2 min)

Send now: *"Re-plan: B's out, A absorbs backend. Contract in docs/api-contract.md is unchanged and still the truth. Your order: (1) subscription create flow + lifecycle buttons [shapes in contract §Owned by Dev B], (2) Run-billing button → shows `{created,skipped,failed}`, (3) dashboard → GET /reports/summary + /reports/overdue, (4) portal pages [endpoints live]. Invoices from billing arrive Confirmed — no confirm button needed. I'll ping when /subscriptions and /billing/run are live."*

Also: B's `domain/README.md` and the 13 red tests stay — they're now your spec; update `Plan.md` roles table only if time permits.

## Key reuse (no re-implementing)

- `server/src/domain/` stubs + tests — the spec, not just helpers
- `common/money.ts`, `common/validation.ts` (`IsMoneyString`), `common/prisma.service.ts`, error filter — same DTO patterns as `catalog.dto.ts`/`payment.dto.ts`
- Schema already has: unique `(subscription_id, period_start)`, sequences, status-history table, `billing_runs`, indexes — **no migrations needed**
- Payments module consumes billing's Confirmed invoices unchanged

## Verification

1. `npm run test:domain` → 13/13 green (Block 1 gate)
2. `npm run test:integration` → existing 26 + new billing/subscriptions specs green
3. `npm run test:all` green; `nest build` clean
4. Demo-path walkthrough on dev DB (scenes 4–6 end-to-end)
5. Acceptance #4, #7, #8, #9 explicitly asserted by tests

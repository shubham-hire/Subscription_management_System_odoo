# Plan-B.md — B's Workstream Absorbed by Dev A

Trigger: Dev B left (emergency). This is the absorbed workstream plan — ~4 hours, Dev A executes with assistant narration, Dev C continues frontend against the frozen `docs/api-contract.md`.

**Decisions:** D18 (new): billing-run invoices are created **Confirmed** directly. Officially cut: pause/resume/renew transitions, template flow, forgot-password.

## Coordination (first 2 min — message to C)

> Re-plan: B's out, A absorbs backend. Contract in docs/api-contract.md is unchanged and still the truth. Your order: (1) subscription create flow + lifecycle buttons [shapes in contract §Owned by Dev B], (2) Run-billing button → shows `{created,skipped,failed}`, (3) dashboard → GET /reports/summary + /reports/overdue, (4) portal pages [endpoints live]. Invoices from billing arrive Confirmed — no confirm button needed. I'll ping when /subscriptions and /billing/run are live.

## Blocks

### Block 1 (~40 min) — Domain green (gate: `npm run test:domain` 13/13)
- [ ] `domain/billing-dates.ts` `addPeriod` — month-end clamp, leap years, no mutation
- [ ] `domain/pricing.ts` `computeLine` / `computeInvoiceTotals` — decimal.js, DSC-07 clamp, D14 exclusive tax
- [ ] `domain/transitions.ts` `validateTransition` — §5.1 map + plan flags + D10 quotation expiry

### Block 2 (~45 min) — Subscriptions (`server/src/sales/`) → ping C
- [ ] `POST /subscriptions` — plan window (PLN-03), `unit_price = sales + variant extra` (PRD-03), min qty (D14), expiry = start + 1 period (D3), history seed
- [ ] `GET /subscriptions`, `GET /subscriptions/:id` (staff/admin)
- [ ] `POST /subscriptions/:id/{confirm,activate,close}` — `validateTransition` + history row (SUB-05)
- [ ] `PATCH /subscriptions/:id/lines` — draft/quotation only (D13)

### Block 3 (~60 min) — Billing engine (`server/src/billing/`) → ping C
- [ ] `POST /billing/run` — housekeeping (activate/auto-close, D9) → per-sub transactions →
- [ ] discount auto-apply (§6.3/D1, best-per-line) → computeInvoice → **Confirmed invoice (D18)** → advance `next_billing_date` via `addPeriod`, catch-up loop
- [ ] idempotent: unique `(subscription_id, period_start)` skip (acceptance #8); per-sub failure isolation
- [ ] `billing_runs` row + `{created, skipped, failed, run_id}`

### Block 4 (~30 min) — Reports (`server/src/reports/`)
- [ ] `GET /reports/summary` — active subs, revenue collected, outstanding, overdue count + amount (RPT-01)
- [ ] `GET /reports/overdue` — sorted by due date, customer contact, days overdue (RPT-04)

### Block 5 (~40 min) — Tests + demo path
- [ ] Integration tests: acceptance #4 (+560), #7 (transitions), #8 (run twice → 0), #9 (discount lifecycle)
- [ ] Walkthrough scenes 4–6 on dev DB; `npm run test:all` green; `nest build` clean

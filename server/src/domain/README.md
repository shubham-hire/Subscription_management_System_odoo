# domain/ — Dev B's workspace

Pure billing logic. **No Prisma, no Nest imports** — everything here must run in unit tests without a database.

- `billing-dates.ts` — `addPeriod` (PRD §6.2, month-end clamp)
- `pricing.ts` — `computeLine`, `computeInvoiceTotals` (PRD §6.1, decimal.js, string money)
- `transitions.ts` — `validateTransition` (PRD §5.1 state machine)

`npm test` runs `domain.spec.ts` — currently red with `NOT IMPLEMENTED (Dev B)` errors. Make it green, keep it green. Services you write later (`sales/`, `billing/`) call these functions — do not re-implement math inline.

Types for `req.user` and shared DTO helpers live in `src/common/` (Dev A). Ask A at a sync for schema fields — never edit `prisma/schema.prisma`.

# System Design Review — Brightloop SMS

*Method: system-design skill reasoning loop (clarify → estimate → trade-offs → stress-test → scale path). Retrospective analysis of the implemented system.*

## 1. Scope (as built)

**Functional core:** subscription lifecycle (draft→…→closed), automated recurring invoicing, manual payment recording, finance reporting, customer portal.
**Non-functional:** <2s pages at 5k subs / 20k invoices · 100% local (no cloud) · no-double/no-skip billing (DB-enforced) · role + object-level authz on every endpoint.
**Out of scope (v1):** payment gateway, multi-currency, revenue recognition, mobile apps, dunning beyond reminders.

## 2. Back-of-envelope (real numbers)

| Metric | Today | PRD target | Implication |
|---|---|---|---|
| Subscriptions | 501 | 5,000 | — |
| Invoices | 800 | 20,000 | ~40 MB with lines; a decade of operation < 2 GB |
| Write QPS | billing burst ≈ 5–10/s for ~1 min/day; payments ≈ 3/min | same order | Trivial for one Postgres (~1k QPS ceiling) |
| Read QPS | < 5 (3 users) | ~50–100 peak (5k customers, month-end burst) | 10× headroom on rung 1–2 |
| Read:write | ≈ 20:1, read-heavy | same | Growth levers are replicas/cache — never sharding |

**Conclusion from the numbers:** this is a tiny-scale, read-mostly, correctness-critical system. Every "scale" technology (queues, caches, shards, multi-region) is unjustified today. The real risks are **correctness under concurrency** and **operations**, not load.

## 3. Decisions table

| Decision | Solves | Worsens | Change it when… |
|---|---|---|---|
| Modular monolith (NestJS, single node) | 3-dev velocity; cross-module ACID (payment + invoice in one tx) | Independent scaling/deploys; blast radius of a bad deploy | Billing volume needs its own scaling curve, or a 2nd team needs independent deploys |
| PostgreSQL as the only datastore; invariants as DB constraints (unique `(subscription_id, period_start)`, sequences, CHECKs) | Double-billing impossible *by construction*; race-free numbering; DB-side aggregates | Horizontal write scaling; rich search | Sustained write QPS > ~500, or full-text/geo search becomes a requirement (→ rung 9, far away) |
| Manual-trigger billing; per-period transactions; pre-check skips; catch-up loop | Crash-resumable; demo-deterministic; exactly-once per period via constraint | Needs a human; renewals can be missed (the PRD's #1 pain!) | A daily cron lands (P1) — then the manual endpoint becomes the override, not the trigger |
| Stateless JWT, 24h | Zero session infra; trivial horizontal scaling | No revocation — deactivation doesn't kill live tokens | "Deactivated staff must lose access immediately" becomes a requirement (P1: isActive check in guard, 60s cache) |
| Denormalized `amountPaid`/`status` on invoice | O(1) list filters; overdue = indexed predicate | Write-time consistency — concurrent payments can race past the balance check | Any real concurrent-payment contention (P0: `SELECT … FOR UPDATE`) |
| Money as Decimal + 2-decimal strings via one interceptor | No float drift anywhere; one normalization point | Clients parse strings | Essentially never — this is correct at any scale |
| OFFSET pagination, live aggregate KPIs | Simple; fast at current size | Page-N scans grow linearly; dashboard re-aggregates every load | Invoice count > ~50k or list p95 > 500ms (P2: keyset pagination + nightly rollup table) |

## 4. Stress-test (failure modes)

| Failure | Today's behavior | Containment (P0 = before demo) |
|---|---|---|
| Browser → API first contact | CORS was absent — every POST preflight failed. | ✅ **Implemented**: `enableCors` with `CORS_ORIGINS` allowlist (+ test) |
| Two simultaneous "Run billing" clicks | Constraint prevents duplicates ✓, but double work + lying summary | ✅ **Implemented**: `pg_try_advisory_lock` (session-pinned); concurrent run returns `already_running` (+ test) |
| Two simultaneous payments on one invoice | Both read `outstanding=100`, both succeed → **overpayment** | ✅ **Implemented**: `SELECT … FOR UPDATE` on the invoice row (+ test) |
| Demo machine ≠ IST timezone | "Billing day" shifts by 5.5h silently | **Deferred (roadmap #1)**: demo machine is IST; make day boundaries `BUSINESS_TZ`-explicit when deploying elsewhere |
| Cron absent | Renewals/expiry reminders never fire — the PRD's original pain returns | P1: `@nestjs/schedule` 00:05 IST (jittered off :00 per task-scheduling skill), same `run()`; advisory lock = split-brain guard |
| Disk dies / `compose down -v` | Total data loss; no backups exist | P1: nightly `pg_dump` to a volume (PRD §9.4) |
| Brute-force `/auth/login` | Unthrottled | P1: `@nestjs/throttler` 5/min on auth (fail-closed) |
| Runaway report query | Holds a connection indefinitely | P1: `statement_timeout` (e.g. 5s) on the app role |
| Billing run longer than expected | No lease concept; concurrent manual run is the only overlap | Covered by advisory lock; lease/heartbeat machinery = YAGNI until multi-node (task-scheduling skill: one periodic job on one box → cron is fine) |

**Deliberately NOT added (per skill guardrails):** circuit breakers/bulkheads (no remote dependencies — everything is in-process + local Postgres), queues (nothing async yet), caches (working set fits in RAM; DB is fast), multi-region. Each would be complexity without a triggering number.

## 5. Scaling ladder position

**Rung 1–2 of 9** (app + DB co-located on one Docker host). The ladder's own warning applies: most systems live at rung 4–6 forever. The next rung for THIS system is only "split DB host + vertical scale," and only the 50k-invoice trigger from §3 ever demands it. Sharding is never reached — billing data is tiny and partitionable by customer if it ever were.

## 6. Weakest point

**The single un-backup-ed Postgres with human-triggered billing is the design's breaking point — not load, but an operational failure (disk death or a missed human trigger) silently stops the company's revenue engine.** Fix: nightly pg_dump + cron-wrapped `run()` with the advisory lock — both P1, half a day combined. Under load growth, the first thing to break is OFFSET pagination and live KPI aggregation at ~50k invoices; the move then is keyset pagination + a nightly rollup table (P2).

## 7. Roadmap (one bottleneck at a time)

- **P0 (≈1h, demo-critical):** CORS · payment row-lock · billing advisory lock · explicit `BUSINESS_TZ`
- **P1 (≈½ day):** cron scheduler · pg_dump backups · isActive-in-guard token revocation · auth rate limiting · statement_timeout · audit-log expansion (PRD §9.2)
- **P2 (post-hackathon):** keyset pagination · nightly rollup for KPIs · pg-boss queue for email/PDF/reminders · OpenAPI generation for contract-drift CI · k6 load proof of the 2s claim at 5k seed

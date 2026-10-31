# Hackathon-Readiness Plan — scoped to "nothing fails on stage"

## Context

The goal is restated: **hackathon-ready product**, not a scalability project. The system-design review already lives in `docs/design/brightloop-sms.md` (committed, pushed) — its decisions table and scaling roadmap are the "we know how this scales" story for judges. The product itself needs only the fixes that can break the live demo. Everything P1/P2 from the scalability plan (cron, backups, rate limiting, revocation, keyset pagination, rollups, k6) is explicitly deferred and documented as future work — that deferral IS the design discipline the review endorsed.

**Total: ~1.5 hours of code, then rehearsal.**

## Phase 1 — Three demo-blocking fixes (~1h, all in server/)

1. **CORS** (`server/src/main.ts`): `app.enableCors({ origin: ['http://localhost:5173'] })`, origin from `CORS_ORIGINS` env. Without this, C's browser app fails preflight on every POST — the single most likely on-stage failure.
2. **Payment double-click lock** (`server/src/payments/payments.service.ts`): `SELECT … FOR UPDATE` on the invoice row inside the existing transaction, before the balance check. A double-clicked partial payment currently overpays; after this, the second request sees the updated outstanding and is rejected with the exact balance.
3. **Billing double-run lock** (`server/src/billing/billing.service.ts`): `pg_try_advisory_lock` at the top of `run()`, unlock in `finally`; a concurrent run returns `{ status: 'already_running', … }`. The constraint already prevents duplicates — this makes the "run twice" demo scene deterministic under nervous clicking.

**Tests** (extend `server/test/edge.e2e.spec.ts` or new `test/demo-hardening.e2e.spec.ts`): two parallel billing runs → exactly one creates; two parallel payments → exactly one succeeds; CORS preflight (`OPTIONS /auth/login` with Origin header → 204 + `Access-Control-Allow-Origin`).

## Phase 2 — Demo polish (~20 min)

4. **Seed bump to 5,000 subs** (optional but recommended): `SCALE=5000 npx ts-node prisma/seed-scale.ts` — the constants already read cleanly; makes the PRD's "5,000+ subscriptions < 2s" claim literal for scene 7. Verify endpoint timings stay well under 2s (currently ~15ms at 800 invoices).
5. **README judge section**: add a short "System design & scaling" paragraph pointing to `docs/design/brightloop-sms.md` (decisions table + roadmap) and the test counts. Judges read the README first.
6. **`BUSINESS_TZ` note only** — skipped as code (demo machine is IST; local-midnight logic is correct there); recorded as the first roadmap item in the design doc.

## Phase 3 — Rehearsal gate (~30 min)

7. Full suites green: `npm test` (36) + `test:domain` (46) + `test:integration` (69+).
8. Fresh-DB drill: `docker compose down -v && up -d` → migrate → seed → scale-seed → demo-path curl walkthrough (scenes 4–6).
9. `nest build` + `vite build` clean; commit + push (2 commits).

## Verification

- Preflight check: `curl -s -X OPTIONS http://localhost:4000/auth/login -H "Origin: http://localhost:5173" -H "Access-Control-Request-Method: POST"` → 204 with allow-origin header.
- Parallel-run test output: exactly one `created > 0`, other `already_running`.
- Parallel-payment test output: exactly one 201.
- Timed dashboard/report/list curls at 5k seed: all < 2s (expect < 100ms).
- All suites green, builds clean, pushed to `origin/main`.

## Explicitly out of scope (documented as the roadmap in the design doc)

Cron billing, backups, rate limiting, token revocation, statement timeout, audit expansion, keyset pagination, rollup tables, k6 — each with its numeric trigger already written down. If judges ask "how does this scale," the answer is the design doc, not more code.

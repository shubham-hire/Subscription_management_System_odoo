# Brightloop Subscription Management System

Hackathon build — runs the full subscription lifecycle: catalog, subscriptions, recurring invoicing, payments, reporting, customer portal.

**Stack:** NestJS + Prisma + PostgreSQL · React + Vite + Tailwind · JWT auth · 100% local (no cloud).

## Quickstart

```bash
# 1. Database
docker compose up -d

# 2. Backend (terminal 1)
cd server
npm install
npx prisma migrate dev     # creates schema
npx prisma db seed         # demo data (logins below)
npm run start:dev          # http://localhost:4000

# 3. Frontend (terminal 2)
cd Frontend
npm install
npm run dev                # http://localhost:5173
```

## Seeded logins

| Role | Email | Password |
| --- | --- | --- |
| Admin | admin@brightloop.test | `Passw0rd!` |
| Staff | staff@brightloop.test | `Passw0rd!` |
| Customer | customer@brightloop.test | `Passw0rd!` |

## Layout

| Path | What | Owner |
| --- | --- | --- |
| `server/prisma/` | schema + migrations + seed | Dev A |
| `server/src/common/` | guards, error filter, decimal utils | Dev A |
| `server/src/domain/` | pure billing/pricing/transition logic + tests | Dev B |
| `server/src/{auth,catalog}/` | auth, products/plans/taxes/discounts | Dev A |
| `server/src/{sales,billing,payments,reports}/` | subscriptions, invoices, payments, reports | Dev A (absorbed) |
| `server/src/{customers,users}/` | customer records, staff administration | Dev A |
| `Frontend/` | React SPA (all screens) | Dev C |

## System design & scaling

This is a modular monolith (NestJS + PostgreSQL) chosen deliberately: at 3 devs and 5k subscriptions, one deployable with DB-enforced invariants beats microservices. The full reasoning — decisions table, failure stress-test, scaling-ladder position, and the numbered roadmap (what we build when load actually demands it) — lives in [docs/design/brightloop-sms.md](docs/design/brightloop-sms.md).

**Measured at 5,000+ subscriptions / 8,000+ invoices:** dashboard summary 25ms · overdue report 149ms · list endpoints < 25ms — an order of magnitude inside the PRD's 2-second target. Verified by 255 automated tests (unit + domain + integration + frontend), including concurrency edge cases (parallel billing runs, double-clicked payments) and the newer admin/portal modules.

## Docs

- [docs/api-contract.md](docs/api-contract.md) — frozen endpoint shapes
- [docs/demo-script.md](docs/demo-script.md) — 6-minute demo order
- [Plan.md](Plan.md) — team plan · [Plan-DevA.md](Plan-DevA.md) — Dev A runbook

## Tests

**190 automated tests** across the whole system (51 server unit · 70 domain logic · 94 API integration · 9 frontend client).

```bash
cd server
npm test                 # server unit (51) — error filter, money format, validation, password rules, overdue logic
npm run test:domain      # pure billing/state-machine tests (70) — calendar edges, rounding, transitions
npm run test:integration # Supertest suites (94) — real API vs disposable brightloop_test DB,
                         #   incl. edge cases: input normalization, token expiry, validation bounds,
                         #   lifecycle boundaries, discount caps, auto-close ordering, crash recovery
npm run test:all         # everything
cd ../Frontend && npm test  # frontend unit + client tests (40): money, dates (incl. the
                         #   ISO-timestamp formatDate regression), zod schemas, API client
```

Integration tests boot the real Nest app (guards, pipes, filters, interceptor) against
`brightloop_test` (recreated each run) — the demo DB is never touched.

## Reset everything

```bash
docker compose down -v && docker compose up -d
cd server && npx prisma migrate deploy && npx prisma db seed && npx ts-node prisma/seed-scale.ts
```

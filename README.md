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
cd web
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
| `server/src/{sales,billing,payments,reports}/` | subscriptions, invoices, payments, reports | Dev B |
| `web/` | React app | Dev C |

## Docs

- [docs/api-contract.md](docs/api-contract.md) — frozen endpoint shapes
- [docs/demo-script.md](docs/demo-script.md) — 6-minute demo order
- [Plan.md](Plan.md) — team plan · [Plan-DevA.md](Plan-DevA.md) — Dev A runbook

## Tests

```bash
cd server
npm test                 # unit (36) — money format, validation, password rules, overdue logic
npm run test:domain      # pure billing/state-machine tests (46) — calendar edges, rounding, transitions
npm run test:integration # Supertest suites (69) — real API vs disposable brightloop_test DB,
                         #   incl. edge cases: input normalization, token expiry, validation bounds,
                         #   lifecycle boundaries, discount caps, auto-close ordering, crash recovery
npm run test:all         # everything
```

Integration tests boot the real Nest app (guards, pipes, filters, interceptor) against
`brightloop_test` (recreated each run) — the demo DB is never touched.

## Reset everything

```bash
docker compose down -v && docker compose up -d
cd server && npx prisma migrate deploy && npx prisma db seed && npx ts-node prisma/seed-scale.ts
```

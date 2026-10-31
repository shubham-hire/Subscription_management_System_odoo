#!/usr/bin/env bash
# Brightloop dev launcher — one command for the whole stack:
#   ./dev.sh          start DB + backend + frontend (skips anything already running)
#   ./dev.sh stop     stop backend + frontend (DB stays up)
#   ./dev.sh status   show what's running
#   ./dev.sh logs [backend|frontend]   tail a service log (Ctrl-C to exit)
#   ./dev.sh reset    wipe the DB volume, re-migrate, re-seed
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
LOG_DIR="$ROOT/.dev-logs"
BACKEND_PORT=4000
FRONTEND_PORT=5173
mkdir -p "$LOG_DIR"

c_green='\033[32m'; c_yellow='\033[33m'; c_red='\033[31m'; c_dim='\033[2m'; c_off='\033[0m'
info()  { printf "${c_green}✓${c_off} %s\n" "$1"; }
warn()  { printf "${c_yellow}•${c_off} %s\n" "$1"; }
fail()  { printf "${c_red}✗${c_off} %s\n" "$1" >&2; exit 1; }

port_pid() { lsof -ti tcp:"$1" -sTCP:LISTEN 2>/dev/null | head -1 || true; }
wait_for_port() { # $1=port $2=timeout_s
  local waited=0
  until [ -n "$(port_pid "$1")" ]; do
    sleep 1; waited=$((waited+1))
    [ "$waited" -ge "$2" ] && return 1
  done
  return 0
}

cmd_status() {
  local db backend frontend
  db=$(docker ps --filter name=brightloop-db --filter status=running -q 2>/dev/null)
  backend=$(port_pid $BACKEND_PORT)
  frontend=$(port_pid $FRONTEND_PORT)
  [ -n "$db" ]      && info "db       : docker (brightloop-db) on :5432"      || warn "db       : not running  → docker compose up -d"
  [ -n "$backend" ] && info "backend  : pid $backend on :$BACKEND_PORT"   || warn "backend  : not running  → ./dev.sh"
  [ -n "$frontend" ]&& info "frontend : pid $frontend on :$FRONTEND_PORT" || warn "frontend : not running  → ./dev.sh"
}

cmd_stop() {
  for svc in "server" "Frontend"; do
    pkill -f "$ROOT/$svc" 2>/dev/null && info "stopped $svc" || warn "$svc not running"
  done
  echo "Database left running (docker compose down -v to also wipe it)."
}

cmd_logs() {
  case "${1:-}" in
    backend)  tail -f "$LOG_DIR/backend.log" ;;
    frontend) tail -f "$LOG_DIR/frontend.log" ;;
    *) fail "usage: ./dev.sh logs [backend|frontend]" ;;
  esac
}

start_db() {
  if docker ps --filter name=brightloop-db --filter status=running -q | grep -q .; then
    info "db already running (brightloop-db)"
  else
    (cd "$ROOT" && docker compose up -d)
    wait_for_port 5432 30 || fail "postgres did not come up on :5432"
    info "db started (brightloop-db on :5432)"
  fi
}

ensure_deps() {
  [ -d "$ROOT/server/node_modules" ]    || { warn "installing server deps…";    (cd "$ROOT/server"    && npm install); }
  [ -d "$ROOT/Frontend/node_modules" ]  || { warn "installing frontend deps…";  (cd "$ROOT/Frontend"  && npm install); }
}

ensure_db_schema() {
  local has_users
  has_users=$(docker exec brightloop-db psql -U brightloop -d brightloop -tAc \
    "SELECT to_regclass('public.users') IS NOT NULL" 2>/dev/null || echo f)
  if [ "$has_users" != "t" ]; then
    warn "fresh database — applying migrations + seed…"
    (cd "$ROOT/server" && npm run db:migrate && npm run db:seed)
    info "database migrated and seeded"
  else
    info "database schema present"
  fi
}

start_backend() {
  if [ -n "$(port_pid $BACKEND_PORT)" ]; then
    info "backend already running on :$BACKEND_PORT"
  else
    (cd "$ROOT/server" && nohup npm run start:dev > "$LOG_DIR/backend.log" 2>&1 &)
    wait_for_port $BACKEND_PORT 90 || { tail -20 "$LOG_DIR/backend.log"; fail "backend did not come up on :$BACKEND_PORT"; }
    info "backend started on :$BACKEND_PORT (log: .dev-logs/backend.log)"
  fi
}

start_frontend() {
  if [ -n "$(port_pid $FRONTEND_PORT)" ]; then
    info "frontend already running on :$FRONTEND_PORT"
  else
    (cd "$ROOT/Frontend" && nohup npm run dev > "$LOG_DIR/frontend.log" 2>&1 &)
    wait_for_port $FRONTEND_PORT 60 || { tail -20 "$LOG_DIR/frontend.log"; fail "frontend did not come up on :$FRONTEND_PORT"; }
    info "frontend started on :$FRONTEND_PORT (log: .dev-logs/frontend.log)"
  fi
}

cmd_reset() {
  warn "wiping database volume…"
  (cd "$ROOT" && docker compose down -v)
  (cd "$ROOT" && docker compose up -d)
  wait_for_port 5432 30
  (cd "$ROOT/server" && npm run db:migrate && npm run db:seed)
  info "database reset, migrated and seeded"
  echo "Restart backend so Prisma reconnects: ./dev.sh stop && ./dev.sh"
}

case "${1:-up}" in
  up)
    start_db
    ensure_deps
    ensure_db_schema
    start_backend
    start_frontend
    echo
    echo "  Frontend : http://localhost:$FRONTEND_PORT"
    echo "  Backend  : http://localhost:$BACKEND_PORT"
    echo "  Logins   : admin@brightloop.test | staff@brightloop.test | customer@brightloop.test  (Passw0rd!)"
    ;;
  stop)   cmd_stop ;;
  status) cmd_status ;;
  logs)   shift; cmd_logs "${1:-}" ;;
  reset)  cmd_reset ;;
  *)      fail "usage: ./dev.sh [up|stop|status|logs|reset]" ;;
esac

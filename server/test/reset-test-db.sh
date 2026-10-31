#!/bin/sh
# Recreates the disposable test database and applies the schema.
# Usage: sh test/reset-test-db.sh   (requires the brightloop-db container up)
set -e

docker exec brightloop-db psql -U brightloop -d postgres \
  -c "DROP DATABASE IF EXISTS brightloop_test;" \
  -c "CREATE DATABASE brightloop_test;"

cd "$(dirname "$0")/.."
DATABASE_URL="postgresql://brightloop:brightloop@localhost:5432/brightloop_test?schema=public" \
  npx prisma migrate deploy

echo "test database ready"

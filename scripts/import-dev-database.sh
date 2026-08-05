#!/usr/bin/env bash

set -Eeuo pipefail

project_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
dump_file="${DEV_DATABASE_DUMP:-${project_dir}/export/database.dump}"
target_database_url="${TARGET_DATABASE_URL:-postgresql://postgres:postgres@127.0.0.1:5173/webontour}"

for command_name in psql pg_restore pnpm; do
  if ! command -v "${command_name}" >/dev/null 2>&1; then
    echo "Required command not found: ${command_name}" >&2
    exit 1
  fi
done

if [[ ! -r "${dump_file}" ]]; then
  echo "Database export is not readable: ${dump_file}" >&2
  exit 1
fi

# Fail before changing anything unless the destination is genuinely empty.
relation_count="$({
  psql "${target_database_url}" \
    --no-psqlrc \
    --set=ON_ERROR_STOP=1 \
    --tuples-only \
    --no-align \
    --command="
      SELECT count(*)
      FROM pg_class AS c
      JOIN pg_namespace AS n ON n.oid = c.relnamespace
      WHERE c.relkind IN ('r', 'p', 'S', 'v', 'm', 'f')
        AND n.nspname NOT IN ('pg_catalog', 'information_schema')
        AND n.nspname NOT LIKE 'pg_toast%';
    "
} | tr -d '[:space:]')"

if [[ ! "${relation_count}" =~ ^[0-9]+$ ]]; then
  echo "Could not determine whether the target database is empty." >&2
  exit 1
fi

if (( relation_count != 0 )); then
  echo "Refusing to import: the target database is not empty (${relation_count} relations found)." >&2
  exit 1
fi

echo "Restoring the development database export..."
pg_restore \
  --dbname="${target_database_url}" \
  --exit-on-error \
  --no-owner \
  --no-privileges \
  --single-transaction \
  "${dump_file}"

echo "Applying migrations added after the exported schema..."
(
  cd "${project_dir}"
  DATABASE_URL="${target_database_url}" pnpm exec prisma migrate resolve --applied 0_init
  DATABASE_URL="${target_database_url}" pnpm exec prisma migrate deploy
)

echo "Development database import completed."

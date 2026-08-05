#!/usr/bin/env bash

set -Eeuo pipefail

project_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
dump_file="${DEV_DATABASE_DUMP:-${project_dir}/export/database.dump}"
target_database_url="${TARGET_DATABASE_URL:-postgresql://postgres:postgres@127.0.0.1:5173/webontour}"
postgres_cli_image="${POSTGRES_CLI_IMAGE:-docker.io/library/postgres:18-alpine}"

if [[ -n "${CONTAINER_RUNTIME:-}" ]]; then
  container_runtime="${CONTAINER_RUNTIME}"
elif command -v podman >/dev/null 2>&1; then
  container_runtime="podman"
elif command -v docker >/dev/null 2>&1; then
  container_runtime="docker"
else
  echo "Required command not found: podman or docker" >&2
  exit 1
fi

if ! command -v "${container_runtime}" >/dev/null 2>&1; then
  echo "Required command not found: ${container_runtime}" >&2
  exit 1
fi

container_run=(
  "${container_runtime}" run
  --rm
  --network=host
)
migration_image="localhost/webontour-import-migrate:$$"

cleanup() {
  "${container_runtime}" image rm "${migration_image}" >/dev/null 2>&1 || true
}

if [[ ! -r "${dump_file}" ]]; then
  echo "Database export is not readable: ${dump_file}" >&2
  exit 1
fi

# Build the migration tooling before changing the destination database. The
# temporary image is removed on exit, while the container engine may retain its
# reusable build cache.
echo "Building temporary migration image..."
"${container_runtime}" build \
  --target=migrate \
  --tag="${migration_image}" \
  "${project_dir}"
trap cleanup EXIT

# Fail before changing anything unless the destination is genuinely empty.
relation_count="$({
  "${container_run[@]}" "${postgres_cli_image}" psql "${target_database_url}" \
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
"${container_run[@]}" --interactive "${postgres_cli_image}" pg_restore \
  --dbname="${target_database_url}" \
  --exit-on-error \
  --no-owner \
  --no-privileges \
  --single-transaction \
  < "${dump_file}"

echo "Applying migrations added after the exported schema..."
"${container_run[@]}" \
  --env "DATABASE_URL=${target_database_url}" \
  "${migration_image}" \
  pnpm exec prisma migrate resolve --applied 0_init
"${container_run[@]}" \
  --env "DATABASE_URL=${target_database_url}" \
  "${migration_image}" \
  pnpm exec prisma migrate deploy

echo "Development database import completed."

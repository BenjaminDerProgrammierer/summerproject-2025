# Unify Express and Vite Using TypeScript, Prisma, and the Database Export

## Summary

- Use the PostgreSQL 18.4 export in `export/` as the migration source; never connect implementation tooling to production.
- Migrate the Express server to strict TypeScript before merging directories.
- Build a clean Prisma 7 model over the restored schema and preserve all database records.
- Merge client and server into one package, with `src/index.html` as Vite's entry.
- Replace generic admin CRUD with an authenticated Prisma Studio React island.
- Restore attachment metadata only; uploaded files are explicitly unavailable.
- Defer production packaging, deployment, and live database migration.

## Export restoration and schema cleanup

- Keep `/export/` ignored and verify neither dump is staged.
- Use the minimal PostgreSQL 18 service in `compose.yaml` as the local development and migration provider for now.
- Restore the dump only into disposable PostgreSQL 18 source and target databases.
- Preserve physical snake-case names while exposing clean Prisma model and field names through mappings.
- Preserve IDs, password hashes, content, settings, comments, tags, keys, timestamps, and relations.
- Generate a `0_init` baseline followed by a separate, evidence-backed cleanup migration.
- Remove redundant indexes only where existing constraints already provide equivalent coverage.
- Tighten nullable fields only when profiling proves all rows are compatible.
- Preserve attachment metadata, but do not claim file integrity without an attachment archive.
- Remove stored JWT/master-key rows from migrated targets and require new environment secrets.

Local restore sequence (destructive only to the Compose-managed `webontour` database):

```sh
podman compose up -d database
podman compose exec -T database pg_restore --username=postgres --dbname=webontour --clean --if-exists --no-owner --no-acl /export/database.dump
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/webontour pnpm prisma migrate resolve --applied 0_init
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/webontour pnpm prisma migrate deploy
```

## Strict server TypeScript and Prisma conversion

- Convert every server file to strict TypeScript before moving directories or changing persistence behavior.
- Type environment configuration, sessions, JWT payloads, authenticated requests, uploads, errors, DTOs, and database boundaries.
- Validate untrusted route input with shared Zod schemas.
- Add Prisma 7 with `@prisma/adapter-pg` and `DATABASE_URL`.
- Replace startup schema creation and direct SQL access with migrations, seeds, Prisma operations, and typed transactions.
- Preserve current REST paths and JSON response shapes.

## Unified package and secured Prisma Studio

- Consolidate dependencies, scripts, environment configuration, and lockfiles into one root package.
- Move code into `src/client`, `src/server`, and `src/shared`; place the Vite entry at `src/index.html`.
- Run Express as the single development process and mount Vite in middleware mode.
- Remove generic admin table CRUD and replace it with a React-based Prisma Studio island.
- Protect Studio with the existing admin authentication, an explicit feature flag, same-origin and CSRF checks, request limits, and audit metadata.

## Verification and assumptions

- Require strict client/server typechecks, Prisma validation/generation, frozen install, audit, and Vite build.
- Compare source and target database counts, keys, relations, sequences, and representative data.
- Regression-test authentication, authorization, posts, comments, settings, uploads, documents, Swagger, health, SPA routing, and Studio security.
- Keep the export local and out of commits and logs.
- Production runtime, live migration execution, deployment, rollback, and monitoring remain out of scope.

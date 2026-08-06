# WEBonTour

WEBonTour Blog System

## Requirements

- Node.js 24 or newer
- pnpm 11.20 or newer, installed globally
- Podman Compose or Docker Compose for the local PostgreSQL 18 database

## Setup

1. Copy `.env.example` to `.env` and replace its placeholder secrets. `./generate-secrets.sh` generates suitable values.
2. Install dependencies with `pnpm install`.
3. Start PostgreSQL with `podman compose up -d database`.
4. Apply the schema with `pnpm db:migrate`.
5. Start the unified development server with `pnpm dev`, then open <http://localhost:3000>.

Inside Distrobox, start the host's Podman service with:

```sh
distrobox-host-exec podman compose up -d database
```

Express is the only application process. In development it mounts Vite as middleware; in production it serves the built client and API from the same origin.

## Commands

- `pnpm dev` — run Express and Vite with automatic reloads
- `pnpm build` — generate Prisma Client and build the server and client
- `pnpm start` — build, migrate the database, and run the application in production mode
- `pnpm typecheck` — type-check the server, client, and build configuration
- `pnpm db:validate` — validate the Prisma schema
- `pnpm db:generate` — regenerate Prisma Client
- `pnpm db:migrate` — deploy pending database migrations

For a production-like local check, run `pnpm start`.

## Docker

Copy `.env.example` to `.env` and replace the placeholder secrets (Run `./generate-secrets.sh`), then build and
start the complete application stack:

```sh
docker compose up --build -d
docker compose ps
```

Open <http://localhost:3000>. The application container waits for PostgreSQL and
applies pending Prisma migrations before starting the server. PostgreSQL data and
uploaded attachments are stored in the `postgres-data` and `attachments` named
volumes. Markdown documents are mounted read-only from `content/`.

## Configuration

- `DATABASE_URL` — PostgreSQL connection URL; required
- `JWT_SECRET` — secret used to sign authentication tokens; required
- `MASTER_SIGNUP_KEY` — master key used to create initial signup access; required
- `PORT` — HTTP port, default `3000`
- `APP_URL` — public application origin used for links in email, default `http://localhost:3000`
- `CORS_ORIGIN` — optional allowed cross-origin client origin
- `ENABLE_PRISMA_STUDIO` — expose the admin-only embedded Prisma Studio when set to `true`; disabled by default
- `SMTP_HOST` and `SMTP_PORT` — SMTP server address; the port defaults to `587`
- `SMTP_SECURE` — use implicit TLS when set to `true`; defaults to `true` on port `465`
- `SMTP_USER` and `SMTP_PASSWORD` — optional SMTP credentials; when used, both are required
- `SMTP_FROM` — default sender address used by the email utility; required unless a sender is passed explicitly

Users can opt into new-post emails from the Account page. New accounts start with notifications disabled.

Never commit `.env` or production secrets.

## Project Layout

- `src/index.html` — Vite HTML entry point
- `src/client` — Vue client application
- `src/server` — Express API and application server
- `src/shared` — types and code shared across both sides
- `prisma` — schema and ordered database migrations
- `content/documents` — Markdown documents served by the API
- `public` — static client assets
- `storage/attachments` — uploaded post attachments
- `openapi.yaml` — API specification

## Verification

```sh
pnpm install --frozen-lockfile
pnpm typecheck
pnpm db:validate
pnpm exec prisma migrate status
pnpm audit --audit-level high
pnpm build
```

## Quick Links

- [Figma File](https://www.figma.com/design/hmDD1XXnwGYYxYCjo0U45Q/Summer-Project-2025)
- [Website home on webontour.eu](https://webontour.eu/)
- [GitHub](https://github.com/BenjaminDerProgrammierer/webontour)
- [Changelog Document](CHANGELOG.md)
- [Roadmap & To-Dos](ROADMAP.md)

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

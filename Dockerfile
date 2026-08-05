FROM node:24-bookworm-slim AS node-base

RUN apt-get update \
    && apt-get install --yes --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*


FROM node-base AS base

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

RUN npm install --global pnpm@11.20.0

WORKDIR /app


FROM base AS dependencies

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile


FROM dependencies AS build

COPY . .
# Prisma generate loads prisma.config.ts, but does not connect to the database.
RUN DATABASE_URL=postgresql://postgres:postgres@database:5432/webontour pnpm build


FROM base AS production-dependencies

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY prisma ./prisma
RUN DATABASE_URL=postgresql://postgres:postgres@database:5432/webontour \
    pnpm install --prod --frozen-lockfile


FROM node-base AS runtime

ENV NODE_ENV=production
ENV PORT=3000

WORKDIR /app

COPY --from=production-dependencies /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --chown=node:node package.json prisma.config.ts openapi.yaml ./
COPY --chown=node:node prisma ./prisma
COPY --chown=node:node content ./content
COPY --chown=node:node --chmod=755 docker-entrypoint.sh ./docker-entrypoint.sh

RUN mkdir -p storage/attachments && chown -R node:node storage

USER node

EXPOSE 3000

CMD ["./docker-entrypoint.sh"]

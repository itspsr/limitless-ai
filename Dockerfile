FROM node:24-bookworm-slim AS base
ENV NEXT_TELEMETRY_DISABLED=1 CHECKPOINT_DISABLE=1 PRISMA_HIDE_UPDATE_MESSAGE=1
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/* && npm install --global pnpm@11.25.0
WORKDIR /app
FROM base AS build
COPY . .
RUN pnpm install --frozen-lockfile && pnpm db:setup && pnpm build && rm -rf apps/web/data
FROM base AS runtime
COPY --from=build --chown=node:node /app /app
RUN mkdir -p /app/apps/web/data && chown node:node /app/apps/web/data
USER node
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node","scripts/setup.mjs","start","-H","0.0.0.0"]

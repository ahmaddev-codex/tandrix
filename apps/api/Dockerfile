# Build from the repo root:  docker build -f apps/api/Dockerfile -t tandrix-api .
# syntax=docker/dockerfile:1

FROM node:22-slim AS build
WORKDIR /repo
# Without this, Corepack waits for a yes/no answer before downloading pnpm and the build hangs.
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY packages/contracts/package.json packages/contracts/
COPY packages/core/package.json packages/core/
RUN pnpm install --frozen-lockfile --filter "@tandrix/api..."
COPY packages/contracts packages/contracts
COPY packages/core packages/core
COPY apps/api apps/api
RUN pnpm --filter @tandrix/api build

# Runtime: the bundle only. No source, no node_modules, no package manager.
FROM node:22-slim
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /repo/apps/api/dist ./dist
USER node
EXPOSE 8787
CMD ["node", "--enable-source-maps", "dist/server.js"]

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
COPY packages/ai/package.json packages/ai/
RUN pnpm install --frozen-lockfile --filter "@tandrix/api..."
COPY packages/contracts packages/contracts
COPY packages/core packages/core
COPY packages/ai packages/ai
COPY apps/api apps/api
RUN pnpm --filter @tandrix/api build

# Runtime: the bundle, plus the three packages it leaves external because they ship native code
# or data files (PDF rendering, the canvas, and Tandrix's voice). Versions match apps/api.
FROM node:22-slim
ENV NODE_ENV=production
WORKDIR /app
RUN npm init -y >/dev/null \
  && npm install --omit=dev --no-audit --no-fund \
    pdfjs-dist@6.4.299 @napi-rs/canvas@1.0.11 kokoro-js@1.2.1
# Fetch the voice model into the image now, so a running server never depends on a download.
RUN node --input-type=module -e "const { KokoroTTS } = await import('kokoro-js'); const m = await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', { dtype: 'q8', device: 'cpu' }); const a = await m.generate('Ready.', { voice: 'af_heart' }); if (!a.audio.length) process.exit(1);"
COPY --from=build /repo/apps/api/dist ./dist
USER node
EXPOSE 8787
CMD ["node", "--enable-source-maps", "dist/server.js"]

# =========================================================================
# STAGE 1: BUILD (Node.js 24 Alpine Builder — Compiles MFEs & Backend)
# =========================================================================
# Build All Micro Frontends
FROM node:24-alpine AS builder
WORKDIR /app

# Enable Corepack to use the exact pnpm version pinned in package.json
RUN corepack enable

# Copy workspace manifests first for optimal Docker layer caching
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./
COPY apps ./apps
COPY packages ./packages
COPY services ./services

# Install all workspace dependencies deterministically and build all packages
RUN pnpm install --frozen-lockfile
RUN pnpm build

# Isolate backend-gateway with ONLY its production node_modules into /app/deploy/backend
RUN pnpm --filter backend-gateway --prod deploy /app/deploy/backend

# =========================================================================
# STAGE 2: RUNTIME (Hardened Non-Root Node.js 24 Production Container)
# =========================================================================
# Production Runtime Gateway & Static MFE Serving
FROM node:24-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Install curl for container-native healthchecks and ensure /app is owned by non-root 'node' user
RUN apk add --no-cache curl && chown -R node:node /app

# SECURITY: Run as unprivileged non-root user
USER node:node

# Copy isolated production backend (includes production node_modules & compiled dist/)
COPY --chown=node:node --from=builder /app/deploy/backend ./backend

# Copy compiled Micro Frontend static bundles.
COPY --chown=node:node --from=builder /app/apps/host-container/dist ./public/host
COPY --chown=node:node --from=builder /app/apps/mfe-audio-generator/dist ./public/generator
COPY --chown=node:node --from=builder /app/apps/mfe-audio-editor/dist ./public/editor
COPY --chown=node:node --from=builder /app/apps/mfe-recommendations/dist ./public/recommendations

# Optimized for serving Micro Frontends via NGINX with reverse-proxy routing to the Node.js 24 API Gateway
EXPOSE 8000

# Native container healthcheck hitting the Express readiness probe
HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:${BACKEND_PORT:-8000}/health/readiness || exit 1

# Note: Because rootDir is "../../" in backend-gateway/tsconfig.json, tsc outputs to dist/services/backend-gateway/src/server.js
CMD ["node", "--max-old-space-size=1536", "backend/dist/services/backend-gateway/src/server.js"]
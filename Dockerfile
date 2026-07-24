# Stage 1: Build All Micro Frontends
FROM node:24-alpine AS builder
WORKDIR /app
RUN npm install -g pnpm@latest
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps ./apps
COPY packages ./packages
COPY services ./services
RUN pnpm install --frozen-lockfile
RUN pnpm build

# Stage 2: Production Runtime Gateway & Static MFE Serving
FROM node:24-alpine AS runner
WORKDIR /app
COPY --from=builder /app/services/backend-gateway/dist ./backend
COPY --from=builder /app/apps/host-container/dist ./public/host
COPY --from=builder /app/apps/mfe-audio-generator/dist ./public/generator
COPY --from=builder /app/apps/mfe-audio-editor/dist ./public/editor
COPY --from=builder /app/apps/mfe-recommedations/dist ./public/recommedations

// Optimized for serving Micro Frontends via NGINX with reverse-proxy routing to the Node.js 24 API Gateway
EXPOSE 8000
CMD ["node", "backend/server.js"]
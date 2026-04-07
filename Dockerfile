# ── Stage 1: Dependencies ────────────────────────────────────────────────
FROM node:25-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ── Stage 2: Build ──────────────────────────────────────────────────────
FROM node:25-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY src/ src/
COPY public/ public/
COPY migrations/ migrations/
COPY packages/chat-sdk/dist/ packages/chat-sdk/dist/
COPY packages/domains/dist/ packages/domains/dist/
COPY packages/integrations/dist/ packages/integrations/dist/
COPY packages/ml/dist/ packages/ml/dist/
COPY packages/skill-hub/dist/ packages/skill-hub/dist/
COPY packages/doc-mcp/dist/ packages/doc-mcp/dist/
COPY scripts/ scripts/
COPY next.config.ts tsconfig.json postcss.config.mjs eslint.config.mjs ./

RUN if [ ! -f next-env.d.ts ]; then \
            printf '/// <reference types="next" />\n/// <reference types="next/image-types/global" />\n\n// NOTE: This file should not be edited\n' > next-env.d.ts; \
        fi

# Next.js standalone build
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ── Stage 3: Runtime ────────────────────────────────────────────────────
FROM node:25-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Install wget for health checks
RUN apk add --no-cache wget

# Create non-root user
RUN addgroup --system --gid 1001 hitechclaw-ai && \
    adduser --system --uid 1001 hitechclaw-ai

# Copy standalone build output
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public

# Copy migrations and runner for entrypoint
COPY migrations/ migrations/
COPY scripts/migrate.ts scripts/migrate.ts
COPY package.json ./

# Install tsx for migration runner + web-push for VAPID notifications
RUN npm install --no-save tsx pg web-push

# Copy entrypoint
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN sed -i 's/\r$//' /docker-entrypoint.sh && chmod +x /docker-entrypoint.sh

RUN chown -R hitechclaw-ai:hitechclaw-ai /app
USER hitechclaw-ai

EXPOSE 3000

ENTRYPOINT ["/docker-entrypoint.sh"]

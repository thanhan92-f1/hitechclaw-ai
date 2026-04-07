# ── Build stage ────────────────────────────────────
FROM node:25-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
COPY packages/web/package.json ./packages/web/
COPY packages/chat-sdk/package.json ./packages/chat-sdk/
RUN npm install
COPY packages/web/ ./packages/web/
COPY packages/chat-sdk/ ./packages/chat-sdk/
RUN npx tsc -b packages/chat-sdk && npx vite build packages/web

# ── Production stage ──────────────────────────────
FROM nginx:alpine
COPY packages/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/packages/web/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

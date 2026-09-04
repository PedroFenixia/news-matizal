# syntax=docker/dockerfile:1

# ---- Etapa 1: dependencias -------------------------------------------------
FROM node:22-bookworm-slim AS deps
WORKDIR /app

# better-sqlite3 requiere compilar un binding nativo: build-essential + python3.
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

# La imagen base trae una npm más antigua que la usada para generar
# package-lock.json localmente; algunas versiones de npm difieren en cómo de
# estrictas son validando árboles de dependencias transitivas con peers
# duplicados (ej. picomatch resuelto en dos versiones vía fast-glob/fdir),
# lo que puede hacer fallar `npm ci` con EUSAGE en una versión y no en otra.
# Se fija una npm reciente para reproducir el mismo comportamiento que en
# desarrollo local.
RUN npm install -g npm@11

COPY package.json package-lock.json ./
RUN npm ci

# ---- Etapa 2: build ---------------------------------------------------------
FROM node:22-bookworm-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Variables públicas necesarias en build time (Next.js las inyecta en el bundle).
ARG NEXT_PUBLIC_SITE_URL=https://news.matizal.com
ENV NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL}
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# ---- Etapa 3: runtime (imagen final, mínima) --------------------------------
FROM node:22-bookworm-slim AS runner
WORKDIR /app

# sqlite3 CLI para scripts/backup.sh; better-sqlite3 usa su propio binding
# nativo ya compilado (copiado desde builder) y no necesita libsqlite3 aparte.
RUN apt-get update && apt-get install -y --no-install-recommends \
    sqlite3 dumb-init \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

# output: 'standalone' genera un servidor Node autocontenido.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/data ./data

USER nextjs

EXPOSE 3000

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server.js"]

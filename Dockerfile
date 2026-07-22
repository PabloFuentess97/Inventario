# syntax=docker/dockerfile:1

# ── Imagen base ───────────────────────────────────────────────────────────────
# node:20 sobre Debian slim. openssl + ca-certificates los necesitan Prisma y la
# descarga del idioma de OCR durante el build.
FROM node:20-bookworm-slim AS base
ENV NODE_ENV=production
RUN apt-get update -y \
  && apt-get install -y --no-install-recommends openssl ca-certificates wget \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# ── Dependencias ──────────────────────────────────────────────────────────────
# Se instalan TODAS (incluidas dev): el runtime necesita la CLI de Prisma para
# migrar y tsx para ejecutar el worker.
FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm ci --include=dev

# ── Build ─────────────────────────────────────────────────────────────────────
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Cliente Prisma para el binario de esta imagen (Debian/OpenSSL 3)
RUN npx prisma generate
# Iconos de la PWA y assets de OCR (tesseract + idioma español).
# El build necesita acceso a internet para descargar el idioma una vez.
RUN npm run iconos && npm run ocr:assets
# Compila Next (genera .next y el service worker con Serwist)
RUN npm run build

# ── Runtime ───────────────────────────────────────────────────────────────────
FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Artefactos de build + dependencias + código necesario para app y worker
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/next.config.ts ./next.config.ts
COPY --from=build /app/tsconfig.json ./tsconfig.json
COPY --from=build /app/middleware.ts ./middleware.ts
COPY --from=build /app/auth.ts ./auth.ts
COPY --from=build /app/auth.config.ts ./auth.config.ts
COPY --from=build /app/postcss.config.mjs ./postcss.config.mjs
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/app ./app
COPY --from=build /app/lib ./lib
COPY --from=build /app/components ./components
COPY --from=build /app/worker ./worker
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/types ./types
COPY --from=build /app/docker ./docker

# Carpeta de fotos (montada como volumen en producción)
RUN mkdir -p /app/data/uploads

EXPOSE 3000

# Por defecto arranca la app web; el worker y la migración se lanzan con
# comandos propios desde docker-compose.
CMD ["npm", "run", "start"]

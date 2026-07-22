#!/bin/sh
# Aplica migraciones de Prisma y siembra datos iniciales (idempotente).
# Lo ejecuta el servicio one-shot "migrate" de docker-compose antes de arrancar
# la app y el worker.
set -e

echo "▶ Aplicando migraciones de la base de datos…"
npx prisma migrate deploy

if [ "${SEED_ON_START:-true}" = "true" ]; then
  echo "▶ Sembrando datos iniciales (idempotente)…"
  npm run db:seed
else
  echo "▶ SEED_ON_START=false: se omite la siembra."
fi

echo "✓ Base de datos lista."

#!/usr/bin/env bash
#
# Script de despliegue para el VPS. Encapsula pull + build + reinicio del
# contenedor Docker, con verificación de healthcheck posterior.
#
# Uso (ejecutar en el VPS, dentro del directorio del proyecto, o vía SSH
# desde local): ./scripts/deploy.sh
#
# Requiere: git, npm, docker, docker compose (plugin), curl.

set -euo pipefail

HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:3021/api/health}"
MAX_HEALTH_RETRIES=10
HEALTH_RETRY_DELAY=3

echo "== Despliegue de Matizal News =="
echo

echo "-> git pull"
git pull

echo "-> npm ci"
npm ci

echo "-> npm run build"
npm run build

echo "-> docker compose build"
docker compose build

echo "-> docker compose up -d"
docker compose up -d

echo
echo "-> Verificando healthcheck en ${HEALTH_URL} ..."
attempt=1
until curl -fsS "$HEALTH_URL" >/dev/null 2>&1; do
  if [ "$attempt" -ge "$MAX_HEALTH_RETRIES" ]; then
    echo "ERROR: el healthcheck no respondió correctamente tras ${MAX_HEALTH_RETRIES} intentos." >&2
    echo "Revisa los logs con: docker compose logs -f app" >&2
    echo "Rollback manual: docker compose down && git checkout <commit-anterior> && ./scripts/deploy.sh" >&2
    exit 1
  fi
  echo "  intento ${attempt}/${MAX_HEALTH_RETRIES} — todavía no responde, reintentando en ${HEALTH_RETRY_DELAY}s..."
  attempt=$((attempt + 1))
  sleep "$HEALTH_RETRY_DELAY"
done

echo
echo "✓ Despliegue completado y healthcheck OK."
curl -fsS "$HEALTH_URL"
echo

#!/usr/bin/env bash
#
# Backup online de la base de datos SQLite (usa el comando `.backup` de
# sqlite3, seguro con la BD en uso — evita copiar el fichero en caliente,
# que podría corromperlo si hay una escritura en curso).
#
# Uso: ./scripts/backup.sh
#
# Variables de entorno:
#   DATABASE_PATH        Ruta de la BD SQLite en producción (por defecto /var/lib/matizal-news/db.sqlite)
#   BACKUP_DIR            Directorio destino (por defecto /var/backups/matizal-news)
#
# Programar por cron, por ejemplo cada día a las 02:30 Europe/Madrid,
# antes de la limpieza mensual (que corre a las 03:00 el día 5):
#   30 2 * * * cd /path/to/news-matizal && ./scripts/backup.sh >> /var/log/matizal-news/backup.log 2>&1

set -euo pipefail

DB_PATH="${DATABASE_PATH:-/var/lib/matizal-news/db.sqlite}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/matizal-news}"
DATE="$(date +%Y-%m-%d)"
DEST="${BACKUP_DIR}/db-${DATE}.sqlite"

if [ ! -f "$DB_PATH" ]; then
  echo "[backup] AVISO: no existe la base de datos en ${DB_PATH}. Nada que respaldar."
  exit 0
fi

mkdir -p "$BACKUP_DIR"

if command -v sqlite3 >/dev/null 2>&1; then
  sqlite3 "$DB_PATH" ".backup '${DEST}'"
  echo "[backup] Backup online creado: ${DEST}"
else
  echo "[backup] ERROR: sqlite3 CLI no está instalado. Instálalo con 'apt install sqlite3'." >&2
  exit 1
fi

# Retención simple de backups: conserva los últimos 30 días.
find "$BACKUP_DIR" -name 'db-*.sqlite' -mtime +30 -delete
echo "[backup] Backups anteriores a 30 días eliminados (si los había)."

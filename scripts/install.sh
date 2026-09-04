#!/usr/bin/env bash
#
# Script de instalación inicial en el VPS. Crea la estructura de directorios
# persistentes fuera del repo, con permisos adecuados. Ejecutar UNA VEZ antes
# del primer despliegue (como usuario con permisos sudo).
#
# Uso: sudo ./scripts/install.sh [usuario_app]
#
# usuario_app: usuario del sistema que ejecutará el contenedor Docker
#              (por defecto, el usuario actual vía $SUDO_USER o $USER).

set -euo pipefail

APP_USER="${1:-${SUDO_USER:-$USER}}"

DIRS=(
  "/var/lib/matizal-news"
  "/var/log/matizal-news"
  "/var/backups/matizal-news"
)

echo "== Instalación de Matizal News =="
echo "Usuario de aplicación: ${APP_USER}"
echo

for dir in "${DIRS[@]}"; do
  if [ ! -d "$dir" ]; then
    mkdir -p "$dir"
    echo "Creado: $dir"
  else
    echo "Ya existe: $dir"
  fi
  chown "${APP_USER}:${APP_USER}" "$dir"
  chmod 750 "$dir"
done

echo
echo "Directorios listos. Recuerda:"
echo "  - Crear el fichero .env (permisos 600) con las variables de entorno reales."
echo "  - No pedir el certificado TLS con certbot hasta que el DNS de news.matizal.com"
echo "    ya apunte a esta VPS (registro A -> $(hostname -I 2>/dev/null | awk '{print $1}' || echo '<IP_VPS>'))."
echo "  - Instalar el vhost de nginx: ver deploy/nginx-host/news-matizal.conf"
echo "  - Configurar crontab o systemd timers para generate-daily y cleanup (ver README.md)."

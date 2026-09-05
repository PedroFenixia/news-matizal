# Matizal News

Briefing diario ejecutivo, en español, de prensa nacional española y mercados
financieros, para Pedro Sánchez (pedro@matizal.com). Actualización automática
diaria, histórico permanente con retención mensual, y despliegue en un VPS
propio bajo `https://news.matizal.com`.

---

## 1. Arquitectura

```
┌─────────────────────────────────────────────────────────────────┐
│                         VPS 91.134.43.229                       │
│                                                                   │
│  nginx (host, fuera de Docker)                                  │
│    - 443/80 públicos, único punto de entrada                    │
│    - certbot / Let's Encrypt                                    │
│    - proxy_pass -> 127.0.0.1:3021                                │
│         │                                                        │
│         ▼                                                        │
│  Docker: contenedor "app" (Next.js standalone, puerto interno   │
│          3000, solo escucha en 127.0.0.1:3021 del host)         │
│         │                                                        │
│         ├── lib/ai/*        capa de abstracción IA (OpenAI hoy) │
│         ├── lib/rss/*       fetch + normalización de RSS        │
│         ├── lib/storage/*   SQLite (append-only)                │
│         ├── lib/retention.ts  regla de retención mensual        │
│         └── app/api/*       endpoints protegidos (CRON_SECRET)  │
│         │                                                        │
│         ▼ (bind mount)                                           │
│  /var/lib/matizal-news/db.sqlite   ← persistente, FUERA del repo │
│  /var/log/matizal-news/            ← logs de cron                │
│  /var/backups/matizal-news/        ← backups diarios             │
│                                                                   │
│  crontab / systemd timer (fuera de Docker, en el host o          │
│  ejecutando dentro del contenedor vía `docker compose exec`):    │
│    - scripts/generate-daily.ts   ~10:00 Europe/Madrid, diario    │
│    - scripts/cleanup.ts          03:00 Europe/Madrid, día 5      │
│    - scripts/backup.sh           02:30 Europe/Madrid, diario     │
└─────────────────────────────────────────────────────────────────┘
```

**Por qué NO Vercel.** El proyecto se ejecuta en un VPS propio (mismo patrón
que el resto del ecosistema del usuario: erp, advisor, hr-fenixia,
prospector), con Docker Compose + nginx del host + certbot. Esto da disco
persistente real, así que el almacenamiento es SQLite en disco en vez de un
blob store gestionado.

### Flujo de generación diaria

```
crontab (host o systemd timer)
   │  ~10:00 Europe/Madrid
   ▼
scripts/generate-daily.ts ──┐
                             │  comparten lógica de negocio
app/api/cron/daily (HTTP,   ─┘  (lib/briefing-generator.ts)
protegido por CRON_SECRET)
   │
   ├─► RSS general (El País, El Mundo, ABC, La Razón)
   │      │
   │      ▼
   │   normaliza → generateGeneralBriefing() [OpenAI] → valida (zod)
   │      │
   │      ▼
   │   saveEdition() en SQLite (nunca sobrescribe)
   │
   └─► RSS financiero (Expansión, Cinco Días, El Economista, CNBC, Bloomberg)
          │
          ▼
       normaliza → generateFinancialBriefing() [OpenAI] → valida (zod)
          │
          ▼
       saveEdition() en SQLite (nunca sobrescribe)

Ambas ramas corren en paralelo (Promise.all) y cada una captura sus propios
errores: si falla financiero, general se guarda igualmente (y viceversa).
Cada ejecución queda registrada en la tabla generation_log.
```

### Stack

- **Next.js 16 (App Router) + TypeScript**, `output: "standalone"` para la
  imagen Docker.
- **Tailwind CSS v4** (vía `@theme inline` sobre custom properties propias —
  ver identidad visual más abajo).
- **better-sqlite3** — storage principal, síncrono, sin dependencias externas.
- **rss-parser** — parseo de feeds RSS.
- **openai** (SDK oficial) — proveedor de IA por defecto, detrás de una
  interfaz desacoplada (`lib/ai/provider.ts`).
- **zod** — validación de la respuesta JSON del modelo contra el esquema
  esperado.
- **tsx** — ejecución de los scripts standalone (`generate-daily.ts`,
  `cleanup.ts`, `import-briefing.ts`) sin paso de compilación previo.

---

## 2. Instalación y ejecución local

```bash
git clone <repo> news-matizal
cd news-matizal
npm install
cp .env.example .env   # rellena OPENAI_API_KEY y CRON_SECRET si vas a generar contenido real
npm run dev
```

Abre `http://localhost:3000`. Sin ninguna variable de entorno configurada, la
app funciona igualmente: lee las dos ediciones demo versionadas en `/data`
(`isDemo: true`), marcadas con el badge "Contenido de demostración".

En local, si `DATABASE_PATH` no está definida, SQLite se crea en
`./data/dev.sqlite` (ignorado por git). Para probar la generación real
necesitas `OPENAI_API_KEY` válida.

---

## 3. Variables de entorno

Todas están documentadas en `.env.example`. Resumen:

| Variable | Obligatoria | Descripción |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | Sí (prod) | URL pública final (`https://news.matizal.com`). Toda URL absoluta de la app (OG, canonical, sitemap, compartir) parte de aquí. Fallback `http://localhost:3000` solo en dev. |
| `OPENAI_API_KEY` | Sí, para generar contenido real | Clave de API de OpenAI. No hace falta para ver los datos demo. |
| `AI_PROVIDER` | No (default `openai`) | Selecciona el proveedor de IA activo (ver sección 8). |
| `OPENAI_MODEL` | No (default `gpt-4o-mini`) | Modelo de OpenAI a usar. |
| `CRON_SECRET` | Sí (prod) | Secreto para autorizar `/api/cron/daily`, `/api/cron/cleanup` y `/api/refresh`. Genera uno con `openssl rand -hex 32`. |
| `DATABASE_PATH` | Recomendado (prod) | Ruta de la SQLite. En VPS: `/var/lib/matizal-news/db.sqlite` (fuera del repo). En local, si se omite: `./data/dev.sqlite`. |

**Nunca comitees `.env`** con valores reales — está en `.gitignore`. En el
VPS, el fichero `.env` vive junto al `docker-compose.yml`, fuera de control
de git, con permisos `600`.

---

## 4. Almacenamiento: SQLite + fallback a JSON demo

- **Producción (VPS):** todas las ediciones generadas (general y financiero,
  incluidas actualizaciones extraordinarias del mismo día) se guardan en una
  tabla `editions` de SQLite (`lib/storage/db.ts`), en una ruta fuera del
  repo (`DATABASE_PATH`), montada como volumen Docker persistente. El storage
  es **append-only**: `saveEdition()` nunca sobrescribe — si ya existe una
  fila con la misma `(type, date, editionId)` lanza un error explícito.
- **Fallback de lectura (dev / DB vacía):** si SQLite no tiene ninguna fila
  para un `(type, date)` dado, `lib/storage/demo-fallback.ts` cae a leer el
  JSON versionado en `/data/general/*.json` o `/data/financial/*.json`. Esto
  permite que el proyecto funcione out-of-the-box sin credenciales ni base de
  datos poblada (por ejemplo, en un clon local recién hecho).
- **Los JSON de `/data` NO son el storage de producción** — son datos de
  ejemplo versionados en git (`isDemo: true`), no un mecanismo de escritura.

Funciones expuestas (`lib/storage/editions.ts`): `getEdition(type, date,
editionId?)`, `getLatestEdition(type)`, `listEditionsForDate(type, date)`,
`listDates(type)`, `listEditionMeta(type, date)`, `saveEdition(briefing)`,
`nextEditionInfo(type, date)`.

---

## 5. Retención e histórico

Regla exacta implementada en `lib/retention.ts` /
`cleanupExpiredBriefings()`:

- Se conservan las ediciones del **mes natural actual**.
- Se conservan temporalmente las del **mes anterior hasta el día 5 del mes
  siguiente** (inclusive del 1 al 4; se borran el día 5).
- Ejemplo: durante octubre, del 1 al 4 se conservan septiembre + octubre; el
  día 5 de octubre se borra TODO septiembre automáticamente.

Salvaguardas: la función calcula el mes objetivo a partir de la fecha actual
en `Europe/Madrid` (no UTC), verifica explícitamente que el mes objetivo
**nunca** coincida con el mes actual, y solo actúa si hoy es día 5. Solo
borra filas de la tabla `editions` (briefings, incluidas
revisiones/actualizaciones extraordinarias) — nunca toca configuración,
`generation_log`, ni nada que no sea contenido histórico diario. Cada
ejecución loggea qué fechas se eliminaron.

Se invoca de dos formas (comparten la misma función):

1. **`scripts/cleanup.ts`** vía crontab/systemd timer en el VPS (recomendado).
2. **`POST /api/cron/cleanup`** (protegido por `CRON_SECRET`), como vía
   alternativa de invocación HTTP manual/externa.

---

## 6. Rutas

| Ruta | Contenido |
|---|---|
| `/` | Portada combinada: saludo + fecha, lo esencial del día (5-8 puntos), accesos a Financiero/Prensa, mercados de un vistazo, prensa española, riesgos/alertas, qué vigilar hoy, lecturas recomendadas. |
| `/financiero` | Última edición financiera (hoy). |
| `/financiero/[fecha]` | Edición financiera histórica, `fecha` = `YYYY-MM-DD`. |
| `/prensa-general` | Última edición de prensa general (hoy). |
| `/prensa-general/[fecha]` | Edición de prensa histórica. |
| `/archivo` | Listado de todas las fechas con ediciones disponibles, con acceso directo a cada tipo. |

Si una fecha no tiene edición guardada, la ruta responde 404 (`notFound()`).
Si no hay **ninguna** edición de ningún tipo (caso extremo, DB vacía y sin
demo), la home muestra un mensaje de "todavía no hay contenido" en vez de
romperse — nunca página vacía sin explicación.

---

## 7. Automatización

### Generación diaria

- **Script standalone** (recomendado para producción):
  `scripts/generate-daily.ts`, invocado por crontab o systemd timer:

  ```cron
  # crontab -e (usuario con acceso al proyecto)
  # 10:00 Europe/Madrid = 08:00 UTC en horario de verano (CEST, ~fin marzo a
  # fin octubre) / 09:00 UTC en horario de invierno (CET). Ajusta según la
  # época del año, o usa un systemd timer con OnCalendar y TZ=Europe/Madrid
  # (recomendado, gestiona el cambio de hora automáticamente).
  0 8 * * * cd /path/to/news-matizal && /usr/bin/npx tsx scripts/generate-daily.ts >> /var/log/matizal-news/generate-daily.log 2>&1
  ```

  Alternativa con **systemd timer** (gestiona DST automáticamente):

  ```ini
  # /etc/systemd/system/matizal-news-generate.service
  [Unit]
  Description=Matizal News - generación diaria de briefings

  [Service]
  Type=oneshot
  WorkingDirectory=/path/to/news-matizal
  ExecStart=/usr/bin/npx tsx scripts/generate-daily.ts
  StandardOutput=append:/var/log/matizal-news/generate-daily.log
  StandardError=append:/var/log/matizal-news/generate-daily.log

  # /etc/systemd/system/matizal-news-generate.timer
  [Unit]
  Description=Ejecuta la generación diaria de Matizal News a las 10:00 Europe/Madrid

  [Timer]
  OnCalendar=*-*-* 10:00:00 Europe/Madrid
  Persistent=true

  [Install]
  WantedBy=timers.target
  ```

  ```bash
  sudo systemctl enable --now matizal-news-generate.timer
  ```

- **Endpoint HTTP** `POST /api/cron/daily` (protegido por `CRON_SECRET`, vía
  header `x-cron-secret` o `?secret=`): misma lógica de negocio
  (`lib/briefing-generator.ts`), útil para disparar manualmente o desde un
  sistema de monitorización externo.

### "Actualizar ahora" (actualización extraordinaria)

`POST /api/refresh` (protegido por `CRON_SECRET`, rate-limited a una llamada
cada 15 minutos vía `lib/rate-limit.ts`, en memoria — suficiente para un
proceso Node de larga duración en el VPS). Genera una revisión adicional del
día (`update-1`, `update-2`, ...) sin perder trazabilidad: cada edición queda
guardada como fila independiente, y la UI muestra "Última actualización:
HH:MM" junto con la etiqueta de qué edición es ("Edición inicial",
"Actualización 1"...).

### Revisiones intradía (14:00 y 19:00)

Además de la edición inicial completa (~10:00), Matizal News soporta
**revisiones intradía**: dos pasadas ligeras a las 14:00 y 19:00
Europe/Madrid que actualizan la edición del día SIN regenerarla desde cero.

**Cómo funciona** (`lib/intraday.ts`, invocado desde
`lib/briefing-generator.ts` → `runIntradayGeneration()`):

1. Recupera la última edición/revisión válida del día (`getEdition(type, date)`).
   Si no existe ninguna todavía (la de las 10:00 falló o aún no ha corrido),
   la revisión intradía **no genera nada** — no tiene sentido partir de cero
   aquí, para eso está la edición inicial.
2. Vuelve a consultar los mismos feeds RSS y descarta, por código (sin IA),
   los artículos cuya URL ya apareciera como fuente en la edición anterior
   (`detectNewItems`). Si no hay ninguno nuevo, tampoco se llama a la IA ni
   se crea una fila nueva — la revisión queda marcada `skipped` en el log.
3. Si hay artículos nuevos, se le pide a la IA que **clasifique cada uno**
   (`new_item` / `update_existing` / `no_change`) y redacte solo el
   contenido de los puntos nuevos o actualizados, además de revisar
   `executiveSummary` y `watchToday` completos. La IA NUNCA reescribe el
   resto del documento (secciones sin cambios, newspapers/outlets,
   comparison, recommendedArticles se copian tal cual de la edición
   anterior) — esto es determinista, en código (`applySectionChanges`), no
   una regeneración por IA.
4. Los puntos afectados quedan marcados con `revisionTag: "new"` o
   `"updated"` (se renderizan como badges "Nuevo"/"Actualizado" en la UI).
   El resultado se guarda como una fila nueva y append-only
   (`update-1`, `update-2`...), igual que "Actualizar ahora" — nunca se
   sobrescribe ni se pierde la revisión anterior.
5. La portada y las páginas `/financiero` y `/prensa-general` siempre leen
   `getLatestEdition()`, así que automáticamente muestran la revisión más
   reciente; el histórico (`/archivo` → `listEditionMeta`) sigue permitiendo
   consultar todas las revisiones del mismo día.

**Independiente por tipo**: si la revisión del general falla, la del
financiero sigue su curso (y viceversa) — mismo patrón que la generación
diaria. Si la revisión completa falla, la última edición válida se queda
tal cual (storage append-only: un fallo simplemente no crea fila nueva).

**Estado visible**: `UpdateStatus` muestra "Última actualización: HH:MM" y,
cuando la edición activa es una revisión intradía con cambios,
"X nuevas/actualizadas desde la edición anterior" (`RevisionSummary`, ver
`lib/types.ts`).

**Endpoints/scripts**: `POST /api/cron/intraday` (protegido por
`CRON_SECRET`, igual que `/api/cron/daily`) o `scripts/generate-intraday.ts`
vía crontab/systemd:

```cron
# ⚠️ NO instalado en producción todavía — ver aviso más abajo.
0 12 * * * cd /path/to/news-matizal && /usr/bin/npx tsx scripts/generate-intraday.ts >> /var/log/matizal-news/generate-intraday.log 2>&1
0 17 * * * cd /path/to/news-matizal && /usr/bin/npx tsx scripts/generate-intraday.ts >> /var/log/matizal-news/generate-intraday.log 2>&1
```

(12:00/17:00 UTC = 14:00/19:00 Europe/Madrid en horario de verano; usa un
systemd timer con `OnCalendar=*-*-* 14,19:00:00` + `TZ=Europe/Madrid` si
prefieres no depender de calcular el offset a mano — ver el ejemplo de
systemd timer más abajo, sección 11.8, y replícalo para 14:00/19:00.)

> **⚠️ Importante:** estos cron jobs están implementados (endpoint, script,
> lógica) pero **deliberadamente NO instalados** en el crontab de producción
> del VPS. Actívalos solo tras probar el flujo manualmente (`curl -X POST
> -H "x-cron-secret: ..." https://news.matizal.com/api/cron/intraday` o
> `npm run generate:intraday`) y confirmar que el resultado es el esperado.

### Limpieza mensual

Ver sección 5. La retención (borrado el día 5 del mes anterior completo) se
aplica igual a TODAS las filas de `editions` de ese mes, sin distinguir
edición inicial de revisión intradía — `DELETE FROM editions WHERE date
LIKE '<mes>-%'` borra por fecha, no por `edition_id`, así que cubre
automáticamente cualquier número de revisiones por día.

Cron recomendado:

```cron
0 3 5 * * cd /path/to/news-matizal && /usr/bin/npx tsx scripts/cleanup.ts >> /var/log/matizal-news/cleanup.log 2>&1
```

### Backups

```cron
30 2 * * * cd /path/to/news-matizal && ./scripts/backup.sh >> /var/log/matizal-news/backup.log 2>&1
```

Usa `sqlite3 "$DB" ".backup '...'"` (backup online, seguro con la BD en uso),
no una copia de fichero en caliente. Conserva los últimos 30 días.

---

## 8. Generación con IA — cambiar de proveedor

La app nunca llama a OpenAI directamente fuera de `lib/ai/`. El resto del
código usa únicamente:

```ts
import { generateGeneralBriefing, generateFinancialBriefing } from "@/lib/ai";
```

Para añadir un proveedor nuevo:

1. Crea `lib/ai/mi-proveedor-provider.ts` implementando la interfaz
   `AiProvider` (`lib/ai/provider.ts`): un único método
   `generateJson({ systemPrompt, userPrompt, maxOutputTokens }) => Promise<string>`.
2. Regístralo en el `switch` de `getProvider()` en `lib/ai/index.ts`.
3. Cambia `AI_PROVIDER=mi-proveedor` en `.env`.

La validación del JSON de salida (zod, `lib/ai/schemas.ts`), los prompts
(`lib/ai/prompts.ts`) y el ensamblado del objeto `Briefing` final son
agnósticos del proveedor.

`OpenAiProvider` incluye timeout (60s), reintentos con backoff exponencial
(3 intentos, 1s/2s/4s) y logging estructurado de cada intento.

---

## 9. Fuentes RSS

Definidas en `lib/rss/sources.ts`, solo feeds públicos/oficiales conocidos.
Nunca scraping, nunca se elude paywall, nunca se guarda texto completo — solo
titular, enlace, fecha y snippet corto (recortado a 500 caracteres,
sin HTML). Los medios sin un RSS público estable conocido (FT, Les Echos,
Handelsblatt, Il Sole 24 Ore, WSJ) se dejan comentados en el fichero como
referencia para revisión manual futura, en vez de adivinar una URL.

Cada fuente puede fallar independientemente (`fetchFeeds` usa
`Promise.all` sobre `fetchFeed`, que nunca lanza — reporta el error en el
resultado). Si **todas** las fuentes de un tipo fallan, esa generación
completa se marca como error en `generation_log` pero no bloquea al otro tipo
de briefing.

---

## 10. Cómo importar una edición antigua manualmente

Si tienes ediciones guardadas en otro formato:

1. Convierte el contenido a un JSON que cumpla `GeneralBriefing` o
   `FinancialBriefing` (`lib/types.ts`). Como mínimo necesitas `type`, `date`
   (`YYYY-MM-DD`) y las secciones de contenido; `editionId`/`editionSequence`
   se calculan automáticamente si se omiten.
2. Ejecuta:

   ```bash
   npx tsx scripts/import-briefing.ts ruta/al/fichero.json
   ```

3. El script rechaza sobrescribir una edición ya existente (storage
   append-only). Con `--force` recalcula automáticamente el siguiente
   `editionId` disponible para esa fecha en vez de fallar.

---

## 11. Despliegue en VPS

### 11.1. Instalación inicial (una vez)

```bash
ssh <usuario>@91.134.43.229
git clone <repo> /path/to/news-matizal
cd /path/to/news-matizal
sudo ./scripts/install.sh
```

Esto crea (con permisos adecuados):

```
/var/lib/matizal-news/      ← SQLite (montada como volumen Docker)
/var/log/matizal-news/      ← logs de generación/limpieza/backup
/var/backups/matizal-news/  ← backups de la SQLite
```

Crea el `.env` real (permisos `600`) a partir de `.env.example`, con
`OPENAI_API_KEY`, `CRON_SECRET` y `DATABASE_PATH=/var/lib/matizal-news/db.sqlite`.

### 11.2. DNS

Registro **CNAME... no**: a diferencia de Vercel, en un VPS con IP fija se
usa un registro **A**:

```
Tipo:  A
Host:  news
Valor: 91.134.43.229
TTL:   automático / 3600
```

Resultado: `news.matizal.com` → `91.134.43.229`.

### 11.3. Certificado TLS (Certbot)

**Importante: no lo pidas hasta que el DNS ya resuelva a esta VPS** (verifica
con `dig news.matizal.com` o `nslookup news.matizal.com`).

```bash
sudo certbot certonly --webroot -w /var/www/news-matizal -d news.matizal.com
```

(Asegúrate de que `/var/www/news-matizal` existe y que el vhost HTTP de nginx sirve
`/.well-known/acme-challenge/` desde ahí — ver `deploy/nginx-host/news-matizal.conf`.)

### 11.4. Nginx del host

Copia `deploy/nginx-host/news-matizal.conf` a `/etc/nginx/conf.d/` (o al
sitio equivalente según tu convención), ajusta si es necesario, y recarga:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

El contenedor Next.js escucha **solo en `127.0.0.1:3021`** — nginx es el
único punto público (443/80). No expongas el puerto 3021 fuera de loopback.

### 11.5. Primer despliegue

```bash
cd /path/to/news-matizal
docker compose build
docker compose up -d
curl -fsS http://127.0.0.1:3021/api/health
```

### 11.6. Despliegues posteriores

```bash
./scripts/deploy.sh
```

Encapsula `git pull` → `npm ci` → `npm run build` → `docker compose build` →
`docker compose up -d` → verificación de `/api/health` con reintentos. Si el
healthcheck falla tras varios intentos, el script termina con error y
recuerda el rollback manual:

```bash
docker compose down
git checkout <commit-anterior>
./scripts/deploy.sh
```

### 11.7. GitHub Actions (opcional)

`.github/workflows/deploy.yml` hace SSH al VPS en cada push a `main` y
ejecuta `scripts/deploy.sh` remotamente. Requiere configurar en
Settings → Secrets and variables → Actions:

- `VPS_SSH_KEY` — clave privada SSH con acceso al VPS.
- `VPS_HOST` — `91.134.43.229`.
- `VPS_USER` — usuario SSH en el VPS.
- `VPS_APP_PATH` — ruta absoluta del proyecto en el VPS.

Si no se configura, el workflow simplemente no se dispara con éxito — el
despliegue manual (`./scripts/deploy.sh` por SSH) sigue siendo la vía
principal y suficiente.

### 11.8. Cron del sistema (generación + limpieza + backups)

Ver sección 7 para los ejemplos completos de crontab / systemd timer.

---

## 12. Seguridad

- El proceso Next.js **nunca** se expone directo a internet: solo escucha en
  `127.0.0.1:3021` dentro del host; nginx es el único punto público.
- `OPENAI_API_KEY` y `CRON_SECRET` viven solo en variables de entorno (`.env`
  con permisos `600` en el VPS, nunca en git).
- `/api/cron/daily`, `/api/cron/cleanup` y `/api/refresh` exigen
  `CRON_SECRET` (header `x-cron-secret` o `?secret=`). Sin `CRON_SECRET`
  configurado, esos endpoints rechazan **toda** petición.
- `/api/refresh` tiene rate limiting básico (1 cada 15 min, en memoria).
- Headers de seguridad (`X-Content-Type-Options`, `X-Frame-Options`,
  `Referrer-Policy`) añadidos vía `headers()` en `next.config.ts`.
- El logging estructurado nunca imprime `OPENAI_API_KEY` ni `CRON_SECRET`.
- Firewall y hardening SSH del VPS son responsabilidad del usuario a nivel de
  sistema (no gestionados por esta app): se recomienda `ufw allow 80,443,22`
  + `ufw default deny incoming`, y opcionalmente `fail2ban`.

---

## 13. Troubleshooting

**La home muestra "todavía no hay ninguna edición disponible".**
No hay filas en SQLite ni JSON demo para ningún tipo. Verifica que
`data/general/*.json` y `data/financial/*.json` existen en el repo, o que
`DATABASE_PATH` apunta a una base de datos con contenido.

**`/api/cron/daily` devuelve 401.**
Falta o no coincide `CRON_SECRET`. Comprueba que el `.env` lo tiene definido
y que la petición lo envía (header `x-cron-secret` o `?secret=`).

**La generación falla con "No se pudo obtener ningún artículo...".**
Todas las fuentes RSS de ese tipo fallaron (feed caído, cambio de URL, etc.).
Revisa `lib/rss/sources.ts` — los medios cambian ocasionalmente sus URLs de
feed. El otro tipo de briefing no se ve afectado.

**better-sqlite3 falla al arrancar en el VPS ("invalid ELF header" o
similar).** El binding nativo se compiló para otra arquitectura/versión de
Node. En Docker esto no debería pasar (se compila dentro de la imagen), pero
si ejecutas fuera de Docker, corre `npm rebuild better-sqlite3` en el VPS.

**El healthcheck de `scripts/deploy.sh` falla.**
Revisa `docker compose logs -f app`. Comprueba que el volumen
`/var/lib/matizal-news` existe y tiene permisos correctos
(`scripts/install.sh` los configura).

**Quiero forzar una edición aunque ya exista una para hoy.**
Usa `POST /api/refresh` (o ejecuta `runDailyGeneration("manual")`
manualmente) — genera una revisión nueva (`update-N`) sin tocar las
anteriores. El storage nunca sobrescribe.

**`/api/cron/intraday` devuelve `success: false` con "No hay edición inicial hoy todavía".**
Es el comportamiento esperado: una revisión intradía necesita partir de una
edición ya publicada ese día. Corre primero `/api/cron/daily` (o espera al
cron de las 10:00) y reintenta.

**La revisión intradía dice `skipped: true` y no crea edición nueva.**
También esperado: no se detectaron artículos nuevos desde la última
revisión (`detectNewItems` no encontró ninguna URL no vista). No es un
error — significa que de verdad no ha cambiado nada desde la última pasada.

**El modo oscuro parpadea al cargar (flash de tema incorrecto).**
No debería ocurrir: `components/ThemeScript.tsx` inyecta un script inline en
`<head>` que aplica `data-theme` antes del primer paint, leyendo
`localStorage`. Si lo ves, revisa que `<ThemeScript />` sigue estando dentro
de `<head>` en `app/layout.tsx`.

---

## 14. Identidad visual

Paleta y tipografías tomadas del branding real de matizal.com, centralizadas
como custom properties CSS en `app/globals.css` (nunca hex sueltos en
componentes):

- **Tipografías** (vía `next/font/google`): Fraunces (serif editorial,
  titulares), Inter (sans, UI/cuerpo), JetBrains Mono (nav, badges,
  timestamps, microcopy — el registro "terminal ejecutivo" de la marca).
- **Colores** (modo claro): `--paper #f5f2eb`, `--ink #1a1a1a`,
  `--green #009080` (acento de marca). Modo oscuro: derivación propia
  (negro cálido `#141310`, mismo verde de acento).
- **Lenguaje visual**: esquinas rectas (sin `border-radius`), bordes finos de
  1px, botones que invierten en `:hover`, numeración de sección secuencial
  ("01", "02"...) en serif itálica (`components/SectionHeading.tsx` — el
  número es el orden real de aparición, no una letra fija, para que nunca
  haya huecos ni duplicados), iconografía mínima (flechas `→` en vez de
  iconos decorativos).
- Modo Claro/Oscuro/Sistema con preferencia en `localStorage`
  (`components/ThemeToggle.tsx`), sin flash de tema incorrecto
  (`components/ThemeScript.tsx`).

## 15. Sistema de prioridad editorial

Tres niveles, sobrios, usados en resúmenes ejecutivos, secciones y "qué
vigilar hoy" (`components/PriorityBadge.tsx`):

- 🔴 **Requiere atención** — impacto alto/inmediato.
- 🟠 **Importante** — relevante, conviene seguir.
- 🟢 **Contexto** — información para entender el escenario.

## 16. Tests

```bash
npm test
```

Usa el test runner nativo de Node (`node --test`, sin dependencias extra) vía
`tsx` para poder importar TypeScript directamente. Cubre la lógica más
crítica y determinista, no componentes React:

- `test/intraday.test.ts` — detección de artículos nuevos por URL
  (`detectNewItems`) y el merge determinista de una revisión intradía
  (`applySectionChanges`: alta de puntos nuevos, actualización por id,
  manejo de un `targetItemId` que la IA se haya inventado).
- `test/retention.test.ts` — `computeTargetMonthToDelete` con los casos
  límite de la regla de retención (día 5 exacto, cualquier otro día, cambio
  de año en enero, salvaguarda contra borrar el mes actual).

`npm run build` (que incluye el typecheck de TypeScript) y `npm run lint`
son la otra red de seguridad — corre ambos antes de desplegar.

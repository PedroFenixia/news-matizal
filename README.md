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
│  systemd timers (host, fuera de Docker — NO crontab: CRON_TZ no  │
│  funciona en Debian, ver sección 7):                             │
│    - matizal-news-daily.timer      10:00 Europe/Madrid, diario  │
│    - matizal-news-intraday.timer   14:00 y 19:00, diario         │
│    - matizal-news-cleanup.timer    03:00, día 5 del mes          │
│    - matizal-news-backup.timer     02:30 Europe/Madrid, diario   │
└─────────────────────────────────────────────────────────────────┘
```

**Por qué NO Vercel.** El proyecto se ejecuta en un VPS propio (mismo patrón
que el resto del ecosistema del usuario: erp, advisor, hr-fenixia,
prospector), con Docker Compose + nginx del host + certbot. Esto da disco
persistente real, así que el almacenamiento es SQLite en disco en vez de un
blob store gestionado.

### Flujo de generación diaria

```
systemd timer (matizal-news-daily.timer, host)
   │  10:00 Europe/Madrid
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
| `OPENAI_MODEL_FAST` | No (default `gpt-4o-mini`) | Modelo para tareas mecánicas: clasificación/detección de novedades en revisiones intradía (ver sección 9). |
| `OPENAI_MODEL_EDITORIAL` | No (default `gpt-4o-mini`) | Modelo para síntesis/redacción del briefing completo (ver sección 9). |
| `CRON_SECRET` | Sí (prod) | Secreto para autorizar `/api/cron/daily`, `/api/cron/intraday`, `/api/cron/cleanup` y `/api/refresh`. Genera uno con `openssl rand -hex 32`. |
| `ADMIN_SECRET` | No, recomendado | Secreto del panel `/admin/usage` (coste/telemetría, ver sección 10). Sin definir, el panel rechaza todo acceso. |
| `OPENAI_DAILY_BUDGET_EUR` | No | Límite de gasto diario en EUR; superado, aborta la siguiente ejecución antes de llamar a OpenAI (ver sección 10). |
| `OPENAI_MONTHLY_BUDGET_EUR` | No | Igual que el anterior, en ventana mensual. |
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

1. **`POST /api/cron/cleanup`** (protegido por `CRON_SECRET`), invocado por
   `matizal-news-cleanup.timer` en producción (systemd, no crontab — ver
   sección 7).
2. **`scripts/cleanup.ts`** para invocación manual/externa fuera de Docker.

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
| `/admin/usage?secret=...` | Panel de diagnóstico de coste/telemetría de OpenAI, protegido por `ADMIN_SECRET` (ver sección 10). No indexado (`robots.txt`), no listado en el sitemap. |

Si una fecha no tiene edición guardada, la ruta responde 404 (`notFound()`).
Si no hay **ninguna** edición de ningún tipo (caso extremo, DB vacía y sin
demo), la home muestra un mensaje de "todavía no hay contenido" en vez de
romperse — nunca página vacía sin explicación.

---

## 7. Automatización

### Generación diaria

> **⚠️ `CRON_TZ` en crontab NO funciona como cabría esperar en Debian/vixie-cron
> (descubierto en producción el 2026-09-06).** El propio changelog de Debian
> del paquete `cron` describe el soporte de zona horaria como un
> "workaround" documentado en `crontab.5`, no una directiva real que el
> demonio interprete: `CRON_TZ=Europe/Madrid` se pasa como variable de
> entorno al proceso lanzado, pero el DEMONIO sigue evaluando las horas del
> crontab en la zona horaria del SISTEMA (`Etc/UTC` en este VPS). Resultado
> real observado: una línea `0 10 * * *` bajo `CRON_TZ=Europe/Madrid` se
> disparaba a las 10:00 **UTC** (12:00 Madrid en verano), no a las 10:00
> Madrid — 2 horas tarde, sin ningún error visible. **Por eso el mecanismo
> soportado en este proyecto son systemd timers** (`OnCalendar=... Europe/Madrid`
> sí resuelve la zona horaria correctamente, verificado con
> `systemd-analyze calendar`), no crontab.

- **Systemd timer** (mecanismo soportado, unidades versionadas en
  `deploy/systemd/`):

  ```ini
  # deploy/systemd/matizal-news-daily.service
  [Unit]
  Description=Matizal News - generación diaria de briefings (10:00 Europe/Madrid)
  After=network-online.target
  Wants=network-online.target

  [Service]
  Type=oneshot
  EnvironmentFile=/opt/news-matizal/.env
  ExecStart=/usr/bin/curl -fsS -X POST -H "x-cron-secret: ${CRON_SECRET}" http://127.0.0.1:3021/api/cron/daily
  StandardOutput=append:/var/log/matizal-news/generate-daily.log
  StandardError=append:/var/log/matizal-news/generate-daily.log

  # deploy/systemd/matizal-news-daily.timer
  [Unit]
  Description=Ejecuta la generación diaria de Matizal News a las 10:00 Europe/Madrid

  [Timer]
  OnCalendar=*-*-* 10:00:00 Europe/Madrid
  Persistent=true

  [Install]
  WantedBy=timers.target
  ```

  Instalación (unidades corren como root vía systemd de sistema, que puede
  leer el `.env` con permisos `600` de `debian` sin problema):

  ```bash
  sudo cp deploy/systemd/matizal-news-daily.{service,timer} /etc/systemd/system/
  sudo systemctl daemon-reload
  sudo systemctl enable --now matizal-news-daily.timer
  systemctl list-timers matizal-news-daily.timer  # confirma el próximo disparo
  ```

  Verifica SIEMPRE la interpretación de zona horaria de un `OnCalendar`
  nuevo antes de confiar en él: `systemd-analyze calendar '*-*-* 10:00:00
  Europe/Madrid'` muestra el próximo disparo real en UTC.

- **Endpoint HTTP** `POST /api/cron/daily` (protegido por `CRON_SECRET`, vía
  header `x-cron-secret` o `?secret=`): misma lógica de negocio
  (`lib/briefing-generator.ts`), útil para disparar manualmente
  (`sudo systemctl start matizal-news-daily.service` también sirve para
  probarlo a mano sin esperar al timer) o desde un sistema de monitorización
  externo.

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
3. Antes de llamar a la IA, se filtran también los artículos cuyo hash
   (outlet+título+URL) ya conste en `processed_articles` para ese tipo+fecha
   (`lib/dedup.ts`, `filterUnprocessed`) — deduplicación persistente,
   complementaria a `detectNewItems`: sobrevive aunque un artículo nunca
   llegara a citarse como fuente (ej. se descartó como `discarded` en una
   revisión previa), evitando reprocesarlo eternamente.
4. Con los artículos realmente nuevos, se le pide al modelo **FAST** (ver
   sección de modelos más abajo) que **clasifique cada uno** en uno de 5
   estados y redacte solo el contenido de los puntos afectados, además de
   revisar `executiveSummary` y `watchToday` completos:
   - `new_item` (NEW): noticia realmente nueva y relevante.
   - `update_existing` (UPDATED): amplía un punto ya publicado sin contradecirlo.
   - `correction` (CORRECTION): CORRIGE o invalida información ya publicada
     (el hecho no era como se dijo, cambió el desenlace...) — se distingue
     de `update_existing` porque el lector debe saber que lo anterior
     estaba mal, no solo incompleto.
   - `no_change` (UNCHANGED): no aporta nada que cambie el briefing.
   - `discarded` (DISCARDED): ruido/irrelevante, ni siquiera se considera.

   La IA NUNCA reescribe el resto del documento (secciones sin cambios,
   newspapers/outlets, comparison, recommendedArticles se copian tal cual
   de la edición anterior) — el merge es determinista, en código
   (`applySectionChanges`), no una regeneración por IA.
5. Los puntos afectados quedan marcados con `revisionTag: "new"`,
   `"updated"` o `"correction"` (badges "Nuevo"/"Actualizado"/"Corregido" en
   la UI, este último en el color de alerta de la marca). El resultado se
   guarda como una fila nueva y append-only (`update-1`, `update-2`...),
   igual que "Actualizar ahora" — nunca se sobrescribe ni se pierde la
   revisión anterior.
6. La portada y las páginas `/financiero` y `/prensa-general` siempre leen
   `getLatestEdition()`, así que automáticamente muestran la revisión más
   reciente; el histórico (`/archivo` → `listEditionMeta`) sigue permitiendo
   consultar todas las revisiones del mismo día (edición inicial 10:00,
   revisión 14:00, cierre 19:00).

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
(este último solo utilizable si el proyecto corre con Node ≥22 fuera de
Docker — la imagen `standalone` no incluye `scripts/`/`tsx`, ver sección
13.8). En producción, `matizal-news-intraday.timer` (`deploy/systemd/`),
un único timer con dos `OnCalendar` (14:00 y 19:00 Europe/Madrid):

```ini
[Timer]
OnCalendar=*-*-* 14:00:00 Europe/Madrid
OnCalendar=*-*-* 19:00:00 Europe/Madrid
Persistent=true
```

**Estado: ACTIVO en producción** (activado tras la prueba manual y
confirmación explícita del usuario). Si necesitas replicar este setup en
otro entorno, sigue el mismo orden: prueba manual primero (sección
siguiente), activa el timer después.

### Limpieza mensual

Ver sección 5. La retención (borrado el día 5 del mes anterior completo) se
aplica igual a TODAS las filas de `editions` de ese mes, sin distinguir
edición inicial de revisión intradía — `DELETE FROM editions WHERE date
LIKE '<mes>-%'` borra por fecha, no por `edition_id`, así que cubre
automáticamente cualquier número de revisiones por día.

Systemd timer (`matizal-news-cleanup.timer`, `deploy/systemd/`):

```ini
[Timer]
OnCalendar=*-*-05 03:00:00 Europe/Madrid
Persistent=true
```

### Backups

Systemd timer (`matizal-news-backup.timer`, `deploy/systemd/`):

```ini
[Timer]
OnCalendar=*-*-* 02:30:00 Europe/Madrid
Persistent=true
```

Usa `sqlite3 "$DB" ".backup '...'"` (backup online, seguro con la BD en uso),
no una copia de fichero en caliente. Conserva los últimos 30 días.

### Prueba manual antes de activar un timer nuevo

**Estado actual en producción: los cuatro systemd timers (edición 10:00,
revisión intradía 14:00/19:00, backup 02:30, limpieza mensual día 5) están
ACTIVOS** (`deploy/systemd/`), activados tras probar el flujo manualmente y
con confirmación explícita del usuario — y tras descubrir en producción que
el mecanismo original (crontab con `CRON_TZ=Europe/Madrid`) no funcionaba
como se documentó inicialmente (ver aviso al principio de esta sección). Si
en el futuro añades un timer nuevo (otro horario, otro tipo de ejecución),
sigue el mismo orden antes de instalarlo — activar un timer es siempre una
acción manual y deliberada, nunca algo que se haga solo:

```bash
# 1. Test de fuentes: comprueba que los RSS responden, SIN gastar tokens de OpenAI.
npm run test:sources

# 2. Generación manual de la edición completa (10:00).
npm run generate:daily
# o, ya desplegado en el VPS, por HTTP:
curl -X POST -H "x-cron-secret: $CRON_SECRET" https://news.matizal.com/api/cron/daily

# 3. Revisar el resultado: la web (/, /financiero, /prensa-general), el
#    almacenamiento (SQLite: tabla editions) y el consumo de OpenAI:
#    https://news.matizal.com/admin/usage?secret=...

# 4. Revisión intradía manual (requiere que el paso 2 ya haya creado una
#    edición hoy — si no la hay, esto falla con un mensaje claro, no genera
#    nada desde cero).
npm run generate:intraday

# 5. Limpieza mensual manual (solo actúa si hoy es día 5 en Europe/Madrid;
#    cualquier otro día es un no-op seguro).
npm run cleanup
```

Solo tras revisar el resultado de estos pasos (contenido, coste en
`/admin/usage`, ausencia de errores) tiene sentido instalar los timers
reales (ver sección 13.8 más abajo). No hay recuperación
automática de una ejecución que "debería haber pasado": si el cron de las
10:00 no corrió (o corrió y falló), no se dispara solo — se lanza a mano.

---

## 8. Generación con IA — cambiar de proveedor

La app nunca llama a OpenAI directamente fuera de `lib/ai/`. El resto del
código usa únicamente:

```ts
import { generateGeneralBriefing, generateFinancialBriefing } from "@/lib/ai";
```

Para añadir un proveedor nuevo:

1. Crea `lib/ai/mi-proveedor-provider.ts` implementando la interfaz
   `AiProvider` (`lib/ai/provider.ts`): un único método `generateJson(...)`
   que reciba `taskKind` ("fast" | "editorial", ver sección 9) y devuelva
   `{ content, usage }` — `usage` (modelo real usado, tokens de entrada/
   cacheados/salida, duración) alimenta la telemetría de coste.
2. Regístralo en el `switch` de `getProvider()` en `lib/ai/index.ts`.
3. Cambia `AI_PROVIDER=mi-proveedor` en `.env`.

La validación del JSON de salida (zod, `lib/ai/schemas.ts`), los prompts
(`lib/ai/prompts.ts`) y el ensamblado del objeto `Briefing` final son
agnósticos del proveedor.

`OpenAiProvider` incluye timeout (60s), reintentos con backoff exponencial
(3 intentos, 1s/2s/4s) y logging estructurado de cada intento.

---

## 9. Estrategia de modelos (FAST / EDITORIAL)

Configuración CENTRALIZADA en `lib/ai/model-config.ts` — ningún otro módulo
debe escribir un nombre de modelo a mano. Dos roles, elegidos por tarea:

| Rol | Variable | Para qué | Usado en |
|---|---|---|---|
| **FAST** | `OPENAI_MODEL_FAST` | Clasificación, detección de novedades, deduplicación semántica — tareas mecánicas | `runIntradayRevision` (clasifica cada artículo nuevo en NEW/UPDATED/CORRECTION/UNCHANGED/DISCARDED) |
| **EDITORIAL** | `OPENAI_MODEL_EDITORIAL` | Resumen ejecutivo, síntesis, comparación editorial, redacción del briefing completo | `generateGeneralBriefing` / `generateFinancialBriefing` (edición de las 10:00) |

Ambas variables por defecto valen `gpt-4o-mini` — deliberado, no un
descuido: ya sostiene la calidad editorial del proyecto con coste bajo
(ver sección 13 del brief original: objetivo orientativo ≤20€/mes). Sube
`OPENAI_MODEL_EDITORIAL` a un modelo superior solo si decides que la
calidad lo justifica; nunca se usa el modelo más caro disponible "porque sí".

Cambiar de modelo es solo tocar la variable de entorno — ningún código que
tocar. `getModelForTask("fast" | "editorial")` es el único punto de lectura.

---

## 10. Coste y telemetría de OpenAI

**Cada llamada real a la API** (incluidos reintentos) se registra en la
tabla SQLite `openai_usage` (`lib/telemetry.ts`, `recordUsage`): timestamp,
modelo, operación (`generate_briefing` / `intraday_classify`), tarea
(fast/editorial), tokens de entrada/cacheados/salida, coste estimado en EUR
ya calculado en el momento de guardar (para que un cambio futuro de precios
no reescriba el histórico), duración, y éxito/error.

**Precios**: centralizados en `lib/ai/model-config.ts` (`PRICING`), en EUR
por 1M tokens, derivados de los precios públicos de OpenAI en USD (ver
comentario en el fichero sobre el tipo de cambio aproximado usado). Son una
ESTIMACIÓN — compara contra tu factura real de OpenAI si necesitas
precisión de facturación exacta.

**Panel de uso** (sección 11 del brief original): `/admin/usage?secret=...`
— vista protegida (no indexada, `robots.txt` la excluye), no un endpoint
público. Requiere `ADMIN_SECRET` configurado; sin esa variable, el panel
rechaza cualquier acceso. Muestra: coste/llamadas/tokens/errores de hoy y
del mes actual, desglose por tipo de briefing (general/financiero), y las
últimas ejecuciones con su coste individual.

### Protección de presupuesto

`OPENAI_DAILY_BUDGET_EUR` y `OPENAI_MONTHLY_BUDGET_EUR` (opcionales, vacías
= sin límite). `lib/budget.ts` (`checkBudget()`) se comprueba ANTES de
iniciar cada ejecución (edición completa o revisión intradía) — nunca a
mitad de una llamada en curso. Si el gasto acumulado (Europe/Madrid, día o
mes en curso) ya alcanza el límite:

- La ejecución se aborta SIN llamar a OpenAI (cero coste adicional).
- Se registra en `generation_log` como fallo, con el motivo exacto.
- La última edición válida se mantiene visible tal cual — el bloqueo de
  presupuesto nunca afecta a la disponibilidad de contenido ya publicado.
- `/admin/usage` muestra el aviso "Generación detenida por límite
  presupuestario" de forma destacada.

### Deduplicación / caché (control de coste)

Dos capas independientes, ambas antes de gastar tokens de IA:

1. `detectNewItems` (`lib/intraday.ts`) — compara artículos RSS contra las
   URLs ya citadas como fuente en el propio documento de la edición
   anterior. Específico de revisiones intradía.
2. `filterUnprocessed`/`markProcessed` (`lib/dedup.ts`, tabla
   `processed_articles`) — hash `sha256(outlet|título|url)` persistente por
   tipo+fecha, independiente del contenido del documento. Se aplica tanto en
   la edición inicial (evita reprocesar en un reintento tras fallo parcial)
   como en las revisiones intradía (evita reprocesar algo ya clasificado
   `discarded`, que nunca llegó a citarse como fuente).

---

## 11. Fuentes RSS

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

## 12. Cómo importar una edición antigua manualmente

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

## 13. Despliegue en VPS

### 13.1. Instalación inicial (una vez)

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

### 13.2. DNS

Registro **CNAME... no**: a diferencia de Vercel, en un VPS con IP fija se
usa un registro **A**:

```
Tipo:  A
Host:  news
Valor: 91.134.43.229
TTL:   automático / 3600
```

Resultado: `news.matizal.com` → `91.134.43.229`.

### 13.3. Certificado TLS (Certbot)

**Importante: no lo pidas hasta que el DNS ya resuelva a esta VPS** (verifica
con `dig news.matizal.com` o `nslookup news.matizal.com`).

```bash
sudo certbot certonly --webroot -w /var/www/news-matizal -d news.matizal.com
```

(Asegúrate de que `/var/www/news-matizal` existe y que el vhost HTTP de nginx sirve
`/.well-known/acme-challenge/` desde ahí — ver `deploy/nginx-host/news-matizal.conf`.)

### 13.4. Nginx del host

Copia `deploy/nginx-host/news-matizal.conf` a `/etc/nginx/conf.d/` (o al
sitio equivalente según tu convención), ajusta si es necesario, y recarga:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

El contenedor Next.js escucha **solo en `127.0.0.1:3021`** — nginx es el
único punto público (443/80). No expongas el puerto 3021 fuera de loopback.

### 13.5. Primer despliegue

```bash
cd /path/to/news-matizal
docker compose build
docker compose up -d
curl -fsS http://127.0.0.1:3021/api/health
```

### 13.6. Despliegues posteriores

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

### 13.7. GitHub Actions (opcional)

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

### 13.8. Systemd timers (generación + revisión intradía + limpieza + backups)

**NO uses crontab con `CRON_TZ`** — ver el aviso al principio de la sección
7: en Debian, el demonio cron ignora la zona horaria declarada y evalúa los
horarios en la zona del sistema, desfasando la ejecución real varias horas
sin ningún error visible. El mecanismo soportado son las 4 unidades systemd
en `deploy/systemd/` (`matizal-news-daily`, `-intraday`, `-cleanup`,
`-backup`, cada una con su `.service` + `.timer`):

```bash
sudo cp deploy/systemd/matizal-news-*.service deploy/systemd/matizal-news-*.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now \
  matizal-news-daily.timer \
  matizal-news-intraday.timer \
  matizal-news-cleanup.timer \
  matizal-news-backup.timer

# Verificar próximos disparos (confirma que la zona horaria se interpreta bien):
systemctl list-timers matizal-news-*

# Probar una unidad a mano sin esperar al timer:
sudo systemctl start matizal-news-daily.service
```

Los `.service` de `daily`/`intraday`/`cleanup` cargan `CRON_SECRET` desde
`EnvironmentFile=/opt/news-matizal/.env` (systemd corre como root, que
puede leer el fichero aunque tenga permisos `600` de `debian`) y llaman al
endpoint HTTP correspondiente con `curl` — mismo patrón que se usaba con
crontab, solo cambia quién dispara la ejecución. Ver sección 7 para el
contenido completo de cada unidad.

---

## 14. Seguridad

- El proceso Next.js **nunca** se expone directo a internet: solo escucha en
  `127.0.0.1:3021` dentro del host; nginx es el único punto público.
- `OPENAI_API_KEY`, `CRON_SECRET` y `ADMIN_SECRET` viven solo en variables de
  entorno (`.env` con permisos `600` en el VPS, nunca en git).
- `/api/cron/daily`, `/api/cron/intraday`, `/api/cron/cleanup` y
  `/api/refresh` exigen `CRON_SECRET` (header `x-cron-secret` o `?secret=`).
  Sin `CRON_SECRET` configurado, esos endpoints rechazan **toda** petición.
- `/admin/usage` exige `ADMIN_SECRET` (`?secret=` en la URL); sin esa
  variable configurada, rechaza todo acceso. No indexado (`robots.txt`
  excluye `/admin/`), no listado en el sitemap.
- `/api/refresh` tiene rate limiting básico (1 cada 15 min, en memoria).
- Protección de presupuesto (`OPENAI_DAILY_BUDGET_EUR`/
  `OPENAI_MONTHLY_BUDGET_EUR`, ver sección 10): comprobada antes de cada
  ejecución, nunca a mitad de una llamada — si se supera, se aborta sin
  gasto adicional y sin tocar la última edición válida.
- Headers de seguridad (`X-Content-Type-Options`, `X-Frame-Options`,
  `Referrer-Policy`) añadidos vía `headers()` en `next.config.ts`.
- El logging estructurado nunca imprime `OPENAI_API_KEY`, `CRON_SECRET` ni
  `ADMIN_SECRET`.
- Firewall y hardening SSH del VPS son responsabilidad del usuario a nivel de
  sistema (no gestionados por esta app): se recomienda `ufw allow 80,443,22`
  + `ufw default deny incoming`, y opcionalmente `fail2ban`.

---

## 15. Troubleshooting

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

**`/admin/usage` dice "Acceso no autorizado" aunque el secreto es correcto.**
Comprueba que `ADMIN_SECRET` está definido en el `.env` real del proceso que
sirve la app (no solo en tu `.env` local) y que coincide EXACTAMENTE con el
`?secret=` de la URL (sensible a mayúsculas/espacios).

**Una generación falla con "Generación detenida por límite presupuestario".**
Esperado si configuraste `OPENAI_DAILY_BUDGET_EUR`/`OPENAI_MONTHLY_BUDGET_EUR`
y el gasto ya registrado en `/admin/usage` alcanza el límite. La última
edición válida sigue disponible. Sube el límite o espera a que empiece el
siguiente día/mes (Europe/Madrid) si quieres generar antes.

**El modo oscuro parpadea al cargar (flash de tema incorrecto).**
No debería ocurrir: `components/ThemeScript.tsx` inyecta un script inline en
`<head>` que aplica `data-theme` antes del primer paint, leyendo
`localStorage`. Si lo ves, revisa que `<ThemeScript />` sigue estando dentro
de `<head>` en `app/layout.tsx`.

---

## 16. Identidad visual

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

## 17. Sistema de prioridad editorial

Tres niveles, sobrios, usados en resúmenes ejecutivos, secciones y "qué
vigilar hoy" (`components/PriorityBadge.tsx`):

- 🔴 **Requiere atención** — impacto alto/inmediato.
- 🟠 **Importante** — relevante, conviene seguir.
- 🟢 **Contexto** — información para entender el escenario.

## 18. Tests

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

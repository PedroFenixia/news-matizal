/**
 * Script standalone para la revisión intradía de briefings (14:00 y 19:00
 * Europe/Madrid). Parte de la última edición válida del día y solo
 * contrasta artículos nuevos desde la última revisión — nunca regenera el
 * briefing completo (eso es scripts/generate-daily.ts, ~10:00).
 *
 * Pensado para invocarse desde crontab o un systemd timer en el VPS:
 *
 *   0 12 * * * cd /path/to/news-matizal && /usr/bin/npx tsx scripts/generate-intraday.ts >> /var/log/matizal-news/generate-intraday.log 2>&1
 *   0 17 * * * cd /path/to/news-matizal && /usr/bin/npx tsx scripts/generate-intraday.ts >> /var/log/matizal-news/generate-intraday.log 2>&1
 *
 * (12:00/17:00 UTC = 14:00/19:00 Europe/Madrid en horario de verano; ver
 * README para el detalle de conversión y horario de invierno, o usa
 * systemd timers con OnCalendar + TZ=Europe/Madrid para no depender de
 * calcular el offset a mano).
 *
 * IMPORTANTE: estos cron jobs NO están instalados todavía en el crontab de
 * producción del VPS a propósito — activarlos requiere confirmación
 * explícita tras probar el flujo manualmente (ver README).
 *
 * Comparte toda la lógica de negocio con /api/cron/intraday a través de
 * lib/briefing-generator.ts — este script es solo el punto de entrada CLI.
 */
import "dotenv/config";
import { runIntradayGeneration } from "../lib/briefing-generator";
import { closeDb } from "../lib/storage/db";

async function main() {
  console.log(`[scripts/generate-intraday] Inicio: ${new Date().toISOString()}`);

  const outcomes = await runIntradayGeneration();

  const allOk = outcomes.every((o) => o.success);
  for (const outcome of outcomes) {
    const status = !outcome.success
      ? "ERROR"
      : outcome.skipped
        ? "SIN CAMBIOS"
        : "OK";
    console.log(
      `[scripts/generate-intraday] ${outcome.type}: ${status}` +
        (outcome.success
          ? outcome.skipped
            ? ""
            : ` (edición=${outcome.editionId}, nuevos=${outcome.newCount}, actualizados=${outcome.updatedCount})`
          : ` (${outcome.error})`)
    );
  }

  console.log(`[scripts/generate-intraday] Fin: ${new Date().toISOString()}`);
  closeDb();
  process.exit(allOk ? 0 : 1);
}

main().catch((err) => {
  console.error("[scripts/generate-intraday] Error fatal no controlado:", err);
  closeDb();
  process.exit(1);
});

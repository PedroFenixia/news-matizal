/**
 * Script standalone para la generación diaria de briefings.
 *
 * Pensado para invocarse desde crontab o un systemd timer en el VPS, ~10:00
 * Europe/Madrid:
 *
 *   0 8 * * * cd /path/to/news-matizal && /usr/bin/npx tsx scripts/generate-daily.ts >> /var/log/matizal-news/generate-daily.log 2>&1
 *
 * (8:00 UTC = 10:00 Europe/Madrid en horario de verano; ver README para el
 * detalle de conversión y horario de invierno).
 *
 * Comparte toda la lógica de negocio con /api/cron/daily a través de
 * lib/briefing-generator.ts — este script es solo el punto de entrada CLI.
 */
import "dotenv/config";
import { runDailyGeneration } from "../lib/briefing-generator";
import { closeDb } from "../lib/storage/db";

async function main() {
  console.log(`[scripts/generate-daily] Inicio: ${new Date().toISOString()}`);

  const outcomes = await runDailyGeneration("cron");

  const allOk = outcomes.every((o) => o.success);
  for (const outcome of outcomes) {
    console.log(
      `[scripts/generate-daily] ${outcome.type}: ${outcome.success ? "OK" : "ERROR"}` +
        (outcome.success
          ? ` (edición=${outcome.editionId}, items=${outcome.itemsProcessed})`
          : ` (${outcome.error})`)
    );
  }

  console.log(`[scripts/generate-daily] Fin: ${new Date().toISOString()}`);
  closeDb();
  process.exit(allOk ? 0 : 1);
}

main().catch((err) => {
  console.error("[scripts/generate-daily] Error fatal no controlado:", err);
  closeDb();
  process.exit(1);
});

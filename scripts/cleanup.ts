/**
 * Script standalone para la limpieza mensual de retención.
 *
 * Pensado para invocarse desde crontab o un systemd timer en el VPS, el día
 * 5 de cada mes en Europe/Madrid:
 *
 *   0 3 5 * * cd /path/to/news-matizal && /usr/bin/npx tsx scripts/cleanup.ts >> /var/log/matizal-news/cleanup.log 2>&1
 *
 * La función cleanupExpiredBriefings() ya valida internamente que hoy sea
 * día 5 en Europe/Madrid antes de borrar nada (ver lib/retention.ts), así
 * que ejecutarlo otros días es un no-op seguro.
 */
import "dotenv/config";
import { cleanupExpiredBriefings } from "../lib/retention";
import { closeDb } from "../lib/storage/db";

async function main() {
  console.log(`[scripts/cleanup] Inicio: ${new Date().toISOString()}`);

  const result = cleanupExpiredBriefings();

  if (result.skipped) {
    console.log(`[scripts/cleanup] Omitido: ${result.reason}`);
  } else {
    console.log(
      `[scripts/cleanup] Mes objetivo ${result.targetMonth}: ${result.deletedCount} edición(es) eliminada(s).`
    );
    if (result.deletedDates.length > 0) {
      console.log(`[scripts/cleanup] Fechas eliminadas: ${result.deletedDates.join(", ")}`);
    }
  }

  console.log(`[scripts/cleanup] Fin: ${new Date().toISOString()}`);
  closeDb();
  process.exit(0);
}

main().catch((err) => {
  console.error("[scripts/cleanup] Error fatal no controlado:", err);
  closeDb();
  process.exit(1);
});

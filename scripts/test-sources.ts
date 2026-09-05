/**
 * TEST DE FUENTES (sección 17 del brief): comprueba, sin generar nada ni
 * gastar un solo token de OpenAI, que cada fuente RSS configurada responde
 * y devuelve artículos. Pensado como primer paso antes de una generación
 * manual real:
 *
 *   npm run test:sources
 *
 * Cada fuente se prueba de forma independiente (nunca scraping, solo el
 * fetch RSS ya usado en producción) — si una falla, se reporta y se sigue
 * con las demás, igual que en una generación real.
 */
import "dotenv/config";
import { ALL_SOURCES } from "../lib/rss/sources";
import { fetchFeed } from "../lib/rss/fetch";

async function main() {
  console.log(`[test-sources] Probando ${ALL_SOURCES.length} fuentes...\n`);

  let okCount = 0;
  let failCount = 0;

  for (const source of ALL_SOURCES) {
    const result = await fetchFeed(source);
    if (result.ok) {
      okCount++;
      console.log(`✓ ${source.outlet} (${source.category}) — ${result.items.length} artículos`);
      if (result.items[0]) {
        console.log(`    último: "${result.items[0].title}"${result.items[0].link ? ` — ${result.items[0].link}` : ""}`);
      }
    } else {
      failCount++;
      console.log(`✗ ${source.outlet} (${source.category}) — ERROR: ${result.error}`);
    }
  }

  console.log(`\n[test-sources] ${okCount} OK, ${failCount} con error, de ${ALL_SOURCES.length} totales.`);

  if (okCount === 0) {
    console.error("[test-sources] NINGUNA fuente respondió — revisa la conectividad antes de generar.");
    process.exit(1);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("[test-sources] Error fatal no controlado:", err);
  process.exit(1);
});

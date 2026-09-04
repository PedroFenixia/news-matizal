/**
 * Script para importar manualmente una edición antigua (guardada en otro
 * formato/fuente) al histórico de SQLite.
 *
 * Uso:
 *   npx tsx scripts/import-briefing.ts <ruta-al-json> [--force]
 *
 * El JSON de entrada debe cumplir el esquema GeneralBriefing o
 * FinancialBriefing de lib/types.ts (campo "type": "general" | "financial").
 * Si faltan editionId/editionSequence/editionLabel, el script los calcula
 * automáticamente como la siguiente edición disponible para esa fecha
 * (igual que haría una generación normal).
 *
 * Por defecto, si ya existe una edición con el mismo (type, date, editionId)
 * el script se detiene sin sobrescribir nada (storage append-only). Usa
 * --force solo si sabes lo que haces y quieres forzar un editionId distinto
 * automáticamente (nunca sobrescribe: siempre crea una revisión nueva).
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { saveEdition, nextEditionInfo } from "../lib/storage/editions";
import { closeDb } from "../lib/storage/db";
import type { Briefing } from "../lib/types";

function main() {
  const args = process.argv.slice(2);
  const filePath = args.find((a) => !a.startsWith("--"));
  const force = args.includes("--force");

  if (!filePath) {
    console.error("Uso: npx tsx scripts/import-briefing.ts <ruta-al-json> [--force]");
    process.exit(1);
  }

  const absPath = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(absPath)) {
    console.error(`No se encuentra el fichero: ${absPath}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(absPath, "utf-8");
  const parsed = JSON.parse(raw) as Record<string, unknown>;

  if (parsed.type !== "general" && parsed.type !== "financial") {
    console.error(`Campo "type" inválido: ${String(parsed.type)}. Debe ser "general" o "financial".`);
    process.exit(1);
  }

  const briefing = parsed as unknown as Briefing;
  if (!briefing.date || !/^\d{4}-\d{2}-\d{2}$/.test(briefing.date)) {
    console.error(`Campo "date" inválido o ausente: ${briefing.date}. Formato esperado YYYY-MM-DD.`);
    process.exit(1);
  }

  if (!briefing.editionId || force) {
    const info = nextEditionInfo(briefing.type, briefing.date);
    briefing.editionId = info.editionId;
    briefing.editionSequence = info.editionSequence;
    briefing.editionLabel = briefing.editionLabel || info.editionLabel;
    console.log(
      `Edición calculada automáticamente: ${briefing.editionId} (secuencia ${briefing.editionSequence})`
    );
  }

  if (!briefing.updatedAt) {
    briefing.updatedAt = new Date().toISOString();
  }

  try {
    saveEdition(briefing);
    console.log(
      `✓ Importada edición ${briefing.type}/${briefing.date}/${briefing.editionId} correctamente.`
    );
  } catch (err) {
    console.error(`ERROR al importar: ${err instanceof Error ? err.message : String(err)}`);
    console.error(
      "Si quieres importar de todas formas como una revisión nueva, vuelve a ejecutar con --force."
    );
    process.exit(1);
  } finally {
    closeDb();
  }
}

main();

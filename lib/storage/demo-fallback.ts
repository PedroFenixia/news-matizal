import fs from "node:fs";
import path from "node:path";
import type { Briefing, BriefingType } from "../types";

/**
 * Fallback de lectura a los JSON demo versionados en /data (git). Se usa
 * solo cuando SQLite no tiene ninguna fila para ese tipo/fecha — típicamente
 * en desarrollo local recién clonado, antes de la primera generación real.
 *
 * Los JSON demo NO son el storage de producción: son datos de ejemplo
 * versionados en el repo (isDemo: true) para que el proyecto funcione out of
 * the box sin credenciales ni base de datos poblada.
 */

const DATA_DIR = path.join(process.cwd(), "data");

function folderFor(type: BriefingType): string {
  return type === "general" ? "general" : "financial";
}

export function readDemoEdition(
  type: BriefingType,
  date: string
): Briefing | null {
  const file = path.join(DATA_DIR, folderFor(type), `${date}.json`);
  if (!fs.existsSync(file)) return null;
  try {
    const raw = fs.readFileSync(file, "utf-8");
    return JSON.parse(raw) as Briefing;
  } catch {
    return null;
  }
}

export function listDemoDates(type: BriefingType): string[] {
  const dir = path.join(DATA_DIR, folderFor(type));
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(/\.json$/, ""))
    .sort();
}

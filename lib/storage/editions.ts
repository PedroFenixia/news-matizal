import { getDb } from "./db";
import type { Briefing, BriefingType, EditionMeta } from "../types";
import { readDemoEdition, listDemoDates } from "./demo-fallback";

/**
 * Storage layer de ediciones.
 *
 * Backend real: SQLite (persistente en el VPS, fuera del repo vía
 * DATABASE_PATH). Fallback: JSON demo versionados en /data, usado cuando la
 * tabla SQLite no tiene todavía ninguna edición real para esa fecha/tipo
 * (por ejemplo, en desarrollo local recién clonado, antes de correr el
 * script de generación por primera vez).
 *
 * IMPORTANTE: nunca se sobrescribe una edición existente. `saveEdition`
 * inserta siempre una fila nueva; el conflicto (type, date, edition_id) solo
 * puede darse si se reintenta guardar la MISMA edición ya guardada, en cuyo
 * caso se lanza un error explícito en vez de pisarla silenciosamente.
 */

interface EditionRow {
  id: number;
  type: string;
  date: string;
  edition_id: string;
  edition_sequence: number;
  updated_at: string;
  is_demo: number;
  payload: string;
}

function rowToBriefing(row: EditionRow): Briefing {
  return JSON.parse(row.payload) as Briefing;
}

/** Devuelve una edición concreta (type + date + editionId). */
export function getEdition(
  type: BriefingType,
  date: string,
  editionId?: string
): Briefing | null {
  const db = getDb();

  const row = editionId
    ? (db
        .prepare(
          `SELECT * FROM editions WHERE type = ? AND date = ? AND edition_id = ?`
        )
        .get(type, date, editionId) as EditionRow | undefined)
    : (db
        .prepare(
          `SELECT * FROM editions WHERE type = ? AND date = ?
           ORDER BY edition_sequence DESC LIMIT 1`
        )
        .get(type, date) as EditionRow | undefined);

  if (row) return rowToBriefing(row);

  // Fallback a datos demo versionados (solo si no hay ninguna fila para esa fecha).
  return readDemoEdition(type, date);
}

/** Devuelve la última edición disponible de un tipo (cualquier fecha), o null. */
export function getLatestEdition(type: BriefingType): Briefing | null {
  const db = getDb();

  const row = db
    .prepare(
      `SELECT * FROM editions WHERE type = ?
       ORDER BY date DESC, edition_sequence DESC LIMIT 1`
    )
    .get(type) as EditionRow | undefined;

  if (row) return rowToBriefing(row);

  // Fallback: la fecha demo más reciente disponible en /data.
  const demoDates = listDemoDates(type);
  if (demoDates.length === 0) return null;
  const latestDate = demoDates[demoDates.length - 1];
  return readDemoEdition(type, latestDate);
}

/** Todas las ediciones (todas las revisiones) de una fecha, en orden. */
export function listEditionsForDate(
  type: BriefingType,
  date: string
): Briefing[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT * FROM editions WHERE type = ? AND date = ?
       ORDER BY edition_sequence ASC`
    )
    .all(type, date) as EditionRow[];

  if (rows.length > 0) return rows.map(rowToBriefing);

  const demo = readDemoEdition(type, date);
  return demo ? [demo] : [];
}

/** Lista de fechas (YYYY-MM-DD) con al menos una edición, más recientes primero. */
export function listDates(type: BriefingType): string[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT DISTINCT date FROM editions WHERE type = ? ORDER BY date DESC`
    )
    .all(type) as { date: string }[];

  const dbDates = new Set(rows.map((r) => r.date));
  const demoDates = listDemoDates(type);
  for (const d of demoDates) dbDates.add(d);

  return Array.from(dbDates).sort((a, b) => (a < b ? 1 : -1));
}

/**
 * Une las fechas con edición de AMBOS tipos (general + financiero), más
 * recientes primero — usado por /archivo. Separado de listDates (un solo
 * tipo) porque el listado combinado es la vista que de verdad necesita
 * paginar (con los dos tipos puede acumular muchas fechas rápido).
 */
export function listAllDates(): string[] {
  const general = new Set(listDates("general"));
  const financial = listDates("financial");
  for (const d of financial) general.add(d);
  return Array.from(general).sort((a, b) => (a < b ? 1 : -1));
}

export interface PagedDates {
  dates: string[];
  page: number;
  pageSize: number;
  totalPages: number;
  totalDates: number;
}

/** Página de `listAllDates()`, 1-indexada. Página fuera de rango se recorta al límite válido. */
export function listAllDatesPaged(page: number, pageSize: number): PagedDates {
  const all = listAllDates();
  const totalDates = all.length;
  const totalPages = Math.max(1, Math.ceil(totalDates / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;

  return {
    dates: all.slice(start, start + pageSize),
    page: safePage,
    pageSize,
    totalPages,
    totalDates,
  };
}

/** Metadatos ligeros de todas las ediciones de una fecha (sin el payload completo). */
export function listEditionMeta(
  type: BriefingType,
  date: string
): EditionMeta[] {
  return listEditionsForDate(type, date).map((b) => ({
    date: b.date,
    editionId: b.editionId,
    editionLabel: b.editionLabel,
    editionSequence: b.editionSequence,
    updatedAt: b.updatedAt,
    type: b.type,
    isDemo: b.isDemo,
  }));
}

/**
 * Guarda una nueva edición. NUNCA sobrescribe: si ya existe una fila con la
 * misma (type, date, editionId) lanza un error.
 */
export function saveEdition(briefing: Briefing): void {
  const db = getDb();

  const existing = db
    .prepare(
      `SELECT id FROM editions WHERE type = ? AND date = ? AND edition_id = ?`
    )
    .get(briefing.type, briefing.date, briefing.editionId);

  if (existing) {
    throw new Error(
      `La edición ${briefing.type}/${briefing.date}/${briefing.editionId} ya existe. ` +
        `El storage es append-only: nunca se sobrescribe una edición existente.`
    );
  }

  const insert = db.prepare(
    `INSERT INTO editions (type, date, edition_id, edition_sequence, updated_at, is_demo, payload)
     VALUES (@type, @date, @editionId, @editionSequence, @updatedAt, @isDemo, @payload)`
  );

  // Transacción: inserción de la edición es la única escritura necesaria aquí,
  // pero se envuelve igualmente para dejar sitio a futuras actualizaciones de
  // índice/metadata sin riesgo de estado parcial.
  const tx = db.transaction(() => {
    insert.run({
      type: briefing.type,
      date: briefing.date,
      editionId: briefing.editionId,
      editionSequence: briefing.editionSequence,
      updatedAt: briefing.updatedAt,
      isDemo: briefing.isDemo ? 1 : 0,
      payload: JSON.stringify(briefing),
    });
  });

  tx();
}

/** Calcula el siguiente editionId/sequence/label para una fecha+tipo dados. */
export function nextEditionInfo(
  type: BriefingType,
  date: string
): { editionId: string; editionSequence: number; editionLabel: string } {
  const existing = listEditionsForDate(type, date).filter((b) => !b.isDemo);

  if (existing.length === 0) {
    return {
      editionId: "initial",
      editionSequence: 0,
      editionLabel: "Edición inicial",
    };
  }

  const maxSeq = Math.max(...existing.map((b) => b.editionSequence));
  const nextSeq = maxSeq + 1;
  return {
    editionId: `update-${nextSeq}`,
    editionSequence: nextSeq,
    editionLabel: `Actualización ${nextSeq}`,
  };
}

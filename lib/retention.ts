import { getDb } from "./storage/db";

/**
 * Regla de retención EXACTA (Europe/Madrid):
 *
 * - Se conservan las ediciones del mes natural actual.
 * - Se conservan temporalmente las del mes anterior hasta el día 5 del mes
 *   siguiente (inclusive del 1 al 4; se borran el día 5).
 * - Ejemplo: durante octubre, del 1 al 4 se conservan septiembre+octubre;
 *   el día 5 de octubre se borra TODO septiembre automáticamente.
 *
 * Afecta a: ediciones general/financial (incluye revisiones/actualizaciones
 * extraordinarias del día, ya que son filas independientes en `editions`).
 * NUNCA toca: configuración, fuentes, generation_log, ni nada que no sea
 * contenido histórico diario de ediciones.
 */

export interface CleanupResult {
  executedAt: string;
  /** Mes objetivo de borrado, formato YYYY-MM, o null si no procede borrar nada. */
  targetMonth: string | null;
  deletedCount: number;
  deletedDates: string[];
  skipped: boolean;
  reason?: string;
}

/**
 * Dado "ahora" (día en Europe/Madrid), calcula el mes que debe eliminarse,
 * o null si hoy no toca eliminar nada (regla: solo se borra el día 5).
 */
export function computeTargetMonthToDelete(now: Date): string | null {
  const madridParts = getMadridDateParts(now);

  if (madridParts.day !== 5) {
    return null;
  }

  // El mes objetivo a borrar es el mes anterior al actual.
  let targetYear = madridParts.year;
  let targetMonth = madridParts.month - 1; // month es 1-12
  if (targetMonth === 0) {
    targetMonth = 12;
    targetYear -= 1;
  }

  return `${targetYear}-${String(targetMonth).padStart(2, "0")}`;
}

function getMadridDateParts(date: Date): {
  year: number;
  month: number;
  day: number;
} {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(date);
  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value ?? "0");
  return { year: get("year"), month: get("month"), day: get("day") };
}

/**
 * Ejecuta la limpieza mensual. Idempotente: si ya no quedan ediciones del
 * mes objetivo, simplemente no borra nada más (deletedCount: 0).
 *
 * Salvaguarda explícita: nunca borra el mes actual (Europe/Madrid), solo el
 * mes objetivo calculado por computeTargetMonthToDelete.
 */
export function cleanupExpiredBriefings(now: Date = new Date()): CleanupResult {
  const executedAt = now.toISOString();
  const targetMonth = computeTargetMonthToDelete(now);

  if (!targetMonth) {
    return {
      executedAt,
      targetMonth: null,
      deletedCount: 0,
      deletedDates: [],
      skipped: true,
      reason:
        "Hoy no es día 5 en Europe/Madrid: no procede ejecutar la limpieza mensual.",
    };
  }

  const currentMonth = getMadridDateParts(now);
  const currentMonthKey = `${currentMonth.year}-${String(currentMonth.month).padStart(2, "0")}`;

  // Salvaguarda: el mes objetivo NUNCA puede coincidir con el mes actual.
  if (targetMonth === currentMonthKey) {
    return {
      executedAt,
      targetMonth,
      deletedCount: 0,
      deletedDates: [],
      skipped: true,
      reason:
        "Salvaguarda: el mes objetivo de borrado coincide con el mes actual. Abortado.",
    };
  }

  const db = getDb();
  const likePattern = `${targetMonth}-%`;

  const rows = db
    .prepare(`SELECT DISTINCT date FROM editions WHERE date LIKE ?`)
    .all(likePattern) as { date: string }[];

  const deletedDates = rows.map((r) => r.date).sort();

  const tx = db.transaction(() => {
    const result = db
      .prepare(`DELETE FROM editions WHERE date LIKE ?`)
      .run(likePattern);
    return result.changes;
  });

  const deletedCount = tx();

  const result: CleanupResult = {
    executedAt,
    targetMonth,
    deletedCount,
    deletedDates,
    skipped: false,
  };

  console.log(
    `[cleanup] ${executedAt} — mes objetivo ${targetMonth}: ${deletedCount} edicion(es) eliminada(s) de fechas: ${
      deletedDates.join(", ") || "(ninguna)"
    }`
  );

  return result;
}

import { getDb } from "./db";
import type { GenerationLogEntry } from "../types";

/** Registra el inicio de una ejecución (cron diario, cleanup o refresh manual). */
export function logRunStart(
  entry: Omit<GenerationLogEntry, "id" | "finishedAt" | "success">
): number {
  const db = getDb();
  const result = db
    .prepare(
      `INSERT INTO generation_log (run_id, type, trigger, started_at)
       VALUES (@runId, @type, @trigger, @startedAt)`
    )
    .run(entry);
  return Number(result.lastInsertRowid);
}

/** Marca el final de una ejecución (éxito o error), con métricas asociadas. */
export function logRunFinish(
  id: number,
  result: {
    success: boolean;
    finishedAt: string;
    sourcesConsulted?: number;
    itemsProcessed?: number;
    editionId?: string;
    errorMessage?: string;
  }
): void {
  const db = getDb();
  db.prepare(
    `UPDATE generation_log
     SET success = @success,
         finished_at = @finishedAt,
         sources_consulted = @sourcesConsulted,
         items_processed = @itemsProcessed,
         edition_id = @editionId,
         error_message = @errorMessage
     WHERE id = @id`
  ).run({
    id,
    success: result.success ? 1 : 0,
    finishedAt: result.finishedAt,
    sourcesConsulted: result.sourcesConsulted ?? null,
    itemsProcessed: result.itemsProcessed ?? null,
    editionId: result.editionId ?? null,
    errorMessage: result.errorMessage ?? null,
  });
}

export function listRecentRuns(limit = 20): GenerationLogEntry[] {
  const db = getDb();
  const rows = db
    .prepare(`SELECT * FROM generation_log ORDER BY started_at DESC LIMIT ?`)
    .all(limit) as Array<{
    id: number;
    run_id: string;
    type: "general" | "financial";
    trigger: "cron" | "manual" | "cleanup";
    started_at: string;
    finished_at: string | null;
    success: number | null;
    sources_consulted: number | null;
    items_processed: number | null;
    edition_id: string | null;
    error_message: string | null;
  }>;

  return rows.map((r) => ({
    id: r.id,
    runId: r.run_id,
    type: r.type,
    trigger: r.trigger,
    startedAt: r.started_at,
    finishedAt: r.finished_at ?? undefined,
    success: r.success === null ? undefined : r.success === 1,
    sourcesConsulted: r.sources_consulted ?? undefined,
    itemsProcessed: r.items_processed ?? undefined,
    editionId: r.edition_id ?? undefined,
    errorMessage: r.error_message ?? undefined,
  }));
}

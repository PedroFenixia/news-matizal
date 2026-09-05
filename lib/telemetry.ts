import { getDb } from "./storage/db";
import { estimateCostEur } from "./ai/model-config";
import type { AiUsage } from "./ai/provider";
import type { BriefingType } from "./types";

/**
 * Telemetría de uso de OpenAI (sección 10 del brief: "quiero saber cuánto
 * cuesta Matizal News"). Cada llamada real a la API (incluidos reintentos)
 * se registra en la tabla `openai_usage`, con su coste estimado ya
 * calculado en el momento de guardar (no en el momento de consultar) para
 * que un cambio futuro de precios no reescriba el histórico.
 */

export interface RecordUsageParams {
  runId?: string;
  briefingType?: BriefingType;
  trigger?: string;
  taskKind: "fast" | "editorial";
  operation: string;
  usage: AiUsage;
  success: boolean;
  errorMessage?: string;
}

export function recordUsage(params: RecordUsageParams): void {
  const db = getDb();
  const costEur = estimateCostEur(params.usage.model, {
    inputTokens: params.usage.inputTokens,
    cachedInputTokens: params.usage.cachedInputTokens,
    outputTokens: params.usage.outputTokens,
  });

  db.prepare(
    `INSERT INTO openai_usage
       (run_id, briefing_type, trigger, task_kind, operation, model,
        input_tokens, cached_input_tokens, output_tokens, total_tokens,
        cost_eur, duration_ms, success, error_message)
     VALUES
       (@runId, @briefingType, @trigger, @taskKind, @operation, @model,
        @inputTokens, @cachedInputTokens, @outputTokens, @totalTokens,
        @costEur, @durationMs, @success, @errorMessage)`
  ).run({
    runId: params.runId ?? null,
    briefingType: params.briefingType ?? null,
    trigger: params.trigger ?? null,
    taskKind: params.taskKind,
    operation: params.operation,
    model: params.usage.model,
    inputTokens: params.usage.inputTokens,
    cachedInputTokens: params.usage.cachedInputTokens,
    outputTokens: params.usage.outputTokens,
    totalTokens: params.usage.totalTokens,
    costEur,
    durationMs: params.usage.durationMs,
    success: params.success ? 1 : 0,
    errorMessage: params.errorMessage ?? null,
  });
}

export interface UsageTotals {
  callCount: number;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costEur: number;
  errorCount: number;
  avgDurationMs: number;
}

function emptyTotals(): UsageTotals {
  return {
    callCount: 0,
    inputTokens: 0,
    cachedInputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    costEur: 0,
    errorCount: 0,
    avgDurationMs: 0,
  };
}

interface UsageRow {
  call_count: number;
  input_tokens: number | null;
  cached_input_tokens: number | null;
  output_tokens: number | null;
  total_tokens: number | null;
  cost_eur: number | null;
  error_count: number;
  avg_duration_ms: number | null;
}

function rowToTotals(row: UsageRow | undefined): UsageTotals {
  if (!row || row.call_count === 0) return emptyTotals();
  return {
    callCount: row.call_count,
    inputTokens: row.input_tokens ?? 0,
    cachedInputTokens: row.cached_input_tokens ?? 0,
    outputTokens: row.output_tokens ?? 0,
    totalTokens: row.total_tokens ?? 0,
    costEur: row.cost_eur ?? 0,
    errorCount: row.error_count,
    avgDurationMs: Math.round(row.avg_duration_ms ?? 0),
  };
}

const TOTALS_SELECT = `
  SELECT
    COUNT(*) AS call_count,
    SUM(input_tokens) AS input_tokens,
    SUM(cached_input_tokens) AS cached_input_tokens,
    SUM(output_tokens) AS output_tokens,
    SUM(total_tokens) AS total_tokens,
    SUM(cost_eur) AS cost_eur,
    SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) AS error_count,
    AVG(duration_ms) AS avg_duration_ms
  FROM openai_usage
`;

/** Coste/uso total desde una fecha ISO (inclusive) hasta ahora. */
export function getUsageSince(sinceIso: string): UsageTotals {
  const db = getDb();
  const row = db
    .prepare(`${TOTALS_SELECT} WHERE created_at >= ?`)
    .get(sinceIso) as UsageRow | undefined;
  return rowToTotals(row);
}

/** Coste/uso total en un rango [sinceIso, untilIso). */
export function getUsageBetween(sinceIso: string, untilIso: string): UsageTotals {
  const db = getDb();
  const row = db
    .prepare(`${TOTALS_SELECT} WHERE created_at >= ? AND created_at < ?`)
    .get(sinceIso, untilIso) as UsageRow | undefined;
  return rowToTotals(row);
}

/** Coste/uso total de una ejecución concreta (run_id), para desglosar por edición. */
export function getUsageForRun(runId: string): UsageTotals {
  const db = getDb();
  const row = db
    .prepare(`${TOTALS_SELECT} WHERE run_id = ?`)
    .get(runId) as UsageRow | undefined;
  return rowToTotals(row);
}

const TOTALS_BY_BRIEFING_TYPE_SELECT = `
  SELECT
    briefing_type,
    COUNT(*) AS call_count,
    SUM(input_tokens) AS input_tokens,
    SUM(cached_input_tokens) AS cached_input_tokens,
    SUM(output_tokens) AS output_tokens,
    SUM(total_tokens) AS total_tokens,
    SUM(cost_eur) AS cost_eur,
    SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) AS error_count,
    AVG(duration_ms) AS avg_duration_ms
  FROM openai_usage
  WHERE created_at >= ? AND created_at < ?
  GROUP BY briefing_type
`;

/** Coste/uso total por tipo de briefing en un rango. */
export function getUsageByBriefingType(
  sinceIso: string,
  untilIso: string
): Record<BriefingType, UsageTotals> {
  const db = getDb();
  const rows = db
    .prepare(TOTALS_BY_BRIEFING_TYPE_SELECT)
    .all(sinceIso, untilIso) as Array<UsageRow & { briefing_type: BriefingType | null }>;

  const result: Record<BriefingType, UsageTotals> = {
    general: emptyTotals(),
    financial: emptyTotals(),
  };
  for (const row of rows) {
    if (row.briefing_type === "general" || row.briefing_type === "financial") {
      result[row.briefing_type] = rowToTotals(row);
    }
  }
  return result;
}

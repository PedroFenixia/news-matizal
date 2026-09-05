import { randomUUID } from "node:crypto";
import { GENERAL_SOURCES, FINANCIAL_SOURCES } from "./rss/sources";
import { fetchFeeds } from "./rss/fetch";
import { generateGeneralBriefing, generateFinancialBriefing } from "./ai";
import { runIntradayRevision } from "./intraday";
import {
  saveEdition,
  nextEditionInfo,
  getEdition,
} from "./storage/editions";
import { logRunStart, logRunFinish } from "./storage/generation-log";
import type { BriefingType } from "./types";

/**
 * Lógica de negocio compartida entre:
 * - la API route /api/cron/daily y /api/refresh (invocación HTTP)
 * - el script standalone scripts/generate-daily.ts (invocación por
 *   crontab/systemd timer en el VPS)
 *
 * Cada tipo de briefing (general/financial) puede fallar de forma
 * completamente independiente: un fallo en uno nunca bloquea ni tumba al
 * otro. Cada ejecución queda registrada en generation_log.
 */

export interface GenerationOutcome {
  type: BriefingType;
  success: boolean;
  editionId?: string;
  itemsProcessed?: number;
  sourcesConsulted?: number;
  error?: string;
  /** Presente solo en revisiones intradía (ver runIntradayGeneration). */
  skipped?: boolean;
  newCount?: number;
  updatedCount?: number;
}

function todayMadrid(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

async function runGeneral(
  trigger: "cron" | "manual",
  date: string
): Promise<GenerationOutcome> {
  const runId = randomUUID();
  const logId = logRunStart({
    runId,
    type: "general",
    trigger,
    startedAt: new Date().toISOString(),
  });

  try {
    const feedResults = await fetchFeeds(GENERAL_SOURCES);
    const okResults = feedResults.filter((r) => r.ok);
    const items = okResults.flatMap((r) => r.items);

    if (items.length === 0) {
      throw new Error(
        `No se pudo obtener ningún artículo de las fuentes de prensa general (${feedResults
          .map((r) => `${r.outlet}: ${r.error ?? "sin items"}`)
          .join("; ")})`
      );
    }

    const editionInfo = nextEditionInfo("general", date);
    const briefing = await generateGeneralBriefing(items, {
      date,
      ...editionInfo,
    });

    saveEdition(briefing);

    logRunFinish(logId, {
      success: true,
      finishedAt: new Date().toISOString(),
      sourcesConsulted: feedResults.length,
      itemsProcessed: items.length,
      editionId: editionInfo.editionId,
    });

    console.log(
      `[generate:general] OK edición=${editionInfo.editionId} fuentes=${feedResults.length} items=${items.length}`
    );

    return {
      type: "general",
      success: true,
      editionId: editionInfo.editionId,
      itemsProcessed: items.length,
      sourcesConsulted: feedResults.length,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logRunFinish(logId, {
      success: false,
      finishedAt: new Date().toISOString(),
      errorMessage: message,
    });
    console.error(`[generate:general] ERROR: ${message}`);
    return { type: "general", success: false, error: message };
  }
}

async function runFinancial(
  trigger: "cron" | "manual",
  date: string
): Promise<GenerationOutcome> {
  const runId = randomUUID();
  const logId = logRunStart({
    runId,
    type: "financial",
    trigger,
    startedAt: new Date().toISOString(),
  });

  try {
    const feedResults = await fetchFeeds(FINANCIAL_SOURCES);
    const okResults = feedResults.filter((r) => r.ok);
    const items = okResults.flatMap((r) => r.items);

    if (items.length === 0) {
      throw new Error(
        `No se pudo obtener ningún artículo de las fuentes financieras (${feedResults
          .map((r) => `${r.outlet}: ${r.error ?? "sin items"}`)
          .join("; ")})`
      );
    }

    const editionInfo = nextEditionInfo("financial", date);
    const briefing = await generateFinancialBriefing(items, {
      date,
      ...editionInfo,
    });

    saveEdition(briefing);

    logRunFinish(logId, {
      success: true,
      finishedAt: new Date().toISOString(),
      sourcesConsulted: feedResults.length,
      itemsProcessed: items.length,
      editionId: editionInfo.editionId,
    });

    console.log(
      `[generate:financial] OK edición=${editionInfo.editionId} fuentes=${feedResults.length} items=${items.length}`
    );

    return {
      type: "financial",
      success: true,
      editionId: editionInfo.editionId,
      itemsProcessed: items.length,
      sourcesConsulted: feedResults.length,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logRunFinish(logId, {
      success: false,
      finishedAt: new Date().toISOString(),
      errorMessage: message,
    });
    console.error(`[generate:financial] ERROR: ${message}`);
    return { type: "financial", success: false, error: message };
  }
}

/**
 * Genera ambos briefings (general + financiero) EN PARALELO. Cada uno puede
 * fallar independientemente sin bloquear al otro (Promise.allSettled no se
 * usa porque cada run* ya captura sus propios errores internamente y nunca
 * rechaza la promesa).
 */
export async function runDailyGeneration(
  trigger: "cron" | "manual" = "cron",
  date: string = todayMadrid()
): Promise<GenerationOutcome[]> {
  console.log(`[generate:daily] Iniciando generación (${trigger}) para ${date}`);
  const [general, financial] = await Promise.all([
    runGeneral(trigger, date),
    runFinancial(trigger, date),
  ]);
  console.log(
    `[generate:daily] Finalizado. general=${general.success ? "OK" : "ERROR"} financial=${
      financial.success ? "OK" : "ERROR"
    }`
  );
  return [general, financial];
}

/**
 * Revisión intradía de un tipo de briefing (14:00/19:00). Parte de la
 * ÚLTIMA edición/revisión válida del día — si no existe ninguna todavía
 * (ej. la de las 10:00 falló, o aún no ha corrido), NO genera una desde
 * cero: eso es responsabilidad de runDailyGeneration/runGeneral(Financial).
 * Una revisión intradía solo tiene sentido como continuación de una edición
 * ya publicada. Si no hay artículos nuevos desde la última revisión, no se
 * llama a la IA ni se crea una fila nueva (outcome.skipped = true).
 */
async function runIntraday(
  type: BriefingType,
  date: string,
  sources: typeof GENERAL_SOURCES
): Promise<GenerationOutcome> {
  const runId = randomUUID();
  const logId = logRunStart({
    runId,
    type,
    trigger: "intraday",
    startedAt: new Date().toISOString(),
  });

  try {
    const previous = getEdition(type, date);
    if (!previous) {
      logRunFinish(logId, {
        success: false,
        finishedAt: new Date().toISOString(),
        errorMessage: "No hay edición previa hoy: la revisión intradía necesita una edición inicial ya publicada.",
      });
      return {
        type,
        success: false,
        error: "No hay edición inicial hoy todavía — la revisión intradía no puede partir de cero.",
      };
    }

    const feedResults = await fetchFeeds(sources);
    const okResults = feedResults.filter((r) => r.ok);
    const items = okResults.flatMap((r) => r.items);

    const result = await runIntradayRevision(previous, items);

    if (!result) {
      logRunFinish(logId, {
        success: true,
        finishedAt: new Date().toISOString(),
        sourcesConsulted: feedResults.length,
        itemsProcessed: 0,
      });
      console.log(`[intraday:${type}] Sin novedades desde la última edición — no se genera revisión.`);
      return { type, success: true, skipped: true, newCount: 0, updatedCount: 0 };
    }

    const editionInfo = nextEditionInfo(type, date);
    const briefing = { ...result.briefing, ...editionInfo, date, type } as typeof result.briefing;
    saveEdition(briefing);

    logRunFinish(logId, {
      success: true,
      finishedAt: new Date().toISOString(),
      sourcesConsulted: feedResults.length,
      itemsProcessed: items.length,
      editionId: editionInfo.editionId,
    });

    console.log(
      `[intraday:${type}] OK edición=${editionInfo.editionId} nuevos=${result.revisionSummary.newCount} actualizados=${result.revisionSummary.updatedCount}`
    );

    return {
      type,
      success: true,
      editionId: editionInfo.editionId,
      itemsProcessed: items.length,
      sourcesConsulted: feedResults.length,
      newCount: result.revisionSummary.newCount,
      updatedCount: result.revisionSummary.updatedCount,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logRunFinish(logId, {
      success: false,
      finishedAt: new Date().toISOString(),
      errorMessage: message,
    });
    console.error(`[intraday:${type}] ERROR: ${message}`);
    return { type, success: false, error: message };
  }
}

/**
 * Ejecuta la revisión intradía de ambos tipos EN PARALELO (14:00 o 19:00
 * Europe/Madrid). Cada tipo falla independientemente; un fallo NUNCA toca
 * la última edición válida (storage append-only: si algo falla, simplemente
 * no se crea una fila nueva).
 */
export async function runIntradayGeneration(
  date: string = todayMadrid()
): Promise<GenerationOutcome[]> {
  console.log(`[intraday] Iniciando revisión intradía para ${date}`);
  const [general, financial] = await Promise.all([
    runIntraday("general", date, GENERAL_SOURCES),
    runIntraday("financial", date, FINANCIAL_SOURCES),
  ]);
  console.log(
    `[intraday] Finalizado. general=${general.skipped ? "SIN CAMBIOS" : general.success ? "OK" : "ERROR"} financial=${
      financial.skipped ? "SIN CAMBIOS" : financial.success ? "OK" : "ERROR"
    }`
  );
  return [general, financial];
}

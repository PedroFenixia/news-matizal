import { randomUUID } from "node:crypto";
import { GENERAL_SOURCES, FINANCIAL_SOURCES } from "./rss/sources";
import { fetchFeeds } from "./rss/fetch";
import { generateGeneralBriefing, generateFinancialBriefing } from "./ai";
import { saveEdition, nextEditionInfo } from "./storage/editions";
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

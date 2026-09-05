import {
  getProvider,
  extractJson,
  normalizeSourceRef,
  nullToUndefined,
  type AiSourceRef,
} from "./ai";
import {
  intradayDeltaSchema,
  toOpenAiJsonSchema,
  type IntradayDeltaPayload,
} from "./ai/schemas";
import { buildIntradaySystemPrompt, buildIntradayUserPrompt } from "./ai/prompts";
import { recordUsage } from "./telemetry";
import type {
  Briefing,
  BriefingItem,
  BriefingSection,
  ExecutiveSummaryItem,
  NormalizedFeedItem,
  RevisionSummary,
  SourceRef,
  WatchItem,
} from "./types";

/**
 * Revisión intradía (14:00/19:00, ver README sección "Revisiones intradía").
 *
 * A diferencia de la edición inicial (10:00, regenera todo desde cero), una
 * revisión intradía parte de la ÚLTIMA edición/revisión válida del día y:
 *  1. Detecta qué artículos RSS son nuevos desde entonces (por URL, código
 *     puro, sin IA — barato y determinista).
 *  2. Si no hay ninguno, no llama a la IA: devuelve "sin cambios".
 *  3. Si los hay, le pide a la IA que los clasifique (nuevo punto / actualiza
 *     uno existente / no aporta nada) y redacte SOLO esos puntos + revise
 *     executiveSummary/watchToday — nunca que reescriba el documento entero.
 *  4. El merge en el documento completo (secciones sin cambios, newspapers,
 *     comparison, recommendedArticles, etc., que se copian tal cual de la
 *     edición anterior) lo hace este módulo en código, no la IA.
 *
 * Si la revisión falla (IA, red, lo que sea), se relanza el error tal cual:
 * la capa de arriba (lib/briefing-generator.ts) ya captura y loggea sin
 * tocar la última edición válida — el storage es append-only, así que un
 * fallo aquí simplemente no produce una fila nueva.
 */

export interface IntradayResult {
  briefing: Briefing;
  revisionSummary: RevisionSummary;
}

/** Todas las URLs ya "vistas" (citadas como fuente) en una edición. */
function collectKnownUrls(briefing: Briefing): Set<string> {
  const urls = new Set<string>();
  const add = (s: SourceRef | undefined) => {
    if (s?.url) urls.add(s.url);
  };

  for (const s of briefing.sources) add(s);
  for (const e of briefing.executiveSummary) e.sources.forEach(add);
  for (const w of briefing.watchToday) w.sources.forEach(add);
  for (const sec of briefing.sections) {
    for (const item of sec.items) item.sources.forEach(add);
  }
  if (briefing.type === "financial") {
    for (const item of briefing.businessImpact) item.sources.forEach(add);
  }

  return urls;
}

/** Artículos RSS cuya URL no aparece todavía en ninguna fuente de la edición anterior. */
export function detectNewItems(
  fetched: NormalizedFeedItem[],
  previous: Briefing
): NormalizedFeedItem[] {
  const known = collectKnownUrls(previous);
  return fetched.filter((item) => !item.link || !known.has(item.link));
}

function normalizeDeltaItem(
  raw: NonNullable<IntradayDeltaPayload["changes"][number]["item"]>
): BriefingItem {
  return {
    id: raw.id,
    headline: raw.headline,
    body: raw.body,
    priority: raw.priority,
    nature: nullToUndefined(raw.nature),
    sources: raw.sources.map((s) => normalizeSourceRef(s as AiSourceRef)),
  };
}

export interface ApplyChangesResult {
  sections: BriefingSection[];
  newCount: number;
  updatedCount: number;
  correctionCount: number;
  discardedCount: number;
}

/**
 * Aplica los "changes" del delta sobre las secciones de la edición anterior:
 * new_item se añade a la sección indicada (o, si no existe/no se indica, a
 * la primera sección — nunca se descarta un punto nuevo silenciosamente);
 * update_existing/correction reemplazan el item con ese id en cualquier
 * sección donde aparezca (correction se distingue solo por el revisionTag
 * resultante — "correction" en vez de "updated" — para que la UI lo marque
 * como "Corregido"). no_change/discarded no producen ningún cambio, solo
 * se cuentan para el resumen/log. El resto de items conserva el revisionTag
 * que tuviera (normalmente ninguno, de una edición ya consolidada).
 */
export function applySectionChanges(
  sections: BriefingSection[],
  changes: IntradayDeltaPayload["changes"]
): ApplyChangesResult {
  // Copia profunda superficial suficiente: solo mutamos items[] por sección.
  const result = sections.map((s) => ({ ...s, items: [...s.items] }));
  let newCount = 0;
  let updatedCount = 0;
  let correctionCount = 0;
  let discardedCount = 0;

  for (const change of changes) {
    if (change.classification === "discarded") {
      discardedCount++;
      continue;
    }
    if (change.classification === "no_change" || !change.item) continue;

    if (
      (change.classification === "update_existing" || change.classification === "correction") &&
      change.targetItemId
    ) {
      const tag = change.classification === "correction" ? "correction" : "updated";
      let applied = false;
      for (const section of result) {
        const idx = section.items.findIndex((i) => i.id === change.targetItemId);
        if (idx !== -1) {
          section.items[idx] = { ...normalizeDeltaItem(change.item), revisionTag: tag };
          applied = true;
          break;
        }
      }
      if (applied) {
        if (tag === "correction") correctionCount++;
        else updatedCount++;
        continue;
      }
      // targetItemId no encontrado (la IA se equivocó de id): trátalo como
      // nuevo en vez de perder el contenido redactado.
    }

    const targetSection =
      result.find((s) => s.key === change.sectionKey) ?? result[0];
    if (targetSection) {
      targetSection.items.push({ ...normalizeDeltaItem(change.item), revisionTag: "new" });
      newCount++;
    }
  }

  return { sections: result, newCount, updatedCount, correctionCount, discardedCount };
}

function normalizeExecutiveSummaryDelta(
  items: IntradayDeltaPayload["executiveSummary"],
  previous: ExecutiveSummaryItem[]
): ExecutiveSummaryItem[] {
  const previousHeadlines = new Set(previous.map((p) => p.headline));
  return items.map((i) => ({
    headline: i.headline,
    detail: i.detail,
    priority: i.priority,
    sources: i.sources.map((s) => normalizeSourceRef(s as AiSourceRef)),
    revisionTag: previousHeadlines.has(i.headline) ? undefined : ("new" as const),
  }));
}

function normalizeWatchTodayDelta(
  items: IntradayDeltaPayload["watchToday"],
  previous: WatchItem[]
): WatchItem[] {
  const previousTitles = new Set(previous.map((p) => p.title));
  return items.map((i) => ({
    title: i.title,
    description: i.description,
    when: nullToUndefined(i.when),
    priority: i.priority,
    sources: i.sources.map((s) => normalizeSourceRef(s as AiSourceRef)),
    revisionTag: previousTitles.has(i.title) ? undefined : ("new" as const),
  }));
}

export interface RunIntradayOptions {
  /** Para telemetría (ver lib/telemetry.ts). */
  runId?: string;
  trigger?: string;
}

/**
 * Ejecuta la revisión intradía. Devuelve null si no hay artículos nuevos
 * desde la última edición/revisión (no se llama a la IA ni se crea una fila
 * nueva — evita coste y ruido cuando de verdad no ha cambiado nada).
 *
 * La clasificación (new/updated/correction/no_change/discarded) usa el
 * modelo "fast" (ver lib/ai/model-config.ts): es una tarea de clasificación
 * y redacción incremental acotada, no la síntesis editorial completa que sí
 * justifica el modelo "editorial" de generateGeneralBriefing/Financial.
 */
export async function runIntradayRevision(
  previous: Briefing,
  fetchedItems: NormalizedFeedItem[],
  options: RunIntradayOptions = {}
): Promise<IntradayResult | null> {
  const newItems = detectNewItems(fetchedItems, previous);

  if (newItems.length === 0) {
    return null;
  }

  const provider = getProvider();
  const label = previous.type === "general" ? "general" : "financial";

  let result;
  try {
    result = await provider.generateJson({
      systemPrompt: buildIntradaySystemPrompt(label),
      userPrompt: buildIntradayUserPrompt({
        existingSections: previous.sections,
        existingExecutiveSummary: previous.executiveSummary,
        existingWatchToday: previous.watchToday,
        newItems,
      }),
      maxOutputTokens: 4000,
      taskKind: "fast",
      jsonSchema: {
        name: "intraday_delta",
        schema: toOpenAiJsonSchema(intradayDeltaSchema),
      },
    });
  } catch (err) {
    recordUsage({
      runId: options.runId,
      briefingType: previous.type,
      trigger: options.trigger,
      taskKind: "fast",
      operation: "intraday_classify",
      usage: { model: "unknown", inputTokens: 0, cachedInputTokens: 0, outputTokens: 0, totalTokens: 0, durationMs: 0 },
      success: false,
      errorMessage: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }

  recordUsage({
    runId: options.runId,
    briefingType: previous.type,
    trigger: options.trigger,
    taskKind: "fast",
    operation: "intraday_classify",
    usage: result.usage,
    success: true,
  });

  const delta = intradayDeltaSchema.parse(extractJson(result.content));

  const { sections, newCount, updatedCount, correctionCount, discardedCount } =
    applySectionChanges(previous.sections, delta.changes);

  const executiveSummary = normalizeExecutiveSummaryDelta(
    delta.executiveSummary,
    previous.executiveSummary
  );
  const watchToday = normalizeWatchTodayDelta(delta.watchToday, previous.watchToday);

  const revisionSummary: RevisionSummary = {
    newCount,
    updatedCount,
    correctionCount,
    discardedCount,
    consideredCount: newItems.length,
  };

  // sources de la edición: unión de las anteriores + los artículos nuevos
  // consultados en esta revisión (para que collectKnownUrls de la PRÓXIMA
  // revisión ya los conozca y no se reprocesen).
  const mergedSourcesByUrl = new Map<string, SourceRef>();
  for (const s of previous.sources) if (s.url) mergedSourcesByUrl.set(s.url, s);
  const now = new Date().toISOString();
  for (const i of newItems) {
    if (i.link) {
      mergedSourcesByUrl.set(i.link, {
        outlet: i.outlet,
        title: i.title,
        url: i.link,
        publishedAt: i.publishedAt,
        retrievedAt: now,
        category: i.category,
      });
    }
  }

  const base = {
    ...previous,
    updatedAt: now,
    sections,
    executiveSummary,
    watchToday,
    sources: Array.from(mergedSourcesByUrl.values()),
    isIntradayRevision: true,
    revisionSummary,
    generatedBy: `openai:${result.usage.model}`,
  };

  return { briefing: base as Briefing, revisionSummary };
}

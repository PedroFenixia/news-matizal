import type { AiProvider } from "./provider";
import { OpenAiProvider } from "./openai-provider";
import {
  generalBriefingAiSchema,
  financialBriefingAiSchema,
  toOpenAiJsonSchema,
  type GeneralBriefingAiPayload,
} from "./schemas";
import {
  buildGeneralSystemPrompt,
  buildGeneralUserPrompt,
  buildFinancialSystemPrompt,
  buildFinancialUserPrompt,
} from "./prompts";
import type {
  FinancialBriefing,
  GeneralBriefing,
  NormalizedFeedItem,
  SourceRef,
} from "../types";
import { recordUsage } from "../telemetry";

/**
 * El JSON Schema enviado a OpenAI (ver schemas.ts) modela todo campo
 * "opcional" como .nullable() en vez de .optional(), porque structured
 * outputs de OpenAI exige que TODO figure en "required". lib/types.ts, en
 * cambio, sigue usando `campo?: T` (undefined) como en el resto de la app.
 * Esta función es el único punto de conversión null -> undefined entre
 * ambos mundos, para no filtrar esta particularidad de OpenAI al resto del
 * código (componentes, storage, etc. no deben preocuparse de esto).
 */
export function nullToUndefined<T>(value: T | null | undefined): T | undefined {
  return value === null ? undefined : value;
}

export type AiSourceRef = {
  outlet: string;
  title: string | null;
  url: string | null;
  publishedAt: string | null;
  retrievedAt: string | null;
  category: string | null;
  nature: SourceRef["nature"] | null;
};

type AiSection = GeneralBriefingAiPayload["sections"][number];
type AiOutletHighlight = GeneralBriefingAiPayload["newspapers"][number];
type AiRecommendedArticle = GeneralBriefingAiPayload["recommendedArticles"][number];

export function normalizeSourceRef(s: AiSourceRef): SourceRef {
  return {
    outlet: s.outlet,
    title: nullToUndefined(s.title),
    url: nullToUndefined(s.url),
    publishedAt: nullToUndefined(s.publishedAt),
    retrievedAt: nullToUndefined(s.retrievedAt),
    category: nullToUndefined(s.category),
    nature: nullToUndefined(s.nature),
  };
}

function normalizeSections(sections: AiSection[]) {
  return sections.map((section) => ({
    key: section.key,
    title: section.title,
    intro: nullToUndefined(section.intro),
    items: section.items.map((item) => ({
      id: item.id,
      headline: item.headline,
      body: item.body,
      priority: item.priority,
      nature: nullToUndefined(item.nature),
      sources: item.sources.map(normalizeSourceRef),
    })),
  }));
}

function normalizeOutlets(outlets: AiOutletHighlight[]) {
  return outlets.map((o) => ({
    outlet: o.outlet,
    summary: o.summary,
    editorialStance: nullToUndefined(o.editorialStance),
    mainStories: o.mainStories,
  }));
}

function normalizeArticles(articles: AiRecommendedArticle[]) {
  return articles.map((a) => ({
    outlet: a.outlet,
    title: a.title,
    reason: a.reason,
    summary: a.summary,
    nature: a.nature,
    source: normalizeSourceRef(a.source),
  }));
}

/**
 * Punto de entrada único de la capa de IA. El resto de la app (API routes,
 * scripts) llama a `generateGeneralBriefing` / `generateFinancialBriefing`
 * sin conocer el proveedor concreto. Cambiar de proveedor = cambiar esta
 * factory (y añadir la implementación en un archivo `*-provider.ts` nuevo).
 */
export function getProvider(): AiProvider {
  const providerName = process.env.AI_PROVIDER ?? "openai";
  switch (providerName) {
    case "openai":
      return new OpenAiProvider();
    default:
      throw new Error(`Proveedor de IA desconocido: ${providerName}`);
  }
}

export function extractJson(raw: string): unknown {
  // response_format json_object ya garantiza JSON puro, pero por robustez
  // extraemos el primer bloque {...} por si el modelo añade texto extra.
  const trimmed = raw.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new Error("La respuesta de la IA no contiene JSON válido.");
    }
    return JSON.parse(match[0]);
  }
}

function sourcesFromItems(items: NormalizedFeedItem[]): SourceRef[] {
  const now = new Date().toISOString();
  return items.map((i) => ({
    outlet: i.outlet,
    title: i.title,
    url: i.link,
    publishedAt: i.publishedAt,
    retrievedAt: now,
    category: i.category,
  }));
}

function normalizeWatchToday(items: GeneralBriefingAiPayload["watchToday"]) {
  return items.map((w) => ({
    title: w.title,
    description: w.description,
    when: nullToUndefined(w.when),
    priority: w.priority,
    sources: w.sources.map(normalizeSourceRef),
  }));
}

function normalizeExecutiveSummary(
  items: GeneralBriefingAiPayload["executiveSummary"]
) {
  return items.map((i) => ({
    headline: i.headline,
    detail: i.detail,
    priority: i.priority,
    sources: i.sources.map(normalizeSourceRef),
  }));
}

export interface GenerateOptions {
  editionId: string;
  editionSequence: number;
  editionLabel: string;
  date: string;
  /** Para telemetría (ver lib/telemetry.ts): a qué ejecución pertenece esta llamada. */
  runId?: string;
  trigger?: string;
}

export async function generateGeneralBriefing(
  items: NormalizedFeedItem[],
  options: GenerateOptions
): Promise<GeneralBriefing> {
  const provider = getProvider();

  let result;
  try {
    result = await provider.generateJson({
      systemPrompt: buildGeneralSystemPrompt(),
      userPrompt: buildGeneralUserPrompt(items),
      // Con structured outputs el modelo debe escribir explícitamente todo
      // campo nullable (no puede omitirlos), lo que produce salidas más
      // largas que en json_object suelto — margen ampliado para no truncar.
      maxOutputTokens: 6500,
      taskKind: "editorial",
      jsonSchema: {
        name: "general_briefing",
        schema: toOpenAiJsonSchema(generalBriefingAiSchema),
      },
    });
  } catch (err) {
    recordUsage({
      runId: options.runId,
      briefingType: "general",
      trigger: options.trigger,
      taskKind: "editorial",
      operation: "generate_briefing",
      usage: { model: "unknown", inputTokens: 0, cachedInputTokens: 0, outputTokens: 0, totalTokens: 0, durationMs: 0 },
      success: false,
      errorMessage: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }

  recordUsage({
    runId: options.runId,
    briefingType: "general",
    trigger: options.trigger,
    taskKind: "editorial",
    operation: "generate_briefing",
    usage: result.usage,
    success: true,
  });

  const parsed = generalBriefingAiSchema.parse(extractJson(result.content));

  const briefing: GeneralBriefing = {
    type: "general",
    date: options.date,
    updatedAt: new Date().toISOString(),
    editionId: options.editionId,
    editionSequence: options.editionSequence,
    editionLabel: options.editionLabel,
    executiveSummary: normalizeExecutiveSummary(parsed.executiveSummary),
    sections: normalizeSections(parsed.sections),
    newspapers: normalizeOutlets(parsed.newspapers),
    recommendedArticles: normalizeArticles(parsed.recommendedArticles),
    comparison: parsed.comparison,
    watchToday: normalizeWatchToday(parsed.watchToday),
    sources: sourcesFromItems(items),
    generatedBy: `openai:${result.usage.model}`,
    isDemo: false,
  };

  return briefing;
}

export async function generateFinancialBriefing(
  items: NormalizedFeedItem[],
  options: GenerateOptions
): Promise<FinancialBriefing> {
  const provider = getProvider();

  let result;
  try {
    result = await provider.generateJson({
      systemPrompt: buildFinancialSystemPrompt(),
      userPrompt: buildFinancialUserPrompt(items),
      // Ampliado tras observar un truncamiento real en producción con 7500
      // (el financiero es la generación más larga: 9 secciones + businessImpact
      // + outlets + comparison + recommendedArticles, todo con sources completas).
      maxOutputTokens: 9000,
      taskKind: "editorial",
      jsonSchema: {
        name: "financial_briefing",
        schema: toOpenAiJsonSchema(financialBriefingAiSchema),
      },
    });
  } catch (err) {
    recordUsage({
      runId: options.runId,
      briefingType: "financial",
      trigger: options.trigger,
      taskKind: "editorial",
      operation: "generate_briefing",
      usage: { model: "unknown", inputTokens: 0, cachedInputTokens: 0, outputTokens: 0, totalTokens: 0, durationMs: 0 },
      success: false,
      errorMessage: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }

  recordUsage({
    runId: options.runId,
    briefingType: "financial",
    trigger: options.trigger,
    taskKind: "editorial",
    operation: "generate_briefing",
    usage: result.usage,
    success: true,
  });

  const parsed = financialBriefingAiSchema.parse(extractJson(result.content));

  const briefing: FinancialBriefing = {
    type: "financial",
    date: options.date,
    updatedAt: new Date().toISOString(),
    editionId: options.editionId,
    editionSequence: options.editionSequence,
    editionLabel: options.editionLabel,
    executiveSummary: normalizeExecutiveSummary(parsed.executiveSummary),
    sections: normalizeSections(parsed.sections),
    outlets: normalizeOutlets(parsed.outlets),
    businessImpact: parsed.businessImpact.map((item) => ({
      id: item.id,
      headline: item.headline,
      body: item.body,
      priority: item.priority,
      nature: nullToUndefined(item.nature),
      sources: item.sources.map(normalizeSourceRef),
    })),
    recommendedArticles: normalizeArticles(parsed.recommendedArticles),
    comparison: parsed.comparison,
    watchToday: normalizeWatchToday(parsed.watchToday),
    sources: sourcesFromItems(items),
    generatedBy: `openai:${result.usage.model}`,
    isDemo: false,
  };

  return briefing;
}

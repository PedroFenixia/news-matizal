import type { AiProvider } from "./provider";
import { OpenAiProvider } from "./openai-provider";
import {
  generalBriefingAiSchema,
  financialBriefingAiSchema,
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

/**
 * Punto de entrada único de la capa de IA. El resto de la app (API routes,
 * scripts) llama a `generateGeneralBriefing` / `generateFinancialBriefing`
 * sin conocer el proveedor concreto. Cambiar de proveedor = cambiar esta
 * factory (y añadir la implementación en un archivo `*-provider.ts` nuevo).
 */
function getProvider(): AiProvider {
  const providerName = process.env.AI_PROVIDER ?? "openai";
  switch (providerName) {
    case "openai":
      return new OpenAiProvider();
    default:
      throw new Error(`Proveedor de IA desconocido: ${providerName}`);
  }
}

function extractJson(raw: string): unknown {
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

export interface GenerateOptions {
  editionId: string;
  editionSequence: number;
  editionLabel: string;
  date: string;
}

export async function generateGeneralBriefing(
  items: NormalizedFeedItem[],
  options: GenerateOptions
): Promise<GeneralBriefing> {
  const provider = getProvider();

  const raw = await provider.generateJson({
    systemPrompt: buildGeneralSystemPrompt(),
    userPrompt: buildGeneralUserPrompt(items),
    maxOutputTokens: 4500,
  });

  const parsed = generalBriefingAiSchema.parse(extractJson(raw));

  const briefing: GeneralBriefing = {
    type: "general",
    date: options.date,
    updatedAt: new Date().toISOString(),
    editionId: options.editionId,
    editionSequence: options.editionSequence,
    editionLabel: options.editionLabel,
    executiveSummary: parsed.executiveSummary,
    sections: parsed.sections,
    newspapers: parsed.newspapers,
    recommendedArticles: parsed.recommendedArticles,
    comparison: parsed.comparison,
    watchToday: parsed.watchToday,
    sources: sourcesFromItems(items),
    generatedBy: provider.name,
    isDemo: false,
  };

  return briefing;
}

export async function generateFinancialBriefing(
  items: NormalizedFeedItem[],
  options: GenerateOptions
): Promise<FinancialBriefing> {
  const provider = getProvider();

  const raw = await provider.generateJson({
    systemPrompt: buildFinancialSystemPrompt(),
    userPrompt: buildFinancialUserPrompt(items),
    maxOutputTokens: 5500,
  });

  const parsed = financialBriefingAiSchema.parse(extractJson(raw));

  const briefing: FinancialBriefing = {
    type: "financial",
    date: options.date,
    updatedAt: new Date().toISOString(),
    editionId: options.editionId,
    editionSequence: options.editionSequence,
    editionLabel: options.editionLabel,
    executiveSummary: parsed.executiveSummary,
    sections: parsed.sections,
    outlets: parsed.outlets,
    businessImpact: parsed.businessImpact,
    recommendedArticles: parsed.recommendedArticles,
    comparison: parsed.comparison,
    watchToday: parsed.watchToday,
    sources: sourcesFromItems(items),
    generatedBy: provider.name,
    isDemo: false,
  };

  return briefing;
}

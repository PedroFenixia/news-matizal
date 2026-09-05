import { z } from "zod";

/**
 * Esquemas zod para validar la respuesta JSON del proveedor de IA contra la
 * forma esperada de GeneralBriefing / FinancialBriefing (sin los campos que
 * añadimos nosotros después: date, updatedAt, editionId, etc.).
 */

const prioritySchema = z.enum(["attention", "important", "context"]);
const natureSchema = z.enum(["fact", "analysis", "opinion"]);

// Nota: se usa .nullable() en vez de .optional() en todos los campos no
// obligatorios de estos esquemas (a diferencia de lib/types.ts, que sí usa
// optional?). Motivo: estos schemas alimentan también el JSON Schema que se
// envía a OpenAI como "structured output" (ver toOpenAiJsonSchema más abajo)
// — ahí TODO campo debe figurar en "required", y lo "opcional" se modela
// como unión con null. .optional() no cumple ese requisito; .nullable() sí.
const sourceRefSchema = z.object({
  outlet: z.string().min(1),
  title: z.string().nullable(),
  url: z.string().url().nullable(),
  publishedAt: z.string().nullable(),
  retrievedAt: z.string().nullable(),
  category: z.string().nullable(),
  nature: natureSchema.nullable(),
});

const briefingItemSchema = z.object({
  id: z.string().min(1),
  headline: z.string().min(1),
  body: z.string().min(1),
  priority: prioritySchema,
  nature: natureSchema.nullable(),
  sources: z.array(sourceRefSchema),
});

const briefingSectionSchema = z.object({
  key: z.string().min(1),
  title: z.string().min(1),
  intro: z.string().nullable(),
  items: z.array(briefingItemSchema),
});

const outletHighlightSchema = z.object({
  outlet: z.string().min(1),
  summary: z.string().min(1),
  editorialStance: z.string().nullable(),
  mainStories: z.array(z.string()),
});

const recommendedArticleSchema = z.object({
  outlet: z.string().min(1),
  title: z.string().min(1),
  reason: z.string().min(1),
  summary: z.string().min(1),
  nature: natureSchema,
  source: sourceRefSchema,
});

const editorialComparisonRowSchema = z.object({
  outlet: z.string().min(1),
  mainFocus: z.string().min(1),
  interpretation: z.string().min(1),
  nature: natureSchema,
});

const watchItemSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  when: z.string().nullable(),
  priority: prioritySchema,
  sources: z.array(sourceRefSchema),
});

const executiveSummaryItemSchema = z.object({
  headline: z.string().min(1),
  detail: z.string().min(1),
  priority: prioritySchema,
  sources: z.array(sourceRefSchema),
});

export const generalBriefingAiSchema = z.object({
  executiveSummary: z.array(executiveSummaryItemSchema).min(1),
  sections: z.array(briefingSectionSchema).min(1),
  newspapers: z.array(outletHighlightSchema),
  recommendedArticles: z.array(recommendedArticleSchema),
  comparison: z.array(editorialComparisonRowSchema),
  watchToday: z.array(watchItemSchema),
});

export const financialBriefingAiSchema = z.object({
  executiveSummary: z.array(executiveSummaryItemSchema).min(1),
  sections: z.array(briefingSectionSchema).min(1),
  outlets: z.array(outletHighlightSchema),
  businessImpact: z.array(briefingItemSchema),
  recommendedArticles: z.array(recommendedArticleSchema),
  comparison: z.array(editorialComparisonRowSchema),
  watchToday: z.array(watchItemSchema),
});

/**
 * JSON Schema derivado para "structured outputs" de OpenAI (ver
 * lib/ai/openai-provider.ts). z.toJSONSchema ya produce
 * additionalProperties:false y solo mete en "required" los campos sin
 * .nullable()/.optional() — como aquí TODO opcional está modelado con
 * .nullable(), el resultado ya cumple el requisito estricto de OpenAI
 * (100% de las claves en "required").
 *
 * OpenAI structured outputs en modo strict solo soporta un subconjunto de
 * JSON Schema: rechaza keywords de validación adicionales como minLength,
 * minItems o format (error "Invalid schema"). stripUnsupportedKeywords
 * los elimina recursivamente — la validación real de esos límites la sigue
 * haciendo zod (schema.parse) sobre la respuesta ya recibida.
 */
export function toOpenAiJsonSchema(
  schema:
    | typeof generalBriefingAiSchema
    | typeof financialBriefingAiSchema
    | typeof intradayDeltaSchema
): Record<string, unknown> {
  const raw = z.toJSONSchema(schema, { target: "draft-7" }) as Record<string, unknown>;
  const rest = { ...raw };
  delete rest.$schema;
  return stripUnsupportedKeywords(rest) as Record<string, unknown>;
}

const UNSUPPORTED_KEYWORDS = new Set([
  "minLength",
  "maxLength",
  "minItems",
  "maxItems",
  "format",
  "pattern",
  "minimum",
  "maximum",
]);

function stripUnsupportedKeywords(node: unknown): unknown {
  if (Array.isArray(node)) {
    return node.map(stripUnsupportedKeywords);
  }
  if (node !== null && typeof node === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(node)) {
      if (UNSUPPORTED_KEYWORDS.has(key)) continue;
      out[key] = stripUnsupportedKeywords(value);
    }
    return out;
  }
  return node;
}

export type GeneralBriefingAiPayload = z.infer<typeof generalBriefingAiSchema>;
export type FinancialBriefingAiPayload = z.infer<typeof financialBriefingAiSchema>;

/**
 * Esquema del DELTA de una revisión intradía (ver lib/intraday.ts): en vez
 * de pedirle a la IA que reescriba el briefing completo (caro, y arriesgado
 * — reescribir de cero un documento largo con structured outputs invita a
 * detalles inconsistentes con la versión anterior), se le pasan SOLO los
 * artículos nuevos desde la última revisión + el resumen ejecutivo/watchToday
 * actuales, y devuelve qué cambia. El merge en el documento completo lo hace
 * código determinista (lib/intraday.ts), no la IA.
 */
/**
 * Cinco estados de clasificación de una novedad en una revisión intradía:
 * - new_item: noticia nueva suficientemente importante para el briefing.
 * - update_existing: evolución relevante de una noticia ya cubierta.
 * - correction: la novedad CORRIGE o INVALIDA información ya publicada
 *   (mismo mecanismo que update_existing — reemplaza el item por targetItemId
 *   — pero se distingue visualmente como "Corregido", no "Actualizado", para
 *   que el lector entienda que lo anterior estaba desactualizado/incorrecto,
 *   no solo ampliado).
 * - no_change (UNCHANGED): no aporta nada que cambie el briefing.
 * - discarded (DISCARDED): irrelevante, ruido, no merece aparecer.
 * discarded y no_change se comportan igual en el merge (no producen ningún
 * cambio); se distinguen solo para trazabilidad/logs de por qué se descartó
 * cada artículo nuevo.
 */
const deltaClassificationSchema = z.enum([
  "new_item",
  "update_existing",
  "correction",
  "no_change",
  "discarded",
]);

const deltaChangeSchema = z.object({
  classification: deltaClassificationSchema,
  /**
   * Sección destino (key de BriefingSection, ej. "B") para new_item. Para
   * update_existing/correction, la sección donde vive el id referenciado
   * (informativo, el merge busca el id en todas las secciones igualmente).
   */
  sectionKey: z.string().nullable(),
  /** Para update_existing/correction: id del BriefingItem existente a actualizar. Null en new_item. */
  targetItemId: z.string().nullable(),
  /** Contenido del punto nuevo o actualizado. Null si classification es no_change/discarded. */
  item: z
    .object({
      id: z.string().min(1),
      headline: z.string().min(1),
      body: z.string().min(1),
      priority: prioritySchema,
      nature: natureSchema.nullable(),
      sources: z.array(sourceRefSchema),
    })
    .nullable(),
});

export const intradayDeltaSchema = z.object({
  changes: z.array(deltaChangeSchema),
  /**
   * Resumen ejecutivo actualizado (lista completa, no delta) — es corto y
   * conviene que la IA lo revise entero para reflejar bien la novedad del
   * momento; ídem watchToday. Si nada cambia respecto al original, se
   * devuelve tal cual se pasó en el prompt.
   */
  executiveSummary: z.array(executiveSummaryItemSchema).min(1),
  watchToday: z.array(watchItemSchema),
});

export type IntradayDeltaPayload = z.infer<typeof intradayDeltaSchema>;

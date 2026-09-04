import { z } from "zod";

/**
 * Esquemas zod para validar la respuesta JSON del proveedor de IA contra la
 * forma esperada de GeneralBriefing / FinancialBriefing (sin los campos que
 * añadimos nosotros después: date, updatedAt, editionId, etc.).
 */

const prioritySchema = z.enum(["attention", "important", "context"]);
const natureSchema = z.enum(["fact", "analysis", "opinion"]);

const sourceRefSchema = z.object({
  outlet: z.string().min(1),
  title: z.string().optional(),
  url: z.string().url().optional(),
  publishedAt: z.string().optional(),
  retrievedAt: z.string().optional(),
  category: z.string().optional(),
  nature: natureSchema.optional(),
});

const briefingItemSchema = z.object({
  id: z.string().min(1),
  headline: z.string().min(1),
  body: z.string().min(1),
  priority: prioritySchema,
  nature: natureSchema.optional(),
  sources: z.array(sourceRefSchema).default([]),
});

const briefingSectionSchema = z.object({
  key: z.string().min(1),
  title: z.string().min(1),
  intro: z.string().optional(),
  items: z.array(briefingItemSchema).default([]),
});

const outletHighlightSchema = z.object({
  outlet: z.string().min(1),
  summary: z.string().min(1),
  editorialStance: z.string().optional(),
  mainStories: z.array(z.string()).default([]),
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
  when: z.string().optional(),
  priority: prioritySchema,
});

const executiveSummaryItemSchema = z.object({
  headline: z.string().min(1),
  detail: z.string().min(1),
  priority: prioritySchema,
});

export const generalBriefingAiSchema = z.object({
  executiveSummary: z.array(executiveSummaryItemSchema).min(1),
  sections: z.array(briefingSectionSchema).min(1),
  newspapers: z.array(outletHighlightSchema).default([]),
  recommendedArticles: z.array(recommendedArticleSchema).default([]),
  comparison: z.array(editorialComparisonRowSchema).default([]),
  watchToday: z.array(watchItemSchema).default([]),
});

export const financialBriefingAiSchema = z.object({
  executiveSummary: z.array(executiveSummaryItemSchema).min(1),
  sections: z.array(briefingSectionSchema).min(1),
  outlets: z.array(outletHighlightSchema).default([]),
  businessImpact: z.array(briefingItemSchema).default([]),
  recommendedArticles: z.array(recommendedArticleSchema).default([]),
  comparison: z.array(editorialComparisonRowSchema).default([]),
  watchToday: z.array(watchItemSchema).default([]),
});

export type GeneralBriefingAiPayload = z.infer<typeof generalBriefingAiSchema>;
export type FinancialBriefingAiPayload = z.infer<typeof financialBriefingAiSchema>;

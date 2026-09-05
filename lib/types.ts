/**
 * Tipos centrales de Matizal News.
 *
 * Dos tipos de briefing comparten una base común (BaseBriefing) y añaden
 * secciones específicas: general (prensa) vs financiero (mercados).
 */

export type BriefingType = "general" | "financial";

/** Nivel de prioridad visual: alto impacto, importante o solo contexto. */
export type PriorityLevel = "attention" | "important" | "context";

/** Naturaleza editorial de una pieza: hecho constatado, análisis o opinión. */
export type EditorialNature = "fact" | "analysis" | "opinion";

/**
 * Etiqueta de una revisión intradía (ver lib/intraday.ts): marca si un punto
 * es nuevo desde la última edición/revisión del día, si ya existía pero se
 * ha ampliado/actualizado, o si corrige/invalida información publicada
 * antes (mismo mecanismo que "updated" pero semánticamente distinto: el
 * lector debe saber que lo anterior estaba mal, no solo incompleto).
 * Ausente en puntos que no cambian entre revisiones.
 */
export type RevisionTag = "new" | "updated" | "correction";

/** Una fuente/artículo original citado, nunca con contenido íntegro. */
export interface SourceRef {
  /** Nombre del medio, ej. "El País". */
  outlet: string;
  /** Título original de la pieza citada. */
  title?: string;
  /**
   * URL de la fuente. Debe ser una URL real y verificable (nunca inventada).
   * Si no se puede verificar la URL exacta del artículo, omitir y mostrar
   * solo el nombre del medio.
   */
  url?: string;
  /** Fecha/hora de publicación original si está disponible (ISO 8601). */
  publishedAt?: string;
  /** Fecha/hora en la que se consultó/recopiló la fuente (ISO 8601). */
  retrievedAt?: string;
  /** Categoría editorial libre, ej. "Política", "Mercados". */
  category?: string;
  /** Naturaleza: hecho, análisis u opinión. */
  nature?: EditorialNature;
}

/** Un punto/noticia dentro de una sección del briefing. */
export interface BriefingItem {
  id: string;
  /** Titular propio, en español, redactado por el sistema (nunca copia literal). */
  headline: string;
  /** Cuerpo explicativo: qué ocurrió y por qué importa. */
  body: string;
  priority: PriorityLevel;
  nature?: EditorialNature;
  /** Fuentes que contrastan o respaldan este punto (puede haber varias). */
  sources: SourceRef[];
  /** Presente solo si esta revisión introdujo el punto o lo actualizó. */
  revisionTag?: RevisionTag;
}

/** Sección temática del briefing (ej. "Política nacional", "Mercados"). */
export interface BriefingSection {
  /** Identificador corto de sección, ej. "A", "B"... usado para anclas y "§". */
  key: string;
  /** Título visible de la sección. */
  title: string;
  /** Texto introductorio opcional de la sección. */
  intro?: string;
  items: BriefingItem[];
}

/** Qué destaca un periódico/medio concreto (sección G de prensa general). */
export interface OutletHighlight {
  outlet: string;
  /** Resumen de qué prioriza este medio hoy. */
  summary: string;
  /** Enfoque editorial percibido. */
  editorialStance?: string;
  mainStories: string[];
}

/** Artículo recomendado de un medio (sección H / M). */
export interface RecommendedArticle {
  outlet: string;
  title: string;
  /** Por qué merece la pena leerlo. */
  reason: string;
  /** Resumen propio en español, nunca traducción/reproducción íntegra. */
  summary: string;
  nature: EditorialNature;
  source: SourceRef;
}

/** Fila de la tabla de comparación editorial (sección I). */
export interface EditorialComparisonRow {
  outlet: string;
  mainFocus: string;
  interpretation: string;
  nature: EditorialNature;
}

/** Evento a vigilar (sección J / L). */
export interface WatchItem {
  title: string;
  description: string;
  /** Fecha/hora prevista si se conoce (ISO 8601 o texto libre tipo "Esta tarde"). */
  when?: string;
  priority: PriorityLevel;
  /** Fuente(s) que respaldan este evento a vigilar. */
  sources: SourceRef[];
  /** Presente solo si esta revisión introdujo el punto o lo actualizó. */
  revisionTag?: RevisionTag;
}

/** Punto del resumen ejecutivo. */
export interface ExecutiveSummaryItem {
  headline: string;
  detail: string;
  priority: PriorityLevel;
  /** Fuente(s) que respaldan este punto del resumen. */
  sources: SourceRef[];
  /** Presente solo si esta revisión introdujo el punto o lo actualizó. */
  revisionTag?: RevisionTag;
}

/** Resumen de qué cambió en una revisión intradía respecto a la anterior. */
export interface RevisionSummary {
  newCount: number;
  updatedCount: number;
  correctionCount: number;
  discardedCount: number;
  /** Total de puntos considerados al contrastar (para trazabilidad/logs). */
  consideredCount: number;
}

/** Campos comunes a cualquier edición (general o financiera). */
export interface BaseBriefing {
  /** Fecha de la edición, formato YYYY-MM-DD (fecha "editorial", no de generación). */
  date: string;
  /** Momento exacto de generación/publicación de esta edición (ISO 8601). */
  updatedAt: string;
  type: BriefingType;
  /**
   * Identificador de edición dentro del día: "initial", "update-1", "update-2"...
   * Permite múltiples ediciones/actualizaciones extraordinarias por día.
   */
  editionId: string;
  /** Etiqueta legible de la edición, ej. "Edición inicial", "Actualización 1". */
  editionLabel: string;
  /** Número de secuencia dentro del día, empezando en 0 para la inicial. */
  editionSequence: number;
  executiveSummary: ExecutiveSummaryItem[];
  sections: BriefingSection[];
  recommendedArticles: RecommendedArticle[];
  comparison: EditorialComparisonRow[];
  watchToday: WatchItem[];
  /** Todas las fuentes RSS consultadas para generar esta edición. */
  sources: SourceRef[];
  /** Marca explícita de contenido de demostración. */
  isDemo?: boolean;
  /** Modelo/proveedor de IA usado para generar esta edición. */
  generatedBy?: string;
  /**
   * true si esta edición es una revisión intradía (14:00/19:00) que parte
   * de la anterior y solo contrasta novedades, en vez de la edición inicial
   * completa de las 10:00. Ver lib/intraday.ts.
   */
  isIntradayRevision?: boolean;
  /** Presente solo en revisiones intradía: qué cambió respecto a la anterior. */
  revisionSummary?: RevisionSummary;
}

/** Briefing de prensa general (secciones A-J según especificación). */
export interface GeneralBriefing extends BaseBriefing {
  type: "general";
  /** Sección G: qué destaca cada cabecera. */
  newspapers: OutletHighlight[];
}

/** Briefing financiero (secciones A-M según especificación). */
export interface FinancialBriefing extends BaseBriefing {
  type: "financial";
  /**
   * Sección K: impacto empresarial práctico para empresas españolas
   * (financiación, costes, inversión, empleo, energía, consumo).
   */
  businessImpact: BriefingItem[];
  /** Medios/outlets financieros de referencia (equivalente a "newspapers"). */
  outlets: OutletHighlight[];
}

export type Briefing = GeneralBriefing | FinancialBriefing;

/** Metadatos de una edición, usados para listados/índices sin cargar el JSON completo. */
export interface EditionMeta {
  date: string;
  editionId: string;
  editionLabel: string;
  editionSequence: number;
  updatedAt: string;
  type: BriefingType;
  isDemo?: boolean;
}

/** Resultado de una ejecución de generación (cron o manual). */
export interface GenerationLogEntry {
  id?: number;
  runId: string;
  type: BriefingType;
  trigger: "cron" | "manual" | "cleanup" | "intraday";
  startedAt: string;
  finishedAt?: string;
  success?: boolean;
  sourcesConsulted?: number;
  itemsProcessed?: number;
  editionId?: string;
  errorMessage?: string;
}

/** Artículo RSS normalizado, previo a pasar por la IA. */
export interface NormalizedFeedItem {
  outlet: string;
  title: string;
  link?: string;
  description?: string;
  publishedAt?: string;
  category?: string;
}

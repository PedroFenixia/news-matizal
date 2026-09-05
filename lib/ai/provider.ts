import type { TaskKind } from "./model-config";

/** Métricas de uso de una llamada a IA, para telemetría/coste (ver lib/telemetry.ts). */
export interface AiUsage {
  model: string;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  totalTokens: number;
  durationMs: number;
}

export interface AiGenerateResult {
  content: string;
  usage: AiUsage;
}

/**
 * Interfaz de proveedor de IA, desacoplada del proveedor concreto (hoy
 * OpenAI, mañana cualquier otro). Cambiar de proveedor implica solo
 * implementar esta interfaz y ajustar `lib/ai/index.ts`.
 */
export interface AiProvider {
  /** Nombre identificativo, ej. "openai:gpt-4o-mini". Usado en logs y en `generatedBy`. */
  readonly name: string;

  /**
   * Pide al modelo generar JSON siguiendo `systemPrompt` + `userPrompt`.
   * Devuelve el texto crudo de la respuesta (JSON string) junto con las
   * métricas de uso de la llamada — la validación contra el esquema zod
   * ocurre en la capa superior.
   */
  generateJson(params: {
    systemPrompt: string;
    userPrompt: string;
    maxOutputTokens?: number;
    /**
     * Qué rol de modelo usar (ver lib/ai/model-config.ts): "fast" para
     * clasificación/detección de novedades, "editorial" para síntesis y
     * redacción final. Por defecto "editorial" (generación completa de un
     * briefing es la tarea editorial por excelencia).
     */
    taskKind?: TaskKind;
    /**
     * JSON Schema opcional que describe la forma exacta esperada. Los
     * proveedores que soporten "structured outputs" (ej. OpenAI) deben
     * usarlo para forzar el cumplimiento estricto del esquema en la propia
     * generación, en vez de confiar solo en instrucciones de texto — evita
     * respuestas con campos de tipo incorrecto o valores fuera de enum.
     * Proveedores sin este soporte pueden ignorarlo con seguridad: la
     * validación zod de la capa superior sigue actuando como red de
     * seguridad final en cualquier caso.
     */
    jsonSchema?: { name: string; schema: Record<string, unknown> };
  }): Promise<AiGenerateResult>;
}

export class AiProviderError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "AiProviderError";
  }
}

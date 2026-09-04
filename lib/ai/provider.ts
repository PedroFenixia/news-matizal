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
   * Debe devolver el texto crudo de la respuesta (JSON string); la
   * validación contra el esquema zod ocurre en la capa superior.
   */
  generateJson(params: {
    systemPrompt: string;
    userPrompt: string;
    maxOutputTokens?: number;
  }): Promise<string>;
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

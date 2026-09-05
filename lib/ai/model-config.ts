/**
 * Configuración CENTRALIZADA de modelos y precios de OpenAI. Ningún otro
 * módulo debe escribir un nombre de modelo o un precio a mano — todo pasa
 * por aquí, para poder ajustar la estrategia de coste desde un único sitio
 * (o simplemente cambiando variables de entorno, sin tocar código).
 *
 * Dos roles de modelo, elegidos por tarea (ver TaskKind):
 * - "fast": clasificación, relevancia, deduplicación semántica, detección de
 *   novedades — tareas mecánicas, se benefician de un modelo barato y rápido.
 * - "editorial": resumen ejecutivo, síntesis, comparación editorial, redacción
 *   final del briefing — necesita más calidad, se usa con moderación.
 */

export type TaskKind = "fast" | "editorial";

const DEFAULT_FAST_MODEL = "gpt-4o-mini";
const DEFAULT_EDITORIAL_MODEL = "gpt-4o-mini";

/**
 * Nota deliberada: el default de "editorial" es TAMBIÉN gpt-4o-mini, no un
 * modelo más caro. gpt-4o-mini ya sostiene la calidad editorial de Matizal
 * News en producción (ver historial del proyecto) con un coste bajo — subir
 * a un modelo más caro por defecto contradice el objetivo de coste (sección
 * 13 del brief: apuntar a <=20€/mes). Súbelo tú explícitamente vía
 * OPENAI_MODEL_EDITORIAL si decides que la calidad lo justifica.
 */
export function getModelForTask(task: TaskKind): string {
  if (task === "fast") {
    return process.env.OPENAI_MODEL_FAST?.trim() || DEFAULT_FAST_MODEL;
  }
  return process.env.OPENAI_MODEL_EDITORIAL?.trim() || DEFAULT_EDITORIAL_MODEL;
}

/**
 * Precios de referencia en EUR por cada 1,000,000 de tokens, a fecha de
 * escritura de este módulo (comprueba https://openai.com/api/pricing/ si
 * los usas para presupuestar con precisión — cambian con el tiempo). Sirven
 * para el cálculo de coste ESTIMADO que se muestra en el panel de uso
 * (sección 11 del brief); no son una factura, son una aproximación.
 *
 * "cachedInput" es el precio de los input tokens servidos desde el cache de
 * prompts de OpenAI (bastante más barato) cuando la API lo reporta
 * (`usage.prompt_tokens_details.cached_tokens`); si un modelo no aparece
 * aquí, se cae a PRICING.default.
 */
interface ModelPricing {
  /** EUR por 1M tokens de entrada (no cacheados). */
  input: number;
  /** EUR por 1M tokens de entrada servidos desde cache de prompt. */
  cachedInput: number;
  /** EUR por 1M tokens de salida. */
  output: number;
}

// Precios de OpenAI publicados en USD, convertidos a EUR a ~0.92 EUR/USD
// (tipo de cambio aproximado — no se llama a ningún servicio de FX en
// tiempo real por simplicidad; ajusta PRICING si quieres más precisión).
const USD_TO_EUR = 0.92;
function usd(input: number, cachedInput: number, output: number): ModelPricing {
  return {
    input: input * USD_TO_EUR,
    cachedInput: cachedInput * USD_TO_EUR,
    output: output * USD_TO_EUR,
  };
}

const PRICING: Record<string, ModelPricing> = {
  "gpt-4o-mini": usd(0.15, 0.075, 0.6),
  "gpt-4o": usd(2.5, 1.25, 10),
  "gpt-4.1": usd(2, 0.5, 8),
  "gpt-4.1-mini": usd(0.4, 0.1, 1.6),
  "gpt-4.1-nano": usd(0.1, 0.025, 0.4),
  default: usd(0.15, 0.075, 0.6),
};

export interface UsageTokens {
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
}

/** Coste estimado en EUR para un uso de tokens dado, según el modelo. */
export function estimateCostEur(model: string, usage: UsageTokens): number {
  const pricing = PRICING[model] ?? PRICING.default;
  const uncachedInput = Math.max(0, usage.inputTokens - usage.cachedInputTokens);
  const cost =
    (uncachedInput / 1_000_000) * pricing.input +
    (usage.cachedInputTokens / 1_000_000) * pricing.cachedInput +
    (usage.outputTokens / 1_000_000) * pricing.output;
  return cost;
}

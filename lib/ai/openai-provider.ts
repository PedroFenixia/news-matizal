import OpenAI from "openai";
import { AiProvider, AiProviderError, AiGenerateResult } from "./provider";
import { getModelForTask, type TaskKind } from "./model-config";

const DEFAULT_TIMEOUT_MS = 60_000;
const MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 1_000;

export class OpenAiProvider implements AiProvider {
  readonly name = "openai";
  private client: OpenAI;

  constructor(options?: { apiKey?: string }) {
    const apiKey = options?.apiKey ?? process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new AiProviderError(
        "OPENAI_API_KEY no está definida. Configúrala como variable de entorno."
      );
    }
    this.client = new OpenAI({ apiKey, timeout: DEFAULT_TIMEOUT_MS });
  }

  async generateJson(params: {
    systemPrompt: string;
    userPrompt: string;
    maxOutputTokens?: number;
    taskKind?: TaskKind;
    jsonSchema?: { name: string; schema: Record<string, unknown> };
  }): Promise<AiGenerateResult> {
    const model = getModelForTask(params.taskKind ?? "editorial");
    let lastError: unknown;

    // Con schema: "structured outputs" (json_schema + strict) fuerza al
    // modelo a cumplir la forma exacta durante la propia generación, en vez
    // de solo pedirlo por texto — elimina la clase de error "el modelo puso
    // un string donde iba un objeto" o "usó un valor fuera del enum".
    const responseFormat = params.jsonSchema
      ? ({
          type: "json_schema" as const,
          json_schema: {
            name: params.jsonSchema.name,
            schema: params.jsonSchema.schema,
            strict: true,
          },
        })
      : ({ type: "json_object" as const });

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      const startedAt = Date.now();
      try {
        const response = await this.client.chat.completions.create({
          model,
          messages: [
            { role: "system", content: params.systemPrompt },
            { role: "user", content: params.userPrompt },
          ],
          response_format: responseFormat,
          temperature: 0.4,
          max_tokens: params.maxOutputTokens ?? 4000,
        });

        const durationMs = Date.now() - startedAt;
        const content = response.choices[0]?.message?.content;
        if (!content) {
          throw new AiProviderError(
            "Respuesta de OpenAI sin contenido (choices[0].message.content vacío)."
          );
        }

        if (response.choices[0]?.finish_reason === "length") {
          throw new AiProviderError(
            `Respuesta de OpenAI truncada por límite de tokens (max_tokens=${
              params.maxOutputTokens ?? 4000
            }). Aumenta maxOutputTokens en lib/ai/index.ts.`
          );
        }

        const usage = response.usage;
        const cachedInputTokens = usage?.prompt_tokens_details?.cached_tokens ?? 0;

        console.log(
          `[ai:openai] modelo=${model} tarea=${params.taskKind ?? "editorial"} intento=${attempt} tokens=${usage?.total_tokens ?? "?"} (cached=${cachedInputTokens}) duración=${durationMs}ms`
        );

        return {
          content,
          usage: {
            model,
            inputTokens: usage?.prompt_tokens ?? 0,
            cachedInputTokens,
            outputTokens: usage?.completion_tokens ?? 0,
            totalTokens: usage?.total_tokens ?? 0,
            durationMs,
          },
        };
      } catch (err) {
        lastError = err;
        const isLastAttempt = attempt === MAX_RETRIES;
        console.warn(
          `[ai:openai] intento ${attempt}/${MAX_RETRIES} falló (modelo=${model}): ${
            err instanceof Error ? err.message : String(err)
          }`
        );
        if (!isLastAttempt) {
          const backoff = BASE_BACKOFF_MS * 2 ** (attempt - 1);
          await sleep(backoff);
        }
      }
    }

    throw new AiProviderError(
      `OpenAI falló tras ${MAX_RETRIES} intentos (modelo=${model}): ${
        lastError instanceof Error ? lastError.message : String(lastError)
      }`,
      lastError
    );
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

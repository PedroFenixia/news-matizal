import OpenAI from "openai";
import { AiProvider, AiProviderError } from "./provider";

const DEFAULT_MODEL = "gpt-4o-mini";
const DEFAULT_TIMEOUT_MS = 60_000;
const MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 1_000;

export class OpenAiProvider implements AiProvider {
  readonly name: string;
  private client: OpenAI;
  private model: string;

  constructor(options?: { apiKey?: string; model?: string }) {
    const apiKey = options?.apiKey ?? process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new AiProviderError(
        "OPENAI_API_KEY no está definida. Configúrala como variable de entorno."
      );
    }
    this.model = options?.model ?? process.env.OPENAI_MODEL ?? DEFAULT_MODEL;
    this.name = `openai:${this.model}`;
    this.client = new OpenAI({ apiKey, timeout: DEFAULT_TIMEOUT_MS });
  }

  async generateJson(params: {
    systemPrompt: string;
    userPrompt: string;
    maxOutputTokens?: number;
  }): Promise<string> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const response = await this.client.chat.completions.create({
          model: this.model,
          messages: [
            { role: "system", content: params.systemPrompt },
            { role: "user", content: params.userPrompt },
          ],
          response_format: { type: "json_object" },
          temperature: 0.4,
          max_tokens: params.maxOutputTokens ?? 4000,
        });

        const content = response.choices[0]?.message?.content;
        if (!content) {
          throw new AiProviderError(
            "Respuesta de OpenAI sin contenido (choices[0].message.content vacío)."
          );
        }

        console.log(
          `[ai:openai] modelo=${this.model} intento=${attempt} tokens=${response.usage?.total_tokens ?? "?"}`
        );

        return content;
      } catch (err) {
        lastError = err;
        const isLastAttempt = attempt === MAX_RETRIES;
        console.warn(
          `[ai:openai] intento ${attempt}/${MAX_RETRIES} falló: ${
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
      `OpenAI falló tras ${MAX_RETRIES} intentos: ${
        lastError instanceof Error ? lastError.message : String(lastError)
      }`,
      lastError
    );
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

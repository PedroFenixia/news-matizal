import { test } from "node:test";
import assert from "node:assert/strict";
import { estimateCostEur } from "../lib/ai/model-config";

test("estimateCostEur: gpt-4o-mini con solo tokens de entrada+salida (sin cache)", () => {
  const cost = estimateCostEur("gpt-4o-mini", {
    inputTokens: 1_000_000,
    cachedInputTokens: 0,
    outputTokens: 1_000_000,
  });
  // input 0.15 USD/1M + output 0.60 USD/1M = 0.75 USD * 0.92 ~= 0.69 EUR
  assert.ok(cost > 0.6 && cost < 0.8, `coste inesperado: ${cost}`);
});

test("estimateCostEur: los tokens cacheados cuestan menos que los no cacheados", () => {
  const withoutCache = estimateCostEur("gpt-4o-mini", {
    inputTokens: 100_000,
    cachedInputTokens: 0,
    outputTokens: 0,
  });
  const withCache = estimateCostEur("gpt-4o-mini", {
    inputTokens: 100_000,
    cachedInputTokens: 100_000,
    outputTokens: 0,
  });
  assert.ok(withCache < withoutCache);
});

test("estimateCostEur: modelo desconocido cae al pricing por defecto sin lanzar", () => {
  const cost = estimateCostEur("modelo-que-no-existe", {
    inputTokens: 1000,
    cachedInputTokens: 0,
    outputTokens: 1000,
  });
  assert.ok(cost >= 0);
});

test("estimateCostEur: cero tokens es coste cero", () => {
  const cost = estimateCostEur("gpt-4o-mini", {
    inputTokens: 0,
    cachedInputTokens: 0,
    outputTokens: 0,
  });
  assert.equal(cost, 0);
});

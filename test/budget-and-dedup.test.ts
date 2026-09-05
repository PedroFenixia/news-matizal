import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// checkBudget/dedup leen de la SQLite compartida (lib/storage/db.ts, un
// singleton por proceso) — se apunta DATABASE_PATH a un fichero temporal
// ANTES de importar cualquier módulo que la toque, para no tocar la base de
// datos real de desarrollo/producción con datos de test. Los imports viven
// dentro de una función async (en vez de top-level await, que tsx/esbuild
// no transforma en salida CJS) resuelta antes de registrar los tests.
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "matizal-test-"));
const tmpDbPath = path.join(tmpDir, "test.sqlite");
process.env.DATABASE_PATH = tmpDbPath;

async function loadModules() {
  const telemetry = await import("../lib/telemetry");
  const budget = await import("../lib/budget");
  const dedup = await import("../lib/dedup");
  const db = await import("../lib/storage/db");
  return { ...telemetry, ...budget, ...dedup, ...db };
}

const modulesPromise = loadModules();

test("checkBudget: sin variables de presupuesto configuradas, siempre permite", async () => {
  const { checkBudget } = await modulesPromise;
  delete process.env.OPENAI_DAILY_BUDGET_EUR;
  delete process.env.OPENAI_MONTHLY_BUDGET_EUR;
  const result = checkBudget();
  assert.equal(result.allowed, true);
});

test("checkBudget: bloquea cuando el gasto diario ya registrado supera el límite", async () => {
  const { recordUsage, checkBudget } = await modulesPromise;
  process.env.OPENAI_DAILY_BUDGET_EUR = "0.0001"; // límite absurdamente bajo, cualquier uso lo supera
  delete process.env.OPENAI_MONTHLY_BUDGET_EUR;

  recordUsage({
    taskKind: "editorial",
    operation: "test_usage",
    usage: {
      model: "gpt-4o-mini",
      inputTokens: 100_000,
      cachedInputTokens: 0,
      outputTokens: 100_000,
      totalTokens: 200_000,
      durationMs: 100,
    },
    success: true,
  });

  const result = checkBudget();
  assert.equal(result.allowed, false);
  assert.match(result.reason ?? "", /Límite diario superado/);

  delete process.env.OPENAI_DAILY_BUDGET_EUR;
});

test("hashArticle: mismo outlet+título+link produce el mismo hash", async () => {
  const { hashArticle } = await modulesPromise;
  const item = { outlet: "El País", title: "Titular", link: "https://elpais.com/x" };
  assert.equal(hashArticle(item), hashArticle({ ...item }));
});

test("hashArticle: cambiar el título cambia el hash", async () => {
  const { hashArticle } = await modulesPromise;
  const a = hashArticle({ outlet: "El País", title: "Titular A", link: "https://elpais.com/x" });
  const b = hashArticle({ outlet: "El País", title: "Titular B", link: "https://elpais.com/x" });
  assert.notEqual(a, b);
});

test("filterUnprocessed + markProcessed: un artículo marcado ya no aparece como no procesado", async () => {
  const { filterUnprocessed, markProcessed } = await modulesPromise;
  const items = [
    { outlet: "ABC", title: "Noticia 1", link: "https://abc.es/1" },
    { outlet: "ABC", title: "Noticia 2", link: "https://abc.es/2" },
  ];

  const beforeMarking = filterUnprocessed("general", "2026-09-05", items);
  assert.equal(beforeMarking.length, 2);

  markProcessed("general", "2026-09-05", [items[0]]);

  const afterMarking = filterUnprocessed("general", "2026-09-05", items);
  assert.equal(afterMarking.length, 1);
  assert.equal(afterMarking[0].title, "Noticia 2");
});

test("filterUnprocessed: el mismo artículo en otra fecha vuelve a considerarse no procesado", async () => {
  const { filterUnprocessed, markProcessed } = await modulesPromise;
  const item = { outlet: "ABC", title: "Noticia recurrente", link: "https://abc.es/recurrente" };
  markProcessed("general", "2026-09-05", [item]);

  const otherDate = filterUnprocessed("general", "2026-09-06", [item]);
  assert.equal(otherDate.length, 1);
});

test.after(async () => {
  const { closeDb } = await modulesPromise;
  closeDb();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

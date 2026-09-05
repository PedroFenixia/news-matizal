import { test } from "node:test";
import assert from "node:assert/strict";
import { computeTargetMonthToDelete } from "../lib/retention";

test("computeTargetMonthToDelete: null si hoy no es día 5 en Europe/Madrid", () => {
  // 2026-10-04 12:00 UTC == 2026-10-04 14:00 Europe/Madrid (CEST) -> día 4.
  const notFifth = new Date("2026-10-04T12:00:00.000Z");
  assert.equal(computeTargetMonthToDelete(notFifth), null);
});

test("computeTargetMonthToDelete: borra el mes anterior el día 5", () => {
  // 2026-10-05 08:00 UTC == 2026-10-05 10:00 Europe/Madrid (CEST) -> día 5 de octubre.
  const fifth = new Date("2026-10-05T08:00:00.000Z");
  assert.equal(computeTargetMonthToDelete(fifth), "2026-09");
});

test("computeTargetMonthToDelete: enero borra diciembre del año anterior", () => {
  // 2027-01-05 08:00 UTC == 2027-01-05 09:00 Europe/Madrid (CET) -> día 5 de enero.
  const januaryFifth = new Date("2027-01-05T08:00:00.000Z");
  assert.equal(computeTargetMonthToDelete(januaryFifth), "2026-12");
});

test("computeTargetMonthToDelete: nunca devuelve el mes actual (salvaguarda de cleanupExpiredBriefings)", () => {
  const fifth = new Date("2026-10-05T08:00:00.000Z");
  const target = computeTargetMonthToDelete(fifth);
  assert.notEqual(target, "2026-10");
});

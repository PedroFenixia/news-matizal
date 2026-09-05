import { getUsageSince } from "./telemetry";

/**
 * Protección de presupuesto (sección 12 del brief). Se comprueba ANTES de
 * iniciar cada ejecución (edición completa o revisión intradía) — nunca a
 * mitad de una llamada ya en curso, para no dejar una generación a medias.
 * Si se supera el límite, la ejecución se aborta con un motivo claro, se
 * registra en generation_log (vía el mismo mecanismo de error habitual) y
 * la última edición válida permanece intacta — nunca se toca por esto.
 */

function todayStartMadridIso(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value;
  // Medianoche Europe/Madrid expresada como instante UTC aproximado: como
  // openai_usage.created_at se guarda en UTC (datetime('now') de SQLite),
  // comparamos contra la medianoche del día en curso en hora local
  // convertida de vuelta — suficientemente preciso para un presupuesto
  // (no es contabilidad financiera exacta al segundo).
  const localMidnight = `${get("year")}-${get("month")}-${get("day")}T00:00:00`;
  const offsetMinutes = getMadridOffsetMinutes();
  const utcMs = new Date(localMidnight).getTime() - offsetMinutes * 60_000;
  return new Date(utcMs).toISOString();
}

function monthStartMadridIso(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value;
  const localMonthStart = `${get("year")}-${get("month")}-01T00:00:00`;
  const offsetMinutes = getMadridOffsetMinutes();
  const utcMs = new Date(localMonthStart).getTime() - offsetMinutes * 60_000;
  return new Date(utcMs).toISOString();
}

/** Offset actual de Europe/Madrid respecto a UTC, en minutos (gestiona DST). */
function getMadridOffsetMinutes(): number {
  const now = new Date();
  const utcString = now.toLocaleString("en-US", { timeZone: "UTC" });
  const madridString = now.toLocaleString("en-US", { timeZone: "Europe/Madrid" });
  const diffMs = new Date(madridString).getTime() - new Date(utcString).getTime();
  return Math.round(diffMs / 60_000);
}

function parseEurBudget(envVar: string | undefined): number | null {
  if (!envVar || envVar.trim() === "") return null;
  const value = Number(envVar);
  if (!Number.isFinite(value) || value <= 0) return null;
  return value;
}

export interface BudgetCheckResult {
  allowed: boolean;
  reason?: string;
  dailySpentEur: number;
  monthlySpentEur: number;
  dailyBudgetEur: number | null;
  monthlyBudgetEur: number | null;
}

/**
 * Comprueba si hay margen presupuestario para iniciar una nueva ejecución.
 * Sin OPENAI_DAILY_BUDGET_EUR/OPENAI_MONTHLY_BUDGET_EUR configuradas, no
 * hay límite (allowed siempre true) — la protección es opt-in.
 */
export function checkBudget(): BudgetCheckResult {
  const dailyBudgetEur = parseEurBudget(process.env.OPENAI_DAILY_BUDGET_EUR);
  const monthlyBudgetEur = parseEurBudget(process.env.OPENAI_MONTHLY_BUDGET_EUR);

  const dailySpentEur = getUsageSince(todayStartMadridIso()).costEur;
  const monthlySpentEur = getUsageSince(monthStartMadridIso()).costEur;

  if (dailyBudgetEur !== null && dailySpentEur >= dailyBudgetEur) {
    return {
      allowed: false,
      reason: `Límite diario superado: ${dailySpentEur.toFixed(2)}€ gastados de ${dailyBudgetEur.toFixed(2)}€ (OPENAI_DAILY_BUDGET_EUR).`,
      dailySpentEur,
      monthlySpentEur,
      dailyBudgetEur,
      monthlyBudgetEur,
    };
  }

  if (monthlyBudgetEur !== null && monthlySpentEur >= monthlyBudgetEur) {
    return {
      allowed: false,
      reason: `Límite mensual superado: ${monthlySpentEur.toFixed(2)}€ gastados de ${monthlyBudgetEur.toFixed(2)}€ (OPENAI_MONTHLY_BUDGET_EUR).`,
      dailySpentEur,
      monthlySpentEur,
      dailyBudgetEur,
      monthlyBudgetEur,
    };
  }

  return {
    allowed: true,
    dailySpentEur,
    monthlySpentEur,
    dailyBudgetEur,
    monthlyBudgetEur,
  };
}

export { todayStartMadridIso, monthStartMadridIso };

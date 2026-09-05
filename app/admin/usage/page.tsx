import type { Metadata } from "next";
import { isAuthorizedAdminSecret } from "@/lib/auth";
import { getUsageSince, getUsageByBriefingType, getUsageForRun } from "@/lib/telemetry";
import { checkBudget, todayStartMadridIso, monthStartMadridIso } from "@/lib/budget";
import { listRecentRuns } from "@/lib/storage/generation-log";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Uso y coste",
  robots: { index: false, follow: false },
};

function eur(value: number): string {
  return `${value.toFixed(value < 1 ? 4 : 2)}€`;
}

const TRIGGER_LABEL: Record<string, string> = {
  cron: "Edición 10:00",
  manual: "Manual",
  intraday: "Revisión intradía",
  cleanup: "Limpieza",
};

export default async function AdminUsagePage({
  searchParams,
}: {
  searchParams: Promise<{ secret?: string }>;
}) {
  const { secret } = await searchParams;

  if (!isAuthorizedAdminSecret(secret)) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="font-mono text-sm text-(--muted)">
          Acceso no autorizado. Añade <code>?secret=...</code> a la URL.
        </p>
      </div>
    );
  }

  const budget = checkBudget();
  const today = getUsageSince(todayStartMadridIso());
  const month = getUsageSince(monthStartMadridIso());
  const byType = getUsageByBriefingType(monthStartMadridIso(), new Date().toISOString());
  const recentRuns = listRecentRuns(15);

  const runsWithCost = recentRuns.map((run) => ({
    ...run,
    cost: getUsageForRun(run.runId),
  }));

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-10 sm:py-14">
      <header className="border-b border-(--border-strong) pb-8 mb-10">
        <span className="font-mono text-xs uppercase tracking-widest text-(--accent)">
          Diagnóstico
        </span>
        <h1 className="font-serif text-3xl sm:text-4xl font-semibold tracking-tight mt-3">
          Uso y coste de OpenAI
        </h1>
        <p className="text-(--ink-2) mt-3 max-w-xl leading-relaxed">
          Vista de solo lectura, no pública, con el consumo estimado de la
          capa de IA. Los costes son una estimación (ver lib/ai/model-config.ts),
          no una factura.
        </p>
      </header>

      {!budget.allowed && (
        <div className="border border-(--priority-attention) p-5 mb-10">
          <p className="font-mono text-xs uppercase tracking-wider text-(--priority-attention) mb-1">
            Generación detenida por límite presupuestario
          </p>
          <p className="text-sm text-(--ink-2)">{budget.reason}</p>
        </div>
      )}

      <section className="pb-10 border-b border-(--border)">
        <h2 className="font-serif text-2xl font-semibold tracking-tight mb-6">Hoy</h2>
        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4 font-mono text-sm">
          <div>
            <dt className="text-(--muted) text-[11px] uppercase tracking-wider mb-1">Coste</dt>
            <dd className="text-lg text-(--accent)">{eur(today.costEur)}</dd>
          </div>
          <div>
            <dt className="text-(--muted) text-[11px] uppercase tracking-wider mb-1">Llamadas</dt>
            <dd className="text-lg">{today.callCount}</dd>
          </div>
          <div>
            <dt className="text-(--muted) text-[11px] uppercase tracking-wider mb-1">Tokens</dt>
            <dd className="text-lg">{today.totalTokens.toLocaleString("es-ES")}</dd>
          </div>
          <div>
            <dt className="text-(--muted) text-[11px] uppercase tracking-wider mb-1">Errores</dt>
            <dd className="text-lg">{today.errorCount}</dd>
          </div>
        </dl>
        {budget.dailyBudgetEur !== null && (
          <p className="mt-4 font-mono text-[11px] uppercase tracking-wider text-(--muted)">
            Presupuesto diario: {eur(budget.dailySpentEur)} / {eur(budget.dailyBudgetEur)}
          </p>
        )}
      </section>

      <section className="py-10 border-b border-(--border)">
        <h2 className="font-serif text-2xl font-semibold tracking-tight mb-6">Mes actual</h2>
        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4 font-mono text-sm">
          <div>
            <dt className="text-(--muted) text-[11px] uppercase tracking-wider mb-1">Coste</dt>
            <dd className="text-lg text-(--accent)">{eur(month.costEur)}</dd>
          </div>
          <div>
            <dt className="text-(--muted) text-[11px] uppercase tracking-wider mb-1">Llamadas</dt>
            <dd className="text-lg">{month.callCount}</dd>
          </div>
          <div>
            <dt className="text-(--muted) text-[11px] uppercase tracking-wider mb-1">Tokens</dt>
            <dd className="text-lg">{month.totalTokens.toLocaleString("es-ES")}</dd>
          </div>
          <div>
            <dt className="text-(--muted) text-[11px] uppercase tracking-wider mb-1">Duración media</dt>
            <dd className="text-lg">{month.avgDurationMs}ms</dd>
          </div>
        </dl>
        {budget.monthlyBudgetEur !== null && (
          <p className="mt-4 font-mono text-[11px] uppercase tracking-wider text-(--muted)">
            Presupuesto mensual: {eur(budget.monthlySpentEur)} / {eur(budget.monthlyBudgetEur)}
          </p>
        )}

        <div className="mt-8 table-scroll border border-(--border)">
          <table className="w-full min-w-[420px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-(--border-strong)">
                <th className="text-left font-mono text-[11px] uppercase tracking-wider font-medium px-4 py-3">
                  Briefing
                </th>
                <th className="text-left font-mono text-[11px] uppercase tracking-wider font-medium px-4 py-3">
                  Coste
                </th>
                <th className="text-left font-mono text-[11px] uppercase tracking-wider font-medium px-4 py-3">
                  Llamadas
                </th>
                <th className="text-left font-mono text-[11px] uppercase tracking-wider font-medium px-4 py-3">
                  Errores
                </th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-(--border)">
                <td className="px-4 py-3 font-medium">General</td>
                <td className="px-4 py-3">{eur(byType.general.costEur)}</td>
                <td className="px-4 py-3">{byType.general.callCount}</td>
                <td className="px-4 py-3">{byType.general.errorCount}</td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-medium">Financiero</td>
                <td className="px-4 py-3">{eur(byType.financial.costEur)}</td>
                <td className="px-4 py-3">{byType.financial.callCount}</td>
                <td className="px-4 py-3">{byType.financial.errorCount}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="py-10">
        <h2 className="font-serif text-2xl font-semibold tracking-tight mb-6">
          Últimas ejecuciones
        </h2>
        <div className="table-scroll border border-(--border)">
          <table className="w-full min-w-[560px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-(--border-strong)">
                <th className="text-left font-mono text-[11px] uppercase tracking-wider font-medium px-4 py-3">
                  Inicio
                </th>
                <th className="text-left font-mono text-[11px] uppercase tracking-wider font-medium px-4 py-3">
                  Tipo
                </th>
                <th className="text-left font-mono text-[11px] uppercase tracking-wider font-medium px-4 py-3">
                  Origen
                </th>
                <th className="text-left font-mono text-[11px] uppercase tracking-wider font-medium px-4 py-3">
                  Estado
                </th>
                <th className="text-left font-mono text-[11px] uppercase tracking-wider font-medium px-4 py-3">
                  Coste
                </th>
              </tr>
            </thead>
            <tbody>
              {runsWithCost.map((run) => (
                <tr key={run.id} className="border-b border-(--border) last:border-b-0">
                  <td className="px-4 py-3 whitespace-nowrap">
                    {new Intl.DateTimeFormat("es-ES", {
                      timeZone: "Europe/Madrid",
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    }).format(new Date(run.startedAt))}
                  </td>
                  <td className="px-4 py-3 capitalize">{run.type}</td>
                  <td className="px-4 py-3">{TRIGGER_LABEL[run.trigger] ?? run.trigger}</td>
                  <td className="px-4 py-3">
                    {run.success === undefined
                      ? "En curso"
                      : run.success
                        ? "OK"
                        : "Error"}
                  </td>
                  <td className="px-4 py-3">{eur(run.cost.costEur)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

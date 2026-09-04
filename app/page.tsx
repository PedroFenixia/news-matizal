import Link from "next/link";
import type { Metadata } from "next";
import { getLatestEdition } from "@/lib/storage/editions";
import type { FinancialBriefing, GeneralBriefing } from "@/lib/types";
import { PriorityBadge } from "@/components/PriorityBadge";
import { UpdateStatus } from "@/components/UpdateStatus";
import { DemoBadge } from "@/components/DemoBadge";
import { ShareButton } from "@/components/ShareButton";
import { ArticleCard } from "@/components/ArticleCard";
import { SITE_URL } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Inicio",
  description:
    "Portada diaria: resumen ejecutivo combinado de prensa española y mercados financieros.",
  alternates: { canonical: "/" },
};

function greeting(): string {
  const hour = Number(
    new Intl.DateTimeFormat("es-ES", {
      timeZone: "Europe/Madrid",
      hour: "2-digit",
      hour12: false,
    }).format(new Date())
  );
  if (hour < 12) return "Buenos días";
  if (hour < 20) return "Buenas tardes";
  return "Buenas noches";
}

export default function HomePage() {
  const general = getLatestEdition("general") as GeneralBriefing | null;
  const financial = getLatestEdition("financial") as FinancialBriefing | null;

  const today = new Intl.DateTimeFormat("es-ES", {
    timeZone: "Europe/Madrid",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());

  const isDemo = Boolean(general?.isDemo || financial?.isDemo);

  const mostRecentUpdatedAt = [general?.updatedAt, financial?.updatedAt]
    .filter(Boolean)
    .sort()
    .reverse()[0];

  // Combina 5-8 acontecimientos principales de ambos briefings.
  const combinedHighlights = [
    ...(general?.executiveSummary ?? []).slice(0, 4),
    ...(financial?.executiveSummary ?? []).slice(0, 4),
  ].slice(0, 8);

  const combinedRecommended = [
    ...(general?.recommendedArticles ?? []).slice(0, 2),
    ...(financial?.recommendedArticles ?? []).slice(0, 2),
  ];

  const alerts = [
    ...(general?.executiveSummary ?? []),
    ...(financial?.executiveSummary ?? []),
  ].filter((i) => i.priority === "attention");

  const watchToday = [
    ...(general?.watchToday ?? []).slice(0, 3),
    ...(financial?.watchToday ?? []).slice(0, 3),
  ];

  if (!general && !financial) {
    return (
      <div className="mx-auto max-w-3xl px-4 sm:px-6 py-16 text-center">
        <p className="text-(--muted)">
          Todavía no hay ninguna edición disponible. Vuelve pronto.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-10 sm:py-14">
      <header className="border-b border-(--border-strong) pb-8 mb-10">
        <div className="flex items-center justify-between gap-4 mb-3">
          <span className="font-mono text-xs uppercase tracking-widest text-(--accent)">
            Portada
          </span>
          {isDemo && <DemoBadge />}
        </div>
        <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight leading-[1.1] mb-3">
          {greeting()}
        </h1>
        <p className="text-(--muted) capitalize mb-5">{today}</p>
        <p className="text-(--ink-2) leading-relaxed max-w-xl mb-6">
          Resumen del día combinando prensa española y mercados financieros,
          contrastado entre cabeceras y medios de referencia.
        </p>
        <div className="flex flex-wrap items-center justify-between gap-4">
          {mostRecentUpdatedAt && (
            <UpdateStatus
              updatedAt={mostRecentUpdatedAt}
              editionLabel={general?.editionLabel ?? financial?.editionLabel ?? "Edición inicial"}
            />
          )}
          <ShareButton title="Matizal News — Portada" url={SITE_URL} />
        </div>
      </header>

      {/* Acontecimientos principales del día */}
      <section className="pb-10 border-b border-(--border)">
        <h2 className="font-serif text-2xl font-semibold tracking-tight mb-6">
          Lo esencial de hoy
        </h2>
        <ol className="flex flex-col">
          {combinedHighlights.map((item, idx) => (
            <li
              key={idx}
              className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-5 py-5 border-b border-(--border) last:border-b-0"
            >
              <span className="font-serif italic text-(--muted) text-lg sm:w-8 shrink-0">
                {String(idx + 1).padStart(2, "0")}
              </span>
              <div className="flex-1">
                <div className="mb-1.5">
                  <PriorityBadge level={item.priority} />
                </div>
                <p className="font-serif text-lg font-medium leading-snug">{item.headline}</p>
                <p className="text-sm text-(--ink-2) leading-relaxed mt-1">{item.detail}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* Botones a briefings completos */}
      <section className="py-8 border-b border-(--border) grid sm:grid-cols-2 gap-4">
        <Link
          href="/financiero"
          className="group border border-(--border-strong) p-6 flex flex-col gap-2 transition-colors hover:border-(--accent)"
        >
          <span className="font-mono text-[11px] uppercase tracking-wider text-(--accent)">
            Financiero
          </span>
          <span className="font-serif text-xl font-medium text-(--foreground) group-hover:text-(--accent) transition-colors">
            Ver briefing financiero completo →
          </span>
        </Link>
        <Link
          href="/prensa-general"
          className="group border border-(--border-strong) p-6 flex flex-col gap-2 transition-colors hover:border-(--accent)"
        >
          <span className="font-mono text-[11px] uppercase tracking-wider text-(--accent)">
            Prensa general
          </span>
          <span className="font-serif text-xl font-medium text-(--foreground) group-hover:text-(--accent) transition-colors">
            Ver briefing de prensa completo →
          </span>
        </Link>
      </section>

      {/* Mercados de un vistazo */}
      {financial && (
        <section className="py-10 border-b border-(--border)">
          <h2 className="font-serif text-2xl font-semibold tracking-tight mb-6">
            Mercados de un vistazo
          </h2>
          <ul className="flex flex-col gap-4">
            {financial.sections
              .find((s) => s.title === "Mercados")
              ?.items.slice(0, 3)
              .map((item) => (
                <li key={item.id} className="flex flex-col gap-1">
                  <PriorityBadge level={item.priority} />
                  <p className="font-medium">{item.headline}</p>
                  <p className="text-sm text-(--ink-2)">{item.body}</p>
                </li>
              )) ?? (
              <p className="text-sm text-(--muted) italic">Sin datos de mercados disponibles hoy.</p>
            )}
          </ul>
        </section>
      )}

      {/* Prensa española */}
      {general && (
        <section className="py-10 border-b border-(--border)">
          <h2 className="font-serif text-2xl font-semibold tracking-tight mb-6">
            Prensa española
          </h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {general.newspapers.slice(0, 4).map((n) => (
              <div key={n.outlet} className="border border-(--border) p-4">
                <p className="font-serif font-semibold mb-1">{n.outlet}</p>
                <p className="text-sm text-(--ink-2) leading-relaxed">{n.summary}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Riesgos / Alertas */}
      <section className="py-10 border-b border-(--border)">
        <h2 className="font-serif text-2xl font-semibold tracking-tight mb-6">
          Riesgos y alertas
        </h2>
        {alerts.length === 0 ? (
          <p className="text-sm text-(--muted) italic">
            No hay alertas de máxima prioridad en la edición de hoy.
          </p>
        ) : (
          <ul className="flex flex-col gap-4">
            {alerts.map((a, idx) => (
              <li key={idx} className="flex flex-col gap-1">
                <PriorityBadge level="attention" />
                <p className="font-medium">{a.headline}</p>
                <p className="text-sm text-(--ink-2)">{a.detail}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Qué vigilar hoy */}
      <section className="py-10 border-b border-(--border)">
        <h2 className="font-serif text-2xl font-semibold tracking-tight mb-6">
          Qué vigilar hoy
        </h2>
        <ul className="flex flex-col">
          {watchToday.map((item, idx) => (
            <li key={idx} className="py-4 border-b border-(--border) last:border-b-0">
              <div className="mb-1">
                <PriorityBadge level={item.priority} />
              </div>
              <p className="font-medium">{item.title}</p>
              <p className="text-sm text-(--ink-2)">{item.description}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* Lecturas recomendadas */}
      {combinedRecommended.length > 0 && (
        <section className="py-10">
          <h2 className="font-serif text-2xl font-semibold tracking-tight mb-6">
            Lecturas recomendadas
          </h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {combinedRecommended.map((a, idx) => (
              <ArticleCard key={idx} article={a} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

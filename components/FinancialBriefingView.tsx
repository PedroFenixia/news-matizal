import type { FinancialBriefing } from "@/lib/types";
import { BriefingHeader } from "./BriefingHeader";
import { ExecutiveSummaryList } from "./ExecutiveSummaryList";
import { SectionBlock } from "./SectionBlock";
import { OutletHighlightCard } from "./OutletHighlight";
import { ArticleCard } from "./ArticleCard";
import { ComparisonTable } from "./ComparisonTable";
import { WatchTodayList } from "./WatchTodayList";
import { PriorityBadge } from "./PriorityBadge";
import { SourceList } from "./SourceLink";
import { PriorityFilter } from "./PriorityFilter";
import { TableOfContents, type TocEntry } from "./TableOfContents";

export function FinancialBriefingView({
  briefing,
  isLatest,
  path,
}: {
  briefing: FinancialBriefing;
  isLatest: boolean;
  path: string;
}) {
  const tocEntries: TocEntry[] = [
    { key: "A", title: "Resumen ejecutivo" },
    ...briefing.sections.map((s) => ({ key: s.key, title: s.title })),
    { key: "K", title: "Impacto empresarial" },
    { key: "L", title: "Qué destaca cada medio" },
    { key: "M", title: "Comparación editorial" },
    { key: "N", title: "Qué vigilar hoy" },
    ...(briefing.recommendedArticles.length > 0
      ? [{ key: "O", title: "Artículos recomendados" }]
      : []),
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-10 sm:py-14">
      <div className="max-w-3xl">
        <BriefingHeader
          kicker="Financiero"
          title="Edición de mercados y economía"
          date={briefing.date}
          updatedAt={briefing.updatedAt}
          editionLabel={briefing.editionLabel}
          isDemo={briefing.isDemo}
          isLatest={isLatest}
          path={path}
        />
        <div className="-mt-4 mb-8">
          <PriorityFilter />
        </div>
      </div>

      <div className="flex flex-col lg:flex-row lg:gap-12">
        <TableOfContents entries={tocEntries} />

        <div className="min-w-0 max-w-3xl">
          <section id="seccion-A" className="scroll-mt-24 pb-10 border-b border-(--border)">
            <div className="flex items-baseline gap-3 mb-6">
              <span className="section-mark text-2xl">§ A</span>
              <h2 className="font-serif text-2xl sm:text-3xl font-semibold tracking-tight">
                Resumen ejecutivo
              </h2>
            </div>
            <ExecutiveSummaryList items={briefing.executiveSummary} />
          </section>

          {briefing.sections.map((section) => (
            <SectionBlock key={section.key} section={section} />
          ))}

          <section id="seccion-K" className="scroll-mt-24 py-10 border-b border-(--border)">
            <div className="flex items-baseline gap-3 mb-6">
              <span className="section-mark text-2xl">§ K</span>
              <h2 className="font-serif text-2xl sm:text-3xl font-semibold tracking-tight">
                Impacto empresarial
              </h2>
            </div>
            {briefing.businessImpact.length === 0 ? (
              <p className="text-(--muted) text-sm italic">Sin material suficiente hoy.</p>
            ) : (
              <div className="flex flex-col gap-8">
                {briefing.businessImpact.map((item) => (
                  <article key={item.id} data-priority={item.priority} className="priority-item flex flex-col gap-2.5">
                    <PriorityBadge level={item.priority} />
                    <h3 className="font-serif text-xl font-medium leading-snug">
                      {item.headline}
                    </h3>
                    <p className="text-(--ink-2) leading-relaxed max-w-2xl">{item.body}</p>
                    <SourceList sources={item.sources} />
                  </article>
                ))}
              </div>
            )}
          </section>

          <section id="seccion-L" className="scroll-mt-24 py-10 border-b border-(--border)">
            <div className="flex items-baseline gap-3 mb-6">
              <span className="section-mark text-2xl">§ L</span>
              <h2 className="font-serif text-2xl sm:text-3xl font-semibold tracking-tight">
                Qué destaca cada medio
              </h2>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              {briefing.outlets.map((o) => (
                <OutletHighlightCard key={o.outlet} highlight={o} />
              ))}
            </div>
          </section>

          <section id="seccion-M" className="scroll-mt-24 py-10 border-b border-(--border)">
            <div className="flex items-baseline gap-3 mb-6">
              <span className="section-mark text-2xl">§ M</span>
              <h2 className="font-serif text-2xl sm:text-3xl font-semibold tracking-tight">
                Comparación editorial
              </h2>
            </div>
            <ComparisonTable rows={briefing.comparison} />
          </section>

          <section id="seccion-N" className="scroll-mt-24 py-10 border-b border-(--border)">
            <div className="flex items-baseline gap-3 mb-6">
              <span className="section-mark text-2xl">§ N</span>
              <h2 className="font-serif text-2xl sm:text-3xl font-semibold tracking-tight">
                Qué vigilar hoy
              </h2>
            </div>
            <WatchTodayList items={briefing.watchToday} />
          </section>

          {briefing.recommendedArticles.length > 0 && (
            <section id="seccion-O" className="scroll-mt-24 py-10">
              <div className="flex items-baseline gap-3 mb-6">
                <span className="section-mark text-2xl">§ O</span>
                <h2 className="font-serif text-2xl sm:text-3xl font-semibold tracking-tight">
                  Artículos recomendados
                </h2>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                {briefing.recommendedArticles.map((a, idx) => (
                  <ArticleCard key={idx} article={a} />
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

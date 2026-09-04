import type { GeneralBriefing } from "@/lib/types";
import { BriefingHeader } from "./BriefingHeader";
import { ExecutiveSummaryList } from "./ExecutiveSummaryList";
import { SectionBlock } from "./SectionBlock";
import { OutletHighlightCard } from "./OutletHighlight";
import { ArticleCard } from "./ArticleCard";
import { ComparisonTable } from "./ComparisonTable";
import { WatchTodayList } from "./WatchTodayList";

export function GeneralBriefingView({
  briefing,
  isLatest,
  path,
}: {
  briefing: GeneralBriefing;
  isLatest: boolean;
  path: string;
}) {
  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-10 sm:py-14">
      <BriefingHeader
        kicker="Prensa general"
        title="Briefing de prensa española"
        date={briefing.date}
        updatedAt={briefing.updatedAt}
        editionLabel={briefing.editionLabel}
        isDemo={briefing.isDemo}
        isLatest={isLatest}
        path={path}
      />

      <section className="pb-10 border-b border-(--border)">
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

      <section className="py-10 border-b border-(--border)">
        <div className="flex items-baseline gap-3 mb-6">
          <span className="section-mark text-2xl">§ G</span>
          <h2 className="font-serif text-2xl sm:text-3xl font-semibold tracking-tight">
            Qué destaca cada cabecera
          </h2>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          {briefing.newspapers.map((n) => (
            <OutletHighlightCard key={n.outlet} highlight={n} />
          ))}
        </div>
      </section>

      {briefing.recommendedArticles.length > 0 && (
        <section className="py-10 border-b border-(--border)">
          <div className="flex items-baseline gap-3 mb-6">
            <span className="section-mark text-2xl">§ H</span>
            <h2 className="font-serif text-2xl sm:text-3xl font-semibold tracking-tight">
              Artículo recomendado por cabecera
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {briefing.recommendedArticles.map((a, idx) => (
              <ArticleCard key={idx} article={a} />
            ))}
          </div>
        </section>
      )}

      <section className="py-10 border-b border-(--border)">
        <div className="flex items-baseline gap-3 mb-6">
          <span className="section-mark text-2xl">§ I</span>
          <h2 className="font-serif text-2xl sm:text-3xl font-semibold tracking-tight">
            Comparación editorial
          </h2>
        </div>
        <ComparisonTable rows={briefing.comparison} />
      </section>

      <section className="py-10">
        <div className="flex items-baseline gap-3 mb-6">
          <span className="section-mark text-2xl">§ J</span>
          <h2 className="font-serif text-2xl sm:text-3xl font-semibold tracking-tight">
            Qué vigilar hoy
          </h2>
        </div>
        <WatchTodayList items={briefing.watchToday} />
      </section>
    </div>
  );
}

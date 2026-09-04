import type { BriefingSection } from "@/lib/types";
import { PriorityBadge } from "./PriorityBadge";
import { SourceList } from "./SourceLink";

const NATURE_LABEL: Record<string, string> = {
  fact: "Hecho",
  analysis: "Análisis",
  opinion: "Opinión",
};

export function SectionBlock({ section }: { section: BriefingSection }) {
  return (
    <section id={`seccion-${section.key}`} className="scroll-mt-24 py-10 border-b border-(--border) last:border-b-0">
      <div className="flex items-baseline gap-3 mb-6">
        <span className="section-mark text-2xl">§ {section.key}</span>
        <h2 className="font-serif text-2xl sm:text-3xl font-semibold tracking-tight">
          {section.title}
        </h2>
      </div>

      {section.intro && (
        <p className="text-(--ink-2) mb-6 max-w-2xl leading-relaxed">{section.intro}</p>
      )}

      {section.items.length === 0 ? (
        <p className="text-(--muted) text-sm italic">
          Sin material suficiente para esta sección en la edición de hoy.
        </p>
      ) : (
        <div className="flex flex-col gap-8">
          {section.items.map((item) => (
            <article key={item.id} data-priority={item.priority} className="priority-item flex flex-col gap-2.5">
              <div className="flex flex-wrap items-center gap-2.5">
                <PriorityBadge level={item.priority} />
                {item.nature && (
                  <span className="font-mono text-[10px] uppercase tracking-wider text-(--muted) border border-(--border) px-1.5 py-0.5">
                    {NATURE_LABEL[item.nature]}
                  </span>
                )}
              </div>
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
  );
}

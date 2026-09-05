import type { OutletHighlight } from "@/lib/types";

export function OutletHighlightCard({
  highlight,
  className = "",
}: {
  highlight: OutletHighlight;
  className?: string;
}) {
  return (
    <div className={`border border-(--border) p-5 flex flex-col gap-3 ${className}`}>
      <h3 className="font-serif text-lg font-semibold">{highlight.outlet}</h3>
      <p className="text-sm text-(--ink-2) leading-relaxed text-justify">{highlight.summary}</p>
      {highlight.editorialStance && (
        <p className="text-xs text-(--muted) italic">{highlight.editorialStance}</p>
      )}
      {highlight.mainStories.length > 0 && (
        <ul className="flex flex-col gap-1.5 mt-1 border-t border-(--border) pt-3">
          {highlight.mainStories.map((story, idx) => (
            <li key={idx} className="text-sm text-(--ink-2) flex gap-2">
              <span className="text-(--accent)" aria-hidden="true">
                →
              </span>
              {story}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

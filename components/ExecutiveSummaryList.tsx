import type { ExecutiveSummaryItem } from "@/lib/types";
import { PriorityBadge } from "./PriorityBadge";

export function ExecutiveSummaryList({ items }: { items: ExecutiveSummaryItem[] }) {
  return (
    <ol className="flex flex-col">
      {items.map((item, idx) => (
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
  );
}

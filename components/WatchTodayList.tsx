import type { WatchItem } from "@/lib/types";
import { PriorityBadge } from "./PriorityBadge";

export function WatchTodayList({ items }: { items: WatchItem[] }) {
  if (items.length === 0) return null;
  return (
    <ul className="flex flex-col">
      {items.map((item, idx) => (
        <li
          key={idx}
          className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-4 py-4 border-b border-(--border) last:border-b-0"
        >
          <div className="sm:w-40 shrink-0 flex flex-col gap-1">
            <PriorityBadge level={item.priority} />
            {item.when && (
              <span className="font-mono text-[11px] uppercase tracking-wider text-(--muted)">
                {item.when}
              </span>
            )}
          </div>
          <div>
            <p className="font-medium">{item.title}</p>
            <p className="text-sm text-(--ink-2) leading-relaxed">{item.description}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

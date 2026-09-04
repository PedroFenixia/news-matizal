import type { PriorityLevel } from "@/lib/types";

const CONFIG: Record<PriorityLevel, { label: string; dot: string; color: string }> = {
  attention: {
    label: "Requiere atención",
    dot: "🔴",
    color: "text-(--priority-attention)",
  },
  important: {
    label: "Importante",
    dot: "🟠",
    color: "text-(--priority-important)",
  },
  context: {
    label: "Contexto",
    dot: "🟢",
    color: "text-(--priority-context)",
  },
};

export function PriorityBadge({ level }: { level: PriorityLevel }) {
  const cfg = CONFIG[level];
  return (
    <span
      className={`inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider ${cfg.color}`}
    >
      <span aria-hidden="true">{cfg.dot}</span>
      {cfg.label}
    </span>
  );
}

export function priorityLabel(level: PriorityLevel): string {
  return CONFIG[level].label;
}

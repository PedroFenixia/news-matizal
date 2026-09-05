import type { RevisionTag } from "@/lib/types";

const LABEL: Record<RevisionTag, string> = {
  new: "Nuevo",
  updated: "Actualizado",
  correction: "Corregido",
};

/** Etiqueta discreta para puntos marcados por una revisión intradía (ver lib/intraday.ts). */
export function RevisionTagBadge({ tag }: { tag?: RevisionTag }) {
  if (!tag) return null;
  const colorClass =
    tag === "correction"
      ? "text-(--priority-attention) border-(--priority-attention)"
      : "text-(--accent) border-(--accent)";
  return (
    <span className={`font-mono text-[10px] uppercase tracking-wider border px-1.5 py-0.5 ${colorClass}`}>
      {LABEL[tag]}
    </span>
  );
}

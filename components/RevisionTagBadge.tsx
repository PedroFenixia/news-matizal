import type { RevisionTag } from "@/lib/types";

const LABEL: Record<RevisionTag, string> = {
  new: "Nuevo",
  updated: "Actualizado",
};

/** Etiqueta discreta para puntos marcados por una revisión intradía (ver lib/intraday.ts). */
export function RevisionTagBadge({ tag }: { tag?: RevisionTag }) {
  if (!tag) return null;
  return (
    <span className="font-mono text-[10px] uppercase tracking-wider text-(--accent) border border-(--accent) px-1.5 py-0.5">
      {LABEL[tag]}
    </span>
  );
}

import type { RevisionSummary } from "@/lib/types";

function formatMadrid(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  const date = new Intl.DateTimeFormat("es-ES", {
    timeZone: "Europe/Madrid",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
  const time = new Intl.DateTimeFormat("es-ES", {
    timeZone: "Europe/Madrid",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
  return { date, time };
}

function noveltyLabel(summary: RevisionSummary): string | null {
  const total = summary.newCount + summary.updatedCount;
  if (total === 0) return null;
  const parts: string[] = [];
  if (summary.newCount > 0) parts.push(`${summary.newCount} nueva${summary.newCount === 1 ? "" : "s"}`);
  if (summary.updatedCount > 0) parts.push(`${summary.updatedCount} actualizada${summary.updatedCount === 1 ? "" : "s"}`);
  return `${parts.join(", ")} desde la edición anterior`;
}

export function UpdateStatus({
  updatedAt,
  editionLabel,
  isLatest = true,
  revisionSummary,
}: {
  updatedAt: string;
  editionLabel: string;
  isLatest?: boolean;
  revisionSummary?: RevisionSummary;
}) {
  const { date, time } = formatMadrid(updatedAt);
  const novelty = revisionSummary ? noveltyLabel(revisionSummary) : null;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] uppercase tracking-wider text-(--muted)">
      <span className="text-(--accent)">
        {isLatest ? "✓ Actualizado" : "Edición archivada"}
      </span>
      <span aria-hidden="true">·</span>
      <span>
        Última actualización: {date} · {time}
      </span>
      <span aria-hidden="true">·</span>
      <span>{editionLabel}</span>
      {novelty && (
        <>
          <span aria-hidden="true">·</span>
          <span className="text-(--accent)">{novelty}</span>
        </>
      )}
    </div>
  );
}

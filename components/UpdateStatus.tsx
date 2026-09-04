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

export function UpdateStatus({
  updatedAt,
  editionLabel,
  isLatest = true,
}: {
  updatedAt: string;
  editionLabel: string;
  isLatest?: boolean;
}) {
  const { date, time } = formatMadrid(updatedAt);
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
    </div>
  );
}

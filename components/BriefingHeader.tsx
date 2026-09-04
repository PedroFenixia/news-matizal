import { UpdateStatus } from "./UpdateStatus";
import { ShareButton } from "./ShareButton";
import { DemoBadge } from "./DemoBadge";
import { SITE_URL } from "@/lib/site";

export function BriefingHeader({
  kicker,
  title,
  date,
  updatedAt,
  editionLabel,
  isDemo,
  isLatest,
  path,
}: {
  kicker: string;
  title: string;
  date: string;
  updatedAt: string;
  editionLabel: string;
  isDemo?: boolean;
  isLatest: boolean;
  path: string;
}) {
  const formattedDate = new Intl.DateTimeFormat("es-ES", {
    timeZone: "Europe/Madrid",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${date}T12:00:00Z`));

  return (
    <header className="border-b border-(--border-strong) pb-8 mb-8">
      <div className="flex items-center justify-between gap-4 mb-3">
        <span className="font-mono text-xs uppercase tracking-widest text-(--accent)">
          {kicker}
        </span>
        {isDemo && <DemoBadge />}
      </div>
      <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight leading-[1.1] mb-3">
        {title}
      </h1>
      <p className="text-(--muted) capitalize mb-5">{formattedDate}</p>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <UpdateStatus updatedAt={updatedAt} editionLabel={editionLabel} isLatest={isLatest} />
        <ShareButton title={title} url={`${SITE_URL}${path}`} />
      </div>
    </header>
  );
}

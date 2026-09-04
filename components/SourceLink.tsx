import type { SourceRef } from "@/lib/types";

/**
 * Muestra una fuente. Si tiene URL verificable, es pulsable hacia el
 * original; si no, se muestra solo el nombre del medio (nunca se inventa
 * una URL).
 */
export function SourceLink({ source }: { source: SourceRef }) {
  if (source.url) {
    return (
      <a
        href={source.url}
        target="_blank"
        rel="noopener noreferrer"
        className="underline decoration-(--border-strong) decoration-1 underline-offset-2 hover:decoration-(--accent) hover:text-(--accent) transition-colors"
      >
        {source.outlet}
      </a>
    );
  }
  return <span>{source.outlet}</span>;
}

export function SourceList({ sources }: { sources: SourceRef[] }) {
  if (sources.length === 0) return null;
  return (
    <p className="font-mono text-[11px] uppercase tracking-wider text-(--muted) flex flex-wrap gap-x-2 gap-y-1">
      <span>Fuentes:</span>
      {sources.map((s, idx) => (
        <span key={`${s.outlet}-${idx}`}>
          <SourceLink source={s} />
          {idx < sources.length - 1 ? "," : ""}
        </span>
      ))}
    </p>
  );
}

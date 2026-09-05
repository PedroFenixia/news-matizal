"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

export interface TocEntry {
  key: string;
  title: string;
}

const WORDS_PER_MINUTE = 220;

/** Cuenta palabras del texto visible del documento para estimar tiempo de lectura. */
function estimateReadingMinutes(): number {
  const main = document.querySelector("main") ?? document.body;
  const words = (main.textContent ?? "").trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}

// El conteo de palabras depende del DOM ya renderizado (contenido dinámico
// del briefing), así que no puede calcularse durante SSR ni de forma pura
// en el primer render. useSyncExternalStore con getServerSnapshot=null
// modela correctamente ese "desconocido hasta hidratar" sin disparar
// setState dentro de un efecto (ver react-hooks/set-state-in-effect).
function subscribeNever() {
  return () => {};
}

/**
 * Índice de secciones con anclas a `#seccion-<key>` (ver SectionBlock y las
 * secciones ad-hoc de cada *BriefingView), resaltando la sección visible
 * actual vía IntersectionObserver. En desktop se ancla en una columna
 * lateral (ver layout en *BriefingView); en móvil se colapsa en un
 * <details> para no ocupar espacio permanente en pantallas pequeñas.
 */
export function TableOfContents({ entries }: { entries: TocEntry[] }) {
  const [activeKey, setActiveKey] = useState<string | null>(null);
  // null hasta que el efecto de abajo mida el DOM del cliente; en SSR no
  // hay snapshot posible, así que el servidor "no sabe" el valor (null).
  const minutes = useSyncExternalStore(
    subscribeNever,
    estimateReadingMinutes,
    () => null
  );

  useEffect(() => {
    const sections = entries
      .map((e) => document.getElementById(`seccion-${e.key}`))
      .filter((el): el is HTMLElement => el !== null);

    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      (observerEntries) => {
        const visible = observerEntries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) {
          setActiveKey(visible[0].target.id.replace("seccion-", ""));
        }
      },
      { rootMargin: "-15% 0px -70% 0px" }
    );

    sections.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (entries.length === 0) return null;

  const list = (
    <ol className="flex flex-col gap-0.5">
      {entries.map((entry, idx) => (
        <li key={entry.key}>
          <a
            href={`#seccion-${entry.key}`}
            className={`flex items-baseline gap-2 py-1 text-sm transition-colors ${
              activeKey === entry.key
                ? "text-(--accent)"
                : "text-(--ink-2) hover:text-(--foreground)"
            }`}
          >
            <span className="section-mark text-xs shrink-0">
              {String(idx + 1).padStart(2, "0")}
            </span>
            <span className="truncate">{entry.title}</span>
          </a>
        </li>
      ))}
    </ol>
  );

  return (
    <>
      {/* Desktop: columna lateral sticky. */}
      <nav
        aria-label="Índice de secciones"
        className="hidden lg:block sticky top-24 self-start w-56 shrink-0 pr-2"
      >
        {minutes !== null && (
          <p className="font-mono text-[11px] uppercase tracking-wider text-(--muted) mb-3">
            ≈ {minutes} min de lectura
          </p>
        )}
        {list}
      </nav>

      {/* Móvil/tablet: colapsable, no ocupa espacio permanente. */}
      <details className="lg:hidden border border-(--border) mb-8 group">
        <summary className="flex items-center justify-between gap-3 px-4 py-3 font-mono text-xs uppercase tracking-wider cursor-pointer select-none">
          <span>Índice de secciones</span>
          {minutes !== null && <span className="text-(--muted)">≈ {minutes} min</span>}
        </summary>
        <div className="px-4 pb-4">{list}</div>
      </details>
    </>
  );
}

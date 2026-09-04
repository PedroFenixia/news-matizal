"use client";

import { useEffect, useRef } from "react";

/**
 * Barra fina fija arriba de la ventana que refleja el progreso de scroll de
 * la página. Actualiza el DOM directamente en el listener de scroll (sin
 * pasar por setState/render de React) para que no introduzca jank en
 * páginas largas como un briefing completo.
 */
export function ReadingProgress() {
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function update() {
      const doc = document.documentElement;
      const scrollable = doc.scrollHeight - doc.clientHeight;
      const pct = scrollable > 0 ? (doc.scrollTop / scrollable) * 100 : 0;
      if (barRef.current) {
        barRef.current.style.width = `${Math.min(100, Math.max(0, pct))}%`;
      }
    }
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  return (
    <div className="reading-progress-track" aria-hidden="true">
      <div ref={barRef} className="reading-progress-bar" />
    </div>
  );
}

"use client";

import { useState } from "react";

export function ShareButton({
  title,
  url,
  className = "",
}: {
  title: string;
  url: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        // Usuario canceló el share nativo o falló: caemos a copiar enlace.
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Sin acceso a clipboard: no hacemos nada más, evitamos romper la UI.
    }
  }

  return (
    <button
      type="button"
      onClick={handleShare}
      className={`inline-flex items-center gap-2 border border-(--border-strong) px-3.5 py-2 font-mono text-[11px] uppercase tracking-wider text-(--foreground) transition-colors cursor-pointer hover:border-(--accent) hover:text-(--accent) ${className}`}
    >
      {copied ? "Enlace copiado" : "Compartir"}
    </button>
  );
}

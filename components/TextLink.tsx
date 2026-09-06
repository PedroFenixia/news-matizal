import Link from "next/link";
import type { AnchorHTMLAttributes, ComponentProps } from "react";

type BaseProps = {
  /** Variante activa: usa el color de acento en vez del color de texto normal (ej. nav activo). */
  active?: boolean;
  className?: string;
};

/**
 * Enlace de texto (menús, nav, fuentes citadas, footer) con un tratamiento
 * visual ÚNICO y consistente en todo el sitio: subrayado siempre visible
 * (no solo en hover) para que se lea de inmediato como clicable, con el
 * color de acento al pasar el ratón. Antes cada componente (SiteHeader,
 * SiteFooter, SourceLink, TableOfContents) resolvía esto por su cuenta —
 * con o sin subrayado, con o sin color permanente — y el resultado no se
 * distinguía de forma fiable como enlace.
 *
 * Deliberadamente NO se usa para los enlaces que ya se leen como botón
 * (borde + relleno en hover: CTA de la portada, fechas del archivo) — esos
 * tienen su propia señal de "clicable" y un subrayado ahí sería ruido.
 */
function linkClassName({ active, className = "" }: BaseProps): string {
  const base =
    "underline decoration-(--border-strong) decoration-1 underline-offset-2 hover:decoration-(--accent) hover:text-(--accent) transition-colors";
  const color = active ? "text-(--accent)" : "text-inherit";
  return `${base} ${color} ${className}`.trim();
}

/** Enlace interno (usa next/link para navegación sin recarga completa). */
export function TextLink({
  active,
  className,
  ...props
}: BaseProps & ComponentProps<typeof Link>) {
  return <Link {...props} className={linkClassName({ active, className })} />;
}

/** Enlace externo o de ancla (#seccion-x): <a> nativo, mismo tratamiento visual. */
export function ExternalTextLink({
  active,
  className,
  ...props
}: BaseProps & AnchorHTMLAttributes<HTMLAnchorElement>) {
  return <a {...props} className={linkClassName({ active, className })} />;
}

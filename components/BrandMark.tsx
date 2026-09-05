import Image from "next/image";

/**
 * Isotipo de Matizal, con variante propia por tema: logo-iso-bold.png
 * (contorno azul marino + M en verde) para modo claro, logo-iso-dark.png
 * (contorno blanco + M en verde de acento) para modo oscuro — el bold
 * original pierde casi todo el contraste sobre el fondo oscuro. Ambas
 * imágenes se superponen y el CSS decide cuál se ve (.theme-light-only /
 * .theme-dark-only en globals.css), sin JS: evita flash de la variante
 * incorrecta durante la hidratación.
 */
export function BrandMark({
  size = 28,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <span className={`relative inline-block shrink-0 ${className}`} style={{ width: size, height: size }}>
      <Image
        src="/brand/logo-iso-bold.png"
        alt=""
        width={size}
        height={size}
        priority
        className="theme-light-only absolute inset-0"
      />
      <Image
        src="/brand/logo-iso-dark.png"
        alt=""
        width={size}
        height={size}
        priority
        className="theme-dark-only absolute inset-0"
      />
    </span>
  );
}

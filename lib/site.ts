/**
 * URL base del sitio. TODA URL absoluta generada por la app (Open Graph,
 * canonical, sitemap, compartir) debe partir de esta constante — nunca
 * hardcodear un dominio en el código.
 */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "http://localhost:3000";

export const SITE_NAME = "Matizal News";

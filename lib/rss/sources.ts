/**
 * Fuentes RSS públicas/oficiales conocidas por cabecera.
 *
 * Solo RSS oficiales, nunca scraping. Si un medio no tiene un feed RSS
 * público conocido y estable, se omite (comentado) en vez de adivinar una URL.
 */

export interface FeedSource {
  outlet: string;
  url: string;
  category: "general" | "financial";
}

export const GENERAL_SOURCES: FeedSource[] = [
  { outlet: "El País", url: "https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/portada", category: "general" },
  { outlet: "El Mundo", url: "https://e00-elmundo.uecdn.es/elmundo/rss/portada.xml", category: "general" },
  { outlet: "ABC", url: "https://www.abc.es/rss/feeds/abcPortada.xml", category: "general" },
  { outlet: "La Razón", url: "https://www.larazon.es/rss/portada.xml", category: "general" },
  // ⚠️ La Razón (2026-09-05): el propio origen del sitio devuelve 503
  // "origin offline" (placeholder de Fastly) en /rss/portada.xml y en la
  // home — no parece un problema de la ruta RSS, sino del sitio entero.
  // Se deja configurada (fetchFeed la reporta como fuente caída, sin
  // bloquear al resto) por si se recupera sola; revisar de nuevo más
  // adelante en vez de retirarla ya.
];

export const FINANCIAL_SOURCES: FeedSource[] = [
  { outlet: "Expansión", url: "https://e00-expansion.uecdn.es/rss/portada.xml", category: "financial" },
  // Cinco Días (grupo Prisa) sirve ahora su sección de Economía bajo el
  // dominio unificado elpais.com — cincodias.elpais.com/rss/economia.xml
  // (la URL antigua) devuelve 404. Verificado 2026-09-05: XML real, 200 OK.
  { outlet: "Cinco Días", url: "https://elpais.com/rss/economia/portada.xml", category: "financial" },
  // ⚠️ El Economista (2026-09-05): todas las rutas bajo /rss/ (incluida la
  // página índice /rss/) devuelven 403 "Access Denied" de Akamai, probado
  // desde dos vías de red distintas. No está claro si el feed se retiró o
  // si es un bloqueo de IP/user-agent — probar de nuevo desde la IP del
  // propio VPS de producción antes de darlo por perdido definitivamente.
  { outlet: "El Economista", url: "https://www.eleconomista.es/rss/rss-economia.php", category: "financial" },
  // FT, Les Echos, Handelsblatt, Il Sole 24 Ore, WSJ: feeds públicos completos
  // requieren suscripción o no publican RSS abierto estable a nivel de
  // portada — se omiten para evitar URLs poco fiables. Se conservan aquí
  // comentados como referencia para revisión manual futura:
  // { outlet: "Financial Times", url: "https://www.ft.com/rss/home", category: "financial" },
  { outlet: "CNBC", url: "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=100003114", category: "financial" },
  { outlet: "Bloomberg (Markets)", url: "https://feeds.bloomberg.com/markets/news.rss", category: "financial" },
];

export const ALL_SOURCES: FeedSource[] = [...GENERAL_SOURCES, ...FINANCIAL_SOURCES];

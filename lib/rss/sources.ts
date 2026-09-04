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
];

export const FINANCIAL_SOURCES: FeedSource[] = [
  { outlet: "Expansión", url: "https://e00-expansion.uecdn.es/rss/portada.xml", category: "financial" },
  { outlet: "Cinco Días", url: "https://cincodias.elpais.com/rss/economia.xml", category: "financial" },
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

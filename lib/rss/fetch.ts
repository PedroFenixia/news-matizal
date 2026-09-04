import Parser from "rss-parser";
import type { FeedSource } from "./sources";
import type { NormalizedFeedItem } from "../types";

const parser = new Parser({
  timeout: 10_000,
  headers: {
    "User-Agent": "MatizalNewsBot/1.0 (+https://news.matizal.com)",
  },
});

export interface FeedFetchResult {
  outlet: string;
  ok: boolean;
  items: NormalizedFeedItem[];
  error?: string;
}

/** Descarga y normaliza un único feed RSS. Nunca lanza: errores se reportan en el resultado. */
export async function fetchFeed(source: FeedSource): Promise<FeedFetchResult> {
  try {
    const feed = await parser.parseURL(source.url);
    const items: NormalizedFeedItem[] = (feed.items ?? [])
      .slice(0, 20)
      .map((item) => ({
        outlet: source.outlet,
        title: (item.title ?? "").trim(),
        link: item.link,
        description: stripHtml(item.contentSnippet ?? item.content ?? item.summary),
        publishedAt: item.isoDate ?? item.pubDate,
        category: source.category,
      }))
      .filter((i) => i.title.length > 0);

    return { outlet: source.outlet, ok: true, items };
  } catch (err) {
    return {
      outlet: source.outlet,
      ok: false,
      items: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/** Descarga varios feeds en paralelo. Cada fuente puede fallar independientemente. */
export async function fetchFeeds(
  sources: FeedSource[]
): Promise<FeedFetchResult[]> {
  return Promise.all(sources.map(fetchFeed));
}

function stripHtml(input?: string): string | undefined {
  if (!input) return undefined;
  return input.replace(/<[^>]+>/g, "").trim().slice(0, 500);
}

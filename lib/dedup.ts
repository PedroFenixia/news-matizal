import { createHash } from "node:crypto";
import { getDb } from "./storage/db";
import type { BriefingType, NormalizedFeedItem } from "./types";

/**
 * Deduplicación/caché de artículos ya procesados (sección 8 del brief:
 * "no enviar repetidamente a OpenAI información que ya haya sido procesada
 * y no haya cambiado"). Complementa a `detectNewItems` de lib/intraday.ts
 * (que compara contra las URLs ya citadas en el propio documento): esta
 * capa usa un hash de outlet+título+URL, independiente del contenido del
 * briefing, y persiste en processed_articles — sobrevive aunque un
 * artículo nunca llegara a citarse como fuente (ej. se descartó por
 * "discarded"), evitando reprocesarlo eternamente en cada revisión.
 */

export function hashArticle(item: NormalizedFeedItem): string {
  const key = `${item.outlet}|${item.title}|${item.link ?? ""}`;
  return createHash("sha256").update(key).digest("hex").slice(0, 24);
}

/** Filtra los artículos cuyo hash NO se haya marcado ya como procesado hoy para ese tipo. */
export function filterUnprocessed(
  type: BriefingType,
  date: string,
  items: NormalizedFeedItem[]
): NormalizedFeedItem[] {
  const db = getDb();
  const stmt = db.prepare(
    `SELECT 1 FROM processed_articles WHERE type = ? AND date = ? AND content_hash = ?`
  );
  return items.filter((item) => {
    const hash = hashArticle(item);
    const row = stmt.get(type, date, hash);
    return !row;
  });
}

/** Marca artículos como procesados (llamar tras una generación/revisión exitosa). */
export function markProcessed(
  type: BriefingType,
  date: string,
  items: NormalizedFeedItem[]
): void {
  const db = getDb();
  const insert = db.prepare(
    `INSERT OR IGNORE INTO processed_articles (type, date, content_hash, url)
     VALUES (@type, @date, @contentHash, @url)`
  );
  const tx = db.transaction((rows: NormalizedFeedItem[]) => {
    for (const item of rows) {
      insert.run({
        type,
        date,
        contentHash: hashArticle(item),
        url: item.link ?? null,
      });
    }
  });
  tx(items);
}

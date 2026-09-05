import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

/**
 * Conexión SQLite compartida.
 *
 * La ruta de la base de datos es configurable vía DATABASE_PATH para que en
 * producción (VPS) viva fuera del directorio del repo/build (persistente,
 * sobrevive a `git pull` + rebuild). En desarrollo local, si no se define,
 * cae a ./data/dev.sqlite dentro del proyecto.
 */

let dbInstance: Database.Database | null = null;

function resolveDbPath(): string {
  const configured = process.env.DATABASE_PATH?.trim();
  if (configured) return configured;
  return path.join(process.cwd(), "data", "dev.sqlite");
}

export function getDb(): Database.Database {
  if (dbInstance) return dbInstance;

  const dbPath = resolveDbPath();
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  migrate(db);

  dbInstance = db;
  return db;
}

function migrate(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS editions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL CHECK (type IN ('general', 'financial')),
      date TEXT NOT NULL,
      edition_id TEXT NOT NULL,
      edition_sequence INTEGER NOT NULL,
      updated_at TEXT NOT NULL,
      is_demo INTEGER NOT NULL DEFAULT 0,
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(type, date, edition_id)
    );

    CREATE INDEX IF NOT EXISTS idx_editions_type_date
      ON editions(type, date);

    CREATE INDEX IF NOT EXISTS idx_editions_type_date_seq
      ON editions(type, date, edition_sequence);

    CREATE TABLE IF NOT EXISTS generation_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id TEXT NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('general', 'financial')),
      trigger TEXT NOT NULL,
      started_at TEXT NOT NULL,
      finished_at TEXT,
      success INTEGER,
      sources_consulted INTEGER,
      items_processed INTEGER,
      edition_id TEXT,
      error_message TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_generation_log_started
      ON generation_log(started_at);

    -- Telemetría de CADA llamada a OpenAI (una fila por llamada real a la
    -- API, incluidos reintentos) — base del panel de uso/coste (sección 11
    -- del brief) y de la protección de presupuesto (lib/budget.ts).
    CREATE TABLE IF NOT EXISTS openai_usage (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id TEXT,
      briefing_type TEXT CHECK (briefing_type IN ('general', 'financial')),
      trigger TEXT,
      task_kind TEXT NOT NULL CHECK (task_kind IN ('fast', 'editorial')),
      operation TEXT NOT NULL,
      model TEXT NOT NULL,
      input_tokens INTEGER NOT NULL DEFAULT 0,
      cached_input_tokens INTEGER NOT NULL DEFAULT 0,
      output_tokens INTEGER NOT NULL DEFAULT 0,
      total_tokens INTEGER NOT NULL DEFAULT 0,
      cost_eur REAL NOT NULL DEFAULT 0,
      duration_ms INTEGER NOT NULL DEFAULT 0,
      success INTEGER NOT NULL,
      error_message TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_openai_usage_created
      ON openai_usage(created_at);

    CREATE INDEX IF NOT EXISTS idx_openai_usage_run
      ON openai_usage(run_id);

    -- Artículos ya procesados por la IA (deduplicación/caché, sección 8 del
    -- brief): antes de enviar un artículo a OpenAI se comprueba si su hash
    -- ya está aquí para el mismo tipo+fecha — evita reprocesar contenido
    -- sin cambios entre revisiones. Ver lib/dedup.ts.
    CREATE TABLE IF NOT EXISTS processed_articles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL CHECK (type IN ('general', 'financial')),
      date TEXT NOT NULL,
      content_hash TEXT NOT NULL,
      url TEXT,
      processed_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(type, date, content_hash)
    );

    CREATE INDEX IF NOT EXISTS idx_processed_articles_lookup
      ON processed_articles(type, date, content_hash);
  `);
}

/** Cierra la conexión (uso en scripts standalone que deben terminar limpio). */
export function closeDb(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

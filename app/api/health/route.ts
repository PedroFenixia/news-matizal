import { NextResponse } from "next/server";
import { getDb } from "@/lib/storage/db";

/**
 * Healthcheck usado por scripts/deploy.sh tras cada despliegue, y
 * potencialmente por monitorización externa. Comprueba que la base de
 * datos SQLite responde a una consulta trivial.
 */
export async function GET() {
  try {
    const db = getDb();
    db.prepare("SELECT 1").get();
    return NextResponse.json({
      status: "ok",
      db: "reachable",
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { status: "error", db: "unreachable", error: message },
      { status: 503 }
    );
  }
}

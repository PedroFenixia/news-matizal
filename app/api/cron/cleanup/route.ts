import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/auth";
import { cleanupExpiredBriefings } from "@/lib/retention";
import { logRunStart, logRunFinish } from "@/lib/storage/generation-log";
import { randomUUID } from "node:crypto";

/**
 * Endpoint protegido para ejecutar la limpieza mensual de retención.
 * En producción se invoca preferentemente desde scripts/cleanup.ts vía
 * crontab/systemd timer el día 5 de cada mes; este endpoint queda como
 * vía alternativa de invocación HTTP.
 */
export async function POST(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const runId = randomUUID();
  const logId = logRunStart({
    runId,
    type: "general", // La limpieza afecta a ambos tipos; se usa "general" como tipo nominal del log.
    trigger: "cleanup",
    startedAt: new Date().toISOString(),
  });

  try {
    const result = cleanupExpiredBriefings();
    logRunFinish(logId, {
      success: true,
      finishedAt: new Date().toISOString(),
      itemsProcessed: result.deletedCount,
    });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logRunFinish(logId, {
      success: false,
      finishedAt: new Date().toISOString(),
      errorMessage: message,
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}

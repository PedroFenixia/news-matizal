import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/auth";
import { runIntradayGeneration } from "@/lib/briefing-generator";

/**
 * Endpoint protegido para la revisión intradía (14:00 y 19:00 Europe/Madrid,
 * ver README). Parte de la última edición válida del día y solo contrasta
 * novedades — nunca regenera el briefing completo (eso es /api/cron/daily,
 * ~10:00). Si no hay artículos nuevos desde la última revisión, no crea una
 * edición nueva (outcomes[].skipped = true).
 */
export async function POST(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const outcomes = await runIntradayGeneration();
  const allOk = outcomes.every((o) => o.success);

  return NextResponse.json(
    { outcomes },
    { status: allOk ? 200 : 207 }
  );
}

export async function GET(req: NextRequest) {
  return POST(req);
}

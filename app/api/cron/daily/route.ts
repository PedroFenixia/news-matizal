import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/auth";
import { runDailyGeneration } from "@/lib/briefing-generator";

/**
 * Endpoint protegido invocado por el cron del sistema (crontab/systemd
 * timer en el VPS) ~10:00 Europe/Madrid, o manualmente para depuración.
 * Genera general + financiero en paralelo; cada uno puede fallar sin
 * bloquear al otro (ver lib/briefing-generator.ts).
 */
export async function POST(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const outcomes = await runDailyGeneration("cron");
  const allOk = outcomes.every((o) => o.success);

  return NextResponse.json(
    { outcomes },
    { status: allOk ? 200 : 207 } // 207: éxito parcial si uno de los dos falló.
  );
}

// GET también soportado por comodidad (algunos disparadores externos solo hacen GET).
export async function GET(req: NextRequest) {
  return POST(req);
}

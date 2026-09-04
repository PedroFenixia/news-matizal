import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/auth";
import { runDailyGeneration } from "@/lib/briefing-generator";
import { canRefreshNow, markRefreshUsed } from "@/lib/rate-limit";

/**
 * "Actualizar ahora": genera una revisión adicional del día (actualización
 * extraordinaria), sin perder trazabilidad de las ediciones previas
 * (soporta múltiples ediciones/día — ver nextEditionInfo en
 * lib/storage/editions.ts). Protegido por CRON_SECRET y con rate limiting
 * básico para evitar abuso.
 */
export async function POST(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { allowed, retryAfterMs } = canRefreshNow();
  if (!allowed) {
    return NextResponse.json(
      {
        error: "Límite de actualizaciones manuales alcanzado. Inténtalo más tarde.",
        retryAfterMs,
      },
      { status: 429 }
    );
  }

  markRefreshUsed();

  const outcomes = await runDailyGeneration("manual");
  const allOk = outcomes.every((o) => o.success);

  return NextResponse.json({ outcomes }, { status: allOk ? 200 : 207 });
}

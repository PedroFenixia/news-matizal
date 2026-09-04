import type { NextRequest } from "next/server";

/**
 * Valida el secreto de invocación de endpoints protegidos (cron diario,
 * cleanup, refresh manual). Acepta el secreto vía header `x-cron-secret` o
 * query param `?secret=`, comparado contra CRON_SECRET.
 */
export function isAuthorizedCronRequest(req: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    console.error(
      "[auth] CRON_SECRET no está configurado: rechazando toda petición a endpoints protegidos."
    );
    return false;
  }

  const headerSecret = req.headers.get("x-cron-secret");
  const querySecret = req.nextUrl.searchParams.get("secret");
  const provided = headerSecret ?? querySecret;

  return provided === expected;
}

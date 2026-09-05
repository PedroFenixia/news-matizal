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

/**
 * Autoriza el panel de diagnóstico/uso (/admin/usage, sección 11 del
 * brief) — secreto propio (ADMIN_SECRET), independiente de CRON_SECRET,
 * porque uno protege endpoints de escritura invocados por máquinas y el
 * otro una vista de solo lectura que Pedro abre a mano en el navegador.
 * Se pasa por query param (?secret=...) porque es una página, no una API
 * invocada por curl con headers.
 */
export function isAuthorizedAdminSecret(providedSecret: string | undefined): boolean {
  const expected = process.env.ADMIN_SECRET;
  if (!expected) return false;
  return providedSecret === expected;
}

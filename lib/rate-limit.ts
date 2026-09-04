/**
 * Rate limiting básico en memoria para el endpoint de "actualizar ahora".
 * No requiere Redis: basta con un timestamp del último uso, ya que es un
 * proceso Node de larga duración (VPS + Docker), no funciones serverless
 * efímeras. Si el proceso se reinicia, el límite se resetea (aceptable para
 * este caso de uso personal).
 */

const WINDOW_MS = 15 * 60 * 1000; // 15 minutos entre "actualizar ahora"

let lastRefreshAt: number | null = null;

export function canRefreshNow(): { allowed: boolean; retryAfterMs?: number } {
  const now = Date.now();
  if (lastRefreshAt === null) {
    return { allowed: true };
  }
  const elapsed = now - lastRefreshAt;
  if (elapsed >= WINDOW_MS) {
    return { allowed: true };
  }
  return { allowed: false, retryAfterMs: WINDOW_MS - elapsed };
}

export function markRefreshUsed(): void {
  lastRefreshAt = Date.now();
}

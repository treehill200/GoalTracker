import "server-only";
/**
 * Simple in-memory sliding-window rate limiter for AI endpoints.
 * Per server instance (fine for a portfolio app; use Redis/Upstash at scale).
 */
const hits = new Map<string, number[]>();

export function rateLimit(
  key: string,
  limit = 20,
  windowMs = 60_000,
): { ok: boolean; retryAfter: number } {
  const now = Date.now();
  const list = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (list.length >= limit) {
    hits.set(key, list);
    return { ok: false, retryAfter: Math.ceil((windowMs - (now - list[0])) / 1000) };
  }
  list.push(now);
  hits.set(key, list);
  if (hits.size > 5000)
    for (const [k, v] of hits) if (!v.some((t) => now - t < windowMs)) hits.delete(k);
  return { ok: true, retryAfter: 0 };
}

/** Rate-limit key: the signed-in user id, else the client IP (demo mode). */
export async function clientKey(req: Request, userId: string | null): Promise<string> {
  if (userId) return `u:${userId}`;
  const fwd = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return `ip:${fwd || req.headers.get("x-real-ip") || "local"}`;
}

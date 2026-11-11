import "server-only";
import * as webpush from "web-push";

let configured = false;
export function pushConfigured(): boolean {
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  if (!configured) {
    webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:admin@example.com", pub, priv);
    configured = true;
  }
  return true;
}

export interface PushSub {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

/** Returns false when the subscription is gone (404/410) so callers can delete it. */
export async function sendPush(
  sub: PushSub,
  payload: { title: string; body: string; href?: string; tag?: string },
): Promise<boolean> {
  if (!pushConfigured()) return false;
  try {
    await webpush.sendNotification(sub, JSON.stringify(payload), { TTL: 60 * 60 * 12 });
    return true;
  } catch (err) {
    const code = (err as { statusCode?: number }).statusCode;
    if (code === 404 || code === 410) return false;
    throw err;
  }
}

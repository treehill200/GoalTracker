"use client";
/** Browser side of Web Push: permission, subscription, test send. */

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export function pushSupport(): { supported: boolean; reason: string | null } {
  if (typeof window === "undefined") return { supported: false, reason: null };
  if (!("Notification" in window) || !("serviceWorker" in navigator)) return { supported: false, reason: "This browser doesn't support notifications." };
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone;
  if (ios && !standalone) return { supported: false, reason: "On iPhone/iPad, add Goal Tracker to your Home Screen first (Share → Add to Home Screen), then enable notifications from the installed app." };
  return { supported: true, reason: null };
}

async function registration() {
  const existing = await navigator.serviceWorker.getRegistration();
  return existing ?? navigator.serviceWorker.register("/sw.js", { scope: "/" });
}

/** Ask permission and (if VAPID is configured) subscribe for server push. */
export async function enablePush(vapidPublicKey: string | null): Promise<{ ok: boolean; server: boolean; message: string }> {
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return { ok: false, server: false, message: "Notifications were blocked. You can allow them in your browser's site settings." };
  if (!vapidPublicKey) return { ok: true, server: false, message: "In-app + local notifications enabled. Add VAPID keys for background push." };
  const reg = await registration();
  await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) }));
  const res = await fetch("/api/push/subscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(sub.toJSON()) });
  return { ok: true, server: res.ok, message: res.ok ? "Push notifications enabled." : "Enabled locally, but the server couldn't save your subscription." };
}

export async function disablePush() {
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    await fetch("/api/push/subscribe", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) }).catch(() => undefined);
    await sub.unsubscribe();
  }
}

/** Sends a real push through the server (or a local notification without VAPID). */
export async function sendTestPush(): Promise<string> {
  const reg = await registration();
  const sub = await reg.pushManager.getSubscription();
  if (!sub) {
    await reg.showNotification("Goal Tracker", { body: "Notifications work! 🎉", icon: "/icons/icon-192.png" });
    return "Local test notification shown.";
  }
  const res = await fetch("/api/push/test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(sub.toJSON()) });
  return res.ok ? "Test push sent — it should arrive in a moment." : "The server couldn't send a push.";
}

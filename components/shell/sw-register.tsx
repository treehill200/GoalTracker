"use client";
import { useEffect } from "react";

/** Registers the service worker (offline shell, caching, push). */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production" && !localStorage.getItem("sw-dev")) return; // avoid stale caches while developing
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => undefined);
    // Clicking a notification asks the page to navigate.
    const onMsg = (e: MessageEvent) => {
      if (e.data?.type === "navigate" && typeof e.data.href === "string") location.assign(e.data.href);
    };
    navigator.serviceWorker.addEventListener("message", onMsg);
    return () => navigator.serviceWorker.removeEventListener("message", onMsg);
  }, []);
  return null;
}

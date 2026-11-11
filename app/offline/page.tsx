import Link from "next/link";

export const metadata = { title: "Offline" };

/** Shown by the service worker when a page isn't cached and there's no network. */
export default function OfflinePage() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center gap-3 px-6 text-center">
      <svg width="72" height="72" viewBox="0 0 24 24" fill="none" stroke="#3E8EF7" strokeWidth="1.5" aria-hidden>
        <path d="M2 8.8a15 15 0 0 1 4.2-2.6M10.7 5.1A15 15 0 0 1 22 8.8M5 12.9a10 10 0 0 1 5.2-2.7M16.8 11.4A10 10 0 0 1 19 12.9M8.5 16.4a5 5 0 0 1 7 0M12 20h.01M2 2l20 20" strokeLinecap="round" />
      </svg>
      <h1 className="text-xl font-bold">You&apos;re offline</h1>
      <p className="text-sm text-muted-foreground">Pages you&apos;ve visited still work, and anything you log is queued and syncs when you reconnect.</p>
      <Link href="/" className="font-semibold text-blue underline">
        Go to home
      </Link>
    </div>
  );
}

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format a number with sensible precision for its size. */
export function fmt(x: number | null | undefined, digits?: number): string {
  if (x === null || x === undefined || !Number.isFinite(x)) return "—";
  const d = digits ?? (Math.abs(x) >= 100 ? 0 : Math.abs(x) >= 10 ? 1 : 2);
  return x.toLocaleString(undefined, { maximumFractionDigits: d, minimumFractionDigits: 0 });
}

export function fmtSigned(x: number | null | undefined, digits?: number): string {
  if (x === null || x === undefined || !Number.isFinite(x)) return "—";
  return (x > 0 ? "+" : x < 0 ? "−" : "") + fmt(Math.abs(x), digits);
}

export function fmtDate(
  d: string | null | undefined,
  opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" },
): string {
  if (!d) return "—";
  const [y, m, day] = d.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, day)).toLocaleDateString(undefined, {
    timeZone: "UTC",
    ...opts,
  });
}

export function fmtShortDate(d: string | null | undefined): string {
  return fmtDate(d, { month: "short", day: "numeric" });
}

export function plural(n: number, word: string, pluralWord = `${word}s`) {
  return `${n} ${Math.abs(n) === 1 ? word : pluralWord}`;
}

export function timeAgo(iso: string): string {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}d ago`;
  return fmtShortDate(iso.slice(0, 10));
}

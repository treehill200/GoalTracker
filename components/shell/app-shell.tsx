"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, CloudOff, Coins, Menu, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect } from "react";
import { levelProgress } from "@/lib/engine/xp";
import { useFeatures } from "@/lib/features";
import { useStore } from "@/lib/store/store";
import { cn, fmt } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown";
import { LogoMark } from "./logo";
import { MAIN_NAV, MORE_NAV, isActive } from "./nav";
import { QuickLog } from "@/components/log/quick-log";
import { CelebrationLayer } from "@/components/celebrations";
import { StreakFlame } from "@/components/streak-flame";
import { WebhookInbox } from "./webhook-inbox";

function LevelChip() {
  const { data } = useStore();
  const lp = levelProgress(data.profile.xp);
  return (
    <Link
      href="/rewards"
      className="border-border bg-surface-1 flex items-center gap-2 rounded-full border py-1 pr-3 pl-1 text-xs"
      aria-label={`Level ${lp.level}, ${Math.round(lp.fraction * 100)}% to next level`}
    >
      <span className="bg-red-strong flex size-6 items-center justify-center rounded-full text-[11px] font-bold text-white">
        {lp.level}
      </span>
      <span
        className="bg-surface-3 hidden h-1.5 w-16 overflow-hidden rounded-full sm:block"
        aria-hidden
      >
        <span
          className="bg-red block h-full rounded-full"
          style={{ width: `${lp.fraction * 100}%` }}
        />
      </span>
      <span className="tabular text-muted-foreground">
        {fmt(lp.intoLevel, 0)}/{fmt(lp.needed, 0)} XP
      </span>
    </Link>
  );
}

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const dark = resolvedTheme !== "light";
  return (
    <button
      onClick={() => setTheme(dark ? "light" : "dark")}
      className="text-muted-foreground hover:bg-surface-2 hover:text-foreground rounded-md p-2"
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {dark ? <Sun className="size-5" /> : <Moon className="size-5" />}
    </button>
  );
}

function Header() {
  const { data, streak, pending, online } = useStore();
  const unread = data.notifications.filter((n) => !n.read).length;
  return (
    <header
      className="border-border bg-background/85 sticky top-0 z-30 flex h-14 items-center gap-2 border-b px-4 backdrop-blur lg:px-6"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <Link href="/" className="flex items-center gap-2 font-semibold lg:hidden">
        <LogoMark size={24} />
        <span className="sr-only sm:not-sr-only">Goal Tracker</span>
      </Link>
      <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
        {!online || pending > 0 ? (
          <span
            className="bg-orange/15 text-orange flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium"
            role="status"
          >
            <CloudOff className="size-3.5" aria-hidden />
            {pending > 0 ? `${pending} log${pending === 1 ? "" : "s"} queued` : "Offline"}
          </span>
        ) : null}
        <span
          className="tabular flex items-center gap-1 text-sm font-semibold"
          aria-label={`${streak.current}-day streak`}
        >
          <StreakFlame active={streak.activeToday} size={18} />
          {streak.current}
        </span>
        <Link
          href="/rewards#shop"
          className="text-yellow tabular flex items-center gap-1 text-sm font-semibold"
          aria-label={`${data.profile.coins} coins`}
        >
          <Coins className="size-4" aria-hidden />
          {fmt(data.profile.coins, 0)}
        </Link>
        <LevelChip />
        <Link
          href="/notifications"
          className="text-muted-foreground hover:bg-surface-2 hover:text-foreground relative rounded-md p-2"
          aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
        >
          <Bell className="size-5" />
          {unread ? (
            <span className="bg-red absolute top-1 right-1 flex min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white">
              {unread > 9 ? "9+" : unread}
            </span>
          ) : null}
        </Link>
        <span className="hidden sm:block">
          <ThemeToggle />
        </span>
        <div className="lg:hidden">
          <DropdownMenu>
            <DropdownMenuTrigger
              className="text-muted-foreground hover:bg-surface-2 rounded-md p-2"
              aria-label="More pages"
            >
              <Menu className="size-5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {MORE_NAV.map(({ href, label, Icon }) => (
                <DropdownMenuItem key={href} asChild>
                  <Link href={href}>
                    <Icon /> {label}
                  </Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}

function Sidebar({ pathname }: { pathname: string }) {
  return (
    <aside
      className="border-border bg-surface-1 fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r px-3 py-4 lg:flex"
      aria-label="Main navigation"
    >
      <Link href="/" className="mb-6 flex items-center gap-2 px-2 text-lg font-bold tracking-tight">
        <LogoMark />
        Goal Tracker
      </Link>
      <nav className="flex flex-col gap-0.5">
        {[...MAIN_NAV, ...MORE_NAV].map(({ href, label, Icon }, i) => (
          <div key={href}>
            {i === MAIN_NAV.length ? <div className="bg-border my-3 h-px" /> : null}
            <Link
              href={href}
              aria-current={isActive(pathname, href) ? "page" : undefined}
              className={cn(
                "text-muted-foreground hover:bg-surface-2 hover:text-foreground flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition",
                isActive(pathname, href) &&
                  "bg-surface-2 text-foreground shadow-[inset_3px_0_0_var(--red)]",
              )}
            >
              <Icon className="size-4" aria-hidden />
              {label}
            </Link>
          </div>
        ))}
      </nav>
      <div className="mt-auto px-2">
        <ThemeToggle />
      </div>
    </aside>
  );
}

function BottomTabs({ pathname }: { pathname: string }) {
  return (
    <nav
      className="border-border bg-surface-1/95 fixed inset-x-0 bottom-0 z-40 border-t backdrop-blur lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Main navigation"
    >
      <ul className="mx-auto flex h-16 max-w-lg items-stretch justify-around">
        {MAIN_NAV.map(({ href, label, Icon }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "text-muted-foreground flex h-full flex-col items-center justify-center gap-1 text-[11px] font-medium",
                  active && "text-foreground",
                )}
              >
                <Icon className={cn("size-5", active && "text-red")} aria-hidden />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function DemoBanner() {
  const f = useFeatures();
  if (!f.demo) return null;
  return (
    <div
      className="border-yellow/30 bg-yellow-fill/10 text-yellow border-b px-4 py-1.5 text-center text-xs"
      role="note"
    >
      <strong>Demo mode:</strong> add keys in <code className="font-mono">.env.local</code> to
      enable sync and AI.
    </div>
  );
}

function MotionPreference() {
  const { data } = useStore();
  useEffect(() => {
    document.documentElement.classList.toggle("reduce-motion", data.profile.settings.reducedMotion);
  }, [data.profile.settings.reducedMotion]);
  return null;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="min-h-dvh">
      <a
        href="#main"
        className="bg-surface-2 sr-only z-50 rounded p-2 focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Skip to content
      </a>
      <Sidebar pathname={pathname} />
      <div className="lg:pl-60">
        <DemoBanner />
        <Header />
        <main id="main" className="mx-auto w-full max-w-6xl px-4 pt-4 pb-32 lg:px-6 lg:pb-16">
          {children}
        </main>
      </div>
      <QuickLog />
      <BottomTabs pathname={pathname} />
      <CelebrationLayer />
      <MotionPreference />
      <WebhookInbox />
    </div>
  );
}

export function AppSkeleton() {
  return (
    <div className="min-h-dvh lg:pl-60" aria-busy="true" aria-label="Loading">
      <div className="border-border h-14 border-b" />
      <div className="mx-auto max-w-6xl space-y-4 p-4 lg:p-6">
        <div className="bg-surface-1 h-36 animate-pulse rounded-xl" />
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="bg-surface-1 h-44 animate-pulse rounded-xl" />
          <div className="bg-surface-1 h-44 animate-pulse rounded-xl" />
        </div>
      </div>
    </div>
  );
}

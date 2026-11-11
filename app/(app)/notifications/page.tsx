"use client";
import Link from "next/link";
import { Award, Bell, CalendarCheck, CheckCheck, Flag, Heart, MessageCircle, PartyPopper, SlidersHorizontal, Star, TrendingDown } from "lucide-react";
import type { NotificationKind } from "@/lib/data/types";
import { useStore } from "@/lib/store/store";
import { cn, timeAgo } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";

const ICON: Record<NotificationKind, typeof Bell> = {
  drift: TrendingDown,
  reminder: Bell,
  checkin: CalendarCheck,
  weekly_review: CalendarCheck,
  milestone: Flag,
  level_up: Star,
  badge: Award,
  cheer: PartyPopper,
  coach: MessageCircle,
  adjustment: SlidersHorizontal,
  system: Heart,
};

export default function NotificationsPage() {
  const { data, actions } = useStore();
  const list = [...data.notifications].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const unread = list.filter((n) => !n.read).length;
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Notifications</h1>
        <div className="flex gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/settings#notifications">Settings</Link>
          </Button>
          {unread ? (
            <Button variant="secondary" size="sm" onClick={() => actions.markAllRead()}>
              <CheckCheck /> Mark all read
            </Button>
          ) : null}
        </div>
      </div>
      {list.length ? (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface-1">
          {list.map((n) => {
            const Icon = ICON[n.kind] ?? Bell;
            const body = (
              <div className={cn("flex gap-3 p-4", !n.read && "bg-blue/5")}>
                <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-full", n.kind === "cheer" || n.kind === "badge" ? "bg-yellow-fill/15 text-yellow" : n.kind === "drift" ? "bg-orange/15 text-orange" : "bg-surface-2 text-blue")}>
                  <Icon className="size-4" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className={cn("text-sm", !n.read && "font-semibold")}>{n.title}</p>
                  <p className="text-sm text-muted-foreground">{n.body}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{timeAgo(n.createdAt)}</p>
                </div>
                {!n.read ? <span className="mt-2 size-2 shrink-0 rounded-full bg-red" aria-label="Unread" /> : null}
              </div>
            );
            return (
              <li key={n.id}>
                {n.href ? (
                  <Link href={n.href} onClick={() => !n.read && actions.markRead(n.id)} className="block hover:bg-surface-2/50">
                    {body}
                  </Link>
                ) : (
                  <button className="block w-full text-left hover:bg-surface-2/50" onClick={() => !n.read && actions.markRead(n.id)}>
                    {body}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState icon={<Bell />} title="All quiet" body="Reminders, drift alerts, cheers and milestones will show up here." />
      )}
    </div>
  );
}

"use client";
/**
 * The app store: loads all data through the repository, keeps it in memory,
 * computes analyses with the engine, and exposes domain actions.
 */
import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { analyzeGoal, type GoalAnalysis } from "@/lib/engine/analyze";
import { averageMood } from "@/lib/engine/mood";
import { timeInZone, todayInZone, type DateStr } from "@/lib/engine/dates";
import type { StreakInfo } from "@/lib/engine/streaks";
import { useFeatures } from "@/lib/features";
import { LocalRepository } from "@/lib/data/local";
import { applyOps, type Op } from "@/lib/data/ops";
import { Outbox } from "@/lib/data/outbox";
import { isNetworkError, type Repository } from "@/lib/data/repository";
import { SupabaseRepository } from "@/lib/data/supabase";
import { bundleFor, type AppData, type CoachMood } from "@/lib/data/types";
import { overallStreak, type Celebration } from "@/lib/game";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { inQuietHours } from "@/lib/notifications/quiet";
import { createActions, type Actions } from "./actions";
import { runMaintenance } from "./maintenance";

export interface StoreValue {
  data: AppData;
  today: DateStr;
  analyses: Map<string, GoalAnalysis>;
  streak: StreakInfo;
  mood: CoachMood;
  focusGoalId: string | null;
  repo: Repository;
  pending: number;
  online: boolean;
  actions: Actions;
  celebrations: Celebration[];
  dismissCelebration: (id: string) => void;
  reload: () => Promise<void>;
}

const StoreCtx = createContext<StoreValue | null>(null);

export function useStore(): StoreValue {
  const v = useContext(StoreCtx);
  if (!v) throw new Error("useStore must be used inside StoreProvider");
  return v;
}

/** Optional variant for components that may render outside the store (e.g. share pages). */
export function useOptionalStore(): StoreValue | null {
  return useContext(StoreCtx);
}

export function analyzeAll(
  data: AppData,
  today: DateStr,
  skipHistory = false,
): Map<string, GoalAnalysis> {
  const out = new Map<string, GoalAnalysis>();
  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const recentBadges = data.userBadges.filter((b) => b.earnedAt > weekAgo).length;
  for (const g of data.goals) {
    const b = bundleFor(data, g.id);
    if (b)
      out.set(
        g.id,
        analyzeGoal(b, {
          today,
          frozenDays: data.profile.settings.frozenDays,
          extraWins: recentBadges,
          skipHistory,
        }),
      );
  }
  return out;
}

async function showSystemNotification(title: string, body: string, href?: string) {
  if (
    typeof window === "undefined" ||
    !("Notification" in window) ||
    Notification.permission !== "granted"
  )
    return;
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg)
      await reg.showNotification(title, {
        body,
        icon: "/icons/icon-192.png",
        badge: "/icons/badge-72.png",
        data: { href: href ?? "/" },
      });
    else new Notification(title, { body });
  } catch {
    /* notifications blocked */
  }
}

type Status =
  | { state: "loading" }
  | { state: "error"; message: string }
  | { state: "ready"; repo: Repository; outbox: Outbox };

export function StoreProvider({
  children,
  fallback,
}: {
  children: React.ReactNode;
  fallback: React.ReactNode;
}) {
  const features = useFeatures();
  const router = useRouter();
  const [status, setStatus] = useState<Status>({ state: "loading" });
  const [data, setData] = useState<AppData | null>(null);
  const dataRef = useRef<AppData | null>(null);
  const [pending, setPending] = useState(0);
  const [online, setOnline] = useState(true);
  const [celebrations, setCelebrations] = useState<Celebration[]>([]);
  const [tick, setTick] = useState(0);
  const chain = useRef<Promise<void>>(Promise.resolve());

  const setAll = useCallback((d: AppData) => {
    dataRef.current = d;
    setData(d);
  }, []);

  // ---- boot: pick the repository and load data
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let repo: Repository;
        if (features.supabase && features.supabaseUrl && features.supabaseAnonKey) {
          const sb = getBrowserSupabase(features.supabaseUrl, features.supabaseAnonKey);
          const { data: auth } = await sb.auth.getUser();
          if (!auth.user) {
            router.replace("/login");
            return;
          }
          repo = new SupabaseRepository(sb, auth.user.id, auth.user.email ?? null);
        } else {
          repo = new LocalRepository();
        }
        const outbox = new Outbox(`${repo.kind}:${repo.userId}`);
        let loaded: AppData;
        try {
          loaded = await repo.loadAll();
          await outbox.saveSnapshot(loaded);
        } catch (err) {
          // Offline: fall back to the last snapshot so the app is still viewable.
          const snap = await outbox.loadSnapshot();
          if (!snap || !isNetworkError(err)) throw err;
          loaded = snap;
          toast.message("You're offline — showing your last synced data.");
        }
        // Re-apply anything still waiting in the outbox.
        const queued = await outbox.all();
        loaded = applyOps(
          loaded,
          queued.map((q) => q.op),
        );
        if (loaded.profile.timezone === "UTC") {
          const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
          if (tz && tz !== "UTC") {
            loaded = { ...loaded, profile: { ...loaded.profile, timezone: tz } };
            repo.apply({ kind: "profile", patch: { timezone: tz } }).catch(() => undefined);
          }
        }
        if (cancelled) return;
        outbox.onChange(setPending);
        setPending(queued.length);
        setAll(loaded);
        setStatus({ state: "ready", repo, outbox });
        if (navigator.onLine) outbox.flush(repo).catch(() => undefined);
      } catch (err) {
        if (!cancelled)
          setStatus({ state: "error", message: err instanceof Error ? err.message : String(err) });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [features.supabase, features.supabaseUrl, features.supabaseAnonKey, router, setAll]);

  // ---- online/offline + outbox flushing
  useEffect(() => {
    if (status.state !== "ready") return;
    const update = () => {
      setOnline(navigator.onLine);
      if (navigator.onLine)
        status.outbox.flush(status.repo).then((n) => {
          if (n > 0) toast.success(`Synced ${n} queued change${n > 1 ? "s" : ""}`);
        });
    };
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, [status]);

  // ---- a clock tick every minute (reminders, date rollover)
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const tz = data?.profile.timezone;
  // `tick` makes "today" refresh after midnight.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const today = useMemo(() => todayInZone(tz), [tz, tick]);

  const commit = useCallback(
    (ops: Op[]) => {
      if (!ops.length || status.state !== "ready" || !dataRef.current) return Promise.resolve();
      setAll(applyOps(dataRef.current, ops));
      const { repo, outbox } = status;
      // Writes go out strictly in order; once something is queued, everything queues behind it.
      const run = chain.current.then(async () => {
        for (const op of ops) {
          const queued = (await outbox.all()).length > 0;
          if (!navigator.onLine || queued) {
            await outbox.enqueue(op);
            continue;
          }
          try {
            await repo.apply(op);
          } catch (err) {
            if (isNetworkError(err)) await outbox.enqueue(op);
            else {
              console.error(err);
              toast.error(`Couldn't save: ${err instanceof Error ? err.message : "unknown error"}`);
            }
          }
        }
        if (repo.kind === "supabase" && dataRef.current) await outbox.saveSnapshot(dataRef.current);
      });
      chain.current = run.catch(() => undefined);
      return run;
    },
    [status, setAll],
  );

  const systemNotify = useCallback((title: string, body: string, href?: string) => {
    const d = dataRef.current;
    if (!d || !d.profile.settings.notify.push) return;
    if (inQuietHours(timeInZone(d.profile.timezone), d.profile.settings.quietHours)) return;
    void showSystemNotification(title, body, href);
  }, []);

  const celebrate = useCallback((list: Celebration[]) => {
    const big = list.filter((c) => c.type !== "xp");
    for (const c of list)
      if (c.type === "xp")
        toast(`+${c.amount} XP · +${c.coins} coins`, { description: c.reason, duration: 1800 });
    if (big.length) setCelebrations((cur) => [...cur, ...big]);
  }, []);

  const actions = useMemo(
    () =>
      // The getters read the latest data from a ref; they only run in event handlers, never during render.
      // eslint-disable-next-line react-hooks/refs
      createActions({
        get: () => dataRef.current!,
        commit,
        today: () => todayInZone(dataRef.current?.profile.timezone),
        celebrate,
        analyzeAll: (d) => analyzeAll(d, todayInZone(d.profile.timezone), true),
        systemNotify,
      }),
    [commit, celebrate, systemNotify],
  );

  const analyses = useMemo(
    () => (data ? analyzeAll(data, today) : new Map<string, GoalAnalysis>()),
    [data, today],
  );

  // ---- maintenance: on load and every minute
  const maintenanceKey = `${today}-${tick}-${status.state}`;
  const lastMaintenance = useRef("");
  useEffect(() => {
    if (status.state !== "ready" || !dataRef.current || lastMaintenance.current === maintenanceKey)
      return;
    lastMaintenance.current = maintenanceKey;
    const d = dataRef.current;
    const r = runMaintenance(d, analyzeAll(d, today, true), today, timeInZone(d.profile.timezone));
    if (r.ops.length) void commit(r.ops);
    r.pushes.slice(0, 2).forEach((p) => systemNotify(p.title, p.body, p.href));
  }, [maintenanceKey, status.state, today, commit, systemNotify]);

  const reload = useCallback(async () => {
    if (status.state !== "ready") return;
    setAll(await status.repo.loadAll());
  }, [status, setAll]);

  const value = useMemo<StoreValue | null>(() => {
    if (!data || status.state !== "ready") return null;
    const active = data.goals.filter((g) => g.status === "active");
    const focusGoalId =
      data.profile.settings.focusGoalId &&
      active.some((g) => g.id === data.profile.settings.focusGoalId)
        ? data.profile.settings.focusGoalId
        : (active[0]?.id ?? null);
    const moods = active
      .map((g) => analyses.get(g.id)?.mood.mood)
      .filter((m): m is CoachMood => Boolean(m));
    return {
      data,
      today,
      analyses,
      streak: overallStreak(data, today),
      mood: focusGoalId
        ? (analyses.get(focusGoalId)?.mood.mood ?? averageMood(moods))
        : averageMood(moods),
      focusGoalId,
      repo: status.repo,
      pending,
      online,
      actions,
      celebrations,
      dismissCelebration: (id) => setCelebrations((c) => c.filter((x) => x.id !== id)),
      reload,
    };
  }, [data, status, today, analyses, pending, online, actions, celebrations, reload]);

  if (status.state === "error") {
    return (
      <div role="alert" className="mx-auto max-w-md p-8 text-center">
        <h1 className="text-xl font-semibold">Something went wrong loading your data</h1>
        <p className="text-muted-foreground mt-2 text-sm">{status.message}</p>
        <button className="text-blue mt-4 underline" onClick={() => location.reload()}>
          Try again
        </button>
      </div>
    );
  }
  // eslint-disable-next-line react-hooks/refs -- `value` is memoized state; the ref is only read inside actions
  if (!value) return <>{fallback}</>;
  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}

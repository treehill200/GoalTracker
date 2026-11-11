/**
 * Demo-mode repository: everything lives in the browser (IndexedDB, with a
 * localStorage fallback). Seeded with two goals and 6 weeks of history.
 */
import { openDB, type IDBPDatabase } from "idb";
import { todayInZone } from "@/lib/engine/dates";
import { applyOp, type Op } from "./ops";
import type { CheerInput, Repository, SharedView } from "./repository";
import { buildSeed, DEMO_USER_ID } from "./seed";
import { bundleFor, type AppData, type Cheer, type AppNotification } from "./types";
import { uid } from "./ids";

const DB_NAME = "goal-tracker-demo";
const STORE = "kv";
const KEY = "appdata";
const LS_KEY = "goal-tracker-demo-appdata";

type Store = {
  get(): Promise<AppData | undefined>;
  set(data: AppData): Promise<void>;
  clear(): Promise<void>;
};

function localStorageStore(): Store {
  return {
    async get() {
      try {
        const raw = localStorage.getItem(LS_KEY);
        return raw ? (JSON.parse(raw) as AppData) : undefined;
      } catch {
        return undefined;
      }
    },
    async set(data) {
      try {
        localStorage.setItem(LS_KEY, JSON.stringify(data));
      } catch {
        /* storage full or blocked: keep in memory only */
      }
    },
    async clear() {
      try {
        localStorage.removeItem(LS_KEY);
      } catch {
        /* ignore */
      }
    },
  };
}

async function idbStore(): Promise<Store> {
  if (typeof indexedDB === "undefined") return localStorageStore();
  try {
    const db: IDBPDatabase = await openDB(DB_NAME, 1, {
      upgrade(d) {
        d.createObjectStore(STORE);
      },
    });
    return {
      get: () => db.get(STORE, KEY) as Promise<AppData | undefined>,
      set: async (data) => {
        await db.put(STORE, data, KEY);
      },
      clear: async () => {
        await db.delete(STORE, KEY);
      },
    };
  } catch {
    return localStorageStore();
  }
}

export class LocalRepository implements Repository {
  readonly kind = "local" as const;
  readonly userId = DEMO_USER_ID;
  private store: Promise<Store>;
  private data: AppData | null = null;
  // Serialize writes so concurrent ops never clobber each other.
  private queue: Promise<unknown> = Promise.resolve();

  constructor(store?: Store) {
    this.store = store ? Promise.resolve(store) : idbStore();
  }

  private async ensure(): Promise<AppData> {
    if (this.data) return this.data;
    const s = await this.store;
    let d = await s.get();
    if (!d) {
      d = buildSeed(todayInZone());
      await s.set(d);
    }
    this.data = d;
    return d;
  }

  async loadAll(): Promise<AppData> {
    return structuredClone(await this.ensure());
  }

  apply(op: Op): Promise<void> {
    const run = this.queue.then(async () => {
      const d = await this.ensure();
      this.data = applyOp(d, op);
      await (await this.store).set(this.data);
    });
    this.queue = run.catch(() => undefined);
    return run;
  }

  async getSharedView(token: string): Promise<SharedView | null> {
    const d = await this.ensure();
    const p = d.partnerships.find((x) => x.shareToken === token && x.status === "active");
    if (!p) return null;
    return {
      ownerName: d.profile.displayName,
      partnerName: p.partnerName,
      partnershipId: p.id,
      level: d.profile.level,
      goals: p.goalIds
        .map((id) => bundleFor(d, id))
        .filter((b): b is NonNullable<typeof b> => b !== null),
      cheers: d.cheers.filter((c) => c.partnershipId === p.id),
    };
  }

  async sendCheer(token: string, input: CheerInput): Promise<void> {
    const d = await this.ensure();
    const p = d.partnerships.find((x) => x.shareToken === token && x.status === "active");
    if (!p) throw new Error("This share link is no longer active.");
    const now = new Date().toISOString();
    const cheer: Cheer = {
      id: uid(),
      userId: d.profile.id,
      partnershipId: p.id,
      createdAt: now,
      ...input,
    };
    const goal = d.goals.find((g) => g.id === input.goalId);
    const note: AppNotification = {
      id: uid(),
      userId: d.profile.id,
      kind: "cheer",
      title: `${input.fromName} cheered you on ${input.emoji}`,
      body: input.message ?? goal?.title ?? "Keep going!",
      goalId: input.goalId,
      href: input.goalId ? `/goals/${input.goalId}` : "/partners",
      read: false,
      dedupeKey: null,
      createdAt: now,
    };
    await this.apply({ kind: "insert", table: "cheers", row: cheer });
    await this.apply({ kind: "insert", table: "notifications", row: note });
  }

  async deleteAccount(): Promise<void> {
    await this.reset();
  }

  async reset(): Promise<void> {
    const s = await this.store;
    await s.clear();
    this.data = null;
    await this.ensure();
  }
}

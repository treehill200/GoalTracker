/**
 * Offline outbox: writes that couldn't reach the repository are stored in
 * IndexedDB and replayed in order when the browser comes back online.
 */
import { openDB, type IDBPDatabase } from "idb";
import type { Op } from "./ops";
import { isNetworkError, type Repository } from "./repository";
import type { AppData } from "./types";

interface QueuedOp {
  seq?: number;
  op: Op;
  queuedAt: string;
}

const DB = "goal-tracker-outbox";

export class Outbox {
  private db: Promise<IDBPDatabase | null>;
  private memory: QueuedOp[] = [];
  private listeners = new Set<(n: number) => void>();
  private flushing = false;

  constructor(private readonly scope: string) {
    this.db =
      typeof indexedDB === "undefined"
        ? Promise.resolve(null)
        : openDB(DB, 1, {
            upgrade(d) {
              d.createObjectStore("ops", { keyPath: "seq", autoIncrement: true });
              d.createObjectStore("snapshots");
            },
          }).catch(() => null);
  }

  onChange(fn: (n: number) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private async emit() {
    const n = (await this.all()).length;
    this.listeners.forEach((l) => l(n));
  }

  async all(): Promise<QueuedOp[]> {
    const db = await this.db;
    if (!db) return this.memory;
    const rows = (await db.getAll("ops")) as (QueuedOp & { scope?: string })[];
    return rows.filter((r) => r.scope === this.scope);
  }

  async enqueue(op: Op): Promise<void> {
    const item = { op, queuedAt: new Date().toISOString(), scope: this.scope };
    const db = await this.db;
    if (db) await db.add("ops", item);
    else this.memory.push(item);
    await this.emit();
  }

  /** Replay queued ops in order. Stops at the first network failure. */
  async flush(repo: Repository): Promise<number> {
    if (this.flushing) return 0;
    this.flushing = true;
    let sent = 0;
    try {
      const db = await this.db;
      for (const item of await this.all()) {
        try {
          await repo.apply(item.op);
        } catch (err) {
          if (isNetworkError(err)) break;
          // Bad data (e.g. the row was deleted elsewhere): drop it rather than block the queue.
          console.warn("Dropping queued op after server rejected it", err);
        }
        if (db && item.seq !== undefined) await db.delete("ops", item.seq);
        else this.memory.shift();
        sent++;
      }
    } finally {
      this.flushing = false;
      await this.emit();
    }
    return sent;
  }

  /** Last successfully loaded data, for offline viewing in Supabase mode. */
  async saveSnapshot(data: AppData): Promise<void> {
    const db = await this.db;
    if (db) await db.put("snapshots", data, this.scope).catch(() => undefined);
  }

  async loadSnapshot(): Promise<AppData | null> {
    const db = await this.db;
    if (!db) return null;
    return ((await db.get("snapshots", this.scope)) as AppData | undefined) ?? null;
  }
}

import "server-only";
/**
 * Demo-mode inbox for the Apple Health webhook: the server can't write into the
 * browser's IndexedDB, so entries wait here until the app drains them.
 * In-memory: works with `npm run dev` / a single server; Supabase mode writes to the DB instead.
 */
export interface InboxItem {
  metric: string;
  value: number;
  date: string;
  receivedAt: string;
}

const g = globalThis as unknown as { __healthInbox?: Map<string, InboxItem[]> };
const inbox = (g.__healthInbox ??= new Map());

export function pushInbox(secret: string, item: InboxItem) {
  const list = inbox.get(secret) ?? [];
  list.push(item);
  inbox.set(secret, list.slice(-500));
}

export function drainInbox(secret: string): InboxItem[] {
  const list = inbox.get(secret) ?? [];
  inbox.delete(secret);
  return list;
}

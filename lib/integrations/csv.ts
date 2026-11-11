/** Generic CSV import and bank CSV (savings goals) with a column mapper. */
import Papa from "papaparse";
import type { IntegrationAdapter, MappedEntry } from "./types";

export type CsvRow = Record<string, string>;

export function parseCsv(text: string): { headers: string[]; rows: CsvRow[] } {
  const r = Papa.parse<CsvRow>(text.trim(), { header: true, skipEmptyLines: true });
  return { headers: r.meta.fields ?? [], rows: r.data };
}

/** Accepts YYYY-MM-DD, MM/DD/YYYY, DD.MM.YYYY and ISO timestamps. */
export function normalizeDate(s: string | undefined): string | null {
  if (!s) return null;
  const t = s.trim();
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(t);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/.exec(t);
  if (m) {
    const y = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${y}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  }
  m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(t);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return null;
}

/** "$1,234.50", "(45.00)", "-12" → number. Parentheses mean negative. */
export function parseAmount(s: string | undefined): number | null {
  if (s === undefined) return null;
  let t = s.trim();
  const neg = /^\(.*\)$/.test(t) || t.startsWith("-");
  t = t.replace(/[()$€£,\s-]/g, "");
  const n = Number(t);
  if (!Number.isFinite(n) || t === "") return null;
  return neg ? -n : n;
}

export interface GenericCsvMapping {
  dateColumn: string;
  valueColumn: string;
  metricId: string;
}

export function mapGenericCsv(rows: CsvRow[], m: GenericCsvMapping): MappedEntry[] {
  const out: MappedEntry[] = [];
  for (const r of rows) {
    const date = normalizeDate(r[m.dateColumn]);
    const value = parseAmount(r[m.valueColumn]);
    if (date && value !== null)
      out.push({ metricId: m.metricId, value, date, source: "csv", note: "CSV import" });
  }
  return out;
}

export interface BankCsvMapping {
  dateColumn: string;
  amountColumn: string;
  categoryColumn: string | null;
  /** Only rows whose category contains this text (e.g. "Savings"). */
  categoryFilter: string | null;
  /** deposits: only positive amounts · net: everything (income − spending) */
  mode: "deposits" | "net";
  metricId: string;
}

/** Daily totals of matching transactions → entries for a savings (running total) metric. */
export function mapBankCsv(rows: CsvRow[], m: BankCsvMapping): MappedEntry[] {
  const byDay = new Map<string, number>();
  for (const r of rows) {
    const date = normalizeDate(r[m.dateColumn]);
    const amount = parseAmount(r[m.amountColumn]);
    if (!date || amount === null) continue;
    if (
      m.categoryColumn &&
      m.categoryFilter &&
      !(r[m.categoryColumn] ?? "").toLowerCase().includes(m.categoryFilter.toLowerCase())
    )
      continue;
    if (m.mode === "deposits" && amount <= 0) continue;
    byDay.set(date, (byDay.get(date) ?? 0) + amount);
  }
  return [...byDay.entries()].sort().map(([date, value]) => ({
    metricId: m.metricId,
    value: Math.round(value * 100) / 100,
    date,
    source: "bank" as const,
    note: "Bank CSV",
  }));
}

export const csvAdapter: IntegrationAdapter<CsvRow, GenericCsvMapping> = {
  id: "csv",
  name: "CSV import",
  description: "Import any metric from a spreadsheet: pick the date and value columns.",
  isEnabled: () => true,
  async connect() {},
  async sync(input) {
    if (!(input instanceof File)) throw new Error("Choose a CSV file");
    return parseCsv(await input.text()).rows;
  },
  mapToMetrics: mapGenericCsv,
};

export const bankCsvAdapter: IntegrationAdapter<CsvRow, BankCsvMapping> = {
  id: "bank_csv",
  name: "Bank / money (CSV)",
  description: "Drive savings goals from your bank's CSV export: map date, amount and category.",
  isEnabled: () => true,
  async connect() {},
  async sync(input) {
    if (!(input instanceof File)) throw new Error("Choose a CSV file");
    return parseCsv(await input.text()).rows;
  },
  mapToMetrics: mapBankCsv,
};

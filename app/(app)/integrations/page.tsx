"use client";
/** Integrations: Strava, Apple Health (export upload + Shortcut webhook), CSV, bank CSV, Plaid stub. */
import { useSearchParams } from "next/navigation";
import { Activity, Apple, Banknote, Copy, FileSpreadsheet, Landmark, Link2, Loader2, RefreshCw, Upload } from "lucide-react";
import { Suspense, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { randomToken } from "@/lib/data/ids";
import type { Metric } from "@/lib/data/types";
import { useFeatures } from "@/lib/features";
import { appleHealthAdapter, type HealthMapping, type HealthRecord } from "@/lib/integrations/apple-health";
import { bankCsvAdapter, csvAdapter, parseCsv, type CsvRow } from "@/lib/integrations/csv";
import { plaidAdapter } from "@/lib/integrations/plaid";
import { stravaAdapter, type StravaActivity } from "@/lib/integrations/strava";
import type { MappedEntry } from "@/lib/integrations/types";
import { useStore } from "@/lib/store/store";
import { timeAgo } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/input";

function MetricSelect({ id, label, value, onChange, metrics }: { id: string; label: string; value: string; onChange: (v: string) => void; metrics: Metric[] }) {
  const { data } = useStore();
  return (
    <Field label={label} htmlFor={id}>
      <Select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">— Don&apos;t import —</option>
        {metrics.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name} ({m.unit}) · {data.goals.find((g) => g.id === m.goalId)?.title}
          </option>
        ))}
      </Select>
    </Field>
  );
}

function useImporter() {
  const { actions } = useStore();
  return async (entries: MappedEntry[], label: string) => {
    if (!entries.length) {
      toast.error("Nothing to import with that mapping");
      return 0;
    }
    await actions.logEntries(entries.map((e) => ({ ...e, recordedAt: `${e.date}T12:00:00.000Z` })), { xp: false });
    toast.success(`Imported ${entries.length} entries from ${label}`);
    return entries.length;
  };
}

function StravaCard({ metrics }: { metrics: Metric[] }) {
  const features = useFeatures();
  const { data, actions } = useStore();
  const integ = data.integrations.find((i) => i.provider === "strava");
  const params = useSearchParams();
  const importer = useImporter();
  const [acts, setActs] = useState<StravaActivity[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [distanceMetric, setDistanceMetric] = useState((integ?.config.distanceMetricId as string) ?? "");
  const [timeMetric, setTimeMetric] = useState((integ?.config.timeMetricId as string) ?? "");
  const [types, setTypes] = useState("Run");

  useEffect(() => {
    const s = params.get("strava");
    if (s === "connected") {
      toast.success("Strava connected!");
      void actions.upsertIntegration({ provider: "strava", connected: true });
    } else if (s) toast.error(`Strava: ${s}`);
  }, [params, actions]);

  if (!stravaAdapter.isEnabled(features)) {
    return (
      <Card className="opacity-80">
        <CardTitle className="flex items-center gap-2">
          <Activity className="size-4 text-orange" aria-hidden /> Strava
        </CardTitle>
        <p className="mt-1 text-sm text-muted-foreground">Set STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET in .env.local to enable real Strava OAuth.</p>
      </Card>
    );
  }

  async function sync() {
    setLoading(true);
    try {
      setActs(await stravaAdapter.sync());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setLoading(false);
    }
  }

  async function doImport() {
    if (!acts) return;
    const unitOf = (id: string) => metrics.find((m) => m.id === id)?.unit ?? "km";
    const imported = (integ?.config.importedIds as number[]) ?? [];
    const entries = stravaAdapter.mapToMetrics(acts, {
      distanceMetricId: distanceMetric || null,
      timeMetricId: timeMetric || null,
      types: types.split(",").map((t) => t.trim()).filter(Boolean),
      importedIds: imported,
      units: { distance: unitOf(distanceMetric), time: unitOf(timeMetric) || "min" },
    });
    await importer(entries, "Strava");
    await actions.upsertIntegration({ provider: "strava", connected: true, lastSyncedAt: new Date().toISOString(), config: { distanceMetricId: distanceMetric, timeMetricId: timeMetric, importedIds: [...imported, ...acts.map((a) => a.id)] } });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="size-4 text-orange" aria-hidden /> Strava
        </CardTitle>
        {integ?.lastSyncedAt ? <span className="text-xs text-muted-foreground">Synced {timeAgo(integ.lastSyncedAt)}</span> : null}
      </CardHeader>
      <p className="mb-3 text-sm text-muted-foreground">{stravaAdapter.description}</p>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => stravaAdapter.connect()}>
          <Link2 /> {integ?.connected ? "Reconnect" : "Connect Strava"}
        </Button>
        <Button variant="secondary" onClick={sync} disabled={loading}>
          {loading ? <Loader2 className="animate-spin" /> : <RefreshCw />} Fetch activities
        </Button>
        {integ?.connected ? (
          <Button variant="ghost" onClick={async () => { await fetch("/api/integrations/strava/disconnect", { method: "POST" }); await actions.upsertIntegration({ provider: "strava", connected: false }); toast.success("Disconnected"); }}>
            Disconnect
          </Button>
        ) : null}
      </div>
      {acts ? (
        <div className="mt-4 space-y-3">
          <p className="text-sm">{acts.length} recent activities found.</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <MetricSelect id="st-d" label="Distance →" value={distanceMetric} onChange={setDistanceMetric} metrics={metrics} />
            <MetricSelect id="st-t" label="Moving time →" value={timeMetric} onChange={setTimeMetric} metrics={metrics} />
            <Field label="Activity types (comma-separated)" htmlFor="st-types" hint="Blank = all">
              <Input id="st-types" value={types} onChange={(e) => setTypes(e.target.value)} />
            </Field>
          </div>
          <Button onClick={doImport} disabled={!distanceMetric && !timeMetric}>
            Import
          </Button>
        </div>
      ) : null}
    </Card>
  );
}

function AppleHealthCard({ metrics }: { metrics: Metric[] }) {
  const { data, actions } = useStore();
  const importer = useImporter();
  const integ = data.integrations.find((i) => i.provider === "apple_health");
  const [records, setRecords] = useState<HealthRecord[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [map, setMap] = useState<HealthMapping>({ bodyMassUnit: "lb", workoutMode: "count", since: null });
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const hook = integ?.webhookSecret ? `${origin}/api/integrations/health/webhook/${integ.webhookSecret}` : null;
  const counts = useMemo(() => records && { body: records.filter((r) => r.kind === "body_mass").length, steps: records.filter((r) => r.kind === "steps").length, workouts: records.filter((r) => r.kind === "workout").length }, [records]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Apple className="size-4" aria-hidden /> Apple Health
        </CardTitle>
      </CardHeader>
      <p className="mb-3 text-sm text-muted-foreground">Web apps can&apos;t read HealthKit directly. Use either option below.</p>
      <div className="space-y-4">
        <div className="rounded-lg bg-surface-2 p-3">
          <p className="text-sm font-semibold">A) Upload your Health export</p>
          <p className="text-xs text-muted-foreground">iPhone → Health → profile picture → Export All Health Data. Send the export.zip to this device and pick it here. Parsed on your device; nothing is uploaded.</p>
          <label className="mt-2 inline-flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-surface-3">
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />} Choose export.zip / export.xml
            <input
              type="file"
              accept=".zip,.xml"
              className="sr-only"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                setBusy(true);
                try {
                  setRecords(await appleHealthAdapter.sync(f));
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Couldn't read that file");
                } finally {
                  setBusy(false);
                }
              }}
            />
          </label>
          {records && counts ? (
            <div className="mt-3 space-y-3">
              <p className="text-sm">
                Found {counts.body} weight records, {counts.steps} step records, {counts.workouts} workouts.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <MetricSelect id="ah-w" label="Body mass →" value={map.bodyMassMetricId ?? ""} onChange={(v) => setMap({ ...map, bodyMassMetricId: v || null, bodyMassUnit: (metrics.find((m) => m.id === v)?.unit.toLowerCase().startsWith("kg") ? "kg" : "lb") })} metrics={metrics} />
                <MetricSelect id="ah-s" label="Steps (daily total) →" value={map.stepsMetricId ?? ""} onChange={(v) => setMap({ ...map, stepsMetricId: v || null })} metrics={metrics} />
                <MetricSelect id="ah-k" label="Workouts →" value={map.workoutMetricId ?? ""} onChange={(v) => setMap({ ...map, workoutMetricId: v || null })} metrics={metrics} />
                <Field label="Only since (optional)" htmlFor="ah-since">
                  <Input id="ah-since" type="date" value={map.since ?? ""} onChange={(e) => setMap({ ...map, since: e.target.value || null })} />
                </Field>
              </div>
              <Button
                onClick={async () => {
                  const n = await importer(appleHealthAdapter.mapToMetrics(records, map), "Apple Health");
                  if (n) await actions.upsertIntegration({ provider: "apple_health", connected: true, lastSyncedAt: new Date().toISOString() });
                }}
              >
                Import
              </Button>
            </div>
          ) : null}
        </div>

        <div className="rounded-lg bg-surface-2 p-3">
          <p className="text-sm font-semibold">B) iOS Shortcut webhook</p>
          {hook ? (
            <>
              <div className="mt-2 flex items-center gap-2 rounded bg-background p-2">
                <code className="min-w-0 flex-1 truncate text-xs">{hook}</code>
                <Button size="icon-sm" variant="ghost" aria-label="Copy webhook URL" onClick={() => navigator.clipboard.writeText(hook).then(() => toast.success("Copied"))}>
                  <Copy />
                </Button>
              </div>
              <ol className="mt-3 list-decimal space-y-1 pl-5 text-xs text-muted-foreground">
                <li>Open the Shortcuts app → New Shortcut.</li>
                <li>Add <strong>Find Health Samples</strong> (e.g. Body Mass, Latest, Limit 1).</li>
                <li>Add <strong>Get Contents of URL</strong>: paste the URL above, Method POST, Request Body JSON with fields <code>metric</code> (e.g. &quot;Body weight&quot;, the exact metric name) and <code>value</code> (the Health sample).</li>
                <li>Optional: Automation → Time of Day → run daily.</li>
              </ol>
              <pre className="mt-2 overflow-x-auto rounded bg-background p-2 text-[11px]">{`curl -X POST ${hook} \\\n  -H "Content-Type: application/json" \\\n  -d '{"metric":"Body weight","value":152.4}'`}</pre>
              <p className="mt-1 text-[11px] text-muted-foreground">Keep this URL secret — anyone with it can add entries. Regenerate to revoke.</p>
            </>
          ) : null}
          <Button size="sm" variant="secondary" className="mt-2" onClick={() => actions.upsertIntegration({ provider: "apple_health", webhookSecret: randomToken(16), connected: true })}>
            {hook ? "Regenerate URL" : "Create webhook URL"}
          </Button>
        </div>
      </div>
    </Card>
  );
}

function CsvCard({ metrics, bank }: { metrics: Metric[]; bank?: boolean }) {
  const importer = useImporter();
  const [csv, setCsv] = useState<{ headers: string[]; rows: CsvRow[] } | null>(null);
  const [dateCol, setDateCol] = useState("");
  const [valueCol, setValueCol] = useState("");
  const [catCol, setCatCol] = useState("");
  const [catFilter, setCatFilter] = useState("");
  const [mode, setMode] = useState<"deposits" | "net">("deposits");
  const [metricId, setMetricId] = useState("");
  const adapter = bank ? bankCsvAdapter : csvAdapter;
  const guess = (headers: string[], re: RegExp) => headers.find((h) => re.test(h)) ?? "";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {bank ? <Banknote className="size-4 text-yellow" aria-hidden /> : <FileSpreadsheet className="size-4 text-blue" aria-hidden />} {adapter.name}
        </CardTitle>
      </CardHeader>
      <p className="mb-3 text-sm text-muted-foreground">{adapter.description}</p>
      <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-surface-2">
        <Upload className="size-4" /> Choose CSV
        <input
          type="file"
          accept=".csv,text/csv"
          className="sr-only"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            const parsed = parseCsv(await f.text());
            setCsv(parsed);
            setDateCol(guess(parsed.headers, /date|day|time/i));
            setValueCol(guess(parsed.headers, bank ? /amount|value|sum/i : /value|amount|count|score|weight/i));
            setCatCol(guess(parsed.headers, /categ|type|desc/i));
          }}
        />
      </label>
      {csv ? (
        <div className="mt-3 space-y-3">
          <p className="text-xs text-muted-foreground">{csv.rows.length} rows · columns: {csv.headers.join(", ")}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              ["Date column", dateCol, setDateCol],
              [bank ? "Amount column" : "Value column", valueCol, setValueCol],
              ...(bank ? [["Category column (optional)", catCol, setCatCol] as const] : []),
            ].map(([label, val, set]) => (
              <Field key={label as string} label={label as string} htmlFor={`${adapter.id}-${label}`}>
                <Select id={`${adapter.id}-${label}`} value={val as string} onChange={(e) => (set as (v: string) => void)(e.target.value)}>
                  <option value="">—</option>
                  {csv.headers.map((h) => (
                    <option key={h}>{h}</option>
                  ))}
                </Select>
              </Field>
            ))}
            {bank ? (
              <>
                <Field label="Only categories containing (optional)" htmlFor="bank-filter">
                  <Input id="bank-filter" value={catFilter} onChange={(e) => setCatFilter(e.target.value)} placeholder="Savings" />
                </Field>
                <Field label="Count" htmlFor="bank-mode">
                  <Select id="bank-mode" value={mode} onChange={(e) => setMode(e.target.value as "deposits" | "net")}>
                    <option value="deposits">Deposits only (money in)</option>
                    <option value="net">Net (in − out)</option>
                  </Select>
                </Field>
              </>
            ) : null}
            <MetricSelect id={`${adapter.id}-metric`} label="Into metric" value={metricId} onChange={setMetricId} metrics={metrics} />
          </div>
          <Button
            disabled={!dateCol || !valueCol || !metricId}
            onClick={() =>
              importer(
                bank
                  ? bankCsvAdapter.mapToMetrics(csv.rows, { dateColumn: dateCol, amountColumn: valueCol, categoryColumn: catCol || null, categoryFilter: catFilter || null, mode, metricId })
                  : csvAdapter.mapToMetrics(csv.rows, { dateColumn: dateCol, valueColumn: valueCol, metricId }),
                adapter.name,
              )
            }
          >
            Import
          </Button>
        </div>
      ) : null}
    </Card>
  );
}

function IntegrationsInner() {
  const { data } = useStore();
  const features = useFeatures();
  const active = new Set(data.goals.filter((g) => g.status === "active").map((g) => g.id));
  const metrics = data.metrics.filter((m) => active.has(m.goalId));
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <StravaCard metrics={metrics} />
      <AppleHealthCard metrics={metrics} />
      <CsvCard metrics={metrics} bank />
      <CsvCard metrics={metrics} />
      {plaidAdapter.isEnabled(features) ? (
        <Card>
          <CardTitle className="flex items-center gap-2">
            <Landmark className="size-4" aria-hidden /> {plaidAdapter.name}
          </CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">{plaidAdapter.description}</p>
          <Button className="mt-3" variant="secondary" onClick={() => plaidAdapter.connect().catch((e: Error) => toast.message(e.message))}>
            Connect bank
          </Button>
        </Card>
      ) : null}
    </div>
  );
}

export default function IntegrationsPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Integrations</h1>
        <p className="text-sm text-muted-foreground">Pull data in automatically. Imported entries count toward your metrics (no XP, to keep it fair).</p>
      </div>
      <Suspense>
        <IntegrationsInner />
      </Suspense>
    </div>
  );
}

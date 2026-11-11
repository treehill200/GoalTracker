"use client";
/**
 * Floating "+" button → sheet: pick a metric, enter a number, save.
 */
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Plus, Sparkles } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useStore } from "@/lib/store/store";
import { cn, fmt } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export function QuickLog() {
  const { data, analyses, actions } = useStore();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [metricId, setMetricId] = useState<string | null>(null);
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);

  // On a goal page, that goal's metrics come first.
  const currentGoal = pathname.startsWith("/goals/") ? pathname.split("/")[2] : null;
  const options = useMemo(() => {
    const active = new Set(data.goals.filter((g) => g.status === "active").map((g) => g.id));
    const lastUsed = new Map<string, string>();
    for (const e of data.entries)
      if ((lastUsed.get(e.metricId) ?? "") < e.recordedAt) lastUsed.set(e.metricId, e.recordedAt);
    return data.metrics
      .filter((m) => active.has(m.goalId))
      .map((m) => ({
        metric: m,
        goal: data.goals.find((g) => g.id === m.goalId)!,
        current: analyses.get(m.goalId)?.metrics.find((x) => x.metric.id === m.id)?.current,
        last: lastUsed.get(m.id) ?? "",
      }))
      .sort(
        (a, b) =>
          Number(b.goal.id === currentGoal) - Number(a.goal.id === currentGoal) ||
          b.last.localeCompare(a.last),
      );
  }, [data, analyses, currentGoal]);

  const selected = options.find((o) => o.metric.id === metricId);
  // Editor pages have their own sticky save button in the same corner.
  const hidden = pathname === "/goals/new" || pathname.endsWith("/edit");

  function pick(id: string) {
    const o = options.find((x) => x.metric.id === id)!;
    setMetricId(id);
    setValue(
      o.metric.aggregation === "latest" && o.current !== undefined
        ? String(Math.round(o.current * 100) / 100)
        : "1",
    );
  }

  async function save(v = value) {
    if (!selected) return;
    const num = Number(v.replace(",", "."));
    if (!Number.isFinite(num)) {
      toast.error("Enter a number");
      return;
    }
    setSaving(true);
    try {
      await actions.logEntry(selected.metric.id, num);
      toast.success(`Logged ${fmt(num)} ${selected.metric.unit} · ${selected.metric.name}`);
      setOpen(false);
      setMetricId(null);
    } finally {
      setSaving(false);
    }
  }

  if (hidden) return null;
  return (
    <>
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={() => {
          setMetricId(null);
          setOpen(true);
        }}
        className="bg-red-strong fixed right-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-40 flex size-14 items-center justify-center rounded-full text-white shadow-[0_10px_30px_-5px_rgba(229,72,77,.8)] lg:right-8 lg:bottom-8"
        aria-label="Quick log"
        data-testid="quick-log-fab"
      >
        <Plus className="size-7" strokeWidth={2.6} />
      </motion.button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          title={selected ? selected.metric.name : "Quick log"}
          description={selected ? selected.goal.title : "Pick what you want to log."}
        >
          <AnimatePresence mode="wait" initial={false}>
            {!selected ? (
              <motion.div
                key="pick"
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                className="space-y-2"
              >
                {options.length === 0 ? (
                  <p className="text-muted-foreground text-sm">
                    No metrics yet.{" "}
                    <Link
                      className="text-blue underline"
                      href="/goals/new"
                      onClick={() => setOpen(false)}
                    >
                      Create a goal
                    </Link>{" "}
                    first.
                  </p>
                ) : (
                  <ul className="grid gap-2 sm:grid-cols-2">
                    {options.map((o) => (
                      <li key={o.metric.id}>
                        <button
                          onClick={() => pick(o.metric.id)}
                          className="border-border bg-surface-2 hover:border-blue flex w-full items-center justify-between gap-3 rounded-lg border p-3 text-left transition"
                          data-testid={`quick-log-metric-${o.metric.id}`}
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-semibold">
                              {o.metric.name}
                            </span>
                            <span className="text-muted-foreground block truncate text-xs">
                              {o.goal.title}
                            </span>
                          </span>
                          <span className="text-muted-foreground tabular shrink-0 text-xs">
                            {fmt(o.current)} {o.metric.unit}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <Link
                  href="/log"
                  onClick={() => setOpen(false)}
                  className="text-blue flex items-center gap-2 pt-2 text-sm"
                >
                  <Sparkles className="size-4" aria-hidden /> Describe it in words instead
                </Link>
              </motion.div>
            ) : (
              <motion.form
                key="value"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 12 }}
                onSubmit={(e) => {
                  e.preventDefault();
                  void save();
                }}
                className="space-y-4"
              >
                <label htmlFor="quick-value" className="sr-only">
                  Value in {selected.metric.unit}
                </label>
                <div className="flex items-center gap-2">
                  <Input
                    id="quick-value"
                    autoFocus
                    inputMode="decimal"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    className="tabular h-16 text-center text-3xl font-bold"
                    data-testid="quick-log-value"
                  />
                  <span className="text-muted-foreground w-16 text-sm">{selected.metric.unit}</span>
                </div>
                <p className="text-muted-foreground text-xs">
                  {selected.metric.aggregation === "latest"
                    ? "Enter your current value."
                    : selected.metric.aggregation === "weekly_sum"
                      ? `Adds to this week's total (target ${fmt(selected.metric.target)}/week).`
                      : "Adds to your running total."}
                </p>
                {selected.metric.aggregation !== "latest" ? (
                  <div className="flex gap-2">
                    {[1, 2, 5].map((n) => (
                      <Button
                        key={n}
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => void save(String(n))}
                      >
                        +{n}
                      </Button>
                    ))}
                  </div>
                ) : null}
                <div className="flex gap-2">
                  <Button type="button" variant="ghost" onClick={() => setMetricId(null)}>
                    <ArrowLeft /> Back
                  </Button>
                  <Button
                    type="submit"
                    className={cn("flex-1")}
                    size="lg"
                    disabled={saving}
                    data-testid="quick-log-save"
                  >
                    Save
                  </Button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>
        </DialogContent>
      </Dialog>
    </>
  );
}

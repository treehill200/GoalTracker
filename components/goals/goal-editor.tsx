"use client";
/**
 * Full goal editor used by every creation method (and by Edit).
 * Shows live required pace, suggested/soft deadline and realism warnings.
 */
import { Plus, Star, Trash2, TriangleAlert } from "lucide-react";
import { useMemo, useState } from "react";
import { addDays, diffDays } from "@/lib/engine/dates";
import { checkRealism } from "@/lib/engine/realism";
import { milestoneTargets, suggestDeadline } from "@/lib/engine/suggest";
import { GoalDraftSchema, type GoalDraftInput } from "@/lib/data/schemas";
import type { MetricAggregation, Recurrence } from "@/lib/data/types";
import { cn, fmt, fmtDate, fmtSigned } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

export type DraftMetric = GoalDraftInput["metrics"][number];
export type DraftMilestone = GoalDraftInput["milestones"][number];
export type DraftTask = GoalDraftInput["tasks"][number];

export const CATEGORIES = [
  "General",
  "Education",
  "Fitness",
  "Health",
  "Finance",
  "Career",
  "Learning",
  "Creative",
  "Personal",
];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Number input that keeps the user's raw text while typing. */
function NumberField({
  value,
  onChange,
  id,
  label,
  placeholder,
  allowNull,
  className,
}: {
  value: number | null | undefined;
  onChange: (v: number | null) => void;
  id: string;
  label: string;
  placeholder?: string;
  allowNull?: boolean;
  className?: string;
}) {
  const [text, setText] = useState(value === null || value === undefined ? "" : String(value));
  return (
    <Field label={label} htmlFor={id} className={className}>
      <Input
        id={id}
        inputMode="decimal"
        value={text}
        placeholder={placeholder}
        onChange={(e) => {
          setText(e.target.value);
          const n = Number(e.target.value.replace(",", "."));
          if (e.target.value.trim() === "" && allowNull) onChange(null);
          else if (Number.isFinite(n)) onChange(n);
        }}
      />
    </Field>
  );
}

function RecurrenceEditor({
  value,
  onChange,
  id,
  today,
}: {
  value: Recurrence;
  onChange: (r: Recurrence) => void;
  id: string;
  today: string;
}) {
  return (
    <div className="flex flex-wrap items-end gap-2">
      <Field label="Repeats" htmlFor={`${id}-type`}>
        <Select
          id={`${id}-type`}
          value={value.type}
          onChange={(e) => {
            const t = e.target.value as Recurrence["type"];
            onChange(
              t === "daily"
                ? { type: "daily" }
                : t === "times_per_week"
                  ? { type: "times_per_week", times: 3 }
                  : t === "weekdays"
                    ? { type: "weekdays", days: [1, 3, 5] }
                    : { type: "every_n_weeks", weekday: 6, interval: 2, anchor: today },
            );
          }}
        >
          <option value="daily">Every day</option>
          <option value="times_per_week">N times per week</option>
          <option value="weekdays">Specific weekdays</option>
          <option value="every_n_weeks">Every N weeks</option>
        </Select>
      </Field>
      {value.type === "times_per_week" ? (
        <Field label="Times / week" htmlFor={`${id}-n`}>
          <Select
            id={`${id}-n`}
            value={value.times}
            onChange={(e) => onChange({ type: "times_per_week", times: Number(e.target.value) })}
          >
            {[1, 2, 3, 4, 5, 6, 7].map((n) => (
              <option key={n}>{n}</option>
            ))}
          </Select>
        </Field>
      ) : null}
      {value.type === "weekdays" ? (
        <fieldset className="flex gap-1">
          <legend className="sr-only">Weekdays</legend>
          {DAYS.map((d, i) => {
            const on = value.days.includes(i);
            return (
              <button
                key={d}
                type="button"
                aria-pressed={on}
                onClick={() =>
                  onChange({
                    type: "weekdays",
                    days: on ? value.days.filter((x) => x !== i) : [...value.days, i].sort(),
                  })
                }
                className={cn(
                  "h-10 w-10 rounded-md border text-xs font-semibold",
                  on ? "border-blue bg-blue/20 text-blue" : "border-border text-muted-foreground",
                )}
              >
                {d.slice(0, 2)}
              </button>
            );
          })}
        </fieldset>
      ) : null}
      {value.type === "every_n_weeks" ? (
        <>
          <Field label="Every" htmlFor={`${id}-int`}>
            <Select
              id={`${id}-int`}
              value={value.interval}
              onChange={(e) => onChange({ ...value, interval: Number(e.target.value) })}
            >
              {[1, 2, 3, 4].map((n) => (
                <option key={n} value={n}>
                  {n} week{n > 1 ? "s" : ""}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="On" htmlFor={`${id}-wd`}>
            <Select
              id={`${id}-wd`}
              value={value.weekday}
              onChange={(e) => onChange({ ...value, weekday: Number(e.target.value) })}
            >
              {DAYS.map((d, i) => (
                <option key={d} value={i}>
                  {d}
                </option>
              ))}
            </Select>
          </Field>
        </>
      ) : null}
    </div>
  );
}

export function GoalEditor({
  initial,
  today,
  submitLabel,
  onSubmit,
  emphasis,
}: {
  initial: GoalDraftInput;
  today: string;
  submitLabel: string;
  onSubmit: (d: GoalDraftInput) => Promise<void>;
  emphasis?: "metrics" | "milestones";
}) {
  const [d, setD] = useState<GoalDraftInput>(initial);
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const set = (patch: Partial<GoalDraftInput>) => setD((cur) => ({ ...cur, ...patch }));
  const setMetric = (i: number, patch: Partial<DraftMetric>) =>
    set({ metrics: d.metrics.map((m, j) => (j === i ? { ...m, ...patch } : m)) });
  const setMilestone = (i: number, patch: Partial<DraftMilestone>) =>
    set({ milestones: d.milestones.map((m, j) => (j === i ? { ...m, ...patch } : m)) });
  const setTask = (i: number, patch: Partial<DraftTask>) =>
    set({ tasks: d.tasks.map((m, j) => (j === i ? { ...m, ...patch } : m)) });

  const keyIndex = Math.max(
    0,
    d.metrics.findIndex((m) => m.isKey),
  );
  const key = d.metrics[keyIndex] as DraftMetric | undefined;
  const suggestion = useMemo(
    () =>
      suggestDeadline({
        startDate: d.startDate,
        baseline: key && key.aggregation !== "weekly_sum" ? key.baseline : null,
        target: key && key.aggregation !== "weekly_sum" ? key.target : null,
        unit: key?.unit ?? null,
        weeklyTarget: key?.weeklyTarget ?? null,
        plannedWeeklyEffort: d.plannedWeeklyEffort ?? null,
      }),
    [d.startDate, d.plannedWeeklyEffort, key],
  );
  const effDeadline = d.isOpenEnded
    ? key?.weeklyTarget
      ? suggestion.date
      : (d.suggestedDeadline ?? suggestion.date)
    : d.deadline;
  const weeks = effDeadline ? Math.max(diffDays(effDeadline, d.startDate) / 7, 1 / 7) : null;

  const warnings = useMemo(() => {
    if (!weeks) return [];
    return d.metrics.flatMap((m) =>
      checkRealism({
        goalTitle: d.title,
        metricName: m.name,
        unit: m.unit ?? "",
        baseline: m.baseline,
        target: m.target,
        weeklyRate:
          m.aggregation === "weekly_sum"
            ? m.target
            : (m.weeklyTarget ?? (m.target - m.baseline) / weeks),
        durationWeeks: weeks,
        startDate: d.startDate,
        aggregation: m.aggregation,
      }),
    );
  }, [d, weeks]);

  const totalWeight =
    d.metrics.reduce((a, m) => a + (m.weight ?? 1), 0) +
    (d.milestones.length ? (d.milestoneWeight ?? 0) : 0) +
    (d.tasks.length ? (d.taskWeight ?? 0) : 0);
  const share = (w: number) => (totalWeight > 0 ? `${Math.round((w / totalWeight) * 100)}%` : "—");
  const msTargets =
    key && key.aggregation !== "weekly_sum"
      ? milestoneTargets(
          d.startDate,
          key.baseline,
          d.milestones.map((m) => ({
            title: m.title,
            targetDate: m.targetDate ?? null,
            thresholdValue: m.thresholdValue ?? null,
          })),
        )
      : [];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const draft = {
      ...d,
      suggestedDeadline: d.suggestedDeadline ?? suggestion.date,
      deadline: d.isOpenEnded ? null : d.deadline,
    };
    const r = GoalDraftSchema.safeParse(draft);
    if (!r.success) {
      setErrors(r.error.issues.map((i) => `${i.path.join(" › ") || "Goal"}: ${i.message}`));
      return;
    }
    setErrors([]);
    setSaving(true);
    try {
      await onSubmit(draft);
    } finally {
      setSaving(false);
    }
  }

  const metricsCard = (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Metrics</CardTitle>
          <p className="text-muted-foreground text-xs">
            Numbers that measure progress. The ★ key metric drives the forecast.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() =>
            set({
              metrics: [
                ...d.metrics,
                {
                  name: "",
                  unit: "",
                  baseline: 0,
                  target: 10,
                  weight: 1,
                  aggregation: "latest",
                  weeklyTarget: null,
                  isKey: d.metrics.length === 0,
                },
              ],
            })
          }
        >
          <Plus /> Metric
        </Button>
      </CardHeader>
      {d.metrics.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No metrics. Milestones or tasks alone also work.
        </p>
      ) : null}
      <div className="space-y-4">
        {d.metrics.map((m, i) => {
          const weekly = m.aggregation === "weekly_sum";
          const required = !weekly && weeks ? (m.target - m.baseline) / weeks : null;
          return (
            <div key={i} className="border-border bg-surface-2/40 rounded-lg border p-3">
              <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1.4fr]">
                <Field label="Name" htmlFor={`m-${i}-name`}>
                  <Input
                    id={`m-${i}-name`}
                    value={m.name}
                    placeholder="e.g. Practice test score"
                    onChange={(e) => setMetric(i, { name: e.target.value })}
                  />
                </Field>
                <Field label="Unit" htmlFor={`m-${i}-unit`}>
                  <Input
                    id={`m-${i}-unit`}
                    value={m.unit ?? ""}
                    placeholder="points"
                    onChange={(e) => setMetric(i, { unit: e.target.value })}
                  />
                </Field>
                <Field label="Type" htmlFor={`m-${i}-agg`}>
                  <Select
                    id={`m-${i}-agg`}
                    value={m.aggregation}
                    onChange={(e) =>
                      setMetric(i, {
                        aggregation: e.target.value as MetricAggregation,
                        ...(e.target.value === "weekly_sum"
                          ? { baseline: 0, weeklyTarget: null }
                          : {}),
                      })
                    }
                  >
                    <option value="latest">Level (latest value)</option>
                    <option value="sum_total">Running total</option>
                    <option value="weekly_sum">Weekly habit</option>
                  </Select>
                </Field>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {!weekly ? (
                  <NumberField
                    id={`m-${i}-base`}
                    label="Start (baseline)"
                    value={m.baseline}
                    onChange={(v) => setMetric(i, { baseline: v ?? 0 })}
                  />
                ) : null}
                <NumberField
                  id={`m-${i}-target`}
                  label={weekly ? "Target per week" : "Target"}
                  value={m.target}
                  onChange={(v) => setMetric(i, { target: v ?? 0 })}
                />
                {!weekly ? (
                  <NumberField
                    id={`m-${i}-wk`}
                    label="Planned pace / wk (optional)"
                    allowNull
                    value={m.weeklyTarget}
                    placeholder={required ? fmt(required) : "auto"}
                    onChange={(v) => setMetric(i, { weeklyTarget: v })}
                  />
                ) : null}
                <NumberField
                  id={`m-${i}-w`}
                  label={`Weight (${share(m.weight ?? 1)})`}
                  value={m.weight ?? 1}
                  onChange={(v) => setMetric(i, { weight: Math.max(v ?? 0, 0) })}
                />
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="text-muted-foreground" aria-live="polite">
                  {weekly ? (
                    `Habit: hit ${fmt(m.target)} ${m.unit} every week.`
                  ) : required !== null ? (
                    <>
                      Required pace:{" "}
                      <strong className="text-blue">
                        {fmtSigned(required)} {m.unit}/week
                      </strong>{" "}
                      ({fmtSigned(required / 7)}/day)
                    </>
                  ) : null}
                </span>
                <span className="flex items-center gap-1">
                  {!weekly ? (
                    <Button
                      type="button"
                      size="sm"
                      variant={m.isKey ? "yellow" : "ghost"}
                      onClick={() =>
                        set({ metrics: d.metrics.map((x, j) => ({ ...x, isKey: j === i })) })
                      }
                      aria-pressed={m.isKey}
                    >
                      <Star /> {m.isKey ? "Key metric" : "Make key"}
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`Remove metric ${m.name || i + 1}`}
                    onClick={() => set({ metrics: d.metrics.filter((_, j) => j !== i) })}
                  >
                    <Trash2 />
                  </Button>
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );

  const milestonesCard = (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Milestones</CardTitle>
          <p className="text-muted-foreground text-xs">
            Ordered checkpoints. Link one to the key metric to auto-complete it.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() =>
            set({
              milestones: [
                ...d.milestones,
                {
                  title: "",
                  targetDate: effDeadline ?? addDays(today, 28),
                  weight: 1,
                  metricIndex: null,
                  thresholdValue: null,
                },
              ],
              milestoneWeight: d.milestones.length
                ? d.milestoneWeight
                : Math.max(d.milestoneWeight ?? 0, d.metrics.length ? 0.3 : 1),
            })
          }
        >
          <Plus /> Milestone
        </Button>
      </CardHeader>
      {d.milestones.length ? (
        <NumberField
          id="ms-weight"
          className="mb-3 max-w-56"
          label={`Milestones weight (${share(d.milestoneWeight ?? 0)} of score)`}
          value={d.milestoneWeight ?? 0}
          onChange={(v) => set({ milestoneWeight: Math.max(v ?? 0, 0) })}
        />
      ) : null}
      <ol className="space-y-3">
        {d.milestones.map((m, i) => (
          <li key={i} className="border-border bg-surface-2/40 rounded-lg border p-3">
            <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-end">
              <Field label={`${i + 1}. Title`} htmlFor={`ms-${i}-t`}>
                <Input
                  id={`ms-${i}-t`}
                  value={m.title}
                  placeholder="e.g. Score 1300"
                  onChange={(e) => setMilestone(i, { title: e.target.value })}
                />
              </Field>
              <Field label="Target date" htmlFor={`ms-${i}-d`}>
                <Input
                  id={`ms-${i}-d`}
                  type="date"
                  value={m.targetDate ?? ""}
                  onChange={(e) => setMilestone(i, { targetDate: e.target.value || null })}
                />
              </Field>
              {key && key.aggregation !== "weekly_sum" ? (
                <NumberField
                  id={`ms-${i}-v`}
                  label={`At ${key.name || "key metric"} =`}
                  allowNull
                  value={m.thresholdValue}
                  placeholder="optional"
                  onChange={(v) =>
                    setMilestone(i, {
                      thresholdValue: v,
                      metricIndex: v === null ? null : keyIndex,
                    })
                  }
                />
              ) : (
                <span />
              )}
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label={`Remove milestone ${i + 1}`}
                onClick={() => set({ milestones: d.milestones.filter((_, j) => j !== i) })}
              >
                <Trash2 />
              </Button>
            </div>
            {msTargets[i]?.perWeek != null ? (
              <p className="text-muted-foreground mt-2 text-xs">
                To get here:{" "}
                <strong className="text-blue">
                  {fmtSigned(msTargets[i].perWeek)} {key?.unit}/week
                </strong>{" "}
                · {fmtSigned(msTargets[i].perDay)}/day
              </p>
            ) : null}
          </li>
        ))}
      </ol>
    </Card>
  );

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <Card>
        <CardHeader>
          <CardTitle>Basics</CardTitle>
        </CardHeader>
        <div className="grid gap-3">
          <Field label="Goal" htmlFor="g-title">
            <Input
              id="g-title"
              value={d.title}
              onChange={(e) => set({ title: e.target.value })}
              placeholder="e.g. Get a 1500+ on the SAT"
            />
          </Field>
          <Field label="Why it matters (optional)" htmlFor="g-desc">
            <Textarea
              id="g-desc"
              value={d.description ?? ""}
              onChange={(e) => set({ description: e.target.value })}
              rows={2}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Category" htmlFor="g-cat">
              <Select
                id="g-cat"
                value={d.category ?? "General"}
                onChange={(e) => set({ category: e.target.value })}
              >
                {CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </Select>
            </Field>
            <Field label="Daily reminder (optional)" htmlFor="g-rem">
              <Input
                id="g-rem"
                type="time"
                value={d.reminderTime ?? ""}
                onChange={(e) => set({ reminderTime: e.target.value || null })}
              />
            </Field>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Timeline</CardTitle>
        </CardHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Start date" htmlFor="g-start">
            <Input
              id="g-start"
              type="date"
              value={d.startDate}
              onChange={(e) => set({ startDate: e.target.value })}
            />
          </Field>
          <Field label="Hours per week you can invest" htmlFor="g-effort">
            <Input
              id="g-effort"
              inputMode="decimal"
              value={d.plannedWeeklyEffort ?? ""}
              onChange={(e) =>
                set({
                  plannedWeeklyEffort: e.target.value === "" ? null : Number(e.target.value) || 0,
                })
              }
              placeholder="e.g. 5"
            />
          </Field>
        </div>
        <div className="bg-surface-2 mt-4 flex items-center justify-between gap-3 rounded-lg p-3">
          <div>
            <p className="text-sm font-medium">Open-ended goal</p>
            <p className="text-muted-foreground text-xs">
              No fixed date — tracked by momentum against a soft deadline.
            </p>
          </div>
          <Switch
            checked={d.isOpenEnded}
            onCheckedChange={(v) =>
              set({ isOpenEnded: v, deadline: v ? null : (d.deadline ?? suggestion.date) })
            }
            aria-label="Open-ended goal"
          />
        </div>
        {!d.isOpenEnded ? (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label="Deadline" htmlFor="g-deadline">
              <Input
                id="g-deadline"
                type="date"
                value={d.deadline ?? ""}
                onChange={(e) => set({ deadline: e.target.value || null })}
              />
            </Field>
            <Field label="Expected progress curve" htmlFor="g-curve">
              <Select
                id="g-curve"
                value={d.expectedCurve ?? "linear"}
                onChange={(e) => set({ expectedCurve: e.target.value as "linear" | "slow_start" })}
              >
                <option value="linear">Linear (steady)</option>
                <option value="slow_start">Slow start (ramps up)</option>
              </Select>
            </Field>
          </div>
        ) : null}
        <div
          className="border-blue/30 bg-blue/5 mt-3 rounded-lg border p-3 text-sm"
          aria-live="polite"
        >
          <span className="text-muted-foreground">Suggested deadline: </span>
          <strong>{fmtDate(suggestion.date)}</strong>
          <span className="text-muted-foreground text-xs">
            {" "}
            (
            {suggestion.basis === "plan"
              ? "from your planned pace"
              : suggestion.basis === "typical"
                ? "typical sustainable pace"
                : "from weekly effort"}
            )
          </span>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="blue"
              onClick={() =>
                set({
                  isOpenEnded: false,
                  deadline: suggestion.date,
                  suggestedDeadline: suggestion.date,
                })
              }
            >
              Accept
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() =>
                set({ isOpenEnded: true, deadline: null, suggestedDeadline: suggestion.date })
              }
            >
              Keep open-ended
            </Button>
          </div>
          {d.isOpenEnded ? (
            <p className="text-muted-foreground mt-2 text-xs">
              Soft deadline: {fmtDate(effDeadline)} — the app will always show &ldquo;at this pace
              you&apos;ll finish on…&rdquo;.
            </p>
          ) : null}
        </div>
      </Card>

      {emphasis === "milestones" ? (
        <>
          {milestonesCard}
          {metricsCard}
        </>
      ) : (
        <>
          {metricsCard}
          {milestonesCard}
        </>
      )}

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Recurring tasks</CardTitle>
            <p className="text-muted-foreground text-xs">
              The habits that move the numbers. They power streaks and consistency.
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() =>
              set({
                tasks: [...d.tasks, { title: "", recurrence: { type: "daily" }, xpValue: 15 }],
              })
            }
          >
            <Plus /> Task
          </Button>
        </CardHeader>
        {d.tasks.length ? (
          <NumberField
            id="t-weight"
            className="mb-3 max-w-56"
            label={`Tasks weight (${share(d.taskWeight ?? 0)} of score)`}
            value={d.taskWeight ?? 0}
            onChange={(v) => set({ taskWeight: Math.max(v ?? 0, 0) })}
          />
        ) : null}
        <ul className="space-y-3">
          {d.tasks.map((t, i) => (
            <li key={i} className="border-border bg-surface-2/40 rounded-lg border p-3">
              <div className="flex items-end gap-2">
                <Field label="Task" htmlFor={`t-${i}`} className="flex-1">
                  <Input
                    id={`t-${i}`}
                    value={t.title}
                    placeholder="e.g. 1 practice section"
                    onChange={(e) => setTask(i, { title: e.target.value })}
                  />
                </Field>
                <NumberField
                  id={`t-${i}-xp`}
                  className="w-20"
                  label="XP"
                  value={t.xpValue ?? 15}
                  onChange={(v) => setTask(i, { xpValue: Math.round(v ?? 15) })}
                />
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  aria-label={`Remove task ${i + 1}`}
                  onClick={() => set({ tasks: d.tasks.filter((_, j) => j !== i) })}
                >
                  <Trash2 />
                </Button>
              </div>
              <div className="mt-2">
                <RecurrenceEditor
                  id={`t-${i}-r`}
                  value={t.recurrence}
                  today={today}
                  onChange={(r) => setTask(i, { recurrence: r })}
                />
              </div>
            </li>
          ))}
        </ul>
      </Card>

      {warnings.length ? (
        <Card className="border-yellow/40 bg-yellow-fill/5" role="status">
          <CardTitle className="text-yellow mb-2 flex items-center gap-2">
            <TriangleAlert className="size-4" aria-hidden /> Realism check
          </CardTitle>
          {warnings.map((w) => (
            <div key={w.rule} className="mb-2 text-sm">
              <p>{w.message}</p>
              {w.suggestedDeadline ? (
                <Button
                  type="button"
                  size="sm"
                  variant="link"
                  className="h-auto px-0"
                  onClick={() => set({ isOpenEnded: false, deadline: w.suggestedDeadline })}
                >
                  Use a realistic deadline: {fmtDate(w.suggestedDeadline)}
                </Button>
              ) : null}
            </div>
          ))}
          <p className="text-muted-foreground text-[11px]">General guidance, not medical advice.</p>
        </Card>
      ) : null}

      {errors.length ? (
        <div
          role="alert"
          className="border-red/50 bg-red/10 text-red rounded-lg border p-3 text-sm"
        >
          <ul className="list-disc pl-5">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-20 flex justify-end lg:bottom-4">
        <Button
          type="submit"
          size="lg"
          disabled={saving}
          className="w-full sm:w-auto"
          data-testid="save-goal"
        >
          {saving ? "Saving…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}

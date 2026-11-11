"use client";
import { motion } from "framer-motion";
import { describeRecurrence } from "@/lib/engine/recurrence";
import { useStore } from "@/lib/store/store";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";

/** Today's recurring tasks across goals (or for one goal). */
export function TodayTasks({ goalId, showGoal = true }: { goalId?: string; showGoal?: boolean }) {
  const { data, analyses, actions, today } = useStore();
  const rows = data.goals
    .filter((g) => g.status === "active" && (!goalId || g.id === goalId))
    .flatMap((g) => (analyses.get(g.id)?.todayTasks ?? []).filter((t) => t.due || t.doneToday).map((t) => ({ ...t, goal: g })));
  if (!rows.length) return <p className="text-sm text-muted-foreground">Nothing scheduled today. Nice.</p>;
  return (
    <ul className="divide-y divide-border">
      {rows.map(({ task, doneToday, remainingThisWeek, goal }) => {
        const id = `task-${task.id}`;
        return (
          <li key={task.id} className="flex items-center gap-3 py-2.5">
            <Checkbox id={id} checked={doneToday} onCheckedChange={(v) => actions.toggleTask(task.id, today, v === true)} aria-describedby={`${id}-meta`} />
            <label htmlFor={id} className="min-w-0 flex-1 cursor-pointer">
              <motion.span animate={{ opacity: doneToday ? 0.55 : 1 }} className={cn("block truncate text-sm font-medium", doneToday && "line-through")}>
                {task.title}
              </motion.span>
              <span id={`${id}-meta`} className="block truncate text-xs text-muted-foreground">
                {showGoal ? `${goal.title} · ` : ""}
                {describeRecurrence(task.recurrence)}
                {remainingThisWeek !== null ? ` · ${remainingThisWeek} left this week` : ""}
              </span>
            </label>
            <span className="text-xs font-semibold text-yellow tabular">+{task.xpValue} XP</span>
          </li>
        );
      })}
    </ul>
  );
}

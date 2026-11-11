import { AlertTriangle, Rocket, TrendingDown, TrendingUp } from "lucide-react";
import type { PaceStatus } from "@/lib/engine/progress";
import { cn } from "@/lib/utils";

export const STATUS_META: Record<
  PaceStatus,
  { label: string; color: string; Icon: typeof Rocket }
> = {
  ahead: { label: "Ahead", color: "var(--yellow)", Icon: Rocket },
  on_track: { label: "On track", color: "var(--blue)", Icon: TrendingUp },
  behind: { label: "Behind", color: "var(--orange)", Icon: TrendingDown },
  at_risk: { label: "At risk", color: "var(--red)", Icon: AlertTriangle },
};

/** Status is never color-only: icon + text label + color. */
export function StatusPill({
  status,
  completed,
  className,
}: {
  status: PaceStatus;
  completed?: boolean;
  className?: string;
}) {
  const m = STATUS_META[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold whitespace-nowrap",
        className,
      )}
      style={{
        color: m.color,
        borderColor: `color-mix(in srgb, ${m.color} 40%, transparent)`,
        background: `color-mix(in srgb, ${m.color} 12%, transparent)`,
      }}
    >
      <m.Icon className="size-3.5" aria-hidden />
      {completed ? "Complete" : m.label}
    </span>
  );
}

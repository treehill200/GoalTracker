import * as React from "react";
import { cn } from "@/lib/utils";

export function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("animate-pulse rounded-md bg-surface-2", className)} aria-hidden {...props} />;
}

export function Pill({ className, ...props }: React.ComponentProps<"span">) {
  return <span className={cn("inline-flex items-center gap-1 rounded-full border border-border bg-surface-2 px-2 py-0.5 text-xs font-medium", className)} {...props} />;
}

export function Progress({ value, className, color = "var(--red)", label }: { value: number; className?: string; color?: string; label: string }) {
  const v = Math.max(0, Math.min(1, value));
  return (
    <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(v * 100)} className={cn("h-2 w-full overflow-hidden rounded-full bg-surface-3", className)}>
      <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${v * 100}%`, background: color }} />
    </div>
  );
}

export function EmptyState({ icon, title, body, action }: { icon: React.ReactNode; title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed border-border px-6 py-10 text-center">
      <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-surface-2 text-muted-foreground">{icon}</div>
      <h3 className="font-semibold">{title}</h3>
      <p className="text-muted-foreground mt-1 max-w-sm text-sm">{body}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">{children}</h2>
      {action}
    </div>
  );
}

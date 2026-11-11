import * as React from "react";
import { cn } from "@/lib/utils";

export function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("bg-surface-2 animate-pulse rounded-md", className)}
      aria-hidden
      {...props}
    />
  );
}

export function Pill({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "border-border bg-surface-2 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
        className,
      )}
      {...props}
    />
  );
}

export function Progress({
  value,
  className,
  color = "var(--red)",
  label,
}: {
  value: number;
  className?: string;
  color?: string;
  label: string;
}) {
  const v = Math.max(0, Math.min(1, value));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(v * 100)}
      className={cn("bg-surface-3 h-2 w-full overflow-hidden rounded-full", className)}
    >
      <div
        className="h-full rounded-full transition-[width] duration-700"
        style={{ width: `${v * 100}%`, background: color }}
      />
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="border-border flex flex-col items-center rounded-xl border border-dashed px-6 py-10 text-center">
      <div className="bg-surface-2 text-muted-foreground mb-3 flex size-12 items-center justify-center rounded-full">
        {icon}
      </div>
      <h3 className="font-semibold">{title}</h3>
      <p className="text-muted-foreground mt-1 max-w-sm text-sm">{body}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function SectionTitle({
  children,
  action,
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <h2 className="text-muted-foreground text-sm font-semibold tracking-wide uppercase">
        {children}
      </h2>
      {action}
    </div>
  );
}

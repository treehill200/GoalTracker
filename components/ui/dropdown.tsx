"use client";
import { DropdownMenu as M } from "radix-ui";
import * as React from "react";
import { cn } from "@/lib/utils";

export const DropdownMenu = M.Root;
export const DropdownMenuTrigger = M.Trigger;

export function DropdownMenuContent({
  className,
  ...props
}: React.ComponentProps<typeof M.Content>) {
  return (
    <M.Portal>
      <M.Content
        sideOffset={6}
        align="end"
        className={cn(
          "bg-popover border-border z-50 min-w-44 rounded-lg border p-1 shadow-xl",
          className,
        )}
        {...props}
      />
    </M.Portal>
  );
}

export function DropdownMenuItem({ className, ...props }: React.ComponentProps<typeof M.Item>) {
  return (
    <M.Item
      className={cn(
        "data-[highlighted]:bg-surface-3 flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-sm outline-none select-none [&_svg]:size-4",
        className,
      )}
      {...props}
    />
  );
}

export const DropdownMenuSeparator = (props: React.ComponentProps<typeof M.Separator>) => (
  <M.Separator className="bg-border my-1 h-px" {...props} />
);

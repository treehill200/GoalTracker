"use client";
import { CheckIcon } from "lucide-react";
import { Checkbox as C } from "radix-ui";
import * as React from "react";
import { cn } from "@/lib/utils";

export function Checkbox({ className, ...props }: React.ComponentProps<typeof C.Root>) {
  return (
    <C.Root
      className={cn(
        "border-muted-foreground/60 data-[state=checked]:border-red data-[state=checked]:bg-red flex size-6 shrink-0 items-center justify-center rounded-md border-2 transition",
        className,
      )}
      {...props}
    >
      <C.Indicator>
        <CheckIcon className="size-4 text-white" strokeWidth={3} />
      </C.Indicator>
    </C.Root>
  );
}

"use client";
import { Switch as S } from "radix-ui";
import * as React from "react";
import { cn } from "@/lib/utils";

export function Switch({ className, ...props }: React.ComponentProps<typeof S.Root>) {
  return (
    <S.Root className={cn("inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border border-border bg-surface-3 transition data-[state=checked]:border-blue data-[state=checked]:bg-blue", className)} {...props}>
      <S.Thumb className="block size-5 translate-x-0.5 rounded-full bg-white shadow transition data-[state=checked]:translate-x-[1.3rem]" />
    </S.Root>
  );
}

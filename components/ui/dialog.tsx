"use client";
import { XIcon } from "lucide-react";
import { Dialog as D } from "radix-ui";
import * as React from "react";
import { cn } from "@/lib/utils";

export const Dialog = D.Root;
export const DialogTrigger = D.Trigger;
export const DialogClose = D.Close;

/** Centered dialog on desktop, bottom sheet on mobile. */
export function DialogContent({
  className,
  children,
  title,
  description,
  ...props
}: React.ComponentProps<typeof D.Content> & { title: string; description?: string }) {
  return (
    <D.Portal>
      <D.Overlay className="data-[state=open]:animate-in fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" />
      <D.Content
        className={cn(
          "bg-surface-1 border-border fixed inset-x-0 bottom-0 z-50 max-h-[92dvh] overflow-y-auto rounded-t-2xl border p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl sm:inset-x-auto sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:w-full sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl",
          className,
        )}
        {...props}
      >
        <div className="bg-surface-3 mx-auto mb-3 h-1 w-10 rounded-full sm:hidden" aria-hidden />
        <div className="mb-4 pr-8">
          <D.Title className="text-lg font-semibold tracking-tight">{title}</D.Title>
          {description ? (
            <D.Description className="text-muted-foreground mt-1 text-sm">
              {description}
            </D.Description>
          ) : (
            <D.Description className="sr-only">{title}</D.Description>
          )}
        </div>
        {children}
        <D.Close
          className="text-muted-foreground hover:bg-surface-2 hover:text-foreground absolute top-4 right-4 rounded-md p-1.5"
          aria-label="Close"
        >
          <XIcon className="size-4" />
        </D.Close>
      </D.Content>
    </D.Portal>
  );
}

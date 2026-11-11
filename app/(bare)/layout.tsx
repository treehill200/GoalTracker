"use client";
import { StoreProvider } from "@/lib/store/store";
import { CelebrationLayer } from "@/components/celebrations";

/** Store without the navigation shell (onboarding). */
export default function BareLayout({ children }: { children: React.ReactNode }) {
  return (
    <StoreProvider fallback={<div className="text-muted-foreground p-8 text-center">Loading…</div>}>
      {children}
      <CelebrationLayer />
    </StoreProvider>
  );
}

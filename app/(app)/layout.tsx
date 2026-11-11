"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { AppShell, AppSkeleton } from "@/components/shell/app-shell";
import { StoreProvider, useStore } from "@/lib/store/store";

function OnboardingGate({ children }: { children: React.ReactNode }) {
  const { data } = useStore();
  const router = useRouter();
  useEffect(() => {
    if (!data.profile.onboarded) router.replace("/onboarding");
  }, [data.profile.onboarded, router]);
  return <>{children}</>;
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <StoreProvider fallback={<AppSkeleton />}>
      <OnboardingGate>
        <AppShell>{children}</AppShell>
      </OnboardingGate>
    </StoreProvider>
  );
}

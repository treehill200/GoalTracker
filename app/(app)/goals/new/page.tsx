"use client";
import { useRouter } from "next/navigation";
import { NewGoalFlow } from "@/components/goals/new-goal-flow";

export default function NewGoalPage() {
  const router = useRouter();
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">New goal</h1>
      <p className="text-sm text-muted-foreground">Pick how you want to turn your goal into numbers. You can mix methods in the editor.</p>
      <NewGoalFlow onCreated={(id) => router.push(`/goals/${id}`)} />
    </div>
  );
}

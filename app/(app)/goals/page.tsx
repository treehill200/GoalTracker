"use client";
import Link from "next/link";
import { Archive, Plus, Target } from "lucide-react";
import { useState } from "react";
import { useStore } from "@/lib/store/store";
import { GoalCard } from "@/components/goals/goal-card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function GoalsPage() {
  const { data, analyses, focusGoalId } = useStore();
  const [filter, setFilter] = useState("active");
  const goals = data.goals.filter((g) =>
    filter === "active" ? g.status === "active" || g.status === "paused" : g.status === filter,
  );
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Goals</h1>
        <Button asChild>
          <Link href="/goals/new">
            <Plus /> New goal
          </Link>
        </Button>
      </div>
      <Tabs value={filter} onValueChange={setFilter}>
        <TabsList>
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
          <TabsTrigger value="archived">Archived</TabsTrigger>
        </TabsList>
      </Tabs>
      {goals.length ? (
        <div className="grid gap-3 md:grid-cols-2">
          {goals.map((g) => {
            const a = analyses.get(g.id);
            return a ? <GoalCard key={g.id} goal={g} a={a} focus={g.id === focusGoalId} /> : null;
          })}
        </div>
      ) : (
        <EmptyState
          icon={filter === "archived" ? <Archive /> : <Target />}
          title={filter === "active" ? "No active goals" : `No ${filter} goals`}
          body={
            filter === "active"
              ? "Create a goal and the app turns it into numbers, a pace and a finish date."
              : "They'll show up here."
          }
          action={
            filter === "active" ? (
              <Button asChild>
                <Link href="/goals/new">Create a goal</Link>
              </Button>
            ) : undefined
          }
        />
      )}
    </div>
  );
}

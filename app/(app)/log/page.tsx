"use client";
import { useSearchParams } from "next/navigation";
import { CalendarCheck, ListChecks, Sparkles } from "lucide-react";
import { Suspense } from "react";
import { DailyCheckin } from "@/components/log/checkin";
import { NaturalLanguageLog } from "@/components/log/nl-log";
import { TodayTasks } from "@/components/goals/today-tasks";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

function LogTabs() {
  const tab = useSearchParams().get("tab") ?? "words";
  return (
    <Tabs defaultValue={tab}>
      <TabsList>
        <TabsTrigger value="words">
          <Sparkles /> In words
        </TabsTrigger>
        <TabsTrigger value="tasks">
          <ListChecks /> Tasks
        </TabsTrigger>
        <TabsTrigger value="checkin">
          <CalendarCheck /> Check-in
        </TabsTrigger>
      </TabsList>
      <TabsContent value="words">
        <Card>
          <NaturalLanguageLog />
        </Card>
      </TabsContent>
      <TabsContent value="tasks">
        <Card>
          <TodayTasks />
        </Card>
      </TabsContent>
      <TabsContent value="checkin">
        <DailyCheckin />
      </TabsContent>
    </Tabs>
  );
}

export default function LogPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Log progress</h1>
        <p className="text-muted-foreground text-sm">
          Use the red + button for a quick number. Works offline — logs sync when you&apos;re back
          online.
        </p>
      </div>
      <Suspense>
        <LogTabs />
      </Suspense>
    </div>
  );
}

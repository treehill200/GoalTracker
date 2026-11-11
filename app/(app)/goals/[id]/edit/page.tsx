"use client";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { bundleFor } from "@/lib/data/types";
import { draftFromBundle } from "@/lib/goal-drafts";
import { useStore } from "@/lib/store/store";
import { GoalEditor } from "@/components/goals/goal-editor";

export default function EditGoalPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data, actions, today } = useStore();
  const bundle = bundleFor(data, id);
  if (!bundle) return <p className="text-muted-foreground">Goal not found.</p>;
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">Edit goal</h1>
      <GoalEditor
        initial={draftFromBundle(bundle)}
        today={today}
        submitLabel="Save changes"
        onSubmit={async (d) => {
          await actions.updateGoalFromDraft(id, d);
          toast.success("Goal updated");
          router.push(`/goals/${id}`);
        }}
      />
    </div>
  );
}

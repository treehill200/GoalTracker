"use client";
/** Demo mode: pulls Apple Health webhook entries queued on the server into local data. */
import { useEffect } from "react";
import { toast } from "sonner";
import { useFeatures } from "@/lib/features";
import { useStore } from "@/lib/store/store";

export function WebhookInbox() {
  const features = useFeatures();
  const { data, actions } = useStore();
  const secret = data.integrations.find((i) => i.provider === "apple_health")?.webhookSecret ?? null;
  useEffect(() => {
    if (!features.demo || !secret) return;
    const poll = async () => {
      try {
        const res = await fetch(`/api/integrations/health/inbox/${secret}`);
        const { items } = (await res.json()) as { items: { metric: string; value: number; date: string }[] };
        const entries = items
          .map((i) => {
            const m = data.metrics.find((x) => x.id === i.metric || x.name.toLowerCase() === i.metric.toLowerCase());
            return m ? { metricId: m.id, value: i.value, date: i.date, source: "webhook" as const, note: "iOS Shortcut" } : null;
          })
          .filter((x): x is NonNullable<typeof x> => x !== null);
        if (entries.length) {
          await actions.logEntries(entries, { xp: false });
          toast.success(`Received ${entries.length} entr${entries.length === 1 ? "y" : "ies"} from your iOS Shortcut`);
        }
      } catch {
        /* offline */
      }
    };
    void poll();
    const id = setInterval(poll, 30_000);
    return () => clearInterval(id);
  }, [features.demo, secret, data.metrics, actions]);
  return null;
}

"use client";
import { Download, Share2 } from "lucide-react";
import { useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { fmtDate } from "@/lib/utils";

export interface ShareCardData {
  title: string;
  startDate: string;
  completedOn: string;
  days: number;
  logs: number;
  level: number;
  streak: number;
}

/** Shareable "goal complete" card rendered as SVG, exportable to PNG. */
export function ShareCard({ data }: { data: ShareCardData }) {
  const ref = useRef<SVGSVGElement>(null);

  async function toPng(): Promise<Blob | null> {
    const svg = ref.current;
    if (!svg) return null;
    const xml = new XMLSerializer().serializeToString(svg);
    const img = new Image();
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`;
    await img.decode();
    const canvas = document.createElement("canvas");
    canvas.width = 1080;
    canvas.height = 1350;
    canvas.getContext("2d")!.drawImage(img, 0, 0, 1080, 1350);
    return new Promise((res) => canvas.toBlob(res, "image/png"));
  }

  async function share() {
    const blob = await toPng();
    if (!blob) return;
    const file = new File([blob], "goal-complete.png", { type: "image/png" });
    if (navigator.canShare?.({ files: [file] })) {
      await navigator
        .share({
          files: [file],
          title: "Goal complete!",
          text: `I just completed "${data.title}" 🎉`,
        })
        .catch(() => undefined);
    } else download(blob);
  }

  function download(blob: Blob) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "goal-complete.png";
    a.click();
    URL.revokeObjectURL(a.href);
    toast.success("Card saved");
  }

  const title = data.title.length > 34 ? `${data.title.slice(0, 33)}…` : data.title;
  return (
    <div className="flex flex-col items-center gap-3">
      <svg
        ref={ref}
        viewBox="0 0 1080 1350"
        className="w-full max-w-[300px] rounded-xl shadow-2xl"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label={`Goal complete card for ${data.title}`}
      >
        <defs>
          <linearGradient id="sc-bg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#141416" />
            <stop offset="1" stopColor="#0A0A0B" />
          </linearGradient>
          <linearGradient id="sc-ring" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#E5484D" />
            <stop offset="1" stopColor="#F5C542" />
          </linearGradient>
        </defs>
        <rect width="1080" height="1350" fill="url(#sc-bg)" />
        <circle cx="540" cy="470" r="230" fill="none" stroke="#26262a" strokeWidth="44" />
        <circle
          cx="540"
          cy="470"
          r="230"
          fill="none"
          stroke="url(#sc-ring)"
          strokeWidth="44"
          strokeLinecap="round"
        />
        <text
          x="540"
          y="500"
          textAnchor="middle"
          fontSize="150"
          fontWeight="800"
          fill="#F4F4F5"
          fontFamily="system-ui, sans-serif"
        >
          100
        </text>
        <text
          x="540"
          y="560"
          textAnchor="middle"
          fontSize="34"
          fill="#A1A1AA"
          fontFamily="system-ui, sans-serif"
          letterSpacing="6"
        >
          GOAL SCORE
        </text>
        <text
          x="540"
          y="130"
          textAnchor="middle"
          fontSize="44"
          fontWeight="700"
          fill="#F5C542"
          fontFamily="system-ui, sans-serif"
          letterSpacing="8"
        >
          GOAL COMPLETE
        </text>
        <text
          x="540"
          y="820"
          textAnchor="middle"
          fontSize="58"
          fontWeight="800"
          fill="#F4F4F5"
          fontFamily="system-ui, sans-serif"
        >
          {title}
        </text>
        <text
          x="540"
          y="880"
          textAnchor="middle"
          fontSize="32"
          fill="#A1A1AA"
          fontFamily="system-ui, sans-serif"
        >
          {fmtDate(data.startDate)} → {fmtDate(data.completedOn)}
        </text>
        {[
          ["DAYS", data.days],
          ["LOGS", data.logs],
          ["LEVEL", data.level],
        ].map(([label, value], i) => (
          <g key={label} transform={`translate(${200 + i * 340}, 1030)`}>
            <text
              textAnchor="middle"
              fontSize="80"
              fontWeight="800"
              fill={["#E5484D", "#3E8EF7", "#F5C542"][i]}
              fontFamily="system-ui, sans-serif"
            >
              {value}
            </text>
            <text
              y="56"
              textAnchor="middle"
              fontSize="28"
              fill="#A1A1AA"
              fontFamily="system-ui, sans-serif"
              letterSpacing="4"
            >
              {label}
            </text>
          </g>
        ))}
        <text
          x="540"
          y="1260"
          textAnchor="middle"
          fontSize="30"
          fill="#71717A"
          fontFamily="system-ui, sans-serif"
        >
          Tracked with Goal Tracker
        </text>
      </svg>
      <div className="flex gap-2">
        <Button onClick={share}>
          <Share2 /> Share
        </Button>
        <Button
          variant="secondary"
          onClick={async () => {
            const b = await toPng();
            if (b) download(b);
          }}
        >
          <Download /> Save image
        </Button>
      </div>
    </div>
  );
}

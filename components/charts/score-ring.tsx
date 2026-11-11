"use client";
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "framer-motion";
import { useEffect, useState } from "react";

/**
 * Custom SVG progress ring with an animated sweep and count-up number.
 * Shows actual score plus a thin "expected" marker on the track.
 */
export function ScoreRing({
  value,
  expected,
  size = 160,
  stroke = 14,
  color = "var(--red)",
  label = "Goal score",
  sublabel,
}: {
  value: number; // 0–100
  expected?: number; // 0–100
  size?: number;
  stroke?: number;
  color?: string;
  label?: string;
  sublabel?: string;
}) {
  const reduce = useReducedMotion();
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const progress = useMotionValue(reduce ? value : 0);
  const dash = useTransform(progress, (v) => c * (1 - Math.max(0, Math.min(100, v)) / 100));
  const [shown, setShown] = useState(reduce ? Math.round(value) : 0);

  useEffect(() => {
    const controls = animate(progress, value, { duration: reduce ? 0 : 1.2, ease: [0.16, 1, 0.3, 1], onUpdate: (v) => setShown(Math.round(v)) });
    return () => controls.stop();
  }, [value, progress, reduce]);

  const marker = expected !== undefined ? (Math.max(0, Math.min(100, expected)) / 100) * 360 - 90 : null;
  const gradId = `ring-${size}-${label.replace(/\W/g, "")}`;
  const small = size < 90;

  return (
    <div className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }} role="img" aria-label={`${label}: ${Math.round(value)} out of 100${expected !== undefined ? `, expected ${Math.round(expected)}` : ""}`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={color} />
            <stop offset="100%" stopColor="var(--yellow-fill)" stopOpacity={0.9} />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          style={{ strokeDashoffset: dash, filter: small ? undefined : `drop-shadow(0 0 8px color-mix(in srgb, ${color} 55%, transparent))` }}
        />
      </svg>
      {marker !== null && !small ? (
        <div className="absolute inset-0" style={{ transform: `rotate(${marker + 90}deg)` }} aria-hidden>
          <div className="absolute left-1/2 h-[18px] w-[3px] -translate-x-1/2 rounded-full bg-foreground/80" style={{ top: stroke / 2 - 9 + 0 }} title="Expected" />
        </div>
      ) : null}
      <div className="absolute flex flex-col items-center leading-none">
        <span className={small ? "text-sm font-bold tabular" : "text-4xl font-bold tracking-tight tabular"}>{shown}</span>
        {!small ? <span className="text-muted-foreground mt-1 text-[11px] font-medium tracking-wide uppercase">{sublabel ?? label}</span> : null}
      </div>
    </div>
  );
}

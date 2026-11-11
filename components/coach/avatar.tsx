"use client";
/**
 * Original animated SVG coach avatars. Each persona has its own body shape;
 * the face, glow color and motion change with mood.
 */
import { motion, useReducedMotion, type TargetAndTransition, type Transition } from "framer-motion";
import { getPersona, type CoachId } from "@/lib/coach/personas";
import type { CoachMood } from "@/lib/data/types";
import { cn } from "@/lib/utils";

export const MOOD_GLOW: Record<CoachMood, string> = {
  ecstatic: "#F5C542",
  happy: "#3E8EF7",
  neutral: "#8B8B93",
  worried: "#F76B15",
  sad: "#6B7AA1",
};

export const MOOD_LABEL: Record<CoachMood, string> = {
  ecstatic: "Ecstatic",
  happy: "Happy",
  neutral: "Neutral",
  worried: "Worried",
  sad: "Sad",
};

const MOTION: Record<CoachMood, { animate: TargetAndTransition; transition: Transition }> = {
  ecstatic: { animate: { y: [0, -10, 0], rotate: [0, -6, 6, 0] }, transition: { duration: 0.9, repeat: Infinity, ease: "easeInOut" } },
  happy: { animate: { y: [0, -4, 0] }, transition: { duration: 1.8, repeat: Infinity, ease: "easeInOut" } },
  neutral: { animate: { scale: [1, 1.02, 1] }, transition: { duration: 3.2, repeat: Infinity, ease: "easeInOut" } },
  worried: { animate: { x: [0, -2, 2, -2, 0] }, transition: { duration: 2.4, repeat: Infinity, ease: "easeInOut", repeatDelay: 0.8 } },
  sad: { animate: { y: [3, 5, 3], scaleY: [0.96, 0.94, 0.96] }, transition: { duration: 4, repeat: Infinity, ease: "easeInOut" } },
};

function Body({ coach, mood }: { coach: CoachId; mood: CoachMood }) {
  const p = getPersona(coach);
  const dim = mood === "sad" ? 0.75 : 1;
  switch (coach) {
    case "blaze":
      return (
        <g opacity={dim}>
          <defs>
            <linearGradient id="blaze-grad" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor="#E5484D" />
              <stop offset="70%" stopColor="#F76B15" />
              <stop offset="100%" stopColor="#F5C542" />
            </linearGradient>
          </defs>
          {/* flame body */}
          <path d="M60 10 C70 28 92 36 92 68 C92 92 78 106 60 106 C42 106 28 92 28 68 C28 50 40 44 44 30 C48 40 52 42 56 40 C56 30 56 20 60 10 Z" fill="url(#blaze-grad)" />
          <path d="M60 52 C66 62 76 66 76 80 C76 92 69 100 60 100 C51 100 44 92 44 80 C44 72 50 68 52 60 C55 64 58 62 60 52 Z" fill="#F5C542" opacity={0.35} />
        </g>
      );
    case "sage":
      return (
        <g opacity={dim}>
          {/* sprout */}
          <path d="M60 24 C60 16 66 10 74 10 C74 18 68 24 60 24 Z" fill="#7DD3A0" />
          <path d="M60 24 C60 18 55 13 48 13 C48 19 53 24 60 24 Z" fill="#5BBF86" />
          <rect x="58.5" y="22" width="3" height="10" rx="1.5" fill="#5BBF86" />
          {/* round body */}
          <ellipse cx="60" cy="70" rx="38" ry="38" fill={p.color} />
          <ellipse cx="60" cy="88" rx="26" ry="16" fill="#9BC2FF" opacity={0.35} />
        </g>
      );
    case "sarge":
      return (
        <g opacity={dim}>
          <rect x="22" y="36" width="76" height="70" rx="20" fill={p.color} />
          {/* cap */}
          <path d="M24 44 C24 26 42 18 60 18 C78 18 96 26 96 44 Z" fill="#6B7A3A" />
          <rect x="18" y="42" width="84" height="8" rx="4" fill="#556130" />
          <circle cx="60" cy="31" r="5" fill="#F5C542" />
          {/* chin strap shading */}
          <rect x="36" y="92" width="48" height="6" rx="3" fill="#0A0A0B" opacity={0.15} />
        </g>
      );
    case "pip":
      return (
        <g opacity={dim}>
          {/* pom-poms */}
          <circle cx="18" cy="76" r="12" fill="#E5484D" />
          <circle cx="102" cy="76" r="12" fill="#E5484D" />
          {/* star-blob body */}
          <path d="M60 14 L72 38 L98 42 L80 62 L86 92 L60 80 L34 92 L40 62 L22 42 L48 38 Z" fill={p.color} stroke={p.color} strokeWidth="14" strokeLinejoin="round" />
        </g>
      );
  }
}

function Face({ mood, coach }: { mood: CoachMood; coach: CoachId }) {
  const ink = "#0A0A0B";
  const ey = coach === "sarge" ? 66 : coach === "blaze" ? 70 : 64;
  const my = ey + 16;
  return (
    <g>
      {/* eyes */}
      {mood === "ecstatic" ? (
        <>
          <path d={`M40 ${ey + 2} Q46 ${ey - 6} 52 ${ey + 2}`} stroke={ink} strokeWidth="4" fill="none" strokeLinecap="round" />
          <path d={`M68 ${ey + 2} Q74 ${ey - 6} 80 ${ey + 2}`} stroke={ink} strokeWidth="4" fill="none" strokeLinecap="round" />
        </>
      ) : mood === "sad" ? (
        <>
          <path d={`M40 ${ey} Q46 ${ey + 5} 52 ${ey}`} stroke={ink} strokeWidth="4" fill="none" strokeLinecap="round" />
          <path d={`M68 ${ey} Q74 ${ey + 5} 80 ${ey}`} stroke={ink} strokeWidth="4" fill="none" strokeLinecap="round" />
          <path d={`M38 ${ey - 9} L50 ${ey - 5}`} stroke={ink} strokeWidth="3" strokeLinecap="round" />
          <path d={`M82 ${ey - 9} L70 ${ey - 5}`} stroke={ink} strokeWidth="3" strokeLinecap="round" />
        </>
      ) : (
        <>
          <ellipse cx="46" cy={ey} rx="5" ry={mood === "neutral" ? 5.5 : 6.5} fill={ink} />
          <ellipse cx="74" cy={ey} rx="5" ry={mood === "neutral" ? 5.5 : 6.5} fill={ink} />
          <circle cx="47.6" cy={ey - 2.2} r="1.8" fill="#fff" />
          <circle cx="75.6" cy={ey - 2.2} r="1.8" fill="#fff" />
          {mood === "worried" ? (
            <>
              <path d={`M38 ${ey - 12} L52 ${ey - 9}`} stroke={ink} strokeWidth="3" strokeLinecap="round" />
              <path d={`M82 ${ey - 12} L68 ${ey - 9}`} stroke={ink} strokeWidth="3" strokeLinecap="round" />
            </>
          ) : null}
          {coach === "sarge" && mood !== "worried" ? (
            <>
              <path d={`M38 ${ey - 10} L52 ${ey - 8}`} stroke={ink} strokeWidth="3.5" strokeLinecap="round" />
              <path d={`M82 ${ey - 10} L68 ${ey - 8}`} stroke={ink} strokeWidth="3.5" strokeLinecap="round" />
            </>
          ) : null}
        </>
      )}
      {/* mouth */}
      {mood === "ecstatic" ? (
        <path d={`M44 ${my - 2} Q60 ${my + 18} 76 ${my - 2} Z`} fill={ink} />
      ) : mood === "happy" ? (
        <path d={`M46 ${my} Q60 ${my + 11} 74 ${my}`} stroke={ink} strokeWidth="4" fill="none" strokeLinecap="round" />
      ) : mood === "neutral" ? (
        <path d={`M50 ${my + 3} L70 ${my + 3}`} stroke={ink} strokeWidth="4" strokeLinecap="round" />
      ) : mood === "worried" ? (
        <path d={`M48 ${my + 5} Q54 ${my} 60 ${my + 5} Q66 ${my + 10} 72 ${my + 5}`} stroke={ink} strokeWidth="3.5" fill="none" strokeLinecap="round" />
      ) : (
        <path d={`M48 ${my + 9} Q60 ${my - 1} 72 ${my + 9}`} stroke={ink} strokeWidth="4" fill="none" strokeLinecap="round" />
      )}
      {/* cheeks */}
      {mood === "ecstatic" || mood === "happy" ? (
        <>
          <ellipse cx="36" cy={ey + 10} rx="5" ry="3" fill="#FF8FA3" opacity={0.7} />
          <ellipse cx="84" cy={ey + 10} rx="5" ry="3" fill="#FF8FA3" opacity={0.7} />
        </>
      ) : null}
    </g>
  );
}

export function CoachAvatar({ coach, mood, size = 96, className, animate = true }: { coach: CoachId; mood: CoachMood; size?: number; className?: string; animate?: boolean }) {
  const reduce = useReducedMotion();
  const glow = MOOD_GLOW[mood];
  const m = MOTION[mood];
  const live = animate && !reduce;
  const persona = getPersona(coach);
  return (
    <div className={cn("relative inline-flex shrink-0 items-center justify-center", className)} style={{ width: size, height: size }} role="img" aria-label={`${persona.name} looks ${MOOD_LABEL[mood].toLowerCase()}`}>
      <motion.div
        className="absolute inset-0 rounded-full"
        style={{ background: `radial-gradient(circle, ${glow}55 0%, ${glow}00 70%)` }}
        animate={live ? { opacity: mood === "sad" ? [0.4, 0.55, 0.4] : [0.7, 1, 0.7], scale: [0.95, 1.05, 0.95] } : undefined}
        transition={{ duration: mood === "ecstatic" ? 1 : 3, repeat: Infinity }}
      />
      <motion.svg viewBox="0 0 120 120" width={size} height={size} className="relative" animate={live ? m.animate : undefined} transition={m.transition} aria-hidden>
        <Body coach={coach} mood={mood} />
        <Face coach={coach} mood={mood} />
        {mood === "sad" ? (
          <motion.path
            d="M80 74 C80 74 76 80 76 83 C76 85.2 77.8 87 80 87 C82.2 87 84 85.2 84 83 C84 80 80 74 80 74 Z"
            fill="#9BC2FF"
            animate={live ? { y: [0, 14], opacity: [0, 1, 0] } : undefined}
            transition={{ duration: 2.4, repeat: Infinity, ease: "easeIn" }}
          />
        ) : null}
        {mood === "ecstatic" ? (
          <g fill="#F5C542">
            <motion.path d="M14 20 l3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3z" animate={live ? { scale: [0.6, 1.1, 0.6], opacity: [0.4, 1, 0.4] } : undefined} transition={{ duration: 1.2, repeat: Infinity }} style={{ transformOrigin: "14px 30px" }} />
            <motion.path d="M104 14 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2z" animate={live ? { scale: [1, 0.5, 1], opacity: [1, 0.4, 1] } : undefined} transition={{ duration: 1.4, repeat: Infinity }} style={{ transformOrigin: "104px 21px" }} />
          </g>
        ) : null}
      </motion.svg>
    </div>
  );
}

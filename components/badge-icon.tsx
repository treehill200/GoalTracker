import {
  Brain, CalendarCheck, Crown, Database, Flag, Flame, Footprints, Gift, Layers, LifeBuoy, ListChecks, MessageCircleHeart,
  Moon, Mountain, NotebookPen, PartyPopper, Plug, Rocket, RotateCcw, Sparkles, Star, Sunrise, Trophy, type LucideIcon,
} from "lucide-react";
import type { BadgeTier } from "@/lib/engine/badges";
import { cn } from "@/lib/utils";

const ICONS: Record<string, LucideIcon> = {
  Brain, CalendarCheck, Crown, Database, Flag, Flame, Footprints, Gift, Layers, LifeBuoy, ListChecks, MessageCircleHeart,
  Moon, Mountain, NotebookPen, PartyPopper, Plug, Rocket, RotateCcw, Sparkles, Star, Sunrise, Trophy,
};

const TIER: Record<BadgeTier, { ring: string; fill: string }> = {
  bronze: { ring: "#C2793D", fill: "#2A1D14" },
  silver: { ring: "#3E8EF7", fill: "#13213A" },
  gold: { ring: "#F5C542", fill: "#2E2510" },
  epic: { ring: "#E5484D", fill: "#2E1214" },
};

/** Original hexagon badge frame with a lucide icon inside. */
export function BadgeIcon({ icon, tier, locked, size = 56, className }: { icon: string; tier: BadgeTier; locked?: boolean; size?: number; className?: string }) {
  const Icon = ICONS[icon] ?? Star;
  const t = TIER[tier];
  return (
    <div className={cn("relative inline-flex items-center justify-center", locked && "opacity-35 grayscale", className)} style={{ width: size, height: size }} aria-hidden>
      <svg viewBox="0 0 56 56" width={size} height={size} className="absolute inset-0">
        <path d="M28 3 L50 15.5 L50 40.5 L28 53 L6 40.5 L6 15.5 Z" fill={t.fill} stroke={t.ring} strokeWidth="3" strokeLinejoin="round" />
        <path d="M28 9 L45 18.5 L45 37.5 L28 47 L11 37.5 L11 18.5 Z" fill="none" stroke={t.ring} strokeOpacity="0.3" strokeWidth="1.5" />
      </svg>
      <Icon className="relative" style={{ color: t.ring, width: size * 0.4, height: size * 0.4 }} />
    </div>
  );
}

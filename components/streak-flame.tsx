"use client";
import { motion, useReducedMotion } from "framer-motion";

/** Original flame icon; flickers when today's streak is secured. */
export function StreakFlame({ active, size = 20 }: { active: boolean; size?: number }) {
  const reduce = useReducedMotion();
  return (
    <motion.svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden
      animate={active && !reduce ? { scale: [1, 1.12, 1], rotate: [0, -4, 3, 0] } : undefined}
      transition={{ duration: 1.6, repeat: Infinity }}
    >
      <path
        d="M12 2c1.5 3 5 5 5 10a5 5 0 0 1-10 0c0-2.5 1.2-3.8 2-5 .3 1.5 1 2.2 1.8 2.4C10.5 7 11 4.5 12 2Z"
        fill={active ? "#F5C542" : "#52525B"}
      />
      <path
        d="M12 11c.8 1.5 2.5 2.4 2.5 4.6a2.5 2.5 0 0 1-5 0c0-1.3.7-2 1.2-2.8.2.6.5.9.9 1 .2-1.2.2-2 .4-2.8Z"
        fill={active ? "#E5484D" : "#3F3F46"}
      />
    </motion.svg>
  );
}

"use client";
import { useReducedMotion } from "framer-motion";
import { useEffect, useRef } from "react";

const COLORS = ["#E5484D", "#3E8EF7", "#F5C542", "#FFFFFF", "#F76B15"];

/** Lightweight canvas particle burst (original, no library). Skipped for reduced motion. */
export function ConfettiBurst({ count = 140, duration = 2600 }: { count?: number; duration?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const reduce = useReducedMotion();
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || reduce || document.documentElement.classList.contains("reduce-motion")) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const w = (canvas.width = window.innerWidth * dpr);
    const h = (canvas.height = window.innerHeight * dpr);
    const parts = Array.from({ length: count }, () => {
      const angle = Math.random() * Math.PI * 2;
      const speed = (6 + Math.random() * 10) * dpr;
      return {
        x: w / 2,
        y: h * 0.42,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 6 * dpr,
        size: (4 + Math.random() * 6) * dpr,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.4,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        shape: Math.random() < 0.3 ? "circle" : "rect",
      };
    });
    const start = performance.now();
    let raf = 0;
    const frame = (t: number) => {
      const p = (t - start) / duration;
      ctx.clearRect(0, 0, w, h);
      for (const q of parts) {
        q.vy += 0.35 * dpr;
        q.vx *= 0.985;
        q.x += q.vx;
        q.y += q.vy;
        q.rot += q.vr;
        ctx.save();
        ctx.globalAlpha = Math.max(0, 1 - p);
        ctx.translate(q.x, q.y);
        ctx.rotate(q.rot);
        ctx.fillStyle = q.color;
        if (q.shape === "circle") {
          ctx.beginPath();
          ctx.arc(0, 0, q.size / 2, 0, Math.PI * 2);
          ctx.fill();
        } else ctx.fillRect(-q.size / 2, -q.size / 4, q.size, q.size / 2);
        ctx.restore();
      }
      if (p < 1) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [count, duration, reduce]);
  return <canvas ref={ref} className="pointer-events-none fixed inset-0 z-[60] h-full w-full" aria-hidden />;
}

"use client";

import { useEffect, useRef } from "react";

type Ember = { x: number; y: number; r: number; vy: number; vx: number; a: number; phase: number };

// Slow-rising specks of light. Paused while off-screen or when the user prefers reduced motion.
export function Embers({ count = 60, className }: { count?: number; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = 0;
    let h = 0;
    let embers: Ember[] = [];
    let raf = 0;

    const spawn = (anywhere: boolean): Ember => ({
      x: Math.random() * w,
      y: anywhere ? Math.random() * h : h + 4,
      r: 0.4 + Math.random() * 1.1,
      vy: 0.12 + Math.random() * 0.3,
      vx: (Math.random() - 0.5) * 0.12,
      a: 0.25 + Math.random() * 0.55,
      phase: Math.random() * Math.PI * 2,
    });

    const resize = () => {
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      embers = Array.from({ length: count }, () => spawn(true));
    };

    const tick = (t: number) => {
      ctx.clearRect(0, 0, w, h);
      for (let i = 0; i < embers.length; i++) {
        const e = embers[i]!;
        e.y -= e.vy;
        e.x += e.vx + Math.sin(t / 2400 + e.phase) * 0.08;
        if (e.y < -4) embers[i] = spawn(false);
        const fade = Math.min(1, e.y / (h * 0.6));
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 140, 90, ${e.a * fade})`;
        ctx.fill();
      }
      raf = requestAnimationFrame(tick);
    };

    const io = new IntersectionObserver(([entry]) => {
      cancelAnimationFrame(raf);
      if (entry?.isIntersecting) raf = requestAnimationFrame(tick);
    });

    resize();
    io.observe(canvas);
    window.addEventListener("resize", resize);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      window.removeEventListener("resize", resize);
    };
  }, [count]);

  return <canvas ref={ref} aria-hidden className={className} />;
}

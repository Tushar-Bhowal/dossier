"use client";

import { useRef } from "react";
import { cn } from "@/lib/utils";

// Tracks the pointer in CSS variables instead of state so hovering never re-renders the card.
export function SpotlightCard({
  children,
  className,
  brand = false,
}: {
  children: React.ReactNode;
  className?: string;
  brand?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty("--x", `${e.clientX - rect.left}px`);
    el.style.setProperty("--y", `${e.clientY - rect.top}px`);
  }

  return (
    <div
      ref={ref}
      onPointerMove={onPointerMove}
      className={cn(
        "group/spot relative overflow-hidden rounded-lg border transition-colors duration-300",
        brand
          ? "border-[#ff6a4a]/40 bg-[#dc3019] shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_30px_80px_-30px_rgba(251,65,40,0.7)]"
          : "border-white/[0.08] bg-[#0f0f0f] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] hover:border-white/[0.14]",
        className,
      )}
      style={
        brand
          ? {
              backgroundImage:
                "radial-gradient(120% 90% at 100% 0%, rgba(255,160,90,0.45), transparent 55%), linear-gradient(160deg, #e8401f, #b9260f)",
            }
          : {
              backgroundImage:
                "radial-gradient(100% 70% at 50% 0%, rgba(251,65,40,0.09), transparent 60%), linear-gradient(180deg, rgba(255,255,255,0.03), transparent)",
            }
      }
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover/spot:opacity-100"
        style={{
          background: `radial-gradient(420px circle at var(--x, 50%) var(--y, 50%), ${
            brand ? "rgba(255,255,255,0.12)" : "rgba(251,65,40,0.12)"
          }, transparent 60%)`,
        }}
      />
      {children}
    </div>
  );
}

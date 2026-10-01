"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Step {
  label: string;
  done: boolean;
}

// Stays pinned under the header so the user always knows how much is left — the thing a pure
// chat hides.
export function Steps({ steps }: { steps: Step[] }) {
  const current = steps.findIndex((s) => !s.done);
  return (
    <nav
      aria-label="Progress"
      className="sticky top-(--app-header-height,4rem) z-10 -mx-4 bg-background/85 px-4 py-3 backdrop-blur-xl md:-mx-8 md:px-8"
    >
      <ol className="mx-auto flex max-w-3xl items-center gap-2">
        {steps.map((step, i) => {
          const isCurrent = i === current;
          return (
            <li key={step.label} className={cn("flex items-center gap-2", i < steps.length - 1 && "flex-1")}>
              <span
                aria-current={isCurrent ? "step" : undefined}
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums",
                  step.done
                    ? "bg-emerald-500/15 text-emerald-300"
                    : isCurrent
                      ? "bg-[#dc3019] text-white shadow-[0_0_0_4px_rgba(251,65,40,0.18)]"
                      : "border border-white/15 text-white/45",
                )}
              >
                {step.done ? <Check className="size-3.5" strokeWidth={3} aria-hidden /> : i + 1}
              </span>
              <span
                className={cn(
                  "whitespace-nowrap text-[13px] font-semibold",
                  step.done ? "text-white/55" : isCurrent ? "text-white" : "text-white/40",
                  !isCurrent && "hidden sm:inline",
                )}
              >
                {step.label}
                <span className="sr-only">{step.done ? " (done)" : isCurrent ? " (current)" : ""}</span>
              </span>
              {i < steps.length - 1 && (
                <span className={cn("h-px min-w-3 flex-1", step.done ? "bg-emerald-500/30" : "bg-white/10")} aria-hidden />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

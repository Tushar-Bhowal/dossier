"use client";

import * as React from "react";
import { AlertCircle, Clock, LoaderCircle, RefreshCcw } from "lucide-react";
import { ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Step messages advance on a timer while one AI call runs, so a slow response never looks frozen.
export function AiProgress({ steps, className }: { steps: string[]; className?: string }) {
  const [index, setIndex] = React.useState(0);
  const [slow, setSlow] = React.useState(false);

  React.useEffect(() => {
    const step = window.setInterval(() => setIndex((i) => Math.min(i + 1, steps.length - 1)), 1400);
    const slowTimer = window.setTimeout(() => setSlow(true), 8000);
    return () => {
      window.clearInterval(step);
      window.clearTimeout(slowTimer);
    };
  }, [steps.length]);

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex flex-col gap-4 rounded-lg border border-white/[0.08] bg-[#111111] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]",
        className,
      )}
    >
      <ol className="flex flex-col gap-3">
        {steps.map((label, i) => (
          <li
            key={label}
            className={cn(
              "flex items-center gap-3 text-[15px] font-medium transition-colors",
              i < index ? "text-white/45" : i === index ? "text-white" : "text-white/30",
            )}
          >
            <span className="flex size-6 shrink-0 items-center justify-center">
              {i === index ? (
                <LoaderCircle className="size-[18px] animate-spin text-[#ff7a5c]" aria-hidden />
              ) : (
                <span className={cn("size-2 rounded-full", i < index ? "bg-emerald-400" : "bg-white/20")} />
              )}
            </span>
            {label}
          </li>
        ))}
      </ol>
      {slow && (
        <p className="flex items-center gap-2 text-sm font-medium text-white/60">
          <Clock className="size-4" aria-hidden />
          This is taking longer than usual. Hang on — nothing you typed is lost.
        </p>
      )}
    </div>
  );
}

export function describeAiError(error: unknown): { title: string; body: string } {
  if (error instanceof ApiError) {
    if (error.code === "quota_exceeded") {
      return {
        title: "Today's free AI requests are used up",
        body: "They reset at midnight UTC. You can still edit and download anything you've already made.",
      };
    }
    if (error.code === "llm_unavailable") {
      return {
        title: "Our AI isn't responding right now",
        body: "Nothing you typed is lost. Try again in a moment.",
      };
    }
    if (error.code === "validation_error") return { title: "Something needs fixing", body: error.message };
    if (error.code === "not_found") return { title: "We couldn't find that", body: "It may have been deleted." };
  }
  return { title: "Something went wrong", body: "Please try again." };
}

export function AiErrorNotice({
  error,
  onRetry,
  className,
}: {
  error: unknown;
  onRetry?: () => void;
  className?: string;
}) {
  const { title, body } = describeAiError(error);
  const isQuota = error instanceof ApiError && error.code === "quota_exceeded";

  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col gap-3 rounded-lg border p-5 sm:flex-row sm:items-center sm:justify-between",
        isQuota ? "border-amber-500/30 bg-amber-500/10" : "border-destructive/35 bg-destructive/10",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <AlertCircle className={cn("mt-0.5 size-5 shrink-0", isQuota ? "text-amber-300" : "text-destructive")} aria-hidden />
        <div>
          <p className="text-[15px] font-semibold text-white">{title}</p>
          <p className="mt-1 text-sm leading-relaxed text-white/70">{body}</p>
        </div>
      </div>
      {onRetry && !isQuota && (
        <Button variant="outline" onClick={onRetry} className="shrink-0">
          <RefreshCcw className="size-4" />
          Try again
        </Button>
      )}
    </div>
  );
}

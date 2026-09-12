"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { ArrowUpRight, Clock, RefreshCw, AlertCircle, CheckCircle2 } from "lucide-react";
import type { ActiveRun } from "@/hooks/use-active-runs";
import { useActiveRuns } from "@/hooks/use-active-runs";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { STEP_LABELS } from "@/components/run/StepList";
import { cn } from "@/lib/utils";

interface GeneratingKitCardProps {
  run: ActiveRun;
  queuePosition?: number;
  className?: string;
}

function formatElapsed(startedAtMs: number): string {
  const elapsedSec = Math.max(0, Math.floor((Date.now() - startedAtMs) / 1000));
  if (elapsedSec < 60) return `${elapsedSec}s`;
  const min = Math.floor(elapsedSec / 60);
  const sec = elapsedSec % 60;
  return `${min}m ${sec}s`;
}

export function GeneratingKitCard({ run, queuePosition, className }: GeneratingKitCardProps) {
  const { resumeActiveRun, removeRun } = useActiveRuns();
  const [elapsed, setElapsed] = React.useState(() => formatElapsed(run.createdAt));
  const [isResuming, setIsResuming] = React.useState(false);

  React.useEffect(() => {
    if (run.status !== "running" && run.status !== "queued") return;
    const timer = setInterval(() => {
      setElapsed(formatElapsed(run.createdAt));
    }, 1000);
    return () => clearInterval(timer);
  }, [run.createdAt, run.status]);

  const handleResume = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResuming(true);
    try {
      await resumeActiveRun(run.id);
    } finally {
      setIsResuming(false);
    }
  };

  const percent = run.stepsTotal > 0 ? Math.round((run.stepsSettled / run.stepsTotal) * 100) : 0;
  // No step is marked `running` in the brief gap between one finishing and the next starting, so
  // fall back on whether anything has settled yet — "Starting generation…" next to "6/9" is a
  // contradiction the user reads as a stuck card.
  const currentStepLabel = run.currentStep
    ? (STEP_LABELS[run.currentStep] ?? run.currentStep)
    : run.stepsSettled > 0
      ? "Working…"
      : "Starting generation…";

  // Stopped without a kit. `partial` lands here too: the server ends a run that way when it hits
  // its time budget with steps still pending, which is terminal until someone resumes it — so it
  // needs the same resume affordance as a hard failure, not a progress card that never advances.
  if (run.status === "failed" || run.status === "partial") {
    const isIncomplete = run.status === "partial";
    return (
      <div
        className={cn(
          "relative flex min-h-[12rem] h-full flex-col justify-between rounded-lg border p-5 select-none transition-all",
          isIncomplete ? "border-amber-500/40 bg-amber-500/5" : "border-destructive/40 bg-destructive/5",
          className
        )}
      >
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span
                className={cn("size-2.5 rounded-full", isIncomplete ? "bg-amber-400" : "bg-destructive")}
              />
              <span
                className={cn(
                  "text-xs font-semibold uppercase tracking-wider",
                  isIncomplete ? "text-amber-400" : "text-destructive"
                )}
              >
                {isIncomplete ? "Generation incomplete" : "Generation failed"}
              </span>
            </div>
            <button
              onClick={() => removeRun(run.id)}
              className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
              aria-label={isIncomplete ? "Dismiss incomplete run" : "Dismiss failed run"}
            >
              Dismiss
            </button>
          </div>
          <h4 className="text-sm font-medium text-foreground line-clamp-1">{run.roleTitle}</h4>
          <p className="text-xs text-muted-foreground line-clamp-1">{run.company}</p>
        </div>

        <div className="flex flex-col gap-2 my-2">
          <div
            className={cn(
              "flex items-start gap-1.5 text-xs",
              isIncomplete ? "text-amber-400/90" : "text-destructive/90"
            )}
          >
            <AlertCircle className="size-3.5 mt-0.5 shrink-0" />
            <span className="line-clamp-2">
              {isIncomplete
                ? `Stopped at ${run.stepsSettled} of ${run.stepsTotal} steps — the run reached its time budget. Resume to finish it.`
                : run.error || "Rate limit or network error"}
            </span>
          </div>
          {isIncomplete && (
            <Progress value={percent} className="h-1.5 bg-muted [&>div]:bg-amber-400" />
          )}
        </div>

        <div className="flex items-center justify-between border-t border-border/40 pt-3">
          <Link
            href={`/runs/${run.id}`}
            className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-4"
          >
            View details
          </Link>
          <Button
            size="sm"
            variant="outline"
            onClick={handleResume}
            disabled={isResuming}
            className={cn(
              "h-7 text-xs gap-1.5 rounded-lg",
              isIncomplete
                ? "border-amber-500/40 hover:bg-amber-500/10 text-amber-400"
                : "border-destructive/40 hover:bg-destructive/10 text-destructive"
            )}
          >
            <RefreshCw className={cn("size-3", isResuming && "animate-spin")} />
            {isResuming ? "Resuming…" : "Resume"}
          </Button>
        </div>
      </div>
    );
  }

  // If queued
  if (run.status === "queued") {
    return (
      <div
        className={cn(
          "relative flex min-h-[12rem] h-full flex-col justify-between rounded-lg border border-dashed border-border/80 bg-muted/20 p-5 select-none transition-all",
          className
        )}
        aria-label={`Queued generation for ${run.roleTitle} at ${run.company}`}
      >
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full border border-muted-foreground/60" />
              <span className="text-xs font-medium text-muted-foreground">Queued</span>
            </div>
            <span className="text-[11px] text-muted-foreground/70 font-mono">
              {queuePosition ? `Slot #${queuePosition}` : "Waiting"}
            </span>
          </div>
          <h4 className="text-sm font-medium text-foreground line-clamp-1">{run.roleTitle}</h4>
          <p className="text-xs text-muted-foreground line-clamp-1">{run.company}</p>
        </div>

        <div className="flex flex-col gap-2 py-3">
          <p className="text-xs text-muted-foreground/80">
            Waiting for concurrent slots (max 2 active). Will start automatically.
          </p>
        </div>

        <div className="flex items-center justify-between border-t border-border/40 pt-3 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="size-3 text-muted-foreground/70" />
            Queued {elapsed} ago
          </span>
          <button
            onClick={() => removeRun(run.id)}
            className="hover:text-foreground text-muted-foreground/60 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // Succeeded — held on screen for a few seconds (see use-active-runs.tsx) so this state is what
  // fills that window, in this exact card, rather than the run silently keeping its "Generating…"
  // look while an unrelated-looking KitCard for the same kit appears elsewhere in the grid.
  if (run.status === "succeeded") {
    return (
      <Link
        href={run.kitId ? `/kits/${run.kitId}` : `/runs/${run.id}`}
        aria-label={`${run.roleTitle} kit ready`}
        className={cn(
          "group relative flex min-h-[12rem] h-full flex-col justify-between rounded-lg border border-emerald-500/40 bg-card p-5 select-none transition-all duration-200",
          "hover:border-emerald-400 hover:shadow-[0_4px_24px_rgba(16,185,129,0.12)] hover:-translate-y-0.5",
          "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-emerald-500",
          className
        )}
      >
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", duration: 0.4 }}
              >
                <CheckCircle2 className="size-4 text-emerald-400" aria-hidden />
              </motion.span>
              <span className="text-xs font-semibold text-emerald-400">Kit ready</span>
            </div>
            <ArrowUpRight className="size-3.5 text-muted-foreground/50 group-hover:text-emerald-400 transition-colors" />
          </div>
          <h4 className="text-sm font-semibold tracking-tight text-foreground line-clamp-1 group-hover:text-emerald-400 transition-colors">
            {run.roleTitle}
          </h4>
          <p className="text-xs text-muted-foreground line-clamp-1">{run.company}</p>
        </div>

        <div className="flex flex-col gap-2 py-3">
          <Progress value={100} className="h-1.5 bg-muted [&>div]:bg-emerald-400" />
        </div>

        <div className="flex items-center justify-between border-t border-border/40 pt-3 text-[11px] text-muted-foreground">
          <span>Generation complete</span>
          <span className="text-emerald-400 font-medium opacity-0 transition-opacity group-hover:opacity-100">
            Open kit →
          </span>
        </div>
      </Link>
    );
  }

  return (
    <Link
      href={`/runs/${run.id}`}
      aria-label={`Generating kit for ${run.company}, ${run.stepsSettled} of ${run.stepsTotal} steps complete`}
      className={cn(
        "group relative flex min-h-[12rem] h-full flex-col justify-between rounded-lg border border-sky-500/40 bg-card p-5 select-none transition-all duration-200",
        "hover:border-sky-400 hover:shadow-[0_4px_24px_rgba(56,189,248,0.12)] hover:-translate-y-0.5",
        "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-sky-500",
        className
      )}
    >
      {/* Header zone */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <motion.span
              animate={{ scale: [1, 1.3, 1] }}
              transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
              className="size-2 rounded-full bg-sky-400"
              aria-hidden
            />
            <span className="text-xs font-semibold text-sky-400">Generating…</span>
          </div>
          <div className="flex items-center gap-1 text-[11px] font-mono text-muted-foreground">
            <Clock className="size-3 text-muted-foreground/70" />
            <span>{elapsed}</span>
            <ArrowUpRight className="size-3.5 text-muted-foreground/50 group-hover:text-sky-400 transition-colors ml-0.5" />
          </div>
        </div>
        <h4 className="text-sm font-semibold tracking-tight text-foreground line-clamp-1 group-hover:text-sky-400 transition-colors">
          {run.roleTitle}
        </h4>
        <p className="text-xs text-muted-foreground line-clamp-1">{run.company}</p>
      </div>

      {/* Progress & Current step */}
      <div className="flex flex-col gap-2 py-3" aria-live="polite">
        <div className="flex items-center justify-between text-xs font-medium">
          <span className="text-muted-foreground truncate max-w-[180px]">{currentStepLabel}</span>
          <span className="font-mono text-[11px] text-sky-400 shrink-0">
            {run.stepsSettled}/{run.stepsTotal} ({percent}%)
          </span>
        </div>
        <Progress value={percent} className="h-1.5 bg-muted [&>div]:bg-sky-400" />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-border/40 pt-3 text-[11px] text-muted-foreground">
        <span>Click for live run view</span>
        <span className="text-sky-400 font-medium opacity-0 transition-opacity group-hover:opacity-100">
          Inspect run →
        </span>
      </div>
    </Link>
  );
}

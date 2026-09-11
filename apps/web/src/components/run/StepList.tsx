"use client";

import { motion } from "motion/react";
import type { RunStep } from "@/lib/api";

const STEP_LABELS: Record<string, string> = {
  extractRequirements: "Extract requirements from the JD",
  crawlCompany: "Crawl company site",
  discoverHiringPages: "Discover hiring pages",
  searchPublicDiscussion: "Search public interview discussion",
  generateCompanyBrief: "Generate company brief",
  generateQuestions: "Generate questions",
  fillCoverageGaps: "Fill coverage gaps",
  generateFlashcards: "Generate flashcards",
  buildSchedule: "Build study schedule",
};

const STATUS_STYLE: Record<RunStep["status"], { dot: string; label: string; text: string }> = {
  pending: { dot: "bg-muted-foreground/40", label: "Pending", text: "text-muted-foreground" },
  running: { dot: "bg-sky-400", label: "Running", text: "text-sky-400" },
  ok: { dot: "bg-emerald-400", label: "Done", text: "text-emerald-400" },
  skipped: { dot: "bg-amber-400", label: "Skipped", text: "text-amber-400" },
  failed: { dot: "bg-destructive", label: "Failed", text: "text-destructive" },
};

export function StepList({ steps }: { steps: RunStep[] }) {
  return (
    <ol className="flex flex-col gap-2">
      {steps.map((step) => {
        const style = STATUS_STYLE[step.status];
        const label = STEP_LABELS[step.name] ?? step.name;
        return (
          <li
            key={step.name}
            className="flex items-start gap-3 rounded-md border border-border px-3 py-2.5"
          >
            <motion.span
              layout
              initial={false}
              animate={{ scale: step.status === "running" ? [1, 1.3, 1] : 1 }}
              transition={
                step.status === "running"
                  ? { duration: 1.2, repeat: Infinity, ease: "easeInOut" }
                  : { duration: 0.2 }
              }
              className={`mt-1 size-2.5 shrink-0 rounded-full ${style.dot}`}
              aria-hidden
            />
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="text-sm font-medium">{label}</span>
              {step.status === "skipped" && step.note ? (
                <span className="text-xs text-muted-foreground">Skipped: {step.note}</span>
              ) : step.status === "failed" && step.error ? (
                <span className="text-xs text-destructive/90">{step.error}</span>
              ) : null}
            </div>
            <motion.span
              key={step.status}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className={`shrink-0 text-xs font-medium ${style.text}`}
            >
              {style.label}
            </motion.span>
          </li>
        );
      })}
    </ol>
  );
}

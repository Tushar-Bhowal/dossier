"use client";

import { AnimatePresence, motion } from "motion/react";
import { Check, X, TriangleAlert } from "lucide-react";
import type { RunStep } from "@/lib/api";

export const STEP_LABELS: Record<string, string> = {
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

export const STATUS_STYLE: Record<
  RunStep["status"],
  { dot: string; label: string; text: string; border: string }
> = {
  pending: { dot: "bg-muted-foreground/40", label: "Pending", text: "text-muted-foreground", border: "border-border" },
  running: { dot: "bg-sky-400", label: "Running", text: "text-sky-400", border: "border-sky-500/40" },
  ok: { dot: "bg-emerald-400", label: "Done", text: "text-emerald-400", border: "border-emerald-500/30" },
  skipped: { dot: "bg-amber-400", label: "Skipped", text: "text-amber-400", border: "border-amber-500/30" },
  failed: { dot: "bg-destructive", label: "Failed", text: "text-destructive", border: "border-destructive/40" },
};

const listVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 350, damping: 32 } },
};

function StepIcon({ status }: { status: RunStep["status"] }) {
  return (
    <span className="relative flex size-5 shrink-0 items-center justify-center">
      <AnimatePresence mode="wait" initial={false}>
        {status === "pending" && (
          <motion.span
            key="pending"
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.6 }}
            transition={{ duration: 0.15 }}
            className="size-2.5 rounded-full border-2 border-muted-foreground/40"
          />
        )}
        {status === "running" && (
          <motion.span
            key="running"
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: [1, 1.35, 1] }}
            exit={{ opacity: 0, scale: 0.6 }}
            transition={{ scale: { duration: 1.1, repeat: Infinity, ease: "easeInOut" }, opacity: { duration: 0.15 } }}
            className="size-2.5 rounded-full bg-sky-400"
          />
        )}
        {status === "ok" && (
          <motion.span
            key="ok"
            initial={{ opacity: 0, scale: 0.4, rotate: -45 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            exit={{ opacity: 0, scale: 0.4 }}
            transition={{ type: "spring", stiffness: 500, damping: 22 }}
          >
            <Check className="size-4 text-emerald-400" strokeWidth={3} aria-hidden />
          </motion.span>
        )}
        {status === "skipped" && (
          <motion.span
            key="skipped"
            initial={{ opacity: 0, scale: 0.4 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.4 }}
            transition={{ type: "spring", stiffness: 500, damping: 22 }}
          >
            <TriangleAlert className="size-4 text-amber-400" aria-hidden />
          </motion.span>
        )}
        {status === "failed" && (
          <motion.span
            key="failed"
            initial={{ opacity: 0, scale: 0.4 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.4 }}
            transition={{ type: "spring", stiffness: 500, damping: 22 }}
          >
            <X className="size-4 text-destructive" strokeWidth={3} aria-hidden />
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}

export function StepList({ steps, compact = false }: { steps: RunStep[]; compact?: boolean }) {
  if (compact) {
    return (
      <ol className="flex flex-col gap-1.5">
        {steps.map((step) => {
          const style = STATUS_STYLE[step.status];
          const label = STEP_LABELS[step.name] ?? step.name;
          return (
            <li key={step.name} className="flex items-center justify-between gap-2 py-0.5 text-xs">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <motion.span
                  layout
                  initial={false}
                  animate={{ scale: step.status === "running" ? [1, 1.25, 1] : 1 }}
                  transition={
                    step.status === "running"
                      ? { duration: 1.2, repeat: Infinity, ease: "easeInOut" }
                      : { duration: 0.2 }
                  }
                  className={`size-2 shrink-0 rounded-full ${style.dot}`}
                  aria-hidden
                />
                <span className="truncate text-foreground/90">{label}</span>
              </div>
              <span className={`shrink-0 text-[11px] font-medium ${style.text}`}>
                {style.label}
              </span>
            </li>
          );
        })}
      </ol>
    );
  }

  return (
    <motion.ol
      className="flex flex-col gap-2"
      variants={listVariants}
      initial="hidden"
      animate="visible"
    >
      {steps.map((step) => {
        const style = STATUS_STYLE[step.status];
        const label = STEP_LABELS[step.name] ?? step.name;
        return (
          <motion.li
            key={step.name}
            layout
            variants={itemVariants}
            transition={{ layout: { type: "spring", stiffness: 350, damping: 32 } }}
            className={`flex items-start gap-3 rounded-lg border px-3 py-2.5 transition-colors duration-300 ${style.border}`}
          >
            <div className="mt-0.5">
              <StepIcon status={step.status} />
            </div>
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="text-sm font-medium">{label}</span>
              <AnimatePresence initial={false}>
                {step.status === "skipped" && step.note ? (
                  <motion.span
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="text-xs text-muted-foreground"
                  >
                    Skipped: {step.note}
                  </motion.span>
                ) : step.status === "failed" && step.error ? (
                  <motion.span
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="text-xs text-destructive/90"
                  >
                    {step.error}
                  </motion.span>
                ) : step.status === "ok" && step.note ? (
                  <motion.span
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="text-xs text-amber-400/90"
                  >
                    {step.note}
                  </motion.span>
                ) : null}
              </AnimatePresence>
            </div>
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={step.status}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                transition={{ duration: 0.2 }}
                className={`shrink-0 text-xs font-medium ${style.text}`}
              >
                {style.label}
              </motion.span>
            </AnimatePresence>
          </motion.li>
        );
      })}
    </motion.ol>
  );
}

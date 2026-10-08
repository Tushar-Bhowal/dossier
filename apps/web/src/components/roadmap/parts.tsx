import type { Origin, RoadmapKind, RoadmapStage, SourceConfidence } from "@dossier/core/roadmap";
import { AlertTriangle, BookOpen, Briefcase, Dumbbell, GraduationCap, Mic, Puzzle, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export const STAGES: { value: RoadmapStage; label: string; hint: string; icon: LucideIcon }[] = [
  { value: "concepts", label: "Learn the concepts", hint: "The ideas every question builds on.", icon: BookOpen },
  { value: "practice", label: "Practise", hint: "Typical questions and tasks, answered out loud.", icon: Dumbbell },
  { value: "scenario", label: "Real situations", hint: "Problems like the ones you'd face in the job.", icon: Puzzle },
  { value: "mock", label: "Mock interview", hint: "Full practice rounds before the real thing.", icon: Mic },
];

export function stageMeta(stage: RoadmapStage) {
  return STAGES.find((s) => s.value === stage)!;
}

export function KindBadge({ kind }: { kind: RoadmapKind }) {
  const Icon = kind === "role" ? Briefcase : GraduationCap;
  return (
    <span className="inline-flex h-7 items-center gap-1.5 rounded-lg bg-white/[0.06] px-2.5 text-[13px] font-semibold text-white/75">
      <Icon className="size-3.5 text-[#ff7a5c]" aria-hidden />
      {kind === "role" ? "Job role" : "Skill"}
    </span>
  );
}

const CONFIDENCE: Record<SourceConfidence, { label: string; className: string }> = {
  high: { label: "Well sourced", className: "bg-emerald-500/10 text-emerald-300" },
  medium: { label: "Some sources", className: "bg-sky-500/10 text-sky-300" },
  low: { label: "Few sources", className: "bg-amber-500/10 text-amber-300" },
};

export function ConfidenceChip({ confidence }: { confidence: SourceConfidence }) {
  const meta = CONFIDENCE[confidence];
  return (
    <span className={cn("inline-flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-semibold", meta.className)}>
      {confidence === "low" && <AlertTriangle className="size-3.5" aria-hidden />}
      {meta.label}
    </span>
  );
}

export function LowConfidenceNotice({ company, sources }: { company: string | null; sources: number }) {
  return (
    <div role="note" className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 sm:p-5">
      <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-300" aria-hidden />
      <div>
        <p className="text-[15px] font-semibold text-white">
          We found {sources === 1 ? "only 1 public source" : `only ${sources} public sources`}
          {company ? ` about how ${company} interviews` : ""}
        </p>
        <p className="mt-1 text-sm leading-relaxed text-white/70">
          So these rounds are typical for the role, not confirmed. If you can, ask the recruiter what the rounds are and
          edit the plan to match.
        </p>
      </div>
    </div>
  );
}

const ORIGIN: Partial<Record<Origin, { label: string; className: string }>> = {
  edited: { label: "Edited by you", className: "bg-sky-500/10 text-sky-300" },
  manual: { label: "Added by you", className: "bg-emerald-500/10 text-emerald-300" },
};

// AI-written items carry no tag; the page says once that they're AI-written and editable.
export function OriginTag({ origin, pinned }: { origin: Origin; pinned?: boolean }) {
  const meta = ORIGIN[origin];
  if (!meta && !pinned) return null;
  return (
    <span className="flex flex-wrap gap-1.5">
      {meta && <span className={cn("inline-flex h-6 items-center rounded-lg px-2 text-xs font-semibold", meta.className)}>{meta.label}</span>}
      {pinned && <span className="inline-flex h-6 items-center rounded-lg bg-primary/15 px-2 text-xs font-semibold text-[#ff7a5c]">Pinned</span>}
    </span>
  );
}

export function daysUntil(date: string | null): number | null {
  if (!date) return null;
  const today = new Date().toISOString().slice(0, 10);
  return Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 864e5);
}

export function interviewLabel(date: string | null): string | null {
  const days = daysUntil(date);
  if (days === null) return null;
  if (days < 0) return "Interview has passed";
  if (days === 0) return "Interview today";
  if (days === 1) return "Interview tomorrow";
  return `Interview in ${days} days`;
}

export function ProgressBar({ done, total, className }: { done: number; total: number; className?: string }) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={done}
      aria-label={`${done} of ${total} topics done`}
      className={cn("h-2 w-full overflow-hidden rounded-full bg-white/[0.06]", className)}
    >
      <div className="h-full rounded-full bg-[#ff7a5c] transition-[width] duration-300" style={{ width: `${pct}%` }} />
    </div>
  );
}

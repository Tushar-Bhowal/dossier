import type { InterviewSourceType, RubricCriterion } from "@dossier/core/interview";
import { FileText, FolderKanban, Map as MapIcon, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export const SOURCE_META: Record<InterviewSourceType, { label: string; icon: LucideIcon }> = {
  roadmap: { label: "Roadmap", icon: MapIcon },
  kit: { label: "Interview kit", icon: FolderKanban },
  resume: { label: "Your resume", icon: FileText },
};

export const CRITERIA: Record<RubricCriterion, { label: string; hint: string }> = {
  structure: { label: "Structure", hint: "A clear start, steps and an outcome" },
  depth: { label: "Depth", hint: "How well you explain the how and why" },
  evidence: { label: "Specific examples", hint: "Real moments and results, not general claims" },
  communication: { label: "Delivery", hint: "Easy to follow, few filler words" },
};

export function formatDuration(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function minutesLabel(totalSec: number): string {
  const m = Math.max(1, Math.round(totalSec / 60));
  return `${m} min`;
}

export function relativeDay(iso: string): string {
  const days = Math.floor((Date.now() - Date.parse(iso)) / 864e5);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

export function scoreTone(score: number): string {
  if (score >= 4) return "text-emerald-300";
  if (score >= 3) return "text-sky-300";
  return "text-amber-300";
}

export function ScoreDots({ score, label }: { score: number; label: string }) {
  return (
    <span className="flex items-center gap-1" role="img" aria-label={`${label}: ${score} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span
          key={n}
          className={cn(
            "h-2 w-5 rounded-full",
            n <= score ? (score >= 4 ? "bg-emerald-400" : score >= 3 ? "bg-sky-400" : "bg-amber-400") : "bg-white/[0.08]",
          )}
        />
      ))}
    </span>
  );
}

"use client";

import * as React from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, Calendar, HelpCircle, Layers, Trash2 } from "lucide-react";
import type { KitSummary } from "@/lib/api";
import { deleteKit } from "@/lib/api";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

interface KitCardProps {
  kit: KitSummary;
  className?: string;
}

function formatRelativeTime(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    const now = Date.now();
    const diffSec = Math.max(0, Math.floor((now - date.getTime()) / 1000));
    if (diffSec < 60) return "just now";
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 30) return `${diffDays}d ago`;
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return "recently";
  }
}

export function KitCard({ kit, className }: KitCardProps) {
  const queryClient = useQueryClient();
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  const roleTitle = kit.kit.role?.title || "Untitled role";
  const company = kit.kit.source?.company || "Unknown company";
  const seniority = kit.kit.role?.seniority;
  const location = kit.kit.source?.location;

  const questionsCount = kit.kit.questions?.length ?? 0;
  const flashcardsCount = kit.kit.flashcards?.length ?? 0;
  const days = kit.kit.schedule?.days_available;

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    await deleteKit(kit.id);
    await queryClient.invalidateQueries({ queryKey: ["kits"] });
    toast.success("Kit deleted", {
      description: `"${roleTitle}" at ${company} has been removed.`,
    });
  };

  return (
    <>
      <Link
        href={`/kits/${kit.id}`}
        aria-label={`Interview kit for ${roleTitle} at ${company}`}
        className={cn(
          "group relative flex h-full min-h-[15rem] select-none flex-col rounded-lg border border-white/[0.08] bg-[#111111] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] transition-[transform,border-color,box-shadow] duration-200",
          "bg-[radial-gradient(120%_70%_at_100%_0%,rgba(251,65,40,0.08),transparent_55%)]",
          "hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[0_20px_50px_-20px_rgba(251,65,40,0.45),inset_0_1px_0_rgba(255,255,255,0.06)]",
          "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          className,
        )}
      >
        <button
          type="button"
          onClick={handleDeleteClick}
          aria-label={`Delete kit for ${roleTitle}`}
          className={cn(
            "absolute right-4 top-4 z-10 flex size-8 items-center justify-center rounded-lg",
            "border border-white/10 bg-[#161616] text-white/55",
            "scale-90 opacity-0 transition-all duration-150",
            "group-hover:scale-100 group-hover:opacity-100",
            "hover:border-destructive/30 hover:bg-destructive/15 hover:text-destructive",
            "focus-visible:scale-100 focus-visible:opacity-100 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring",
          )}
        >
          <Trash2 className="size-4" />
        </button>

        <div className="flex items-center gap-3 pr-10">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[#dc3019] text-base font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.3)]">
            {company.charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="truncate text-[15px] font-semibold text-white">{company}</p>
            <p className="truncate text-[13px] text-white/55">
              {[seniority, location].filter((v) => v && !/^not specified$/i.test(v)).join(" · ") ||
                "Interview kit"}
            </p>
          </div>
        </div>

        <h3 className="mt-5 line-clamp-2 text-[19px] font-semibold leading-snug tracking-[-0.02em] text-white transition-colors group-hover:text-[#ff7a5c]">
          {roleTitle}
        </h3>

        <dl className="mt-5 grid grid-cols-3 gap-2">
          {[
            { icon: HelpCircle, value: questionsCount, label: "questions" },
            { icon: Layers, value: flashcardsCount, label: "flashcards" },
            { icon: Calendar, value: days ?? "—", label: "days" },
          ].map(({ icon: Icon, value, label }) => (
            <div key={label} className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2.5">
              <dt className="sr-only">{label}</dt>
              <dd className="flex items-center gap-1.5 text-[17px] font-semibold tabular-nums text-white">
                <Icon className="size-3.5 text-[#ff7a5c]" aria-hidden />
                {value}
              </dd>
              <p className="mt-0.5 text-xs font-medium text-white/50">{label}</p>
            </div>
          ))}
        </dl>

        <div className="mt-auto flex items-center justify-between pt-5 text-[13px]">
          <span className="font-medium text-white/45">
            Updated {formatRelativeTime(kit.updatedAt || kit.createdAt)}
          </span>
          <span className="inline-flex items-center gap-1 font-semibold text-white/70 transition-colors group-hover:text-[#ff7a5c]">
            Open kit
            <ArrowUpRight className="size-4 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </span>
        </div>
      </Link>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Delete "${roleTitle}"?`}
        description={`This will permanently delete the interview kit for ${roleTitle} at ${company}, including all questions, flashcards, and study progress. This action cannot be undone.`}
        confirmLabel="Delete kit"
        onConfirm={handleConfirmDelete}
      />
    </>
  );
}

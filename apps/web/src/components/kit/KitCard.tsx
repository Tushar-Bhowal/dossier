"use client";

import * as React from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, BookOpen, Calendar, HelpCircle, Layers, Trash2 } from "lucide-react";
import type { KitSummary } from "@/lib/api";
import { deleteKit } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
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

  const subtitleParts = [company, seniority, location].filter(Boolean);
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
          "group relative flex min-h-[12rem] h-full flex-col justify-between rounded-lg border border-border/70 bg-card p-5 transition-all duration-200 select-none",
          "hover:border-[#FB4128]/50 hover:shadow-[0_4px_24px_rgba(251,65,40,0.1)] hover:-translate-y-0.5",
          "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          className
        )}
      >
        {/* Delete button — visible on card hover */}
        <button
          type="button"
          onClick={handleDeleteClick}
          aria-label={`Delete kit for ${roleTitle}`}
          className={cn(
            "absolute top-3 right-3 z-10 flex size-7 items-center justify-center rounded-lg",
            "bg-muted/80 text-muted-foreground border border-border/60",
            "opacity-0 scale-90 transition-all duration-150",
            "group-hover:opacity-100 group-hover:scale-100",
            "hover:bg-destructive/15 hover:text-destructive hover:border-destructive/30",
            "focus-visible:opacity-100 focus-visible:scale-100 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
          )}
        >
          <Trash2 className="size-3.5" />
        </button>

        {/* Header zone */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-start justify-between gap-2 pr-6">
            <h3 className="text-base font-semibold tracking-tight text-foreground line-clamp-1 group-hover:text-[#FB4128] transition-colors">
              {roleTitle}
            </h3>
            <ArrowUpRight className="size-4 shrink-0 text-muted-foreground/60 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-[#FB4128]" />
          </div>
          <p className="text-xs text-muted-foreground font-normal line-clamp-1">
            {subtitleParts.join(" · ")}
          </p>
        </div>

        {/* Body zone: counts badges */}
        <div className="flex flex-wrap items-center gap-1.5 py-3">
          <Badge variant="secondary" className="gap-1 px-2 py-0.5 text-xs font-normal bg-secondary/70 rounded">
            <HelpCircle className="size-3 text-muted-foreground" />
            <span>{questionsCount} questions</span>
          </Badge>
          <Badge variant="secondary" className="gap-1 px-2 py-0.5 text-xs font-normal bg-secondary/70 rounded">
            <Layers className="size-3 text-muted-foreground" />
            <span>{flashcardsCount} flashcards</span>
          </Badge>
          {days ? (
            <Badge variant="outline" className="gap-1 px-2 py-0.5 text-xs font-normal border-border/80 text-muted-foreground rounded">
              <Calendar className="size-3 text-muted-foreground" />
              <span>{days}d schedule</span>
            </Badge>
          ) : null}
        </div>

        {/* Footer zone */}
        <div className="flex items-center justify-between border-t border-border/40 pt-3 text-[11px] text-muted-foreground/80">
          <span>Updated {formatRelativeTime(kit.updatedAt || kit.createdAt)}</span>
          <span className="font-medium text-[#FB4128] opacity-0 transition-opacity duration-150 group-hover:opacity-100">
            View prep kit →
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

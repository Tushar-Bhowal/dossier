"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Clock,
  Eye,
  GraduationCap,
  Layers,
  Repeat,
  RotateCcw,
  Sparkles,
  Trophy,
} from "lucide-react";
import {
  getPracticeSession,
  recordPracticeReview,
  type Confidence,
  type PracticeCard,
  type PracticeSession,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast";

const BOX_NAMES: Record<number, { label: string; color: string; bg: string }> = {
  1: { label: "Learning", color: "text-rose-400", bg: "bg-rose-500/10 border-rose-500/20" },
  2: { label: "Developing", color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20" },
  3: { label: "Practiced", color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20" },
  4: { label: "Strong", color: "text-indigo-400", bg: "bg-indigo-500/10 border-indigo-500/20" },
  5: { label: "Mastered", color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
};

function formatDueDate(dateOnly: string): string {
  const today = new Date().toISOString().slice(0, 10);
  if (dateOnly <= today) return "today";
  const days = Math.round(
    (Date.parse(`${dateOnly}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000
  );
  return days === 1 ? "tomorrow" : `in ${days} days`;
}

export function FlashcardDeck({ kitId }: { kitId: string }) {
  const queryClient = useQueryClient();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["practice", kitId],
    queryFn: () => getPracticeSession(kitId),
  });

  const [revealed, setRevealed] = useState(false);
  const [seenCardId, setSeenCardId] = useState<string | null>(null);
  const [extraPractice, setExtraPractice] = useState(false);
  const [extraIndex, setExtraIndex] = useState(0);

  // Normal due queue vs extra practice queue
  const due = data?.cards.filter((c) => c.due) ?? [];
  const activeQueue = extraPractice ? data?.cards ?? [] : due;
  const current = extraPractice ? activeQueue[extraIndex] : due[0];

  // Reset reveal state whenever the card changes
  if (current && current.id !== seenCardId) {
    setSeenCardId(current.id);
    if (revealed) setRevealed(false);
  }

  const review = useMutation({
    mutationFn: (confidence: Confidence) => {
      if (!current) throw new Error("No card to review");
      return recordPracticeReview(kitId, current.id, confidence);
    },
    onSuccess: (session: PracticeSession) => {
      queryClient.setQueryData(["practice", kitId], session);
      setRevealed(false);

      if (extraPractice) {
        if (extraIndex + 1 >= (session.cards.length ?? 0)) {
          setExtraPractice(false);
          setExtraIndex(0);
          toast.success("Extra practice complete! All deck cards reviewed.");
        } else {
          setExtraIndex((prev) => prev + 1);
        }
      } else {
        const remainingDue = session.cards.filter((c) => c.due).length;
        if (remainingDue === 0) {
          toast.success("Daily practice complete! Great work.", {
            description: "You have reviewed all cards scheduled for today.",
          });
        }
      }
    },
    onError: () => {
      toast.error("Couldn't save that review. Please try again.");
    },
  });

  // Keyboard navigation for power users
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (["INPUT", "TEXTAREA"].includes((e.target as HTMLElement)?.tagName)) return;

      if (e.code === "Space" || e.code === "Enter") {
        e.preventDefault();
        setRevealed((prev) => !prev);
      } else if (revealed && !review.isPending && current) {
        if (e.key === "1") {
          e.preventDefault();
          review.mutate("low");
        } else if (e.key === "2") {
          e.preventDefault();
          review.mutate("medium");
        } else if (e.key === "3") {
          e.preventDefault();
          review.mutate("high");
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [revealed, review, current]);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex justify-between items-center">
          <Skeleton className="h-5 w-48 rounded" />
          <Skeleton className="h-5 w-24 rounded" />
        </div>
        <Skeleton className="h-2 w-full rounded" />
        <Skeleton className="h-72 w-full rounded-lg" />
        <div className="grid grid-cols-3 gap-3">
          <Skeleton className="h-14 rounded" />
          <Skeleton className="h-14 rounded" />
          <Skeleton className="h-14 rounded" />
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <Card className="rounded-lg border-border/80 p-8 text-center">
        <p className="text-sm text-destructive">Couldn&apos;t load the practice session.</p>
        <Button asChild variant="outline" size="sm" className="mt-4 rounded">
          <Link href={`/kits/${kitId}`}>Return to Kit</Link>
        </Button>
      </Card>
    );
  }

  if (data.cards.length === 0) {
    return (
      <Card className="rounded-lg border-dashed border-border/80 p-12 text-center flex flex-col items-center gap-3">
        <div className="flex size-12 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
          <Layers className="size-6" />
        </div>
        <h3 className="text-base font-semibold text-foreground">No Flashcards Available</h3>
        <p className="text-xs text-muted-foreground max-w-sm">
          This interview kit doesn&apos;t have any flashcards yet. Generate or add flashcards in the Kit Builder to start practicing.
        </p>
        <Button asChild size="sm" className="rounded bg-[#FB4128] hover:bg-[#FB4128]/90 text-white mt-2">
          <Link href={`/kits/${kitId}`}>Go to Kit Builder</Link>
        </Button>
      </Card>
    );
  }

  // Box statistics
  const totalCards = data.cards.length;
  const coveredCount = data.cards.filter((c) => c.covered).length;
  const masteredCount = data.cards.filter((c) => c.box >= 4).length;
  const progressPercent = Math.round((coveredCount / totalCards) * 100);

  const boxCounts: Record<number, number> = {
    1: data.cards.filter((c) => c.box === 1).length,
    2: data.cards.filter((c) => c.box === 2).length,
    3: data.cards.filter((c) => c.box === 3).length,
    4: data.cards.filter((c) => c.box === 4).length,
    5: data.cards.filter((c) => c.box === 5).length,
  };

  // When caught up / session finished
  if (!current) {
    return (
      <div className="flex flex-col gap-6">
        {/* Celebration Banner */}
        <Card className="rounded-lg border-emerald-500/30 bg-emerald-500/5 p-6 sm:p-8 flex flex-col sm:flex-row items-center gap-6">
          <div className="flex size-16 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <Trophy className="size-8" />
          </div>
          <div className="flex-1 text-center sm:text-left">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <h3 className="text-xl font-bold tracking-tight text-foreground">
                All Caught Up for Today!
              </h3>
              <Badge variant="secondary" className="bg-emerald-500/15 text-emerald-400 font-semibold rounded text-xs px-2">
                100% Today&apos;s Goal
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed max-w-xl">
              You&apos;ve reviewed all due flashcards. Consistent daily spaced repetition outperforms cramming.
              {data.daysRemaining > 0 && ` You have ${data.daysRemaining} day${data.daysRemaining === 1 ? "" : "s"} left before your interview.`}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 shrink-0 w-full sm:w-auto">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setExtraPractice(true);
                setExtraIndex(0);
              }}
              className="rounded text-xs h-9"
            >
              Extra Practice (All {totalCards})
            </Button>
            <Button asChild size="sm" className="rounded bg-[#FB4128] hover:bg-[#FB4128]/90 text-white text-xs h-9">
              <Link href={`/kits/${kitId}`}>Back to Kit</Link>
            </Button>
          </div>
        </Card>

        {/* Deck Mastery Distribution */}
        <Card className="rounded-lg border-border/80 p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-border/40 pb-3">
            <div className="flex items-center gap-2">
              <GraduationCap className="size-4 text-[#FB4128]" />
              <h4 className="text-sm font-semibold text-foreground">Deck Mastery Breakdown</h4>
            </div>
            <span className="text-xs text-muted-foreground">
              {masteredCount} of {totalCards} cards mastered (Boxes 4–5)
            </span>
          </div>

          {/* 5-Box Visualizer */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
            {[1, 2, 3, 4, 5].map((boxNum) => {
              const meta = BOX_NAMES[boxNum];
              const count = boxCounts[boxNum];
              return (
                <div
                  key={boxNum}
                  className={`rounded border p-3 flex flex-col gap-1 text-center transition-colors ${meta.bg}`}
                >
                  <span className={`text-[11px] font-semibold uppercase tracking-wider ${meta.color}`}>
                    Box {boxNum} · {meta.label}
                  </span>
                  <span className="text-lg font-bold text-foreground">{count}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {boxNum === 1 ? "Review daily" : boxNum === 5 ? "Fully retained" : "Review spaced"}
                  </span>
                </div>
              );
            })}
          </div>

          {/* All Deck Cards List */}
          <div className="flex flex-col gap-2 pt-2">
            <span className="text-xs font-semibold text-foreground/80">Scheduled Flashcards:</span>
            <ul className="flex flex-col gap-2 list-none p-0 m-0">
              {data.cards.map((c) => {
                const boxMeta = BOX_NAMES[c.box];
                return (
                  <li
                    key={c.id}
                    className="rounded border border-border/50 bg-background/50 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                  >
                    <div className="flex items-start gap-2 min-w-0 flex-1">
                      <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-5 font-normal rounded shrink-0 ${boxMeta.color}`}>
                        Box {c.box}
                      </Badge>
                      <span className="font-medium text-foreground/90 break-words leading-relaxed">
                        {c.front}
                      </span>
                    </div>
                    <span className="shrink-0 text-[11px] text-muted-foreground pl-6 sm:pl-0">
                      Next review {formatDueDate(c.dueAt)}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </Card>
      </div>
    );
  }

  // Active review card index in current queue
  const queueIndex = extraPractice ? extraIndex : data.cards.length - due.length;
  const currentBoxMeta = BOX_NAMES[current.box] ?? BOX_NAMES[1];

  return (
    <div className="flex flex-col gap-5">
      {/* Session Progress Overview Header */}
      <div className="rounded-lg border border-border/70 bg-card/40 p-4 sm:p-5 flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#FB4128]">
              {extraPractice ? "Extra Practice Mode" : "Today's Study Session"}
            </span>
            <Badge variant="secondary" className="px-2 py-0 text-xs rounded">
              {extraPractice ? `${extraIndex + 1} of ${totalCards}` : `${due.length} remaining`}
            </Badge>
          </div>

          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="size-3 text-muted-foreground" />
              {data.daysRemaining > 0 ? `${data.daysRemaining} days until interview` : "Interview day"}
            </span>
            <span>·</span>
            <span>{coveredCount} of {totalCards} cards covered ({progressPercent}%)</span>
          </div>
        </div>

        {/* Progress bar */}
        <Progress value={extraPractice ? ((extraIndex + 1) / totalCards) * 100 : progressPercent} className="h-1.5" />

        {/* Mini 5-Box Leitner distribution strip */}
        <div className="flex items-center justify-between gap-1 pt-1 text-[11px] text-muted-foreground">
          {[1, 2, 3, 4, 5].map((b) => (
            <div key={b} className="flex items-center gap-1">
              <span className={`size-2 rounded-full ${b === current.box ? "bg-[#FB4128]" : "bg-muted-foreground/40"}`} />
              <span className="hidden sm:inline">Box {b}:</span>
              <span className="font-mono text-foreground/80">{boxCounts[b]}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Main Flashcard Display */}
      <div className="relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={current.id + (revealed ? ":back" : ":front")}
            initial={{ opacity: 0, rotateX: revealed ? -15 : 15, scale: 0.98 }}
            animate={{ opacity: 1, rotateX: 0, scale: 1 }}
            exit={{ opacity: 0, rotateX: revealed ? 15 : -15, scale: 0.98 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            onClick={() => !revealed && setRevealed(true)}
            className={`rounded-lg border p-6 sm:p-8 min-h-[280px] sm:min-h-[320px] flex flex-col justify-between transition-all cursor-pointer select-none shadow-md ${
              revealed
                ? "border-[#FB4128]/30 bg-gradient-to-b from-card to-card/90"
                : "border-border/80 bg-card hover:border-border hover:shadow-lg"
            }`}
          >
            {/* Card Header metadata */}
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <div className="flex items-center gap-2">
                <Badge
                  variant={revealed ? "default" : "secondary"}
                  className={`text-[10px] px-2 py-0.5 font-semibold rounded uppercase tracking-wider ${
                    revealed ? "bg-[#FB4128] text-white" : ""
                  }`}
                >
                  {revealed ? "Answer / Key Criteria" : "Question / Prompt"}
                </Badge>
                <span className="text-xs text-muted-foreground font-mono">
                  Card #{extraPractice ? extraIndex + 1 : totalCards - due.length + 1} of {extraPractice ? totalCards : totalCards}
                </span>
              </div>

              {/* Current Leitner Box Level */}
              <div className="flex items-center gap-1.5">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded border ${currentBoxMeta.bg} ${currentBoxMeta.color}`}>
                  Box {current.box} · {currentBoxMeta.label}
                </span>
              </div>
            </div>

            {/* Card Content Area */}
            <div className="py-8 sm:py-10 flex flex-col justify-center items-center text-center">
              <p className="text-lg sm:text-2xl font-medium leading-relaxed text-foreground max-w-2xl whitespace-pre-wrap break-words">
                {revealed ? current.back : current.front}
              </p>
            </div>

            {/* Card Footer Hint */}
            <div className="flex items-center justify-between border-t border-border/40 pt-3 text-[11px] text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <Repeat className="size-3 text-muted-foreground/70" />
                <span>{!revealed ? "Click card or press Space to reveal answer" : "Review complete — grade your confidence below"}</span>
              </div>
              <span className="hidden sm:inline-flex items-center gap-1 font-mono text-[10px] bg-secondary/80 px-1.5 py-0.5 rounded border border-border/50">
                {!revealed ? "Space to flip" : "Keys: 1, 2, 3"}
              </span>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Action Controls */}
      {!revealed ? (
        <Button
          type="button"
          onClick={() => setRevealed(true)}
          className="w-full h-12 bg-secondary hover:bg-secondary/80 text-foreground font-semibold rounded border border-border/60 gap-2 text-sm shadow-xs transition-all active:scale-[0.99]"
        >
          <Eye className="size-4 text-[#FB4128]" />
          <span>Reveal Answer</span>
          <kbd className="hidden sm:inline-block px-1.5 py-0.5 rounded bg-background/80 text-[10px] font-mono text-muted-foreground border border-border/60 ml-2">
            Space
          </kbd>
        </Button>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {/* Low Confidence */}
            <button
              type="button"
              disabled={review.isPending}
              onClick={() => review.mutate("low")}
              className="rounded border border-rose-500/30 bg-rose-500/5 hover:bg-rose-500/15 text-rose-400 p-3 sm:p-3.5 flex flex-col items-center justify-center gap-1 text-center transition-all active:scale-[0.98] disabled:opacity-50 group"
            >
              <div className="flex items-center gap-1.5">
                <RotateCcw className="size-3.5 group-hover:-rotate-45 transition-transform" />
                <span className="font-semibold text-xs sm:text-sm">Still Shaky</span>
                <kbd className="hidden sm:inline-block px-1 py-0.2 rounded bg-background/80 text-[10px] font-mono text-muted-foreground border border-border/50 ml-1">
                  1
                </kbd>
              </div>
              <span className="text-[10px] text-muted-foreground/80">
                Resets to Box 1 · Review tomorrow
              </span>
            </button>

            {/* Medium Confidence */}
            <button
              type="button"
              disabled={review.isPending}
              onClick={() => review.mutate("medium")}
              className="rounded border border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/15 text-amber-400 p-3 sm:p-3.5 flex flex-col items-center justify-center gap-1 text-center transition-all active:scale-[0.98] disabled:opacity-50 group"
            >
              <div className="flex items-center gap-1.5">
                <Check className="size-3.5" />
                <span className="font-semibold text-xs sm:text-sm">Getting There</span>
                <kbd className="hidden sm:inline-block px-1 py-0.2 rounded bg-background/80 text-[10px] font-mono text-muted-foreground border border-border/50 ml-1">
                  2
                </kbd>
              </div>
              <span className="text-[10px] text-muted-foreground/80">
                Good recall · Keeps pace
              </span>
            </button>

            {/* High Confidence */}
            <button
              type="button"
              disabled={review.isPending}
              onClick={() => review.mutate("high")}
              className="rounded border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 p-3 sm:p-3.5 flex flex-col items-center justify-center gap-1 text-center transition-all active:scale-[0.98] disabled:opacity-50 group shadow-xs"
            >
              <div className="flex items-center gap-1.5">
                <Sparkles className="size-3.5" />
                <span className="font-semibold text-xs sm:text-sm">Nailed It</span>
                <kbd className="hidden sm:inline-block px-1 py-0.2 rounded bg-background/80 text-[10px] font-mono text-muted-foreground border border-border/50 ml-1">
                  3
                </kbd>
              </div>
              <span className="text-[10px] text-muted-foreground/80">
                Advances to Box {Math.min(5, current.box + 1)} · Long retention
              </span>
            </button>
          </div>

          <div className="text-center text-[11px] text-muted-foreground pt-1">
            Rate honestly to train your spaced repetition curve.
          </div>
        </div>
      )}
    </div>
  );
}

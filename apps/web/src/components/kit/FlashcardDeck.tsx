"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { Check, Clock, Eye, GraduationCap, Layers, Repeat, RotateCcw, Trophy } from "lucide-react";
import { getPracticeSession, recordPracticeReview, type Confidence, type PracticeSession } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
    (Date.parse(`${dateOnly}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000,
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
  const activeQueue = extraPractice ? (data?.cards ?? []) : due;
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
          <Skeleton className="h-5 w-48 rounded-lg" />
          <Skeleton className="h-5 w-24 rounded-lg" />
        </div>
        <Skeleton className="h-2 w-full rounded-lg" />
        <Skeleton className="h-72 w-full rounded-lg" />
        <div className="grid grid-cols-3 gap-3">
          <Skeleton className="h-14 rounded-lg" />
          <Skeleton className="h-14 rounded-lg" />
          <Skeleton className="h-14 rounded-lg" />
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <Card className="rounded-lg border-border/80 p-8 text-center">
        <p className="text-sm text-destructive">Couldn&apos;t load the practice session.</p>
        <Button asChild variant="outline" size="sm" className="mt-4 rounded-lg">
          <Link href={`/kits/${kitId}`}>Return to Kit</Link>
        </Button>
      </Card>
    );
  }

  if (data.cards.length === 0) {
    return (
      <Card className="flex flex-col items-center gap-3 p-12 text-center">
        <div className="flex size-12 items-center justify-center rounded-lg bg-primary/15 text-[#ff7a5c] ring-1 ring-primary/25">
          <Layers className="size-6" />
        </div>
        <h3 className="text-xl font-semibold text-white">No flashcards yet</h3>
        <p className="max-w-sm text-[15px] leading-relaxed text-white/60">
          This interview kit doesn&apos;t have any flashcards yet. Generate or add flashcards in the Kit
          Builder to start practicing.
        </p>
        <Button asChild size="lg" className="mt-2">
          <Link href={`/kits/${kitId}#flashcards`}>Go to flashcards</Link>
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
        <Card className="flex flex-col items-center gap-6 border-emerald-500/30 bg-emerald-500/[0.06] p-6 ring-emerald-500/25 sm:flex-row sm:p-8">
          <div className="flex size-16 shrink-0 items-center justify-center rounded-lg border border-emerald-500/25 bg-emerald-500/15 text-emerald-300">
            <Trophy className="size-8" />
          </div>
          <div className="flex-1 text-center sm:text-left">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <h3 className="text-2xl font-semibold tracking-[-0.02em] text-white">
                All caught up for today
              </h3>
              <Badge
                variant="secondary"
                className="bg-emerald-500/15 text-emerald-400 font-semibold rounded-lg text-xs px-2"
              >
                Today&apos;s goal done
              </Badge>
            </div>
            <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-white/65">
              You&apos;ve reviewed all due flashcards. Consistent daily spaced repetition outperforms
              cramming.
              {data.daysRemaining > 0 &&
                ` You have ${data.daysRemaining} day${data.daysRemaining === 1 ? "" : "s"} left before your interview.`}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 shrink-0 w-full sm:w-auto">
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={() => {
                setExtraPractice(true);
                setExtraIndex(0);
              }}
            >
              Practise all {totalCards} again
            </Button>
            <Button asChild size="lg">
              <Link href={`/kits/${kitId}`}>Back to kit</Link>
            </Button>
          </div>
        </Card>

        {/* Deck Mastery Distribution */}
        <Card className="flex flex-col gap-5 p-6">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.06] pb-4">
            <div className="flex items-center gap-2">
              <GraduationCap className="size-4 text-[#ff7a5c]" />
              <h4 className="text-lg font-semibold text-white">Deck mastery</h4>
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
                  className={`rounded-lg border p-3 flex flex-col gap-1 text-center transition-colors ${meta.bg}`}
                >
                  <span className={`text-xs font-semibold uppercase tracking-wider ${meta.color}`}>
                    Box {boxNum} · {meta.label}
                  </span>
                  <span className="text-2xl font-semibold tabular-nums text-white">{count}</span>
                  <span className="text-xs text-muted-foreground">
                    {boxNum === 1 ? "Review daily" : boxNum === 5 ? "Fully retained" : "Review spaced"}
                  </span>
                </div>
              );
            })}
          </div>

          {/* All Deck Cards List */}
          <div className="flex flex-col gap-2 pt-2">
            <span className="text-[15px] font-semibold text-white">All cards</span>
            <ul className="flex flex-col gap-2 list-none p-0 m-0">
              {data.cards.map((c) => {
                const boxMeta = BOX_NAMES[c.box];
                return (
                  <li
                    key={c.id}
                    className="flex flex-col justify-between gap-2 rounded-lg border border-white/[0.07] bg-white/[0.02] p-4 sm:flex-row sm:items-center"
                  >
                    <div className="flex items-start gap-2 min-w-0 flex-1">
                      <Badge
                        variant="outline"
                        className={`text-xs px-1.5 py-0 h-5 font-normal rounded-lg shrink-0 ${boxMeta.color}`}
                      >
                        Box {c.box}
                      </Badge>
                      <span className="break-words text-[15px] font-medium leading-relaxed text-white/90">
                        {c.front}
                      </span>
                    </div>
                    <span className="shrink-0 text-[13px] text-white/50">
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

  const currentBoxMeta = BOX_NAMES[current.box] ?? BOX_NAMES[1];
  const sessionPercent = extraPractice ? Math.round(((extraIndex + 1) / totalCards) * 100) : progressPercent;
  const ring = 2 * Math.PI * 42;

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="flex min-w-0 flex-col gap-4">
        <div className="relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={current.id + (revealed ? ":back" : ":front")}
              initial={{ opacity: 0, rotateX: revealed ? -12 : 12, scale: 0.98 }}
              animate={{ opacity: 1, rotateX: 0, scale: 1 }}
              exit={{ opacity: 0, rotateX: revealed ? 12 : -12, scale: 0.98 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              onClick={() => !revealed && setRevealed(true)}
              className={`relative flex min-h-[340px] cursor-pointer select-none flex-col justify-between overflow-hidden rounded-lg border p-6 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.06)] transition-colors sm:min-h-[400px] sm:p-8 ${
                revealed
                  ? "border-primary/35 bg-[#151010]"
                  : "border-white/[0.09] bg-[#121212] hover:border-white/[0.16]"
              }`}
            >
              <div
                aria-hidden
                className={`pointer-events-none absolute -top-32 left-1/2 h-64 w-[600px] -translate-x-1/2 bg-[radial-gradient(ellipse_50%_60%_at_50%_50%,rgba(255,96,48,${revealed ? "0.22" : "0.12"}),transparent_70%)]`}
              />
              <div className="relative flex flex-wrap items-center justify-between gap-2">
                <span
                  className={`inline-flex h-7 items-center rounded-lg px-2.5 text-[13px] font-semibold ${
                    revealed ? "bg-[#dc3019] text-white" : "bg-white/[0.07] text-white/75"
                  }`}
                >
                  {revealed ? "Answer" : "Question"}
                </span>
                <span className="text-[13px] font-medium tabular-nums text-white/50">
                  Card {extraPractice ? extraIndex + 1 : totalCards - due.length + 1} of {totalCards}
                </span>
              </div>

              <p className="relative mx-auto max-w-2xl whitespace-pre-wrap break-words py-10 text-center text-xl font-semibold leading-relaxed tracking-[-0.01em] text-white sm:text-[26px]">
                {revealed ? current.back : current.front}
              </p>

              <div className="relative flex flex-wrap items-center justify-between gap-3 text-[13px] text-white/50">
                <span className="flex items-center gap-2">
                  <Repeat className="size-3.5" />
                  {!revealed ? "Click the card or press Space to reveal" : "How well did you know it?"}
                </span>
                <span
                  className={`inline-flex h-7 items-center rounded-lg border px-2.5 text-xs font-semibold ${currentBoxMeta.bg} ${currentBoxMeta.color}`}
                >
                  Box {current.box} · {currentBoxMeta.label}
                </span>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {!revealed ? (
          <Button type="button" size="lg" onClick={() => setRevealed(true)} className="h-12 w-full text-base">
            <Eye className="size-4" />
            Reveal answer
            <kbd className="ml-1 hidden rounded-lg bg-black/20 px-1.5 py-0.5 text-xs font-semibold sm:inline-block">
              Space
            </kbd>
          </Button>
        ) : (
          <div className="grid gap-2.5 sm:grid-cols-3">
            {(
              [
                {
                  key: "1",
                  value: "low",
                  icon: RotateCcw,
                  title: "Still shaky",
                  hint: "Back to box 1, review tomorrow",
                  tone: "border-rose-500/30 bg-rose-500/[0.07] text-rose-300 hover:bg-rose-500/15",
                },
                {
                  key: "2",
                  value: "medium",
                  icon: Check,
                  title: "Getting there",
                  hint: "Good recall, keeps its pace",
                  tone: "border-amber-500/30 bg-amber-500/[0.07] text-amber-300 hover:bg-amber-500/15",
                },
                {
                  key: "3",
                  value: "high",
                  icon: Trophy,
                  title: "Nailed it",
                  hint: `Moves up to box ${Math.min(5, current.box + 1)}`,
                  tone: "border-emerald-500/35 bg-emerald-500/[0.08] text-emerald-300 hover:bg-emerald-500/15",
                },
              ] as const
            ).map(({ key, value, icon: Icon, title, hint, tone }) => (
              <button
                key={value}
                type="button"
                disabled={review.isPending}
                onClick={() => review.mutate(value)}
                className={`flex flex-col items-start gap-1 rounded-lg border p-4 text-left transition-colors active:scale-[0.99] disabled:opacity-50 ${tone}`}
              >
                <span className="flex w-full items-center gap-2 text-[15px] font-semibold">
                  <Icon className="size-4" />
                  {title}
                  <kbd className="ml-auto hidden rounded-lg border border-white/10 bg-black/30 px-1.5 text-xs text-white/60 sm:inline-block">
                    {key}
                  </kbd>
                </span>
                <span className="text-[13px] text-white/55">{hint}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <aside className="flex flex-col gap-4">
        <div className="rounded-lg border border-white/[0.08] bg-[#111111] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
          <p className="text-[13px] font-semibold text-[#ff7a5c]">
            {extraPractice ? "Extra practice" : "Today's session"}
          </p>
          <div className="mt-4 flex items-center gap-4">
            <div className="relative size-24 shrink-0">
              <svg viewBox="0 0 100 100" className="size-full -rotate-90" aria-hidden>
                <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="8" />
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  fill="none"
                  stroke="#ff6a3d"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={`${(sessionPercent / 100) * ring} ${ring}`}
                  opacity={sessionPercent === 0 ? 0 : 1}
                  className="transition-[stroke-dasharray] duration-500"
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-xl font-semibold tabular-nums text-white">
                {sessionPercent}%
              </span>
            </div>
            <div className="text-sm">
              <p className="font-semibold text-white">
                {extraPractice
                  ? `${extraIndex + 1} of ${totalCards}`
                  : `${due.length} card${due.length === 1 ? "" : "s"} left`}
              </p>
              <p className="mt-1 text-white/55">
                {coveredCount} of {totalCards} covered
              </p>
              <p className="mt-1 flex items-center gap-1.5 text-white/55">
                <Clock className="size-3.5" />
                {data.daysRemaining > 0 ? `${data.daysRemaining} days to interview` : "Interview day"}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-white/[0.08] bg-[#111111] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
          <p className="text-[13px] font-semibold text-white">Leitner boxes</p>
          <p className="mt-1 text-[13px] text-white/50">Cards move up as you recall them.</p>
          <ul className="mt-4 flex flex-col gap-2">
            {[1, 2, 3, 4, 5].map((b) => {
              const meta = BOX_NAMES[b];
              const share = totalCards ? (boxCounts[b] / totalCards) * 100 : 0;
              return (
                <li key={b} className="flex items-center gap-3">
                  <span
                    className={`w-24 shrink-0 text-[13px] font-semibold ${b === current.box ? meta.color : "text-white/60"}`}
                  >
                    {b}. {meta.label}
                  </span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                    <span className="block h-full rounded-full bg-[#ff6a3d]" style={{ width: `${share}%` }} />
                  </span>
                  <span className="w-5 text-right text-[13px] font-semibold tabular-nums text-white/75">
                    {boxCounts[b]}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </aside>
    </div>
  );
}

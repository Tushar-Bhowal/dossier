"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getPracticeSession, recordPracticeReview, type Confidence, type PracticeSession } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";

const CONFIDENCE_LABEL: Record<Confidence, string> = { low: "Still shaky", medium: "Getting there", high: "Nailed it" };

function formatDueDate(dateOnly: string): string {
  const today = new Date().toISOString().slice(0, 10);
  if (dateOnly <= today) return "today";
  const days = Math.round((Date.parse(`${dateOnly}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
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

  const due = data?.cards.filter((c) => c.due) ?? [];
  const current = due[0];

  // Reset the reveal state as soon as the front-of-queue card changes, without a render-lagging effect.
  if (current && current.id !== seenCardId) {
    setSeenCardId(current.id);
    if (revealed) setRevealed(false);
  }

  const review = useMutation({
    mutationFn: (confidence: Confidence) => {
      if (!current) throw new Error("no card to review");
      return recordPracticeReview(kitId, current.id, confidence);
    },
    onSuccess: (session: PracticeSession) => {
      queryClient.setQueryData(["practice", kitId], session);
      setRevealed(false);
    },
  });

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (isError || !data) {
    return <p className="text-sm text-muted-foreground">Couldn&apos;t load practice session.</p>;
  }

  if (data.cards.length === 0) {
    return <p className="text-sm text-muted-foreground">This kit has no flashcards yet — add some in the builder first.</p>;
  }

  const coveredCount = data.cards.filter((c) => c.covered).length;

  if (!current) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          You&apos;re all caught up — {coveredCount} of {data.cards.length} cards reviewed
          {data.daysRemaining > 0 ? `, ${data.daysRemaining} day${data.daysRemaining === 1 ? "" : "s"} left to prep` : ""}.
        </p>
        <ul className="flex flex-col gap-2">
          {data.cards.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-2 rounded-md border border-border p-2 text-sm">
              <span className="min-w-0 flex-1 truncate">{c.front}</span>
              <span className="shrink-0 text-xs text-muted-foreground">next review {formatDueDate(c.dueAt)}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {coveredCount} of {data.cards.length} cards reviewed
            {data.daysRemaining > 0 ? ` · ${data.daysRemaining} day${data.daysRemaining === 1 ? "" : "s"} left` : ""}
          </span>
          <span>{due.length} due now</span>
        </div>
        <Progress value={(coveredCount / data.cards.length) * 100} />
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={current.id + (revealed ? ":back" : ":front")}
          initial={{ opacity: 0, rotateX: -10 }}
          animate={{ opacity: 1, rotateX: 0 }}
          exit={{ opacity: 0, rotateX: 10 }}
          transition={{ duration: 0.2 }}
        >
          <Card>
            <CardContent className="flex min-h-40 flex-col justify-center gap-2 py-8 text-center">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">{revealed ? "Answer" : "Prompt"}</span>
              <p className="text-lg">{revealed ? current.back : current.front}</p>
            </CardContent>
          </Card>
        </motion.div>
      </AnimatePresence>

      {!revealed ? (
        <Button type="button" onClick={() => setRevealed(true)}>
          Reveal answer
        </Button>
      ) : (
        <div className="flex flex-wrap gap-2">
          {(Object.keys(CONFIDENCE_LABEL) as Confidence[]).map((confidence) => (
            <Button
              key={confidence}
              type="button"
              variant={confidence === "high" ? "default" : "outline"}
              disabled={review.isPending}
              onClick={() => review.mutate(confidence)}
            >
              {CONFIDENCE_LABEL[confidence]}
            </Button>
          ))}
        </div>
      )}
      {review.isError ? <p className="text-sm text-destructive">Couldn&apos;t save that review — try again.</p> : null}
    </div>
  );
}

"use client";

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { getRun, resumeRun } from "@/lib/api";
import { StepList } from "@/components/run/StepList";
import { SkippedSources } from "@/components/run/SkippedSources";
import { FailureState } from "@/components/run/FailureState";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast";

const STATUS_COPY: Record<string, string> = {
  queued: "Queued",
  running: "Generating your kit…",
  succeeded: "Kit ready",
  partial: "Continuing generation…",
  failed: "Generation failed",
};

export default function RunPage({ params }: PageProps<"/runs/[id]">) {
  const { id } = use(params);
  const queryClient = useQueryClient();
  const [resuming, setResuming] = useState(false);
  const resumeInFlight = useRef(false);

  const {
    data: run,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["run", id],
    queryFn: () => getRun(id),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === "succeeded" || status === "failed") return false;
      return 1500;
    },
  });

  async function doResume() {
    if (resumeInFlight.current) return;
    resumeInFlight.current = true;
    setResuming(true);
    toast.info("Resuming generation", {
      description: "Continuing kit creation from the last checkpoint...",
    });
    try {
      const updated = await resumeRun(id);
      queryClient.setQueryData(["run", id], updated);
    } catch (err) {
      toast.error("Resume failed", {
        description: err instanceof Error ? err.message : "Failed to resume run.",
      });
    } finally {
      resumeInFlight.current = false;
      setResuming(false);
    }
  }

  useEffect(() => {
    if (run?.status === "partial") {
      void doResume();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run?.status]);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-9 w-28 rounded-lg" />
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (isError || !run) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Couldn&apos;t load this run</CardTitle>
          <CardDescription>It may not exist, or it isn&apos;t yours.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <Link href="/kits">Back to kits</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const total = run.steps.length;
  const settled = run.steps.filter((s) => s.status === "ok" || s.status === "skipped").length;

  return (
    <div className="flex flex-col gap-6">
      <Button asChild variant="outline" className="rounded-lg gap-2 self-start">
        <Link href="/kits">
          <ArrowLeft className="size-4" />
          <span>Back to kits</span>
        </Link>
      </Button>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {STATUS_COPY[run.status] ?? run.status}
        </h1>
        <p className="text-sm text-muted-foreground">
          {run.status === "partial"
            ? "Hit the time budget for this request — automatically resuming."
            : "Generation researches the company, then writes your kit step by step."}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Progress</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Progress value={total > 0 ? (settled / total) * 100 : 0} />
          <StepList steps={run.steps} />
        </CardContent>
      </Card>

      <SkippedSources sources={run.sourcesSkipped} />

      {run.status === "failed" ? (
        <FailureState run={run} onResume={doResume} resuming={resuming} />
      ) : null}

      <AnimatePresence>
        {run.status === "succeeded" && run.kitId ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            <Card>
              <CardHeader>
                <CardTitle>Your kit is ready</CardTitle>
                <CardDescription>Review the brief, questions, flashcards and schedule.</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild>
                  <Link href={`/kits/${run.kitId}`}>View kit</Link>
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

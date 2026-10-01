"use client";

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, CircleCheck } from "lucide-react";
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
  const percent = total > 0 ? Math.round((settled / total) * 100) : 0;
  const live = run.status === "queued" || run.status === "running" || run.status === "partial";

  return (
    <div className="flex w-full flex-col gap-6">
      <section className="relative overflow-hidden rounded-lg border border-white/[0.08] bg-[#0f0f0f] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] sm:p-8">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-40 left-1/2 h-80 w-[800px] -translate-x-1/2 bg-[radial-gradient(ellipse_50%_60%_at_50%_50%,rgba(255,96,48,0.16),transparent_70%)]"
        />
        <Link
          href="/kits"
          className="relative -ml-2 inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-white/60 transition-colors hover:text-white"
        >
          <ArrowLeft className="size-4" />
          All kits
        </Link>
        <div className="relative mt-4 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <p className="flex items-center gap-2 text-[13px] font-semibold text-[#ff7a5c]">
              {live && <span className="size-2 animate-pulse rounded-full bg-[#ff7a5c]" />}
              {live ? "In progress" : run.status === "succeeded" ? "Complete" : "Stopped"}
            </p>
            <h1 className="mt-2 text-[28px] font-semibold tracking-[-0.03em] text-white sm:text-[32px]">
              {STATUS_COPY[run.status] ?? run.status}
            </h1>
            <p className="mt-1.5 max-w-xl text-[15px] leading-relaxed text-white/60">
              {run.status === "partial"
                ? "Hit the time budget for this request, so it's picking up where it left off."
                : "Dossier researches the company first, then writes your kit step by step."}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-4xl font-semibold tabular-nums tracking-[-0.03em] text-white">{percent}%</p>
            <p className="text-[13px] font-medium text-white/55">
              {settled} of {total} steps
            </p>
          </div>
        </div>
        <Progress value={percent} className="relative mt-6 h-2" />
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card>
          <CardHeader>
            <CardTitle>Steps</CardTitle>
          </CardHeader>
          <CardContent>
            <StepList steps={run.steps} />
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6">
          <AnimatePresence>
            {run.status === "succeeded" && run.kitId ? (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
              >
                <Card className="border-emerald-500/25 bg-emerald-500/[0.05] ring-emerald-500/20">
                  <CardHeader>
                    <span className="flex size-10 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-300">
                      <CircleCheck className="size-5" />
                    </span>
                    <CardTitle className="mt-3 text-xl">Your kit is ready</CardTitle>
                    <CardDescription className="text-[15px] text-white/60">
                      The brief, questions, flashcards and schedule are waiting.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button asChild size="lg" className="w-full">
                      <Link href={`/kits/${run.kitId}`}>
                        Open kit <ArrowRight className="size-4" />
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            ) : null}
          </AnimatePresence>

          {run.status === "failed" ? (
            <FailureState run={run} onResume={doResume} resuming={resuming} />
          ) : null}

          <SkippedSources sources={run.sourcesSkipped} />
        </div>
      </div>
    </div>
  );
}

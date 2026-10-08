"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { DropdownMenu } from "radix-ui";
import type { RoadmapRecord, RoadmapTopic } from "@dossier/core/roadmap";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  ChevronRight,
  CalendarDays,
  ExternalLink,
  Layers,
  LoaderCircle,
  Mic,
  MoreHorizontal,
  RefreshCcw,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast";
import { SampleBanner } from "@/components/demo/SampleBanner";
import { AiProgress, describeAiError } from "@/components/resume/AiStatus";
import { ApiError } from "@/lib/api";
import { deleteRoadmap, regenerateRoadmap, retryRoadmap, roadmapKeys, ROADMAP_SAMPLE } from "@/lib/roadmap/api";
import type { SaveStatus } from "@/lib/optimistic";
import { cn } from "@/lib/utils";
import { ConfidenceChip, KindBadge, LowConfidenceNotice, OriginTag, ProgressBar, STAGES, interviewLabel } from "./parts";
import { useRoadmap } from "./useRoadmap";

const BUILD_STEPS = [
  "Working out what this job involves",
  "Reading how interviews for it usually go",
  "Mapping the interview rounds",
  "Planning topics from basics to mock interview",
  "Writing questions and flashcards",
  "Finding videos and articles to learn from",
];

const SOURCE_KIND = { official: "Official", candidate: "Candidate report", guide: "Guide" } as const;

export function SaveState({ status, onRetry }: { status: SaveStatus; onRetry: () => void }) {
  if (status === "retry") {
    return (
      <button type="button" onClick={onRetry} className="text-sm font-semibold text-[#ff8a70] underline-offset-4 hover:underline">
        Couldn&apos;t save. Try again
      </button>
    );
  }
  return (
    <span className="text-sm font-medium text-white/50" aria-live="polite">
      {status === "saving" ? "Saving…" : "All changes saved"}
    </span>
  );
}

export function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="-ml-2 inline-flex h-10 items-center gap-1.5 self-start rounded-lg px-2 text-sm font-semibold text-white/60 transition-colors hover:text-white"
    >
      <ArrowLeft className="size-4" aria-hidden />
      {children}
    </Link>
  );
}

function TopicRow({
  roadmapId,
  topic,
  done,
  blockedBy,
  onToggle,
}: {
  roadmapId: string;
  topic: RoadmapTopic;
  done: boolean;
  blockedBy: RoadmapTopic[];
  onToggle: () => void;
}) {
  const counts = [
    topic.questions.length && `${topic.questions.length} question${topic.questions.length === 1 ? "" : "s"}`,
    topic.flashcards.length && `${topic.flashcards.length} flashcard${topic.flashcards.length === 1 ? "" : "s"}`,
    topic.resources.length && `${topic.resources.length} to read or watch`,
  ].filter(Boolean);

  return (
    <li
      className={cn(
        "flex items-stretch rounded-lg border transition-colors",
        done ? "border-white/[0.06] bg-white/[0.015]" : "border-white/[0.08] bg-[#121212] hover:border-white/15",
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={done}
        aria-label={done ? `Mark "${topic.title}" as not done` : `Mark "${topic.title}" as done`}
        className="flex w-14 shrink-0 items-center justify-center rounded-l-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <span
          className={cn(
            "flex size-6 items-center justify-center rounded-lg border-2 transition-colors",
            done ? "border-emerald-400 bg-emerald-400 text-black" : "border-white/25 hover:border-white/50",
          )}
        >
          {done && <Check className="size-4" strokeWidth={3} aria-hidden />}
        </span>
      </button>
      <Link
        href={`/roadmaps/${roadmapId}/topics/${topic.id}`}
        className="group flex min-w-0 flex-1 items-center gap-3 rounded-r-lg py-3.5 pr-4 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <span className="min-w-0 flex-1">
          <span className={cn("block text-[15px] font-semibold", done ? "text-white/55" : "text-white group-hover:text-[#ff7a5c]")}>
            {topic.title}
          </span>
          {counts.length > 0 && <span className="mt-0.5 block text-sm font-medium text-white/50">{counts.join(" · ")}</span>}
          {!done && blockedBy.length > 0 && (
            <span className="mt-1 block text-sm font-medium text-amber-200/80">Best after: {blockedBy.map((t) => t.title).join(", ")}</span>
          )}
          <span className="mt-1.5 flex flex-wrap gap-1.5 empty:hidden">
            {topic.from_interview && (
              <span className="inline-flex h-6 items-center gap-1 rounded-lg bg-violet-500/10 px-2 text-xs font-semibold text-violet-300">
                <Mic className="size-3" aria-hidden />
                From your mock interview
              </span>
            )}
            <OriginTag origin={topic.origin} pinned={topic.pinned} />
          </span>
        </span>
        <ChevronRight className="size-5 shrink-0 text-white/35 group-hover:text-white" aria-hidden />
      </Link>
    </li>
  );
}

function Generating({ record }: { record: RoadmapRecord }) {
  return (
    <div className="flex flex-col gap-8">
      <div className="rounded-lg border border-white/[0.08] bg-[#111111] bg-[radial-gradient(90%_70%_at_0%_0%,rgba(251,65,40,0.10),transparent_60%)] p-6 sm:p-8">
        <p className="text-[15px] font-semibold text-white">Building your roadmap</p>
        <p className="mt-1 text-sm leading-relaxed text-white/60">
          This takes about a minute. You can leave this page; it keeps building and shows up in Roadmaps when it&apos;s ready.
        </p>
        <AiProgress steps={BUILD_STEPS} className="mt-6" />
      </div>
      <div className="flex flex-col gap-3" aria-hidden>
        {STAGES.map((s) => (
          <Skeleton key={s.value} className="h-20 w-full rounded-lg bg-white/[0.03]" />
        ))}
      </div>
      <span className="sr-only">Building a roadmap for {record.request.subject}</span>
    </div>
  );
}

function Failed({ id }: { id: string }) {
  const queryClient = useQueryClient();
  const retry = useMutation({
    mutationFn: () => retryRoadmap(id),
    onSuccess: (record) => queryClient.setQueryData(roadmapKeys.one(id), record),
  });
  return (
    <div role="alert" className="flex flex-col gap-4 rounded-lg border border-destructive/35 bg-destructive/10 p-6">
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 size-5 shrink-0 text-destructive" aria-hidden />
        <div>
          <p className="text-[15px] font-semibold text-white">We couldn&apos;t build this roadmap</p>
          <p className="mt-1 text-sm leading-relaxed text-white/70">
            {retry.error ? describeAiError(retry.error).body : "The research didn't finish. Trying again usually works."}
          </p>
        </div>
      </div>
      <Button className="h-11 self-start" onClick={() => retry.mutate()} disabled={retry.isPending}>
        {retry.isPending ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <RefreshCcw className="size-4" aria-hidden />}
        Try again
      </Button>
    </div>
  );
}

export function RoadmapView({ id }: { id: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { query, status, toggleDone, retrySave } = useRoadmap(id);
  const [confirm, setConfirm] = React.useState<"regenerate" | "delete" | null>(null);

  const regenerate = async () => {
    try {
      const { record: next, kept } = await regenerateRoadmap(id);
      queryClient.setQueryData(roadmapKeys.one(id), next);
      toast.success("Roadmap refreshed", {
        description: kept ? `Kept the ${kept} thing${kept === 1 ? "" : "s"} you edited, added or pinned.` : "Nothing you'd edited needed keeping.",
      });
    } catch (err) {
      const { title, body } = describeAiError(err);
      toast.error(title, { description: body });
      throw err;
    }
  };

  const remove = async () => {
    await deleteRoadmap(id);
    queryClient.removeQueries({ queryKey: roadmapKeys.one(id) });
    await queryClient.invalidateQueries({ queryKey: roadmapKeys.list });
    toast.success("Roadmap deleted");
    router.push("/roadmaps");
  };

  if (query.isPending) {
    return (
      <div className="flex flex-col gap-6" role="status" aria-label="Loading roadmap">
        <Skeleton className="h-6 w-32 rounded-lg bg-white/[0.05]" />
        <Skeleton className="h-10 w-80 max-w-full rounded-lg bg-white/[0.06]" />
        <Skeleton className="h-4 w-full rounded-lg bg-white/[0.04]" />
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <Skeleton className="h-96 rounded-lg bg-white/[0.03]" />
          <Skeleton className="h-72 rounded-lg bg-white/[0.03]" />
        </div>
      </div>
    );
  }

  if (query.isError) {
    const missing = query.error instanceof ApiError && query.error.status === 404;
    return (
      <div className="flex flex-col gap-6">
        <BackLink href="/roadmaps">Roadmaps</BackLink>
        <div role="alert" className="flex flex-col gap-4 rounded-lg border border-white/[0.08] bg-[#111111] p-6">
          <p className="text-lg font-semibold text-white">{missing ? "This roadmap doesn't exist" : "We couldn't load this roadmap"}</p>
          <p className="text-[15px] text-white/65">{missing ? "It may have been deleted." : "Nothing is lost. Try again in a moment."}</p>
          {!missing && (
            <Button variant="outline" className="h-11 self-start" onClick={() => void query.refetch()}>
              <RefreshCcw className="size-4" aria-hidden />
              Try again
            </Button>
          )}
        </div>
      </div>
    );
  }

  const record = query.data;
  const roadmap = record.roadmap;
  const topics = roadmap?.topics ?? [];
  const done = topics.filter((t) => record.doneTopicIds.includes(t.id)).length;
  const cards = topics.reduce((n, t) => n + t.flashcards.length, 0);
  const when = interviewLabel(record.request.interviewDate);
  const byId = new Map(topics.map((t) => [t.id, t]));

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <BackLink href="/roadmaps">Roadmaps</BackLink>
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <KindBadge kind={record.request.kind} />
              {roadmap && <ConfidenceChip confidence={roadmap.confidence} />}
              {when && (
                <span className="inline-flex h-7 items-center gap-1.5 rounded-lg bg-white/[0.06] px-2.5 text-[13px] font-semibold text-white/75">
                  <CalendarDays className="size-3.5 text-[#ff7a5c]" aria-hidden />
                  {when}
                </span>
              )}
            </div>
            <h1 className="mt-3 text-[32px] font-semibold leading-tight tracking-[-0.035em] text-white">
              {record.request.subject}
              {record.request.company && <span className="text-white/55"> at {record.request.company}</span>}
            </h1>
          </div>
          {record.status === "ready" && (
            <div className="flex flex-wrap items-center gap-2">
              <Button asChild size="lg" className="h-11">
                <Link href={`/roadmaps/${id}/practice`}>
                  <Layers className="size-4" aria-hidden />
                  Practise {cards} flashcards
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-11">
                <Link href={`/interviews/new?roadmap=${id}`}>
                  <Mic className="size-4" aria-hidden />
                  Mock interview
                </Link>
              </Button>
              <DropdownMenu.Root modal={false}>
                <DropdownMenu.Trigger asChild>
                  <Button variant="ghost" size="icon" aria-label="More actions" className="size-11">
                    <MoreHorizontal className="size-5" />
                  </Button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content
                    align="end"
                    sideOffset={6}
                    className="z-50 w-64 rounded-lg border border-white/10 bg-[#141414] p-1.5 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.9)]"
                  >
                    <DropdownMenu.Item
                      onSelect={() => setConfirm("regenerate")}
                      className="flex h-11 cursor-pointer items-center gap-3 rounded-md px-3 text-[15px] font-medium text-white/85 outline-none data-[highlighted]:bg-white/[0.07]"
                    >
                      <RefreshCcw className="size-4 text-white/60" aria-hidden />
                      Refresh the AI-written parts
                    </DropdownMenu.Item>
                    <DropdownMenu.Item
                      onSelect={() => setConfirm("delete")}
                      className="flex h-11 cursor-pointer items-center gap-3 rounded-md px-3 text-[15px] font-medium text-[#ff8a70] outline-none data-[highlighted]:bg-destructive/10"
                    >
                      <Trash2 className="size-4" aria-hidden />
                      Delete roadmap
                    </DropdownMenu.Item>
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>
            </div>
          )}
        </div>
        {record.status === "ready" && (
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-semibold text-white/75">
                {done} of {topics.length} topics done
              </span>
              <SaveState status={status} onRetry={retrySave} />
            </div>
            <ProgressBar done={done} total={topics.length} />
          </div>
        )}
      </div>

      {ROADMAP_SAMPLE && <SampleBanner>Roadmaps aren&apos;t connected yet, so your edits and progress here aren&apos;t saved.</SampleBanner>}

      {record.status === "generating" && <Generating record={record} />}
      {record.status === "failed" && <Failed id={id} />}

      {roadmap && record.status === "ready" && (
        <>
          {roadmap.confidence === "low" && <LowConfidenceNotice company={roadmap.company} sources={roadmap.sources.length} />}
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_380px]">
            <div className="flex flex-col gap-8">
              {STAGES.map((stage, i) => {
                const stageTopics = topics.filter((t) => t.stage === stage.value).sort((a, b) => a.order - b.order);
                if (!stageTopics.length) return null;
                const stageDone = stageTopics.filter((t) => record.doneTopicIds.includes(t.id)).length;
                const Icon = stage.icon;
                return (
                  <section key={stage.value} aria-labelledby={`stage-${stage.value}`} className="flex flex-col gap-3">
                    <div className="flex items-center gap-3">
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-[#ff7a5c]">
                        <Icon className="size-5" aria-hidden />
                      </span>
                      <div className="min-w-0 flex-1">
                        <h2 id={`stage-${stage.value}`} className="text-lg font-semibold tracking-[-0.02em] text-white">
                          <span className="text-white/45">{i + 1}.</span> {stage.label}
                        </h2>
                        <p className="text-sm font-medium text-white/55">{stage.hint}</p>
                      </div>
                      <span className="shrink-0 text-sm font-semibold tabular-nums text-white/55">
                        {stageDone}/{stageTopics.length}
                      </span>
                    </div>
                    <ol className="flex flex-col gap-2">
                      {stageTopics.map((topic) => (
                        <TopicRow
                          key={topic.id}
                          roadmapId={id}
                          topic={topic}
                          done={record.doneTopicIds.includes(topic.id)}
                          blockedBy={topic.prerequisite_ids
                            .filter((p) => !record.doneTopicIds.includes(p))
                            .map((p) => byId.get(p))
                            .filter((t): t is RoadmapTopic => Boolean(t))}
                          onToggle={() => toggleDone(topic.id)}
                        />
                      ))}
                    </ol>
                  </section>
                );
              })}
            </div>

            <aside className="flex flex-col gap-4 lg:sticky lg:top-24 lg:self-start">
              <section aria-labelledby="rounds-heading" className="rounded-lg border border-white/[0.08] bg-[#111111] p-5">
                <h2 id="rounds-heading" className="text-base font-semibold text-white">
                  The interview rounds
                </h2>
                <p className="mt-1 text-sm font-medium text-white/55">
                  {roadmap.confidence === "low" ? "Typical for this job; not confirmed for this company." : "What to expect, from the sources below."}
                </p>
                <ol className="mt-4 flex flex-col gap-4">
                  {roadmap.rounds.map((round, i) => (
                    <li key={round.id} className="flex gap-3">
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] text-[13px] font-bold text-white/80">
                        {i + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="text-[15px] font-semibold text-white">{round.name}</p>
                        <p className="mt-0.5 text-sm leading-relaxed text-white/60">{round.what_it_tests}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </section>
              <section aria-labelledby="sources-heading" className="rounded-lg border border-white/[0.08] bg-[#111111] p-5">
                <h2 id="sources-heading" className="text-base font-semibold text-white">
                  Where this comes from
                </h2>
                <ul className="mt-3 flex flex-col gap-1">
                  {roadmap.sources.map((s) => (
                    <li key={s.id}>
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noreferrer"
                        className="-mx-2 flex items-start gap-2 rounded-lg px-2 py-2 transition-colors hover:bg-white/[0.04]"
                      >
                        <ExternalLink className="mt-0.5 size-4 shrink-0 text-white/40" aria-hidden />
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold leading-snug text-white/85">{s.title}</span>
                          <span className="text-[13px] font-medium text-white/50">{SOURCE_KIND[s.kind]}</span>
                        </span>
                        <span className="sr-only">(opens in a new tab)</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            </aside>
          </div>
        </>
      )}

      <ConfirmDialog
        open={confirm === "regenerate"}
        onOpenChange={(open) => !open && setConfirm(null)}
        title="Refresh the AI-written parts?"
        description="AI-written questions and flashcards are written again from fresh research. Anything you edited, added or pinned stays as it is."
        confirmLabel="Refresh"
        confirmingLabel="Refreshing…"
        variant="default"
        icon={<RefreshCcw className="size-4" />}
        onConfirm={regenerate}
      />
      <ConfirmDialog
        open={confirm === "delete"}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={`Delete "${record.request.subject}"?`}
        description="This removes the roadmap, your edits and your flashcard progress for it."
        confirmLabel="Delete"
        onConfirm={remove}
      />
    </div>
  );
}


"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { InterviewMode, InterviewSourceOption, InterviewSourceType } from "@dossier/core/interview";
import { Keyboard, LoaderCircle, Mic, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SampleBanner } from "@/components/demo/SampleBanner";
import { AiErrorNotice } from "@/components/resume/AiStatus";
import { createInterview, INTERVIEW_SAMPLE, interviewKeys, listInterviewSources } from "@/lib/interview/api";
import { cn } from "@/lib/utils";
import { BackLink } from "@/components/roadmap/RoadmapView";
import { MicCheck, type MicState } from "./MicCheck";
import { SOURCE_META } from "./parts";

const GROUPS: { type: InterviewSourceType; title: string }[] = [
  { type: "roadmap", title: "From a roadmap" },
  { type: "kit", title: "From an interview kit" },
  { type: "resume", title: "Drill me on my resume" },
];

const radioCard =
  "flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50";

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-3 flex items-center gap-3 text-lg font-semibold tracking-[-0.02em] text-white">
        <span className="flex size-7 items-center justify-center rounded-lg bg-white/[0.06] text-[13px] font-bold text-white/80">{n}</span>
        {title}
      </legend>
      {children}
    </fieldset>
  );
}

function preselect(params: URLSearchParams | null, sources: InterviewSourceOption[]): string | null {
  for (const type of ["roadmap", "kit", "resume"] as const) {
    const id = params?.get(type);
    const match = sources.find((s) => s.type === type && (s.id === id || id === "first"));
    if (id && match) return `${type}:${match.id}`;
  }
  return null;
}

export function NewInterview() {
  const router = useRouter();
  const params = useSearchParams();
  const queryClient = useQueryClient();
  const sources = useQuery({ queryKey: interviewKeys.sources, queryFn: listInterviewSources });
  const [picked, setPicked] = React.useState<string | null>(null);
  const [mode, setMode] = React.useState<InterviewMode>("voice");
  const [count, setCount] = React.useState<3 | 5>(3);
  const [mic, setMic] = React.useState<MicState>("idle");
  const [error, setError] = React.useState<string | null>(null);

  const selected = picked ?? (sources.data ? (preselect(params, sources.data) ?? (sources.data[0] ? `${sources.data[0].type}:${sources.data[0].id}` : null)) : null);

  const start = useMutation({
    mutationFn: createInterview,
    onSuccess: (record) => {
      queryClient.setQueryData(interviewKeys.one(record.id), record);
      void queryClient.invalidateQueries({ queryKey: interviewKeys.list });
      router.push(`/interviews/${record.id}`);
    },
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) {
      setError("Pick what to practise first.");
      return;
    }
    const [type, ...rest] = selected.split(":");
    setError(null);
    start.mutate({ source: { type: type as InterviewSourceType, id: rest.join(":") }, mode, questionCount: count });
  }

  const micProblem = mic === "blocked" || mic === "missing" || mic === "unsupported";

  return (
    <form onSubmit={submit} noValidate className="mx-auto flex w-full max-w-3xl flex-col gap-10">
      <div className="flex flex-col gap-3">
        <BackLink href="/interviews">Mock interviews</BackLink>
        <h1 className="text-[32px] font-semibold leading-tight tracking-[-0.035em] text-white">Start a mock interview</h1>
        <p className="text-base leading-relaxed text-white/60">About 10 minutes. You can stop whenever you like and still get a report.</p>
      </div>

      {INTERVIEW_SAMPLE && <SampleBanner>The interviewer follows a script and scoring is a simple stand-in for now.</SampleBanner>}

      <Step n={1} title="What do you want to practise?">
        {sources.isPending ? (
          <div className="flex flex-col gap-2" role="status" aria-label="Loading">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-[72px] rounded-lg bg-white/[0.04]" />
            ))}
          </div>
        ) : sources.isError ? (
          <div role="alert" className="flex items-center justify-between gap-4 rounded-lg border border-destructive/35 bg-destructive/10 p-4">
            <p className="text-[15px] font-medium text-white">We couldn&apos;t load your roadmaps, kits and resumes.</p>
            <Button type="button" variant="outline" className="h-11 shrink-0" onClick={() => void sources.refetch()}>
              <RefreshCcw className="size-4" aria-hidden />
              Try again
            </Button>
          </div>
        ) : sources.data.length === 0 ? (
          <div className="rounded-lg border border-dashed border-white/15 p-6">
            <p className="text-[15px] font-semibold text-white">Nothing to practise from yet</p>
            <p className="mt-1 text-sm leading-relaxed text-white/60">
              Questions come from a roadmap, an interview kit or your resume. Make one first; it takes a minute.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button asChild variant="outline" className="h-11">
                <Link href="/roadmaps?new=1">New roadmap</Link>
              </Button>
              <Button asChild variant="ghost" className="h-11">
                <Link href="/kits?new=true">New interview kit</Link>
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            {GROUPS.map((group) => {
              const items = sources.data.filter((s) => s.type === group.type);
              if (!items.length) return null;
              const Icon = SOURCE_META[group.type].icon;
              return (
                <div key={group.type} className="flex flex-col gap-2">
                  <p className="text-sm font-semibold text-white/55">{group.title}</p>
                  {items.map((s) => {
                    const value = `${s.type}:${s.id}`;
                    const on = selected === value;
                    return (
                      <label key={value} className={cn(radioCard, on ? "border-primary/50 bg-primary/10" : "border-white/10 bg-white/[0.02] hover:bg-white/[0.04]")}>
                        <input type="radio" name="source" value={value} checked={on} onChange={() => setPicked(value)} className="sr-only" />
                        <Icon className={cn("mt-0.5 size-5 shrink-0", on ? "text-[#ff7a5c]" : "text-white/55")} aria-hidden />
                        <span className="min-w-0">
                          <span className="block text-[15px] font-semibold text-white">{s.label}</span>
                          <span className="mt-0.5 block text-sm font-medium text-white/55">
                            {s.detail} · {s.questionCount} questions to draw from
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}
      </Step>

      <Step n={2} title="How do you want to answer?">
        <div className="grid gap-2 sm:grid-cols-2">
          {(
            [
              ["voice", "Speak", "Out loud, like the real thing. Needs a microphone.", Mic],
              ["text", "Type", "Write your answers. Works anywhere; nobody hears you.", Keyboard],
            ] as const
          ).map(([value, label, hint, Icon]) => (
            <label key={value} className={cn(radioCard, mode === value ? "border-primary/50 bg-primary/10" : "border-white/10 bg-white/[0.02] hover:bg-white/[0.04]")}>
              <input type="radio" name="mode" value={value} checked={mode === value} onChange={() => setMode(value)} className="sr-only" />
              <Icon className={cn("mt-0.5 size-5 shrink-0", mode === value ? "text-[#ff7a5c]" : "text-white/55")} aria-hidden />
              <span>
                <span className="block text-[15px] font-semibold text-white">{label}</span>
                <span className="mt-0.5 block text-sm font-medium text-white/55">{hint}</span>
              </span>
            </label>
          ))}
        </div>
        {mode === "voice" && (
          <>
            <MicCheck state={mic} onState={setMic} />
            {micProblem && (
              <Button type="button" variant="outline" className="h-11 self-start" onClick={() => setMode("text")}>
                <Keyboard className="size-4" aria-hidden />
                Type my answers instead
              </Button>
            )}
          </>
        )}
      </Step>

      <Step n={3} title="How long?">
        <div className="grid gap-2 sm:grid-cols-2">
          {(
            [
              [3, "3 questions", "About 10 minutes"],
              [5, "5 questions", "About 20 minutes"],
            ] as const
          ).map(([value, label, hint]) => (
            <label key={value} className={cn(radioCard, count === value ? "border-primary/50 bg-primary/10" : "border-white/10 bg-white/[0.02] hover:bg-white/[0.04]")}>
              <input type="radio" name="count" value={value} checked={count === value} onChange={() => setCount(value)} className="sr-only" />
              <span>
                <span className="block text-[15px] font-semibold text-white">{label}</span>
                <span className="mt-0.5 block text-sm font-medium text-white/55">{hint}</span>
              </span>
            </label>
          ))}
        </div>
      </Step>

      <div className="flex flex-col gap-4 border-t border-white/[0.06] pt-6">
        {error && (
          <p role="alert" className="text-sm font-medium text-[#ff8a70]">
            {error}
          </p>
        )}
        {start.error && <AiErrorNotice error={start.error} onRetry={() => start.mutate(start.variables!)} />}
        <Button type="submit" size="lg" className="h-12 self-stretch px-6 text-base sm:self-start" disabled={start.isPending || !sources.data?.length}>
          {start.isPending ? <LoaderCircle className="size-5 animate-spin" aria-hidden /> : mode === "voice" ? <Mic className="size-5" aria-hidden /> : <Keyboard className="size-5" aria-hidden />}
          {start.isPending ? "Getting the interviewer ready…" : "Start interview"}
        </Button>
      </div>
    </form>
  );
}

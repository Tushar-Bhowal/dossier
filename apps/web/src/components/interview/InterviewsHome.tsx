"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import type { InterviewListItem } from "@dossier/core/interview";
import { AlertCircle, ChevronRight, Keyboard, LoaderCircle, Mic, Plus, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SampleBanner } from "@/components/demo/SampleBanner";
import { INTERVIEW_SAMPLE, interviewKeys, listInterviews } from "@/lib/interview/api";
import { cn } from "@/lib/utils";
import { SOURCE_META, minutesLabel, relativeDay, scoreTone } from "./parts";

function Status({ item }: { item: InterviewListItem }) {
  if (item.status === "graded" && item.overall !== null) {
    return (
      <span className="flex items-baseline gap-1 tabular-nums">
        <span className={cn("text-xl font-semibold", scoreTone(item.overall))}>{item.overall.toFixed(1)}</span>
        <span className="text-sm font-semibold text-white/45">/ 5</span>
      </span>
    );
  }
  const label = { live: "In progress", grading: "Scoring…", failed: "Couldn't score", abandoned: "Ended early", graded: "" }[item.status];
  return (
    <span
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-semibold",
        item.status === "failed" ? "bg-destructive/15 text-[#ff8a70]" : "bg-white/[0.06] text-white/70",
      )}
    >
      {item.status === "grading" && <LoaderCircle className="size-3.5 animate-spin motion-reduce:animate-none" aria-hidden />}
      {label}
    </span>
  );
}

function Row({ item }: { item: InterviewListItem }) {
  const ModeIcon = item.mode === "voice" ? Mic : Keyboard;
  const source = SOURCE_META[item.source.type];
  return (
    <li>
      <Link
        href={`/interviews/${item.id}`}
        className="group flex items-center gap-4 rounded-lg border border-white/[0.08] bg-[#111111] p-4 transition-colors hover:border-white/20 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring sm:p-5"
      >
        <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-white/[0.05] text-[#ff7a5c]">
          <ModeIcon className="size-5" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-semibold text-white group-hover:text-[#ff7a5c]">{item.source.label}</span>
          <span className="mt-0.5 block text-sm font-medium text-white/55">
            {source.label} · {item.questionCount} questions · {item.mode === "voice" ? "Spoken" : "Typed"}
            {item.durationSec > 0 ? ` · ${minutesLabel(item.durationSec)}` : ""}
          </span>
        </span>
        <span className="hidden shrink-0 text-sm font-medium text-white/50 sm:block">{relativeDay(item.createdAt)}</span>
        <span className="flex shrink-0 items-center gap-2">
          <Status item={item} />
          <ChevronRight className="size-5 text-white/35 group-hover:text-white" aria-hidden />
        </span>
      </Link>
    </li>
  );
}

const HOW = [
  ["Pick what to practise", "A roadmap, an interview kit, or questions about your own resume."],
  ["Answer out loud or by typing", "The interviewer asks one question at a time, and follows up like a real one."],
  ["Get a report", "Scores for each answer, with the exact words they're based on, and what to work on."],
];

export function InterviewsHome() {
  const list = useQuery({
    queryKey: interviewKeys.list,
    queryFn: listInterviews,
    refetchInterval: (q) => (q.state.data?.some((i) => i.status === "grading") ? 2000 : false),
  });
  const empty = list.data?.length === 0;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-[32px] font-semibold leading-tight tracking-[-0.035em] text-white">Mock interviews</h1>
          <p className="mt-2 max-w-2xl text-base leading-relaxed text-white/60">
            Practise with an interviewer, then get a report that quotes your own answers.
          </p>
        </div>
        {!empty && (
          <Button asChild size="lg" className="h-11 self-start sm:self-auto">
            <Link href="/interviews/new">
              <Plus className="size-4" aria-hidden />
              Start a mock interview
            </Link>
          </Button>
        )}
      </div>

      {INTERVIEW_SAMPLE && (
        <SampleBanner>The interviewer follows a script and scoring is a simple stand-in until mock interviews are connected. Nothing is saved.</SampleBanner>
      )}

      {list.isPending && (
        <div className="flex flex-col gap-3" role="status" aria-label="Loading interviews">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-[76px] w-full rounded-lg bg-white/[0.04]" />
          ))}
        </div>
      )}

      {list.isError && (
        <div role="alert" className="flex flex-col gap-4 rounded-lg border border-destructive/35 bg-destructive/10 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 size-5 shrink-0 text-destructive" aria-hidden />
            <div>
              <p className="text-[15px] font-semibold text-white">We couldn&apos;t load your interviews</p>
              <p className="mt-1 text-sm text-white/70">Your reports are safe. Try again in a moment.</p>
            </div>
          </div>
          <Button variant="outline" className="h-11 shrink-0 sm:h-10" onClick={() => void list.refetch()}>
            <RefreshCcw className="size-4" aria-hidden />
            Try again
          </Button>
        </div>
      )}

      {empty && (
        <section className="rounded-lg border border-white/[0.08] bg-[#111111] bg-[radial-gradient(80%_60%_at_50%_0%,rgba(251,65,40,0.10),transparent_60%)] px-6 py-12 sm:px-10 sm:py-14">
          <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
            <span className="flex size-12 items-center justify-center rounded-lg bg-[#dc3019] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.3)]">
              <Mic className="size-6" aria-hidden />
            </span>
            <h2 className="mt-5 text-2xl font-semibold tracking-[-0.03em] text-white">Rehearse before the real thing</h2>
            <p className="mt-2 text-[15px] leading-relaxed text-white/65">
              Ten minutes with a practice interviewer shows you what you actually say under pressure, and what to fix.
            </p>
            <Button asChild size="lg" className="mt-6 h-11 px-5">
              <Link href="/interviews/new">
                <Plus className="size-4" aria-hidden />
                Start a mock interview
              </Link>
            </Button>
          </div>
          <ol className="mx-auto mt-10 grid max-w-4xl gap-3 sm:grid-cols-3">
            {HOW.map(([title, body], i) => (
              <li key={title} className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-5">
                <span className="flex size-7 items-center justify-center rounded-lg bg-white/[0.06] text-[13px] font-bold text-white/80">{i + 1}</span>
                <p className="mt-3 text-[15px] font-semibold text-white">{title}</p>
                <p className="mt-1 text-sm leading-relaxed text-white/60">{body}</p>
              </li>
            ))}
          </ol>
        </section>
      )}

      {list.data && list.data.length > 0 && (
        <ul className="flex flex-col gap-3">
          {list.data.map((item) => (
            <Row key={item.id} item={item} />
          ))}
        </ul>
      )}
    </div>
  );
}

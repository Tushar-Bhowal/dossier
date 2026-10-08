"use client";

import * as React from "react";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { DeliveryMetrics, InterviewRecord, QuestionScore, Weakness } from "@dossier/core/interview";
import { AlertCircle, ChevronDown, ExternalLink, FileText, LoaderCircle, Mic, PlayCircle, Quote, RefreshCcw, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SampleBanner } from "@/components/demo/SampleBanner";
import { AiProgress } from "@/components/resume/AiStatus";
import { BackLink } from "@/components/roadmap/RoadmapView";
import { INTERVIEW_SAMPLE, interviewKeys, retryGrading } from "@/lib/interview/api";
import { cn } from "@/lib/utils";
import { CRITERIA, SOURCE_META, ScoreDots, minutesLabel, relativeDay, scoreTone } from "./parts";

const SCORING_STEPS = [
  "Reading your answers",
  "Scoring each answer on four things",
  "Picking the words each score is based on",
  "Working out your pace and filler words",
  "Choosing what to work on first",
];

export function againHref(record: InterviewRecord): string {
  return `/interviews/new?${record.source.type}=${encodeURIComponent(record.source.id)}`;
}

function Header({ record }: { record: InterviewRecord }) {
  const source = SOURCE_META[record.source.type];
  return (
    <div className="flex flex-col gap-3">
      <BackLink href="/interviews">Mock interviews</BackLink>
      <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.03em] text-white sm:text-[32px]">{record.source.label}</h1>
      <p className="text-[15px] font-medium text-white/55">
        {source.label} · {relativeDay(record.createdAt)} · {record.mode === "voice" ? "Spoken" : "Typed"} · {record.questions.length} questions
        {record.durationSec > 0 ? ` · ${minutesLabel(record.durationSec)}` : ""}
      </p>
    </div>
  );
}

function Pace({ delivery }: { delivery: DeliveryMetrics }) {
  const wpm = delivery.wordsPerMinute;
  const position = Math.min(100, (wpm / 220) * 100);
  const verdict = wpm === 0 ? "Not enough speech to measure" : wpm < 110 ? "A little slow" : wpm > 170 ? "Quite fast" : "A comfortable pace";
  return (
    <div className="rounded-lg border border-white/[0.08] bg-[#121212] p-5">
      <p className="text-sm font-semibold text-white/55">Pace</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-white">
        {wpm} <span className="text-base font-semibold text-white/50">words a minute</span>
      </p>
      <p className="mt-0.5 text-sm font-medium text-white/65">{verdict}</p>
      <div className="relative mt-4 h-2 rounded-full bg-white/[0.06]" aria-hidden>
        <div className="absolute inset-y-0 rounded-full bg-emerald-500/30" style={{ left: `${(120 / 220) * 100}%`, width: `${(40 / 220) * 100}%` }} />
        <div className="absolute -top-1 size-4 -translate-x-1/2 rounded-full border-2 border-[#111] bg-white" style={{ left: `${position}%` }} />
      </div>
      <p className="mt-2 text-[13px] font-medium text-white/50">Most listeners find 120–160 easy to follow.</p>
    </div>
  );
}

function Delivery({ delivery }: { delivery: DeliveryMetrics }) {
  return (
    <section aria-labelledby="delivery" className="flex flex-col gap-3">
      <h2 id="delivery" className="text-lg font-semibold tracking-[-0.02em] text-white">
        How you came across
      </h2>
      <div className="grid gap-3 md:grid-cols-3">
        <Pace delivery={delivery} />
        <div className="rounded-lg border border-white/[0.08] bg-[#121212] p-5">
          <p className="text-sm font-semibold text-white/55">Filler words</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-white">
            {delivery.fillerCount} <span className="text-base font-semibold text-white/50">in total</span>
          </p>
          <p className="mt-0.5 text-sm font-medium text-white/65">
            {delivery.fillersPerMinute} a minute{delivery.fillersPerMinute > 3 ? ", enough to notice" : ""}
          </p>
          {delivery.topFillers.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {delivery.topFillers.map((f) => (
                <li key={f.word} className="rounded-lg bg-white/[0.06] px-2.5 py-1 text-[13px] font-semibold text-white/80">
                  &ldquo;{f.word}&rdquo; × {f.count}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-lg border border-white/[0.08] bg-[#121212] p-5">
          <p className="text-sm font-semibold text-white/55">Longest answer</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-white">
            {Math.floor(delivery.longestAnswerSec / 60)}:{String(delivery.longestAnswerSec % 60).padStart(2, "0")}
          </p>
          <p className="mt-0.5 text-sm font-medium text-white/65">{delivery.longestAnswerSec > 150 ? "Try to land answers within 2 minutes" : "Well within 2 minutes"}</p>
        </div>
      </div>
    </section>
  );
}

function WeaknessCard({ weakness, addAction }: { weakness: Weakness; addAction?: React.ReactNode }) {
  const r = weakness.resource;
  const Icon = r?.kind === "video" ? PlayCircle : FileText;
  return (
    <li className="flex flex-col gap-3 rounded-lg border border-white/[0.08] bg-[#121212] p-5">
      <p className="text-[15px] font-semibold text-white">{weakness.title}</p>
      <p className="text-sm leading-relaxed text-white/65">{weakness.why}</p>
      {r && (
        <a
          href={r.url}
          target="_blank"
          rel="noreferrer"
          className="mt-auto flex items-center gap-3 rounded-lg bg-white/[0.04] p-3 transition-colors hover:bg-white/[0.07]"
        >
          <Icon className="size-4 shrink-0 text-[#ff7a5c]" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-white/90">{r.title}</span>
            <span className="text-[13px] font-medium text-white/50">
              {r.publisher}
              {r.minutes ? ` · ${r.minutes} min` : ""}
            </span>
          </span>
          <ExternalLink className="size-4 shrink-0 text-white/40" aria-hidden />
          <span className="sr-only">(opens in a new tab)</span>
        </a>
      )}
      {addAction}
    </li>
  );
}

function QuestionCard({ score, answer, index }: { score: QuestionScore; answer: string; index: number }) {
  const [open, setOpen] = React.useState(false);
  const average = score.scores.length ? score.scores.reduce((n, s) => n + s.score, 0) / score.scores.length : 0;
  return (
    <li className="rounded-lg border border-white/[0.08] bg-[#111111]">
      <div className="flex items-start gap-4 border-b border-white/[0.06] p-5">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] text-sm font-bold text-white/80">{index + 1}</span>
        <p className="min-w-0 flex-1 text-base font-semibold leading-snug text-white">{score.prompt}</p>
        {score.answered && <span className={cn("shrink-0 text-lg font-semibold tabular-nums", scoreTone(average))}>{average.toFixed(1)}</span>}
      </div>
      {!score.answered ? (
        <p className="p-5 text-[15px] text-white/60">Not answered, so not scored.</p>
      ) : (
        <div className="flex flex-col gap-5 p-5">
          <ul className="grid gap-4 md:grid-cols-2">
            {score.scores.map((s) => (
              <li key={s.criterion} className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold text-white">{CRITERIA[s.criterion].label}</span>
                  <ScoreDots score={s.score} label={CRITERIA[s.criterion].label} />
                </div>
                <p className="text-sm leading-relaxed text-white/70">{s.note}</p>
                <blockquote className="flex gap-2 rounded-lg border-l-2 border-[#ff7a5c]/60 bg-white/[0.03] py-2 pl-3 pr-3 text-sm leading-relaxed text-white/80">
                  <Quote className="mt-0.5 size-3.5 shrink-0 text-white/40" aria-hidden />
                  <span>
                    <span className="sr-only">You said: </span>
                    {s.evidence}
                  </span>
                </blockquote>
              </li>
            ))}
          </ul>
          <button
            type="button"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="inline-flex h-10 items-center gap-1.5 self-start text-sm font-semibold text-[#ff7a5c] hover:text-[#ff9478]"
          >
            <ChevronDown className={cn("size-4 transition-transform motion-reduce:transition-none", open && "rotate-180")} aria-hidden />
            {open ? "Hide your full answer" : "Show your full answer"}
          </button>
          {open && <p className="rounded-lg bg-white/[0.03] p-4 text-[15px] leading-relaxed text-white/75">{answer}</p>}
        </div>
      )}
    </li>
  );
}

export function InterviewReportView({ record, weaknessAction }: { record: InterviewRecord; weaknessAction?: (w: Weakness) => React.ReactNode }) {
  const queryClient = useQueryClient();
  const retry = useMutation({
    mutationFn: () => retryGrading(record.id),
    onSuccess: (next) => queryClient.setQueryData(interviewKeys.one(record.id), next),
  });

  if (record.status === "grading") {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
        <Header record={record} />
        <div className="rounded-lg border border-white/[0.08] bg-[#111111] bg-[radial-gradient(90%_70%_at_0%_0%,rgba(251,65,40,0.10),transparent_60%)] p-6 sm:p-8">
          <p className="text-[15px] font-semibold text-white">Scoring your interview</p>
          <p className="mt-1 text-sm text-white/60">Usually under a minute. You can leave; the report will be in Mock interviews.</p>
          <AiProgress steps={SCORING_STEPS} className="mt-6" />
        </div>
      </div>
    );
  }

  if (record.status === "failed" || record.status === "abandoned") {
    const failed = record.status === "failed";
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
        <Header record={record} />
        <div role="alert" className={cn("flex flex-col gap-4 rounded-lg border p-6", failed ? "border-destructive/35 bg-destructive/10" : "border-white/[0.08] bg-[#111111]")}>
          <div className="flex items-start gap-3">
            <AlertCircle className={cn("mt-0.5 size-5 shrink-0", failed ? "text-destructive" : "text-white/60")} aria-hidden />
            <div>
              <p className="text-[15px] font-semibold text-white">{failed ? "We couldn't score this interview" : "This interview ended before any answers"}</p>
              <p className="mt-1 text-sm leading-relaxed text-white/70">
                {failed ? "Your answers are saved. Try scoring again; it usually works." : "There's nothing to score yet. Start again whenever you're ready."}
              </p>
            </div>
          </div>
          {failed ? (
            <Button className="h-11 self-start" onClick={() => retry.mutate()} disabled={retry.isPending}>
              {retry.isPending ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <RefreshCcw className="size-4" aria-hidden />}
              Score again
            </Button>
          ) : (
            <Button asChild className="h-11 self-start">
              <Link href={againHref(record)}>
                <Mic className="size-4" aria-hidden />
                Start again
              </Link>
            </Button>
          )}
        </div>
      </div>
    );
  }

  const report = record.report;
  if (!report) return null;
  const answers = new Map(
    record.questions.map((q) => [
      q.id,
      record.turns
        .filter((t) => t.role === "candidate" && t.questionId === q.id)
        .map((t) => t.text)
        .join(" "),
    ]),
  );

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
      <Header record={record} />
      {INTERVIEW_SAMPLE && <SampleBanner>Scores come from a simple stand-in until real scoring is connected, but every quote is your own words.</SampleBanner>}

      <section className="flex flex-col gap-6 rounded-lg border border-white/[0.08] bg-[#111111] bg-[radial-gradient(70%_90%_at_0%_0%,rgba(251,65,40,0.12),transparent_60%)] p-6 sm:flex-row sm:items-center sm:p-8">
        <div className="flex items-baseline gap-1.5">
          <span className={cn("text-[56px] font-semibold leading-none tracking-[-0.04em] tabular-nums", scoreTone(report.overall))}>{report.overall.toFixed(1)}</span>
          <span className="text-xl font-semibold text-white/45">/ 5</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xl font-semibold leading-snug text-white">{report.headline}</p>
          <p className="mt-1.5 text-sm leading-relaxed text-white/60">
            Each answer is scored on structure, depth, specific examples and delivery. Every score shows the words it&apos;s based on.
          </p>
        </div>
        <Button asChild size="lg" className="h-11 shrink-0">
          <Link href={againHref(record)}>
            <RotateCcw className="size-4" aria-hidden />
            Practise again
          </Link>
        </Button>
      </section>

      {report.weaknesses.length > 0 && (
        <section aria-labelledby="work-on" className="flex flex-col gap-3">
          <h2 id="work-on" className="text-lg font-semibold tracking-[-0.02em] text-white">
            What to work on
          </h2>
          <ul className="grid gap-3 md:grid-cols-3">
            {report.weaknesses.map((w) => (
              <WeaknessCard key={w.id} weakness={w} addAction={weaknessAction?.(w)} />
            ))}
          </ul>
        </section>
      )}

      {report.delivery ? (
        <Delivery delivery={report.delivery} />
      ) : (
        <p className="rounded-lg border border-white/[0.08] bg-white/[0.02] px-4 py-3 text-sm font-medium text-white/60">
          Pace and filler words are only measured when you answer out loud.
        </p>
      )}

      <section aria-labelledby="by-question" className="flex flex-col gap-3">
        <h2 id="by-question" className="text-lg font-semibold tracking-[-0.02em] text-white">
          Question by question
        </h2>
        <ol className="flex flex-col gap-4">
          {report.questions.map((q, i) => (
            <QuestionCard key={q.questionId} score={q} answer={answers.get(q.questionId) ?? ""} index={i} />
          ))}
        </ol>
      </section>
    </div>
  );
}

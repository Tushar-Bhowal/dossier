"use client";

import * as React from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, FileText, LoaderCircle, RefreshCcw } from "lucide-react";
import { renderDataText, toRenderData, type TailoringState } from "@dossier/core/resume";
import { continueTailoring, getProfile, getResume, resumeKeys, startTailoring } from "@/lib/resume/api";
import { DEMO_UI, useScenario } from "@/lib/resume/demo/scenario";
import { fixtureFor } from "@/lib/resume/demo/store";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AiErrorNotice, AiProgress } from "../AiStatus";
import { panelClass } from "../parts";
import { TailorStart } from "./TailorStart";
import { MatchReport } from "./MatchReport";
import { ProposalDiff, type Decision } from "./ProposalDiff";
import { GapQuestions } from "./GapQuestions";

const START_STEPS = [
  "Reading the job's requirements",
  "Finding your evidence for each one",
  "Checking every suggested change against your facts",
  "Preparing your review",
];
const CONTINUE_STEPS = ["Applying the changes you accepted", "Turning your answers into facts", "Checking the new suggestions"];

export function TailorFlow({
  resumeId,
  kit,
}: {
  resumeId: string;
  kit: { id: string; role: string; company: string } | null;
}) {
  const queryClient = useQueryClient();
  const scenario = useScenario();
  const [target, setTarget] = React.useState({ jdText: "", company: kit?.company ?? "", role: kit?.role ?? "" });
  const [state, setState] = React.useState<TailoringState | null>(null);
  const [decisions, setDecisions] = React.useState<Record<string, Decision>>({});
  const [answers, setAnswers] = React.useState<Record<string, string>>({});

  const base = useQuery({ queryKey: resumeKeys.resume(resumeId), queryFn: () => getResume(resumeId) });
  const profile = useQuery({ queryKey: resumeKeys.profile, queryFn: getProfile });
  const tailored = useQuery({
    queryKey: resumeKeys.resume(state?.tailoredResumeId ?? "none"),
    queryFn: () => getResume(state!.tailoredResumeId),
    enabled: Boolean(state && state.status !== "failed"),
  });

  const start = useMutation({
    mutationFn: (t: typeof target) =>
      startTailoring({
        resumeId,
        target: {
          jdText: t.jdText,
          ...(t.company ? { company: t.company } : {}),
          ...(t.role ? { role: t.role } : {}),
          ...(kit ? { kitId: kit.id } : {}),
        },
      }),
    onSuccess: (s) => {
      setState(s);
      setDecisions({});
      setAnswers({});
      void queryClient.invalidateQueries({ queryKey: resumeKeys.list });
    },
  });

  const proceed = useMutation({
    mutationFn: (finish: boolean) => {
      if (!state) throw new Error("no session");
      const pending = state.proposals.filter((p) => p.status === "pending");
      return continueTailoring(state.sessionId, {
        accepted: pending.filter((p) => decisions[p.id] === "accepted").map((p) => p.id),
        rejected: pending.filter((p) => decisions[p.id] === "rejected").map((p) => p.id),
        answers: Object.entries(answers)
          .filter(([, v]) => v.trim())
          .map(([questionId, v]) => ({ questionId, text: v.trim() })),
        finish,
      });
    },
    onSuccess: (s) => {
      setState(s);
      setDecisions({});
      setAnswers({});
      void queryClient.invalidateQueries({ queryKey: resumeKeys.all });
    },
  });

  const resumeText = React.useMemo(
    () => (tailored.data && profile.data ? renderDataText(toRenderData(profile.data, tailored.data)) : ""),
    [tailored.data, profile.data],
  );
  const facts = React.useMemo(() => new Map((profile.data?.facts ?? []).map((f) => [f.id, f])), [profile.data]);
  const requirements = React.useMemo(() => new Map((state?.requirements ?? []).map((r) => [r.id, r])), [state]);

  if (base.isLoading || profile.isLoading) return <Skeleton className="h-96 w-full rounded-lg" />;
  if (base.error || !base.data) return <AiErrorNotice error={base.error} onRetry={() => void base.refetch()} />;

  const backLink = (
    <Link
      href={`/resumes/${resumeId}`}
      className="inline-flex items-center gap-1.5 self-start rounded-lg px-2 py-1.5 text-sm font-medium text-white/60 transition-colors hover:text-white"
    >
      <ArrowLeft className="size-4" />
      Back to {base.data.title}
    </Link>
  );

  if (start.isPending) {
    return (
      <div className="flex flex-col gap-4">
        {backLink}
        <AiProgress steps={START_STEPS} />
      </div>
    );
  }

  if (!state) {
    return (
      <div className="flex flex-col gap-4">
        {backLink}
        {start.error && <AiErrorNotice error={start.error} onRetry={() => start.mutate(target)} />}
        <TailorStart
          baseTitle={base.data.title}
          initial={target}
          fromKit={Boolean(kit)}
          example={DEMO_UI ? fixtureFor(scenario.persona).tailoring.target : undefined}
          onStart={(t) => {
            setTarget(t);
            start.mutate(t);
          }}
        />
      </div>
    );
  }

  if (state.status === "failed") {
    return (
      <div className="flex flex-col gap-4">
        {backLink}
        <div role="alert" className={panelClass}>
          <h2 className="text-[22px] font-semibold text-white">We couldn&apos;t tailor this resume</h2>
          <p className="mt-2 text-base leading-relaxed text-white/65">
            Something went wrong while matching it to the job. Your original resume hasn&apos;t changed.
          </p>
          <Button className="mt-6" onClick={() => start.mutate(target)}>
            <RefreshCcw className="size-4" />
            Try again
          </Button>
        </div>
      </div>
    );
  }

  if (state.status === "done") {
    const accepted = state.proposals.filter((p) => p.status === "accepted").length;
    return (
      <div className="flex flex-col gap-4">
        {backLink}
        <div className={panelClass}>
          <CheckCircle2 className="size-10 text-emerald-400" aria-hidden />
          <h2 className="mt-4 text-[26px] font-semibold tracking-[-0.03em] text-white">Your tailored resume is ready</h2>
          <p className="mt-2 text-base leading-relaxed text-white/65">
            {accepted} change{accepted === 1 ? "" : "s"} applied · {state.mustCovered} of {state.mustTotal} must-haves covered.
            Your original resume is unchanged.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link href={`/resumes/${state.tailoredResumeId}`}>
                <FileText className="size-4" />
                Open tailored resume
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href={`/resumes/${resumeId}`}>Back to the original</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const pending = state.proposals.filter((p) => p.status === "pending");
  const undecided = pending.filter((p) => !decisions[p.id]).length;
  const answered = Object.values(answers).filter((v) => v.trim()).length;

  return (
    <div className="flex flex-col gap-4">
      {backLink}
      {proceed.error && <AiErrorNotice error={proceed.error} onRetry={() => proceed.mutate(proceed.variables ?? false)} />}

      {proceed.isPending ? (
        <AiProgress steps={CONTINUE_STEPS} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)]">
          <MatchReport state={state} resumeText={resumeText} />
          <div className="flex flex-col gap-4">
            <section className="rounded-lg border border-white/[0.08] bg-[#111111] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
              <h2 className="text-lg font-semibold text-white">Suggested changes</h2>
              <p className="mt-1 text-sm leading-relaxed text-white/60">
                Accept the ones that are true and useful. Anything you skip stays as it is.
              </p>
              {state.proposals.length === 0 ? (
                <p className="mt-4 text-sm font-medium text-white/60">No changes to suggest right now.</p>
              ) : (
                <ul className="mt-4 flex flex-col gap-3">
                  {state.proposals.map((p) => (
                    <ProposalDiff
                      key={p.id}
                      proposal={p}
                      facts={facts}
                      requirements={requirements}
                      decision={decisions[p.id]}
                      onDecide={(d) =>
                        setDecisions((all) => {
                          const next = { ...all };
                          if (d) next[p.id] = d;
                          else delete next[p.id];
                          return next;
                        })
                      }
                    />
                  ))}
                </ul>
              )}
            </section>
            <GapQuestions questions={state.questions} answers={answers} onAnswer={(id, v) => setAnswers((a) => ({ ...a, [id]: v }))} />
          </div>
        </div>
      )}

      <div className="sticky bottom-0 z-20 -mx-4 border-t border-white/[0.08] bg-background/90 px-4 py-3 backdrop-blur-xl md:-mx-8 md:px-8">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-medium text-white/65">
            Round {state.round}
            {pending.length > 0 && ` · ${pending.length - undecided} of ${pending.length} changes decided`}
            {answered > 0 && ` · ${answered} answer${answered === 1 ? "" : "s"}`}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => proceed.mutate(false)}
              disabled={proceed.isPending || (pending.length - undecided === 0 && answered === 0)}
            >
              {proceed.isPending && <LoaderCircle className="size-4 animate-spin" />}
              Apply and continue
            </Button>
            <Button onClick={() => proceed.mutate(true)} disabled={proceed.isPending}>
              Finish
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

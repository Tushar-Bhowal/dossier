"use client";

import { CheckCircle2, Circle, Target } from "lucide-react";
import { termCoverage, type TailoringState, type Verdict } from "@dossier/core/resume";
import { cn } from "@/lib/utils";

const VERDICT: Record<Verdict, { label: string; className: string }> = {
  covered: { label: "Covered", className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" },
  partial: { label: "Partly", className: "border-amber-500/30 bg-amber-500/10 text-amber-200" },
  missing: { label: "Missing", className: "border-destructive/35 bg-destructive/10 text-red-300" },
};

export function MatchReport({ state, resumeText }: { state: TailoringState; resumeText: string }) {
  const terms = termCoverage(state.terms, resumeText);
  const verdicts = new Map(state.verdicts.map((v) => [v.requirementId, v]));

  return (
    <section className="rounded-lg border border-white/[0.08] bg-[#111111] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-[#ff7a5c] ring-1 ring-primary/25">
          <Target className="size-[18px]" aria-hidden />
        </span>
        <div>
          <h2 className="text-lg font-semibold text-white">How your resume matches</h2>
          <p className="mt-1 text-sm leading-relaxed text-white/60">
            Every verdict quotes the line it&apos;s based on. No made-up score.
          </p>
        </div>
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4">
          <dd className="text-[26px] font-semibold tabular-nums tracking-[-0.02em] text-white">
            {state.mustCovered}
            <span className="text-white/40"> / {state.mustTotal}</span>
          </dd>
          <dt className="text-[13px] font-semibold text-white/60">Must-haves covered</dt>
        </div>
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4">
          <dd className="text-[26px] font-semibold tabular-nums tracking-[-0.02em] text-white">
            {terms.found.length}
            <span className="text-white/40"> / {state.terms.length}</span>
          </dd>
          <dt className="text-[13px] font-semibold text-white/60">Recruiter search terms found</dt>
        </div>
      </dl>

      <div className="mt-4">
        <p className="text-[13px] font-medium leading-relaxed text-white/50">
          The exact words recruiters filter on, counted in your resume text as it is right now. Same resume, same count.
        </p>
        <ul className="mt-2 flex flex-wrap gap-2">
          {state.terms.map((t) => {
            const found = terms.found.includes(t);
            return (
              <li
                key={`${t.requirementId}-${t.term}`}
                className={cn(
                  "inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[13px] font-semibold",
                  found ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200" : "border-white/10 bg-white/[0.03] text-white/55",
                )}
              >
                {found ? <CheckCircle2 className="size-3.5" aria-hidden /> : <Circle className="size-3.5" aria-hidden />}
                {t.term}
                <span className="sr-only">{found ? "found" : "not found"}</span>
              </li>
            );
          })}
        </ul>
      </div>

      <ol className="mt-5 flex flex-col gap-3">
        {state.requirements.map((req) => {
          const v = verdicts.get(req.id);
          const style = VERDICT[v?.verdict ?? "missing"];
          return (
            <li key={req.id} className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className={cn("inline-flex h-6 items-center rounded-lg border px-2 text-xs font-bold", style.className)}>
                  {style.label}
                </span>
                <span className="text-[13px] font-semibold text-white/50">{req.priority === "must" ? "Must-have" : "Nice to have"}</span>
              </div>
              <p className="mt-2 text-[15px] font-semibold text-white">{req.text}</p>
              {v?.evidence.map((e) => (
                <blockquote key={e.quote} className="mt-2 border-l-2 border-white/15 pl-3 text-sm leading-relaxed text-white/70">
                  “{e.quote}”
                </blockquote>
              ))}
              {v?.note && <p className="mt-2 text-sm leading-relaxed text-white/60">{v.note}</p>}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

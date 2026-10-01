"use client";

import * as React from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Check, CheckCircle2, GraduationCap, LoaderCircle, TrendingUp, X } from "lucide-react";
import {
  applyBulletChange,
  termMatches,
  type CareerProfile,
  type MarketTermChoice,
  type Proposal,
  type Resume,
  type Section,
} from "@dossier/core/resume";
import { answerMarketTerms, getMarketTerms, resumeKeys } from "@/lib/resume/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { AiErrorNotice } from "../AiStatus";

type ChoiceKind = MarketTermChoice["choice"];

const CHOICES: { value: ChoiceKind; label: string }[] = [
  { value: "used", label: "I've used it" },
  { value: "practised", label: "I've only practised it" },
  { value: "learn", label: "Add to skills to learn" },
  { value: "add-anyway", label: "Add to my resume anyway" },
];

function addSkills(resume: Resume, names: string[]): Resume {
  if (!names.length) return resume;
  const existing = resume.sections.find((s) => s.kind === "skills");
  if (!existing) {
    const section: Section = { id: `${resume.id}-skills`, kind: "skills", title: "Skills", hidden: false, skills: names };
    return { ...resume, sections: [...resume.sections, section] };
  }
  return {
    ...resume,
    sections: resume.sections.map((s) => {
      if (s.kind !== "skills") return s;
      const have = new Set(s.skills.map((x) => x.toLowerCase()));
      return { ...s, skills: [...s.skills, ...names.filter((n) => !have.has(n.toLowerCase()))] };
    }),
  };
}

export function MarketTerms({
  resume,
  profile,
  resumeText,
  edit,
  onProfileChanged,
}: {
  resume: Resume;
  profile: CareerProfile;
  resumeText: string;
  edit: (fn: (r: Resume) => Resume) => void;
  onProfileChanged: () => void;
}) {
  const role = profile.canonicalRole ?? "Professional";
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: resumeKeys.market(role, profile.region),
    queryFn: () => getMarketTerms(role, profile.region),
  });

  const [choices, setChoices] = React.useState<Record<string, { choice: ChoiceKind; where: string }>>({});
  const [proposals, setProposals] = React.useState<Proposal[]>([]);

  const picked = Object.entries(choices);
  const incomplete = picked.some(([, c]) => (c.choice === "used" || c.choice === "practised") && c.where.trim().length < 3);

  const mutation = useMutation({
    mutationFn: () =>
      answerMarketTerms({
        resumeId: resume.id,
        choices: picked.map(([term, c]): MarketTermChoice =>
          c.choice === "used" || c.choice === "practised" ? { choice: c.choice, term, where: c.where.trim() } : { choice: c.choice, term },
        ),
      }),
    onSuccess: (result) => {
      edit((r) => addSkills(r, result.skills.map((s) => s.name)));
      setProposals((p) => [...p, ...result.proposals]);
      setChoices({});
      onProfileChanged();
    },
  });

  const decide = (proposal: Proposal, accept: boolean) => {
    if (accept) edit((r) => applyBulletChange(r, proposal.change) ?? r);
    setProposals((all) => all.filter((p) => p.id !== proposal.id));
  };

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-lg border border-white/[0.08] bg-[#111111] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-[#ff7a5c] ring-1 ring-primary/25">
            <TrendingUp className="size-[18px]" aria-hidden />
          </span>
          <div>
            <h2 className="text-lg font-semibold text-white">What recruiters are asking for</h2>
            <p className="mt-1 text-sm leading-relaxed text-white/60">
              Counted from real recent job postings for {role} {profile.region === "IN" ? "in India" : "outside India"} —
              not a guess. Only add what you can talk about in an interview.
            </p>
          </div>
        </div>

        {isLoading && <Skeleton className="mt-4 h-40 w-full rounded-lg" />}
        {error && <AiErrorNotice className="mt-4" error={error} onRetry={() => void refetch()} />}

        {data?.status === "not_enough_data" && (
          <p className="mt-4 rounded-lg border border-white/[0.06] bg-white/[0.02] p-4 text-sm leading-relaxed text-white/70">
            We only found {data.postingCount} recent postings for this role — too few to say what recruiters want. We&apos;d
            rather show nothing than guess.
          </p>
        )}

        {data?.status === "ready" && (
          <>
            <p className="mt-4 text-[13px] font-medium text-white/50">
              Based on {data.postingCount} postings · updated{" "}
              {new Date(data.fetchedAt).toLocaleDateString(undefined, { day: "numeric", month: "short" })}
            </p>
            <ul className="mt-3 flex flex-col gap-2">
              {data.terms.map((t) => {
                const onResume = termMatches(resumeText, t.term);
                const current = choices[t.term];
                return (
                  <li key={t.term} className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="text-[15px] font-semibold text-white">{t.term}</span>
                      <span className="text-sm font-medium text-white/55">
                        in {t.count} of {data.postingCount} postings
                      </span>
                      <span className="h-1.5 w-24 overflow-hidden rounded-full bg-white/10" aria-hidden>
                        <span className="block h-full rounded-full bg-[#ff7a5c]" style={{ width: `${(t.count / data.postingCount) * 100}%` }} />
                      </span>
                      {onResume && (
                        <span className="ml-auto flex items-center gap-1.5 text-sm font-semibold text-emerald-300">
                          <CheckCircle2 className="size-4" aria-hidden />
                          On your resume
                        </span>
                      )}
                    </div>

                    {!onResume && (
                      <div className="mt-3 flex flex-col gap-2">
                        <p className="text-sm font-medium text-white/70">Have you used {t.term}?</p>
                        <div className="flex flex-wrap gap-2" role="group" aria-label={`Your answer for ${t.term}`}>
                          {CHOICES.map((c) => (
                            <button
                              key={c.value}
                              type="button"
                              aria-pressed={current?.choice === c.value}
                              onClick={() =>
                                setChoices((all) => {
                                  if (all[t.term]?.choice === c.value) {
                                    const next = { ...all };
                                    delete next[t.term];
                                    return next;
                                  }
                                  return { ...all, [t.term]: { choice: c.value, where: all[t.term]?.where ?? "" } };
                                })
                              }
                              className={cn(
                                "h-9 rounded-lg border px-3 text-sm font-semibold transition-colors",
                                current?.choice === c.value
                                  ? "border-primary/50 bg-primary/15 text-white"
                                  : c.value === "add-anyway"
                                    ? "border-white/[0.06] text-white/50 hover:text-white/80"
                                    : "border-white/10 bg-white/[0.03] text-white/75 hover:text-white",
                              )}
                            >
                              {c.label}
                            </button>
                          ))}
                        </div>
                        {(current?.choice === "used" || current?.choice === "practised") && (
                          <Input
                            value={current.where}
                            onChange={(e) =>
                              setChoices((all) => ({ ...all, [t.term]: { choice: current.choice, where: e.target.value } }))
                            }
                            placeholder={
                              current.choice === "used"
                                ? `Where? e.g. "Used ${t.term} to … at …"`
                                : `How? e.g. "Built a practice project with ${t.term}"`
                            }
                            maxLength={300}
                            aria-label={`Where you used ${t.term}`}
                            className="h-10"
                          />
                        )}
                        {current?.choice === "add-anyway" && (
                          <p className="text-[13px] font-medium leading-relaxed text-amber-200/90">
                            It goes in your Skills list only, marked as added by you — we won&apos;t write experience lines
                            about it. Interviewers often ask about every skill listed, so be ready to discuss it.
                          </p>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>

            {mutation.error && <AiErrorNotice className="mt-4" error={mutation.error} onRetry={() => mutation.mutate()} />}

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button onClick={() => mutation.mutate()} disabled={picked.length === 0 || incomplete || mutation.isPending}>
                {mutation.isPending && <LoaderCircle className="size-4 animate-spin" />}
                Save my answers{picked.length ? ` (${picked.length})` : ""}
              </Button>
              {incomplete && <span className="text-[13px] font-medium text-amber-300">Say where for each one you&apos;ve used.</span>}
            </div>
          </>
        )}
      </section>

      {proposals.length > 0 && (
        <section className="rounded-lg border border-white/[0.08] bg-[#111111] p-5">
          <h3 className="text-base font-semibold text-white">Suggested new lines from your answers</h3>
          <ul className="mt-3 flex flex-col gap-2">
            {proposals.map((p) => (
              <li key={p.id} className="flex flex-col gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] p-4 sm:flex-row sm:items-center">
                <p className="flex-1 text-[15px] font-medium text-white">{p.change.text}</p>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => decide(p, true)}>
                    <Check className="size-3.5" />
                    Add line
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => decide(p, false)}>
                    <X className="size-3.5" />
                    Skip
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {profile.skillsToLearn.length > 0 && (
        <section className="rounded-lg border border-white/[0.08] bg-[#111111] p-5">
          <div className="flex flex-wrap items-center gap-2">
            <GraduationCap className="size-[18px] text-[#ff7a5c]" aria-hidden />
            <h3 className="text-base font-semibold text-white">Skills to learn</h3>
            <Badge variant="outline">Roadmaps — Coming soon</Badge>
          </div>
          <p className="mt-1 text-sm text-white/60">Not on your resume. Learn them first, then come back and add them with an example.</p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {profile.skillsToLearn.map((s) => (
              <li key={s} className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-sm font-semibold text-white/85">
                {s}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

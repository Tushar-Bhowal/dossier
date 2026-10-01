"use client";

import type { GapQuestion } from "@dossier/core/resume";
import { Input } from "@/components/ui/input";
import { Chip } from "../parts";

export function GapQuestions({
  questions,
  answers,
  onAnswer,
}: {
  questions: GapQuestion[];
  answers: Record<string, string>;
  onAnswer: (id: string, text: string) => void;
}) {
  if (!questions.length) return null;

  return (
    <section className="rounded-lg border border-white/[0.08] bg-[#111111] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
      <h2 className="text-lg font-semibold text-white">Questions about the gaps</h2>
      <p className="mt-1 text-sm leading-relaxed text-white/60">
        If you&apos;ve done it, say where — your answer becomes a fact we can use. If you haven&apos;t, say &ldquo;Not
        yet&rdquo; and we won&apos;t add anything.
      </p>
      <ol className="mt-4 flex flex-col gap-3">
        {questions.map((q) => {
          const value = answers[q.id] ?? "";
          return (
            <li key={q.id} className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4">
              <label htmlFor={`gap-${q.id}`} className="text-[15px] font-semibold leading-snug text-white">
                {q.text}
              </label>
              {q.examples.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {q.examples.map((ex) => (
                    <Chip key={ex} selected={value === ex} onClick={() => onAnswer(q.id, value === ex ? "" : ex)}>
                      {ex}
                    </Chip>
                  ))}
                </div>
              )}
              <Input
                id={`gap-${q.id}`}
                value={value}
                onChange={(e) => onAnswer(q.id, e.target.value)}
                placeholder="Where and how, in your own words"
                maxLength={1000}
                className="mt-3 h-11"
              />
            </li>
          );
        })}
      </ol>
    </section>
  );
}

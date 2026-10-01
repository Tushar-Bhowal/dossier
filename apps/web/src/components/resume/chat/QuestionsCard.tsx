"use client";

import * as React from "react";
import { PenLine } from "lucide-react";
import type { FollowUpQuestion } from "@dossier/core/resume";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Chip, DictationButton } from "../parts";
import { CardTitle, DoneSummary, cardClass } from "./Thread";

export function QuestionsCard({
  questions,
  answers,
  onAnswer,
  generic,
  lang,
  done,
  onSubmit,
}: {
  questions: FollowUpQuestion[];
  answers: Record<string, string>;
  onAnswer: (id: string, text: string) => void;
  generic: boolean;
  lang: string;
  done: boolean;
  onSubmit: () => void;
}) {
  // Typing is the slow path, so the box only appears when the chips don't fit.
  const [typing, setTyping] = React.useState<Set<string>>(new Set());
  const answered = questions.filter((q) => answers[q.id]?.trim()).length;

  if (done) {
    return (
      <DoneSummary>
        {answered === 0 ? "Skipped the questions" : `Answered ${answered} of ${questions.length} questions`}
      </DoneSummary>
    );
  }

  return (
    <div className={cardClass}>
      <CardTitle
        title="A few quick questions"
        note={
          generic
            ? "I don't have questions for your exact role yet, so these are general. Skip anything — nothing gets made up."
            : "Tap an answer, or write your own in any language. Skip anything you don't know — nothing gets made up."
        }
      />
      <ol className="flex flex-col divide-y divide-white/[0.06]">
        {questions.map((q, i) => {
          const value = answers[q.id] ?? "";
          const custom = Boolean(value) && !q.examples.includes(value);
          const showInput = q.examples.length === 0 || custom || typing.has(q.id);
          return (
            <li key={q.id} className="py-4 first:pt-0 last:pb-0">
              <p id={`q-${q.id}-label`} className="flex gap-2 text-[15px] font-semibold leading-snug text-white">
                <span className="tabular-nums text-[#ff7a5c]">{i + 1}.</span>
                {q.text}
              </p>
              <div className="mt-3 flex flex-wrap gap-2" role="group" aria-labelledby={`q-${q.id}-label`}>
                {q.examples.map((ex) => (
                  <Chip
                    key={ex}
                    selected={value === ex}
                    onClick={() => {
                      onAnswer(q.id, value === ex ? "" : ex);
                      setTyping((t) => {
                        const next = new Set(t);
                        next.delete(q.id);
                        return next;
                      });
                    }}
                  >
                    {ex}
                  </Chip>
                ))}
                {q.examples.length > 0 && (
                  <Chip
                    selected={showInput}
                    onClick={() => {
                      if (q.examples.includes(value)) onAnswer(q.id, "");
                      setTyping((t) => new Set(t).add(q.id));
                    }}
                  >
                    <PenLine className="mr-1.5 size-3.5" aria-hidden />
                    Other…
                  </Chip>
                )}
              </div>
              {showInput && (
                <div className="mt-2.5 flex items-center gap-1">
                  <Input
                    value={custom ? value : ""}
                    onChange={(e) => onAnswer(q.id, e.target.value)}
                    aria-labelledby={`q-${q.id}-label`}
                    placeholder="Write your answer"
                    maxLength={1000}
                    autoFocus={typing.has(q.id) && !custom}
                    className="h-11"
                  />
                  <DictationButton compact lang={lang} onText={(t) => onAnswer(q.id, custom ? `${value} ${t}` : t)} />
                </div>
              )}
            </li>
          );
        })}
      </ol>
      <div className="mt-5 flex items-center gap-3">
        <Button onClick={onSubmit}>{answered === 0 ? "Skip these" : "Continue"}</Button>
        <span className="text-sm font-medium text-white/50">
          {answered} of {questions.length} answered
        </span>
      </div>
    </div>
  );
}

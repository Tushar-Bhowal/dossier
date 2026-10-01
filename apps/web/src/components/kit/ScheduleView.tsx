"use client";

import * as React from "react";
import type { Kit, Question } from "@dossier/core";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, ChevronDown, Clock, HelpCircle, Target } from "lucide-react";

export function ScheduleView({ kit }: { kit: Kit }) {
  const questionsById = React.useMemo(() => new Map(kit.questions.map((q) => [q.id, q])), [kit.questions]);

  const totalMinutes = React.useMemo(
    () => kit.schedule.days.reduce((acc, d) => acc + (d.minutes || 0), 0),
    [kit.schedule.days],
  );

  const totalHours = (totalMinutes / 60).toFixed(1);

  return (
    <Card>
      <CardHeader className="flex flex-col gap-4 border-b border-white/[0.06] pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3.5">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-[#ff7a5c] ring-1 ring-primary/25">
            <Calendar className="size-[18px]" />
          </div>
          <div>
            <CardTitle className="text-xl font-semibold tracking-[-0.02em] text-white">
              Study schedule
            </CardTitle>
            <CardDescription className="mt-1 text-sm text-white/60">
              A day-by-day plan across {kit.schedule.days_available} day
              {kit.schedule.days_available === 1 ? "" : "s"} up to your interview.
            </CardDescription>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="h-7 gap-1.5 px-3 text-[13px]">
            <Clock className="size-3.5 text-[#ff7a5c]" />
            {totalMinutes > 60 ? `~${totalHours} hrs total` : `${totalMinutes} min total`}
          </Badge>
          <Badge variant="outline" className="h-7 gap-1.5 px-3 text-[13px]">
            <HelpCircle className="size-3.5 text-[#ff7a5c]" />
            {kit.questions.length} questions
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="pt-6">
        {kit.schedule.days.length === 0 ? (
          <div className="rounded-lg border border-dashed border-white/10 p-8 text-center text-[15px] text-white/55">
            No schedule generated yet.
          </div>
        ) : (
          <ol className="relative m-0 flex list-none flex-col gap-5 p-0">
            <span
              aria-hidden
              className="absolute bottom-6 left-[19px] top-6 w-px bg-gradient-to-b from-primary/50 via-white/10 to-transparent"
            />
            {kit.schedule.days.map((d) => {
              const resolved = d.question_ids
                .map((qid) => questionsById.get(qid))
                .filter((q): q is Question => q !== undefined);

              return (
                <li key={d.day} className="relative flex gap-4 sm:gap-5">
                  <span className="relative z-10 flex size-10 shrink-0 flex-col items-center justify-center rounded-lg bg-[#dc3019] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_0_0_6px_var(--card)]">
                    <span className="text-[10px] font-semibold uppercase leading-none tracking-wide text-white/80">
                      Day
                    </span>
                    <span className="text-[15px] font-bold leading-none">{d.day}</span>
                  </span>

                  <div className="min-w-0 flex-1 rounded-lg border border-white/[0.08] bg-[#141414] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                    <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                      <h3 className="flex items-center gap-2 text-[17px] font-semibold capitalize text-white">
                        <Target className="size-4 shrink-0 text-[#ff7a5c]" />
                        {d.focus}
                      </h3>
                      <div className="flex shrink-0 items-center gap-2 text-[13px] font-medium text-white/55">
                        <span className="flex items-center gap-1.5">
                          <Clock className="size-3.5" />
                          {d.minutes} min
                        </span>
                        <span aria-hidden>·</span>
                        <span>
                          {resolved.length} question{resolved.length === 1 ? "" : "s"}
                        </span>
                      </div>
                    </div>

                    {resolved.length > 0 ? (
                      <ul className="mt-4 flex list-none flex-col gap-2.5 p-0">
                        {resolved.map((question) => (
                          <li
                            key={question.id}
                            className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4"
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="inline-flex h-6 items-center rounded-lg bg-white/[0.06] px-2 text-xs font-semibold capitalize text-white/70">
                                {question.category.replace("-", " ")}
                              </span>
                              <span
                                className="flex items-center gap-1"
                                aria-label={`Difficulty ${question.difficulty} of 3`}
                              >
                                {[1, 2, 3].map((n) => (
                                  <span
                                    key={n}
                                    className={`h-1.5 w-3 rounded-full ${n <= question.difficulty ? "bg-[#ff7a5c]" : "bg-white/12"}`}
                                  />
                                ))}
                              </span>
                            </div>
                            <p className="mt-2.5 whitespace-pre-wrap break-words text-[15px] font-medium leading-relaxed text-white/90">
                              {question.prompt}
                            </p>
                            {question.answer_outline && (
                              <details className="group mt-3 rounded-lg border border-white/[0.06] bg-black/25">
                                <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5 text-[13px] font-semibold text-white/70 hover:text-white [&::-webkit-details-marker]:hidden">
                                  Key points to cover
                                  <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
                                </summary>
                                <p className="whitespace-pre-wrap break-words border-t border-white/[0.06] px-3 py-3 text-sm leading-relaxed text-white/65">
                                  {question.answer_outline}
                                </p>
                              </details>
                            )}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-3 text-sm text-white/55">
                        Rest and review day. Revisit earlier notes or practise your weakest flashcards.
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

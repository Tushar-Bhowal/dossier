"use client";

import * as React from "react";
import type { Kit, Question } from "@dossier/core";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, HelpCircle, Target } from "lucide-react";

export function ScheduleView({ kit }: { kit: Kit }) {
  const questionsById = React.useMemo(
    () => new Map(kit.questions.map((q) => [q.id, q])),
    [kit.questions]
  );

  const totalMinutes = React.useMemo(
    () => kit.schedule.days.reduce((acc, d) => acc + (d.minutes || 0), 0),
    [kit.schedule.days]
  );

  const totalHours = (totalMinutes / 60).toFixed(1);

  return (
    <Card className="rounded-lg border-border/80">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between pb-4">
        <div>
          <CardTitle className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            <Calendar className="size-5 text-[#FB4128]" />
            Study Schedule
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground mt-1">
            Personalized preparation roadmap across {kit.schedule.days_available} day{kit.schedule.days_available === 1 ? "" : "s"} leading up to your interview.
          </CardDescription>
        </div>

        {/* Schedule metrics */}
        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
          <Badge variant="secondary" className="gap-1 px-2 py-0.5 text-xs font-normal bg-secondary/70 rounded">
            <Calendar className="size-3 text-muted-foreground" />
            <span>{kit.schedule.days_available} days</span>
          </Badge>
          <Badge variant="secondary" className="gap-1 px-2 py-0.5 text-xs font-normal bg-secondary/70 rounded">
            <Clock className="size-3 text-muted-foreground" />
            <span>{totalMinutes > 60 ? `~${totalHours} hrs` : `${totalMinutes} min`}</span>
          </Badge>
          <Badge variant="outline" className="gap-1 px-2 py-0.5 text-xs font-normal border-border/80 text-muted-foreground rounded">
            <HelpCircle className="size-3 text-muted-foreground" />
            <span>{kit.questions.length} questions</span>
          </Badge>
        </div>
      </CardHeader>

      <CardContent>
        {kit.schedule.days.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border/70 p-6 text-center text-sm text-muted-foreground">
            No schedule generated yet.
          </div>
        ) : (
          <ol className="flex flex-col gap-4 list-none p-0 m-0">
            {kit.schedule.days.map((d) => {
              const resolved = d.question_ids
                .map((qid) => questionsById.get(qid))
                .filter((q): q is Question => q !== undefined);

              return (
                <li
                  key={d.day}
                  className="rounded-lg border border-border/70 bg-card/40 p-4 sm:p-5 transition-colors hover:border-border flex flex-col gap-3"
                >
                  {/* Day Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-border/40">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="shrink-0 font-semibold text-xs text-[#FB4128] bg-[#FB4128]/10 border border-[#FB4128]/20 px-2 py-0.5 rounded">
                        Day {d.day}
                      </span>
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Target className="size-3.5 text-muted-foreground/80 shrink-0" />
                        <h4 className="font-medium text-sm text-foreground break-words">
                          {d.focus}
                        </h4>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto text-xs text-muted-foreground">
                      <span className="flex items-center gap-1 bg-secondary/50 border border-border/50 px-2 py-0.5 rounded text-[11px]">
                        <Clock className="size-3 text-muted-foreground" />
                        {d.minutes} min
                      </span>
                      <span className="text-[11px] text-muted-foreground font-medium">
                        {resolved.length} question{resolved.length === 1 ? "" : "s"}
                      </span>
                    </div>
                  </div>

                  {/* Scheduled Questions */}
                  {resolved.length > 0 ? (
                    <div className="flex flex-col gap-2 pt-1">
                      {resolved.map((question, idx) => (
                        <div
                          key={question.id}
                          className="rounded border border-border/50 bg-background/50 p-3 sm:p-3.5 flex flex-col gap-2 transition-colors hover:bg-background/80"
                        >
                          {/* Badges & Metadata */}
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[10px] font-mono text-muted-foreground font-medium">
                                #{idx + 1}
                              </span>
                              <Badge
                                variant="outline"
                                className="text-[0.65rem] px-1.5 py-0 h-5 font-normal rounded capitalize border-border/80"
                              >
                                {question.category}
                              </Badge>
                              {question.origin && question.origin !== "generated" && (
                                <Badge
                                  variant="secondary"
                                  className="text-[0.65rem] px-1.5 py-0 h-5 font-normal rounded capitalize text-muted-foreground"
                                >
                                  {question.origin}
                                </Badge>
                              )}
                            </div>

                            <span
                              className="inline-flex items-center rounded bg-muted/60 border border-border/40 px-1.5 py-0.5 text-[0.68rem] font-medium text-muted-foreground"
                              title={`Difficulty: ${question.difficulty} of 3`}
                            >
                              Diff {question.difficulty}/3
                            </span>
                          </div>

                          {/* Full Question Prompt - never truncated */}
                          <p className="text-sm leading-relaxed text-foreground/90 break-words whitespace-pre-wrap">
                            {question.prompt}
                          </p>

                          {/* Answer outline / key prep note if available */}
                          {question.answer_outline && (
                            <div className="mt-1 pt-2 border-t border-border/30 text-xs text-muted-foreground">
                              <span className="font-medium text-foreground/75 block mb-0.5">Key points to cover:</span>
                              <p className="leading-relaxed whitespace-pre-wrap break-words">
                                {question.answer_outline}
                              </p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded border border-dashed border-border/40 bg-muted/10 p-3 text-center">
                      <p className="text-xs text-muted-foreground">
                        Rest and review day — revisit previous notes or practice weak flashcard categories.
                      </p>
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

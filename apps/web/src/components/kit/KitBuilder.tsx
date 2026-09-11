"use client";

import type { Kit } from "@dossier/core";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CompanyBriefCard } from "./CompanyBriefCard";
import { RequirementsSection } from "./RequirementsSection";
import { QuestionsBoard } from "./QuestionsBoard";
import { FlashcardsSection } from "./FlashcardsSection";
import { useKitEditor } from "./useKitEditor";

export function KitBuilder({ id, initial }: { id: string; initial: { kit: Kit; version: number } }) {
  const editor = useKitEditor(id, initial);
  const { kit } = editor;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{kit.role.title || "Untitled role"}</h1>
        <p className="text-sm text-muted-foreground">
          {kit.source.company} · {kit.role.seniority} · {kit.source.location}
        </p>
      </div>

      <CompanyBriefCard editor={editor} />
      <RequirementsSection editor={editor} />

      <div>
        <h2 className="mb-3 text-lg font-semibold tracking-tight">Questions ({kit.questions.length})</h2>
        <QuestionsBoard editor={editor} />
      </div>

      <FlashcardsSection editor={editor} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Schedule ({kit.schedule.days_available} day{kit.schedule.days_available === 1 ? "" : "s"})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col gap-3">
            {kit.schedule.days.map((d) => (
              <li key={d.day} className="text-sm">
                <span className="font-medium">Day {d.day}</span>{" "}
                <span className="text-muted-foreground">
                  — {d.focus} ({d.minutes} min, {d.question_ids.length} questions)
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {kit.coverage.uncovered_requirement_ids.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Coverage gaps</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {kit.coverage.uncovered_requirement_ids.length} requirement(s) still have no question.
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

"use client";

import type { Kit } from "@dossier/core";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CompanyBriefCard } from "./CompanyBriefCard";
import { RequirementsSection } from "./RequirementsSection";
import { QuestionsBoard } from "./QuestionsBoard";
import { FlashcardsSection } from "./FlashcardsSection";
import { ScheduleView } from "./ScheduleView";
import { useKitEditor } from "./useKitEditor";

export function KitBuilder({ id, initial }: { id: string; initial: { kit: Kit; version: number } }) {
  const editor = useKitEditor(id, initial);
  const { kit } = editor;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-balance">{kit.role.title || "Untitled role"}</h1>
          <p className="text-sm text-muted-foreground">
            {kit.source.company} · {kit.role.seniority} · {kit.source.location}
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href={`/kits/${id}/practice`}>Practice</Link>
        </Button>
      </div>

      <CompanyBriefCard editor={editor} />
      <RequirementsSection editor={editor} />

      <div>
        <h2 className="mb-3 text-lg font-semibold tracking-tight">Questions ({kit.questions.length})</h2>
        <QuestionsBoard editor={editor} />
      </div>

      <FlashcardsSection editor={editor} />

      <ScheduleView kit={kit} />

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

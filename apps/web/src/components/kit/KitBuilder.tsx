"use client";

import type { Kit } from "@dossier/core";
import Link from "next/link";
import { ArrowLeft, GraduationCap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CompanyBriefCard } from "./CompanyBriefCard";
import { EditableField } from "./EditableField";
import { editRoleTitle } from "./kitMutations";
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
      {/* Top action bar */}
      <div className="flex items-center justify-between gap-4">
        <Button
          asChild
          variant="outline"
          size="sm"
          className="rounded-lg gap-1.5 h-9 px-3.5 text-muted-foreground hover:text-foreground border-border/80 hover:bg-accent transition-colors"
        >
          <Link href="/kits">
            <ArrowLeft className="size-4" />
            <span>Back to kits</span>
          </Link>
        </Button>
        <Button
          asChild
          size="sm"
          className="rounded-lg bg-[#FB4128] hover:bg-[#e03720] text-white shadow-md shadow-[#FB4128]/25 hover:shadow-lg hover:shadow-[#FB4128]/40 transition-all duration-200 font-semibold px-4 h-9 gap-2 active:scale-[0.98]"
        >
          <Link href={`/kits/${id}/practice`}>
            <GraduationCap className="size-4" />
            <span>Practice</span>
          </Link>
        </Button>
      </div>

      {/* Role title and metadata */}
      <div>
        <EditableField
          value={kit.role.title}
          onChange={(value) => editor.editField("role.title", editRoleTitle(value))}
          status={editor.status["role.title"]}
          ariaLabel="Role title"
          placeholder="Untitled role"
          rows={1}
          className="border-transparent bg-transparent px-0 text-2xl font-semibold tracking-tight md:text-3xl"
        />
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

"use client";

import * as React from "react";
import type { Kit } from "@dossier/core";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  Calendar,
  GraduationCap,
  HelpCircle,
  Layers,
  ListChecks,
  MapPin,
  Trash2,
} from "lucide-react";
import { deleteKit } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "@/components/ui/toast";
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
  const router = useRouter();
  const queryClient = useQueryClient();
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  const roleTitle = kit.role?.title || "Untitled role";
  const company = kit.source?.company || "Unknown company";

  const handleConfirmDelete = async () => {
    await deleteKit(id);
    await queryClient.invalidateQueries({ queryKey: ["kits"] });
    toast.success("Kit deleted", {
      description: `"${roleTitle}" at ${company} has been removed.`,
    });
    router.push("/kits");
  };

  const scrollToSection = (sectionId: string) => {
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full mx-auto pb-12">
      {/* Top action bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-border/40">
        <Button
          asChild
          variant="outline"
          size="sm"
          className="rounded gap-1.5 h-8 px-3 text-muted-foreground hover:text-foreground border-border/80 hover:bg-accent transition-colors self-start sm:self-auto"
        >
          <Link href="/kits">
            <ArrowLeft className="size-3.5" />
            <span>Back to kits</span>
          </Link>
        </Button>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setConfirmOpen(true)}
            className="rounded gap-1.5 h-8 px-2.5 text-muted-foreground hover:text-destructive hover:border-destructive/40 hover:bg-destructive/10 border-border/80 transition-colors text-xs"
          >
            <Trash2 className="size-3.5" />
            <span>Delete</span>
          </Button>

          <Button
            asChild
            size="sm"
            className="rounded bg-[#FB4128] hover:bg-[#e03720] text-white shadow-sm hover:shadow font-medium px-3.5 h-8 gap-1.5 text-xs transition-colors"
          >
            <Link href={`/kits/${id}/practice`}>
              <GraduationCap className="size-3.5" />
              <span>Practice Mode</span>
            </Link>
          </Button>
        </div>
      </div>

      {/* Role title and metadata banner */}
      <div className="flex flex-col gap-2 rounded-lg border border-border/70 bg-card/40 p-4 sm:p-5">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1 font-medium text-foreground/80">
            <Building2 className="size-3.5 text-[#FB4128]" />
            {kit.source.company}
          </span>
          {kit.source.location && (
            <>
              <span>·</span>
              <span className="flex items-center gap-1">
                <MapPin className="size-3 text-muted-foreground" />
                {kit.source.location}
              </span>
            </>
          )}
          {kit.role.seniority && (
            <>
              <span>·</span>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 font-normal rounded border-border/60">
                {kit.role.seniority}
              </Badge>
            </>
          )}
        </div>

        <EditableField
          value={kit.role.title}
          onChange={(value) => editor.editField("role.title", editRoleTitle(value))}
          status={editor.status["role.title"]}
          ariaLabel="Role title"
          placeholder="Untitled role"
          rows={1}
          className="border-transparent bg-transparent px-0 text-2xl font-bold tracking-tight md:text-3xl text-foreground focus:border-border/60"
        />

        {/* Quick jump navigation pills */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/40 mt-1">
          <span className="text-[11px] font-medium text-muted-foreground mr-1 hidden sm:inline">
            Jump to:
          </span>
          <button
            type="button"
            onClick={() => scrollToSection("section-brief")}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/80 border border-border/50 transition-colors"
          >
            <Building2 className="size-3 text-[#FB4128]" />
            Brief
          </button>
          <button
            type="button"
            onClick={() => scrollToSection("section-requirements")}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/80 border border-border/50 transition-colors"
          >
            <ListChecks className="size-3 text-[#FB4128]" />
            Requirements ({kit.role.requirements.length})
          </button>
          <button
            type="button"
            onClick={() => scrollToSection("section-questions")}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/80 border border-border/50 transition-colors"
          >
            <HelpCircle className="size-3 text-[#FB4128]" />
            Questions ({kit.questions.length})
          </button>
          <button
            type="button"
            onClick={() => scrollToSection("section-flashcards")}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/80 border border-border/50 transition-colors"
          >
            <Layers className="size-3 text-[#FB4128]" />
            Flashcards ({kit.flashcards.length})
          </button>
          <button
            type="button"
            onClick={() => scrollToSection("section-schedule")}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/80 border border-border/50 transition-colors"
          >
            <Calendar className="size-3 text-[#FB4128]" />
            Schedule ({kit.schedule.days_available}d)
          </button>
        </div>
      </div>

      {/* Coverage Gaps Notice */}
      {kit.coverage.uncovered_requirement_ids.length > 0 && (
        <Card className="border-amber-500/30 bg-amber-500/5 rounded-lg">
          <CardContent className="flex items-center gap-3 p-4 text-xs text-amber-400">
            <AlertTriangle className="size-4 shrink-0" />
            <div className="flex-1">
              <span className="font-semibold">Coverage gap detected:</span>{" "}
              <span>
                {kit.coverage.uncovered_requirement_ids.length} requirement(s) do not yet have corresponding interview questions. Use the Regenerate action on Questions or add questions manually.
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Sections with Scroll Targets */}
      <div id="section-brief" className="scroll-mt-16">
        <CompanyBriefCard editor={editor} />
      </div>

      <div id="section-requirements" className="scroll-mt-16">
        <RequirementsSection editor={editor} />
      </div>

      <div id="section-questions" className="scroll-mt-16">
        <QuestionsBoard editor={editor} />
      </div>

      <div id="section-flashcards" className="scroll-mt-16">
        <FlashcardsSection editor={editor} />
      </div>

      <div id="section-schedule" className="scroll-mt-16">
        <ScheduleView kit={kit} />
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Delete "${roleTitle}"?`}
        description={`This will permanently delete the interview kit for ${roleTitle} at ${company}, including all questions, flashcards, and study progress. This action cannot be undone.`}
        confirmLabel="Delete kit"
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}

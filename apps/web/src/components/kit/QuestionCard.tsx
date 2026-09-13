"use client";

import * as React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { BookOpen, GripVertical } from "lucide-react";
import type { Question } from "@dossier/core";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EditableField } from "./EditableField";
import { ItemControls } from "./ItemControls";
import { OriginBadge } from "./OriginBadge";
import { deleteQuestion, editQuestionField, toggleQuestionPin } from "./kitMutations";
import { toast } from "@/components/ui/toast";
import type { KitEditor } from "./useKitEditor";

interface QuestionCardProps {
  question: Question;
  editor: KitEditor;
}

export function QuestionCard({ question, editor }: QuestionCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: question.id,
    data: { type: "question", question },
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  const [outlineOpen, setOutlineOpen] = React.useState(Boolean(question.answer_outline));

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative flex flex-col gap-2.5 rounded border p-3 transition-all ${
        isDragging
          ? "z-50 opacity-80 shadow-lg ring-2 ring-primary/40 bg-card border-primary/50"
          : "bg-card/60 hover:bg-card border-border/70 hover:border-border shadow-xs hover:shadow-sm"
      } ${question.pinned ? "ring-1 ring-primary/20 bg-primary/5" : ""}`}
    >
      {/* Card Header: Drag Handle & Meta */}
      <div className="flex items-center justify-between gap-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="size-6 shrink-0 cursor-grab touch-none active:cursor-grabbing text-muted-foreground/60 hover:text-foreground hover:bg-secondary rounded"
            aria-label={`Reorder question: ${question.prompt || "untitled"}`}
            {...attributes}
            {...listeners}
          >
            <GripVertical className="size-3.5" />
          </Button>

          <span
            className="inline-flex items-center rounded bg-muted/60 border border-border/50 px-1.5 py-0.5 text-[0.68rem] font-medium text-muted-foreground shrink-0"
            title={`Difficulty: ${question.difficulty} of 3`}
          >
            Diff {question.difficulty}/3
          </span>

          <OriginBadge origin={question.origin} pinned={question.pinned} />
        </div>

        <ItemControls
          pinned={question.pinned}
          onTogglePin={() => {
            editor.mutateNow(`question:${question.id}.pinned`, toggleQuestionPin(question.id));
            toast.success(question.pinned ? "Question unpinned" : "Question pinned");
          }}
          onDelete={() => editor.mutateNow(`question:${question.id}.delete`, deleteQuestion(question.id))}
          deleteLabel="Delete question"
        />
      </div>

      {/* Question Prompt Field */}
      <div className="flex flex-col gap-1">
        <label className="text-[11px] font-semibold text-foreground/80 uppercase tracking-wider">
          Question Prompt
        </label>
        <EditableField
          value={question.prompt}
          onChange={(value) => editor.editField(`question:${question.id}.prompt`, editQuestionField(question.id, "prompt", value))}
          status={editor.status[`question:${question.id}.prompt`]}
          ariaLabel="Question prompt"
          placeholder="Enter the interview question or scenario…"
          rows={2}
          className="text-sm font-medium leading-snug text-foreground bg-transparent border-border/40 hover:border-border focus:border-border/80"
        />
      </div>

      {/* Answer Outline / Evaluation Guide */}
      <div className="mt-1 rounded border border-border/40 bg-muted/20 p-2.5 flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
            <BookOpen className="size-3 text-[#FB4128]" />
            <span>Answer Guide & Key Criteria</span>
          </div>
          {!outlineOpen && (
            <button
              type="button"
              onClick={() => setOutlineOpen(true)}
              className="text-[10px] text-muted-foreground hover:text-foreground underline underline-offset-2"
            >
              Add notes
            </button>
          )}
        </div>

        {outlineOpen && (
          <EditableField
            value={question.answer_outline}
            onChange={(value) => editor.editField(`question:${question.id}.answer_outline`, editQuestionField(question.id, "answer_outline", value))}
            status={editor.status[`question:${question.id}.answer_outline`]}
            ariaLabel="Answer outline"
            placeholder="Key concepts, expected answers, and evaluation checkpoints…"
            rows={2}
            className="text-xs leading-relaxed text-muted-foreground bg-transparent border-transparent hover:border-border/30 focus:border-border/60 p-1"
          />
        )}
      </div>
    </div>
  );
}

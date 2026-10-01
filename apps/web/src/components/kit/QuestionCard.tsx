"use client";

import * as React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { BookOpen, ChevronDown, GripVertical } from "lucide-react";
import type { Question } from "@dossier/core";
import { cn } from "@/lib/utils";
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

  // Collapsed by default: the full answer guides made the board several screens tall.
  const [outlineOpen, setOutlineOpen] = React.useState(false);
  const hasOutline = Boolean(question.answer_outline);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group relative flex flex-col gap-3 rounded-lg border p-4 transition-[border-color,box-shadow,background-color]",
        isDragging
          ? "z-50 border-primary/50 bg-[#171717] opacity-90 shadow-[0_20px_50px_-15px_rgba(0,0,0,0.9)] ring-2 ring-primary/40"
          : "border-white/[0.08] bg-[#141414] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] hover:border-white/[0.14]",
        question.pinned && "border-primary/30 bg-primary/[0.05]",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            className="flex size-7 shrink-0 cursor-grab touch-none items-center justify-center rounded-lg text-white/40 transition-colors hover:bg-white/5 hover:text-white active:cursor-grabbing"
            aria-label={`Reorder question: ${question.prompt || "untitled"}`}
            {...attributes}
            {...listeners}
          >
            <GripVertical className="size-4" />
          </button>
          <span
            className="flex items-center gap-1"
            title={`Difficulty: ${question.difficulty} of 3`}
            aria-label={`Difficulty ${question.difficulty} of 3`}
          >
            {[1, 2, 3].map((n) => (
              <span
                key={n}
                className={cn(
                  "h-1.5 w-3 rounded-full",
                  n <= question.difficulty ? "bg-[#ff7a5c]" : "bg-white/12",
                )}
              />
            ))}
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

      <EditableField
        value={question.prompt}
        onChange={(value) =>
          editor.editField(`question:${question.id}.prompt`, editQuestionField(question.id, "prompt", value))
        }
        status={editor.status[`question:${question.id}.prompt`]}
        ariaLabel="Question prompt"
        placeholder="Enter the interview question or scenario…"
        rows={2}
        className="text-[15px] font-semibold leading-relaxed text-white"
      />

      <div className="rounded-lg border border-white/[0.06] bg-black/25">
        <button
          type="button"
          onClick={() => setOutlineOpen((v) => !v)}
          aria-expanded={outlineOpen}
          className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-[13px] font-semibold text-white/70 transition-colors hover:text-white"
        >
          <span className="flex items-center gap-2">
            <BookOpen className="size-3.5 text-[#ff7a5c]" />
            {hasOutline ? "Answer guide" : "Add an answer guide"}
          </span>
          <ChevronDown className={cn("size-4 transition-transform", outlineOpen && "rotate-180")} />
        </button>
        {outlineOpen && (
          <div className="border-t border-white/[0.06] px-3 pb-2 pt-2">
            <EditableField
              value={question.answer_outline}
              onChange={(value) =>
                editor.editField(
                  `question:${question.id}.answer_outline`,
                  editQuestionField(question.id, "answer_outline", value),
                )
              }
              status={editor.status[`question:${question.id}.answer_outline`]}
              ariaLabel="Answer outline"
              placeholder="Key concepts, expected answers, and evaluation checkpoints…"
              rows={2}
              className="text-sm leading-relaxed text-white/70"
            />
          </div>
        )}
      </div>
    </div>
  );
}

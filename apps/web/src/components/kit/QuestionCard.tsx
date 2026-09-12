"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { motion } from "motion/react";
import { GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EditableField } from "./EditableField";
import { ItemControls } from "./ItemControls";
import { OriginBadge } from "./OriginBadge";
import { deleteQuestion, editQuestionField, toggleQuestionPin } from "./kitMutations";
import type { KitEditor } from "./useKitEditor";
import type { Question } from "@dossier/core";

export function QuestionCard({ question, editor }: { question: Question; editor: KitEditor }) {
  // dnd-kit owns this element's transform while dragging (via `style` below) — no Framer `layout`
  // prop here, it would fight dnd-kit's own positioning and jitter. Motion is used only for the
  // enter/exit fade, which is orthogonal to drag.
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: question.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <motion.li
      ref={setNodeRef}
      style={style}
      initial={{ opacity: 0 }}
      animate={{ opacity: isDragging ? 0.5 : 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="flex flex-col gap-2 rounded-lg border border-border bg-card p-2.5 text-sm"
    >
      {/* Responsive card header: drag handle & badges on left, difficulty & controls on right */}
      <div className="flex flex-wrap items-center justify-between gap-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="size-7 shrink-0 cursor-grab touch-none active:cursor-grabbing text-muted-foreground hover:text-foreground"
            aria-label={`Reorder question: ${question.prompt || "untitled"}`}
            {...attributes}
            {...listeners}
          >
            <GripVertical className="size-3.5" />
          </Button>
          <OriginBadge origin={question.origin} pinned={question.pinned} />
        </div>

        <div className="flex items-center gap-1.5 shrink-0 ml-auto">
          <span
            className="inline-flex items-center rounded-md bg-muted/60 border border-border/40 px-1.5 py-0.5 text-[0.68rem] font-medium text-muted-foreground"
            title={`Difficulty: ${question.difficulty} of 3`}
          >
            Diff {question.difficulty}/3
          </span>
          <ItemControls
            pinned={question.pinned}
            onTogglePin={() => editor.mutateNow(`question:${question.id}.pinned`, toggleQuestionPin(question.id))}
            onDelete={() => editor.mutateNow(`question:${question.id}.delete`, deleteQuestion(question.id))}
            deleteLabel="Delete question"
          />
        </div>
      </div>
      <EditableField
        value={question.prompt}
        onChange={(value) => editor.editField(`question:${question.id}.prompt`, editQuestionField(question.id, "prompt", value))}
        status={editor.status[`question:${question.id}.prompt`]}
        ariaLabel="Question prompt"
        rows={2}
      />
      <EditableField
        value={question.answer_outline}
        onChange={(value) => editor.editField(`question:${question.id}.answer_outline`, editQuestionField(question.id, "answer_outline", value))}
        status={editor.status[`question:${question.id}.answer_outline`]}
        ariaLabel="Answer outline"
        rows={2}
        className="text-muted-foreground"
      />
    </motion.li>
  );
}

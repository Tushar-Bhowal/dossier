"use client";

import * as React from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { AnimatePresence } from "motion/react";
import { Boxes, Building2, MessageSquare, Plus, RefreshCw, Terminal } from "lucide-react";
import type { Question } from "@dossier/core";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { QuestionCard } from "./QuestionCard";
import { AddQuestionDialog } from "./AddQuestionDialog";
import { addQuestion } from "./kitMutations";
import { toast } from "@/components/ui/toast";
import type { KitEditor } from "./useKitEditor";

interface CategoryColumnProps {
  category: Question["category"];
  label: string;
  questions: Question[];
  editor: KitEditor;
}

const CATEGORY_ICONS: Record<Question["category"], React.ReactNode> = {
  technical: <Terminal className="size-4 text-sky-400" />,
  behavioural: <MessageSquare className="size-4 text-emerald-400" />,
  "system-design": <Boxes className="size-4 text-violet-400" />,
  "company-fit": <Building2 className="size-4 text-amber-400" />,
};

export function CategoryColumn({ category, label, questions, editor }: CategoryColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: category });
  const ids = questions.map((q) => q.id);
  const sectionKey = `questions:${category}`;
  const isRegenerating = editor.regenerating.has(sectionKey);

  const [addOpen, setAddOpen] = React.useState(false);

  const handleAddQuestion = (content: { prompt: string; answerOutline: string }) => {
    editor.mutateNow(`${sectionKey}.add`, addQuestion(category, content));
    toast.success("Question added", {
      description: `New question added to ${label}.`,
    });
  };

  return (
    <Card className="flex h-full min-w-0 flex-col gap-0 py-0">
      <div className="flex items-center justify-between gap-2 border-b border-white/[0.06] px-4 py-3.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.04]">
            {CATEGORY_ICONS[category]}
          </div>
          <span className="truncate text-[15px] font-semibold text-white">{label}</span>
          <Badge variant="outline" className="shrink-0">
            {questions.length}
          </Badge>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => void editor.regenerate(`questions:${category}`, sectionKey)}
            disabled={isRegenerating}
            title={`Regenerate ${label} questions`}
            aria-label={`Regenerate ${label} questions`}
            className="text-white/55 hover:text-white"
          >
            <RefreshCw className={`size-4 ${isRegenerating ? "animate-spin text-[#ff7a5c]" : ""}`} />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => setAddOpen(true)}
            title={`Add question to ${label}`}
            aria-label={`Add question to ${label}`}
            className="text-white/55 hover:bg-primary/10 hover:text-[#ff7a5c]"
          >
            <Plus className="size-4" />
          </Button>
        </div>
      </div>

      {/* Column Droppable Area */}
      <CardContent className="flex flex-1 flex-col p-3">
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          <div
            ref={setNodeRef}
            className={`flex min-h-[140px] flex-1 flex-col gap-3 rounded-lg border border-dashed p-1 transition-colors ${
              isOver ? "border-primary/40 bg-primary/[0.04]" : "border-transparent"
            }`}
          >
            <AnimatePresence initial={false}>
              {questions.map((q) => (
                <QuestionCard key={q.id} question={q} editor={editor} />
              ))}
            </AnimatePresence>

            {questions.length === 0 && (
              <div className="flex flex-1 flex-col items-center justify-center rounded-lg border border-dashed border-white/10 p-6 text-center">
                <p className="text-sm text-white/55">No questions in this track yet.</p>
                <button
                  type="button"
                  onClick={() => setAddOpen(true)}
                  className="mt-2 text-sm font-semibold text-[#ff7a5c] hover:underline"
                >
                  + Add question
                </button>
              </div>
            )}
          </div>
        </SortableContext>
      </CardContent>

      <AddQuestionDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        categoryLabel={label}
        onAdd={handleAddQuestion}
      />
    </Card>
  );
}

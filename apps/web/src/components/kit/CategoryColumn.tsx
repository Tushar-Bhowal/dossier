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
  technical: <Terminal className="size-3.5 text-blue-400" />,
  behavioural: <MessageSquare className="size-3.5 text-emerald-400" />,
  "system-design": <Boxes className="size-3.5 text-purple-400" />,
  "company-fit": <Building2 className="size-3.5 text-amber-400" />,
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
    <Card className="flex h-full min-w-0 flex-col rounded-lg border-border/70 bg-card/30 transition-colors">
      {/* Column Header */}
      <div className="flex items-center justify-between gap-2 p-3 sm:p-3.5 border-b border-border/40">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex size-6 shrink-0 items-center justify-center rounded bg-secondary/80 border border-border/50">
            {CATEGORY_ICONS[category]}
          </div>
          <span className="font-semibold text-xs text-foreground truncate">
            {label}
          </span>
          <Badge variant="secondary" className="px-1.5 py-0 h-4 text-[11px] font-semibold rounded shrink-0">
            {questions.length}
          </Badge>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => void editor.regenerate(`questions:${category}`, sectionKey)}
            disabled={isRegenerating}
            title={`Regenerate ${label} questions`}
            className="size-7 rounded text-muted-foreground hover:text-foreground"
          >
            <RefreshCw className={`size-3.5 ${isRegenerating ? "animate-spin text-[#FB4128]" : ""}`} />
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => setAddOpen(true)}
            title={`Add question to ${label}`}
            className="size-7 rounded text-muted-foreground hover:text-[#FB4128] hover:bg-[#FB4128]/10"
          >
            <Plus className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* Column Droppable Area */}
      <CardContent className="flex flex-1 flex-col p-2 sm:p-2.5">
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          <div
            ref={setNodeRef}
            className={`flex min-h-[140px] flex-1 flex-col gap-2.5 rounded p-1.5 transition-all ${
              isOver ? "bg-[#FB4128]/5 border border-dashed border-[#FB4128]/40" : "bg-transparent"
            }`}
          >
            <AnimatePresence initial={false}>
              {questions.map((q) => (
                <QuestionCard key={q.id} question={q} editor={editor} />
              ))}
            </AnimatePresence>

            {questions.length === 0 && (
              <div className="flex flex-1 flex-col items-center justify-center rounded border border-dashed border-border/50 p-4 text-center">
                <p className="text-[11px] text-muted-foreground">No questions in this section.</p>
                <button
                  type="button"
                  onClick={() => setAddOpen(true)}
                  className="mt-1.5 text-[11px] text-[#FB4128] hover:underline font-medium"
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

"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { AnimatePresence } from "motion/react";
import type { Question } from "@dossier/core";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SectionHeader } from "./SectionHeader";
import { QuestionCard } from "./QuestionCard";
import { addQuestion } from "./kitMutations";
import type { KitEditor } from "./useKitEditor";

interface CategoryColumnProps {
  category: Question["category"];
  label: string;
  questions: Question[];
  editor: KitEditor;
}

export function CategoryColumn({ category, label, questions, editor }: CategoryColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: category });
  const ids = questions.map((q) => q.id);
  const sectionKey = `questions:${category}`;

  return (
    <Card className="flex h-full min-w-0 flex-col">
      <SectionHeader
        title={`${label} (${questions.length})`}
        onRegenerate={() => void editor.regenerate(`questions:${category}`, sectionKey)}
        regenerating={editor.regenerating.has(sectionKey)}
        error={editor.regenerateError[sectionKey]}
      />
      <CardContent className="flex flex-1 flex-col">
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          <ul
            ref={setNodeRef}
            className={`flex min-h-24 flex-1 flex-col gap-2 rounded-lg p-1 transition-colors ${isOver ? "bg-muted/50" : ""}`}
          >
            <AnimatePresence initial={false}>
              {questions.map((q) => (
                <QuestionCard key={q.id} question={q} editor={editor} />
              ))}
            </AnimatePresence>
            {questions.length === 0 ? <li className="text-sm text-muted-foreground">No questions yet.</li> : null}
          </ul>
        </SortableContext>
        <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => editor.mutateNow(`${sectionKey}.add`, addQuestion(category))}>
          Add question
        </Button>
      </CardContent>
    </Card>
  );
}

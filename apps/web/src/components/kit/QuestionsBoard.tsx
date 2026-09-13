"use client";

import * as React from "react";
import { useEffect, useRef, useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import { arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { HelpCircle } from "lucide-react";
import type { Question } from "@dossier/core";
import { Badge } from "@/components/ui/badge";
import { CategoryColumn } from "./CategoryColumn";
import { reorderQuestions } from "./kitMutations";
import { toast } from "@/components/ui/toast";
import type { KitEditor } from "./useKitEditor";

const CATEGORIES = ["technical", "behavioural", "system-design", "company-fit"] as const;
type Category = (typeof CATEGORIES)[number];

const LABELS: Record<Category, string> = {
  technical: "Technical",
  behavioural: "Behavioural",
  "system-design": "System Design",
  "company-fit": "Company Fit",
};

function groupByCategory(questions: Question[]): Record<Category, string[]> {
  const grouped = { technical: [], behavioural: [], "system-design": [], "company-fit": [] } as Record<Category, string[]>;
  for (const category of CATEGORIES) {
    grouped[category] = questions
      .filter((q) => q.category === category)
      .sort((a, b) => a.order - b.order)
      .map((q) => q.id);
  }
  return grouped;
}

export function QuestionsBoard({ editor }: { editor: KitEditor }) {
  const { kit } = editor;
  const questionsById = new Map(kit.questions.map((q) => [q.id, q]));
  const [columns, setColumns] = useState<Record<Category, string[]>>(() => groupByCategory(kit.questions));
  const draggingRef = useRef(false);

  useEffect(() => {
    if (!draggingRef.current) setColumns(groupByCategory(kit.questions));
  }, [kit.questions]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function findColumn(id: UniqueIdentifier): Category | null {
    const idStr = String(id);
    if ((CATEGORIES as readonly string[]).includes(idStr)) return idStr as Category;
    return (Object.keys(columns) as Category[]).find((c) => columns[c].includes(idStr)) ?? null;
  }

  function handleDragStart() {
    draggingRef.current = true;
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;
    const activeColumn = findColumn(active.id);
    const overColumn = findColumn(over.id);
    if (!activeColumn || !overColumn || activeColumn === overColumn) return;

    setColumns((prev) => {
      const activeItems = prev[activeColumn].filter((id) => id !== active.id);
      const overItems = [...prev[overColumn]];
      const overIndex = overItems.indexOf(String(over.id));
      const insertAt = overIndex >= 0 ? overIndex : overItems.length;
      overItems.splice(insertAt, 0, String(active.id));
      return { ...prev, [activeColumn]: activeItems, [overColumn]: overItems };
    });
  }

  function handleDragEnd(event: DragEndEvent) {
    draggingRef.current = false;
    const { active, over } = event;
    if (!over) return;
    const activeColumn = findColumn(active.id);
    const overColumn = findColumn(over.id);
    if (!activeColumn || !overColumn) return;

    let next = columns;
    if (activeColumn === overColumn) {
      const items = columns[activeColumn];
      const oldIndex = items.indexOf(String(active.id));
      const newIndex = items.indexOf(String(over.id));
      if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
        next = { ...columns, [activeColumn]: arrayMove(items, oldIndex, newIndex) };
      }
    }

    const touchedCategories = activeColumn === overColumn ? [activeColumn] : [activeColumn, overColumn];
    const updates = touchedCategories.flatMap((c) => next[c].map((id, index) => ({ id, category: c, order: index })));
    setColumns(next);
    editor.mutateNow(`questions.move:${active.id}`, reorderQuestions(updates));
    toast.success("Question moved");
  }

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-0.5">
        <div className="flex items-start gap-2.5">
          <div className="flex size-8 shrink-0 items-center justify-center rounded bg-secondary/80 border border-border/60 text-[#FB4128] mt-0.5">
            <HelpCircle className="size-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base sm:text-lg font-semibold tracking-tight text-foreground">
                Question Bank
              </h3>
              <Badge variant="secondary" className="px-1.5 py-0 h-5 text-xs font-semibold rounded bg-secondary/80">
                {kit.questions.length}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Comprehensive role questions categorized into 4 tracks. Drag and drop cards between tracks to reorganize.
            </p>
          </div>
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
          {CATEGORIES.map((category) => (
            <CategoryColumn
              key={category}
              category={category}
              label={LABELS[category]}
              questions={columns[category].map((id) => questionsById.get(id)).filter((q): q is Question => Boolean(q))}
              editor={editor}
            />
          ))}
        </div>
      </DndContext>
    </div>
  );
}

"use client";

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
import type { Question } from "@dossier/core";
import { CategoryColumn } from "./CategoryColumn";
import { reorderQuestions } from "./kitMutations";
import type { KitEditor } from "./useKitEditor";

const CATEGORIES = ["technical", "behavioural", "system-design", "company-fit"] as const;
type Category = (typeof CATEGORIES)[number];

const LABELS: Record<Category, string> = {
  technical: "Technical",
  behavioural: "Behavioural",
  "system-design": "System design",
  "company-fit": "Company fit",
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

  // Re-sync the local drag-time layout from the source of truth on every kit change (save,
  // rebase, regenerate) — but never mid-drag, or an in-flight save from another field would yank
  // the board out from under an active drag.
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

  // Moves the active item into the hovered column live, as it's dragged — this is what makes
  // cross-column movement reachable with the keyboard sensor at all: without it, an item never
  // becomes a measurable member of another column's SortableContext, so arrow-key navigation has
  // nowhere in that column to land.
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
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
  );
}

"use client";

import { AnimatePresence, motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { EditableField } from "./EditableField";
import { ItemControls } from "./ItemControls";
import { OriginBadge } from "./OriginBadge";
import { SectionHeader } from "./SectionHeader";
import { addFlashcard, deleteFlashcard, editFlashcardField, toggleFlashcardPin } from "./kitMutations";
import type { KitEditor } from "./useKitEditor";

export function FlashcardsSection({ editor }: { editor: KitEditor }) {
  const flashcards = [...editor.kit.flashcards].sort((a, b) => a.order - b.order);

  return (
    <Card>
      <SectionHeader
        title={`Flashcards (${flashcards.length})`}
        onRegenerate={() => void editor.regenerate("flashcards", "flashcards")}
        regenerating={editor.regenerating.has("flashcards")}
        error={editor.regenerateError.flashcards}
      />
      <CardContent>
        <ul className="grid gap-3 sm:grid-cols-2">
          <AnimatePresence initial={false}>
            {flashcards.map((f) => (
              <motion.li
                key={f.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="flex flex-col rounded-lg border border-border p-3 text-sm"
              >
                <div className="mb-1 flex items-start justify-between gap-2">
                  <OriginBadge origin={f.origin} pinned={f.pinned} />
                  <ItemControls
                    pinned={f.pinned}
                    onTogglePin={() => editor.mutateNow(`flashcard:${f.id}.pinned`, toggleFlashcardPin(f.id))}
                    onDelete={() => editor.mutateNow(`flashcard:${f.id}.delete`, deleteFlashcard(f.id))}
                    deleteLabel="Delete flashcard"
                  />
                </div>
                <EditableField
                  value={f.front}
                  onChange={(value) => editor.editField(`flashcard:${f.id}.front`, editFlashcardField(f.id, "front", value))}
                  status={editor.status[`flashcard:${f.id}.front`]}
                  ariaLabel="Flashcard front"
                  rows={2}
                />
                <Separator className="my-2" />
                <EditableField
                  value={f.back}
                  onChange={(value) => editor.editField(`flashcard:${f.id}.back`, editFlashcardField(f.id, "back", value))}
                  status={editor.status[`flashcard:${f.id}.back`]}
                  ariaLabel="Flashcard back"
                  rows={2}
                />
              </motion.li>
            ))}
          </AnimatePresence>
          {flashcards.length === 0 ? <li className="text-sm text-muted-foreground">No flashcards yet.</li> : null}
        </ul>
        <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => editor.mutateNow("flashcards.add", addFlashcard())}>
          Add flashcard
        </Button>
      </CardContent>
    </Card>
  );
}

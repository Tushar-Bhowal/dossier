"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { Layers, Plus, Repeat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EditableField } from "./EditableField";
import { ItemControls } from "./ItemControls";
import { OriginBadge } from "./OriginBadge";
import { SectionHeader } from "./SectionHeader";
import { AddFlashcardDialog } from "./AddFlashcardDialog";
import { addFlashcard, deleteFlashcard, editFlashcardField, toggleFlashcardPin } from "./kitMutations";
import { toast } from "@/components/ui/toast";
import type { KitEditor } from "./useKitEditor";

export function FlashcardsSection({ editor }: { editor: KitEditor }) {
  const flashcards = [...editor.kit.flashcards].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return a.order - b.order;
  });

  // Track preview flip states per card
  const [flippedCards, setFlippedCards] = React.useState<Record<string, boolean>>({});

  const toggleFlip = (id: string) => {
    setFlippedCards((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const [addOpen, setAddOpen] = React.useState(false);

  const handleAddFlashcard = async (content: { front: string; back: string }) => {
    await editor.mutateNow("flashcards.add", addFlashcard(content));
    toast.success("Flashcard added", {
      description: "Added a new card to your deck.",
    });
  };

  return (
    <Card>
      <SectionHeader
        icon={<Layers className="size-4" />}
        title="Flashcard deck"
        count={flashcards.length}
        description="Short recall cards. Practice mode brings each one back just before you would forget it."
        onRegenerate={() => void editor.regenerate("flashcards", "flashcards")}
        regenerating={editor.regenerating.has("flashcards")}
        error={editor.regenerateError.flashcards}
        action={
          <Button type="button" variant="outline" onClick={() => setAddOpen(true)}>
            <Plus className="size-4 text-[#ff7a5c]" />
            <span>Add flashcard</span>
          </Button>
        }
      />

      <CardContent className="pt-5">
        <ul className="m-0 grid list-none gap-4 p-0 md:grid-cols-2">
          <AnimatePresence initial={false}>
            {flashcards.map((f, idx) => {
              const isFlipped = Boolean(flippedCards[f.id]);

              return (
                <motion.li
                  key={f.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.2 }}
                  className={`group relative flex flex-col justify-between rounded-lg border bg-[#141414] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-colors hover:border-white/[0.14] sm:p-5 ${
                    f.pinned ? "border-primary/30 bg-primary/[0.05]" : "border-white/[0.08]"
                  }`}
                >
                  <div className="flex flex-col gap-3">
                    {/* Top bar: Card index, Origin, Flip Preview, Pin/Delete */}
                    <div className="flex items-center justify-between gap-1.5 border-b border-white/[0.06] pb-3">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="flex size-6 items-center justify-center rounded-lg bg-white/[0.06] text-xs font-bold tabular-nums text-white/70">
                          {idx + 1}
                        </span>
                        <OriginBadge origin={f.origin} pinned={f.pinned} />
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleFlip(f.id)}
                          title="Toggle front / back preview"
                          className="h-8 gap-1.5 px-2.5 text-[13px] text-white/60 hover:text-white"
                        >
                          <Repeat className="size-3.5" />
                          <span>{isFlipped ? "Show front" : "Flip"}</span>
                        </Button>

                        <ItemControls
                          pinned={f.pinned}
                          onTogglePin={() => {
                            editor.mutateNow(`flashcard:${f.id}.pinned`, toggleFlashcardPin(f.id));
                            toast.success(f.pinned ? "Flashcard unpinned" : "Flashcard pinned");
                          }}
                          onDelete={() => editor.mutateNow(`flashcard:${f.id}.delete`, deleteFlashcard(f.id))}
                          deleteLabel="Delete flashcard"
                        />
                      </div>
                    </div>

                    {/* Front: Prompt / Question Face */}
                    <div
                      className={`flex flex-col gap-1 transition-opacity duration-200 ${isFlipped ? "opacity-40" : "opacity-100"}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[13px] font-semibold text-[#ff7a5c]">Front</span>
                        {isFlipped && <span className="text-xs text-white/45">Hidden while flipped</span>}
                      </div>
                      <EditableField
                        value={f.front}
                        onChange={(value) =>
                          editor.editField(
                            `flashcard:${f.id}.front`,
                            editFlashcardField(f.id, "front", value),
                          )
                        }
                        status={editor.status[`flashcard:${f.id}.front`]}
                        ariaLabel="Flashcard prompt"
                        placeholder="Enter the concept, term, or question…"
                        rows={2}
                        className="text-[15px] font-semibold leading-snug text-white"
                      />
                    </div>

                    {/* Back: Answer / Key Takeaways Face */}
                    <div
                      className={`flex flex-col gap-1 rounded-lg border p-3 transition-colors ${
                        isFlipped ? "border-primary/30 bg-primary/[0.06]" : "border-white/[0.06] bg-black/25"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[13px] font-semibold text-white/80">Back</span>
                        {isFlipped && <span className="text-xs font-semibold text-[#ff7a5c]">Showing</span>}
                      </div>
                      <EditableField
                        value={f.back}
                        onChange={(value) =>
                          editor.editField(`flashcard:${f.id}.back`, editFlashcardField(f.id, "back", value))
                        }
                        status={editor.status[`flashcard:${f.id}.back`]}
                        ariaLabel="Flashcard answer"
                        placeholder="Enter the concise answer, key bullets, or code outline…"
                        rows={2}
                        className="text-sm leading-relaxed text-white/70"
                      />
                    </div>
                  </div>
                </motion.li>
              );
            })}
          </AnimatePresence>

          {flashcards.length === 0 && (
            <div className="sm:col-span-2 rounded-lg border border-dashed border-border/70 p-8 text-center flex flex-col items-center justify-center gap-2">
              <Layers className="size-8 text-muted-foreground/50" />
              <p className="text-xs text-muted-foreground">
                No flashcards created yet. Click Add flashcard or Regenerate to populate your deck.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setAddOpen(true)}
                className="rounded-lg text-xs gap-1 mt-1"
              >
                <Plus className="size-3 text-[#ff7a5c]" />
                <span>Add your first flashcard</span>
              </Button>
            </div>
          )}
        </ul>
      </CardContent>

      <AddFlashcardDialog open={addOpen} onOpenChange={setAddOpen} onAdd={handleAddFlashcard} />
    </Card>
  );
}

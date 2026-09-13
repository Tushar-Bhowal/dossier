"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { Layers, Plus, Repeat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
    <Card className="rounded-lg border-border/80">
      <SectionHeader
        icon={<Layers className="size-4" />}
        title="Flashcard Deck"
        count={flashcards.length}
        description="High-yield concept cards for quick active-recall study and Leitner spaced repetition."
        onRegenerate={() => void editor.regenerate("flashcards", "flashcards")}
        regenerating={editor.regenerating.has("flashcards")}
        error={editor.regenerateError.flashcards}
        action={
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setAddOpen(true)}
            className="rounded h-8 px-2.5 text-xs text-foreground font-medium gap-1.5 border-border/70 hover:bg-accent transition-colors"
          >
            <Plus className="size-3.5 text-[#FB4128]" />
            <span>Add flashcard</span>
          </Button>
        }
      />

      <CardContent className="pt-4">
        <ul className="grid gap-3.5 sm:grid-cols-2 list-none p-0 m-0">
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
                  className={`group relative flex flex-col justify-between rounded border p-3.5 sm:p-4 bg-card/60 hover:bg-card hover:border-border transition-all shadow-xs hover:shadow-sm ${
                    f.pinned ? "ring-1 ring-primary/25 border-primary/40 bg-primary/5" : "border-border/70"
                  }`}
                >
                  <div className="flex flex-col gap-3">
                    {/* Top bar: Card index, Origin, Flip Preview, Pin/Delete */}
                    <div className="flex items-center justify-between gap-1.5 border-b border-border/40 pb-2.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-[11px] font-mono text-muted-foreground font-medium">
                          #{idx + 1}
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
                          className="h-6 px-1.5 text-[10px] text-muted-foreground hover:text-foreground gap-1 rounded"
                        >
                          <Repeat className="size-3" />
                          <span>{isFlipped ? "Show Front" : "Flip Preview"}</span>
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
                    <div className={`flex flex-col gap-1 transition-opacity duration-200 ${isFlipped ? "opacity-40" : "opacity-100"}`}>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase font-mono tracking-wider font-semibold text-[#FB4128]">
                          Front · Prompt
                        </span>
                        {isFlipped && <span className="text-[10px] text-muted-foreground italic">(Hidden during preview)</span>}
                      </div>
                      <EditableField
                        value={f.front}
                        onChange={(value) => editor.editField(`flashcard:${f.id}.front`, editFlashcardField(f.id, "front", value))}
                        status={editor.status[`flashcard:${f.id}.front`]}
                        ariaLabel="Flashcard prompt"
                        placeholder="Enter the concept, term, or question…"
                        rows={2}
                        className="text-sm font-medium leading-snug text-foreground bg-transparent border-border/40 hover:border-border focus:border-border/80"
                      />
                    </div>

                    {/* Back: Answer / Key Takeaways Face */}
                    <div
                      className={`flex flex-col gap-1 rounded border p-2.5 transition-all ${
                        isFlipped
                          ? "bg-[#FB4128]/5 border-[#FB4128]/30 ring-1 ring-[#FB4128]/20"
                          : "bg-muted/30 border-border/40"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase font-mono tracking-wider font-semibold text-foreground/80">
                          Back · Answer / Key Takeaways
                        </span>
                        {isFlipped && (
                          <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4 rounded bg-[#FB4128]/15 text-[#FB4128]">
                            Active Face
                          </Badge>
                        )}
                      </div>
                      <EditableField
                        value={f.back}
                        onChange={(value) => editor.editField(`flashcard:${f.id}.back`, editFlashcardField(f.id, "back", value))}
                        status={editor.status[`flashcard:${f.id}.back`]}
                        ariaLabel="Flashcard answer"
                        placeholder="Enter the concise answer, key bullets, or code outline…"
                        rows={2}
                        className="text-xs leading-relaxed text-muted-foreground bg-transparent border-transparent hover:border-border/40 focus:border-border/70 p-1"
                      />
                    </div>
                  </div>
                </motion.li>
              );
            })}
          </AnimatePresence>

          {flashcards.length === 0 && (
            <div className="sm:col-span-2 rounded border border-dashed border-border/70 p-8 text-center flex flex-col items-center justify-center gap-2">
              <Layers className="size-8 text-muted-foreground/50" />
              <p className="text-xs text-muted-foreground">
                No flashcards created yet. Click Add flashcard or Regenerate to populate your deck.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setAddOpen(true)}
                className="rounded text-xs gap-1 mt-1"
              >
                <Plus className="size-3 text-[#FB4128]" />
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

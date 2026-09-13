"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface AddFlashcardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (content: { front: string; back: string }) => Promise<void> | void;
}

export function AddFlashcardDialog({ open, onOpenChange, onAdd }: AddFlashcardDialogProps) {
  const [front, setFront] = React.useState("");
  const [back, setBack] = React.useState("");
  const [showErrors, setShowErrors] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);

  const frontIsEmpty = front.trim().length === 0;
  const backIsEmpty = back.trim().length === 0;
  const isIncomplete = frontIsEmpty || backIsEmpty;

  React.useEffect(() => {
    if (open) {
      setFront("");
      setBack("");
      setShowErrors(false);
      setIsSaving(false);
    }
  }, [open]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (isIncomplete || isSaving) {
      if (isIncomplete) setShowErrors(true);
      return;
    }
    setIsSaving(true);
    try {
      await onAdd({ front, back });
    } finally {
      setIsSaving(false);
      onOpenChange(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !isSaving && onOpenChange(next)}>
      <DialogContent className="sm:max-w-xl" showCloseButton={!isSaving}>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Add a flashcard</DialogTitle>
            <DialogDescription>
              Both sides are required — a card with a blank side can&apos;t be practised against.
              It&apos;s marked as your own, so regenerating the deck won&apos;t replace it.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-2">
            <Label htmlFor="add-flashcard-front">
              Front — the prompt <span className="text-[#FB4128]">*</span>
            </Label>
            <Textarea
              id="add-flashcard-front"
              value={front}
              onChange={(e) => {
                setFront(e.target.value);
                if (showErrors) setShowErrors(false);
              }}
              placeholder="e.g. What does the CAP theorem trade off?"
              rows={3}
              autoFocus
              aria-invalid={showErrors && frontIsEmpty}
              className="rounded-lg text-sm"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="add-flashcard-back">
              Back — key takeaways <span className="text-[#FB4128]">*</span>
            </Label>
            <Textarea
              id="add-flashcard-back"
              value={back}
              onChange={(e) => {
                setBack(e.target.value);
                if (showErrors) setShowErrors(false);
              }}
              placeholder="e.g. Under a network partition you choose consistency or availability, not both."
              rows={4}
              aria-invalid={showErrors && backIsEmpty}
              className="rounded-lg text-sm"
            />
          </div>

          {showErrors && isIncomplete ? (
            <p className="text-xs text-destructive">
              {frontIsEmpty && backIsEmpty
                ? "Both sides need text before this card can be saved."
                : frontIsEmpty
                  ? "The front of the card still needs text."
                  : "The back of the card still needs text."}
            </p>
          ) : null}

          <DialogFooter className="mt-1">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
              className="h-9 rounded-lg px-4 text-xs font-medium"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isIncomplete || isSaving}
              className="h-9 gap-1.5 rounded-lg bg-[#FB4128] px-4 text-xs font-medium text-white hover:bg-[#FB4128]/90"
            >
              {isSaving ? <Loader2 className="size-3.5 animate-spin" /> : null}
              <span>{isSaving ? "Adding…" : "Add flashcard"}</span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

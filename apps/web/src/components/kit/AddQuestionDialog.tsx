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

interface AddQuestionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categoryLabel: string;
  onAdd: (content: { prompt: string; answerOutline: string }) => Promise<void> | void;
}

export function AddQuestionDialog({
  open,
  onOpenChange,
  categoryLabel,
  onAdd,
}: AddQuestionDialogProps) {
  const [prompt, setPrompt] = React.useState("");
  const [answerOutline, setAnswerOutline] = React.useState("");
  const [showPromptError, setShowPromptError] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);

  const promptIsEmpty = prompt.trim().length === 0;

  // Reset whenever the dialog opens, so a cancelled draft never leaks into the next one.
  React.useEffect(() => {
    if (open) {
      setPrompt("");
      setAnswerOutline("");
      setShowPromptError(false);
      setIsSaving(false);
    }
  }, [open]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (promptIsEmpty || isSaving) {
      if (promptIsEmpty) setShowPromptError(true);
      return;
    }
    setIsSaving(true);
    try {
      await onAdd({ prompt, answerOutline });
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
            <DialogTitle>Add a question</DialogTitle>
            <DialogDescription>
              Added to <span className="text-foreground">{categoryLabel}</span>. It&apos;s marked as
              your own, so regenerating this category won&apos;t replace it.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-2">
            <Label htmlFor="add-question-prompt">
              Question <span className="text-[#FB4128]">*</span>
            </Label>
            <Textarea
              id="add-question-prompt"
              value={prompt}
              onChange={(e) => {
                setPrompt(e.target.value);
                if (showPromptError) setShowPromptError(false);
              }}
              placeholder="e.g. How would you design a rate limiter for a public API?"
              rows={3}
              autoFocus
              aria-invalid={showPromptError}
              aria-describedby={showPromptError ? "add-question-prompt-error" : undefined}
              className="rounded-lg text-sm"
            />
            {showPromptError ? (
              <p id="add-question-prompt-error" className="text-xs text-destructive">
                A question needs some text before it can be saved.
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="add-question-answer">
              Answer guide <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              id="add-question-answer"
              value={answerOutline}
              onChange={(e) => setAnswerOutline(e.target.value)}
              placeholder="Key points a strong answer should cover. You can fill this in later."
              rows={4}
              className="rounded-lg text-sm"
            />
          </div>

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
              disabled={promptIsEmpty || isSaving}
              className="h-9 gap-1.5 rounded-lg bg-[#FB4128] px-4 text-xs font-medium text-white hover:bg-[#FB4128]/90"
            >
              {isSaving ? <Loader2 className="size-3.5 animate-spin" /> : null}
              <span>{isSaving ? "Adding…" : "Add question"}</span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

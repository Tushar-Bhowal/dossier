"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import type { Requirement } from "@dossier/core";
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

export interface NewRequirement {
  text: string;
  kind: Requirement["kind"];
  priority: Requirement["priority"];
}

interface AddRequirementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (content: NewRequirement) => Promise<void> | void;
}

const KINDS: { value: Requirement["kind"]; label: string }[] = [
  { value: "technical", label: "Technical" },
  { value: "behavioural", label: "Behavioural" },
  { value: "domain", label: "Domain" },
];

const PRIORITIES: { value: Requirement["priority"]; label: string }[] = [
  { value: "must", label: "Must-have" },
  { value: "nice", label: "Nice-to-have" },
];

const selectClass =
  "h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30";

export function AddRequirementDialog({ open, onOpenChange, onAdd }: AddRequirementDialogProps) {
  const [text, setText] = React.useState("");
  const [kind, setKind] = React.useState<Requirement["kind"]>("technical");
  const [priority, setPriority] = React.useState<Requirement["priority"]>("must");
  const [showTextError, setShowTextError] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);

  const textIsEmpty = text.trim().length === 0;

  React.useEffect(() => {
    if (open) {
      setText("");
      setKind("technical");
      setPriority("must");
      setShowTextError(false);
      setIsSaving(false);
    }
  }, [open]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (textIsEmpty || isSaving) {
      if (textIsEmpty) setShowTextError(true);
      return;
    }
    setIsSaving(true);
    try {
      await onAdd({ text, kind, priority });
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
            <DialogTitle>Add a requirement</DialogTitle>
            <DialogDescription>
              Marked as your own, so regenerating requirements won&apos;t replace it. Must-haves are
              the ones coverage checks against.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-2">
            <Label htmlFor="add-requirement-text">
              Requirement <span className="text-[#FB4128]">*</span>
            </Label>
            <Textarea
              id="add-requirement-text"
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                if (showTextError) setShowTextError(false);
              }}
              placeholder="e.g. 5+ years building distributed systems in production"
              rows={3}
              autoFocus
              aria-invalid={showTextError}
              aria-describedby={showTextError ? "add-requirement-text-error" : undefined}
              className="rounded-lg text-sm"
            />
            {showTextError ? (
              <p id="add-requirement-text-error" className="text-xs text-destructive">
                A requirement needs some text before it can be saved.
              </p>
            ) : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="add-requirement-kind">Kind</Label>
              <select
                id="add-requirement-kind"
                value={kind}
                onChange={(e) => setKind(e.target.value as Requirement["kind"])}
                className={selectClass}
              >
                {KINDS.map((k) => (
                  <option key={k.value} value={k.value}>
                    {k.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="add-requirement-priority">Priority</Label>
              <select
                id="add-requirement-priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value as Requirement["priority"])}
                className={selectClass}
              >
                {PRIORITIES.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
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
              disabled={textIsEmpty || isSaving}
              className="h-9 gap-1.5 rounded-lg bg-[#FB4128] px-4 text-xs font-medium text-white hover:bg-[#FB4128]/90"
            >
              {isSaving ? <Loader2 className="size-3.5 animate-spin" /> : null}
              <span>{isSaving ? "Adding…" : "Add requirement"}</span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

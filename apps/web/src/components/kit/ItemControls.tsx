"use client";

import * as React from "react";
import { Pin, PinOff, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "@/components/ui/toast";

interface ItemControlsProps {
  pinned: boolean;
  onTogglePin: () => void;
  onDelete: () => Promise<void> | void;
  deleteLabel: string;
}

export function ItemControls({ pinned, onTogglePin, onDelete, deleteLabel }: ItemControlsProps) {
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  const noun = deleteLabel.replace(/^Delete\s+/i, "").trim();
  const itemTitle = noun.charAt(0).toUpperCase() + noun.slice(1);

  const handleConfirmDelete = async () => {
    try {
      await onDelete();
      toast.success(`${itemTitle || "Item"} deleted`);
    } catch (err) {
      toast.error(`Failed to delete ${noun || "item"}`, {
        description: err instanceof Error ? err.message : "Please try again.",
      });
    }
  };

  return (
    <>
      <div className="flex shrink-0 items-center gap-0.5">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="size-7 text-muted-foreground hover:text-foreground"
          aria-label={pinned ? "Unpin" : "Pin"}
          aria-pressed={pinned}
          onClick={onTogglePin}
        >
          {pinned ? <Pin className="size-3.5 fill-current text-primary" /> : <PinOff className="size-3.5" />}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="size-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
          aria-label={deleteLabel}
          onClick={() => setConfirmOpen(true)}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`${deleteLabel}?`}
        description={`Are you sure you want to delete this ${noun || "item"}? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleConfirmDelete}
      />
    </>
  );
}

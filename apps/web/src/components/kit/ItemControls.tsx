"use client";

import { Pin, PinOff, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ItemControlsProps {
  pinned: boolean;
  onTogglePin: () => void;
  onDelete: () => void;
  deleteLabel: string;
}

export function ItemControls({ pinned, onTogglePin, onDelete, deleteLabel }: ItemControlsProps) {
  return (
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
        onClick={() => {
          if (window.confirm(`${deleteLabel}? This can't be undone.`)) onDelete();
        }}
      >
        <Trash2 className="size-3.5" />
      </Button>
    </div>
  );
}

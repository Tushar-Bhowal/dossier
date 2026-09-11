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
    <div className="flex shrink-0 items-center gap-1">
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={pinned ? "Unpin" : "Pin"}
        aria-pressed={pinned}
        onClick={onTogglePin}
      >
        {pinned ? <Pin className="fill-current" /> : <PinOff />}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={deleteLabel}
        onClick={() => {
          if (window.confirm(`${deleteLabel}? This can't be undone.`)) onDelete();
        }}
      >
        <Trash2 />
      </Button>
    </div>
  );
}

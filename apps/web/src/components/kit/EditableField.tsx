"use client";

import { useEffect, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { SaveStatusIndicator } from "./SaveStatusIndicator";
import type { SaveStatus } from "@/lib/optimistic";

interface EditableFieldProps {
  value: string;
  onChange: (value: string) => void;
  status?: SaveStatus;
  placeholder?: string;
  ariaLabel: string;
  className?: string;
  rows?: number;
}

export function EditableField({
  value,
  onChange,
  status,
  placeholder,
  ariaLabel,
  className,
  rows = 2,
}: EditableFieldProps) {
  // Local text state so keystrokes render instantly; `value` from the parent only ever moves this
  // forward on save/rebase, never mid-typing, since the parent already holds the optimistic edit.
  // Resetting on prop change during render (React's documented pattern for this) rather than in an
  // effect avoids an extra render pass.
  const [prevValue, setPrevValue] = useState(value);
  const [local, setLocal] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    setLocal(value);
  }

  // "Saved" is a moment, not a permanent label — fade it back to blank after a couple seconds
  // rather than leaving every touched field marked forever.
  const [prevStatus, setPrevStatus] = useState(status);
  const [displayStatus, setDisplayStatus] = useState(status);
  if (status !== prevStatus) {
    setPrevStatus(status);
    setDisplayStatus(status);
  }
  useEffect(() => {
    if (status === "saved") {
      const t = setTimeout(() => setDisplayStatus(undefined), 2000);
      return () => clearTimeout(t);
    }
  }, [status]);

  return (
    <div className="-mx-3 flex flex-col gap-0.5">
      <Textarea
        value={local}
        onChange={(e) => {
          setLocal(e.target.value);
          onChange(e.target.value);
        }}
        placeholder={placeholder}
        aria-label={ariaLabel}
        rows={rows}
        className={cn(
          "min-h-0 resize-none border-transparent bg-transparent px-3 py-2 shadow-none transition-[background-color,border-color,box-shadow] hover:border-white/[0.07] hover:bg-white/[0.03] focus-visible:bg-white/[0.03]",
          className,
        )}
      />
      <SaveStatusIndicator status={displayStatus} />
    </div>
  );
}

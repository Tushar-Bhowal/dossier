"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface NewKitTileProps {
  onClick: () => void;
  className?: string;
}

export function NewKitTile({ onClick, className }: NewKitTileProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      aria-label="Create new interview kit"
      className={cn(
        "group relative flex min-h-[12rem] h-full flex-col items-center justify-center gap-2.5 rounded-lg border-2 border-dashed border-border/60 bg-card/30 p-6 text-center transition-all duration-200 cursor-pointer select-none",
        "hover:border-[#FB4128]/60 hover:bg-[#FB4128]/5 hover:shadow-[0_0_20px_rgba(251,65,40,0.08)]",
        "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        className
      )}
    >
      <div className="flex size-10 items-center justify-center rounded-lg bg-muted/60 transition-transform duration-200 group-hover:scale-110 group-hover:bg-[#FB4128]/15 group-hover:text-[#FB4128]">
        <Plus className="size-5 text-muted-foreground group-hover:text-[#FB4128] transition-colors" />
      </div>
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-semibold text-foreground/90 group-hover:text-foreground">
          New kit
        </span>
        <span className="text-xs text-muted-foreground/70 group-hover:text-muted-foreground">
          Paste a JD to generate prep
        </span>
      </div>
    </div>
  );
}

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
        "group relative flex h-full min-h-[15rem] cursor-pointer select-none flex-col items-center justify-center gap-4 rounded-lg border-2 border-dashed border-white/[0.12] bg-white/[0.015] p-6 text-center transition-all duration-200",
        "hover:border-primary/50 hover:bg-primary/[0.04] hover:shadow-[0_0_40px_-10px_rgba(251,65,40,0.35)]",
        "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        className,
      )}
    >
      <div className="flex size-12 items-center justify-center rounded-lg bg-[#dc3019] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_10px_30px_-10px_rgba(251,65,40,0.8)] transition-transform duration-200 group-hover:scale-110">
        <Plus className="size-6" />
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-[17px] font-semibold text-white">New kit</span>
        <span className="max-w-[16rem] text-sm leading-relaxed text-white/55">
          Paste a job description and a company URL. Ready in a few minutes.
        </span>
      </div>
    </div>
  );
}

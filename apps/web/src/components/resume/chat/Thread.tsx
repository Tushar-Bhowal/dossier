"use client";

import * as React from "react";
import Image from "next/image";
import { CheckCircle2, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const LONG_MESSAGE = 600;

export function UserMessage({ text, fileName }: { text: string; fileName?: string }) {
  const [expanded, setExpanded] = React.useState(false);
  const long = text.length > LONG_MESSAGE || text.split("\n").length > 8;
  return (
    <div className="flex justify-end">
      <div className="flex max-w-[88%] flex-col items-end gap-2">
        {fileName && (
          <span className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-semibold text-white/85">
            <FileText className="size-4 text-[#ff7a5c]" aria-hidden />
            {fileName}
          </span>
        )}
        {text && (
          <div className="rounded-lg bg-white/[0.07] px-4 py-3">
            <p
              className={cn(
                "whitespace-pre-wrap text-[15px] leading-relaxed text-white",
                long && !expanded && "line-clamp-6",
              )}
            >
              {text}
            </p>
            {long && (
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                aria-expanded={expanded}
                className="mt-2 text-sm font-semibold text-[#ff7a5c] hover:text-white"
              >
                {expanded ? "Show less" : "Show all"}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Consecutive assistant turns share one avatar, so only the first of a run shows the logo.
export function AssistantMessage({
  children,
  className,
  avatar = true,
}: {
  children: React.ReactNode;
  className?: string;
  avatar?: boolean;
}) {
  return (
    <div className={cn("flex items-start gap-3", className)}>
      {avatar ? (
        <Image src="/logo.png" alt="Dossier" width={28} height={28} className="mt-0.5 size-7 shrink-0 rounded-md" />
      ) : (
        <span className="w-7 shrink-0" aria-hidden />
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-3">{children}</div>
    </div>
  );
}

export function AssistantText({ children }: { children: React.ReactNode }) {
  return <p className="pt-0.5 text-[15px] leading-relaxed text-white/85">{children}</p>;
}

export const cardClass =
  "rounded-lg border border-white/[0.08] bg-[#111111] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]";

export function CardTitle({ title, note }: { title: string; note?: React.ReactNode }) {
  return (
    <div className="mb-4">
      <h2 className="text-[17px] font-semibold text-white">{title}</h2>
      {note && <p className="mt-1 text-sm leading-relaxed text-white/60">{note}</p>}
    </div>
  );
}

// A finished step collapses to one line so the thread stays short.
export function DoneSummary({
  children,
  onChange,
  actionLabel = "Change",
}: {
  children: React.ReactNode;
  onChange?: () => void;
  actionLabel?: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-3">
      <CheckCircle2 className="size-[18px] shrink-0 text-emerald-400" aria-hidden />
      <p className="min-w-0 flex-1 truncate text-sm font-medium text-white/75">{children}</p>
      {onChange && (
        <Button type="button" variant="ghost" size="sm" onClick={onChange} className="text-white/70">
          {actionLabel}
        </Button>
      )}
    </div>
  );
}

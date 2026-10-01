"use client";

import * as React from "react";
import { Mic, Square } from "lucide-react";
import { DICTATION_LANGUAGES, useDictation } from "@/lib/resume/dictation";
import { useScenario } from "@/lib/resume/demo/scenario";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const panelClass =
  "rounded-lg border border-white/[0.08] bg-[#111111] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] sm:p-8";

export function DictationLanguageSelect({
  value,
  onChange,
  compact = false,
}: {
  value: string;
  onChange: (code: string) => void;
  compact?: boolean;
}) {
  return (
    <select
      aria-label="Language you'll speak in"
      title="Language you'll speak in"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "h-9 rounded-lg text-sm font-semibold outline-none focus-visible:ring-3 focus-visible:ring-primary/20",
        compact
          ? "cursor-pointer border border-transparent bg-transparent px-1.5 text-white/70 hover:bg-white/[0.06] hover:text-white [&>option]:bg-[#161616]"
          : "border border-white/10 bg-[#161616] px-2.5 text-white focus-visible:border-primary/60",
      )}
    >
      {DICTATION_LANGUAGES.map((l) => (
        <option key={l.code} value={l.code}>
          {compact ? l.short : l.label}
        </option>
      ))}
    </select>
  );
}

// Hidden entirely where the browser has no speech recognition — typing always works.
export function DictationButton({
  lang,
  onText,
  label = "Speak",
  compact = false,
  className,
}: {
  lang: string;
  onText: (text: string) => void;
  label?: string;
  compact?: boolean;
  className?: string;
}) {
  const scenario = useScenario();
  const { supported, listening, error, start, stop } = useDictation({
    lang,
    onFinalText: onText,
    forceUnsupported: scenario.fail === "no_speech",
  });

  if (!supported) return null;

  if (compact) {
    return (
      <span className={cn("relative", className)}>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={listening ? stop : start}
          aria-pressed={listening}
          aria-label={listening ? "Stop listening" : "Speak instead of typing"}
          title={error ?? (listening ? "Stop listening" : "Speak instead of typing")}
          className={cn(listening ? "bg-primary/15 text-[#ff7a5c]" : "text-white/70", error && "text-amber-300")}
        >
          {listening ? <Square className="size-3.5 fill-current" /> : <Mic className="size-[18px]" />}
        </Button>
        {listening && <span className="absolute right-1 top-1 size-2 animate-pulse rounded-full bg-[#ff7a5c]" aria-hidden />}
      </span>
    );
  }

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Button
        type="button"
        variant="outline"
        onClick={listening ? stop : start}
        aria-pressed={listening}
        className={cn(listening && "border-primary/50 bg-primary/10 text-white")}
      >
        {listening ? <Square className="size-3.5 fill-current" /> : <Mic className="size-4 text-[#ff7a5c]" />}
        {listening ? "Stop listening" : label}
      </Button>
      {error && <p className="text-[13px] font-medium text-amber-300">{error}</p>}
    </div>
  );
}

export function Chip({
  selected,
  onClick,
  children,
}: {
  selected?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "inline-flex h-9 items-center rounded-lg border px-3.5 text-sm font-semibold transition-colors",
        selected
          ? "border-primary/50 bg-primary/15 text-white"
          : "border-white/10 bg-white/[0.03] text-white/75 hover:border-white/20 hover:text-white",
      )}
    >
      {children}
    </button>
  );
}

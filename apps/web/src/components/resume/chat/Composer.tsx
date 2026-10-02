"use client";

import * as React from "react";
import { AlertCircle, ArrowUp, FileText, LoaderCircle, MapPin, Paperclip, X } from "lucide-react";
import type { Redaction, Region } from "@dossier/core/resume";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DictationButton, DictationLanguageSelect } from "../parts";

export interface ImportedText {
  original: string;
  redaction: Redaction;
}

export type Attachment =
  | { status: "reading"; name: string }
  | { status: "ready"; name: string; imported: ImportedText }
  | { status: "unreadable"; name: string; reason: string };

function isTouch(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
}

function AttachmentChip({ attachment, onRemove }: { attachment: Attachment; onRemove?: () => void }) {
  const unreadable = attachment.status === "unreadable";
  return (
    <div
      className={cn(
        "mx-1 mt-1 mb-2 flex items-start gap-3 rounded-lg border p-3",
        unreadable ? "border-amber-500/30 bg-amber-500/10" : "border-white/10 bg-white/[0.04]",
      )}
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#dc3019] text-white">
        <FileText className="size-[18px]" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-white">{attachment.name}</p>
        <p
          className={cn("mt-0.5 flex items-center gap-1.5 text-[13px] font-medium", unreadable ? "text-amber-200" : "text-white/60")}
          role={unreadable ? "alert" : "status"}
        >
          {attachment.status === "reading" && <LoaderCircle className="size-3.5 animate-spin" aria-hidden />}
          {unreadable && <AlertCircle className="size-3.5 shrink-0" aria-hidden />}
          {attachment.status === "reading"
            ? "Reading in your browser…"
            : attachment.status === "ready"
              ? `Read in your browser · ${attachment.imported.redaction.items.length} contact detail${attachment.imported.redaction.items.length === 1 ? "" : "s"} hidden from the AI`
              : attachment.reason}
        </p>
      </div>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${attachment.name}`}
          className="flex size-7 shrink-0 items-center justify-center rounded-md text-white/55 hover:bg-white/10 hover:text-white"
        >
          <X className="size-4" />
        </button>
      )}
    </div>
  );
}

export function Composer({
  variant,
  value,
  onChange,
  onSubmit,
  canSubmit,
  busy = false,
  placeholder,
  lang,
  onLangChange,
  region,
  onRegionChange,
  attachment,
  onPickFile,
  onRemoveAttachment,
}: {
  variant: "hero" | "docked";
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  canSubmit: boolean;
  busy?: boolean;
  placeholder: string;
  lang: string;
  onLangChange: (code: string) => void;
  region?: Region;
  onRegionChange?: (region: Region) => void;
  attachment?: Attachment | null;
  onPickFile?: (file: File) => void;
  onRemoveAttachment?: () => void;
}) {
  const fileInput = React.useRef<HTMLInputElement>(null);
  const hero = variant === "hero";

  const textarea = (
    <>
      <label htmlFor={`composer-${variant}`} className="sr-only">
        {placeholder}
      </label>
      <textarea
        id={`composer-${variant}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          // Enter sends on desktop; IME composition (typing Hindi or Bengali) and phones keep Enter as a newline.
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && !isTouch()) {
            e.preventDefault();
            if (canSubmit && !busy) onSubmit();
          }
        }}
        placeholder={placeholder}
        rows={hero ? 3 : 1}
        // The opening message can be a whole pasted resume (the import path takes 20k); notes stop at 1,000.
        maxLength={hero ? 20_000 : 1000}
        className={cn(
          "field-sizing-content block w-full resize-none bg-transparent text-base leading-relaxed text-white outline-none placeholder:text-white/40",
          hero ? "min-h-[96px] max-h-64 px-3 pt-2.5 pb-1" : "min-h-10 max-h-40 px-2.5 py-2",
        )}
      />
    </>
  );

  const voiceAndSend = (
    <div className="flex shrink-0 items-center gap-0.5">
      <DictationLanguageSelect compact value={lang} onChange={onLangChange} />
      <DictationButton compact lang={lang} onText={(t) => onChange(value ? `${value.trimEnd()} ${t}` : t)} />
      <Button
        type="submit"
        size="icon"
        disabled={!canSubmit || busy}
        aria-label="Send"
        className="ml-1 disabled:bg-white/[0.08] disabled:text-white/35 disabled:shadow-none"
      >
        {busy ? <LoaderCircle className="size-[18px] animate-spin" /> : <ArrowUp className="size-[18px]" strokeWidth={2.5} />}
      </Button>
    </div>
  );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (canSubmit && !busy) onSubmit();
      }}
      className={cn(
        "rounded-lg border border-white/[0.1] bg-[#151515] transition-[border-color,box-shadow] focus-within:border-white/20",
        hero
          ? "p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_0_0_6px_rgba(255,255,255,0.02),0_40px_100px_-40px_rgba(251,65,40,0.45)] focus-within:shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_0_0_6px_rgba(251,65,40,0.08),0_40px_100px_-40px_rgba(251,65,40,0.55)]"
          : "p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_20px_50px_-20px_rgba(0,0,0,0.9)]",
      )}
    >
      {attachment && <AttachmentChip attachment={attachment} onRemove={onRemoveAttachment} />}

      {hero ? (
        <>
          {textarea}
          <div className="mt-1 flex items-center gap-1">
            {onPickFile && (
              <>
                <input
                  ref={fileInput}
                  type="file"
                  accept="application/pdf,.pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx"
                  className="sr-only"
                  tabIndex={-1}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) onPickFile(file);
                    e.target.value = "";
                  }}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => fileInput.current?.click()}
                  aria-label="Attach your current resume (PDF or Word)"
                  title="Attach your current resume (PDF or Word)"
                  className="text-white/70"
                >
                  <Paperclip className="size-[18px]" />
                </Button>
              </>
            )}
            {region && onRegionChange && (
              <button
                type="button"
                onClick={() => onRegionChange(region === "IN" ? "abroad" : "IN")}
                aria-label={`Applying for jobs ${region === "IN" ? "in India" : "outside India"}. Click to change.`}
                title="Where you're applying — this decides things like whether a photo is expected"
                className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-semibold text-white/70 transition-colors hover:bg-white/[0.06] hover:text-white"
              >
                <MapPin className="size-4 text-[#ff7a5c]" aria-hidden />
                {region === "IN" ? "Jobs in India" : "Jobs abroad"}
              </button>
            )}
            <div className="ml-auto">{voiceAndSend}</div>
          </div>
        </>
      ) : (
        <div className="flex items-end gap-1">
          <div className="min-w-0 flex-1">{textarea}</div>
          <div className="pb-0.5">{voiceAndSend}</div>
        </div>
      )}
    </form>
  );
}

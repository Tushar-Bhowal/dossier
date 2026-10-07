"use client";

import * as React from "react";
import { ArrowUp, FileText, LoaderCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DictationButton, DictationLanguageSelect } from "@/components/resume/parts";
import { LONG_PASTE } from "./useAssistant";

const LANG_KEY = "dossier.assistant.lang";
const MAX_TEXT = 4000;
const MAX_PASTE = 20_000;

function isTouch(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
}

function storedLang(): string {
  try {
    return localStorage.getItem(LANG_KEY) ?? "en-IN";
  } catch {
    return "en-IN";
  }
}

export interface ComposerHandle {
  focus: () => void;
  fill: (text: string) => void;
}

// A long paste (a recruiter email, a job description) becomes a chip rather than text in the box:
// the assistant treats it as someone else's words and only suggests changes from it.
export function Composer({
  onSend,
  busy,
  placeholder,
  large = false,
  id,
  ref,
}: {
  onSend: (text: string, attachment?: string) => void;
  busy: boolean;
  placeholder: string;
  large?: boolean;
  id: string;
  ref?: React.Ref<ComposerHandle>;
}) {
  const [text, setText] = React.useState("");
  const [attachment, setAttachment] = React.useState<string | null>(null);
  // The dashboard only renders in the browser (it waits for the signed-in user), so this is safe to read here.
  const [lang, setLang] = React.useState(storedLang);
  const area = React.useRef<HTMLTextAreaElement>(null);

  React.useImperativeHandle(ref, () => ({
    focus: () => area.current?.focus(),
    fill: (value: string) => {
      setText(value);
      requestAnimationFrame(() => {
        area.current?.focus();
        area.current?.setSelectionRange(value.length, value.length);
      });
    },
  }));

  const canSend = !busy && (text.trim().length > 0 || !!attachment);

  function send() {
    if (!canSend) return;
    onSend(text, attachment ?? undefined);
    setText("");
    setAttachment(null);
    area.current?.focus();
  }

  function changeLang(code: string) {
    setLang(code);
    try {
      localStorage.setItem(LANG_KEY, code);
    } catch {
      // private mode: the choice just isn't remembered
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        send();
      }}
      className={cn(
        "rounded-lg border border-white/[0.1] bg-[#151515] transition-[border-color,box-shadow] focus-within:border-white/20",
        large
          ? "p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_0_0_6px_rgba(255,255,255,0.02),0_40px_100px_-40px_rgba(251,65,40,0.45)] focus-within:shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_0_0_6px_rgba(251,65,40,0.08),0_40px_100px_-40px_rgba(251,65,40,0.55)]"
          : "p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_20px_50px_-20px_rgba(0,0,0,0.9)]",
      )}
    >
      {attachment && (
        <div className="mx-1 mt-1 mb-2 flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.04] p-2.5">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#dc3019] text-white" aria-hidden>
            <FileText className="size-[18px]" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-white">Pasted text · {attachment.length.toLocaleString("en-US")} characters</p>
            <p className="text-[13px] font-medium text-white/60">I&apos;ll suggest updates from it. Nothing changes until you tap Apply.</p>
          </div>
          <button
            type="button"
            onClick={() => setAttachment(null)}
            aria-label="Remove pasted text"
            className="flex size-8 shrink-0 items-center justify-center rounded-md text-white/55 hover:bg-white/10 hover:text-white"
          >
            <X className="size-4" />
          </button>
        </div>
      )}
      <div className={cn(large ? "flex flex-col" : "flex items-end gap-1")}>
        <label htmlFor={id} className="sr-only">
          {placeholder}
        </label>
        <textarea
          id={id}
          ref={area}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onPaste={(e) => {
            const pasted = e.clipboardData.getData("text");
            if (pasted.length <= LONG_PASTE) return;
            e.preventDefault();
            setAttachment(pasted.slice(0, MAX_PASTE));
          }}
          onKeyDown={(e) => {
            // Enter sends on desktop; IME composition (typing Hindi) and phones keep Enter as a newline.
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && !isTouch()) {
              e.preventDefault();
              send();
            }
          }}
          placeholder={attachment ? "Add a note, or just send" : placeholder}
          rows={large ? 2 : 1}
          maxLength={MAX_TEXT}
          className={cn(
            "field-sizing-content block w-full min-w-0 flex-1 resize-none bg-transparent text-base leading-relaxed text-white outline-none placeholder:text-white/40",
            large ? "min-h-[72px] max-h-64 px-3 pt-2 pb-1" : "min-h-10 max-h-40 px-2.5 py-2",
          )}
        />
        <div className={cn("flex shrink-0 items-center gap-0.5", large ? "mt-1 justify-end" : "pb-0.5")}>
          <DictationLanguageSelect compact value={lang} onChange={changeLang} />
          <DictationButton compact lang={lang} onText={(t) => setText((v) => (v ? `${v.trimEnd()} ${t}` : t))} />
          <Button
            type="submit"
            size="icon"
            disabled={!canSend}
            aria-label="Send"
            className="ml-1 disabled:bg-white/[0.08] disabled:text-white/35 disabled:shadow-none"
          >
            {busy ? <LoaderCircle className="size-[18px] animate-spin" /> : <ArrowUp className="size-[18px]" strokeWidth={2.5} />}
          </Button>
        </div>
      </div>
    </form>
  );
}

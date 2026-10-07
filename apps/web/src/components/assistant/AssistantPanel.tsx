"use client";

import * as React from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { MessageSquareText, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/utils";
import { Composer, type ComposerHandle } from "./Composer";
import { Thread } from "./Thread";
import { useAssistant } from "./useAssistant";

const PanelContext = React.createContext<{ open: boolean; setOpen: (open: boolean) => void }>({ open: false, setOpen: () => {} });

export function useAssistantPanel() {
  return React.useContext(PanelContext);
}

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return !!el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName));
}

export function AssistantProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const pathname = usePathname() ?? "";
  const onHome = pathname === "/home";
  const value = React.useMemo(() => ({ open: open && !onHome, setOpen }), [open, onHome]);

  // "/" opens the assistant, except on Applications, where it has always meant "search".
  React.useEffect(() => {
    if (onHome) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target) || pathname.startsWith("/applications")) return;
      if (document.querySelector('[role="dialog"]')) return;
      e.preventDefault();
      setOpen(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onHome, pathname]);

  return (
    <PanelContext.Provider value={value}>
      {children}
      {!onHome && <AssistantLauncher />}
      {value.open && <AssistantPanel />}
    </PanelContext.Provider>
  );
}

function AssistantLauncher() {
  const { open, setOpen } = useAssistantPanel();
  const pathname = usePathname() ?? "";
  if (open) return null;
  return (
    <button
      type="button"
      id="assistant-launcher"
      onClick={() => setOpen(true)}
      className="fixed right-4 bottom-4 z-40 inline-flex h-12 items-center gap-2 rounded-lg bg-primary pr-4 pl-3.5 text-[15px] font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_18px_40px_-12px_rgba(251,65,40,0.75)] transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring md:right-6 md:bottom-6"
    >
      <MessageSquareText className="size-5" aria-hidden />
      Ask Dossier
      {!pathname.startsWith("/applications") && (
        <kbd className="ml-0.5 hidden rounded border border-white/30 px-1.5 text-[12px] font-semibold text-white/85 sm:inline">/</kbd>
      )}
    </button>
  );
}

// A side panel, not a modal: the board stays visible and usable, so the user sees each change land.
function AssistantPanel() {
  const { setOpen } = useAssistantPanel();
  const assistant = useAssistant();
  const composer = React.useRef<ComposerHandle>(null);
  const [clearing, setClearing] = React.useState(false);

  const close = React.useCallback(() => {
    setOpen(false);
    requestAnimationFrame(() => document.getElementById("assistant-launcher")?.focus());
  }, [setOpen]);

  React.useEffect(() => {
    composer.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.querySelector('[role="dialog"], [role="alertdialog"]')) close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  return (
    <aside
      aria-label="Dossier assistant"
      className={cn(
        "fixed inset-0 z-40 flex flex-col bg-[#0e0e0e] md:inset-y-0 md:right-0 md:left-auto md:w-[420px] md:border-l md:border-white/10",
        "md:shadow-[-30px_0_80px_-20px_rgba(0,0,0,0.9)] motion-safe:animate-in motion-safe:slide-in-from-right motion-safe:duration-200",
      )}
    >
      <header className="flex h-14 shrink-0 items-center gap-2.5 border-b border-white/[0.08] px-4">
        <Image src="/logo.png" alt="" width={24} height={24} className="size-6 rounded-md" />
        <h2 className="flex-1 text-[15px] font-semibold text-white">Ask Dossier</h2>
        {assistant.messages.length > 0 && (
          <Button variant="ghost" size="icon-sm" aria-label="Clear conversation" title="Clear conversation" onClick={() => setClearing(true)}>
            <Trash2 className="size-4" />
          </Button>
        )}
        <Button variant="ghost" size="icon-sm" aria-label="Close assistant" onClick={close}>
          <X className="size-4" />
        </Button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
        {assistant.messages.length === 0 && !assistant.busy && !assistant.loading ? (
          <div className="flex flex-col gap-2 pt-2">
            <p className="text-[15px] font-semibold text-white">What happened?</p>
            <p className="text-sm font-medium leading-relaxed text-white/60">
              &ldquo;Stripe moved me to round 2 on Thursday at 4&rdquo;, &ldquo;remind me an hour before interviews&rdquo;, or paste a recruiter email.
            </p>
          </div>
        ) : (
          <Thread assistant={assistant} />
        )}
      </div>
      <div className="shrink-0 border-t border-white/[0.06] p-3">
        <Composer ref={composer} id="assistant-panel-composer" busy={assistant.busy} onSend={(t, a) => void assistant.send(t, a)} placeholder="Tell me what happened…" />
      </div>
      <ConfirmDialog
        open={clearing}
        onOpenChange={setClearing}
        title="Clear the conversation?"
        description="Your applications, interviews and settings stay exactly as they are. Only this chat is deleted."
        confirmLabel="Clear"
        onConfirm={assistant.clear}
      />
    </aside>
  );
}

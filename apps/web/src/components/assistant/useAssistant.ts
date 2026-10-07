"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ChatMessageView, ChatPageName, ChatPart, ChatRequest } from "@dossier/core/applications";
import { ApiError, chatAction, clearChat, getChatHistory, sendChat } from "@/lib/api";
import { toast } from "@/components/ui/toast";

export const CHAT_KEY = ["chat"];

// ---- What the user is looking at, so "this one" means the open application ----

let openApplicationId: string | null = null;
const pageListeners = new Set<() => void>();

export function setOpenApplication(id: string | null): void {
  if (openApplicationId === id) return;
  openApplicationId = id;
  pageListeners.forEach((l) => l());
}

function subscribePage(listener: () => void) {
  pageListeners.add(listener);
  return () => pageListeners.delete(listener);
}

function pageName(pathname: string): ChatPageName {
  if (pathname === "/home") return "home";
  if (pathname.startsWith("/applications")) return "applications";
  if (pathname.startsWith("/kits") || pathname.startsWith("/runs")) return "kits";
  if (pathname.startsWith("/resumes")) return "resumes";
  if (pathname.startsWith("/assistants")) return "assistants";
  return "other";
}

// ---- A card on the board glows once when the assistant changes it ----

const pulseListeners = new Set<(ids: string[]) => void>();

export function usePulse(id: string): boolean {
  const [on, setOn] = React.useState(false);
  React.useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const listener = (ids: string[]) => {
      if (!ids.includes(id)) return;
      setOn(true);
      clearTimeout(timer);
      timer = setTimeout(() => setOn(false), 1600);
    };
    pulseListeners.add(listener);
    return () => {
      pulseListeners.delete(listener);
      clearTimeout(timer);
    };
  }, [id]);
  return on;
}

function pulse(parts: ChatPart[]) {
  const ids = parts.flatMap((p) => (p.kind === "done" && p.applicationId && p.state === "done" ? [p.applicationId] : []));
  if (ids.length) pulseListeners.forEach((l) => l(ids));
}

// ---- The conversation ----

export interface Failure {
  message: string;
  text: string;
  attachment?: string;
}

const LONG_PASTE = 300;
export { LONG_PASTE };

export function useAssistant() {
  const queryClient = useQueryClient();
  const pathname = usePathname() ?? "";
  const applicationId = React.useSyncExternalStore(subscribePage, () => openApplicationId, () => null);
  const history = useQuery({ queryKey: CHAT_KEY, queryFn: getChatHistory, staleTime: 60_000 });
  const [busy, setBusy] = React.useState(false);
  const [step, setStep] = React.useState<string | null>(null);
  const [failure, setFailure] = React.useState<Failure | null>(null);

  const setMessages = React.useCallback(
    (change: (list: ChatMessageView[]) => ChatMessageView[]) => queryClient.setQueryData<ChatMessageView[]>(CHAT_KEY, (list = []) => change(list)),
    [queryClient],
  );

  const refresh = React.useCallback(
    (changed: { applications: boolean; settings: boolean }, parts: ChatPart[] = []) => {
      if (changed.applications) void queryClient.invalidateQueries({ queryKey: ["applications"] });
      if (changed.settings) void queryClient.invalidateQueries({ queryKey: ["notification-settings"] });
      if (parts.some((p) => p.kind === "proposal")) void queryClient.invalidateQueries({ queryKey: ["email-updates"] });
      pulse(parts);
    },
    [queryClient],
  );

  const send = React.useCallback(
    async (text: string, attachment?: string) => {
      if (busy || (!text.trim() && !attachment)) return;
      const page = pageName(pathname);
      const body: ChatRequest = {
        text: text.trim(),
        attachments: attachment ? [{ kind: "paste", text: attachment }] : [],
        page: { name: page, applicationId: page === "applications" ? (applicationId ?? undefined) : undefined },
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      };
      const localId = `local-${Date.now()}`;
      setMessages((list) => [
        ...list,
        {
          id: localId,
          role: "user",
          text: body.text,
          parts: [],
          attachmentLabel: attachment ? `Pasted text · ${attachment.length.toLocaleString("en-US")} characters` : undefined,
          createdAt: new Date().toISOString(),
        },
      ]);
      setBusy(true);
      setFailure(null);
      setStep(null);
      let finished = false;
      try {
        await sendChat(body, (event) => {
          if (event.type === "step") setStep(event.text);
          if (event.type === "user") setMessages((list) => list.map((m) => (m.id === localId ? event.message : m)));
          if (event.type === "done") {
            finished = true;
            setMessages((list) => [...list, event.message]);
            refresh(event.changed, event.message.parts);
          }
          if (event.type === "error") {
            finished = true;
            setFailure({ message: event.message, text, attachment });
          }
        });
        // The connection dropped before the reply: the server still finished, so load what it saved.
        if (!finished) {
          await queryClient.invalidateQueries({ queryKey: CHAT_KEY });
          refresh({ applications: true, settings: true });
        }
      } catch (err) {
        if (err instanceof ApiError) {
          setMessages((list) => list.filter((m) => m.id !== localId));
          setFailure({
            message: err.code === "daily_limit" ? "You've reached today's 60 messages. The assistant is back tomorrow; everything still works by hand." : err.message,
            text,
            attachment,
          });
        } else {
          await queryClient.invalidateQueries({ queryKey: CHAT_KEY });
          refresh({ applications: true, settings: true });
        }
      } finally {
        setBusy(false);
        setStep(null);
      }
    },
    [busy, pathname, applicationId, setMessages, refresh, queryClient],
  );

  const act = React.useCallback(
    async (messageId: string, actionId: string, verb: "undo" | "confirm" | "cancel") => {
      try {
        const result = await chatAction(actionId, verb);
        setMessages((list) =>
          list.map((m) =>
            m.id !== messageId
              ? m
              : {
                  ...m,
                  parts: m.parts.map((p) => ("actionId" in p && p.actionId === actionId ? { ...p, state: result.state } : p)),
                },
          ),
        );
        refresh(result.changed);
      } catch (err) {
        toast.error(verb === "undo" ? "Couldn't undo that" : "Couldn't do that", {
          description: err instanceof ApiError ? err.message.charAt(0).toUpperCase() + err.message.slice(1) : "Try again in a moment.",
        });
      }
    },
    [setMessages, refresh],
  );

  const setProposalState = React.useCallback(
    (updateId: string, state: "applied" | "dismissed") =>
      setMessages((list) =>
        list.map((m) => ({ ...m, parts: m.parts.map((p) => (p.kind === "proposal" && p.update.id === updateId ? { ...p, state } : p)) })),
      ),
    [setMessages],
  );

  const clear = React.useCallback(async () => {
    try {
      await clearChat();
      queryClient.setQueryData(CHAT_KEY, []);
      setFailure(null);
    } catch {
      toast.error("Couldn't clear the conversation");
    }
  }, [queryClient]);

  return {
    messages: history.data ?? [],
    loading: history.isLoading,
    loadError: history.isError,
    reload: history.refetch,
    busy,
    step,
    failure,
    dismissFailure: () => setFailure(null),
    send,
    act,
    setProposalState,
    clear,
  };
}

export type Assistant = ReturnType<typeof useAssistant>;

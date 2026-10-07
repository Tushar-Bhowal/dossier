"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowUpRight,
  BellRing,
  CalendarPlus,
  Check,
  Clock,
  Download,
  Info,
  LoaderCircle,
  RotateCcw,
  Send,
  Trash2,
} from "lucide-react";
import type { ChatFallback, ChatPart, NotificationSettingsView } from "@dossier/core/applications";
import { ApiError, createTelegramLink, getNotificationSettings, listApplications, savePushSubscription } from "@/lib/api";
import { pushSupport, subscribeThisDevice } from "@/lib/push";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { downloadIcs, googleCalendarUrl } from "@/components/applications/calendar";
import { ProposalCard } from "@/components/applications/EmailUpdates";
import { MakeKitCard } from "./MakeKitCard";
import type { Assistant } from "./useAssistant";

const SETTINGS_KEY = ["notification-settings"];
const TELEGRAM_WAIT_MS = 2 * 60_000;
const card = "rounded-lg border border-white/[0.08] bg-[#131313] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]";

export function applicationHref(id: string, extra?: string): string {
  return `/applications?open=${encodeURIComponent(id)}${extra ? `&${extra}` : ""}`;
}

function fallbackHref(fallback: ChatFallback): string {
  if (fallback.form === "add_application") return "/applications?new=1";
  if (fallback.form === "reminders") return "/applications?reminders=1";
  return applicationHref(fallback.applicationId);
}

function IconBox({ children, tone = "primary" }: { children: React.ReactNode; tone?: "primary" | "green" | "muted" | "red" }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-lg",
        tone === "primary" && "bg-primary/15 text-[#ff7a5c]",
        tone === "green" && "bg-emerald-400/10 text-emerald-400",
        tone === "muted" && "bg-white/[0.06] text-white/55",
        tone === "red" && "bg-red-500/10 text-red-300",
      )}
    >
      {children}
    </span>
  );
}

function DoneCard({ part, onUndo }: { part: Extract<ChatPart, { kind: "done" }>; onUndo?: () => Promise<void> }) {
  const [busy, setBusy] = React.useState(false);
  const undone = part.state === "undone";
  const text = (
    <span className={cn("text-[15px] font-semibold", undone ? "text-white/45 line-through" : "text-white")}>{part.text}</span>
  );
  return (
    <div className="flex items-center gap-3 rounded-lg border border-white/[0.08] bg-[#131313] px-3 py-2.5">
      <IconBox tone={undone ? "muted" : "green"}>{undone ? <RotateCcw className="size-4" /> : <Check className="size-4" />}</IconBox>
      <p className="min-w-0 flex-1">
        {part.applicationId && !undone ? (
          <Link href={applicationHref(part.applicationId)} className="hover:underline">
            {text}
          </Link>
        ) : (
          text
        )}
        {undone && <span className="block text-sm font-medium text-white/50">Undone</span>}
      </p>
      {part.actionId && !undone && onUndo && (
        <Button
          size="sm"
          variant="ghost"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await onUndo();
            setBusy(false);
          }}
        >
          {busy ? <LoaderCircle className="size-3.5 animate-spin" aria-hidden /> : <RotateCcw className="size-3.5" aria-hidden />}
          Undo
        </Button>
      )}
    </div>
  );
}

function ConfirmDeleteCard({
  part,
  onConfirm,
  onCancel,
}: {
  part: Extract<ChatPart, { kind: "confirm_delete" }>;
  onConfirm: () => Promise<void>;
  onCancel: () => Promise<void>;
}) {
  const [busy, setBusy] = React.useState(false);
  const run = (fn: () => Promise<void>) => async () => {
    setBusy(true);
    await fn();
    setBusy(false);
  };
  if (part.state !== "awaiting_confirm") {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-white/[0.08] bg-[#131313] px-3 py-2.5">
        <IconBox tone="muted">{part.state === "done" ? <Trash2 className="size-4" /> : <Check className="size-4" />}</IconBox>
        <p className="text-[15px] font-semibold text-white/70">{part.state === "done" ? `Deleted ${part.label}` : `Kept ${part.label}`}</p>
      </div>
    );
  }
  return (
    <div className={cn(card, "flex flex-col gap-3 border-red-400/20 sm:flex-row sm:items-center")}>
      <IconBox tone="red">
        <Trash2 className="size-4" />
      </IconBox>
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-semibold text-white">Delete {part.label}?</p>
        <p className="text-sm font-medium text-white/55">Its notes, interviews and history go too. This can&apos;t be undone.</p>
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" disabled={busy} onClick={run(onCancel)}>
          Keep it
        </Button>
        <Button size="sm" variant="destructive" disabled={busy} onClick={run(onConfirm)}>
          Delete
        </Button>
      </div>
    </div>
  );
}

function useSettings(pollUntil = 0) {
  return useQuery({
    queryKey: SETTINGS_KEY,
    queryFn: getNotificationSettings,
    // After "Connect Telegram", check every few seconds until the bot reports the link.
    refetchInterval: (query) => (!query.state.data?.telegram.linked && Date.now() < pollUntil ? 3000 : false),
  });
}

function ConnectTelegramCard() {
  const [waitUntil, setWaitUntil] = React.useState(0);
  const [busy, setBusy] = React.useState(false);
  const { data: view } = useSettings(waitUntil);
  const linked = view?.telegram.linked;

  async function connect() {
    setBusy(true);
    // Opened before the request finishes so the browser doesn't treat it as an unwanted pop-up.
    const tab = window.open("", "_blank");
    try {
      const { url } = await createTelegramLink();
      if (tab) tab.location.href = url;
      else window.location.href = url;
      setWaitUntil(Date.now() + TELEGRAM_WAIT_MS);
    } catch (err) {
      tab?.close();
      toast.error("Couldn't start the Telegram link", { description: err instanceof ApiError ? err.message : "Try again in a moment." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={cn(card, "flex flex-col gap-3 sm:flex-row sm:items-center")}>
      <IconBox tone={linked ? "green" : "primary"}>{linked ? <Check className="size-4" /> : <Send className="size-4" />}</IconBox>
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-semibold text-white">{linked ? "Telegram is connected" : "Get reminders on Telegram"}</p>
        <p className="text-sm font-medium text-white/55">
          {linked
            ? "Interview reminders and your morning summary will arrive there."
            : waitUntil
              ? "Press Start in Telegram, then come back here."
              : "Free. Opens Telegram; press Start and you're done."}
        </p>
      </div>
      {!linked && (
        <Button size="sm" onClick={connect} disabled={busy}>
          {busy && <LoaderCircle className="size-3.5 animate-spin" aria-hidden />}
          Connect Telegram
        </Button>
      )}
    </div>
  );
}

function EnablePushCard() {
  const queryClient = useQueryClient();
  const { data: view } = useSettings();
  const [busy, setBusy] = React.useState(false);
  const [on, setOn] = React.useState(false);
  const support = pushSupport();

  async function turnOn() {
    if (!view?.vapidPublicKey) return;
    setBusy(true);
    try {
      const next: NotificationSettingsView = await savePushSubscription(await subscribeThisDevice(view.vapidPublicKey));
      queryClient.setQueryData(SETTINGS_KEY, next);
      setOn(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      toast.error("Couldn't turn on notifications", {
        description:
          message === "blocked"
            ? "Notifications are blocked for this site. Allow them in your browser's site settings, then try again."
            : message === "dismissed"
              ? "The permission prompt was closed. Press Turn on again and choose Allow."
              : "Try again in a moment.",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={cn(card, "flex flex-col gap-3 sm:flex-row sm:items-center")}>
      <IconBox tone={on ? "green" : "primary"}>{on ? <Check className="size-4" /> : <BellRing className="size-4" />}</IconBox>
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-semibold text-white">{on ? "Notifications are on for this device" : "Notifications on this device"}</p>
        <p className="text-sm font-medium text-white/55">
          {on
            ? "Reminders will show here, even with Dossier closed."
            : support === "needs-home-screen"
              ? "On iPhone: tap Share → Add to Home Screen, open Dossier from there, then ask me again."
              : support === "unsupported"
                ? "This browser can't show notifications. Telegram works everywhere."
                : "Your browser will ask for permission. Choose Allow."}
        </p>
      </div>
      {!on && support === "supported" && (
        <Button size="sm" onClick={turnOn} disabled={busy || !view?.vapidPublicKey}>
          {busy && <LoaderCircle className="size-3.5 animate-spin" aria-hidden />}
          Turn on
        </Button>
      )}
    </div>
  );
}

function CalendarCard({ part }: { part: Extract<ChatPart, { kind: "calendar" }> }) {
  const { data: records } = useQuery({ queryKey: ["applications"], queryFn: listApplications });
  const app = records?.find((r) => r.id === part.applicationId)?.application;
  const interview = app?.interviews?.find((i) => i.id === part.interviewId);
  return (
    <div className={cn(card, "flex flex-col gap-3")}>
      <div className="flex items-center gap-3">
        <IconBox>
          <CalendarPlus className="size-4" />
        </IconBox>
        <p className="min-w-0 flex-1 text-[15px] font-semibold text-white">{part.label}</p>
      </div>
      {app && interview ? (
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm">
            <a href={googleCalendarUrl(app, interview)} target="_blank" rel="noopener noreferrer">
              <CalendarPlus className="size-3.5" aria-hidden /> Google Calendar
            </a>
          </Button>
          <Button size="sm" variant="outline" onClick={() => downloadIcs(app, interview)}>
            <Download className="size-3.5" aria-hidden /> Apple / Outlook
          </Button>
        </div>
      ) : (
        <p className="text-sm font-medium text-white/55">This interview has changed since. Open the application to add it.</p>
      )}
    </div>
  );
}

function LinkCard({ icon, title, note, href, action }: { icon: React.ReactNode; title: string; note: string; href: string; action: string }) {
  return (
    <div className={cn(card, "flex flex-col gap-3 sm:flex-row sm:items-center")}>
      <IconBox>{icon}</IconBox>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-semibold text-white">{title}</p>
        <p className="text-sm font-medium text-white/55">{note}</p>
      </div>
      <Button asChild size="sm" variant="outline">
        <Link href={href}>
          {action} <ArrowUpRight className="size-3.5" aria-hidden />
        </Link>
      </Button>
    </div>
  );
}

function ListCard({ part }: { part: Extract<ChatPart, { kind: "list" }> }) {
  return (
    <div className={card}>
      <p className="text-[15px] font-semibold text-white">{part.title}</p>
      {part.items.length === 0 ? (
        <p className="mt-1 text-sm font-medium text-white/55">{part.empty}</p>
      ) : (
        <ul className="mt-2 flex flex-col divide-y divide-white/[0.06]">
          {part.items.map((item, i) => {
            const body = (
              <>
                <span className="block truncate text-[15px] font-semibold text-white">{item.title}</span>
                {item.detail && <span className="block truncate text-sm font-medium text-white/55">{item.detail}</span>}
              </>
            );
            return (
              <li key={`${item.applicationId ?? "x"}-${i}`} className="py-2">
                {item.applicationId ? (
                  <Link href={applicationHref(item.applicationId)} className="block rounded-md hover:bg-white/[0.03] focus-visible:outline-2 focus-visible:outline-ring">
                    {body}
                  </Link>
                ) : (
                  body
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function NoteCard({ text, href, tone }: { text: string; href?: string; tone: "soon" | "note" | "error" }) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-lg border px-3 py-2.5",
        tone === "error" ? "border-red-400/20 bg-red-500/[0.05]" : "border-white/[0.08] bg-[#131313]",
      )}
    >
      <IconBox tone={tone === "error" ? "red" : "muted"}>
        {tone === "error" ? <AlertCircle className="size-4" /> : tone === "soon" ? <Clock className="size-4" /> : <Info className="size-4" />}
      </IconBox>
      <p className={cn("min-w-0 flex-1 pt-1.5 text-[15px] font-medium", tone === "error" ? "text-red-100" : "text-white/75")}>{text}</p>
      {href && (
        <Button asChild size="sm" variant="ghost" className="mt-0.5">
          <Link href={href}>{tone === "error" ? "Do it by hand" : "Open"}</Link>
        </Button>
      )}
    </div>
  );
}

export function PartView({ part, messageId, assistant }: { part: ChatPart; messageId: string; assistant: Assistant }) {
  switch (part.kind) {
    case "done":
      return <DoneCard part={part} onUndo={part.actionId ? () => assistant.act(messageId, part.actionId!, "undo") : undefined} />;
    case "confirm_delete":
      return (
        <ConfirmDeleteCard
          part={part}
          onConfirm={() => assistant.act(messageId, part.actionId, "confirm")}
          onCancel={() => assistant.act(messageId, part.actionId, "cancel")}
        />
      );
    case "proposal":
      if (part.state && part.state !== "pending") {
        return (
          <div className="flex items-center gap-3 rounded-lg border border-white/[0.08] bg-[#131313] px-3 py-2.5">
            <IconBox tone={part.state === "applied" ? "green" : "muted"}>
              <Check className="size-4" />
            </IconBox>
            <p className="text-[15px] font-semibold text-white/70">
              {part.state === "applied" ? "Applied" : "Dismissed"}: {part.update.proposal.summary}
            </p>
          </div>
        );
      }
      return (
        <ul>
          <ProposalCard update={part.update} onDone={(outcome) => assistant.setProposalState(part.update.id, outcome)} />
        </ul>
      );
    case "connect_telegram":
      return <ConnectTelegramCard />;
    case "enable_push":
      return <EnablePushCard />;
    case "calendar":
      return <CalendarCard part={part} />;
    case "make_kit":
      return <MakeKitCard part={part} />;
    case "open_application":
      return <LinkCard icon={<ArrowUpRight className="size-4" />} title={part.label} note="Notes, interviews and history." href={applicationHref(part.applicationId)} action="Open" />;
    case "choices":
      return (
        <div className="flex flex-wrap gap-2" role="group" aria-label={part.text}>
          {part.options.map((option) => (
            <Button key={option} size="sm" variant="outline" disabled={assistant.busy} onClick={() => void assistant.send(option)}>
              {option}
            </Button>
          ))}
        </div>
      );
    case "list":
      return <ListCard part={part} />;
    case "coming_soon":
      return <NoteCard tone="soon" text={part.text} href={part.path} />;
    case "note":
      return <NoteCard tone="note" text={part.text} />;
    case "error":
      return <NoteCard tone="error" text={part.text} href={part.fallback ? fallbackHref(part.fallback) : undefined} />;
  }
}

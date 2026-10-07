"use client";

import * as React from "react";
import { DropdownMenu } from "radix-ui";
import { BellRing, CalendarClock, Check, MoreHorizontal } from "lucide-react";
import { followUpDue, isClosed, nextInterview, type ApplicationRecord, type ApplicationStatus } from "@dossier/core/applications";
import { interviewWhen } from "./calendar";
import { cn } from "@/lib/utils";
import { STATUS_LABEL, STATUS_TONE, relativeDays } from "./statusStyle";

export function Monogram({ name, className }: { name: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-[15px] font-bold text-[#ff7a5c] ring-1 ring-primary/25",
        className,
      )}
    >
      {name.trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
}

export function StatusPill({ status, round, className }: { status: ApplicationStatus; round?: number; className?: string }) {
  const tone = STATUS_TONE[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-lg px-2 py-0.5 text-[13px] font-semibold", tone.tint, tone.text, className)}>
      <span className={cn("size-1.5 rounded-full", tone.dot)} aria-hidden />
      {STATUS_LABEL[status]}
      {status === "interviewing" && round ? ` · R${round}` : ""}
    </span>
  );
}

const MOVE_TARGETS: ApplicationStatus[] = ["saved", "applied", "online_test", "interviewing", "offer", "rejected", "withdrawn", "no_reply"];

export function MoveMenu({
  status,
  onMove,
  trigger,
}: {
  status: ApplicationStatus;
  onMove: (status: ApplicationStatus) => void;
  trigger: React.ReactNode;
}) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>{trigger}</DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          onClick={(e) => e.stopPropagation()}
          className="z-50 w-52 rounded-lg border border-white/10 bg-[#141414] p-1.5 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.9)] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
        >
          <DropdownMenu.Label className="px-2.5 pb-1.5 pt-1 text-[13px] font-semibold text-white/50">Move to</DropdownMenu.Label>
          {MOVE_TARGETS.map((target) => (
            <DropdownMenu.Item
              key={target}
              disabled={target === status}
              onSelect={() => onMove(target)}
              className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium text-white/85 outline-none data-[disabled]:cursor-default data-[highlighted]:bg-white/[0.06] data-[disabled]:text-white/40"
            >
              <span className={cn("size-2 rounded-full", STATUS_TONE[target].dot)} aria-hidden />
              <span className="flex-1">{STATUS_LABEL[target]}</span>
              {target === status && <Check className="size-4 text-white/50" aria-hidden />}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

export function ApplicationCard({
  record,
  today,
  onOpen,
  onMove,
  dragging,
  overlay,
}: {
  record: ApplicationRecord;
  today: string;
  onOpen: () => void;
  onMove: (status: ApplicationStatus) => void;
  dragging?: boolean;
  overlay?: boolean;
}) {
  const app = record.application;
  const due = followUpDue(app, new Date(`${today}T12:00:00`));
  const now = new Date();
  const upcoming = isClosed(app.status) ? undefined : nextInterview(app, now);
  const since = app.appliedOn ? `Applied ${relativeDays(app.appliedOn, today)}` : `Saved ${relativeDays(record.createdAt.slice(0, 10), today)}`;

  return (
    <div
      className={cn(
        "group relative rounded-lg border border-white/[0.08] bg-[#151515] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] transition-[border-color,box-shadow,opacity] duration-150",
        "hover:border-primary/35 hover:shadow-[0_16px_40px_-22px_rgba(251,65,40,0.45),inset_0_1px_0_rgba(255,255,255,0.06)]",
        dragging && "opacity-35",
        overlay && "rotate-[1.5deg] cursor-grabbing border-primary/50 shadow-[0_28px_60px_-18px_rgba(0,0,0,0.95)]",
      )}
    >
      <button
        type="button"
        onClick={onOpen}
        className="absolute inset-0 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        aria-label={`Open ${app.role} at ${app.company}`}
      />
      <div className="pointer-events-none relative flex items-center gap-2">
        <Monogram name={app.company} className="size-6 text-[12px]" />
        <p className="min-w-0 flex-1 truncate text-sm font-semibold text-white/65">
          {app.company}
          {app.location ? <span className="font-medium text-white/45"> · {app.location}</span> : null}
        </p>
        <MoveMenu
          status={app.status}
          onMove={onMove}
          trigger={
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              aria-label={`Move ${app.role} at ${app.company}`}
              className="pointer-events-auto -my-1 -mr-1.5 flex size-8 shrink-0 items-center justify-center rounded-lg text-white/45 transition-colors hover:bg-white/[0.06] hover:text-white focus-visible:outline-2 focus-visible:outline-ring"
            >
              <MoreHorizontal className="size-4" />
            </button>
          }
        />
      </div>
      <p className="pointer-events-none relative mt-2 line-clamp-3 text-[15px] font-semibold leading-snug text-white">{app.role}</p>
      {upcoming && (
        <p className="pointer-events-none relative mt-2.5 flex items-center gap-1.5 text-[13px] font-semibold text-amber-300">
          <CalendarClock className="size-3.5 shrink-0" aria-hidden />
          {interviewWhen(upcoming.startsAt, now)}
          {upcoming.round ? ` · R${upcoming.round}` : ""}
        </p>
      )}
      <div className="pointer-events-none relative mt-3 flex flex-wrap items-center gap-2">
        {app.status === "interviewing" && app.round ? (
          <span className="rounded-lg bg-amber-400/10 px-2 py-0.5 text-[13px] font-semibold text-amber-300">Round {app.round}</span>
        ) : null}
        {app.status !== "interviewing" && app.status !== "saved" && app.status !== "applied" ? (
          <StatusPill status={app.status} />
        ) : null}
        {due && (
          <span className="inline-flex items-center gap-1 rounded-lg bg-primary/15 px-2 py-0.5 text-[13px] font-semibold text-[#ff7a5c]">
            <BellRing className="size-3.5" aria-hidden /> Follow up
          </span>
        )}
        <span className="ml-auto text-[13px] font-medium text-white/45">{since}</span>
      </div>
    </div>
  );
}

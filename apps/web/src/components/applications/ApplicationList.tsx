"use client";

import { ChevronDown } from "lucide-react";
import { isClosed, nextInterview, type ApplicationRecord, type ApplicationStatus } from "@dossier/core/applications";
import { interviewWhen } from "./calendar";
import { Monogram, MoveMenu, StatusPill } from "./ApplicationCard";
import { BOARD_COLUMNS, STATUS_LABEL, columnOf, relativeDays } from "./statusStyle";

export function ApplicationList({
  records,
  today,
  onOpen,
  onMove,
}: {
  records: ApplicationRecord[];
  today: string;
  onOpen: (id: string) => void;
  onMove: (id: string, status: ApplicationStatus) => void;
}) {
  const groups = BOARD_COLUMNS.map((column) => ({
    ...column,
    items: records.filter((r) => columnOf(r.application.status) === column.id),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="flex flex-col gap-6">
      {groups.map((group) => (
        <section key={group.id} aria-label={`${group.label}, ${group.items.length}`}>
          <h2 className="sticky top-[calc(var(--app-header-height,4rem)+0.5rem)] z-10 mb-2 inline-flex items-center gap-2 rounded-lg bg-background/90 px-1 py-1 text-[15px] font-semibold text-white backdrop-blur">
            {group.label}
            <span className="rounded-lg bg-white/[0.06] px-1.5 text-[13px] tabular-nums text-white/60">{group.items.length}</span>
          </h2>
          <ul className="flex flex-col divide-y divide-white/[0.06] overflow-hidden rounded-lg border border-white/[0.08] bg-[#121212]">
            {group.items.map((record) => {
              const app = record.application;
              const upcoming = isClosed(app.status) ? undefined : nextInterview(app, new Date());
              return (
                <li key={record.id} className="flex items-center gap-3 px-3 py-3 sm:px-4">
                  <button
                    type="button"
                    onClick={() => onOpen(record.id)}
                    className="flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-lg text-left focus-visible:outline-2 focus-visible:outline-ring"
                  >
                    <Monogram name={app.company} />
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-2 text-[15px] font-semibold leading-snug text-white">{app.role}</span>
                      <span className="block truncate text-sm font-medium text-white/55">
                        {app.company}
                        {app.status === "interviewing" && app.round ? ` · round ${app.round}` : ""}
                        {app.appliedOn ? ` · applied ${relativeDays(app.appliedOn, today)}` : ""}
                      </span>
                      {upcoming && (
                        <span className="block truncate text-[13px] font-semibold text-amber-300">
                          Interview {interviewWhen(upcoming.startsAt, new Date())}
                        </span>
                      )}
                    </span>
                  </button>
                  <MoveMenu
                    status={app.status}
                    onMove={(status) => onMove(record.id, status)}
                    trigger={
                      <button
                        type="button"
                        aria-label={`Status: ${STATUS_LABEL[app.status]}. Change status of ${app.role} at ${app.company}`}
                        className="flex min-h-11 shrink-0 items-center gap-1 rounded-lg px-1 focus-visible:outline-2 focus-visible:outline-ring"
                      >
                        <StatusPill status={app.status} round={app.round} className="hidden sm:inline-flex" />
                        <span className="flex size-9 items-center justify-center rounded-lg border border-white/10 sm:size-auto sm:border-0">
                          <ChevronDown className="size-4 text-white/55" aria-hidden />
                        </span>
                      </button>
                    }
                  />
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

"use client";

import * as React from "react";
import { ArrowUpRight, CalendarClock, CalendarPlus, Download, Pencil, Plus, Trash2 } from "lucide-react";
import {
  interviewEnds,
  toLocalDate,
  type ApplicationInput,
  type ApplicationRecord,
  type Interview,
} from "@dossier/core/applications";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { downloadIcs, googleCalendarUrl, interviewWhen } from "./calendar";
import type { ApplicationsApi } from "./useApplications";

const sectionTitle = "text-[13px] font-semibold uppercase tracking-[0.08em] text-white/45";
const fieldLabel = "text-sm font-semibold text-white/75";
const DURATIONS = [30, 45, 60, 90, 120];
const MOVES_TO_INTERVIEWING = ["saved", "applied", "online_test"];

interface Draft {
  id: string | null;
  date: string;
  time: string;
  round: string;
  durationMin: number;
  meetingUrl: string;
  notes: string;
}

function hhmm(date: Date): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function draftFrom(interview: Interview): Draft {
  const start = new Date(interview.startsAt);
  return {
    id: interview.id,
    date: toLocalDate(start),
    time: hhmm(start),
    round: interview.round ? String(interview.round) : "",
    durationMin: interview.durationMin ?? 60,
    meetingUrl: interview.meetingUrl ?? "",
    notes: interview.notes ?? "",
  };
}

function cleanLink(value: string): string | undefined | null {
  const text = value.trim();
  if (!text) return undefined;
  try {
    const url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
    return url.hostname.includes(".") ? url.href : null;
  } catch {
    return null;
  }
}

function InterviewForm({
  draft,
  onCancel,
  onSave,
}: {
  draft: Draft;
  onCancel: () => void;
  onSave: (interview: Interview) => void;
}) {
  const [form, setForm] = React.useState(draft);
  const [error, setError] = React.useState<string | null>(null);
  const set = (patch: Partial<Draft>) => setForm((f) => ({ ...f, ...patch }));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const start = new Date(`${form.date}T${form.time}`);
    const meetingUrl = cleanLink(form.meetingUrl);
    const round = form.round ? Number(form.round) : undefined;
    if (!form.date || !form.time || Number.isNaN(start.getTime())) return setError("Pick a date and a time.");
    if (meetingUrl === null) return setError("The meeting link isn't a valid web address.");
    if (round !== undefined && (!Number.isInteger(round) || round < 1 || round > 20)) return setError("Round must be 1 to 20.");
    onSave({
      id: form.id ?? crypto.randomUUID(),
      startsAt: start.toISOString(),
      durationMin: form.durationMin,
      round,
      meetingUrl,
      notes: form.notes.trim() || undefined,
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 rounded-lg border border-white/[0.1] bg-white/[0.02] p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="iv-date" className={fieldLabel}>
            Date
          </label>
          <Input id="iv-date" type="date" required value={form.date} onChange={(e) => set({ date: e.target.value })} className="[color-scheme:dark]" />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="iv-time" className={fieldLabel}>
            Time
          </label>
          <Input id="iv-time" type="time" required value={form.time} onChange={(e) => set({ time: e.target.value })} className="[color-scheme:dark]" />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="iv-round" className={fieldLabel}>
            Round
          </label>
          <Input id="iv-round" type="number" min={1} max={20} value={form.round} onChange={(e) => set({ round: e.target.value })} placeholder="Optional" />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="iv-duration" className={fieldLabel}>
            Length
          </label>
          <select
            id="iv-duration"
            value={form.durationMin}
            onChange={(e) => set({ durationMin: Number(e.target.value) })}
            className="h-9 rounded-lg border border-input bg-transparent px-3 text-sm font-medium text-white [color-scheme:dark] focus-visible:outline-2 focus-visible:outline-ring"
          >
            {DURATIONS.map((m) => (
              <option key={m} value={m}>
                {m < 60 ? `${m} minutes` : m === 60 ? "1 hour" : `${m / 60} hours`}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <label htmlFor="iv-link" className={fieldLabel}>
            Meeting link
          </label>
          <Input id="iv-link" inputMode="url" value={form.meetingUrl} onChange={(e) => set({ meetingUrl: e.target.value })} placeholder="https://meet.google.com/…" />
        </div>
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <label htmlFor="iv-notes" className={fieldLabel}>
            Notes
          </label>
          <Textarea id="iv-notes" rows={2} maxLength={1000} value={form.notes} onChange={(e) => set({ notes: e.target.value })} placeholder="Who's interviewing you, what to prepare…" />
        </div>
      </div>
      {error && (
        <p role="alert" className="text-sm font-medium text-red-300">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">{draft.id ? "Save interview" : "Add interview"}</Button>
      </div>
    </form>
  );
}

export function InterviewsSection({ record, update }: { record: ApplicationRecord; update: ApplicationsApi["update"] }) {
  const app = record.application;
  const [draft, setDraft] = React.useState<Draft | null>(null);
  const now = new Date();
  const interviews = [...(app.interviews ?? [])].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const upcoming = interviews.filter((i) => interviewEnds(i) > now.getTime());
  const past = interviews.filter((i) => interviewEnds(i) <= now.getTime()).reverse();

  function newDraft(): Draft {
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const lastRound = Math.max(0, ...interviews.map((i) => i.round ?? 0));
    const round = lastRound ? lastRound + 1 : app.status === "interviewing" ? (app.round ?? 1) : 1;
    return { id: null, date: toLocalDate(tomorrow), time: "11:00", round: String(round), durationMin: 60, meetingUrl: "", notes: "" };
  }

  function save(interview: Interview) {
    const isNew = !interviews.some((i) => i.id === interview.id);
    const moves = isNew && MOVES_TO_INTERVIEWING.includes(app.status);
    update(
      record.id,
      (input: ApplicationInput) => {
        const list = (input.interviews ?? []).filter((i) => i.id !== interview.id);
        const next = { ...input, interviews: [...list, interview] };
        // Adding an interview means the process has reached interviews.
        if (moves) return { ...next, status: "interviewing" as const, round: interview.round ?? 1 };
        return next;
      },
      moves ? "Interview added · moved to Interviewing" : undefined,
    );
    setDraft(null);
  }

  function remove(id: string) {
    update(record.id, (input) => ({ ...input, interviews: (input.interviews ?? []).filter((i) => i.id !== id) }), "Interview removed");
  }

  const row = (interview: Interview, isPast: boolean) => (
    <li key={interview.id} className={cn("rounded-lg border border-white/[0.08] bg-white/[0.02] p-4", isPast && "opacity-60")}>
      <div className="flex items-start gap-3">
        <CalendarClock className="mt-0.5 size-5 shrink-0 text-amber-300" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold text-white">
            {interviewWhen(interview.startsAt, now)}
            {interview.round ? <span className="font-medium text-white/60"> · Round {interview.round}</span> : null}
          </p>
          {interview.meetingUrl && (
            <a
              href={interview.meetingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-0.5 inline-flex items-center gap-1 text-sm font-semibold text-[#ff7a5c] hover:underline"
            >
              Join meeting <ArrowUpRight className="size-3.5" aria-hidden />
            </a>
          )}
          {interview.notes && <p className="mt-1 whitespace-pre-wrap text-sm font-medium text-white/60">{interview.notes}</p>}
        </div>
        <div className="flex shrink-0 gap-1">
          <Button variant="ghost" size="icon" aria-label="Edit interview" onClick={() => setDraft(draftFrom(interview))}>
            <Pencil className="size-4" />
          </Button>
          <Button variant="ghost" size="icon" aria-label="Remove interview" onClick={() => remove(interview.id)}>
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>
      {!isPast && (
        <div className="mt-3 flex flex-wrap gap-2 pl-8">
          <Button asChild variant="outline" size="sm">
            <a href={googleCalendarUrl(app, interview)} target="_blank" rel="noopener noreferrer">
              <CalendarPlus className="size-3.5" aria-hidden /> Add to Google Calendar
            </a>
          </Button>
          <Button variant="outline" size="sm" onClick={() => downloadIcs(app, interview)}>
            <Download className="size-3.5" aria-hidden /> Apple / Outlook (.ics)
          </Button>
        </div>
      )}
    </li>
  );

  return (
    <section className="mt-7 flex flex-col gap-3" aria-labelledby="interviews-heading">
      <div className="flex items-center justify-between">
        <h3 id="interviews-heading" className={sectionTitle}>
          Interviews
        </h3>
        {!draft && (
          <Button variant="outline" size="sm" onClick={() => setDraft(newDraft())}>
            <Plus className="size-3.5" aria-hidden /> Add interview
          </Button>
        )}
      </div>
      {draft && <InterviewForm key={draft.id ?? "new"} draft={draft} onCancel={() => setDraft(null)} onSave={save} />}
      {upcoming.length === 0 && past.length === 0 && !draft && (
        <p className="text-[15px] font-medium text-white/50">No interviews yet. Add one to get reminders before it starts.</p>
      )}
      {upcoming.length > 0 && <ul className="flex flex-col gap-2">{upcoming.map((i) => row(i, false))}</ul>}
      {past.length > 0 && (
        <details>
          <summary className="cursor-pointer text-sm font-semibold text-white/55">Past interviews ({past.length})</summary>
          <ul className="mt-2 flex flex-col gap-2">{past.map((i) => row(i, true))}</ul>
        </details>
      )}
    </section>
  );
}

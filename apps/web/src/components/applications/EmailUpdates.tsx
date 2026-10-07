"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Inbox, LoaderCircle, MailOpen } from "lucide-react";
import type { ApplicationRecord, EmailUpdateRecord, UpdateProposal } from "@dossier/core/applications";
import { ApiError, applyEmailUpdate, dismissEmailUpdate, listEmailUpdates, parseEmail } from "@/lib/api";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { interviewWhen } from "./calendar";
import { STATUS_LABEL } from "./statusStyle";

const KEY = ["email-updates"];

function changes(p: UpdateProposal): string[] {
  const list: string[] = [];
  if (p.status) list.push(`Stage → ${STATUS_LABEL[p.status]}${p.status === "interviewing" && p.round ? ` (round ${p.round})` : ""}`);
  if (p.interview) list.push(`Interview ${interviewWhen(p.interview.startsAt, new Date())}${p.interview.meetingUrl ? " · meeting link" : ""}`);
  return list;
}

function useEmailUpdateActions() {
  const queryClient = useQueryClient();
  const drop = (id: string) => queryClient.setQueryData<EmailUpdateRecord[]>(KEY, (list = []) => list.filter((u) => u.id !== id));

  async function apply(update: EmailUpdateRecord) {
    try {
      const record = await applyEmailUpdate(update.id);
      drop(update.id);
      queryClient.setQueryData<ApplicationRecord[]>(["applications"], (list = []) =>
        list.some((r) => r.id === record.id) ? list.map((r) => (r.id === record.id ? record : r)) : [record, ...list],
      );
      toast.success(update.proposal.applicationId ? `Updated ${record.application.company}` : `Added ${record.application.company}`);
    } catch (err) {
      toast.error("Couldn't apply that update", { description: err instanceof ApiError ? err.message : "Try again in a moment." });
      void queryClient.invalidateQueries({ queryKey: KEY });
    }
  }

  async function dismiss(update: EmailUpdateRecord) {
    drop(update.id);
    await dismissEmailUpdate(update.id).catch(() => queryClient.invalidateQueries({ queryKey: KEY }));
  }

  return { apply, dismiss };
}

function ProposalCard({ update, onDone }: { update: EmailUpdateRecord; onDone?: () => void }) {
  const { apply, dismiss } = useEmailUpdateActions();
  const [busy, setBusy] = React.useState(false);
  const p = update.proposal;
  const lines = changes(p);
  return (
    <li className="flex flex-col gap-3 rounded-lg border border-white/[0.08] bg-[#141414] p-4 sm:flex-row sm:items-center">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-sky-400/10 text-sky-300" aria-hidden>
        {p.interview ? <CalendarClock className="size-4" /> : <MailOpen className="size-4" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-semibold text-white">
          {p.company}
          {p.role ? <span className="font-medium text-white/55"> · {p.role}</span> : null}
          {!p.applicationId && <span className="ml-2 rounded-lg bg-white/[0.06] px-1.5 py-0.5 text-[13px] font-semibold text-white/70">New</span>}
        </p>
        <p className="text-sm font-medium text-white/60">
          {p.summary}
          {p.from && <span className="text-white/45"> · suggested by {p.from}</span>}
        </p>
        {lines.length > 0 && <p className="mt-1 text-sm font-semibold text-sky-300">{lines.join(" · ")}</p>}
      </div>
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => {
            void dismiss(update);
            onDone?.();
          }}
        >
          Dismiss
        </Button>
        <Button
          size="sm"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await apply(update);
            setBusy(false);
            onDone?.();
          }}
        >
          {busy && <LoaderCircle className="size-3.5 animate-spin" aria-hidden />}
          {p.applicationId ? "Apply" : "Add to tracker"}
        </Button>
      </div>
    </li>
  );
}

// Proposals waiting for a tap. Nothing in the tracker changes until the user applies one.
export function UpdatesToReview() {
  const { data: updates = [] } = useQuery({ queryKey: KEY, queryFn: listEmailUpdates });
  if (!updates.length) return null;
  return (
    <section aria-labelledby="updates-heading" className="flex flex-col gap-3">
      <h2 id="updates-heading" className="flex items-center gap-2 text-[15px] font-semibold text-white">
        Updates to review
        <span className="rounded-lg bg-sky-400/10 px-1.5 text-[13px] font-semibold tabular-nums text-sky-300">{updates.length}</span>
      </h2>
      <ul className="flex flex-col gap-2">
        {updates.map((u) => (
          <ProposalCard key={u.id} update={u} />
        ))}
      </ul>
    </section>
  );
}

export function PasteEmailDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const queryClient = useQueryClient();
  const [text, setText] = React.useState("");
  const [reading, setReading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<EmailUpdateRecord | null>(null);

  function close(next: boolean) {
    onOpenChange(next);
    if (!next) {
      setText("");
      setError(null);
      setResult(null);
    }
  }

  async function read(e: React.FormEvent) {
    e.preventDefault();
    setReading(true);
    setError(null);
    try {
      const update = await parseEmail(text, Intl.DateTimeFormat().resolvedOptions().timeZone);
      queryClient.setQueryData<EmailUpdateRecord[]>(KEY, (list = []) => [update, ...list]);
      setResult(update);
    } catch (err) {
      setError(
        err instanceof ApiError && err.code === "not_job_email"
          ? "This doesn't look like an email about a job application."
          : err instanceof ApiError && err.code === "daily_limit"
            ? "You've read 20 emails today. Try again tomorrow."
            : "Couldn't read that email. Try again in a minute.",
      );
    } finally {
      setReading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold tracking-[-0.02em] text-white">Paste a recruiter email</DialogTitle>
          <DialogDescription className="text-[15px] text-white/60">
            Dossier reads it and suggests the update. Nothing changes until you apply it. Email addresses, phone numbers and links are
            hidden before the email is read, and the email itself isn&apos;t saved.
          </DialogDescription>
        </DialogHeader>
        {result ? (
          <div className="flex flex-col gap-3">
            <ul>
              <ProposalCard update={result} onDone={() => close(false)} />
            </ul>
            <Button variant="ghost" className="self-start" onClick={() => close(false)}>
              Decide later
            </Button>
          </div>
        ) : (
          <form onSubmit={read} className="flex flex-col gap-3">
            <label htmlFor="email-text" className="sr-only">
              Email text
            </label>
            <Textarea
              id="email-text"
              autoFocus
              rows={10}
              maxLength={20_000}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Paste the whole email, including the subject…"
              className="text-[15px]"
            />
            {error && (
              <p role="alert" className="text-sm font-medium text-red-300">
                {error}
              </p>
            )}
            <Button type="submit" disabled={reading || text.trim().length < 20} className="self-end">
              {reading ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <Inbox className="size-4" aria-hidden />}
              {reading ? "Reading…" : "Read email"}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

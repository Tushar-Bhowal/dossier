"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, LoaderCircle, MailOpen } from "lucide-react";
import type { ApplicationRecord, EmailUpdateRecord, UpdateProposal } from "@dossier/core/applications";
import { ApiError, applyEmailUpdate, dismissEmailUpdate, listEmailUpdates } from "@/lib/api";
import { Button } from "@/components/ui/button";
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

  async function apply(update: EmailUpdateRecord): Promise<boolean> {
    try {
      const record = await applyEmailUpdate(update.id);
      drop(update.id);
      queryClient.setQueryData<ApplicationRecord[]>(["applications"], (list = []) =>
        list.some((r) => r.id === record.id) ? list.map((r) => (r.id === record.id ? record : r)) : [record, ...list],
      );
      toast.success(update.proposal.applicationId ? `Updated ${record.application.company}` : `Added ${record.application.company}`);
      return true;
    } catch (err) {
      toast.error("Couldn't apply that update", { description: err instanceof ApiError ? err.message : "Try again in a moment." });
      void queryClient.invalidateQueries({ queryKey: KEY });
      return false;
    }
  }

  async function dismiss(update: EmailUpdateRecord) {
    drop(update.id);
    await dismissEmailUpdate(update.id).catch(() => queryClient.invalidateQueries({ queryKey: KEY }));
  }

  return { apply, dismiss };
}

export function ProposalCard({ update, onDone }: { update: EmailUpdateRecord; onDone?: (outcome: "applied" | "dismissed") => void }) {
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
            onDone?.("dismissed");
          }}
        >
          Dismiss
        </Button>
        <Button
          size="sm"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            const applied = await apply(update);
            setBusy(false);
            if (applied) onDone?.("applied");
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

"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowUpRight, Check, FolderKanban, LoaderCircle, Minus, Plus, Trash2 } from "lucide-react";
import {
  CLOSED_STATUSES,
  OPEN_STAGES,
  addDays,
  toLocalDate,
  type ApplicationInput,
  type ApplicationRecord,
  type ApplicationStatus,
} from "@dossier/core/applications";
import { useActiveRuns } from "@/hooks/use-active-runs";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { Monogram } from "./ApplicationCard";
import { STATUS_LABEL, STATUS_TONE } from "./statusStyle";
import type { ApplicationsApi } from "./useApplications";

const sectionTitle = "text-[13px] font-semibold uppercase tracking-[0.08em] text-white/45";
const fieldLabel = "text-sm font-semibold text-white/75";

function cleanUrl(value: string): string | undefined | null {
  const text = value.trim();
  if (!text) return undefined;
  try {
    const url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
    return url.hostname.includes(".") ? url.href : null;
  } catch {
    return null;
  }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function StatusStepper({ status, onChange }: { status: ApplicationStatus; onChange: (s: ApplicationStatus) => void }) {
  const current = (OPEN_STAGES as readonly ApplicationStatus[]).indexOf(status);
  return (
    <div className="flex flex-col gap-3">
      <ol className="grid grid-cols-5 gap-1.5" aria-label="Stage">
        {OPEN_STAGES.map((stage, index) => {
          const reached = current >= index;
          const isCurrent = stage === status;
          return (
            <li key={stage}>
              <button
                type="button"
                aria-pressed={isCurrent}
                onClick={() => onChange(stage)}
                className={cn(
                  "flex w-full flex-col gap-2 rounded-lg px-1.5 pb-2 pt-1.5 text-left transition-colors hover:bg-white/[0.04] focus-visible:outline-2 focus-visible:outline-ring",
                  isCurrent && "bg-white/[0.05]",
                )}
              >
                <span className={cn("h-1.5 w-full rounded-full", reached ? STATUS_TONE[status].dot : "bg-white/10")} />
                <span className={cn("text-[13px] font-semibold leading-tight", isCurrent ? "text-white" : reached ? "text-white/70" : "text-white/45")}>
                  {STATUS_LABEL[stage]}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-white/50">Closed:</span>
        {CLOSED_STATUSES.map((closed) => (
          <button
            key={closed}
            type="button"
            aria-pressed={status === closed}
            onClick={() => onChange(closed)}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-sm font-semibold transition-colors",
              status === closed ? "border-white/30 bg-white/10 text-white" : "border-white/10 text-white/60 hover:border-white/20 hover:text-white",
            )}
          >
            {status === closed && <Check className="size-3.5" aria-hidden />}
            {STATUS_LABEL[closed]}
          </button>
        ))}
      </div>
    </div>
  );
}

function InterviewKitCard({ record, update }: { record: ApplicationRecord; update: ApplicationsApi["update"] }) {
  const app = record.application;
  const { addRun } = useActiveRuns();
  const [open, setOpen] = React.useState(false);
  const [days, setDays] = React.useState(7);
  const [site, setSite] = React.useState(app.companyUrl ?? "");
  const [starting, setStarting] = React.useState(false);

  if (app.kitRunId) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-white/[0.08] bg-white/[0.02] p-4">
        <FolderKanban className="size-5 shrink-0 text-[#ff7a5c]" aria-hidden />
        <p className="flex-1 text-[15px] font-medium text-white/80">An interview kit was started for this job.</p>
        <Button asChild variant="outline" size="sm">
          <Link href={`/runs/${app.kitRunId}`}>
            Open <ArrowUpRight className="size-3.5" aria-hidden />
          </Link>
        </Button>
      </div>
    );
  }

  async function start(e: React.FormEvent) {
    e.preventDefault();
    const companyUrl = cleanUrl(site);
    if (!app.jdText || !companyUrl) return;
    setStarting(true);
    try {
      const runId = await addRun({ jd: app.jdText, company_url: companyUrl, days }, app.role);
      // Queued runs only get a real id once they start, so they're tracked from the kits page instead.
      if (!runId.startsWith("local-")) update(record.id, (input) => ({ ...input, kitRunId: runId, companyUrl }));
      toast.success("Interview kit started", { description: "It's building on the Interview kits page." });
      setOpen(false);
    } catch {
      toast.error("Couldn't start the kit", { description: "Try again in a moment." });
    } finally {
      setStarting(false);
    }
  }

  return (
    <div className="rounded-lg border border-white/[0.08] bg-[radial-gradient(120%_80%_at_100%_0%,rgba(251,65,40,0.08),transparent_60%)] p-4">
      <div className="flex items-start gap-3">
        <FolderKanban className="mt-0.5 size-5 shrink-0 text-[#ff7a5c]" aria-hidden />
        <div className="flex-1">
          <p className="text-[15px] font-semibold text-white">Prepare for the interview</p>
          <p className="mt-0.5 text-sm font-medium text-white/55">
            {app.jdText
              ? "Build a kit from this job description: company research, questions, flashcards and a plan."
              : "Add the job description above to build an interview kit from it."}
          </p>
        </div>
        {!open && (
          <Button size="sm" onClick={() => setOpen(true)} disabled={!app.jdText}>
            Make kit
          </Button>
        )}
      </div>
      {open && (
        <form onSubmit={start} className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="kit-site" className={fieldLabel}>
              Company website
            </label>
            <Input id="kit-site" value={site} onChange={(e) => setSite(e.target.value)} placeholder="https://company.com" inputMode="url" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="kit-days" className={fieldLabel}>
              Days to prepare
            </label>
            <Input id="kit-days" type="number" min={1} max={90} value={days} onChange={(e) => setDays(Math.min(90, Math.max(1, Number(e.target.value) || 1)))} className="w-28" />
          </div>
          <Button type="submit" disabled={starting || !cleanUrl(site)}>
            {starting && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
            Start
          </Button>
        </form>
      )}
    </div>
  );
}

function SheetBody({
  record,
  api,
  onDeleted,
}: {
  record: ApplicationRecord;
  api: ApplicationsApi;
  onDeleted: () => void;
}) {
  const app = record.application;
  const today = toLocalDate(new Date());
  const { update } = api;
  const save = (change: (input: ApplicationInput) => ApplicationInput) => update(record.id, change);

  const [notes, setNotes] = React.useState(app.notes ?? "");
  const [notesState, setNotesState] = React.useState<"idle" | "saving" | "saved">("idle");
  const [details, setDetails] = React.useState({
    role: app.role,
    company: app.company,
    location: app.location ?? "",
    jobUrl: app.jobUrl ?? "",
    companyUrl: app.companyUrl ?? "",
  });
  const [detailsError, setDetailsError] = React.useState<string | null>(null);
  const [jd, setJd] = React.useState(app.jdText ?? "");
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  // Notes save themselves a moment after typing stops.
  React.useEffect(() => {
    if (notes === (app.notes ?? "")) return;
    const t = setTimeout(() => {
      update(record.id, (input) => ({ ...input, notes: notes.trim() ? notes : undefined }));
      setNotesState("saved");
    }, 800);
    return () => clearTimeout(t);
  }, [notes, app.notes, update, record.id]);

  function saveDetails() {
    const role = details.role.trim();
    const company = details.company.trim();
    const jobUrl = cleanUrl(details.jobUrl);
    const companyUrl = cleanUrl(details.companyUrl);
    if (!role || !company) return setDetailsError("Role and company can't be empty.");
    if (jobUrl === null || companyUrl === null) return setDetailsError("One of the links isn't a valid web address.");
    setDetailsError(null);
    const location = details.location.trim() || undefined;
    if (role === app.role && company === app.company && location === app.location && jobUrl === app.jobUrl && companyUrl === app.companyUrl) return;
    save((input) => ({ ...input, role, company, location, jobUrl, companyUrl }));
  }

  const history = [...app.statusHistory].reverse();

  return (
    <>
      <div className="flex items-start gap-3.5 pr-8">
        <Monogram name={app.company} className="size-12 text-xl" />
        <div className="min-w-0">
          <SheetTitle className="text-xl font-semibold leading-snug tracking-[-0.02em] text-white">{app.role}</SheetTitle>
          <SheetDescription className="mt-0.5 text-[15px] font-medium text-white/60">
            {app.company}
            {app.location ? ` · ${app.location}` : ""}
          </SheetDescription>
          {app.jobUrl && (
            <a
              href={app.jobUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-[#ff7a5c] hover:underline"
            >
              Open job posting <ArrowUpRight className="size-3.5" aria-hidden />
            </a>
          )}
        </div>
      </div>

      <section className="mt-7 flex flex-col gap-3" aria-labelledby="stage-heading">
        <h3 id="stage-heading" className={sectionTitle}>
          Stage
        </h3>
        <StatusStepper status={app.status} onChange={(status) => save((input) => ({ ...input, status }))} />
        {app.status === "interviewing" && (
          <div className="flex items-center gap-3 rounded-lg border border-amber-400/20 bg-amber-400/[0.06] px-4 py-2.5">
            <span className="flex-1 text-[15px] font-semibold text-amber-200">Interview round</span>
            <Button
              variant="outline"
              size="icon"
              aria-label="Previous round"
              disabled={(app.round ?? 1) <= 1}
              onClick={() => save((input) => ({ ...input, round: Math.max(1, (input.round ?? 1) - 1) }))}
            >
              <Minus className="size-4" />
            </Button>
            <span className="w-8 text-center text-lg font-semibold tabular-nums text-white" aria-live="polite">
              {app.round ?? 1}
            </span>
            <Button
              variant="outline"
              size="icon"
              aria-label="Next round"
              disabled={(app.round ?? 1) >= 20}
              onClick={() => save((input) => ({ ...input, round: Math.min(20, (input.round ?? 1) + 1) }))}
            >
              <Plus className="size-4" />
            </Button>
          </div>
        )}
      </section>

      <section className="mt-7 grid gap-4 sm:grid-cols-2" aria-label="Dates">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="applied-on" className={fieldLabel}>
            Applied on
          </label>
          <Input
            id="applied-on"
            type="date"
            max={today}
            value={app.appliedOn ?? ""}
            onChange={(e) => e.target.value && save((input) => ({ ...input, appliedOn: e.target.value }))}
            className="[color-scheme:dark]"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="follow-up" className={fieldLabel}>
            Follow up on
          </label>
          <Input
            id="follow-up"
            type="date"
            min={today}
            value={app.followUpOn ?? ""}
            onChange={(e) => save((input) => ({ ...input, followUpOn: e.target.value || undefined }))}
            className="[color-scheme:dark]"
          />
          <div className="flex flex-wrap gap-1.5">
            {[
              { label: "In 3 days", days: 3 },
              { label: "In a week", days: 7 },
            ].map((chip) => (
              <button
                key={chip.label}
                type="button"
                onClick={() => save((input) => ({ ...input, followUpOn: addDays(today, chip.days) }))}
                className="h-8 rounded-lg border border-white/10 px-2.5 text-[13px] font-semibold text-white/70 transition-colors hover:border-white/25 hover:text-white"
              >
                {chip.label}
              </button>
            ))}
            {app.followUpOn && (
              <button
                type="button"
                onClick={() => save((input) => ({ ...input, followUpOn: undefined }))}
                className="h-8 rounded-lg px-2.5 text-[13px] font-semibold text-white/50 hover:text-white"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </section>

      <section className="mt-7 flex flex-col gap-2" aria-labelledby="notes-heading">
        <div className="flex items-center justify-between">
          <h3 id="notes-heading" className={sectionTitle}>
            Notes
          </h3>
          <span className="text-[13px] font-medium text-white/45" aria-live="polite">
            {notesState === "saving" ? "Saving…" : notesState === "saved" ? "Saved" : ""}
          </span>
        </div>
        <Textarea
          aria-labelledby="notes-heading"
          value={notes}
          onChange={(e) => {
            setNotes(e.target.value);
            setNotesState("saving");
          }}
          rows={4}
          maxLength={4000}
          placeholder="Who you spoke to, what they asked, what to prepare next…"
          className="text-[15px]"
        />
      </section>

      <section className="mt-7" aria-label="Interview kit">
        <InterviewKitCard record={record} update={update} />
      </section>

      <section className="mt-7 flex flex-col gap-3" aria-labelledby="details-heading">
        <h3 id="details-heading" className={sectionTitle}>
          Details
        </h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {(
            [
              { key: "role", label: "Role", wide: true },
              { key: "company", label: "Company" },
              { key: "location", label: "Location" },
              { key: "jobUrl", label: "Job link", wide: true },
              { key: "companyUrl", label: "Company website", wide: true },
            ] as const
          ).map((field) => (
            <div key={field.key} className={cn("flex flex-col gap-1.5", "wide" in field && field.wide && "sm:col-span-2")}>
              <label htmlFor={`detail-${field.key}`} className={fieldLabel}>
                {field.label}
              </label>
              <Input
                id={`detail-${field.key}`}
                value={details[field.key]}
                onChange={(e) => setDetails((d) => ({ ...d, [field.key]: e.target.value }))}
                onBlur={saveDetails}
                inputMode={field.key.endsWith("Url") ? "url" : undefined}
              />
            </div>
          ))}
        </div>
        {detailsError && (
          <p role="alert" className="text-sm font-medium text-red-300">
            {detailsError}
          </p>
        )}
        <details className="rounded-lg border border-white/[0.08] bg-white/[0.02] px-4 py-3">
          <summary className="cursor-pointer list-none text-sm font-semibold text-white/80">
            Job description <span className="font-medium text-white/45">{app.jdText ? `(${app.jdText.length.toLocaleString()} characters)` : "(not added)"}</span>
          </summary>
          <Textarea
            aria-label="Job description"
            value={jd}
            onChange={(e) => setJd(e.target.value)}
            onBlur={() => jd !== (app.jdText ?? "") && save((input) => ({ ...input, jdText: jd.trim() ? jd.trim() : undefined }))}
            rows={8}
            maxLength={20_000}
            className="mt-3 text-[15px]"
            placeholder="Paste the job description"
          />
        </details>
      </section>

      <section className="mt-7 flex flex-col gap-3" aria-labelledby="history-heading">
        <h3 id="history-heading" className={sectionTitle}>
          History
        </h3>
        <ol className="relative flex flex-col gap-3 border-l border-white/10 pl-5">
          {history.map((event, index) => (
            <li key={`${event.at}-${index}`} className="relative">
              <span className={cn("absolute -left-[25px] top-1.5 size-2.5 rounded-full ring-4 ring-[#0e0e0e]", STATUS_TONE[event.status].dot)} aria-hidden />
              <p className="text-[15px] font-semibold text-white">
                {STATUS_LABEL[event.status]}
                {event.round ? ` · round ${event.round}` : ""}
              </p>
              <p className="text-sm font-medium text-white/50">{formatDate(event.at)}</p>
            </li>
          ))}
        </ol>
      </section>

      <div className="mt-8 border-t border-white/[0.08] pt-5">
        <Button variant="ghost" className="text-red-300 hover:bg-red-500/10 hover:text-red-200" onClick={() => setConfirmDelete(true)}>
          <Trash2 className="size-4" aria-hidden /> Delete application
        </Button>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this application?"
        description={`${app.role} at ${app.company} and its history will be removed.`}
        onConfirm={async () => {
          await api.remove(record.id);
          toast.success("Application deleted");
          onDeleted();
        }}
      />
    </>
  );
}

export function ApplicationSheet({
  record,
  api,
  onOpenChange,
}: {
  record: ApplicationRecord | undefined;
  api: ApplicationsApi;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet open={Boolean(record)} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl">
        {record && <SheetBody key={record.id} record={record} api={api} onDeleted={() => onOpenChange(false)} />}
      </SheetContent>
    </Sheet>
  );
}

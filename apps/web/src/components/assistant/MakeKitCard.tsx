"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowUpRight, Check, FolderKanban, LoaderCircle } from "lucide-react";
import { nextInterview, type ApplicationRecord, type ChatPart } from "@dossier/core/applications";
import { useActiveRuns } from "@/hooks/use-active-runs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { useApplications } from "@/components/applications/useApplications";

type KitPart = Extract<ChatPart, { kind: "make_kit" }>;

const fieldLabel = "text-sm font-semibold text-white/75";
const MIN_JD = 80;
const DAY_MS = 86_400_000;

function cleanUrl(value: string): string | null {
  const text = value.trim();
  if (!text) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
    return url.hostname.includes(".") ? url.href : null;
  } catch {
    return null;
  }
}

// Study until the interview when there is one; otherwise a week.
function daysUntilInterview(record: ApplicationRecord | undefined): { days: number; note?: string } {
  const interview = record && nextInterview(record.application, new Date());
  if (!interview) return { days: 7 };
  const days = Math.min(90, Math.max(1, Math.ceil((Date.parse(interview.startsAt) - Date.now()) / DAY_MS)));
  const when = new Date(interview.startsAt).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
  return { days, note: `Interview on ${when}` };
}

function Started({ runId, existing = false }: { runId: string; existing?: boolean }) {
  const queued = runId.startsWith("local-");
  return (
    <div className="flex items-center gap-3 rounded-lg border border-white/[0.08] bg-[#131313] px-3 py-2.5">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-400/10 text-emerald-400" aria-hidden>
        <Check className="size-4" />
      </span>
      <p className="min-w-0 flex-1 text-[15px] font-semibold text-white">
        {existing
          ? "This job already has an interview kit."
          : queued
            ? "Kit queued. It starts as soon as one finishes building."
            : "Your kit is building. It takes 1–3 minutes."}
      </p>
      <Button asChild size="sm" variant="outline">
        <Link href={queued ? "/kits" : `/runs/${runId}`}>
          {existing ? "Open kit" : "Watch it"} <ArrowUpRight className="size-3.5" aria-hidden />
        </Link>
      </Button>
    </div>
  );
}

function KitForm({ part, record, api }: { part: KitPart; record?: ApplicationRecord; api: ReturnType<typeof useApplications> }) {
  const { addRun } = useActiveRuns();
  const app = record?.application;
  const plan = daysUntilInterview(record);
  const [jd, setJd] = React.useState(part.jd ?? app?.jdText ?? "");
  const [site, setSite] = React.useState(app?.companyUrl ?? "");
  const [days, setDays] = React.useState(plan.days);
  const [busy, setBusy] = React.useState(false);
  const [runId, setRunId] = React.useState<string | null>(null);

  if (runId) return <Started runId={runId} />;

  const companyUrl = cleanUrl(site);
  const jdReady = jd.trim().length >= MIN_JD;
  const jdSource = part.jd ? "From what you pasted" : app?.jdText ? "From the job posting saved on this application" : null;

  async function start(e: React.FormEvent) {
    e.preventDefault();
    if (!jdReady || !companyUrl) return;
    setBusy(true);
    try {
      let id = record?.id;
      const role = app?.role ?? part.role ?? "Role not stated";
      if (!id) {
        // A job only pasted so far: tapping Start is the go-ahead to track it too.
        const result = await api.create({ company: part.company ?? "Unknown company", role, status: "applied", jdText: jd.trim(), companyUrl });
        id = result.ok ? result.record.id : result.record?.id;
      } else if (app && (app.jdText !== jd.trim() || app.companyUrl !== companyUrl)) {
        api.update(id, (input) => ({ ...input, jdText: jd.trim(), companyUrl }));
      }
      const started = await addRun({ jd: jd.trim(), company_url: companyUrl, days }, role);
      // Queued kits only get a real id once they start, so they're tracked from the kits page instead.
      if (id && !started.startsWith("local-")) api.update(id, (input) => ({ ...input, kitRunId: started }));
      setRunId(started);
    } catch {
      toast.error("Couldn't start the kit", { description: "Try again in a moment." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={start} className="flex flex-col gap-4 rounded-lg border border-white/[0.08] bg-[radial-gradient(120%_80%_at_100%_0%,rgba(251,65,40,0.08),transparent_60%)] bg-[#131313] p-4">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-[#ff7a5c]" aria-hidden>
          <FolderKanban className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="text-[15px] font-semibold text-white">Interview kit · {part.label}</p>
          <p className="text-sm font-medium text-white/55">Company research, likely questions, flashcards and a day-by-day plan.</p>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={`kit-jd-${part.applicationId ?? part.label}`} className={fieldLabel}>
          Job description
        </label>
        {jdSource && jdReady ? (
          <p className="rounded-lg bg-white/[0.04] px-3 py-2 text-sm font-medium text-white/70">
            {jdSource} · {jd.trim().length.toLocaleString("en-US")} characters
          </p>
        ) : (
          <Textarea
            id={`kit-jd-${part.applicationId ?? part.label}`}
            rows={4}
            maxLength={20_000}
            value={jd}
            onChange={(e) => setJd(e.target.value)}
            placeholder="Paste the job description here"
          />
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`kit-site-${part.applicationId ?? part.label}`} className={fieldLabel}>
            Company website
          </label>
          <Input
            id={`kit-site-${part.applicationId ?? part.label}`}
            value={site}
            onChange={(e) => setSite(e.target.value)}
            placeholder="stripe.com"
            inputMode="url"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`kit-days-${part.applicationId ?? part.label}`} className={fieldLabel}>
            Days to prepare
          </label>
          <Input
            id={`kit-days-${part.applicationId ?? part.label}`}
            type="number"
            min={1}
            max={90}
            value={days}
            onChange={(e) => setDays(Math.min(90, Math.max(1, Number(e.target.value) || 1)))}
            className="sm:w-32"
          />
        </div>
      </div>
      {plan.note && <p className="-mt-2 text-sm font-medium text-white/55">{plan.note} · the plan runs until then.</p>}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-medium text-white/55">
          {!jdReady ? "Add the job description to start." : !companyUrl ? "Add the company website to start." : "Takes 1–3 minutes. You can keep chatting."}
        </p>
        <Button type="submit" disabled={busy || !jdReady || !companyUrl}>
          {busy && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
          Start kit
        </Button>
      </div>
    </form>
  );
}

export function MakeKitCard({ part }: { part: KitPart }) {
  const api = useApplications();
  const record = part.applicationId ? api.records.find((r) => r.id === part.applicationId) : undefined;

  if (part.applicationId && api.isLoading) return <Skeleton className="h-40 rounded-lg" />;
  if (part.applicationId && !record) {
    return <p className="text-[15px] font-medium text-white/60">That application no longer exists.</p>;
  }
  if (record?.application.kitRunId) return <Started runId={record.application.kitRunId} existing />;
  return <KitForm key={record?.id ?? part.label} part={part} record={record} api={api} />;
}

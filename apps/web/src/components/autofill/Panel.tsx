"use client";

import * as React from "react";
import Image from "next/image";
import type { FieldResult, FixedTopic } from "@dossier/core/autofill";
import { AlertCircle, Check, ChevronRight, FileText, LoaderCircle, LogIn, PenLine, RefreshCcw, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { DemoForm } from "@/lib/autofill/demo/forms";
import { cn } from "@/lib/utils";

export type PanelPhase = "idle" | "scanning" | "needs_jd" | "filling" | "review";

export const STATUS_STYLE = {
  profile: { label: "From your profile", dot: "bg-emerald-400", ring: "ring-emerald-400/60" },
  answer: { label: "Written from your facts: check these", dot: "bg-sky-400", ring: "ring-sky-400/60" },
  saved: { label: "From your saved answers", dot: "bg-violet-400", ring: "ring-violet-400/60" },
  blank: { label: "Needs you", dot: "bg-amber-400", ring: "ring-amber-400/70" },
} as const;

export function groupOf(result: FieldResult): keyof typeof STATUS_STYLE {
  if (result.kind === "file" || result.kind === "profile" || result.kind === "option") return "profile";
  return result.kind;
}

const TOPIC_LABEL: Record<FixedTopic, string> = {
  workAuthorization: "work permission",
  sponsorship: "visa sponsorship",
  salary: "salary",
  noticePeriod: "notice period",
  relocation: "relocation",
  eeoGender: "gender",
  eeoEthnicity: "ethnicity",
  eeoVeteran: "veteran status",
  eeoDisability: "disability",
  other: "this",
};

function blankReason(r: Extract<FieldResult, { kind: "blank" }>): string {
  switch (r.reason) {
    case "fixed_topic":
      return `Only you answer questions about ${TOPIC_LABEL[r.topic ?? "other"]}. Answer once and it's reused next time.`;
    case "no_facts":
      return "Nothing in your profile or facts covers this, so it's left for you.";
    case "grounding_failed":
      return "The draft said things your facts don't back up, so we left it blank rather than guess.";
    case "ai_unavailable":
      return "The AI couldn't write this right now.";
    default:
      return "This kind of field can't be filled automatically.";
  }
}

function preview(result: FieldResult): string {
  if (result.kind === "profile" || result.kind === "answer" || result.kind === "saved") return result.text;
  if (result.kind === "file") return result.fileName;
  return "";
}

function FixedAnswer({ topic, onSave }: { topic: FixedTopic; onSave: (topic: FixedTopic, answer: string) => Promise<void> }) {
  const [value, setValue] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  return (
    <form
      className="mt-2 flex gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!value.trim()) return;
        setSaving(true);
        try {
          await onSave(topic, value.trim());
        } finally {
          setSaving(false);
        }
      }}
    >
      <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder="Your answer" aria-label={`Your answer about ${TOPIC_LABEL[topic]}`} className="h-10 text-sm" />
      <Button type="submit" size="sm" className="h-10 shrink-0" disabled={saving || !value.trim()}>
        {saving ? <LoaderCircle className="size-3.5 animate-spin" aria-hidden /> : "Save"}
      </Button>
    </form>
  );
}

export function Panel({
  email,
  phase,
  form,
  results,
  aiProblem,
  unreadableParts,
  editedCount,
  labels,
  onFill,
  onFocusField,
  onRetryAi,
  onSaveFixed,
  onSaveEdits,
  onPasteJd,
}: {
  email: string | null;
  phase: PanelPhase;
  form: DemoForm | null;
  results: FieldResult[];
  aiProblem: "down" | "quota" | null;
  unreadableParts: number;
  editedCount: number;
  labels: Record<string, string>;
  onFill: () => void;
  onFocusField: (id: string) => void;
  onRetryAi: () => void;
  onSaveFixed: (topic: FixedTopic, answer: string) => Promise<void>;
  onSaveEdits: () => Promise<void>;
  onPasteJd: (jd: string | null) => void;
}) {
  const [jd, setJd] = React.useState("");
  const [savingEdits, setSavingEdits] = React.useState(false);

  const groups = (["profile", "answer", "saved", "blank"] as const).map((g) => ({ g, items: results.filter((r) => groupOf(r) === g) }));
  const needs = groups.find((x) => x.g === "blank")!.items.length;

  return (
    <aside aria-label="Dossier side panel" className="flex h-full min-h-[640px] flex-col bg-[#0f0f0f] text-white">
      <header className="flex items-center justify-between gap-3 border-b border-white/[0.08] px-4 py-3">
        <span className="flex items-center gap-2">
          <Image src="/logo.png" alt="" width={22} height={22} className="size-[22px]" />
          <span className="text-[15px] font-bold tracking-[-0.02em]">Dossier</span>
        </span>
        {email && <span className="truncate text-[13px] font-medium text-white/50">{email}</span>}
      </header>

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
        {!email ? (
          <div className="flex flex-col gap-3 rounded-lg border border-white/[0.08] bg-white/[0.02] p-4">
            <p className="text-[15px] font-semibold">Sign in to Dossier first</p>
            <p className="text-sm leading-relaxed text-white/60">The extension uses your Dossier profile and saved answers. Nothing on this page is read until you&apos;re signed in.</p>
            <Button className="h-11">
              <LogIn className="size-4" aria-hidden />
              Open Dossier to sign in
            </Button>
          </div>
        ) : phase === "idle" ? (
          <>
            <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-4">
              <p className="text-sm font-medium text-white/55">On this page</p>
              <p className="mt-0.5 text-[15px] font-semibold">
                {form ? `${form.title} · ${form.company}` : "A job application"}
              </p>
            </div>
            <Button size="lg" className="h-12 text-base" onClick={onFill}>
              Fill this page
            </Button>
            <ul className="flex flex-col gap-2 text-sm leading-relaxed text-white/65">
              <li className="flex gap-2">
                <Check className="mt-0.5 size-4 shrink-0 text-emerald-300" aria-hidden />
                Contact details and links fill from your profile, on this device.
              </li>
              <li className="flex gap-2">
                <Check className="mt-0.5 size-4 shrink-0 text-emerald-300" aria-hidden />
                Written answers come only from your confirmed facts. Anything they don&apos;t cover is left for you.
              </li>
              <li className="flex gap-2">
                <Check className="mt-0.5 size-4 shrink-0 text-emerald-300" aria-hidden />
                Salary, visa, notice period and diversity questions are never answered by AI.
              </li>
            </ul>
          </>
        ) : phase === "scanning" || phase === "filling" ? (
          <div className="flex flex-col gap-3 rounded-lg border border-white/[0.08] bg-white/[0.02] p-4" role="status">
            <p className="flex items-center gap-2 text-[15px] font-semibold">
              <LoaderCircle className="size-4 animate-spin text-[#ff7a5c] motion-reduce:animate-none" aria-hidden />
              {phase === "scanning" ? "Reading the form…" : "Filling in…"}
            </p>
            <p className="text-sm text-white/60">
              {phase === "scanning" ? "Finding every question on the page." : `Found ${form?.fields.length ?? 0} fields. Writing the longer answers from your facts.`}
            </p>
          </div>
        ) : phase === "needs_jd" ? (
          <div className="flex flex-col gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
            <p className="text-[15px] font-semibold">We couldn&apos;t find the job description</p>
            <p className="text-sm leading-relaxed text-white/70">Paste it so written answers fit this job. Or fill without it: written questions are then left for you.</p>
            <Textarea rows={5} value={jd} onChange={(e) => setJd(e.target.value)} placeholder="Paste the job description" aria-label="Job description" className="bg-black/30 text-sm" />
            <div className="flex flex-wrap gap-2">
              <Button className="h-11" disabled={jd.trim().length < 50} onClick={() => onPasteJd(jd)}>
                Continue
              </Button>
              <Button variant="ghost" className="h-11" onClick={() => onPasteJd(null)}>
                Fill without it
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-4">
              <p className="text-[15px] font-semibold">
                {results.length - needs} of {results.length} filled{needs ? ` · ${needs} need you` : ""}
              </p>
              <p className="mt-1 text-sm text-white/60">Check everything, then submit the form yourself. Dossier never clicks Submit or Next.</p>
            </div>

            {aiProblem && (
              <div role="alert" className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
                <AlertCircle className="mt-0.5 size-4 shrink-0 text-amber-300" aria-hidden />
                <div className="flex-1 text-sm text-amber-50">
                  {aiProblem === "quota" ? "Today's free AI requests are used up, so written answers are left for you." : "The AI isn't responding, so written answers are left for you."}
                  {aiProblem === "down" && (
                    <button type="button" onClick={onRetryAi} className="ml-1 font-semibold text-white underline underline-offset-4">
                      Try again
                    </button>
                  )}
                </div>
              </div>
            )}
            {unreadableParts > 0 && (
              <p role="note" className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-3 text-sm text-white/65">
                Part of this form is inside a box from another site that Dossier can&apos;t read. Fill that part yourself.
              </p>
            )}

            {groups.map(({ g, items }) =>
              items.length ? (
                <section key={g} aria-labelledby={`grp-${g}`} className="flex flex-col gap-1.5">
                  <h3 id={`grp-${g}`} className="flex items-center gap-2 text-[13px] font-semibold text-white/60">
                    <span className={cn("size-2 rounded-full", STATUS_STYLE[g].dot)} aria-hidden />
                    {STATUS_STYLE[g].label} · {items.length}
                  </h3>
                  <ul className="flex flex-col gap-1">
                    {items.map((r) => (
                      <li key={r.id} className="rounded-lg border border-white/[0.06] bg-white/[0.02]">
                        <button type="button" onClick={() => onFocusField(r.id)} className="flex w-full items-start gap-2 p-3 text-left hover:bg-white/[0.03]">
                          {r.kind === "file" ? <FileText className="mt-0.5 size-4 shrink-0 text-white/50" aria-hidden /> : null}
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-semibold text-white/90">{labels[r.id]}</span>
                            {preview(r) && <span className="mt-0.5 line-clamp-2 block text-[13px] text-white/55">{preview(r)}</span>}
                            {r.kind === "blank" && <span className="mt-0.5 block text-[13px] text-amber-200/80">{blankReason(r)}</span>}
                          </span>
                          <ChevronRight className="mt-0.5 size-4 shrink-0 text-white/30" aria-hidden />
                        </button>
                        {r.kind === "blank" && r.reason === "fixed_topic" && r.topic && (
                          <div className="px-3 pb-3">
                            <FixedAnswer topic={r.topic} onSave={onSaveFixed} />
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null,
            )}
          </>
        )}
      </div>

      {email && phase === "review" && (
        <footer className="flex flex-col gap-2 border-t border-white/[0.08] p-4">
          <Button
            className="h-11"
            variant={editedCount ? "default" : "outline"}
            disabled={!editedCount || savingEdits}
            onClick={async () => {
              setSavingEdits(true);
              try {
                await onSaveEdits();
              } finally {
                setSavingEdits(false);
              }
            }}
          >
            {savingEdits ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <PenLine className="size-4" aria-hidden />}
            {editedCount ? `Save my ${editedCount} edit${editedCount === 1 ? "" : "s"} for next time` : "Edit an answer to save it for next time"}
          </Button>
          <Button variant="ghost" className="h-11" onClick={onFill}>
            <RefreshCcw className="size-4" aria-hidden />
            Scan again
          </Button>
          <p className="flex items-center gap-1.5 text-[13px] font-medium text-white/45">
            <ShieldCheck className="size-3.5" aria-hidden />
            Phone, email and address never go to the AI.
          </p>
        </footer>
      )}
    </aside>
  );
}

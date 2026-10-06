"use client";

import * as React from "react";
import { ArrowRight, Link2, LoaderCircle } from "lucide-react";
import { toLocalDate, type ApplicationRecord, type ApplicationStatus } from "@dossier/core/applications";
import { previewJobLink } from "@/lib/api";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import type { ApplicationsApi } from "./useApplications";

const fieldLabel = "text-sm font-semibold text-white/80";

function asHttpUrl(value: string): string | undefined {
  const text = value.trim();
  if (!text) return undefined;
  try {
    const url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
    return url.hostname.includes(".") ? url.href : undefined;
  } catch {
    return undefined;
  }
}

interface Draft {
  jobUrl: string;
  company: string;
  role: string;
  location: string;
  companyUrl: string;
  status: Extract<ApplicationStatus, "saved" | "applied">;
  appliedOn: string;
  jdText: string;
}

function emptyDraft(): Draft {
  return { jobUrl: "", company: "", role: "", location: "", companyUrl: "", status: "applied", appliedOn: toLocalDate(new Date()), jdText: "" };
}

export function AddApplicationDialog({
  open,
  onOpenChange,
  create,
  onOpenExisting,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  create: ApplicationsApi["create"];
  onOpenExisting: (record: ApplicationRecord) => void;
}) {
  const [step, setStep] = React.useState<"link" | "details">("link");
  const [draft, setDraft] = React.useState<Draft>(emptyDraft);
  const [link, setLink] = React.useState("");
  const [loadingPreview, setLoadingPreview] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [duplicate, setDuplicate] = React.useState<ApplicationRecord | null>(null);
  const roleRef = React.useRef<HTMLInputElement>(null);

  const reset = () => {
    setStep("link");
    setDraft(emptyDraft());
    setLink("");
    setError(null);
    setDuplicate(null);
  };

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));

  async function readJobLink(value: string) {
    const url = asHttpUrl(value);
    if (!url) {
      setError("That doesn't look like a web link. Paste the job posting's address, or add it without a link.");
      return;
    }
    setError(null);
    setLoadingPreview(true);
    try {
      const preview = await previewJobLink(url);
      setDraft((d) => ({
        ...d,
        jobUrl: url,
        company: preview.company ?? d.company,
        role: preview.role ?? d.role,
        companyUrl: preview.companyUrl ?? d.companyUrl,
        jdText: preview.jdText ?? d.jdText,
      }));
    } catch {
      setDraft((d) => ({ ...d, jobUrl: url }));
    } finally {
      setLoadingPreview(false);
      setStep("details");
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.company.trim() || !draft.role.trim()) {
      setError("Add the company and the role.");
      return;
    }
    const jobUrl = draft.jobUrl ? asHttpUrl(draft.jobUrl) : undefined;
    const companyUrl = draft.companyUrl ? asHttpUrl(draft.companyUrl) : undefined;
    if ((draft.jobUrl && !jobUrl) || (draft.companyUrl && !companyUrl)) {
      setError("One of the links isn't a valid web address.");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const result = await create({
        company: draft.company.trim(),
        role: draft.role.trim(),
        status: draft.status,
        ...(jobUrl ? { jobUrl } : {}),
        ...(companyUrl ? { companyUrl } : {}),
        ...(draft.location.trim() ? { location: draft.location.trim() } : {}),
        ...(draft.status === "applied" && draft.appliedOn ? { appliedOn: draft.appliedOn } : {}),
        ...(draft.jdText.trim() ? { jdText: draft.jdText.trim().slice(0, 20_000) } : {}),
      });
      if (result.ok) {
        toast.success("Application added", { description: `${result.record.application.role} at ${result.record.application.company}` });
        onOpenChange(false);
        reset();
      } else if (result.reason === "duplicate") {
        setDuplicate(result.record ?? null);
      }
    } catch {
      setError("Couldn't add it right now. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  React.useEffect(() => {
    if (step === "details") roleRef.current?.focus();
  }, [step]);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) reset();
      }}
    >
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold tracking-[-0.02em] text-white">Add an application</DialogTitle>
          <DialogDescription className="text-[15px] text-white/60">
            {step === "link"
              ? "Paste the job link and we'll fill in what the page shows."
              : "Check the details. Everything stays editable later."}
          </DialogDescription>
        </DialogHeader>

        {step === "link" ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void readJobLink(link);
            }}
            className="flex flex-col gap-3"
          >
            <label htmlFor="job-link" className="sr-only">
              Job link
            </label>
            <div className="relative">
              <Link2 className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-white/40" aria-hidden />
              <Input
                id="job-link"
                autoFocus
                inputMode="url"
                placeholder="https://jobs.lever.co/company/…"
                value={link}
                onChange={(e) => setLink(e.target.value)}
                onPaste={(e) => {
                  const pasted = e.clipboardData.getData("text");
                  if (asHttpUrl(pasted)) {
                    e.preventDefault();
                    setLink(pasted.trim());
                    void readJobLink(pasted);
                  }
                }}
                disabled={loadingPreview}
                className="h-12 pl-10 text-[15px] md:text-[15px]"
              />
            </div>
            {error && (
              <p role="alert" className="text-sm font-medium text-red-300">
                {error}
              </p>
            )}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setError(null);
                  setStep("details");
                }}
              >
                Add without a link
              </Button>
              <Button type="submit" disabled={loadingPreview || !link.trim()}>
                {loadingPreview ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <ArrowRight className="size-4" aria-hidden />}
                {loadingPreview ? "Reading the page…" : "Continue"}
              </Button>
            </div>
          </form>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <label htmlFor="app-role" className={fieldLabel}>
                  Role
                </label>
                <Input id="app-role" ref={roleRef} value={draft.role} onChange={(e) => set("role", e.target.value)} placeholder="Frontend Engineer" maxLength={160} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="app-company" className={fieldLabel}>
                  Company
                </label>
                <Input id="app-company" value={draft.company} onChange={(e) => set("company", e.target.value)} placeholder="Stripe" maxLength={120} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="app-location" className={fieldLabel}>
                  Location <span className="font-medium text-white/45">(optional)</span>
                </label>
                <Input id="app-location" value={draft.location} onChange={(e) => set("location", e.target.value)} placeholder="Bengaluru · Remote" maxLength={120} />
              </div>
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <label htmlFor="app-link" className={fieldLabel}>
                  Job link <span className="font-medium text-white/45">(optional)</span>
                </label>
                <Input id="app-link" inputMode="url" value={draft.jobUrl} onChange={(e) => set("jobUrl", e.target.value)} placeholder="https://…" />
              </div>
            </div>

            <fieldset className="flex flex-col gap-2">
              <legend className={cn(fieldLabel, "mb-2")}>Where are you with it?</legend>
              <div className="grid grid-cols-2 gap-2" role="radiogroup">
                {(
                  [
                    { value: "saved", label: "Saved", hint: "Planning to apply" },
                    { value: "applied", label: "Applied", hint: "Already sent" },
                  ] as const
                ).map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={draft.status === option.value}
                    onClick={() => set("status", option.value)}
                    className={cn(
                      "rounded-lg border px-4 py-3 text-left transition-colors",
                      draft.status === option.value
                        ? "border-primary/60 bg-primary/10"
                        : "border-white/10 bg-white/[0.02] hover:border-white/20",
                    )}
                  >
                    <span className="block text-[15px] font-semibold text-white">{option.label}</span>
                    <span className="block text-sm font-medium text-white/55">{option.hint}</span>
                  </button>
                ))}
              </div>
            </fieldset>

            {draft.status === "applied" && (
              <div className="flex flex-col gap-1.5">
                <label htmlFor="app-date" className={fieldLabel}>
                  Applied on
                </label>
                <Input
                  id="app-date"
                  type="date"
                  value={draft.appliedOn}
                  max={toLocalDate(new Date())}
                  onChange={(e) => set("appliedOn", e.target.value)}
                  className="w-full sm:w-56 [color-scheme:dark]"
                />
              </div>
            )}

            <details className="group rounded-lg border border-white/[0.08] bg-white/[0.02] px-4 py-3" open={Boolean(draft.jdText)}>
              <summary className="cursor-pointer list-none text-sm font-semibold text-white/80 marker:hidden">
                Job description <span className="font-medium text-white/45">{draft.jdText ? "(found on the page)" : "(optional, used for interview kits)"}</span>
              </summary>
              <Textarea
                aria-label="Job description"
                value={draft.jdText}
                onChange={(e) => set("jdText", e.target.value)}
                rows={6}
                maxLength={20_000}
                className="mt-3 max-h-48 text-[15px]"
                placeholder="Paste the job description"
              />
            </details>

            {duplicate ? (
              <div role="alert" className="flex flex-col gap-3 rounded-lg border border-amber-400/30 bg-amber-400/10 p-4 sm:flex-row sm:items-center">
                <p className="flex-1 text-sm font-medium text-amber-100">
                  You already track this job
                  {duplicate.application.appliedOn ? `, applied ${new Date(duplicate.application.appliedOn).toLocaleDateString(undefined, { day: "numeric", month: "short" })}` : ""}.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    onOpenChange(false);
                    reset();
                    onOpenExisting(duplicate);
                  }}
                >
                  Open it
                </Button>
              </div>
            ) : (
              error && (
                <p role="alert" className="text-sm font-medium text-red-300">
                  {error}
                </p>
              )
            )}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="ghost" onClick={() => setStep("link")}>
                Back
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
                Add application
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

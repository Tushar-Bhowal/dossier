"use client";

import * as React from "react";
import { ArrowRight, FolderKanban } from "lucide-react";
import type { TailorTarget } from "@dossier/core/resume";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { panelClass } from "../parts";

const MIN_JD = 50;

export function TailorStart({
  baseTitle,
  initial,
  fromKit,
  example,
  onStart,
}: {
  baseTitle: string;
  initial: { jdText: string; company: string; role: string };
  fromKit: boolean;
  example?: TailorTarget;
  onStart: (target: { jdText: string; company: string; role: string }) => void;
}) {
  const [jdText, setJdText] = React.useState(initial.jdText);
  const [company, setCompany] = React.useState(initial.company);
  const [role, setRole] = React.useState(initial.role);
  const [touched, setTouched] = React.useState(false);
  const tooShort = jdText.trim().length < MIN_JD;

  return (
    <form
      className={panelClass}
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        setTouched(true);
        if (!tooShort) onStart({ jdText: jdText.trim(), company: company.trim(), role: role.trim() });
      }}
    >
      <h2 className="text-[26px] font-semibold leading-tight tracking-[-0.03em] text-white">Tailor for a job</h2>
      <p className="mt-2 max-w-2xl text-base leading-relaxed text-white/65">
        We make a copy of <span className="font-semibold text-white">{baseTitle}</span> and suggest changes for this job —
        each one based on what you&apos;ve told us. Your original stays as it is.
      </p>

      {fromKit && (
        <p className="mt-5 flex items-start gap-2.5 rounded-lg border border-white/[0.06] bg-white/[0.02] p-4 text-sm leading-relaxed text-white/70">
          <FolderKanban className="mt-0.5 size-4 shrink-0 text-[#ff7a5c]" aria-hidden />
          Started from your interview kit. Paste the same job description below so we can match it line by line.
        </p>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-2 text-sm font-semibold text-white/85">
          Job title
          <Input value={role} onChange={(e) => setRole(e.target.value)} placeholder="e.g. AI Engineer" maxLength={120} className="h-11" />
        </label>
        <label className="flex flex-col gap-2 text-sm font-semibold text-white/85">
          Company
          <Input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="e.g. Nimbus Health" maxLength={120} className="h-11" />
        </label>
        <label className="flex flex-col gap-2 text-sm font-semibold text-white/85 sm:col-span-2">
          Job description
          <Textarea
            value={jdText}
            onChange={(e) => setJdText(e.target.value)}
            placeholder="Paste the full job description here."
            maxLength={20000}
            aria-invalid={touched && tooShort}
            className="min-h-[220px] text-[15px] leading-relaxed md:text-[15px]"
          />
          {touched && tooShort && (
            <span className="text-[13px] font-medium text-amber-300">Paste the whole job description — this looks too short to match against.</span>
          )}
        </label>
      </div>

      <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        {example ? (
          <Button
            type="button"
            variant="ghost"
            className="text-white/70"
            onClick={() => {
              setJdText(example.jdText);
              setCompany(example.company ?? "");
              setRole(example.role ?? "");
            }}
          >
            Use the example job
          </Button>
        ) : (
          <span />
        )}
        <Button type="submit" size="lg">
          Match my resume
          <ArrowRight className="size-4" />
        </Button>
      </div>
    </form>
  );
}

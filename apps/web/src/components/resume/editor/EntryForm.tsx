"use client";

import * as React from "react";
import type { Entry, EntryKind } from "@dossier/core/resume";
import { normaliseUrl } from "@/lib/resume/contact";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const YEAR_MONTH = /^\d{4}(-(0[1-9]|1[0-2]))?$/;

type Patch = Pick<Entry, "title" | "current"> & Partial<Entry>;

interface KindCopy {
  title: [string, string];
  org: [string, string];
  link?: string;
  // Certificates and awards have one date, not a range.
  singleDate?: true;
  grade?: true;
  credential?: true;
  presets?: string[];
}

const COPY: Record<EntryKind, KindCopy> = {
  job: { title: ["Job title", "e.g. Mathematics Teacher"], org: ["Organisation", "e.g. St. Mary's School"] },
  education: {
    title: ["Degree or class", "e.g. B.Sc. Nursing"],
    org: ["School, college or university", "e.g. University of Calcutta"],
    grade: true,
    presets: ["Class X", "Class XII", "Diploma", "Bachelor's", "Master's"],
  },
  project: {
    title: ["Project name", "e.g. Attendance tracker"],
    org: ["Done for (optional)", "e.g. Final-year project"],
    link: "Project link (GitHub, demo, video)",
  },
  certification: {
    title: ["Certificate", "e.g. CTET, BLS, AWS Cloud Practitioner"],
    org: ["Issued by", "e.g. CBSE, American Heart Association"],
    link: "Certificate link",
    singleDate: true,
    credential: true,
  },
  volunteer: { title: ["Role", "e.g. Volunteer teacher"], org: ["Organisation", "e.g. NSS"] },
  achievement: {
    title: ["Award or achievement", "e.g. Best Teacher Award"],
    org: ["Given by", "e.g. Rotary Club of Kolkata"],
    link: "Link (optional)",
    singleDate: true,
  },
  other: { title: ["Title", "e.g. Paper presented at…"], org: ["Where or with whom", ""], link: "Link (optional)" },
};

export function EntryForm({
  kind,
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  kind: EntryKind;
  initial: Partial<Entry>;
  submitLabel: string;
  onSubmit: (patch: Patch) => void | Promise<void>;
  onCancel: () => void;
}) {
  const copy = COPY[kind];
  const [title, setTitle] = React.useState(initial.title ?? "");
  const [org, setOrg] = React.useState(initial.org ?? "");
  const [place, setPlace] = React.useState(initial.place ?? "");
  const [start, setStart] = React.useState(initial.start ?? "");
  const [end, setEnd] = React.useState(initial.end ?? "");
  const [current, setCurrent] = React.useState(initial.current ?? false);
  const [grade, setGrade] = React.useState(initial.grade ?? "");
  const [link, setLink] = React.useState(initial.link ?? "");
  const [credentialId, setCredentialId] = React.useState(initial.credentialId ?? "");
  const [touched, setTouched] = React.useState(false);

  const errors = {
    title: !title.trim() ? "Add a title." : null,
    start: start && !YEAR_MONTH.test(start) ? "Use YYYY or YYYY-MM, e.g. 2023-06." : null,
    end: !current && end && !YEAR_MONTH.test(end) ? "Use YYYY or YYYY-MM." : null,
    link: link.trim() && !normaliseUrl(link) ? "This doesn't look like a web address." : null,
  };
  const valid = !errors.title && !errors.start && !errors.end && !errors.link;

  const submit = () => {
    setTouched(true);
    if (!valid) return;
    const url = normaliseUrl(link);
    void onSubmit({
      title: title.trim(),
      current: copy.singleDate ? false : current,
      org: org.trim() || undefined,
      place: place.trim() || undefined,
      start: start || undefined,
      end: copy.singleDate || current ? undefined : end || undefined,
      grade: copy.grade ? grade.trim() || undefined : undefined,
      link: copy.link && url ? url : undefined,
      credentialId: copy.credential ? credentialId.trim() || undefined : undefined,
    });
  };

  const text = (label: string, value: string, set: (v: string) => void, opts: { placeholder?: string; error?: string | null; max?: number; wide?: boolean } = {}) => (
    <label className={`flex flex-col gap-1.5 text-sm font-semibold text-white/80 ${opts.wide ? "sm:col-span-2" : ""}`}>
      {label}
      <Input
        value={value}
        onChange={(e) => set(e.target.value)}
        placeholder={opts.placeholder}
        maxLength={opts.max ?? 160}
        className="h-10"
        aria-invalid={touched && Boolean(opts.error)}
      />
      {touched && opts.error && <span className="text-[13px] font-medium text-amber-300">{opts.error}</span>}
    </label>
  );

  return (
    <div className="mt-3 grid gap-3 rounded-lg border border-white/[0.08] bg-white/[0.02] p-4 sm:grid-cols-2">
      {copy.presets && (
        <div className="flex flex-wrap gap-2 sm:col-span-2" role="group" aria-label="Common choices">
          {copy.presets.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setTitle(p)}
              aria-pressed={title === p}
              className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-sm font-semibold text-white/75 hover:text-white aria-pressed:border-primary/50 aria-pressed:bg-primary/15 aria-pressed:text-white"
            >
              {p}
            </button>
          ))}
        </div>
      )}
      {text(copy.title[0], title, setTitle, { placeholder: copy.title[1], error: errors.title })}
      {text(copy.org[0], org, setOrg, { placeholder: copy.org[1] })}
      {text("Place", place, setPlace, { placeholder: "City", max: 120 })}

      {copy.singleDate ? (
        <label className="flex flex-col gap-1.5 text-sm font-semibold text-white/80">
          Year or month
          <Input value={start} onChange={(e) => setStart(e.target.value)} placeholder="2024 or 2024-03" className="h-10" aria-invalid={touched && Boolean(errors.start)} />
          {touched && errors.start && <span className="text-[13px] font-medium text-amber-300">{errors.start}</span>}
        </label>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1.5 text-sm font-semibold text-white/80">
            From
            <Input value={start} onChange={(e) => setStart(e.target.value)} placeholder="2023-06" className="h-10" aria-invalid={touched && Boolean(errors.start)} />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-semibold text-white/80">
            To
            <Input
              value={current ? "" : end}
              onChange={(e) => setEnd(e.target.value)}
              placeholder={current ? "Present" : "2024"}
              disabled={current}
              className="h-10"
              aria-invalid={touched && Boolean(errors.end)}
            />
          </label>
          {touched && (errors.start || errors.end) && (
            <span className="col-span-2 text-[13px] font-medium text-amber-300">{errors.start ?? errors.end}</span>
          )}
        </div>
      )}

      {copy.grade && text("Grade (optional)", grade, setGrade, { placeholder: "e.g. 8.6 CGPA or 87%", max: 30 })}
      {copy.credential && text("Credential or registration no. (optional)", credentialId, setCredentialId, { placeholder: "e.g. KNC-12345", max: 60 })}
      {copy.link && text(copy.link, link, setLink, { placeholder: "e.g. github.com/you/project", error: errors.link, max: 300, wide: true })}

      {!copy.singleDate && (
        <label className="flex items-center gap-2.5 text-sm font-medium text-white/80 sm:col-span-2">
          <input type="checkbox" checked={current} onChange={(e) => setCurrent(e.target.checked)} className="size-4 accent-[#dc3019]" />
          {kind === "education" ? "I'm still studying here" : "I'm still here"}
        </label>
      )}
      <div className="flex gap-2 sm:col-span-2">
        <Button type="button" onClick={submit}>
          {submitLabel}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

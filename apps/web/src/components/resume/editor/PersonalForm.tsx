"use client";

import * as React from "react";
import { LoaderCircle, ShieldCheck } from "lucide-react";
import type { CareerProfile, PersonalDetails } from "@dossier/core/resume";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const FIELDS: { key: keyof PersonalDetails; label: string; type?: string; placeholder?: string; options?: string[] }[] = [
  { key: "dateOfBirth", label: "Date of birth", type: "date" },
  { key: "gender", label: "Gender", options: ["Female", "Male", "Other"] },
  { key: "nationality", label: "Nationality", placeholder: "e.g. Indian" },
  { key: "maritalStatus", label: "Marital status", options: ["Single", "Married"] },
  { key: "fatherName", label: "Father's name", placeholder: "Only if the job asks for it" },
];

export function PersonalForm({
  profile,
  onSave,
}: {
  profile: CareerProfile;
  onSave: (profile: CareerProfile) => Promise<void>;
}) {
  const [values, setValues] = React.useState<PersonalDetails>(profile.personal ?? {});
  const [saving, setSaving] = React.useState(false);
  const dirty = JSON.stringify(values) !== JSON.stringify(profile.personal ?? {});

  const save = async () => {
    setSaving(true);
    try {
      const personal = Object.fromEntries(
        Object.entries(values).filter(([, v]) => typeof v === "string" && v.trim()),
      ) as PersonalDetails;
      await onSave({ ...profile, personal });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="flex items-start gap-2 text-sm leading-relaxed text-white/65">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-400" aria-hidden />
        Never sent to the AI. Schools and government jobs in India often ask for these; private companies and jobs
        abroad usually don&apos;t — hide this section for those. Fill only what you&apos;re comfortable sharing.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {FIELDS.map((f) => (
          <label key={f.key} className="flex flex-col gap-1.5 text-sm font-semibold text-white/80">
            {f.label}
            {f.options ? (
              <select
                value={values[f.key] ?? ""}
                onChange={(e) => setValues({ ...values, [f.key]: e.target.value || undefined })}
                className="h-10 rounded-lg border border-input bg-transparent px-3 text-sm font-medium text-white outline-none focus-visible:ring-3 focus-visible:ring-ring/50 [&>option]:bg-[#141414]"
              >
                <option value="">Leave out</option>
                {f.options.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            ) : (
              <Input
                type={f.type ?? "text"}
                value={values[f.key] ?? ""}
                onChange={(e) => setValues({ ...values, [f.key]: e.target.value || undefined })}
                placeholder={f.placeholder}
                maxLength={f.key === "fatherName" ? 120 : 40}
                className="h-10"
              />
            )}
          </label>
        ))}
      </div>
      <Button type="button" className="self-start" onClick={() => void save()} disabled={!dirty || saving}>
        {saving && <LoaderCircle className="size-4 animate-spin" />}
        Save details
      </Button>
    </div>
  );
}

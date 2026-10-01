"use client";

import * as React from "react";
import { ChevronDown, LoaderCircle, UserRound } from "lucide-react";
import type { CareerProfile, Contact } from "@dossier/core/resume";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { contactErrors, normaliseUrl } from "@/lib/resume/contact";

export function DetailsCard({
  profile,
  onSave,
}: {
  profile: CareerProfile;
  onSave: (profile: CareerProfile) => Promise<void>;
}) {
  const [open, setOpen] = React.useState(false);
  const [contact, setContact] = React.useState<Contact>(profile.contact);
  const [link, setLink] = React.useState(profile.contact.links[0]?.url ?? "");
  const [touched, setTouched] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const errors = contactErrors(contact, link);

  const save = async () => {
    setTouched(true);
    if (Object.keys(errors).length) return;
    const url = normaliseUrl(link);
    setSaving(true);
    try {
      await onSave({
        ...profile,
        contact: {
          ...contact,
          name: contact.name.trim(),
          links: url ? [{ label: profile.contact.links[0]?.label ?? "Website", url }] : [],
        },
      });
      setOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const fields: [keyof Contact, string, string][] = [
    ["name", "Full name", "name"],
    ["email", "Email", "email"],
    ["phone", "Phone", "tel"],
    ["location", "City", "address-level2"],
  ];

  return (
    <section className="rounded-lg border border-white/[0.08] bg-[#111111] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
      <button
        type="button"
        onClick={() => {
          if (!open) {
            setContact(profile.contact);
            setLink(profile.contact.links[0]?.url ?? "");
            setTouched(false);
          }
          setOpen(!open);
        }}
        aria-expanded={open}
        className="flex w-full items-center gap-3 text-left"
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-[#ff7a5c] ring-1 ring-primary/25">
          <UserRound className="size-[18px]" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-base font-semibold text-white">{profile.contact.name}</span>
          <span className="block truncate text-sm font-medium text-white/55">
            {[profile.contact.email, profile.contact.phone, profile.contact.location].filter(Boolean).join(" · ") ||
              "Add your contact details"}
          </span>
        </span>
        <ChevronDown className={`size-4 text-white/60 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>

      {open && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {fields.map(([key, label, autoComplete]) => {
            const error = touched ? errors[key as keyof typeof errors] : undefined;
            return (
              <label key={key} className="flex flex-col gap-1.5 text-sm font-semibold text-white/80">
                {label}
                <Input
                  value={(contact[key] as string | undefined) ?? ""}
                  autoComplete={autoComplete}
                  onChange={(e) => setContact({ ...contact, [key]: e.target.value || (key === "name" ? "" : undefined) })}
                  aria-invalid={Boolean(error)}
                  className="h-10"
                />
                {error && <span className="text-[13px] font-medium text-amber-300">{error}</span>}
              </label>
            );
          })}
          <label className="flex flex-col gap-1.5 text-sm font-semibold text-white/80 sm:col-span-2">
            Link
            <Input value={link} onChange={(e) => setLink(e.target.value)} className="h-10" aria-invalid={touched && Boolean(errors.link)} />
            {touched && errors.link && <span className="text-[13px] font-medium text-amber-300">{errors.link}</span>}
          </label>
          <p className="text-[13px] font-medium text-white/50 sm:col-span-2">Printed on your resume, never sent to the AI.</p>
          <div className="flex gap-2 sm:col-span-2">
            <Button type="button" onClick={() => void save()} disabled={saving}>
              {saving && <LoaderCircle className="size-4 animate-spin" />}
              Save details
            </Button>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

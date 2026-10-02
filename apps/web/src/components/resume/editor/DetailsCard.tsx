"use client";

import * as React from "react";
import { ChevronDown, LoaderCircle, Plus, UserRound, X } from "lucide-react";
import type { CareerProfile, Contact } from "@dossier/core/resume";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { contactErrors, linkLabel, normaliseUrl } from "@/lib/resume/contact";

const MAX_LINKS = 5;

export function DetailsCard({
  profile,
  onSave,
}: {
  profile: CareerProfile;
  onSave: (profile: CareerProfile) => Promise<void>;
}) {
  const [open, setOpen] = React.useState(false);
  const [contact, setContact] = React.useState<Contact>(profile.contact);
  const initialLinks = () => (profile.contact.links.length ? profile.contact.links.map((l) => l.url) : [""]);
  const [links, setLinks] = React.useState<string[]>(initialLinks);
  const [touched, setTouched] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const errors = contactErrors(contact, "");
  const linkErrors = links.map((l) => (l.trim() && !normaliseUrl(l) ? "This doesn't look like a web address." : null));

  const save = async () => {
    setTouched(true);
    if (Object.keys(errors).length || linkErrors.some(Boolean)) return;
    const urls = [...new Set(links.map(normaliseUrl).filter((u): u is string => Boolean(u)))];
    setSaving(true);
    try {
      await onSave({
        ...profile,
        contact: {
          ...contact,
          name: contact.name.trim(),
          links: urls.map((url) => ({ label: linkLabel(url), url })),
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
            setLinks(initialLinks());
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
          <fieldset className="flex flex-col gap-2 sm:col-span-2">
            <legend className="mb-1.5 text-sm font-semibold text-white/80">Links (LinkedIn, GitHub, portfolio…)</legend>
            {links.map((l, i) => (
              <div key={i} className="flex flex-col gap-1">
                <div className="flex gap-2">
                  <Input
                    value={l}
                    onChange={(e) => setLinks(links.map((x, j) => (j === i ? e.target.value : x)))}
                    placeholder={i === 0 ? "linkedin.com/in/you" : "github.com/you"}
                    aria-label={`Link ${i + 1}`}
                    className="h-10"
                    aria-invalid={touched && Boolean(linkErrors[i])}
                  />
                  {links.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove link ${i + 1}`}
                      onClick={() => setLinks(links.filter((_, j) => j !== i))}
                    >
                      <X className="size-4" />
                    </Button>
                  )}
                </div>
                {touched && linkErrors[i] && <span className="text-[13px] font-medium text-amber-300">{linkErrors[i]}</span>}
              </div>
            ))}
            {links.length < MAX_LINKS && (
              <Button type="button" variant="ghost" size="sm" className="self-start text-white/70" onClick={() => setLinks([...links, ""])}>
                <Plus className="size-3.5" />
                Add another link
              </Button>
            )}
          </fieldset>
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

"use client";

import * as React from "react";
import { ShieldCheck } from "lucide-react";
import type { Contact } from "@dossier/core/resume";
import { contactErrors } from "@/lib/resume/contact";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CardTitle, DoneSummary, cardClass } from "./Thread";

export function ContactCard({
  contact,
  onChange,
  link,
  onLinkChange,
  done,
  onSubmit,
  onEdit,
  example,
  found = null,
}: {
  contact: Contact;
  onChange: (contact: Contact) => void;
  link: string;
  onLinkChange: (link: string) => void;
  done: boolean;
  onSubmit: () => void;
  onEdit: () => void;
  example?: Contact;
  // Where the prefilled details came from: shown as a one-tap check instead of a form.
  found?: "text" | "profile" | null;
}) {
  const [touched, setTouched] = React.useState(false);
  const [editing, setEditing] = React.useState(false);
  const errors = contactErrors(contact, link);
  const set = (patch: Partial<Contact>) => onChange({ ...contact, ...patch });

  if (done) {
    return (
      <DoneSummary
        onChange={() => {
          setEditing(true);
          onEdit();
        }}
      >
        {[contact.name, contact.email, contact.phone].filter(Boolean).join(" · ")}
      </DoneSummary>
    );
  }

  if (found && !editing && Object.keys(errors).length === 0) {
    const rows = [
      ["Name", contact.name],
      ["Email", contact.email],
      ["Phone", contact.phone],
      ["City", contact.location],
      ["Link", link],
    ].filter((r): r is [string, string] => Boolean(r[1]));
    return (
      <div className={cardClass}>
        <CardTitle
          title={found === "profile" ? "Your details from last time" : "I found your details"}
          note={
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="size-4 shrink-0 text-emerald-400" aria-hidden />
              Printed on your resume. Never sent to the AI.
            </span>
          }
        />
        <dl className="grid gap-x-6 gap-y-3 rounded-lg border border-white/[0.08] bg-white/[0.02] p-4 sm:grid-cols-2">
          {rows.map(([label, value]) => (
            <div key={label} className="min-w-0">
              <dt className="text-[13px] font-semibold text-white/55">{label}</dt>
              <dd className="mt-0.5 truncate text-[15px] font-medium text-white">{value}</dd>
            </div>
          ))}
        </dl>
        {(!contact.location || !link) && (
          <p className="mt-3 text-sm text-white/60">
            No {[!contact.location && "city", !link && "link"].filter(Boolean).join(" or ")} yet. Choose Edit if you want
            to add {!contact.location && !link ? "them" : "it"}.
          </p>
        )}
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <Button type="button" onClick={onSubmit}>
            Looks right
          </Button>
          <Button type="button" variant="outline" onClick={() => setEditing(true)}>
            Edit
          </Button>
        </div>
      </div>
    );
  }

  const fields = [
    { key: "name", label: "Full name *", value: contact.name, type: "text", auto: "name", set: (v: string) => set({ name: v }) },
    { key: "email", label: "Email", value: contact.email ?? "", type: "email", auto: "email", set: (v: string) => set({ email: v || undefined }) },
    { key: "phone", label: "Phone", value: contact.phone ?? "", type: "tel", auto: "tel", set: (v: string) => set({ phone: v || undefined }) },
    { key: "location", label: "City", value: contact.location ?? "", type: "text", auto: "address-level2", set: (v: string) => set({ location: v || undefined }) },
  ] as const;

  return (
    <form
      className={cardClass}
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        setTouched(true);
        if (Object.keys(errors).length === 0) onSubmit();
      }}
    >
      <CardTitle
        title="Your contact details"
        note={
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="size-4 shrink-0 text-emerald-400" aria-hidden />
            Printed on your resume. Never sent to the AI.
          </span>
        }
      />
      <div className="grid gap-3 sm:grid-cols-2">
        {fields.map((f) => {
          const error = touched ? errors[f.key as keyof typeof errors] : undefined;
          return (
            <label key={f.key} className="flex flex-col gap-1.5 text-sm font-semibold text-white/80">
              {f.label}
              <Input
                type={f.type}
                autoComplete={f.auto}
                value={f.value}
                onChange={(e) => f.set(e.target.value)}
                aria-invalid={Boolean(error)}
                className="h-11"
              />
              {error && <span className="text-[13px] font-medium text-amber-300">{error}</span>}
            </label>
          );
        })}
        <label className="flex flex-col gap-1.5 text-sm font-semibold text-white/80 sm:col-span-2">
          A link, if you have one
          <Input
            value={link}
            onChange={(e) => onLinkChange(e.target.value)}
            placeholder="LinkedIn, portfolio or GitHub"
            aria-invalid={touched && Boolean(errors.link)}
            className="h-11"
          />
          {touched && errors.link && <span className="text-[13px] font-medium text-amber-300">{errors.link}</span>}
        </label>
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <Button type="submit">Continue</Button>
        {example && (
          <Button
            type="button"
            variant="ghost"
            className="text-white/70"
            onClick={() => {
              onChange(example);
              onLinkChange(example.links[0]?.url ?? "");
            }}
          >
            Fill example details
          </Button>
        )}
      </div>
    </form>
  );
}

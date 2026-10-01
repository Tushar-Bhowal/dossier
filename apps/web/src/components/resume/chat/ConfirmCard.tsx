"use client";

import * as React from "react";
import { Hammer, Pencil, Plus, Trash2, X } from "lucide-react";
import { formatDateRange, type CareerProfile, type Entry, type Fact } from "@dossier/core/resume";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CardTitle, DoneSummary, cardClass } from "./Thread";

const SOURCE_LABEL: Record<Fact["source"], string> = {
  describe: "From what you wrote",
  answer: "From your answer",
  duty: "You ticked this",
  upload: "From your old resume",
  manual: "Added by you",
};

const KIND_LABEL: Record<Entry["kind"], string> = {
  job: "Work",
  education: "Education",
  project: "Project",
  certification: "Certification",
  volunteer: "Volunteering",
};

function FactRow({ fact, onChange, onDelete }: { fact: Fact; onChange: (text: string) => void; onDelete: () => void }) {
  const [editing, setEditing] = React.useState(fact.text === "");
  const [value, setValue] = React.useState(fact.text);
  const showOriginal = fact.originalText && fact.originalText.trim() !== fact.text.trim();

  const save = () => {
    if (!value.trim()) return;
    onChange(value.trim());
    setEditing(false);
  };

  if (editing) {
    return (
      <li className="flex items-center gap-2 py-1.5">
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.nativeEvent.isComposing) {
              e.preventDefault();
              save();
            }
            if (e.key === "Escape" && fact.text) {
              setValue(fact.text);
              setEditing(false);
            }
          }}
          aria-label="Edit this fact"
          placeholder="Something true about your work, e.g. Ran the school science club"
          maxLength={400}
          autoFocus
          className="h-11"
        />
        <Button type="button" size="sm" onClick={save} disabled={!value.trim()}>
          Save
        </Button>
        <Button type="button" variant="ghost" size="icon-sm" onClick={onDelete} aria-label="Remove this fact">
          <Trash2 className="size-4 text-white/60" />
        </Button>
      </li>
    );
  }

  return (
    <li className="group flex items-start gap-3 rounded-lg py-2">
      <span className="mt-[9px] size-1.5 shrink-0 rounded-full bg-[#ff7a5c]" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-[15px] leading-relaxed text-white">{fact.text}</p>
        <p className="mt-0.5 text-[13px] font-medium text-white/45">
          {SOURCE_LABEL[fact.source]}
          {showOriginal && <span className="text-white/50"> — you said “{fact.originalText}”</span>}
        </p>
      </div>
      <div className="flex shrink-0 gap-0.5 opacity-70 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
        <Button type="button" variant="ghost" size="icon-sm" onClick={() => setEditing(true)} aria-label={`Edit: ${fact.text}`}>
          <Pencil className="size-3.5" />
        </Button>
        <Button type="button" variant="ghost" size="icon-sm" onClick={onDelete} aria-label={`Remove: ${fact.text}`}>
          <Trash2 className="size-3.5" />
        </Button>
      </div>
    </li>
  );
}

function EntryHeader({ entry, onChange }: { entry: Entry; onChange: (patch: Partial<Entry>) => void }) {
  const [editing, setEditing] = React.useState(false);
  const [title, setTitle] = React.useState(entry.title);
  const [org, setOrg] = React.useState(entry.org ?? "");

  if (editing) {
    return (
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Title" className="h-10 font-semibold" autoFocus />
        <Input value={org} onChange={(e) => setOrg(e.target.value)} aria-label="Organisation" placeholder="Organisation" className="h-10" />
        <Button
          type="button"
          size="sm"
          className="h-10"
          disabled={!title.trim()}
          onClick={() => {
            onChange({ title: title.trim(), org: org.trim() || undefined });
            setEditing(false);
          }}
        >
          Save
        </Button>
      </div>
    );
  }

  return (
    <div className="group flex items-start gap-3">
      <div className="min-w-0 flex-1">
        <p className="text-base font-semibold text-white">
          {entry.title}
          {entry.org && <span className="font-medium text-white/65"> · {entry.org}</span>}
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-2 text-[13px] font-semibold text-white/45">
          <span className="uppercase tracking-[0.06em]">{KIND_LABEL[entry.kind]}</span>
          {formatDateRange(entry) && <span>· {formatDateRange(entry)}</span>}
        </p>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="text-white/60"
        onClick={() => {
          setTitle(entry.title);
          setOrg(entry.org ?? "");
          setEditing(true);
        }}
      >
        <Pencil className="size-3.5" />
        Edit
      </Button>
    </div>
  );
}

function ChipList({
  label,
  items,
  onRemove,
  onAdd,
}: {
  label: string;
  items: string[];
  onRemove: (item: string) => void;
  onAdd: (item: string) => void;
}) {
  const [draft, setDraft] = React.useState("");
  const add = () => {
    const value = draft.trim();
    if (value && !items.some((i) => i.toLowerCase() === value.toLowerCase())) onAdd(value);
    setDraft("");
  };
  return (
    <section className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4">
      <h3 className="text-[15px] font-semibold text-white">{label}</h3>
      <ul className="mt-2.5 flex flex-wrap gap-2">
        {items.map((item) => (
          <li key={item}>
            <span className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] pl-3 pr-1.5 text-sm font-semibold text-white/85">
              {item}
              <button
                type="button"
                onClick={() => onRemove(item)}
                aria-label={`Remove ${item}`}
                className="flex size-6 items-center justify-center rounded-md text-white/50 hover:bg-white/10 hover:text-white"
              >
                <X className="size-3.5" />
              </button>
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-2.5 flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.nativeEvent.isComposing) {
              e.preventDefault();
              add();
            }
          }}
          placeholder={`Add to ${label.toLowerCase()}`}
          aria-label={`Add to ${label.toLowerCase()}`}
          maxLength={60}
          className="h-10"
        />
        <Button type="button" variant="outline" onClick={add}>
          Add
        </Button>
      </div>
    </section>
  );
}

export function ConfirmCard({
  profile,
  onChange,
  done,
  onBuild,
}: {
  profile: CareerProfile;
  onChange: (profile: CareerProfile) => void;
  done: boolean;
  onBuild: () => void;
}) {
  if (done) {
    return <DoneSummary>You confirmed {profile.facts.length} facts about yourself</DoneSummary>;
  }

  const setFacts = (fn: (facts: Fact[]) => Fact[]) => onChange({ ...profile, facts: fn(profile.facts) });
  const setEntry = (id: string, patch: Partial<Entry>) =>
    onChange({ ...profile, entries: profile.entries.map((e) => (e.id === id ? { ...e, ...patch } : e)) });

  const groups: { entry: Entry | null; facts: Fact[] }[] = [
    ...profile.entries.map((entry) => ({ entry, facts: profile.facts.filter((f) => f.entryId === entry.id) })),
    { entry: null, facts: profile.facts.filter((f) => f.entryId === null) },
  ];
  const hasEmptyFact = profile.facts.some((f) => !f.text.trim());

  return (
    <div className={cardClass}>
      <CardTitle
        title="Here's what I understood"
        note="Only what's here goes on your resume. Fix anything I got wrong and remove anything that isn't true."
      />

      <div className="flex flex-col gap-3">
        {groups.map(({ entry, facts }) => {
          if (!entry && facts.length === 0) return null;
          return (
            <section key={entry?.id ?? "general"} className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4">
              {entry ? (
                <EntryHeader entry={entry} onChange={(patch) => setEntry(entry.id, patch)} />
              ) : (
                <h3 className="text-[15px] font-semibold text-white">Other things about you</h3>
              )}

              {facts.length > 0 && (
                <ul className="mt-2 flex flex-col">
                  {facts.map((fact) => (
                    <FactRow
                      key={fact.id}
                      fact={fact}
                      onChange={(text) => setFacts((all) => all.map((f) => (f.id === fact.id ? { ...f, text } : f)))}
                      onDelete={() => setFacts((all) => all.filter((f) => f.id !== fact.id))}
                    />
                  ))}
                </ul>
              )}

              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mt-1 -ml-2 text-white/60"
                onClick={() =>
                  setFacts((all) => [
                    ...all,
                    { id: `fm-${crypto.randomUUID().slice(0, 8)}`, entryId: entry?.id ?? null, text: "", source: "manual" },
                  ])
                }
              >
                <Plus className="size-3.5" />
                Add something I missed
              </Button>
            </section>
          );
        })}

        <ChipList
          label="Skills"
          items={profile.skills.map((s) => s.name)}
          onRemove={(name) => onChange({ ...profile, skills: profile.skills.filter((s) => s.name !== name) })}
          onAdd={(name) => onChange({ ...profile, skills: [...profile.skills, { name, source: "fact" }] })}
        />
        <ChipList
          label="Languages"
          items={profile.languages}
          onRemove={(l) => onChange({ ...profile, languages: profile.languages.filter((x) => x !== l) })}
          onAdd={(l) => onChange({ ...profile, languages: [...profile.languages, l] })}
        />
      </div>

      {hasEmptyFact && <p className="mt-3 text-sm font-medium text-amber-300">Fill in or remove the empty lines first.</p>}

      <Button size="lg" className="mt-5" onClick={onBuild} disabled={hasEmptyFact}>
        <Hammer className="size-4" />
        Build my resume
      </Button>
    </div>
  );
}

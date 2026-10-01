"use client";

import * as React from "react";
import {
  ArrowDown,
  ArrowUp,
  Eye,
  EyeOff,
  Lightbulb,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import {
  formatDateRange,
  type Bullet,
  type CareerProfile,
  type Entry,
  type EntryKind,
  type EntrySectionKind,
  type LintHint,
  type Resume,
  type Section,
} from "@dossier/core/resume";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { PhotoControl } from "./PhotoControl";
import { DetailsCard } from "./DetailsCard";

type Edit = (fn: (r: Resume) => Resume) => void;

const ENTRY_KIND_FOR: Record<EntrySectionKind, EntryKind> = {
  experience: "job",
  education: "education",
  projects: "project",
  certifications: "certification",
  volunteer: "volunteer",
};

const ADD_LABEL: Record<EntrySectionKind, string> = {
  experience: "Add a job",
  education: "Add education",
  projects: "Add a project",
  certifications: "Add a certification",
  volunteer: "Add volunteering",
};

const YEAR_MONTH = /^\d{4}(-(0[1-9]|1[0-2]))?$/;

function updateSection(resume: Resume, id: string, fn: (s: Section) => Section): Resume {
  return { ...resume, sections: resume.sections.map((s) => (s.id === id ? fn(s) : s)) };
}

function updateBullets(resume: Resume, sectionId: string, entryId: string, fn: (b: Bullet[]) => Bullet[]): Resume {
  return updateSection(resume, sectionId, (s) =>
    "items" in s ? { ...s, items: s.items.map((i) => (i.entryId === entryId ? { ...i, bullets: fn(i.bullets) } : i)) } : s,
  );
}

function move<T>(list: T[], index: number, delta: number): T[] {
  const target = index + delta;
  if (target < 0 || target >= list.length) return list;
  const next = [...list];
  [next[index], next[target]] = [next[target]!, next[index]!];
  return next;
}

function Hints({ hints }: { hints: LintHint[] | undefined }) {
  if (!hints?.length) return null;
  return (
    <ul className="mt-1.5 flex flex-col gap-1">
      {hints.map((h) => (
        <li key={h.rule} className="flex items-start gap-1.5 text-[13px] font-medium leading-snug text-amber-200/90">
          <Lightbulb className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          {h.message}
        </li>
      ))}
    </ul>
  );
}

function BulletRow({
  bullet,
  index,
  count,
  hints,
  onChange,
  onMove,
  onDelete,
}: {
  bullet: Bullet;
  index: number;
  count: number;
  hints: LintHint[] | undefined;
  onChange: (text: string) => void;
  onMove: (delta: number) => void;
  onDelete: () => void;
}) {
  return (
    <li id={`bullet-${bullet.id}`} className="group/bullet scroll-mt-24">
      <div className="flex items-start gap-2">
        <span className="mt-3 size-1.5 shrink-0 rounded-full bg-white/40" aria-hidden />
        <Textarea
          value={bullet.text}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => {
            if (!bullet.text.trim()) onDelete();
          }}
          aria-label={`Line ${index + 1}`}
          autoFocus={bullet.origin === "user" && bullet.text === ""}
          maxLength={300}
          rows={1}
          className="min-h-10 resize-none py-2 text-[15px] leading-relaxed md:text-[15px]"
        />
        <div className="flex shrink-0 flex-col gap-0.5 sm:flex-row">
          <Button type="button" variant="ghost" size="icon-sm" onClick={() => onMove(-1)} disabled={index === 0} aria-label="Move line up">
            <ArrowUp className="size-4" />
          </Button>
          <Button type="button" variant="ghost" size="icon-sm" onClick={() => onMove(1)} disabled={index === count - 1} aria-label="Move line down">
            <ArrowDown className="size-4" />
          </Button>
          <Button type="button" variant="ghost" size="icon-sm" onClick={onDelete} aria-label="Delete line">
            <Trash2 className="size-4 text-white/60" />
          </Button>
        </div>
      </div>
      <div className="pl-3.5">
        {bullet.origin === "fallback" && (
          <Badge variant="outline" className="mt-1.5 border-sky-500/30 bg-sky-500/10 text-sky-200">
            Kept in your words
          </Badge>
        )}
        <Hints hints={hints} />
      </div>
    </li>
  );
}

function EntryForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial: Partial<Entry>;
  submitLabel: string;
  onSubmit: (patch: Pick<Entry, "title" | "current"> & Partial<Entry>) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = React.useState(initial.title ?? "");
  const [org, setOrg] = React.useState(initial.org ?? "");
  const [place, setPlace] = React.useState(initial.place ?? "");
  const [start, setStart] = React.useState(initial.start ?? "");
  const [end, setEnd] = React.useState(initial.end ?? "");
  const [current, setCurrent] = React.useState(initial.current ?? false);
  const [touched, setTouched] = React.useState(false);

  const errors = {
    title: !title.trim() ? "Add a title." : null,
    start: start && !YEAR_MONTH.test(start) ? "Use YYYY or YYYY-MM, e.g. 2023-06." : null,
    end: !current && end && !YEAR_MONTH.test(end) ? "Use YYYY or YYYY-MM." : null,
  };
  const valid = !errors.title && !errors.start && !errors.end;

  return (
    <div className="mt-3 grid gap-3 rounded-lg border border-white/[0.08] bg-white/[0.02] p-4 sm:grid-cols-2">
      {(
        [
          ["Title", title, setTitle, errors.title, "e.g. Mathematics Teacher"],
          ["Organisation", org, setOrg, null, "e.g. St. Mary's School"],
          ["Place", place, setPlace, null, "City"],
        ] as const
      ).map(([label, value, set, error, placeholder]) => (
        <label key={label} className="flex flex-col gap-1.5 text-sm font-semibold text-white/80">
          {label}
          <Input value={value} onChange={(e) => set(e.target.value)} placeholder={placeholder} className="h-10" aria-invalid={touched && Boolean(error)} />
          {touched && error && <span className="text-[13px] font-medium text-amber-300">{error}</span>}
        </label>
      ))}
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1.5 text-sm font-semibold text-white/80">
          From
          <Input value={start} onChange={(e) => setStart(e.target.value)} placeholder="2023-06" className="h-10" aria-invalid={touched && Boolean(errors.start)} />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-semibold text-white/80">
          To
          <Input value={current ? "" : end} onChange={(e) => setEnd(e.target.value)} placeholder={current ? "Present" : "2024"} disabled={current} className="h-10" aria-invalid={touched && Boolean(errors.end)} />
        </label>
        {touched && (errors.start || errors.end) && (
          <span className="col-span-2 text-[13px] font-medium text-amber-300">{errors.start ?? errors.end}</span>
        )}
      </div>
      <label className="flex items-center gap-2.5 text-sm font-medium text-white/80 sm:col-span-2">
        <input type="checkbox" checked={current} onChange={(e) => setCurrent(e.target.checked)} className="size-4 accent-[#dc3019]" />
        I&apos;m still here
      </label>
      <div className="flex gap-2 sm:col-span-2">
        <Button
          type="button"
          onClick={() => {
            setTouched(true);
            if (!valid) return;
            onSubmit({
              title: title.trim(),
              current,
              org: org.trim() || undefined,
              place: place.trim() || undefined,
              start: start || undefined,
              end: current ? undefined : end || undefined,
            });
          }}
        >
          {submitLabel}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function SectionCard({
  section,
  index,
  count,
  edit,
  children,
}: {
  section: Section;
  index: number;
  count: number;
  edit: Edit;
  children: React.ReactNode;
}) {
  const setTitle = (title: string) => edit((r) => updateSection(r, section.id, (s) => ({ ...s, title })));
  return (
    <section
      className={cn(
        "rounded-lg border border-white/[0.08] bg-[#111111] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]",
        section.hidden && "opacity-60",
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={section.title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => {
            if (!section.title.trim()) setTitle("Section");
          }}
          maxLength={40}
          aria-label="Section heading"
          className="h-10 max-w-[260px] flex-1 border-transparent bg-transparent px-2 text-[17px] font-semibold text-white hover:border-white/10 md:text-[17px]"
        />
        <div className="ml-auto flex items-center gap-0.5">
          <Button type="button" variant="ghost" size="icon-sm" disabled={index === 0} aria-label="Move section up" onClick={() => edit((r) => ({ ...r, sections: move(r.sections, index, -1) }))}>
            <ArrowUp className="size-4" />
          </Button>
          <Button type="button" variant="ghost" size="icon-sm" disabled={index === count - 1} aria-label="Move section down" onClick={() => edit((r) => ({ ...r, sections: move(r.sections, index, 1) }))}>
            <ArrowDown className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => edit((r) => updateSection(r, section.id, (s) => ({ ...s, hidden: !s.hidden })))}
            aria-pressed={section.hidden}
          >
            {section.hidden ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            {section.hidden ? "Hidden" : "Shown"}
          </Button>
        </div>
      </div>
      {section.hidden && <p className="mt-1 px-2 text-[13px] font-medium text-white/55">Hidden from your resume.</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

function ChipEditor({
  items,
  marked,
  onChange,
  label,
}: {
  items: string[];
  marked?: Set<string>;
  onChange: (items: string[]) => void;
  label: string;
}) {
  const [draft, setDraft] = React.useState("");
  const add = () => {
    const v = draft.trim();
    if (v && !items.some((i) => i.toLowerCase() === v.toLowerCase())) onChange([...items, v]);
    setDraft("");
  };
  return (
    <div>
      <ul className="flex flex-wrap gap-2">
        {items.map((item) => {
          const isMarked = marked?.has(item.toLowerCase());
          return (
            <li key={item}>
              <span
                className={cn(
                  "inline-flex h-9 items-center gap-1.5 rounded-lg border pl-3 pr-1.5 text-sm font-semibold",
                  isMarked ? "border-amber-500/35 bg-amber-500/10 text-amber-100" : "border-white/10 bg-white/[0.04] text-white/85",
                )}
                title={isMarked ? "Added by you — be ready to discuss it" : undefined}
              >
                {item}
                {isMarked && <span className="sr-only">(added by you — be ready to discuss it)</span>}
                <button
                  type="button"
                  onClick={() => onChange(items.filter((i) => i !== item))}
                  aria-label={`Remove ${item}`}
                  className="flex size-6 items-center justify-center rounded-md text-white/50 hover:bg-white/10 hover:text-white"
                >
                  <X className="size-3.5" />
                </button>
              </span>
            </li>
          );
        })}
      </ul>
      {marked && items.some((i) => marked.has(i.toLowerCase())) && (
        <p className="mt-2 text-[13px] font-medium text-amber-200/90">
          Highlighted skills were added by you without an example. Be ready to discuss them in an interview.
        </p>
      )}
      <div className="mt-3 flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder={`Add ${label}`}
          aria-label={`Add ${label}`}
          maxLength={60}
          className="h-10"
        />
        <Button type="button" variant="outline" onClick={add}>
          Add
        </Button>
      </div>
    </div>
  );
}

export function ResumeEditor({
  resume,
  profile,
  edit,
  onProfileSave,
  hints,
}: {
  resume: Resume;
  profile: CareerProfile;
  edit: Edit;
  onProfileSave: (profile: CareerProfile) => Promise<void>;
  hints: Map<string, LintHint[]>;
}) {
  const entries = new Map(profile.entries.map((e) => [e.id, e]));
  const [editingEntry, setEditingEntry] = React.useState<string | null>(null);
  const [addingTo, setAddingTo] = React.useState<string | null>(null);
  const selfDeclared = new Set(profile.skills.filter((s) => s.source === "self-declared").map((s) => s.name.toLowerCase()));

  return (
    <div className="flex flex-col gap-4">
      <DetailsCard profile={profile} onSave={onProfileSave} />
      <PhotoControl
        profile={profile}
        showPhoto={resume.showPhoto}
        onToggle={(on) => edit((r) => ({ ...r, showPhoto: on }))}
        onProfileSave={onProfileSave}
      />

      {resume.sections.map((section, index) => (
        <SectionCard key={section.id} section={section} index={index} count={resume.sections.length} edit={edit}>
          {section.kind === "summary" && (
            <>
              <Textarea
                value={section.text}
                onChange={(e) => edit((r) => updateSection(r, section.id, (s) => ({ ...s, text: e.target.value })))}
                maxLength={600}
                aria-label="Summary"
                placeholder="Two or three lines about who you are and what you do."
                className="min-h-24 text-[15px] leading-relaxed md:text-[15px]"
              />
              <Hints hints={hints.get(section.id)} />
            </>
          )}

          {section.kind === "skills" && (
            <ChipEditor
              label="a skill"
              items={section.skills}
              marked={selfDeclared}
              onChange={(skills) => edit((r) => updateSection(r, section.id, (s) => ({ ...s, skills })))}
            />
          )}

          {section.kind === "languages" && (
            <ChipEditor
              label="a language"
              items={section.languages}
              onChange={(languages) => edit((r) => updateSection(r, section.id, (s) => ({ ...s, languages })))}
            />
          )}

          {"items" in section && (
            <div className="flex flex-col gap-5">
              {section.items.map((block) => {
                const entry = entries.get(block.entryId);
                if (!entry) return null;
                const bulleted = section.kind === "experience" || section.kind === "projects" || section.kind === "volunteer";
                return (
                  <div key={block.entryId} className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-base font-semibold text-white">
                          {entry.title}
                          {entry.org && <span className="font-medium text-white/70">, {entry.org}</span>}
                        </p>
                        <p className="text-sm font-medium text-white/50">
                          {[entry.place, formatDateRange(entry)].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                      <div className="flex gap-1">
                        <Button type="button" variant="ghost" size="sm" onClick={() => setEditingEntry(editingEntry === entry.id ? null : entry.id)}>
                          <Pencil className="size-3.5" />
                          Edit details
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Remove ${entry.title} from this resume`}
                          title="Remove from this resume (it stays in your profile)"
                          onClick={() =>
                            edit((r) =>
                              updateSection(r, section.id, (s) =>
                                "items" in s ? { ...s, items: s.items.filter((i) => i.entryId !== block.entryId) } : s,
                              ),
                            )
                          }
                        >
                          <Trash2 className="size-4 text-white/60" />
                        </Button>
                      </div>
                    </div>

                    {editingEntry === entry.id && (
                      <EntryForm
                        initial={entry}
                        submitLabel="Save details"
                        onCancel={() => setEditingEntry(null)}
                        onSubmit={async (patch) => {
                          await onProfileSave({
                            ...profile,
                            entries: profile.entries.map((e) => (e.id === entry.id ? { ...e, ...patch } : e)),
                          });
                          setEditingEntry(null);
                        }}
                      />
                    )}

                    {bulleted && (
                      <>
                        <ul className="mt-3 flex flex-col gap-2.5">
                          {block.bullets.map((bullet, i) => (
                            <BulletRow
                              key={bullet.id}
                              bullet={bullet}
                              index={i}
                              count={block.bullets.length}
                              hints={hints.get(bullet.id)}
                              onChange={(text) =>
                                edit((r) =>
                                  updateBullets(r, section.id, block.entryId, (bs) =>
                                    bs.map((b) => (b.id === bullet.id ? { ...b, text } : b)),
                                  ),
                                )
                              }
                              onMove={(delta) => edit((r) => updateBullets(r, section.id, block.entryId, (bs) => move(bs, i, delta)))}
                              onDelete={() =>
                                edit((r) => updateBullets(r, section.id, block.entryId, (bs) => bs.filter((b) => b.id !== bullet.id)))
                              }
                            />
                          ))}
                        </ul>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="mt-2 text-white/70"
                          onClick={() =>
                            edit((r) =>
                              updateBullets(r, section.id, block.entryId, (bs) => [
                                ...bs,
                                { id: `b-u-${crypto.randomUUID().slice(0, 8)}`, text: "", factIds: [], origin: "user" },
                              ]),
                            )
                          }
                        >
                          <Plus className="size-3.5" />
                          Add a line
                        </Button>
                      </>
                    )}
                  </div>
                );
              })}

              {addingTo === section.id ? (
                <EntryForm
                  initial={{}}
                  submitLabel={ADD_LABEL[section.kind]}
                  onCancel={() => setAddingTo(null)}
                  onSubmit={async (patch) => {
                    const entry: Entry = { id: `e-${crypto.randomUUID().slice(0, 8)}`, kind: ENTRY_KIND_FOR[section.kind], ...patch };
                    await onProfileSave({ ...profile, entries: [...profile.entries, entry] });
                    edit((r) =>
                      updateSection(r, section.id, (s) =>
                        "items" in s ? { ...s, items: [...s.items, { entryId: entry.id, bullets: [] }] } : s,
                      ),
                    );
                    setAddingTo(null);
                  }}
                />
              ) : (
                <Button type="button" variant="outline" size="sm" className="self-start" onClick={() => setAddingTo(section.id)}>
                  <Plus className="size-3.5" />
                  {ADD_LABEL[section.kind]}
                </Button>
              )}
            </div>
          )}
        </SectionCard>
      ))}
    </div>
  );
}

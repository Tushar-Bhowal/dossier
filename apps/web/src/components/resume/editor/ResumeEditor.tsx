"use client";

import * as React from "react";
import { DropdownMenu } from "radix-ui";
import { ArrowDown, ArrowUp, Eye, EyeOff, Pencil, Plus, Trash2 } from "lucide-react";
import {
  SECTION_TITLES,
  defaultSectionOrder,
  formatDateRange,
  displayUrl,
  type Bullet,
  type CareerProfile,
  type Entry,
  type EntryKind,
  type EntrySectionKind,
  type LintHint,
  type Resume,
  type Section,
  type SectionKind,
} from "@dossier/core/resume";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { PhotoControl } from "./PhotoControl";
import { DetailsCard } from "./DetailsCard";
import { EntryForm } from "./EntryForm";
import { BulletRow, Hints } from "./BulletRow";
import { ChipEditor, SkillsEditor } from "./SkillsEditor";
import { PersonalForm } from "./PersonalForm";

type Edit = (fn: (r: Resume) => Resume) => void;
// Applies a change and offers an Undo toast for it.
type Undoable = (label: string, fn: (r: Resume) => Resume) => void;

const ENTRY_KIND_FOR: Record<EntrySectionKind, EntryKind> = {
  experience: "job",
  education: "education",
  projects: "project",
  certifications: "certification",
  volunteer: "volunteer",
  achievements: "achievement",
  custom: "other",
};

const ADD_LABEL: Record<EntrySectionKind, string> = {
  experience: "Add a job",
  education: "Add education",
  projects: "Add a project",
  certifications: "Add a certification",
  volunteer: "Add volunteering",
  achievements: "Add an achievement",
  custom: "Add an item",
};

// Where a confirmed fact reads naturally as a line; under a degree or a certificate it would repeat the title.
const LINED: SectionKind[] = ["experience", "projects", "volunteer", "custom"];

const DECLARATION =
  "I hereby declare that the information given above is true and correct to the best of my knowledge and belief.";

// Sections offered in "Add a section" when the resume doesn't have one yet. Custom can repeat.
const ADDABLE: { kind: SectionKind; hint: string }[] = [
  { kind: "summary", hint: "Two or three lines about you" },
  { kind: "experience", hint: "Jobs and internships" },
  { kind: "education", hint: "Degrees, Class X and XII" },
  { kind: "projects", hint: "Things you built or led" },
  { kind: "certifications", hint: "Certificates, licences, registrations" },
  { kind: "achievements", hint: "Awards, ranks, recognition" },
  { kind: "volunteer", hint: "NSS, NGOs, community work" },
  { kind: "skills", hint: "Tools and abilities" },
  { kind: "languages", hint: "Languages you speak" },
  { kind: "personal", hint: "Date of birth and more — common for Indian schools and government jobs" },
  { kind: "declaration", hint: "The closing statement many Indian employers expect" },
];

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

// Newest first, the order recruiters expect. "2024" sorts after "2023-06" as plain strings.
const dateKey = (e: Entry | undefined) => (!e ? "" : e.current ? "9999" : (e.end ?? e.start ?? ""));

function insertByDate<T extends { entryId: string }>(items: T[], item: T, entries: Map<string, Entry>): T[] {
  const key = dateKey(entries.get(item.entryId));
  const at = items.findIndex((i) => dateKey(entries.get(i.entryId)) < key);
  return at === -1 ? [...items, item] : [...items.slice(0, at), item, ...items.slice(at)];
}

function newSection(kind: SectionKind, resumeId: string): Section {
  const base = { id: `${resumeId}-${kind}-${crypto.randomUUID().slice(0, 6)}`, title: SECTION_TITLES[kind], hidden: false };
  switch (kind) {
    case "summary":
      return { ...base, kind, text: "", factIds: [] };
    case "skills":
      return { ...base, kind, skills: [], groups: [] };
    case "languages":
      return { ...base, kind, languages: [] };
    case "personal":
      return { ...base, kind };
    case "declaration":
      return { ...base, kind, text: DECLARATION };
    case "custom":
      return { ...base, kind, title: "New section", items: [] };
    default:
      return { ...base, kind, items: [] };
  }
}

// Slots a new section in where it would normally go, without reshuffling the user's own order.
function insertSection(sections: Section[], section: Section, profile: CareerProfile): Section[] {
  const order = defaultSectionOrder(profile);
  const rank = (k: SectionKind) => {
    const i = order.indexOf(k);
    return i === -1 ? order.length : i;
  };
  const at = sections.findIndex((s) => rank(s.kind) > rank(section.kind));
  return at === -1 ? [...sections, section] : [...sections.slice(0, at), section, ...sections.slice(at)];
}

function SectionCard({
  section,
  index,
  count,
  edit,
  undoable,
  children,
}: {
  section: Section;
  index: number;
  count: number;
  edit: Edit;
  undoable: Undoable;
  children: React.ReactNode;
}) {
  const setTitle = (title: string) => edit((r) => updateSection(r, section.id, (s) => ({ ...s, title })));
  return (
    <section
      id={`section-${section.id}`}
      className={cn(
        "scroll-mt-24 rounded-lg border border-white/[0.08] bg-[#111111] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]",
        section.hidden && "opacity-60",
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={section.title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => {
            if (!section.title.trim()) setTitle(SECTION_TITLES[section.kind]);
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
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Remove the ${section.title} section`}
            title="Remove section (your profile keeps everything)"
            onClick={() =>
              undoable(`Removed "${section.title}"`, (r) => ({ ...r, sections: r.sections.filter((s) => s.id !== section.id) }))
            }
          >
            <Trash2 className="size-4 text-white/60" />
          </Button>
        </div>
      </div>
      {section.hidden && <p className="mt-1 px-2 text-[13px] font-medium text-white/55">Hidden from your resume.</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

function EntryDetails({ entry }: { entry: Entry }) {
  const parts = [
    entry.grade && `Grade: ${entry.grade}`,
    entry.credentialId && `ID: ${entry.credentialId}`,
  ].filter(Boolean);
  if (!parts.length && !entry.link) return null;
  return (
    <p className="mt-0.5 flex flex-wrap gap-x-3 text-sm font-medium text-white/60">
      {parts.map((p) => (
        <span key={p as string}>{p}</span>
      ))}
      {entry.link && (
        <a href={entry.link} target="_blank" rel="noreferrer noopener" className="text-[#7aa7ff] hover:underline">
          {displayUrl(entry.link)}
        </a>
      )}
    </p>
  );
}

function AddSectionMenu({ resume, onAdd }: { resume: Resume; onAdd: (kind: SectionKind) => void }) {
  const present = new Set(resume.sections.map((s) => s.kind));
  const options = [...ADDABLE.filter((o) => !present.has(o.kind)), { kind: "custom" as const, hint: "Your own heading, e.g. Publications" }];
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button type="button" variant="outline" size="lg" className="self-start">
          <Plus className="size-4" />
          Add a section
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          sideOffset={6}
          className="z-50 max-h-[min(460px,70vh)] w-[320px] max-w-[calc(100vw-32px)] overflow-y-auto rounded-lg border border-white/10 bg-[#141414] p-1.5 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.9)] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
        >
          {options.map((o) => (
            <DropdownMenu.Item
              key={o.kind}
              onSelect={() => onAdd(o.kind)}
              className="flex cursor-pointer flex-col gap-0.5 rounded-md px-3 py-2.5 outline-none data-[highlighted]:bg-white/[0.07]"
            >
              <span className="text-[14px] font-semibold text-white">{o.kind === "custom" ? "Custom section" : SECTION_TITLES[o.kind]}</span>
              <span className="text-[13px] font-medium leading-snug text-white/60">{o.hint}</span>
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

export function ResumeEditor({
  resume,
  profile,
  edit,
  undoable,
  onProfileSave,
  hints,
}: {
  resume: Resume;
  profile: CareerProfile;
  edit: Edit;
  undoable: Undoable;
  onProfileSave: (profile: CareerProfile) => Promise<void>;
  hints: Map<string, LintHint[]>;
}) {
  const entries = new Map(profile.entries.map((e) => [e.id, e]));
  const factText = new Map(profile.facts.map((f) => [f.id, f.text]));
  const [editingEntry, setEditingEntry] = React.useState<string | null>(null);
  const [addingTo, setAddingTo] = React.useState<string | null>(null);
  const selfDeclared = new Set(profile.skills.filter((s) => s.source === "self-declared").map((s) => s.name.toLowerCase()));
  const used = new Set(resume.sections.flatMap((s) => ("items" in s ? s.items.map((i) => i.entryId) : [])));
  const role = profile.canonicalRole ?? undefined;

  const addSection = (kind: SectionKind) => {
    const section = newSection(kind, resume.id);
    edit((r) => ({ ...r, sections: insertSection(r.sections, section, profile) }));
    if ("items" in section) setAddingTo(section.id);
    window.setTimeout(() => {
      document.getElementById(`section-${section.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 60);
  };

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
        <SectionCard key={section.id} section={section} index={index} count={resume.sections.length} edit={edit} undoable={undoable}>
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

          {section.kind === "declaration" && (
            <>
              <Textarea
                value={section.text}
                onChange={(e) => edit((r) => updateSection(r, section.id, (s) => ({ ...s, text: e.target.value })))}
                maxLength={400}
                aria-label="Declaration"
                className="min-h-20 text-[15px] leading-relaxed md:text-[15px]"
              />
              <p className="mt-2 text-sm text-white/60">
                Printed with your name{profile.contact.location ? ` and "Place: ${profile.contact.location}"` : ""} underneath.
              </p>
            </>
          )}

          {section.kind === "personal" && <PersonalForm profile={profile} onSave={onProfileSave} />}

          {section.kind === "skills" && (
            <SkillsEditor
              skills={section.skills}
              groups={section.groups ?? []}
              marked={selfDeclared}
              onChange={({ skills, groups }) => edit((r) => updateSection(r, section.id, (s) => ({ ...s, skills, groups })))}
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
              {section.items.map((block, entryIndex) => {
                const entry = entries.get(block.entryId);
                if (!entry) return null;
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
                        <EntryDetails entry={entry} />
                      </div>
                      <div className="flex items-center gap-0.5">
                        <Button type="button" variant="ghost" size="sm" onClick={() => setEditingEntry(editingEntry === entry.id ? null : entry.id)}>
                          <Pencil className="size-3.5" />
                          Edit details
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          disabled={entryIndex === 0}
                          aria-label={`Move ${entry.title} up`}
                          onClick={() => edit((r) => updateSection(r, section.id, (s) => ("items" in s ? { ...s, items: move(s.items, entryIndex, -1) } : s)))}
                        >
                          <ArrowUp className="size-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          disabled={entryIndex === section.items.length - 1}
                          aria-label={`Move ${entry.title} down`}
                          onClick={() => edit((r) => updateSection(r, section.id, (s) => ("items" in s ? { ...s, items: move(s.items, entryIndex, 1) } : s)))}
                        >
                          <ArrowDown className="size-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Remove ${entry.title} from this resume`}
                          title="Remove from this resume (it stays in your profile)"
                          onClick={() =>
                            undoable(`Removed "${entry.title}" from this resume`, (r) =>
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
                        kind={entry.kind}
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

                    {block.bullets.length > 0 && (
                      <ul className="mt-3 flex flex-col gap-2.5">
                        {block.bullets.map((bullet, i) => (
                          <BulletRow
                            key={bullet.id}
                            bullet={bullet}
                            index={i}
                            count={block.bullets.length}
                            hints={hints.get(bullet.id)}
                            facts={bullet.factIds.map((id) => factText.get(id)).filter((t): t is string => Boolean(t))}
                            role={role}
                            onChange={(text) =>
                              edit((r) =>
                                updateBullets(r, section.id, block.entryId, (bs) =>
                                  bs.map((b) => (b.id === bullet.id ? { ...b, text } : b)),
                                ),
                              )
                            }
                            onMove={(delta) => edit((r) => updateBullets(r, section.id, block.entryId, (bs) => move(bs, i, delta)))}
                            onDelete={() =>
                              undoable("Line deleted", (r) =>
                                updateBullets(r, section.id, block.entryId, (bs) => bs.filter((b) => b.id !== bullet.id)),
                              )
                            }
                            onEmpty={() =>
                              edit((r) => updateBullets(r, section.id, block.entryId, (bs) => bs.filter((b) => b.id !== bullet.id)))
                            }
                          />
                        ))}
                      </ul>
                    )}
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
                      {LINED.includes(section.kind) ? "Add a line" : "Add a detail"}
                    </Button>
                  </div>
                );
              })}

              {(() => {
                const kind = ENTRY_KIND_FOR[section.kind];
                const removed = profile.entries.filter((e) => e.kind === kind && !used.has(e.id));
                if (!removed.length) return null;
                return (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-white/60">Add back:</span>
                    {removed.map((e) => (
                      <Button
                        key={e.id}
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          edit((r) =>
                            updateSection(r, section.id, (s) =>
                              "items" in s
                                ? {
                                    ...s,
                                    items: insertByDate(
                                      s.items,
                                      {
                                        entryId: e.id,
                                        // Back in the user's own words — the AI wording went with the removal.
                                        bullets: profile.facts
                                          .filter((f) => f.entryId === e.id && LINED.includes(s.kind))
                                          .map((f): Bullet => ({ id: `b-${f.id}`, text: f.text, factIds: [f.id], origin: "fallback" })),
                                      },
                                      entries,
                                    ),
                                  }
                                : s,
                            ),
                          )
                        }
                      >
                        <Plus className="size-3.5" />
                        {[e.title, e.org].filter(Boolean).join(", ")}
                      </Button>
                    ))}
                  </div>
                );
              })()}

              {addingTo === section.id ? (
                <EntryForm
                  kind={ENTRY_KIND_FOR[section.kind]}
                  initial={{}}
                  submitLabel={ADD_LABEL[section.kind]}
                  onCancel={() => setAddingTo(null)}
                  onSubmit={async (patch) => {
                    const entry: Entry = { id: `e-${crypto.randomUUID().slice(0, 8)}`, kind: ENTRY_KIND_FOR[section.kind], ...patch };
                    await onProfileSave({ ...profile, entries: [...profile.entries, entry] });
                    const withNew = new Map(entries).set(entry.id, entry);
                    edit((r) =>
                      updateSection(r, section.id, (s) =>
                        "items" in s ? { ...s, items: insertByDate(s.items, { entryId: entry.id, bullets: [] }, withNew) } : s,
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

      <AddSectionMenu resume={resume} onAdd={addSection} />
    </div>
  );
}

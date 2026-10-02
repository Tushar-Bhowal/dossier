"use client";

import * as React from "react";
import { Plus, Trash2, X } from "lucide-react";
import type { SkillGroup } from "@dossier/core/resume";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function ChipEditor({
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
      {items.length > 0 && (
        <ul className="mb-3 flex flex-wrap gap-2">
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
      )}
      {marked && items.some((i) => marked.has(i.toLowerCase())) && (
        <p className="mb-3 text-[13px] font-medium text-amber-200/90">
          Highlighted skills were added by you without an example. Be ready to discuss them in an interview.
        </p>
      )}
      <div className="flex gap-2">
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

// Groups are optional: most people keep one list; engineers often want "Languages", "Tools"… Skills
// left outside a group print under "Other".
export function SkillsEditor({
  skills,
  groups,
  marked,
  onChange,
}: {
  skills: string[];
  groups: SkillGroup[];
  marked: Set<string>;
  onChange: (next: { skills: string[]; groups: SkillGroup[] }) => void;
}) {
  const setGroup = (i: number, patch: Partial<SkillGroup>) =>
    onChange({ skills, groups: groups.map((g, j) => (j === i ? { ...g, ...patch } : g)) });

  return (
    <div className="flex flex-col gap-4">
      {groups.map((g, i) => (
        <div key={i} className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4">
          <div className="mb-3 flex items-center gap-2">
            <Input
              value={g.title}
              onChange={(e) => setGroup(i, { title: e.target.value })}
              onBlur={() => !g.title.trim() && setGroup(i, { title: "Skills" })}
              maxLength={40}
              aria-label="Group name"
              placeholder="Group name, e.g. Tools"
              className="h-9 max-w-[240px] font-semibold"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="ml-auto text-white/65"
              onClick={() =>
                onChange({
                  groups: groups.filter((_, j) => j !== i),
                  skills: [...skills, ...g.skills.filter((s) => !skills.some((x) => x.toLowerCase() === s.toLowerCase()))],
                })
              }
            >
              <Trash2 className="size-3.5" />
              Ungroup
            </Button>
          </div>
          <ChipEditor label={`to ${g.title || "this group"}`} items={g.skills} marked={marked} onChange={(items) => setGroup(i, { skills: items })} />
        </div>
      ))}

      <div>
        {groups.length > 0 && <p className="mb-2 text-sm font-semibold text-white/70">Other skills</p>}
        <ChipEditor label="a skill" items={skills} marked={marked} onChange={(items) => onChange({ skills: items, groups })} />
      </div>

      {groups.length < 8 && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="self-start text-white/70"
          onClick={() => onChange({ skills, groups: [...groups, { title: groups.length ? "New group" : "Technical", skills: [] }] })}
        >
          <Plus className="size-3.5" />
          {groups.length ? "Add another group" : "Group my skills"}
        </Button>
      )}
    </div>
  );
}

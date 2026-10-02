"use client";

import * as React from "react";
import { Collapsible, Slider, Switch } from "radix-ui";
import { AlertTriangle, Check, ChevronDown, Minus, Plus, RotateCcw } from "lucide-react";
import { DEFAULT_LAYOUT, MARGIN_PRESETS, type Resume, type ResumeLayout } from "@dossier/core/resume";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Edit = (fn: (r: Resume) => Resume) => void;
type Spacing = ResumeLayout["spacing"];
type Margins = ResumeLayout["margins"];
type MarginPreset = keyof typeof MARGIN_PRESETS;

const SPACING: { value: Spacing; label: string; hint: string }[] = [
  { value: "auto", label: "Auto", hint: "Text and spacing grow or shrink together to fill the page." },
  { value: "compact", label: "Compact", hint: "Tighter gaps, more room for content." },
  { value: "balanced", label: "Balanced", hint: "Standard gaps." },
  { value: "spacious", label: "Spacious", hint: "More air between lines and entries." },
];

const MARGIN_LABELS: Record<MarginPreset, string> = { narrow: "Narrow", normal: "Normal", wide: "Wide" };
const SIDES: { key: keyof Margins; label: string }[] = [
  { key: "top", label: "Top" },
  { key: "bottom", label: "Bottom" },
  { key: "left", label: "Left" },
  { key: "right", label: "Right" },
];

const SPACE_STEPS = [0, 6, 12, 18, 24];
const SPACE_LABELS = ["None", "Small", "Medium", "Large", "Extra large"];

const sameMargins = (a: Margins, b: Margins) => SIDES.every(({ key }) => a[key] === b[key]);

export function PageCount({ pages }: { pages: number }) {
  const one = pages === 1;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[13px] font-semibold",
        one ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-400/10 text-amber-300",
      )}
    >
      {one ? <Check className="size-3.5" aria-hidden /> : <AlertTriangle className="size-3.5" aria-hidden />}
      {one ? "1 page" : `${pages} pages`}
    </span>
  );
}

export function LayoutPanel({ resume, edit, pages }: { resume: Resume; edit: Edit; pages: number | null }) {
  const layout = resume.layout ?? DEFAULT_LAYOUT;
  const setLayout = (patch: Partial<ResumeLayout>) =>
    edit((r) => ({ ...r, layout: { ...(r.layout ?? DEFAULT_LAYOUT), ...patch } }));
  const setMargin = (key: keyof Margins, value: number) =>
    edit((r) => {
      const current = r.layout ?? DEFAULT_LAYOUT;
      return { ...r, layout: { ...current, margins: { ...current.margins, [key]: value } } };
    });
  const setSpaceBefore = (sectionId: string, value: number) =>
    edit((r) => ({
      ...r,
      sections: r.sections.map((s) => (s.id === sectionId ? { ...s, spaceBefore: value || undefined } : s)),
    }));

  const preset = (Object.keys(MARGIN_PRESETS) as MarginPreset[]).find((k) => sameMargins(layout.margins, MARGIN_PRESETS[k]));
  const visible = resume.sections.filter((s) => !s.hidden);
  const isDefault =
    JSON.stringify(layout) === JSON.stringify(DEFAULT_LAYOUT) && resume.sections.every((s) => !s.spaceBefore);

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-lg border border-white/[0.08] bg-[#111111] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-[17px] font-semibold text-white">Page layout</h3>
          {pages !== null && (
            <span className="lg:hidden">
              <PageCount pages={pages} />
            </span>
          )}
        </div>

        <div className="mt-5 flex items-start justify-between gap-4">
          <div>
            <label htmlFor="layout-fit" className="text-[15px] font-semibold text-white">
              Fit to one page
            </label>
            <p className="mt-0.5 text-sm leading-relaxed text-white/65">
              Dossier picks the text size so everything fills exactly one page.
            </p>
          </div>
          <Switch.Root
            id="layout-fit"
            checked={layout.fit}
            onCheckedChange={(fit) =>
              setLayout(!fit && layout.spacing === "auto" ? { fit, spacing: "balanced" } : { fit })
            }
            className="relative mt-1 h-6 w-11 shrink-0 rounded-full border border-white/10 bg-white/[0.08] transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 data-[state=checked]:border-transparent data-[state=checked]:bg-[#dc3019]"
          >
            <Switch.Thumb className="block size-5 translate-x-0.5 rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-[22px]" />
          </Switch.Root>
        </div>

        {pages !== null && pages > 1 && (
          <p className="mt-4 rounded-lg border border-amber-400/25 bg-amber-400/[0.06] px-3.5 py-3 text-sm leading-relaxed text-amber-100">
            {layout.fit
              ? "There's too much for one page even at the smallest text size. Try Compact spacing, narrower margins, or hiding older lines."
              : "Your resume runs onto a second page. Turn on Fit to one page, or choose Compact spacing or narrower margins."}
          </p>
        )}

        <Field label="Spacing" hint={SPACING.find((s) => s.value === layout.spacing)?.hint}>
          <Segmented
            label="Spacing"
            value={layout.spacing}
            options={SPACING.map((s) => ({
              value: s.value,
              label: s.label,
              disabled: s.value === "auto" && !layout.fit,
            }))}
            onChange={(spacing) => setLayout({ spacing })}
          />
          {!layout.fit && (
            <p className="text-[13px] font-medium text-white/55">Auto needs Fit to one page turned on.</p>
          )}
        </Field>

        <Field label="Margins">
          <Segmented
            label="Margins"
            value={preset ?? "custom"}
            options={[
              ...(Object.keys(MARGIN_PRESETS) as MarginPreset[]).map((k) => ({ value: k, label: MARGIN_LABELS[k] })),
              ...(preset ? [] : [{ value: "custom" as const, label: "Custom", disabled: true }]),
            ]}
            onChange={(k) => k !== "custom" && setLayout({ margins: MARGIN_PRESETS[k] })}
          />
        </Field>
      </section>

      <Collapsible.Root className="rounded-lg border border-white/[0.08] bg-[#111111] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
        <Collapsible.Trigger className="group flex w-full items-center justify-between gap-3 rounded-lg p-5 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
          <span>
            <span className="block text-[17px] font-semibold text-white">Fine-tune</span>
            <span className="mt-0.5 block text-sm text-white/65">Exact margins and extra space between sections</span>
          </span>
          <ChevronDown className="size-5 shrink-0 text-white/60 transition-transform group-data-[state=open]:rotate-180" aria-hidden />
        </Collapsible.Trigger>
        <Collapsible.Content className="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
          <div className="flex flex-col gap-6 border-t border-white/[0.06] p-5">
            <div className="flex flex-col gap-4">
              <p className="text-[15px] font-semibold text-white">Margins</p>
              {SIDES.map(({ key, label }) => (
                <RangeRow
                  key={key}
                  label={label}
                  value={layout.margins[key]}
                  min={10}
                  max={25}
                  step={1}
                  display={(v) => `${(v / 10).toFixed(1)} cm`}
                  onChange={(v) => setMargin(key, v)}
                />
              ))}
            </div>

            <RangeRow
              label="Gap between sections"
              value={layout.sectionGap}
              min={0.5}
              max={2}
              step={0.1}
              display={(v) => `${Math.round(v * 100)}%`}
              onChange={(sectionGap) => setLayout({ sectionGap: Math.round(sectionGap * 10) / 10 })}
            />

            <div className="flex flex-col gap-2">
              <p className="text-[15px] font-semibold text-white">Extra space above a section</p>
              <p className="text-sm text-white/65">Adds room above one heading without changing the rest.</p>
              <ul className="mt-1 flex flex-col divide-y divide-white/[0.06] rounded-lg border border-white/[0.08]">
                {visible.map((s) => {
                  const step = Math.max(0, SPACE_STEPS.findIndex((v) => v >= (s.spaceBefore ?? 0)));
                  return (
                    <li key={s.id} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                      <span className="min-w-0 truncate text-[15px] font-medium text-white/85">{s.title}</span>
                      <span className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Less space above ${s.title}`}
                          disabled={step === 0}
                          onClick={() => setSpaceBefore(s.id, SPACE_STEPS[step - 1] ?? 0)}
                        >
                          <Minus className="size-4" />
                        </Button>
                        <span className="w-[88px] text-center text-[14px] font-semibold text-white" aria-live="polite">
                          {SPACE_LABELS[step]}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`More space above ${s.title}`}
                          disabled={step === SPACE_STEPS.length - 1}
                          onClick={() => setSpaceBefore(s.id, SPACE_STEPS[step + 1] ?? 24)}
                        >
                          <Plus className="size-4" />
                        </Button>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>

            <Button
              type="button"
              variant="outline"
              className="self-start"
              disabled={isDefault}
              onClick={() =>
                edit((r) => ({
                  ...r,
                  layout: DEFAULT_LAYOUT,
                  sections: r.sections.map((s) => ({ ...s, spaceBefore: undefined })),
                }))
              }
            >
              <RotateCcw className="size-4" />
              Reset layout
            </Button>
          </div>
        </Collapsible.Content>
      </Collapsible.Root>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="mt-6 flex flex-col gap-2.5">
      <p className="text-[15px] font-semibold text-white">{label}</p>
      {children}
      {hint && <p className="text-sm leading-relaxed text-white/65">{hint}</p>}
    </div>
  );
}

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string; disabled?: boolean }[];
  onChange: (value: T) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(
        "grid gap-1 rounded-lg border border-white/[0.08] bg-white/[0.03] p-1",
        options.length === 3 ? "grid-cols-3" : "grid-cols-2 sm:grid-cols-4",
      )}
    >
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={o.disabled}
            onClick={() => onChange(o.value)}
            className={cn(
              "rounded-md px-2 py-2 text-[14px] font-semibold transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed",
              on ? "bg-white text-neutral-900" : "text-white/75 hover:bg-white/[0.06] hover:text-white disabled:opacity-40 disabled:hover:bg-transparent",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function RangeRow({
  label,
  value,
  min,
  max,
  step,
  display,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: (v: number) => string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <span className="text-[14px] font-medium text-white/80">{label}</span>
        <span className="text-[14px] font-semibold text-white">{display(value)}</span>
      </div>
      <Slider.Root
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={([v]) => v !== undefined && onChange(v)}
        className="relative flex h-5 w-full touch-none items-center select-none"
      >
        <Slider.Track className="relative h-1.5 grow overflow-hidden rounded-full bg-white/[0.1]">
          <Slider.Range className="absolute h-full rounded-full bg-[#dc3019]" />
        </Slider.Track>
        <Slider.Thumb
          aria-label={label}
          aria-valuetext={display(value)}
          className="block size-5 rounded-full border-2 border-[#dc3019] bg-white shadow outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </Slider.Root>
    </div>
  );
}

"use client";

import * as React from "react";
import type { FieldResult, FixedTopic } from "@dossier/core/autofill";
import { Lock, Monitor, Paperclip } from "lucide-react";
import { toast } from "@/components/ui/toast";
import { SampleBanner } from "@/components/demo/SampleBanner";
import { AUTOFILL_SAMPLE, autofill } from "@/lib/autofill/api";
import { autofillScenario } from "@/lib/autofill/demo/scenario";
import type { DemoForm } from "@/lib/autofill/demo/forms";
import { formFor } from "@/lib/autofill/demo/forms";
import { cn } from "@/lib/utils";
import { Panel, STATUS_STYLE, groupOf, type PanelPhase } from "./Panel";

const control =
  "w-full rounded-md border border-neutral-300 bg-white px-3 text-[15px] text-neutral-900 outline-none focus:border-neutral-500 focus:ring-2 focus:ring-neutral-300";

function valueOf(result: FieldResult, form: DemoForm): string {
  if (result.kind === "profile" || result.kind === "answer" || result.kind === "saved") return result.text;
  if (result.kind === "file") return result.fileName;
  if (result.kind === "option") return form.fields.find((f) => f.id === result.id)?.options?.[result.indexes[0]] ?? "";
  return "";
}

// A stand-in for a real application page, styled like a light job-board form on purpose.
function JobForm({
  form,
  values,
  results,
  focusId,
  onChange,
}: {
  form: DemoForm;
  values: Record<string, string>;
  results: Record<string, FieldResult>;
  focusId: string | null;
  onChange: (id: string, value: string) => void;
}) {
  const sections = [...new Set(form.fields.map((f) => f.section ?? ""))];
  return (
    <div className="min-h-[640px] bg-neutral-50 px-5 py-8 text-neutral-900 [color-scheme:light] sm:px-10">
      <p className="text-sm font-semibold text-neutral-500">{form.company}</p>
      <h2 className="mt-1 text-2xl font-semibold tracking-[-0.02em]">{form.title}</h2>
      <p className="mt-1 text-sm text-neutral-500">{form.intro}</p>
      <form className="mt-8 flex max-w-xl flex-col gap-8" onSubmit={(e) => e.preventDefault()}>
        {sections.map((section) => (
          <fieldset key={section} className="flex flex-col gap-5">
            {section && <legend className="mb-1 text-[15px] font-semibold text-neutral-800">{section}</legend>}
            {form.fields
              .filter((f) => (f.section ?? "") === section)
              .map((f) => {
                const result = results[f.id];
                const status = result ? groupOf(result) : null;
                const ring = status ? cn("ring-2 ring-offset-2 ring-offset-neutral-50", STATUS_STYLE[status].ring) : "";
                const focused = focusId === f.id;
                const id = `form-${f.id}`;
                return (
                  <div key={f.id} className={cn("flex flex-col gap-1.5 rounded-md transition-shadow", focused && "shadow-[0_0_0_6px_rgba(220,48,25,0.15)]")}>
                    <label htmlFor={id} className="text-sm font-medium text-neutral-700">
                      {f.label}
                      {f.required && <span className="text-red-600"> *</span>}
                    </label>
                    {f.type === "textarea" ? (
                      <textarea id={id} rows={4} value={values[f.id] ?? ""} onChange={(e) => onChange(f.id, e.target.value)} className={cn(control, "py-2", ring)} />
                    ) : f.type === "select" ? (
                      <select id={id} value={values[f.id] ?? ""} onChange={(e) => onChange(f.id, e.target.value)} className={cn(control, "h-10", ring)}>
                        <option value="">Select…</option>
                        {f.options?.map((o) => (
                          <option key={o}>{o}</option>
                        ))}
                      </select>
                    ) : f.type === "radio" ? (
                      <div id={id} role="radiogroup" aria-label={f.label} className={cn("flex flex-wrap gap-4 rounded-md p-1", ring)}>
                        {f.options?.map((o) => (
                          <label key={o} className="flex items-center gap-2 text-[15px]">
                            <input type="radio" name={id} checked={values[f.id] === o} onChange={() => onChange(f.id, o)} className="size-4 accent-neutral-800" />
                            {o}
                          </label>
                        ))}
                      </div>
                    ) : f.type === "file" ? (
                      <div id={id} className={cn("flex h-10 items-center gap-2 rounded-md border border-dashed border-neutral-300 bg-white px-3 text-sm text-neutral-600", ring)}>
                        <Paperclip className="size-4" aria-hidden />
                        {values[f.id] || "Attach a file"}
                      </div>
                    ) : (
                      <input id={id} type={f.type} value={values[f.id] ?? ""} onChange={(e) => onChange(f.id, e.target.value)} className={cn(control, "h-10", ring)} />
                    )}
                  </div>
                );
              })}
          </fieldset>
        ))}
        <button
          type="button"
          onClick={() => toast.info("This is a sample form", { description: "On a real site you'd submit it yourself. Dossier never clicks Submit." })}
          className="h-11 self-start rounded-md bg-neutral-900 px-6 text-[15px] font-semibold text-white"
        >
          Submit application
        </button>
      </form>
    </div>
  );
}

export function AutofillPreview() {
  const scenario = autofillScenario.useScenario();
  const email = autofill.signedInAs();
  const form = formFor(scenario.persona);
  const [phase, setPhase] = React.useState<PanelPhase>("idle");
  const [results, setResults] = React.useState<FieldResult[]>([]);
  const [aiProblem, setAiProblem] = React.useState<"down" | "quota" | null>(null);
  const [unreadable, setUnreadable] = React.useState(0);
  const [values, setValues] = React.useState<Record<string, string>>({});
  const [filled, setFilled] = React.useState<Record<string, string>>({});
  const [focusId, setFocusId] = React.useState<string | null>(null);

  // A new persona or scenario starts over with a clean form.
  const resetKey = `${scenario.persona}:${scenario.fail}`;
  const [lastKey, setLastKey] = React.useState(resetKey);
  if (lastKey !== resetKey) {
    setLastKey(resetKey);
    setPhase("idle");
    setResults([]);
    setValues({});
    setFilled({});
  }

  async function fill(pastedJd: string | null) {
    setPhase("filling");
    const out = await autofill.fill(form, pastedJd);
    const next = Object.fromEntries(out.results.map((r) => [r.id, valueOf(r, form)]));
    setResults(out.results);
    setAiProblem(out.aiProblem);
    setValues(next);
    setFilled(next);
    setPhase("review");
  }

  async function start() {
    setPhase("scanning");
    setValues({});
    const scan = await autofill.scan();
    setUnreadable(scan.unreadableParts);
    if (!scan.jobDescriptionFound) setPhase("needs_jd");
    else await fill("");
  }

  const editedCount = results.filter((r) => (r.kind === "answer" || r.kind === "saved") && values[r.id] !== filled[r.id]).length;
  const labels = Object.fromEntries(form.fields.map((f) => [f.id, f.label]));
  const byId = Object.fromEntries(results.map((r) => [r.id, r]));

  return (
    <div className="flex flex-col gap-6">
      {AUTOFILL_SAMPLE && (
        <SampleBanner>This preview runs on a sample form inside Dossier. The Chrome extension itself comes later, with this same panel.</SampleBanner>
      )}
      <p className="flex items-center gap-2 text-sm font-medium text-white/55 lg:hidden">
        <Monitor className="size-4" aria-hidden />
        The extension works in desktop Chrome and Edge. On a phone, this is a preview only.
      </p>
      <div className="overflow-hidden rounded-lg border border-white/[0.1] shadow-[0_30px_80px_-30px_rgba(0,0,0,0.9)]">
        <div className="flex items-center gap-3 border-b border-white/[0.08] bg-[#1a1a1a] px-4 py-2.5">
          <span className="flex gap-1.5" aria-hidden>
            <span className="size-3 rounded-full bg-white/15" />
            <span className="size-3 rounded-full bg-white/15" />
            <span className="size-3 rounded-full bg-white/15" />
          </span>
          <span className="flex min-w-0 flex-1 items-center gap-2 rounded-md bg-black/40 px-3 py-1.5 text-[13px] font-medium text-white/60">
            <Lock className="size-3.5 shrink-0" aria-hidden />
            <span className="truncate">{form.host}/apply</span>
          </span>
        </div>
        <div className="grid lg:grid-cols-[minmax(0,1fr)_380px]">
          <JobForm
            form={form}
            values={values}
            results={byId}
            focusId={focusId}
            onChange={(id, value) => setValues((v) => ({ ...v, [id]: value }))}
          />
          <div className="border-t border-white/[0.08] lg:border-l lg:border-t-0">
            <Panel
              email={email}
              phase={phase}
              form={form}
              results={results}
              aiProblem={aiProblem}
              unreadableParts={unreadable}
              editedCount={editedCount}
              labels={labels}
              onFill={() => void start()}
              onFocusField={(id) => {
                setFocusId(id);
                const el = document.getElementById(`form-${id}`);
                el?.scrollIntoView({ block: "center", behavior: "smooth" });
                if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) el.focus({ preventScroll: true });
              }}
              onRetryAi={() => void fill("")}
              onSaveFixed={async (topic: FixedTopic, answer: string) => {
                await autofill.saveFixedAnswer(topic, answer);
                const target = results.find((r) => r.kind === "blank" && r.topic === topic);
                if (!target) return;
                const saved: FieldResult = { id: target.id, kind: "saved", savedAnswerId: `sa-${topic}`, text: answer };
                setResults((list) => list.map((r) => (r.id === target.id ? saved : r)));
                setValues((v) => ({ ...v, [target.id]: answer }));
                setFilled((v) => ({ ...v, [target.id]: answer }));
                toast.success("Saved for next time", { description: "Forms that ask this again fill it in for you." });
              }}
              onSaveEdits={async () => {
                const count = await autofill.saveEdits(editedCount);
                setFilled(values);
                toast.success(`Saved ${count} answer${count === 1 ? "" : "s"}`, { description: "The same questions on other forms will use your wording." });
              }}
              onPasteJd={(jd) => void fill(jd)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

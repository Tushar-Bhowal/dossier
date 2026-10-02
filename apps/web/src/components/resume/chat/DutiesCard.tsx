"use client";

import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CardTitle, DoneSummary, cardClass } from "./Thread";

export function DutiesCard({
  duties,
  entryLabel,
  ticked,
  onToggle,
  done,
  onSubmit,
  skipped = false,
  onReopen,
}: {
  duties: { text: string; entryId: string }[];
  entryLabel: (entryId: string) => string;
  ticked: Set<string>;
  onToggle: (text: string) => void;
  done: boolean;
  onSubmit: () => void;
  // Every job already had enough lines, so the checklist was skipped; onReopen shows it anyway.
  skipped?: boolean;
  onReopen?: () => void;
}) {
  if (done) {
    if (skipped) {
      return (
        <DoneSummary onChange={onReopen} actionLabel="Show them">
          Your resume already lists your duties, so I skipped the checklist
        </DoneSummary>
      );
    }
    return <DoneSummary>{ticked.size === 0 ? "None of the usual duties" : `You did ${ticked.size} of the usual duties`}</DoneSummary>;
  }

  const groups = new Map<string, string[]>();
  for (const d of duties) groups.set(d.entryId, [...(groups.get(d.entryId) ?? []), d.text]);

  return (
    <div className={cardClass}>
      <CardTitle
        title="Did you do any of these?"
        note="Tick only what you really did — each one becomes a line on your resume, and you might be asked about it."
      />
      {[...groups.entries()].map(([entryId, texts]) => (
        <fieldset key={entryId} className="mb-4 last:mb-0">
          <legend className="mb-2.5 text-sm font-semibold text-white/60">At {entryLabel(entryId)}</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {texts.map((text) => {
              const on = ticked.has(text);
              return (
                <label
                  key={text}
                  className={cn(
                    "flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border px-3.5 py-2.5 text-[15px] font-medium transition-colors",
                    on ? "border-primary/50 bg-primary/10 text-white" : "border-white/10 bg-white/[0.02] text-white/75 hover:text-white",
                  )}
                >
                  <input type="checkbox" checked={on} onChange={() => onToggle(text)} className="sr-only" />
                  <span
                    className={cn(
                      "flex size-5 shrink-0 items-center justify-center rounded-[5px] border",
                      on ? "border-[#dc3019] bg-[#dc3019] text-white" : "border-white/25",
                    )}
                    aria-hidden
                  >
                    {on && <Check className="size-3.5" strokeWidth={3} />}
                  </span>
                  {text}
                </label>
              );
            })}
          </div>
        </fieldset>
      ))}
      <Button className="mt-5" onClick={onSubmit}>
        {ticked.size === 0 ? "None of these" : `Continue with ${ticked.size}`}
      </Button>
    </div>
  );
}

"use client";

import * as React from "react";
import { Check, Plus } from "lucide-react";
import { MAX_REMINDER_OFFSET, MIN_REMINDER_OFFSET, offsetLabel } from "@dossier/core/applications";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const PRESETS = [15, 30, 60, 120, 1440];
const MAX_TIMES = 3;

function shortLabel(minutes: number): string {
  if (minutes === 1440) return "1 day";
  if (minutes % 60 === 0) return `${minutes / 60}h`;
  if (minutes > 60) return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  return `${minutes}m`;
}

// Chips for 15m · 30m · 1h · 2h · 1 day plus any custom time, up to three at once.
export function ReminderTimes({
  value,
  onChange,
  label,
}: {
  value: number[];
  onChange: (next: number[]) => void;
  label: string;
}) {
  const [custom, setCustom] = React.useState(false);
  const [amount, setAmount] = React.useState("45");
  const [unit, setUnit] = React.useState<"min" | "hour">("min");
  const full = value.length >= MAX_TIMES;
  const chips = [...new Set([...PRESETS, ...value])].sort((a, b) => a - b);

  const toggle = (minutes: number) => {
    if (value.includes(minutes)) onChange(value.filter((m) => m !== minutes));
    else if (!full) onChange([...value, minutes].sort((a, b) => b - a));
  };

  const minutes = Math.round(Number(amount) * (unit === "hour" ? 60 : 1));
  const customValid = Number.isFinite(minutes) && minutes >= MIN_REMINDER_OFFSET && minutes <= MAX_REMINDER_OFFSET;

  const addCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customValid || full) return;
    if (!value.includes(minutes)) onChange([...value, minutes].sort((a, b) => b - a));
    setCustom(false);
  };

  return (
    <div className="flex flex-col gap-2.5">
      <div role="group" aria-label={label} className="flex flex-wrap gap-2">
        {chips.map((m) => {
          const on = value.includes(m);
          return (
            <button
              key={m}
              type="button"
              aria-pressed={on}
              aria-label={`${offsetLabel(m)} before`}
              disabled={!on && full}
              onClick={() => toggle(m)}
              className={cn(
                "inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-40",
                on ? "border-primary/60 bg-primary/15 text-white" : "border-white/[0.1] text-white/70 hover:bg-white/[0.04]",
              )}
            >
              {on && <Check className="size-3.5" aria-hidden />}
              {shortLabel(m)}
            </button>
          );
        })}
        {!custom && (
          <button
            type="button"
            onClick={() => setCustom(true)}
            disabled={full}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-dashed border-white/[0.15] px-3 text-sm font-semibold text-white/60 hover:bg-white/[0.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-40"
          >
            <Plus className="size-3.5" aria-hidden />
            Custom
          </button>
        )}
      </div>
      {custom && (
        <form onSubmit={addCustom} className="flex flex-wrap items-center gap-2">
          <Input
            aria-label="How long before"
            type="number"
            inputMode="numeric"
            min={1}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="h-9 w-20"
            autoFocus
          />
          <select
            aria-label="Unit"
            value={unit}
            onChange={(e) => setUnit(e.target.value as "min" | "hour")}
            className="h-9 rounded-lg border border-input bg-transparent px-2 text-sm font-semibold text-white [color-scheme:dark]"
          >
            <option value="min">minutes before</option>
            <option value="hour">hours before</option>
          </select>
          <Button type="submit" size="sm" disabled={!customValid}>
            Add
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setCustom(false)}>
            Cancel
          </Button>
          {!customValid && <p className="w-full text-sm font-medium text-white/50">Between 10 minutes and 24 hours.</p>}
        </form>
      )}
      <p className="text-sm font-medium text-white/50">
        {value.length ? `Up to ${MAX_TIMES} reminders.` : "No reminders before interviews."}
        {full && " Remove one to pick another."}
      </p>
    </div>
  );
}

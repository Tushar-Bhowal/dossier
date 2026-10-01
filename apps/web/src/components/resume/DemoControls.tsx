"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { FlaskConical, X } from "lucide-react";
import { resumeKeys } from "@/lib/resume/api";
import {
  DEMO_UI,
  FAILURES,
  setScenario,
  useScenario,
  type DemoFailure,
  type Latency,
  type Persona,
} from "@/lib/resume/demo/scenario";
import { cn } from "@/lib/utils";

const selectClass =
  "h-9 w-full rounded-lg border border-white/10 bg-[#161616] px-2.5 text-sm font-medium text-white outline-none focus-visible:border-primary/60 focus-visible:ring-3 focus-visible:ring-primary/20";

// Lets a tester switch persona, speed and forced failures without touching code.
export function DemoControls() {
  const scenario = useScenario();
  const queryClient = useQueryClient();
  const [open, setOpen] = React.useState(false);

  if (!DEMO_UI) return null;

  const update = (patch: Parameters<typeof setScenario>[0]) => {
    setScenario(patch);
    if ("persona" in patch || "empty" in patch) queryClient.removeQueries({ queryKey: resumeKeys.all });
    else void queryClient.invalidateQueries({ queryKey: resumeKeys.all });
  };

  return (
    <div className="fixed right-4 top-3 z-40 flex flex-col-reverse items-end gap-2 md:right-8">
      {open && (
        <div className="w-72 rounded-lg border border-white/10 bg-[#121212]/95 p-4 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.9)] backdrop-blur-xl">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold text-white">Demo scenario</p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close demo controls"
              className="flex size-7 items-center justify-center rounded-lg text-white/60 hover:bg-white/5 hover:text-white"
            >
              <X className="size-4" />
            </button>
          </div>
          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-white/70">
              Persona
              <select
                className={selectClass}
                value={scenario.persona}
                onChange={(e) => update({ persona: e.target.value as Persona })}
              >
                <option value="teacher">Teacher (non-technical)</option>
                <option value="engineer">Software engineer</option>
              </select>
            </label>
            <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-white/70">
              AI speed
              <select
                className={selectClass}
                value={scenario.latency}
                onChange={(e) => update({ latency: e.target.value as Latency })}
              >
                <option value="normal">Normal (1–3 s)</option>
                <option value="slow">Slow (~12 s)</option>
              </select>
            </label>
            <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-white/70">
              Force a failure
              <select
                className={selectClass}
                value={scenario.fail}
                onChange={(e) => update({ fail: e.target.value as DemoFailure })}
              >
                {FAILURES.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2.5 text-sm font-medium text-white/80">
              <input
                type="checkbox"
                checked={scenario.empty}
                onChange={(e) => update({ empty: e.target.checked })}
                className="size-4 accent-[#dc3019]"
              />
              Start as a brand-new user
            </label>
            <p className="text-[13px] leading-relaxed text-white/50">
              Static demo data. Nothing is saved — a refresh starts over.
            </p>
          </div>
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex h-10 items-center gap-2 rounded-lg border border-dashed border-white/15 bg-[#161616] px-3.5 text-sm font-semibold text-white/80 transition-colors hover:bg-[#1d1d1d] hover:text-white",
          scenario.fail !== "none" && "border-amber-500/40 text-amber-200",
        )}
        aria-expanded={open}
      >
        <FlaskConical className="size-4" aria-hidden />
        Demo: {scenario.persona === "teacher" ? "Teacher" : "Engineer"}
        {scenario.fail !== "none" && " · failure on"}
      </button>
    </div>
  );
}

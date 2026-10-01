"use client";

import * as React from "react";

// Demo affordances (example text, the scenario switcher) only appear while the mock is in use.
export const DEMO_UI = process.env.NEXT_PUBLIC_RESUME_MOCK === "1" || process.env.NODE_ENV === "development";

export type Persona = "teacher" | "engineer";
export type Latency = "normal" | "slow";
export type DemoFailure =
  | "none"
  | "ai_down"
  | "quota"
  | "no_role_pack"
  | "fallback_bullets"
  | "conflict"
  | "scanned_pdf"
  | "typst"
  | "no_speech"
  | "market_thin"
  | "tailoring";

export interface Scenario {
  persona: Persona;
  latency: Latency;
  fail: DemoFailure;
  empty: boolean;
}

export const FAILURES: { value: DemoFailure; label: string }[] = [
  { value: "none", label: "Everything works" },
  { value: "ai_down", label: "AI is down" },
  { value: "quota", label: "Daily AI limit reached" },
  { value: "no_role_pack", label: "No question set for this role" },
  { value: "fallback_bullets", label: "Lines kept in your words" },
  { value: "conflict", label: "Edited in another tab" },
  { value: "scanned_pdf", label: "Scanned PDF (no text)" },
  { value: "typst", label: "PDF renderer fails" },
  { value: "no_speech", label: "No microphone support" },
  { value: "market_thin", label: "Too few postings" },
  { value: "tailoring", label: "Tailoring fails" },
];

const DEFAULT: Scenario = { persona: "teacher", latency: "normal", fail: "none", empty: false };

let scenario: Scenario = DEFAULT;
let initialised = false;
const listeners = new Set<() => void>();

function readUrl(): Partial<Scenario> {
  const params = new URLSearchParams(window.location.search);
  const out: Partial<Scenario> = {};
  const persona = params.get("persona");
  if (persona === "teacher" || persona === "engineer") out.persona = persona;
  if (params.get("latency") === "slow") out.latency = "slow";
  const fail = params.get("fail");
  if (fail && FAILURES.some((f) => f.value === fail)) out.fail = fail as DemoFailure;
  if (params.get("state") === "empty") out.empty = true;
  return out;
}

// A test link like /resumes?persona=engineer&fail=quota opens straight into that scenario.
export function getScenario(): Scenario {
  if (!initialised && typeof window !== "undefined") {
    initialised = true;
    scenario = { ...DEFAULT, ...readUrl() };
  }
  return scenario;
}

export function setScenario(patch: Partial<Scenario>) {
  scenario = { ...getScenario(), ...patch };
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useScenario(): Scenario {
  return React.useSyncExternalStore(subscribe, getScenario, () => DEFAULT);
}

export function aiDelayMs(): number {
  return getScenario().latency === "slow" ? 12_000 : 800 + Math.round(Math.random() * 1700);
}

export const READ_DELAY_MS = 250;

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

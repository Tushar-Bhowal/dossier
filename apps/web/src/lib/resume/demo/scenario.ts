"use client";

import { createScenarioStore, type Scenario as BaseScenario } from "@/lib/demo/scenario";

export { DEMO_UI, READ_DELAY_MS, sleep, type Latency, type Persona } from "@/lib/demo/scenario";

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

export type Scenario = BaseScenario<DemoFailure>;

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

export const resumeScenario = createScenarioStore(FAILURES, "none");
export const { getScenario, setScenario, useScenario, aiDelayMs } = resumeScenario;

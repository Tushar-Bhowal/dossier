"use client";

import { createScenarioStore } from "@/lib/demo/scenario";

export type AutofillState = "none" | "signed_out" | "ai_down" | "quota" | "no_jd" | "iframe";

export const autofillScenario = createScenarioStore<AutofillState>(
  [
    { value: "none", label: "Everything works" },
    { value: "signed_out", label: "Not signed in" },
    { value: "ai_down", label: "AI is down" },
    { value: "quota", label: "Daily limit reached" },
    { value: "no_jd", label: "No job description on page" },
    { value: "iframe", label: "Part of form unreadable" },
  ],
  "none",
);

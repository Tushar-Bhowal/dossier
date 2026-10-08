"use client";

import { createScenarioStore } from "@/lib/demo/scenario";

export type ReferralState = "none" | "search_empty" | "ai_down" | "quota";

export const referralScenario = createScenarioStore<ReferralState>(
  [
    { value: "none", label: "Everything works" },
    { value: "search_empty", label: "Search finds nobody" },
    { value: "ai_down", label: "AI is down" },
    { value: "quota", label: "Daily limit reached" },
  ],
  "none",
);

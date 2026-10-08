"use client";

import { createScenarioStore } from "@/lib/demo/scenario";

export type RoadmapState = "none" | "ai_down" | "quota" | "low_confidence" | "generation_fails" | "load_error";

export const roadmapScenario = createScenarioStore<RoadmapState>(
  [
    { value: "none", label: "Everything works" },
    { value: "ai_down", label: "AI is down" },
    { value: "quota", label: "Daily AI limit reached" },
    { value: "low_confidence", label: "Few sources found" },
    { value: "generation_fails", label: "Building fails" },
    { value: "load_error", label: "Roadmaps won't load" },
  ],
  "none",
);

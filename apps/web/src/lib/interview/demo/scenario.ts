"use client";

import { createScenarioStore } from "@/lib/demo/scenario";

export type InterviewState = "none" | "no_mic" | "voice_drops" | "quota" | "grading_fails" | "load_error";

export const interviewScenario = createScenarioStore<InterviewState>(
  [
    { value: "none", label: "Everything works" },
    { value: "no_mic", label: "No microphone" },
    { value: "voice_drops", label: "Voice drops mid-way" },
    { value: "quota", label: "Daily limit reached" },
    { value: "grading_fails", label: "Scoring fails" },
    { value: "load_error", label: "Interviews won't load" },
  ],
  "none",
);

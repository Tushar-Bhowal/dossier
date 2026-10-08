"use client";

import { createScenarioStore } from "@/lib/demo/scenario";

export type BookmarkState = "none" | "parse_fails";

export const bookmarkScenario = createScenarioStore<BookmarkState>(
  [
    { value: "none", label: "Everything works" },
    { value: "parse_fails", label: "Page can't be read" },
  ],
  "none",
);

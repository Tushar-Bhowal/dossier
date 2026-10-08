"use client";

import { createScenarioStore } from "@/lib/demo/scenario";

export type AccountState =
  | "none"
  | "near_cap"
  | "at_cap"
  | "own_key"
  | "usage_error"
  | "invalid_key"
  | "key_quota"
  | "key_check_down"
  | "delete_fails";

export const accountScenario = createScenarioStore<AccountState>(
  [
    { value: "none", label: "Everything works" },
    { value: "near_cap", label: "Close to today's limit" },
    { value: "at_cap", label: "Daily AI limit reached" },
    { value: "own_key", label: "Already has their own key" },
    { value: "usage_error", label: "Usage won't load" },
    { value: "invalid_key", label: "Key is rejected" },
    { value: "key_quota", label: "Key is out of Google quota" },
    { value: "key_check_down", label: "Google can't be reached" },
    { value: "delete_fails", label: "Delete fails" },
  ],
  "none",
);

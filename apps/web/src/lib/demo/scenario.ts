"use client";

import * as React from "react";

// Demo affordances (example text, the scenario switcher) only appear while a mock is in use.
export const DEMO_UI = process.env.NEXT_PUBLIC_RESUME_MOCK === "1" || process.env.NODE_ENV === "development";

export type Persona = "teacher" | "engineer";
export type Latency = "normal" | "slow";

export interface Scenario<F extends string> {
  persona: Persona;
  latency: Latency;
  fail: F;
  empty: boolean;
}

export interface ScenarioOption<F extends string> {
  value: F;
  label: string;
}

export interface ScenarioStore<F extends string> {
  failures: ScenarioOption<F>[];
  getScenario: () => Scenario<F>;
  setScenario: (patch: Partial<Scenario<F>>) => void;
  useScenario: () => Scenario<F>;
  aiDelayMs: () => number;
}

// One store per mocked feature. A test link like ?persona=engineer&fail=quota&state=empty&latency=slow
// opens straight into that scenario.
export function createScenarioStore<F extends string>(failures: ScenarioOption<F>[], none: F): ScenarioStore<F> {
  const DEFAULT: Scenario<F> = { persona: "teacher", latency: "normal", fail: none, empty: false };
  let scenario = DEFAULT;
  let initialised = false;
  const listeners = new Set<() => void>();

  function readUrl(): Partial<Scenario<F>> {
    const params = new URLSearchParams(window.location.search);
    const out: Partial<Scenario<F>> = {};
    const persona = params.get("persona");
    if (persona === "teacher" || persona === "engineer") out.persona = persona;
    if (params.get("latency") === "slow") out.latency = "slow";
    const fail = failures.find((f) => f.value === params.get("fail"));
    if (fail) out.fail = fail.value;
    if (params.get("state") === "empty") out.empty = true;
    return out;
  }

  function getScenario(): Scenario<F> {
    if (!initialised && typeof window !== "undefined") {
      initialised = true;
      scenario = { ...DEFAULT, ...readUrl() };
    }
    return scenario;
  }

  function setScenario(patch: Partial<Scenario<F>>) {
    scenario = { ...getScenario(), ...patch };
    listeners.forEach((l) => l());
  }

  function subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  return {
    failures,
    getScenario,
    setScenario,
    useScenario: () => React.useSyncExternalStore(subscribe, getScenario, () => DEFAULT),
    aiDelayMs: () => (getScenario().latency === "slow" ? 12_000 : 800 + Math.round(Math.random() * 1700)),
  };
}

export const READ_DELAY_MS = 250;

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

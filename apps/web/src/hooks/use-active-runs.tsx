"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ApiError, createRun, getRun, resumeRun, type RunCreateInput } from "@/lib/api";
import { toast } from "@/components/ui/toast";

export interface ActiveRun {
  id: string;
  roleTitle: string;
  company: string;
  status: "queued" | "running" | "succeeded" | "partial" | "failed";
  createdAt: number;
  stepsSettled: number;
  stepsTotal: number;
  kitId?: string;
  error?: string;
  currentStep?: string;
  input?: RunCreateInput;
}

interface ActiveRunsContextType {
  activeRuns: ActiveRun[];
  addRun: (input: RunCreateInput, explicitRoleTitle?: string) => Promise<string>;
  addBulkRuns: (inputs: RunCreateInput[]) => Promise<void>;
  resumeActiveRun: (id: string) => Promise<void>;
  removeRun: (id: string) => void;
  summary: {
    runningCount: number;
    queuedCount: number;
    attentionCount: number;
    totalCount: number;
  };
}

const STORAGE_KEY = "dossier_active_runs";
const MAX_CONCURRENCY = 2;
const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const POLL_INTERVAL_MS = 1500;
const SUCCESS_CARD_LINGER_MS = 3500;
const MAX_POLL_FAILURES = 8;

// Only a run the server is still working on is worth polling. `partial` and `failed` are terminal
// until the user resumes them — the server has stopped, so polling would never see a change.
// A queued run still holding its `input` has no backend record yet, so there is nothing to GET.
function isPollable(run: ActiveRun): boolean {
  return (run.status === "queued" || run.status === "running") && !run.input;
}

export function extractRoleTitle(jd: string): string {
  const lines = jd.split("\n");
  for (const line of lines) {
    const trimmed = line.replace(/^[#* \t-]+/, "").replace(/[*_~`]/g, "").trim();
    if (trimmed.length > 2) {
      return trimmed.slice(0, 50);
    }
  }
  return "Untitled role";
}

export function extractCompany(urlStr: string): string {
  try {
    const parsed = new URL(urlStr.startsWith("http") ? urlStr : `https://${urlStr}`);
    return parsed.hostname.replace(/^www\./, "");
  } catch {
    return "Unknown company";
  }
}

const ActiveRunsContext = React.createContext<ActiveRunsContextType | null>(null);

export function ActiveRunsProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [activeRuns, setActiveRuns] = React.useState<ActiveRun[]>([]);
  const [isInitialized, setIsInitialized] = React.useState(false);

  // Latest runs, readable without being a dependency — the polling interval and the
  // concurrency check both need current state without being rebuilt whenever it changes.
  const activeRunsRef = React.useRef<ActiveRun[]>(activeRuns);
  React.useEffect(() => {
    activeRunsRef.current = activeRuns;
  }, [activeRuns]);

  // Keyed by run id so a succeeded run is only ever scheduled for removal once, however many
  // poll ticks observe it as succeeded. Deliberately not tied to the polling effect's lifecycle:
  // a run leaves the pollable set at the moment it succeeds, so an effect-scoped cleanup would
  // cancel the very removal it just scheduled and strand the card on screen.
  const removalTimersRef = React.useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const pollFailuresRef = React.useRef<Map<string, number>>(new Map());
  const notifiedRunsRef = React.useRef<Set<string>>(new Set());
  React.useEffect(() => {
    const timers = removalTimersRef.current;
    return () => {
      timers.forEach(clearTimeout);
      timers.clear();
    };
  }, []);

  // Load from localStorage on mount & prune stale runs
  React.useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed: ActiveRun[] = JSON.parse(stored);
        const now = Date.now();
        const valid = parsed.filter((r) => now - r.createdAt < TTL_MS);
        setActiveRuns(valid);
      }
    } catch (e) {
      console.error("Failed to load active runs from localStorage:", e);
    } finally {
      setIsInitialized(true);
    }
  }, []);

  // Save to localStorage on change
  React.useEffect(() => {
    if (!isInitialized) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(activeRuns));
    } catch (e) {
      console.error("Failed to save active runs to localStorage:", e);
    }
  }, [activeRuns, isInitialized]);

  // Manage concurrency queue: dispatch queued runs when concurrency < MAX_CONCURRENCY
  React.useEffect(() => {
    if (!isInitialized) return;

    const running = activeRuns.filter((r) => r.status === "running");
    if (running.length >= MAX_CONCURRENCY) return;

    // Find next queued run that hasn't started yet (has an input)
    const nextQueued = activeRuns.find((r) => r.status === "queued" && r.input);
    if (!nextQueued || !nextQueued.input) return;

    // Mark as running locally immediately to prevent duplicate triggers
    setActiveRuns((prev) =>
      prev.map((r) => (r.id === nextQueued.id ? { ...r, status: "running" as const } : r))
    );

    createRun(nextQueued.input)
      .then((record) => {
        setActiveRuns((prev) =>
          prev.map((r) =>
            r.id === nextQueued.id
              ? {
                  ...r,
                  id: record.id,
                  status: record.status,
                  stepsSettled: record.steps.filter((s) => s.status === "ok" || s.status === "skipped").length,
                  stepsTotal: record.steps.length || 9,
                  currentStep: record.steps.find((s) => s.status === "running")?.name,
                  input: undefined,
                }
              : r
          )
        );
      })
      .catch((err) => {
        setActiveRuns((prev) =>
          prev.map((r) =>
            r.id === nextQueued.id
              ? {
                  ...r,
                  status: "failed" as const,
                  error: err instanceof Error ? err.message : "Failed to start run",
                  input: undefined,
                }
              : r
          )
        );
      });
  }, [activeRuns, isInitialized]);

  // Polling loop for in-flight runs. Keyed on the *set* of pollable run ids rather than the runs
  // array itself: every tick writes fresh objects into state, so depending on the array tore the
  // interval down and rebuilt it on every single tick, and each rebuilt interval polled whatever
  // id list had been captured in its closure.
  const pollableKey = React.useMemo(
    () =>
      activeRuns
        .filter(isPollable)
        .map((r) => r.id)
        .sort()
        .join(","),
    [activeRuns]
  );

  React.useEffect(() => {
    if (!isInitialized || pollableKey === "") return;

    let tickInProgress = false;

    const tick = async () => {
      // A tick that outlives the interval (slow network, many runs) must not stack on the next one.
      if (tickInProgress) return;
      tickInProgress = true;
      try {
        for (const run of activeRunsRef.current.filter(isPollable)) {
          let record;
          try {
            record = await getRun(run.id);
            pollFailuresRef.current.delete(run.id);
          } catch (err) {
            // Tolerate a blip, but never poll a run forever: a record that stays unreachable
            // would otherwise leave its card claiming "Generating…" until the 24h TTL.
            const failures = (pollFailuresRef.current.get(run.id) ?? 0) + 1;
            pollFailuresRef.current.set(run.id, failures);
            if (failures >= MAX_POLL_FAILURES) {
              pollFailuresRef.current.delete(run.id);
              const gone = err instanceof ApiError && err.status === 404;
              setActiveRuns((prev) =>
                prev.map((r) =>
                  r.id === run.id
                    ? {
                        ...r,
                        status: "failed" as const,
                        error: gone
                          ? "This run is no longer on the server."
                          : "Lost contact with the server while tracking this run.",
                      }
                    : r
                )
              );
            }
            continue;
          }

          const settled = record.steps.filter((s) => s.status === "ok" || s.status === "skipped").length;
          const currentRunningStep = record.steps.find((s) => s.status === "running")?.name;
          const failedStep = record.steps.find((s) => s.status === "failed");

          setActiveRuns((prev) =>
            prev.map((r) => {
              if (r.id !== run.id) return r;
              return {
                ...r,
                status: record.status,
                stepsSettled: settled,
                stepsTotal: record.steps.length || 9,
                kitId: record.kitId ?? r.kitId,
                currentStep: currentRunningStep,
                error: failedStep?.error ?? (record.status === "failed" ? "Generation failed" : undefined),
              };
            })
          );

          if (record.status === "succeeded" && !removalTimersRef.current.has(run.id)) {
            void queryClient.invalidateQueries({ queryKey: ["kits"] });
            toast.success("Kit generated successfully!", {
              description: `${run.roleTitle || "Interview kit"} at ${run.company || "the company"} is ready to view.`,
            });
            // Hold the finished card on screen briefly so its own completion state is what the
            // user sees, then drop it and let the real KitCard take its place in the grid.
            removalTimersRef.current.set(
              run.id,
              setTimeout(() => {
                removalTimersRef.current.delete(run.id);
                setActiveRuns((prev) => prev.filter((r) => r.id !== run.id));
              }, SUCCESS_CARD_LINGER_MS)
            );
          }

          if (record.status === "failed" && !notifiedRunsRef.current.has(run.id)) {
            notifiedRunsRef.current.add(run.id);
            toast.error("Kit generation failed", {
              description: failedStep?.error || "An error occurred during generation. You can resume it from the card.",
            });
          }
        }
      } finally {
        tickInProgress = false;
      }
    };

    const interval = setInterval(() => void tick(), POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [isInitialized, pollableKey, queryClient]);

  const addRun = React.useCallback(
    async (input: RunCreateInput, explicitRoleTitle?: string): Promise<string> => {
      const roleTitle = explicitRoleTitle || extractRoleTitle(input.jd);
      const company = extractCompany(input.company_url);

      const current = activeRunsRef.current;
      const running = current.filter((r) => r.status === "running");
      const alreadyQueued = current.some((r) => r.status === "queued");
      // Queue behind anything already waiting, so a new kit can't jump ahead of a pending bulk batch.
      const shouldQueue = running.length >= MAX_CONCURRENCY || alreadyQueued;

      if (shouldQueue) {
        const localId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const newRun: ActiveRun = {
          id: localId,
          roleTitle,
          company,
          status: "queued",
          createdAt: Date.now(),
          stepsSettled: 0,
          stepsTotal: 9,
          input,
        };
        setActiveRuns((prev) => [newRun, ...prev]);
        return localId;
      }

      // Start immediately
      const record = await createRun(input);
      const newRun: ActiveRun = {
        id: record.id,
        roleTitle,
        company,
        status: record.status,
        createdAt: Date.now(),
        stepsSettled: record.steps.filter((s) => s.status === "ok" || s.status === "skipped").length,
        stepsTotal: record.steps.length || 9,
        kitId: record.kitId ?? undefined,
        currentStep: record.steps.find((s) => s.status === "running")?.name,
      };
      setActiveRuns((prev) => [newRun, ...prev]);
      return record.id;
    },
    []
  );

  const addBulkRuns = React.useCallback(
    async (inputs: RunCreateInput[]) => {
      const newRuns: ActiveRun[] = inputs.map((input, index) => ({
        id: `bulk-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`,
        roleTitle: extractRoleTitle(input.jd),
        company: extractCompany(input.company_url),
        status: "queued" as const,
        createdAt: Date.now(),
        stepsSettled: 0,
        stepsTotal: 9,
        input,
      }));

      setActiveRuns((prev) => [...newRuns, ...prev]);
    },
    []
  );

  const resumeActiveRun = React.useCallback(async (id: string) => {
    toast.info("Resuming generation", {
      description: "Continuing kit creation from the last checkpoint...",
    });
    setActiveRuns((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: "running" as const, error: undefined } : r))
    );
    try {
      const record = await resumeRun(id);
      setActiveRuns((prev) =>
        prev.map((r) =>
          r.id === id
            ? {
                ...r,
                status: record.status,
                stepsSettled: record.steps.filter((s) => s.status === "ok" || s.status === "skipped").length,
                stepsTotal: record.steps.length || 9,
                currentStep: record.steps.find((s) => s.status === "running")?.name,
              }
            : r
        )
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to resume run";
      toast.error("Resume failed", { description: msg });
      setActiveRuns((prev) =>
        prev.map((r) =>
          r.id === id
            ? {
                ...r,
                status: "failed" as const,
                error: msg,
              }
            : r
        )
      );
    }
  }, []);

  const removeRun = React.useCallback((id: string) => {
    setActiveRuns((prev) => prev.filter((r) => r.id !== id));
    toast.info("Card dismissed.");
  }, []);

  const summary = React.useMemo(() => {
    const runningCount = activeRuns.filter((r) => r.status === "running").length;
    const queuedCount = activeRuns.filter((r) => r.status === "queued").length;
    // Stopped short of a kit and waiting on the user to resume or dismiss. Counted separately so
    // the header can account for every card in the grid instead of silently omitting these.
    const attentionCount = activeRuns.filter(
      (r) => r.status === "partial" || r.status === "failed"
    ).length;
    return {
      runningCount,
      queuedCount,
      attentionCount,
      totalCount: activeRuns.length,
    };
  }, [activeRuns]);

  const value = React.useMemo(
    () => ({
      activeRuns,
      addRun,
      addBulkRuns,
      resumeActiveRun,
      removeRun,
      summary,
    }),
    [activeRuns, addRun, addBulkRuns, resumeActiveRun, removeRun, summary]
  );

  return <ActiveRunsContext.Provider value={value}>{children}</ActiveRunsContext.Provider>;
}

export function useActiveRuns(): ActiveRunsContextType {
  const context = React.useContext(ActiveRunsContext);
  if (!context) {
    throw new Error("useActiveRuns must be used within an ActiveRunsProvider");
  }
  return context;
}

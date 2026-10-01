"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useInView, useReducedMotion } from "motion/react";
import { ArrowRight, Check, Globe, LoaderCircle, Mic, Search, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { EASE_OUT } from "../motion/Reveal";

type Source = { label: string; kind: "Official" | "Candidates" | "Guide" };
type Demo = {
  subject: string;
  field: string;
  sources: Source[];
  stages: [string, string[]][];
  rounds: string[];
};

const DEMOS: Demo[] = [
  {
    subject: "Big Four audit associate",
    field: "Finance",
    rounds: ["Technical accounting", "Case study", "Partner fit"],
    sources: [
      { label: "Firm careers pages", kind: "Official" },
      { label: "Assessment guides", kind: "Guide" },
      { label: "r/Big4 interview threads", kind: "Candidates" },
    ],
    stages: [
      ["Concepts", ["Revenue recognition", "Materiality & audit risk"]],
      ["Practice", ["Journal entry drills", "Internal controls"]],
      ["Scenario", ["Client disputes a finding", "Going-concern red flags"]],
      ["Mock", ["Technical round", "Partner fit round"]],
    ],
  },
  {
    subject: "JavaScript engineer",
    field: "Software",
    rounds: ["Live coding", "System basics", "Behavioural"],
    sources: [
      { label: "Engineering hiring pages", kind: "Official" },
      { label: "MDN & language spec", kind: "Guide" },
      { label: "r/cscareerquestions", kind: "Candidates" },
    ],
    stages: [
      ["Concepts", ["Closures & scope", "The event loop"]],
      ["Practice", ["Async/await puzzles", "Array & object drills"]],
      ["Scenario", ["Debug a memory leak", "Design a debounce"]],
      ["Mock", ["Live coding round", "Behavioural round"]],
    ],
  },
  {
    subject: "Product marketing manager",
    field: "Marketing",
    rounds: ["Portfolio review", "Case presentation", "Team fit"],
    sources: [
      { label: "Company job descriptions", kind: "Official" },
      { label: "Positioning playbooks", kind: "Guide" },
      { label: "r/ProductMarketing", kind: "Candidates" },
    ],
    stages: [
      ["Concepts", ["Positioning & messaging", "Go-to-market basics"]],
      ["Practice", ["Write a launch brief", "Competitive teardown"]],
      ["Scenario", ["Launch slips a week", "Sales wants a new deck"]],
      ["Mock", ["Case presentation", "Cross-team fit round"]],
    ],
  },
];

type Phase = "typing" | "researching" | "building" | "hold" | "erasing";

const KIND_ICON = { Official: Globe, Guide: Search, Candidates: Users } as const;

export function RoadmapDemo() {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-10% 0px" });

  const [index, setIndex] = useState(0);
  const [typed, setTyped] = useState(0);
  const [phase, setPhase] = useState<Phase>("typing");
  const [found, setFound] = useState(0);

  const demo = DEMOS[index]!;

  // One timer per tick, rescheduled from state, so pausing (out of view) is just not scheduling.
  useEffect(() => {
    if (reduce || !inView) return;
    let t: ReturnType<typeof setTimeout>;
    if (phase === "typing") {
      t =
        typed < demo.subject.length
          ? setTimeout(() => setTyped((n) => n + 1), 55)
          : setTimeout(() => setPhase("researching"), 500);
    } else if (phase === "researching") {
      t =
        found < demo.sources.length
          ? setTimeout(() => setFound((n) => n + 1), 520)
          : setTimeout(() => setPhase("building"), 300);
    } else if (phase === "building") {
      t = setTimeout(() => setPhase("hold"), 1400);
    } else if (phase === "hold") {
      t = setTimeout(() => setPhase("erasing"), 3600);
    } else {
      t =
        typed > 0
          ? setTimeout(() => setTyped((n) => n - 1), 18)
          : setTimeout(() => {
              setFound(0);
              setIndex((i) => (i + 1) % DEMOS.length);
              setPhase("typing");
            }, 250);
    }
    return () => clearTimeout(t);
  }, [reduce, inView, phase, typed, found, demo]);

  const shownTyped = reduce ? demo.subject.length : typed;
  const shownFound = reduce ? demo.sources.length : found;
  const showStages = reduce || phase === "building" || phase === "hold";
  const showField = reduce || phase !== "typing";

  return (
    <div
      ref={ref}
      className="relative overflow-hidden rounded-lg border border-white/10 bg-[#0d0d0d]/90 shadow-[0_40px_120px_-20px_rgba(0,0,0,0.9),0_0_0_1px_rgba(255,255,255,0.03)_inset] backdrop-blur-xl"
      role="img"
      aria-label={`Demo: Dossier researching how companies interview for ${demo.subject}, then building a four-stage roadmap from concepts to a mock interview.`}
    >
      <div className="flex h-12 items-center justify-between border-b border-white/[0.06] px-4 sm:px-5">
        <div className="flex items-center gap-2 text-[13px] font-medium text-white/75">
          <span className="size-2 rounded-full bg-primary shadow-[0_0_10px_rgba(251,65,40,0.8)]" />
          New roadmap
        </div>
        <AnimatePresence mode="wait">
          {showField && (
            <motion.span
              key={demo.field}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.3 }}
              className="rounded-lg border border-white/10 bg-white/[0.04] px-2 py-0.5 font-mono text-[13px] text-white/65"
            >
              field · {demo.field.toLowerCase()}
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      <div className="p-4 sm:p-6">
        <div className="flex h-12 items-center gap-3 rounded-lg border border-white/10 bg-black/60 pl-4 pr-1.5">
          <Search className="size-4 shrink-0 text-white/65" aria-hidden />
          <span className="min-w-0 flex-1 truncate text-left text-sm text-foreground sm:text-[15px]">
            {demo.subject.slice(0, shownTyped)}
            {!reduce && (phase === "typing" || phase === "erasing") && (
              <span className="ml-px inline-block h-[1.1em] w-px translate-y-[3px] animate-pulse bg-primary" />
            )}
          </span>
          <span
            className={cn(
              "flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium transition-colors duration-300",
              phase === "typing" && !reduce
                ? "bg-white/[0.06] text-white/65"
                : "bg-[#dc3019] text-white shadow-[0_0_20px_-2px_rgba(251,65,40,0.7)]",
            )}
          >
            Research <ArrowRight className="size-3.5" aria-hidden />
          </span>
        </div>

        <div className="mt-5 grid gap-5 md:grid-cols-[210px_1fr]">
          <div className="text-left">
            <p className="mb-2.5 text-[12px] font-semibold uppercase tracking-[0.1em] text-white/50">
              Sources
            </p>
            <ul className="space-y-1.5">
              {demo.sources.map((s, i) => {
                const Icon = KIND_ICON[s.kind];
                const done = i < shownFound;
                const active = !reduce && phase === "researching" && i === found;
                return (
                  <li
                    key={s.label}
                    className={cn(
                      "flex h-9 items-center gap-2.5 rounded-lg border px-2.5 text-[13px] transition-all duration-500",
                      done || active
                        ? "border-white/10 bg-white/[0.03] opacity-100"
                        : "border-transparent opacity-30",
                    )}
                  >
                    <Icon className="size-3.5 shrink-0 text-white/65" aria-hidden />
                    <span className="min-w-0 flex-1 truncate font-medium text-white/85">{s.label}</span>
                    {done ? (
                      <Check className="size-3.5 shrink-0 text-primary" aria-hidden />
                    ) : active ? (
                      <LoaderCircle className="size-3.5 shrink-0 animate-spin text-white/65" aria-hidden />
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
            {demo.stages.map(([stage, topics], si) => (
              <div
                key={stage}
                className="rounded-lg border border-white/[0.07] bg-gradient-to-b from-white/[0.04] to-white/[0.01] p-3 text-left"
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[13px] font-semibold text-white/90">
                    <span className="mr-1.5 font-mono text-[12px] text-primary">0{si + 1}</span>
                    {stage}
                  </span>
                  {stage === "Mock" && <Mic className="size-3 text-primary" aria-hidden />}
                </div>
                <div className="flex min-h-[76px] flex-col gap-1.5">
                  <AnimatePresence>
                    {showStages &&
                      topics.map((topic, ti) => (
                        <motion.div
                          key={`${demo.subject}-${topic}`}
                          initial={{ opacity: 0, y: 8, filter: "blur(4px)" }}
                          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                          exit={{ opacity: 0, transition: { duration: 0.2 } }}
                          transition={{
                            duration: 0.5,
                            ease: EASE_OUT,
                            delay: reduce ? 0 : si * 0.12 + ti * 0.08,
                          }}
                          className="rounded-lg border border-white/[0.05] bg-white/[0.05] px-2.5 py-1.5 text-[13px] font-medium leading-snug text-white/80"
                        >
                          {topic}
                        </motion.div>
                      ))}
                  </AnimatePresence>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex h-12 items-center justify-between gap-4 border-t border-white/[0.06] px-4 sm:px-6">
        <div
          className={cn(
            "flex min-w-0 items-center gap-2 transition-opacity duration-500",
            showStages ? "opacity-100" : "opacity-0",
          )}
        >
          <span className="shrink-0 text-[13px] font-medium text-white/60">Rounds found</span>
          <div className="flex min-w-0 gap-1.5 overflow-hidden [mask-image:linear-gradient(to_right,black_75%,transparent)] sm:[mask-image:none]">
            {demo.rounds.map((r) => (
              <span
                key={r}
                className="shrink-0 rounded-lg border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[13px] text-foreground/80"
              >
                {r}
              </span>
            ))}
          </div>
        </div>
        <div
          className={cn(
            "hidden shrink-0 items-center gap-2 transition-opacity duration-500 sm:flex",
            showStages ? "opacity-100" : "opacity-0",
          )}
        >
          <span className="text-[13px] text-white/65">Confidence</span>
          <span className="flex gap-0.5" aria-hidden>
            {[0, 1, 2].map((b) => (
              <span key={b} className="h-2.5 w-1 rounded-full bg-primary" />
            ))}
            <span className="h-2.5 w-1 rounded-full bg-white/15" />
          </span>
          <span className="text-[13px] text-foreground/80">High</span>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { useInView, useReducedMotion } from "motion/react";
import { Check, CircleDashed, Minus } from "lucide-react";
import { MockFrame } from "./MockFrame";

const TYPED = "Automated month-end reconciliations in Python, cutting close from 9 days to 5";

const MATCHES = [
  { req: "Month-end close", state: "covered" },
  { req: "Python or SQL", state: "covered" },
  { req: "Stakeholder reporting", state: "partial" },
  { req: "IFRS 15", state: "missing" },
] as const;

export function ResumeMock() {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-15%" });
  const [n, setN] = useState(0);

  useEffect(() => {
    if (reduce || !inView) return;
    const t = setTimeout(
      () => setN((v) => (v >= TYPED.length + 40 ? 0 : v + 1)),
      n >= TYPED.length ? 90 : 38,
    );
    return () => clearTimeout(t);
  }, [reduce, inView, n]);

  const shown = reduce ? TYPED : TYPED.slice(0, Math.min(n, TYPED.length));

  return (
    <div ref={ref}>
      <MockFrame
        title="Resume Studio · Financial analyst"
        label="Resume Studio: LaTeX source on the left with a new bullet being typed, the compiled PDF on the right updating live, and a job-description match showing covered, partial and missing requirements."
        right={
          <span className="flex items-center gap-1.5 font-mono text-[13px] text-emerald-400">
            <span className="size-1.5 rounded-full bg-emerald-400" /> compiled
          </span>
        }
      >
        <div className="grid sm:grid-cols-2">
          <div className="border-b border-white/[0.06] bg-black/40 p-4 font-mono text-[13px] leading-[1.75] sm:border-b-0 sm:border-r">
            <p>
              <span className="text-primary">\section</span>
              <span className="text-white/65">{"{Experience}"}</span>
            </p>
            <p>
              <span className="text-[#ff8a00]">\role</span>
              <span className="text-white/65">{"{Analyst}{Northwind Ltd}"}</span>
            </p>
            <p className="text-primary/80">\begin{"{itemize}"}</p>
            <p className="pl-3 text-white/65">\item Built a cash forecast model...</p>
            <p className="min-h-[3.5em] pl-3 text-foreground">
              \item {shown}
              {!reduce && (
                <span className="ml-px inline-block h-3 w-px translate-y-0.5 animate-pulse bg-primary" />
              )}
            </p>
            <p className="text-primary/80">\end{"{itemize}"}</p>
          </div>

          <div className="bg-[#161616] p-4">
            <div className="bg-[#f5f2ed] px-4 py-4 text-neutral-900 shadow-lg">
              <p className="text-center font-serif text-[15px] leading-none">Alex Morgan</p>
              <p className="mt-1 text-center text-[9px] text-neutral-500">alex@example.com · London</p>
              <p className="mt-3 border-b border-neutral-300 pb-0.5 text-[9px] font-semibold uppercase tracking-[0.12em]">
                Experience
              </p>
              <div className="mt-1.5 flex justify-between text-[9.5px] font-semibold">
                <span>Analyst, Northwind Ltd</span>
                <span className="font-normal text-neutral-500">2023 to now</span>
              </div>
              <ul className="mt-1 list-disc space-y-0.5 pl-3 text-[9px] leading-snug text-neutral-700">
                <li>Built a cash forecast model...</li>
                <li className="min-h-[2.2em]">{shown}</li>
              </ul>
              <p className="mt-2.5 border-b border-neutral-300 pb-0.5 text-[9px] font-semibold uppercase tracking-[0.12em]">
                Skills
              </p>
              <p className="mt-1 text-[9px] text-neutral-700">Excel, Python, SQL, Power BI</p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-white/[0.06] px-4 py-3">
          <span className="mr-1 text-[13px] text-white/65">Job match</span>
          {MATCHES.map((m) => (
            <span
              key={m.req}
              className={
                m.state === "covered"
                  ? "flex items-center gap-1 rounded-lg bg-emerald-500/10 px-2 py-0.5 text-[13px] text-emerald-400"
                  : m.state === "partial"
                    ? "flex items-center gap-1 rounded-lg bg-amber-500/10 px-2 py-0.5 text-[13px] text-amber-300"
                    : "flex items-center gap-1 rounded-lg bg-white/[0.05] px-2 py-0.5 text-[13px] text-white/65"
              }
            >
              {m.state === "covered" ? (
                <Check className="size-3" aria-hidden />
              ) : m.state === "partial" ? (
                <CircleDashed className="size-3" aria-hidden />
              ) : (
                <Minus className="size-3" aria-hidden />
              )}
              {m.req}
            </span>
          ))}
        </div>
      </MockFrame>
    </div>
  );
}

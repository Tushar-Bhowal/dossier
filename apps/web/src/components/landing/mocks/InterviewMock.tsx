"use client";

import { Quote } from "lucide-react";
import { NumberTicker } from "@/components/ui/number-ticker";
import { MockFrame } from "./MockFrame";

const RUBRIC = [
  { name: "Structure", score: 8, note: "Clear situation and result." },
  { name: "Depth", score: 6, note: "Named the risk, never said how you tested it." },
  { name: "Ownership", score: 5, note: "Hedged the decision that was yours to make." },
];

export function InterviewMock() {
  return (
    <MockFrame
      title="Mock interview · report"
      label="Interview report: overall 6.8 out of 10, rubric scores for structure, depth and ownership, and a quote from the candidate's answer with a specific improvement."
      right={<span className="font-mono text-[13px] text-white/65">14:32 · voice</span>}
    >
      <div className="grid gap-3 p-4 sm:grid-cols-[180px_1fr] sm:p-5">
        <div className="flex flex-col items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.02] p-5">
          <div className="relative size-28">
            <svg viewBox="0 0 100 100" className="size-full -rotate-90" aria-hidden>
              <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="7" />
              <circle
                cx="50"
                cy="50"
                r="42"
                fill="none"
                stroke="url(#score)"
                strokeWidth="7"
                strokeLinecap="round"
                strokeDasharray={`${0.68 * 264} 264`}
              />
              <defs>
                <linearGradient id="score" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#ff8a00" />
                  <stop offset="100%" stopColor="#fb4128" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <NumberTicker
                value={6.8}
                decimalPlaces={1}
                className="text-3xl font-semibold tracking-tight text-foreground dark:text-foreground"
              />
              <span className="text-[12px] text-white/65">out of 10</span>
            </div>
          </div>
          <p className="mt-3 text-center text-[13px] text-white/65">
            Fillers <span className="text-foreground">11</span> · Pace{" "}
            <span className="text-foreground">148</span> wpm
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4">
            <p className="text-[13px] font-medium uppercase tracking-[0.1em] text-white/65">
              Q3 · Tell me about a finding a client pushed back on
            </p>
            <div className="mt-3 space-y-2.5">
              {RUBRIC.map((r) => (
                <div key={r.name} className="grid grid-cols-[80px_1fr_24px] items-center gap-3">
                  <span className="text-[13px] text-foreground/85">{r.name}</span>
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#ff8a00] to-primary"
                      style={{ width: `${r.score * 10}%` }}
                    />
                  </div>
                  <span className="text-right font-mono text-[13px] text-white/65">{r.score}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-lg border border-primary/25 bg-primary/[0.06] p-4">
            <div className="flex items-start gap-2.5">
              <Quote className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden />
              <div>
                <p className="text-[16px] font-semibold leading-snug text-white">
                  &ldquo;I think we probably could have, maybe, escalated it a bit earlier.&rdquo;
                </p>
                <p className="mt-2 text-[13px] leading-relaxed text-white/65">
                  Three hedges in one sentence. Say what you decided and why: &ldquo;I escalated it on day two
                  because the adjustment crossed materiality.&rdquo;
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </MockFrame>
  );
}

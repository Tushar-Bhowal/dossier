"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useInView, useReducedMotion } from "motion/react";
import { Check, CircleDashed, Download, ImagePlus, Minus, PenLine, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { MockFrame } from "../MockFrame";
import { EASE_OUT } from "../../motion/Reveal";

function useTicker(count: number, ms: number) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-15%" });
  const [n, setN] = useState(0);
  useEffect(() => {
    if (reduce || !inView || n >= count) return;
    const t = setTimeout(() => setN((v) => v + 1), ms);
    return () => clearTimeout(t);
  }, [reduce, inView, n, count, ms]);
  return [ref, reduce ? count : n] as const;
}

const QUESTIONS = [
  { q: "Which board does your school follow?", a: ["CBSE", "ICSE", "State board"], pick: 0 },
  {
    q: "About how many students do you teach?",
    a: ["Under 50", "50–100", "100–200", "200+"],
    pick: 2,
  },
  {
    q: "Did your students' results improve?",
    a: ["Pass rate went up", "Class toppers", "Not sure"],
    pick: 0,
  },
];

export function QuestionsMock() {
  const [ref, picked] = useTicker(QUESTIONS.length, 900);
  return (
    <div ref={ref}>
      <MockFrame
        title="A few quick questions"
        label="Three role-specific questions with tap-able answers: school board, number of students, and whether results improved. Answers get selected one by one."
        right={<span className="text-[13px] font-semibold text-white/65">{picked} of 3</span>}
      >
        <div className="space-y-5 p-5 sm:p-6">
          {QUESTIONS.map((item, qi) => (
            <div key={item.q}>
              <p className="text-[15px] font-semibold text-white">
                <span className="mr-1.5 text-[#ff7a5c]">{qi + 1}.</span>
                {item.q}
              </p>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {item.a.map((a, ai) => {
                  const on = qi < picked && ai === item.pick;
                  return (
                    <span
                      key={a}
                      className={cn(
                        "rounded-lg border px-3 py-1.5 text-[14px] font-semibold transition-all duration-300",
                        on
                          ? "scale-[1.03] border-[#dc3019] bg-[#dc3019] text-white shadow-[0_8px_24px_-8px_rgba(251,65,40,0.8)]"
                          : "border-white/10 bg-white/[0.03] text-white/75",
                      )}
                    >
                      {a}
                    </span>
                  );
                })}
                <span className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-[14px] font-semibold text-white/65">
                  <PenLine className="size-3.5" aria-hidden /> Other…
                </span>
              </div>
            </div>
          ))}
          <p className="border-t border-white/[0.06] pt-4 text-[14px] font-medium text-white/65">
            Don&apos;t know? Skip it. Nothing gets made up.
          </p>
        </div>
      </MockFrame>
    </div>
  );
}

const ROLES = [
  {
    role: "School teacher",
    duties: [
      "Lesson planning",
      "Preparing and checking exam papers",
      "Parent–teacher meetings",
      "Organising school events",
      "Remedial classes",
    ],
    ticked: [0, 1, 2],
  },
  {
    role: "Staff nurse",
    duties: [
      "Patient assessment and vitals",
      "Giving medication safely",
      "Charting in patient records",
      "Wound care and dressing",
      "Teaching patients and families",
    ],
    ticked: [0, 1, 2, 4],
  },
  {
    role: "Shop manager",
    duties: [
      "Daily cash and sales reports",
      "Ordering and counting stock",
      "Staff rotas and training",
      "Handling customer complaints",
      "Arranging displays",
    ],
    ticked: [0, 1, 3],
  },
];

export function DutiesMock() {
  const reduce = useReducedMotion();
  const [r, setR] = useState(0);
  useEffect(() => {
    if (reduce) return;
    const t = setInterval(() => setR((v) => (v + 1) % ROLES.length), 3400);
    return () => clearInterval(t);
  }, [reduce]);
  const role = ROLES[r];

  return (
    <MockFrame
      title="Which of these did you do?"
      label="A checklist of usual duties that changes with the role: a school teacher, a staff nurse and a shop manager each see their own list and tick what they did."
    >
      <div className="p-5 sm:p-6">
        <div className="flex flex-wrap gap-2">
          {ROLES.map((x, i) => (
            <span
              key={x.role}
              className={cn(
                "rounded-lg px-3 py-1.5 text-[14px] font-semibold transition-colors duration-300",
                i === r ? "bg-white text-neutral-900" : "bg-white/[0.05] text-white/65",
              )}
            >
              {x.role}
            </span>
          ))}
        </div>
        <AnimatePresence mode="wait" initial={false}>
          <motion.ul
            key={role.role}
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? undefined : { opacity: 0, y: -8 }}
            transition={{ duration: 0.3, ease: EASE_OUT }}
            className="mt-4 space-y-2"
          >
            {role.duties.map((d, i) => {
              const on = role.ticked.includes(i);
              return (
                <li
                  key={d}
                  className={cn(
                    "flex items-center gap-3 rounded-lg border px-3.5 py-2.5 text-[15px] font-medium",
                    on
                      ? "border-primary/30 bg-primary/[0.08] text-white"
                      : "border-white/[0.08] text-white/70",
                  )}
                >
                  <motion.span
                    initial={reduce ? false : { scale: 0.6 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.15 + i * 0.12, duration: 0.3 }}
                    className={cn(
                      "flex size-5 shrink-0 items-center justify-center rounded-md border",
                      on ? "border-[#dc3019] bg-[#dc3019] text-white" : "border-white/25",
                    )}
                  >
                    {on && <Check className="size-3.5" aria-hidden />}
                  </motion.span>
                  {d}
                </li>
              );
            })}
          </motion.ul>
        </AnimatePresence>
      </div>
    </MockFrame>
  );
}

export function PaperMock() {
  return (
    <MockFrame
      title="Ananya Sen · Resume"
      label="A finished one-page resume with Download PDF and Download Word buttons, a 'Fits on 1 page' label, and a photo suggestion because schools in India often ask for one."
      right={
        <span className="flex items-center gap-1.5 text-[13px] font-semibold text-emerald-400">
          <Check className="size-3.5" aria-hidden /> Fits on 1 page
        </span>
      }
    >
      <div className="grid gap-4 p-5 sm:grid-cols-[1fr_190px] sm:p-6">
        <div className="rounded-lg bg-[#f6f3ee] p-5 text-neutral-900">
          <p className="text-[19px] font-bold tracking-[-0.02em]">Ananya Sen</p>
          <p className="text-[12px] font-medium text-neutral-600">Kolkata · ananya.sen@example.com</p>
          {[
            ["Experience", [92, 78, 85, 70]],
            ["Education", [80, 72]],
            ["Skills", [88]],
          ].map(([h, lines]) => (
            <div key={h as string}>
              <p className="mb-1.5 mt-3.5 border-b border-neutral-300 pb-0.5 text-[12px] font-bold uppercase tracking-[0.12em]">
                {h as string}
              </p>
              {(lines as number[]).map((w, i) => (
                <div
                  key={i}
                  className="mt-1.5 h-[7px] rounded-full bg-neutral-300"
                  style={{ width: `${w}%` }}
                />
              ))}
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-2.5">
          <span className="flex items-center justify-center gap-2 rounded-lg bg-[#dc3019] px-3 py-2.5 text-[14px] font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.28)]">
            <Download className="size-4" aria-hidden /> PDF
          </span>
          <span className="flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2.5 text-[14px] font-semibold text-white">
            <Download className="size-4" aria-hidden /> Word
          </span>
          <div className="mt-1 rounded-lg border border-white/10 bg-white/[0.03] p-3.5">
            <p className="flex items-center gap-2 text-[14px] font-semibold text-white">
              <ImagePlus className="size-4 text-[#ff7a5c]" aria-hidden /> Add a photo?
            </p>
            <p className="mt-1.5 text-[13px] font-medium leading-snug text-white/65">
              Schools in India often ask for one. Off unless you turn it on.
            </p>
          </div>
          <p className="mt-auto text-[13px] font-semibold text-white/65">Free. No watermark.</p>
        </div>
      </div>
    </MockFrame>
  );
}

const ATS_ROWS = [
  "Name, email and phone found",
  "Headings read as Experience, Education, Skills",
  "All 9 lines read in the right order",
];

export function AtsMock() {
  const [ref, shown] = useTicker(ATS_ROWS.length, 700);
  return (
    <div ref={ref}>
      <MockFrame
        title="What the ATS sees"
        label="The plain text a hiring system pulls out of the resume, with three checks passing, and a writing tip suggesting a stronger opening verb."
      >
        <div className="space-y-4 p-5 sm:p-6">
          <div className="rounded-lg border border-white/[0.08] bg-black/40 p-4 font-mono text-[13px] leading-[1.8] text-white/75">
            <p className="text-white">ANANYA SEN</p>
            <p>Kolkata | ananya.sen@example.com</p>
            <p className="mt-2 text-[#ff7a5c]">EXPERIENCE</p>
            <p>Mathematics &amp; Science Teacher, Jun 2023 – Present</p>
            <p>• Teaches Mathematics and Science to classes 6 to 8</p>
          </div>
          <ul className="space-y-2">
            {ATS_ROWS.map((row, i) => (
              <li
                key={row}
                className={cn(
                  "flex items-center gap-2.5 text-[15px] font-medium transition-all duration-300",
                  i < shown ? "translate-x-0 text-white opacity-100" : "-translate-x-1 opacity-0",
                )}
              >
                <span className="flex size-5 items-center justify-center rounded-md bg-emerald-500/15 text-emerald-400">
                  <Check className="size-3.5" aria-hidden />
                </span>
                {row}
              </li>
            ))}
          </ul>
          <div className="rounded-lg border border-amber-400/25 bg-amber-400/[0.06] p-3.5">
            <p className="text-[14px] font-semibold text-amber-200">Writing tip</p>
            <p className="mt-1 text-[14px] font-medium leading-snug text-white/80">
              &ldquo;Responsible for exam duty&rdquo; hides what you did. Try starting with a verb, like
              &ldquo;Invigilated board exams&rdquo;.
            </p>
          </div>
        </div>
      </MockFrame>
    </div>
  );
}

const MATCHES = [
  {
    req: "Teaching classes 6 to 8",
    state: "covered",
    proof: "Teaches Mathematics and Science to classes 6 to 8",
  },
  { req: "CBSE experience", state: "covered", proof: "Teaches under the CBSE curriculum" },
  { req: "Smart class teaching", state: "partial", proof: "Only in your duties, no example yet" },
  { req: "CTET qualified", state: "missing", proof: "Have you cleared it? We'll ask, not assume." },
] as const;

export function TailorMock() {
  return (
    <MockFrame
      title="Match report · Maths teacher, Greenfield Public School"
      label="A match report for a job post: two requirements covered with the resume line that proves them, one partial, one missing, then a suggested change to accept or reject. No overall score."
    >
      <div className="space-y-2 p-5 sm:p-6">
        {MATCHES.map((m) => (
          <div
            key={m.req}
            className="flex items-start gap-3 rounded-lg border border-white/[0.08] bg-white/[0.02] px-3.5 py-3"
          >
            <span
              className={cn(
                "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md",
                m.state === "covered" && "bg-emerald-500/15 text-emerald-400",
                m.state === "partial" && "bg-amber-400/15 text-amber-300",
                m.state === "missing" && "bg-white/[0.07] text-white/65",
              )}
            >
              {m.state === "covered" ? (
                <Check className="size-3.5" aria-hidden />
              ) : m.state === "partial" ? (
                <CircleDashed className="size-3.5" aria-hidden />
              ) : (
                <Minus className="size-3.5" aria-hidden />
              )}
            </span>
            <div className="min-w-0">
              <p className="text-[15px] font-semibold text-white">{m.req}</p>
              <p className="mt-0.5 text-[13px] font-medium leading-snug text-white/65">
                {m.state === "covered" ? <>&ldquo;{m.proof}&rdquo;</> : m.proof}
              </p>
            </div>
          </div>
        ))}
        <div className="!mt-4 rounded-lg border border-primary/30 bg-primary/[0.07] p-4">
          <p className="text-[13px] font-semibold text-[#ff7a5c]">Suggested change</p>
          <p className="mt-1.5 text-[15px] font-medium leading-snug text-white">
            Teaches Mathematics and Science to classes 6 to 8{" "}
            <span className="rounded-md bg-emerald-500/15 px-1 text-emerald-300">
              using smart-class lessons
            </span>
          </p>
          <div className="mt-3 flex gap-2">
            <span className="flex items-center gap-1.5 rounded-lg bg-[#dc3019] px-3 py-1.5 text-[14px] font-semibold text-white">
              <Check className="size-3.5" aria-hidden /> Accept
            </span>
            <span className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-[14px] font-semibold text-white/80">
              <X className="size-3.5" aria-hidden /> Reject
            </span>
          </div>
        </div>
      </div>
    </MockFrame>
  );
}

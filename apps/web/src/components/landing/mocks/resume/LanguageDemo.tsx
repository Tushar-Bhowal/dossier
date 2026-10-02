"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useInView, useReducedMotion } from "motion/react";
import { ArrowDown, ArrowRight, Check, Mic, Paperclip } from "lucide-react";
import { cn } from "@/lib/utils";
import { EASE_OUT } from "../../motion/Reveal";

type Key = "teach" | "since" | "bed" | "board" | "exam";
type Part = string | [string, Key];

const LANGS: { id: string; label: string; name: string; parts: Part[] }[] = [
  {
    id: "bn",
    label: "বাংলা",
    name: "Bengali",
    parts: [
      "আমি St. Mary's School, Kolkata-তে ",
      ["June 2023 থেকে", "since"],
      " ",
      ["Maths আর Science পড়াই, class 6 থেকে 8", "teach"],
      "। ",
      ["B.Ed করেছি University of Calcutta থেকে 2022-এ", "bed"],
      "।",
    ],
  },
  {
    id: "hi",
    label: "हिंदी",
    name: "Hindi",
    parts: [
      "मैं St. Mary's School, Kolkata में ",
      ["June 2023 से", "since"],
      " ",
      ["class 6 से 8 तक Maths और Science पढ़ाती हूँ", "teach"],
      "। ",
      ["B.Ed University of Calcutta से 2022 में किया", "bed"],
      "।",
    ],
  },
  {
    id: "hinglish",
    label: "Hinglish",
    name: "Hinglish",
    parts: [
      "Main St. Mary's School, Kolkata mein ",
      ["June 2023 se", "since"],
      " ",
      ["class 6 se 8 tak Maths aur Science padhati hoon", "teach"],
      ". ",
      ["B.Ed Calcutta University se 2022 mein kiya", "bed"],
      ".",
    ],
  },
  {
    id: "en",
    label: "English",
    name: "English",
    parts: [
      "I've been at St. Mary's School, Kolkata ",
      ["since June 2023", "since"],
      ", ",
      ["teaching Maths and Science to classes 6 to 8", "teach"],
      ". ",
      ["Did my B.Ed at University of Calcutta in 2022", "bed"],
      ".",
    ],
  },
];

const ORDER: Key[] = ["teach", "since", "bed", "board", "exam"];
const STEP_MS = 2400;

function said(parts: Part[], key: Key) {
  const hit = parts.find((p): p is [string, Key] => Array.isArray(p) && p[1] === key);
  return hit?.[0];
}

export function LanguageDemo() {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-20%" });
  const [lang, setLang] = useState(0);
  const [step, setStep] = useState(0);
  const [held, setHeld] = useState<Key | null>(null);

  useEffect(() => {
    if (reduce || !inView || held) return;
    const t = setTimeout(() => {
      if (step === ORDER.length - 1) {
        setStep(0);
        setLang((l) => (l + 1) % LANGS.length);
      } else {
        setStep((s) => s + 1);
      }
    }, STEP_MS);
    return () => clearTimeout(t);
  }, [reduce, inView, held, step]);

  const active = held ?? ORDER[step];
  const current = LANGS[lang];
  const quote = said(current.parts, active);
  const source =
    active === "board"
      ? { label: "From your answer", detail: "you tapped “CBSE”" }
      : active === "exam"
        ? { label: "You ticked this", detail: "from the usual duties for teachers" }
        : { label: "From what you wrote", detail: `you said “${quote}”` };

  const hold = (key: Key) => ({
    onPointerEnter: () => setHeld(key),
    onPointerLeave: () => setHeld(null),
  });

  return (
    <div
      ref={ref}
      className="grid items-stretch gap-4 lg:grid-cols-[1fr_auto_1fr] lg:gap-5"
      aria-label="Example: a teacher describes her work in Bengali, Hindi, Hinglish or English, and Dossier writes an English resume where each line shows what it came from."
      role="group"
    >
      <div className="flex flex-col rounded-lg border border-white/10 bg-[#0f0f0f] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
        <div className="flex flex-wrap items-center gap-1.5 border-b border-white/[0.06] p-3">
          <span className="mr-1 pl-1 text-[13px] font-semibold text-white/65">Write in</span>
          {LANGS.map((l, i) => (
            <button
              key={l.id}
              type="button"
              aria-pressed={i === lang}
              onClick={() => {
                setLang(i);
                setStep(0);
              }}
              className={cn(
                "rounded-lg px-3 py-1.5 text-[14px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                i === lang
                  ? "bg-white text-neutral-900"
                  : "text-white/70 hover:bg-white/[0.06] hover:text-white",
              )}
            >
              {l.label}
            </button>
          ))}
        </div>

        <div className="flex flex-1 flex-col p-5 sm:p-6">
          <p className="text-[13px] font-semibold text-white/65">Ananya, a school teacher, types:</p>
          <AnimatePresence mode="wait" initial={false}>
            <motion.p
              key={current.id}
              lang={current.id === "hinglish" ? "hi-Latn" : current.id}
              initial={reduce ? false : { opacity: 0, y: 8, filter: "blur(4px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={reduce ? undefined : { opacity: 0, y: -8, filter: "blur(4px)" }}
              transition={{ duration: 0.35, ease: EASE_OUT }}
              className="mt-3 rounded-lg bg-white/[0.06] px-4 py-3.5 text-[17px] font-medium leading-[1.75] text-white/90"
            >
              {current.parts.map((p, i) =>
                typeof p === "string" ? (
                  <span key={i}>{p}</span>
                ) : (
                  <mark
                    key={i}
                    {...hold(p[1])}
                    className={cn(
                      "rounded-md px-0.5 transition-colors duration-300 [box-decoration-break:clone]",
                      active === p[1]
                        ? "bg-primary/25 text-white ring-1 ring-primary/50"
                        : "bg-transparent text-white/90",
                    )}
                  >
                    {p[0]}
                  </mark>
                ),
              )}
            </motion.p>
          </AnimatePresence>

          <p className="mt-5 text-[13px] font-semibold text-white/65">Then taps and ticks:</p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            <Chip on={active === "board"} {...hold("board")}>
              Board: CBSE
            </Chip>
            <Chip on={active === "exam"} {...hold("exam")}>
              <Check className="size-3.5" aria-hidden /> Preparing and checking exam papers
            </Chip>
          </div>

          <div className="mt-auto flex items-center gap-2 pt-6 text-white/55" aria-hidden>
            <span className="flex size-8 items-center justify-center rounded-lg border border-white/10">
              <Mic className="size-4" />
            </span>
            <span className="flex size-8 items-center justify-center rounded-lg border border-white/10">
              <Paperclip className="size-4" />
            </span>
            <span className="text-[14px] font-medium text-white/65">Speak it, or attach an old resume</span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center" aria-hidden>
        <span className="flex items-center gap-2 rounded-lg border border-primary/30 bg-[#1a0d0a] px-3.5 py-2 text-[14px] font-semibold text-[#ff7a5c] shadow-[0_0_40px_-10px_rgba(251,65,40,0.7)] lg:flex-col lg:px-2.5 lg:py-3.5">
          <ArrowDown className="size-4 lg:hidden" />
          <span className="lg:[writing-mode:vertical-rl]">Written in English</span>
          <ArrowRight className="hidden size-4 lg:block" />
        </span>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex-1 rounded-lg bg-[#f6f3ee] p-5 text-neutral-900 shadow-[0_30px_80px_-24px_rgba(0,0,0,0.9)] sm:p-7">
          <p className="text-[22px] font-bold tracking-[-0.02em]">Ananya Sen</p>
          <p className="mt-0.5 text-[13px] font-medium text-neutral-600">Kolkata · ananya.sen@example.com</p>

          <Heading>Experience</Heading>
          <div className="flex flex-wrap items-baseline justify-between gap-x-3">
            <p className="text-[15px] font-bold">Mathematics &amp; Science Teacher</p>
            <Line
              on={active === "since"}
              {...hold("since")}
              className="text-[13px] font-semibold text-neutral-600"
            >
              Jun 2023 – Present
            </Line>
          </div>
          <p className="text-[14px] font-medium text-neutral-600">St. Mary&apos;s School, Kolkata</p>
          <ul className="mt-2 space-y-1">
            <Bullet on={active === "teach"} {...hold("teach")}>
              Teaches Mathematics and Science to classes 6 to 8
            </Bullet>
            <Bullet on={active === "board"} {...hold("board")}>
              Teaches under the CBSE curriculum
            </Bullet>
            <Bullet on={active === "exam"} {...hold("exam")}>
              Prepares and checks exam papers
            </Bullet>
          </ul>

          <Heading>Education</Heading>
          <div className="flex items-baseline justify-between gap-3">
            <Line on={active === "bed"} {...hold("bed")} className="text-[14px] font-semibold">
              B.Ed, University of Calcutta
            </Line>
            <span className="text-[13px] font-semibold text-neutral-600">2022</span>
          </div>
          <div className="mt-1 flex items-baseline justify-between gap-3">
            <p className="text-[14px] font-semibold">B.Sc. in Mathematics, University of Calcutta</p>
            <span className="text-[13px] font-semibold text-neutral-600">2020</span>
          </div>
        </div>

        <div className="flex min-h-[64px] items-center gap-3 rounded-lg border border-white/10 bg-[#0f0f0f] px-4 py-3">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-[#dc3019] text-white">
            <Check className="size-4" aria-hidden />
          </span>
          <AnimatePresence mode="wait" initial={false}>
            <motion.p
              key={`${current.id}-${active}`}
              initial={reduce ? false : { opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? undefined : { opacity: 0, y: -4 }}
              transition={{ duration: 0.25 }}
              className="min-w-0 text-[14px] font-medium leading-snug text-white/75"
            >
              <span className="font-semibold text-white">{source.label}</span> — {source.detail}
            </motion.p>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

type HoldProps = { onPointerEnter: () => void; onPointerLeave: () => void };

function Chip({ on, children, ...rest }: { on: boolean; children: React.ReactNode } & HoldProps) {
  return (
    <span
      {...rest}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[14px] font-semibold transition-colors duration-300",
        on ? "border-primary/50 bg-primary/20 text-white" : "border-white/10 bg-white/[0.04] text-white/75",
      )}
    >
      {children}
    </span>
  );
}

function Heading({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2 mt-5 border-b border-neutral-300 pb-1 text-[12px] font-bold uppercase tracking-[0.12em] text-neutral-800">
      {children}
    </p>
  );
}

function Line({
  on,
  className,
  children,
  ...rest
}: { on: boolean; className?: string; children: React.ReactNode } & HoldProps) {
  return (
    <span
      {...rest}
      className={cn(
        "-mx-1 rounded-md px-1 transition-colors duration-300",
        on && "bg-[#ffd9cf] shadow-[inset_0_0_0_1px_rgba(220,48,25,0.45)]",
        className,
      )}
    >
      {children}
    </span>
  );
}

function Bullet({ on, children, ...rest }: { on: boolean; children: React.ReactNode } & HoldProps) {
  return (
    <li
      {...rest}
      className={cn(
        "-mx-1.5 flex gap-2 rounded-md px-1.5 py-0.5 text-[14px] font-medium leading-snug text-neutral-800 transition-colors duration-300",
        on && "bg-[#ffd9cf] shadow-[inset_0_0_0_1px_rgba(220,48,25,0.45)]",
      )}
    >
      <span className="mt-[0.55em] size-1.5 shrink-0 rounded-full bg-neutral-700" aria-hidden />
      {children}
    </li>
  );
}

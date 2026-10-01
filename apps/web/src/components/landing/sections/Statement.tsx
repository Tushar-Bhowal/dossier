"use client";

import { useRef } from "react";
import { motion, useReducedMotion, useScroll, useTransform, type MotionValue } from "motion/react";
import {
  Ban,
  Download,
  Globe,
  Link2,
  MessageSquareQuote,
  ScanSearch,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { Container } from "../SectionHeading";
import { Reveal } from "../motion/Reveal";

const TOKENS: (string | LucideIcon)[] = [
  "Prep",
  "for",
  "any",
  "role,",
  Globe,
  "backed",
  "by",
  "real",
  "sources,",
  Link2,
  "graded",
  "on",
  "your",
  "own",
  "words,",
  MessageSquareQuote,
  "and",
  "never",
  "locked",
  "behind",
  "a",
  "paywall.",
  Download,
];

const CHIPS = [
  { icon: Globe, label: "Any field, not just tech" },
  { icon: Link2, label: "Every claim sourced" },
  { icon: ScanSearch, label: "No fake ATS scores" },
  { icon: Ban, label: "No live-interview cheating" },
  { icon: ShieldCheck, label: "Private to your account" },
];

export function Statement() {
  const ref = useRef<HTMLParagraphElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 85%", "end 45%"] });

  return (
    <section className="relative py-24 sm:py-36">
      <Container className="flex flex-col items-center">
        <p
          ref={ref}
          className="max-w-4xl text-balance text-center text-[30px] font-semibold leading-[1.3] tracking-[-0.03em] text-white sm:text-[48px]"
        >
          {TOKENS.map((t, i) => {
            const range: [number, number] = [i / TOKENS.length, (i + 1) / TOKENS.length];
            return typeof t === "string" ? (
              <Token key={i} progress={scrollYProgress} range={range} still={!!reduce}>
                {t}
              </Token>
            ) : (
              <Token key={i} progress={scrollYProgress} range={range} still={!!reduce}>
                <IconChip icon={t} />
              </Token>
            );
          })}
        </p>

        <Reveal className="mt-14 flex max-w-4xl flex-wrap justify-center gap-3">
          {CHIPS.map(({ icon: Icon, label }) => (
            <span
              key={label}
              className="inline-flex items-center gap-2.5 rounded-lg border border-white/10 bg-white/[0.04] py-1.5 pl-1.5 pr-4 text-[15px] font-medium text-white/85 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
            >
              <span className="flex size-7 items-center justify-center rounded-lg bg-[#dc3019] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.3)]">
                <Icon className="size-4" aria-hidden />
              </span>
              {label}
            </span>
          ))}
        </Reveal>
      </Container>
    </section>
  );
}

function Token({
  children,
  progress,
  range,
  still,
}: {
  children: React.ReactNode;
  progress: MotionValue<number>;
  range: [number, number];
  still: boolean;
}) {
  const opacity = useTransform(progress, range, [0.35, 1]);
  return (
    <>
      <motion.span style={{ opacity: still ? 1 : opacity }} className="inline-block">
        {children}
      </motion.span>{" "}
    </>
  );
}

function IconChip({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <span className="inline-flex h-[0.8em] w-[1.25em] translate-y-[0.04em] items-center justify-center rounded-lg border border-primary/30 bg-primary/15 align-baseline">
      <Icon className="size-[0.48em] text-[#ff7a5c]" aria-hidden />
    </span>
  );
}

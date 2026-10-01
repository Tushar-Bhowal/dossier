"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "motion/react";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { LightRays } from "@/components/ui/light-rays";
import { NoiseTexture } from "@/components/ui/noise-texture";
import { AnimatedShinyText } from "@/components/ui/animated-shiny-text";
import { Accent, Container } from "../SectionHeading";
import { PrimaryButton, SecondaryButton } from "../Buttons";
import { EASE_OUT } from "../motion/Reveal";
import { RoadmapDemo } from "../mocks/RoadmapDemo";
import { Embers } from "../motion/Embers";

const LINES: { text: string; accent?: boolean }[][] = [
  [{ text: "Interview" }, { text: "prep" }, { text: "for" }, { text: "any" }, { text: "role," }],
  [{ text: "researched", accent: true }, { text: "for" }, { text: "you." }],
];

// CSS rather than motion: the headline must paint on the first frame, before any JavaScript runs.
function Word({ text, accent, i }: { text: string; accent?: boolean; i: number }) {
  return (
    <span
      className="inline-block animate-[word-in_0.8s_cubic-bezier(0.22,1,0.36,1)_both] motion-reduce:animate-none"
      style={{ animationDelay: `${0.1 + i * 0.06}s` }}
    >
      {accent ? <Accent>{text}</Accent> : text}
    </span>
  );
}

export function Hero() {
  const demoRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: demoRef, offset: ["start end", "start 30%"] });
  const rotateX = useTransform(scrollYProgress, [0, 1], [14, 0]);
  const scale = useTransform(scrollYProgress, [0, 1], [0.95, 1]);

  let wordIndex = 0;

  return (
    <section className="relative overflow-hidden pb-24 pt-36 sm:pb-36 sm:pt-48">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-0 h-[640px] w-[1200px] max-w-[200vw] -translate-x-1/2 bg-[radial-gradient(ellipse_45%_55%_at_50%_0%,rgba(255,96,48,0.30),rgba(255,96,48,0.08)_45%,transparent_75%)]" />
        <LightRays
          color="rgba(255, 96, 48, 0.24)"
          count={8}
          blur={40}
          speed={16}
          length="75vh"
          className="[mask-image:linear-gradient(to_bottom,black_30%,transparent_80%)]"
        />
        <Embers className="absolute inset-0 size-full" count={70} />
        <NoiseTexture className="opacity-[0.18] mix-blend-overlay dark:opacity-[0.18]" frequency={0.7} />
        <div className="absolute inset-x-0 bottom-0 h-56 bg-gradient-to-b from-transparent to-background" />
      </div>

      <Container className="relative flex flex-col items-center text-center">
        <motion.a
          href="#product"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE_OUT }}
          className="group mb-8 inline-flex items-center gap-2.5 rounded-lg border border-white/10 bg-white/[0.04] py-1.5 pl-1.5 pr-3.5 text-sm font-medium shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur transition-colors hover:border-white/20"
        >
          <span className="rounded-lg bg-primary/15 px-2 py-0.5 text-[13px] font-semibold text-[#ff7a5c]">
            New
          </span>
          <AnimatedShinyText className="mx-0 text-white/75 dark:text-white/75" shimmerWidth={80}>
            Roadmaps for any field, coming soon
          </AnimatedShinyText>
          <ArrowRight
            className="size-3.5 text-white/60 transition-transform group-hover:translate-x-0.5"
            aria-hidden
          />
        </motion.a>

        <h1 className="max-w-5xl text-balance text-[42px] font-semibold leading-[1.04] tracking-[-0.045em] text-white sm:text-[76px]">
          {LINES.map((line, li) => (
            <span key={li} className="block">
              {line.map((w, wi) => (
                <span key={wi}>
                  <Word text={w.text} accent={w.accent} i={wordIndex++} />
                  {wi < line.length - 1 && " "}
                </span>
              ))}
            </span>
          ))}
        </h1>

        <p className="mt-7 max-w-2xl text-pretty text-[17px] leading-relaxed text-white/70 sm:text-xl">
          Dossier studies how real companies hire, then turns it into a roadmap, practice, a mock interview
          that tells you the truth, and a resume that fits the job.
        </p>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: EASE_OUT, delay: 0.45 }}
          className="mt-10 flex w-full flex-col items-center gap-3 sm:w-auto sm:flex-row"
        >
          <PrimaryButton href="/login?mode=register" className="w-full sm:w-auto">
            Start free <ArrowUpRight className="size-[18px]" aria-hidden />
          </PrimaryButton>
          <SecondaryButton href="#how" className="w-full sm:w-auto">
            See how it works
          </SecondaryButton>
        </motion.div>

        <p className="mt-6 text-sm font-medium text-white/55">
          Free to start · No card needed · PDF export always free
        </p>

        <div ref={demoRef} className="relative mt-20 w-full max-w-[1080px] [perspective:1400px] sm:mt-24">
          <div
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-[-60px] h-[1400px] w-[2400px] -translate-x-1/2 rounded-[50%] border-t border-white/[0.14] shadow-[0_-1px_40px_rgba(251,65,40,0.25)] [mask-image:linear-gradient(to_right,transparent_10%,black_35%,black_65%,transparent_90%)]"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -inset-x-16 -top-16 bottom-0 rounded-[50%] bg-[radial-gradient(ellipse_at_top,rgba(251,65,40,0.28),transparent_60%)] blur-2xl"
          />
          <motion.div
            style={{ rotateX, scale, transformOrigin: "50% 0%" }}
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, ease: EASE_OUT, delay: 0.35 }}
            className="relative"
          >
            <RoadmapDemo />
          </motion.div>
        </div>
      </Container>
    </section>
  );
}

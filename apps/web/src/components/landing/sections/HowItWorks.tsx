"use client";

import { useRef } from "react";
import { motion, useInView } from "motion/react";
import { Workflow } from "lucide-react";
import { Accent, Container, Section, SectionHeading } from "../SectionHeading";
import { Reveal } from "../motion/Reveal";

const STEPS = [
  {
    title: "Name the target",
    body: "A skill like JavaScript, a role like audit associate, or a real job posting. Add your interview date if you have one.",
  },
  {
    title: "We research hiring",
    body: "Careers pages, public guides and candidate reports become interview rounds, each linked to where it came from.",
  },
  {
    title: "Learn, then practise",
    body: "Concepts first, then drills, then scenario questions, with flashcards that come back just before you forget.",
  },
  {
    title: "Rehearse out loud",
    body: "A mock interview grades every answer, quotes what you said, and turns weak spots into your next lessons.",
  },
];

export function HowItWorks() {
  return (
    <Section id="how">
      <Container>
        <SectionHeading
          icon={Workflow}
          eyebrow="How it works"
          title={
            <>
              From a job title to <Accent>interview-ready</Accent>.
            </>
          }
          sub="The research happens once, up front. Everything after it is built around you and the date on your calendar."
        />

        <ol className="mt-16 grid gap-4 sm:mt-20 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <Reveal
              as="li"
              key={s.title}
              delay={i * 0.08}
              className="flex flex-col overflow-hidden rounded-lg border border-white/[0.08] bg-[#0f0f0f] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
            >
              <Burst rays={9 + i * 5} />
              <div className="flex items-center gap-3 border-y border-white/[0.06] bg-white/[0.03] px-5 py-3.5">
                <span className="flex size-8 items-center justify-center rounded-lg bg-[#dc3019] text-sm font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.3)]">
                  {i + 1}
                </span>
                <h3 className="text-[18px] font-semibold tracking-[-0.02em] text-white">{s.title}</h3>
              </div>
              <p className="p-5 text-base leading-relaxed text-white/70">{s.body}</p>
            </Reveal>
          ))}
        </ol>
      </Container>
    </Section>
  );
}

// Rays fanning up from a point on the floor; more of them each step, like light growing brighter.
function Burst({ rays }: { rays: number }) {
  const ref = useRef<SVGSVGElement>(null);
  const inView = useInView(ref, { once: true, margin: "-15%" });
  const lines = Array.from({ length: rays }, (_, k) => {
    const t = rays === 1 ? 0.5 : k / (rays - 1);
    const angle = Math.PI * (0.08 + 0.84 * t);
    const len = 70 + 40 * Math.sin(t * Math.PI) * (k % 2 ? 0.7 : 1);
    return {
      x2: Math.round((120 - Math.cos(angle) * len) * 100) / 100,
      y2: Math.round((130 - Math.sin(angle) * len) * 100) / 100,
      k,
    };
  });
  return (
    <div className="relative flex h-40 items-end justify-center overflow-hidden" aria-hidden>
      <div className="absolute bottom-0 left-1/2 h-24 w-40 -translate-x-1/2 rounded-[50%] bg-[radial-gradient(ellipse_at_bottom,rgba(251,65,40,0.35),transparent_70%)] blur-xl" />
      <svg ref={ref} viewBox="0 0 240 130" className="relative h-full w-full">
        <defs>
          <linearGradient id={`burst-${rays}`} x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="#ff8a00" />
            <stop offset="100%" stopColor="#fb4128" stopOpacity="0" />
          </linearGradient>
        </defs>
        {lines.map(({ x2, y2, k }) => (
          <motion.line
            key={k}
            x1="120"
            y1="130"
            x2={x2}
            y2={y2}
            stroke={`url(#burst-${rays})`}
            strokeWidth="1.5"
            strokeLinecap="round"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={inView ? { pathLength: 1, opacity: 1 } : {}}
            transition={{ duration: 0.9, delay: 0.1 + k * 0.03, ease: [0.22, 1, 0.36, 1] }}
          />
        ))}
        <circle cx="120" cy="130" r="5" fill="#ff8a00" />
      </svg>
    </div>
  );
}

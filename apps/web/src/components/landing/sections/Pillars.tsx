"use client";

import { useRef } from "react";
import { motion, useInView } from "motion/react";
import { Check, FileText, Layers, Map, Mic, Route, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Accent, Container, Section, SectionHeading } from "../SectionHeading";
import { Reveal } from "../motion/Reveal";
import { SpotlightCard } from "../SpotlightCard";

type Pillar = {
  icon: LucideIcon;
  name: string;
  status: "Live" | "Soon";
  body: string;
  visual: React.ReactNode;
  wide?: boolean;
};

const PILLARS: Pillar[] = [
  {
    icon: Map,
    name: "Roadmaps",
    status: "Soon",
    body: "Pick any skill or role. Get a staged path from first concepts to scenario questions, built from how companies actually interview.",
    visual: <StagesVisual />,
    wide: true,
  },
  {
    icon: Mic,
    name: "Mock interview",
    status: "Soon",
    body: "A voice interviewer that grades you against a rubric and quotes your own words back.",
    visual: <WaveVisual />,
  },
  {
    icon: FileText,
    name: "Resume Studio",
    status: "Soon",
    body: "Talk through your experience. Edit the LaTeX on the left, watch the PDF on the right.",
    visual: <ResumeVisual />,
  },
  {
    icon: Route,
    name: "Company kits",
    status: "Live",
    body: "Paste a job description and a company URL. Get a researched prep kit, with a source behind every item.",
    visual: <KitVisual />,
    wide: true,
  },
];

export function Pillars() {
  return (
    <Section id="product">
      <Container>
        <SectionHeading
          icon={Layers}
          eyebrow="The platform"
          title={
            <>
              Four tools. <Accent>One</Accent> loop.
            </>
          }
          sub="Most people juggle a course, a mock-interview app, a resume builder and a spreadsheet. Dossier is one place where each part feeds the next."
        />

        <div className="mt-16 grid gap-4 sm:mt-20 md:grid-cols-5">
          {PILLARS.map((p, i) => {
            const live = p.status === "Live";
            return (
              <Reveal key={p.name} delay={i * 0.06} className={p.wide ? "md:col-span-3" : "md:col-span-2"}>
                <SpotlightCard brand={live} className="flex h-full flex-col">
                  <div
                    className={cn(
                      "relative h-56 overflow-hidden border-b",
                      live ? "border-white/20" : "border-white/[0.06]",
                    )}
                  >
                    {p.visual}
                  </div>
                  <div className="flex flex-1 flex-col p-6 sm:p-7">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span
                          className={cn(
                            "flex size-9 items-center justify-center rounded-lg",
                            live
                              ? "bg-white text-[#dc3019]"
                              : "bg-primary/15 text-[#ff7a5c] ring-1 ring-primary/25",
                          )}
                        >
                          <p.icon className="size-[18px]" aria-hidden />
                        </span>
                        <h3 className="text-[22px] font-semibold tracking-[-0.02em] text-white">{p.name}</h3>
                      </div>
                      <span
                        className={cn(
                          "shrink-0 rounded-lg px-2.5 py-1 text-[13px] font-semibold",
                          live ? "bg-white text-[#b9260f]" : "bg-white/[0.06] text-white/70",
                        )}
                      >
                        {live ? "Live now" : "Coming soon"}
                      </span>
                    </div>
                    <p
                      className={cn(
                        "mt-4 text-base leading-relaxed",
                        live ? "text-white/90" : "text-white/70",
                      )}
                    >
                      {p.body}
                    </p>
                  </div>
                </SpotlightCard>
              </Reveal>
            );
          })}
        </div>
      </Container>
    </Section>
  );
}

function StagesVisual() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-20%" });
  const stages = ["Concepts", "Practice", "Scenario", "Mock"];
  return (
    <div ref={ref} className="absolute inset-0 flex items-center px-8 sm:px-12" aria-hidden>
      <div className="relative w-full">
        <div className="absolute left-0 right-0 top-[7px] h-px bg-white/10" />
        <motion.div
          className="absolute left-0 top-[7px] h-px origin-left bg-gradient-to-r from-[#ff8a00] to-primary"
          style={{ right: "33%" }}
          initial={{ scaleX: 0 }}
          animate={inView ? { scaleX: 1 } : {}}
          transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
        />
        <div className="relative flex justify-between">
          {stages.map((s, i) => (
            <div key={s} className="flex flex-col items-center gap-3">
              <motion.span
                className={cn(
                  "size-[15px] rounded-full border-2",
                  i < 3 ? "border-primary bg-primary/30" : "border-white/20 bg-background",
                )}
                initial={{ scale: 0.4, opacity: 0 }}
                animate={inView ? { scale: 1, opacity: 1 } : {}}
                transition={{ delay: 0.25 + i * 0.3, duration: 0.4 }}
              />
              <span className="text-[13px] text-white/65">{s}</span>
              <span className="font-mono text-[12px] text-white/65">
                {i < 2 ? <Check className="inline size-3 text-primary" /> : i === 2 ? "in progress" : "next"}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const BARS = [0.35, 0.6, 0.9, 0.5, 0.75, 1, 0.55, 0.8, 0.4, 0.7, 0.95, 0.5, 0.3, 0.65, 0.85, 0.45];

function WaveVisual() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-10%" });
  return (
    <div ref={ref} className="absolute inset-0 flex flex-col items-center justify-center gap-5" aria-hidden>
      <div className="flex h-16 items-center gap-1">
        {BARS.map((h, i) => (
          <motion.span
            key={i}
            className="w-1 rounded-full bg-gradient-to-t from-[#ff8a00] to-primary"
            style={{ height: 64, scaleY: h * 0.6 }}
            animate={inView ? { scaleY: [h * 0.4, h, h * 0.55, h * 0.85, h * 0.4] } : {}}
            transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut", delay: i * 0.07 }}
          />
        ))}
      </div>
      <span className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1 font-mono text-[13px] text-white/65">
        <span className="size-1.5 animate-pulse rounded-full bg-primary" /> interviewer speaking
      </span>
    </div>
  );
}

function ResumeVisual() {
  return (
    <div className="absolute inset-0 grid grid-cols-2 gap-3 p-5" aria-hidden>
      <div className="space-y-1.5 rounded-lg border border-white/[0.06] bg-black/50 p-3 font-mono text-[12px] leading-relaxed">
        <p className="text-primary/90">\section{"{Experience}"}</p>
        <p className="text-white/65">\resumeItem{"{"}</p>
        <p className="pl-2 text-white/65">Cut close time</p>
        <p className="pl-2 text-white/65">by 40% across</p>
        <p className="pl-2 text-white/65">3 entities{"}"}</p>
        <p className="text-[#ff8a00]/80">
          \skills{"{"}Excel, SQL{"}"}
        </p>
      </div>
      <div className="rounded-lg bg-[#f4f1ec] p-3">
        <div className="mx-auto h-1.5 w-1/2 rounded-full bg-neutral-800" />
        <div className="mx-auto mt-1.5 h-1 w-1/3 rounded-full bg-neutral-400" />
        <div className="mt-3 h-1 w-1/3 rounded-full bg-neutral-700" />
        <div className="mt-1.5 h-px w-full bg-neutral-300" />
        {[90, 75, 82, 60].map((w, i) => (
          <div key={i} className="mt-1.5 h-1 rounded-full bg-neutral-400" style={{ width: `${w}%` }} />
        ))}
        <div className="mt-3 h-1 w-1/4 rounded-full bg-neutral-700" />
        <div className="mt-1.5 h-px w-full bg-neutral-300" />
        {[70, 85].map((w, i) => (
          <div key={i} className="mt-1.5 h-1 rounded-full bg-neutral-400" style={{ width: `${w}%` }} />
        ))}
      </div>
    </div>
  );
}

function KitVisual() {
  const items = [
    {
      tag: "Technical",
      q: "How would you model deferred revenue in this schema?",
      src: "Job description",
    },
    {
      tag: "Company fit",
      q: "Why this team's approach to pricing, specifically?",
      src: "Company blog",
    },
    { tag: "Behavioural", q: "Tell me about a launch that slipped.", src: "Candidate reports" },
  ];
  return (
    <div className="absolute inset-0 flex flex-col justify-center gap-2 px-6 sm:px-8" aria-hidden>
      {items.map((it, i) => (
        <div
          key={it.q}
          className="flex items-center gap-3 rounded-lg border border-white/20 bg-black/25 px-3.5 py-3 backdrop-blur"
          style={{ opacity: 1 - i * 0.18 }}
        >
          <span className="shrink-0 rounded-lg bg-white px-2 py-0.5 text-[12px] font-semibold text-[#b9260f]">
            {it.tag}
          </span>
          <span className="min-w-0 flex-1 truncate text-[14px] font-medium text-white">{it.q}</span>
          <span className="hidden shrink-0 items-center gap-1 text-[12px] font-medium text-white/80 sm:flex">
            <Check className="size-3.5 text-white" /> {it.src}
          </span>
        </div>
      ))}
    </div>
  );
}

"use client";

import { forwardRef, useRef } from "react";
import Image from "next/image";
import { useReducedMotion } from "motion/react";
import {
  Briefcase,
  FileText,
  Gauge,
  Globe,
  Map,
  Mic,
  RefreshCw,
  Search,
  Users,
  type LucideIcon,
} from "lucide-react";
import { AnimatedBeam } from "@/components/ui/animated-beam";
import { cn } from "@/lib/utils";
import { Accent, Container, Section, SectionHeading } from "../SectionHeading";
import { Reveal } from "../motion/Reveal";
import { SpotlightCard } from "../SpotlightCard";

export function Loop() {
  return (
    <Section id="loop">
      <Container>
        <SectionHeading
          icon={RefreshCw}
          eyebrow="The loop"
          title={
            <>
              Every weak answer becomes your <Accent>next</Accent> lesson.
            </>
          }
          sub="Your resume, your practice and your mock interviews share one memory, so nothing you learn about yourself gets lost between tools."
        />

        <div className="mt-16 grid gap-4 sm:mt-20 md:grid-cols-3">
          <Reveal className="md:col-span-2">
            <SpotlightCard className="h-full p-6 sm:p-8">
              <BeamDiagram />
              <h3 className="mt-8 text-[22px] font-semibold tracking-[-0.02em] text-white">
                Weak spots close themselves
              </h3>
              <p className="mt-2 max-w-xl text-base leading-relaxed text-white/70">
                A low score doesn&apos;t sit in a report. It becomes a topic, drills and flashcards on your
                roadmap, and the next mock checks whether it stuck.
              </p>
            </SpotlightCard>
          </Reveal>

          <Reveal delay={0.06}>
            <Card
              title="Story bank"
              body="Your best stories, pulled from your resume and ready for any behavioural question."
            >
              <div className="space-y-2">
                <div className="rounded-lg border border-primary/25 bg-primary/[0.07] p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-[14px] font-semibold text-white">
                      Rebuilt the month-end close
                    </span>
                    <span className="shrink-0 rounded-lg bg-white/[0.08] px-2 py-0.5 text-[12px] font-semibold text-white/75">
                      used 3×
                    </span>
                  </div>
                  <dl className="mt-3 space-y-2">
                    {[
                      ["S", "Close took 9 days; auditors flagged it"],
                      ["T", "Get it under a week"],
                      ["A", "Automated the reconciliations"],
                      ["R", "5 days, no late adjustments"],
                    ].map(([k, v]) => (
                      <div key={k} className="flex items-center gap-2.5">
                        <dt className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-[#dc3019] text-[12px] font-bold text-white">
                          {k}
                        </dt>
                        <dd className="truncate text-[13px] font-medium text-white/80">{v}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
                {["Calmed an upset client", "Taught the team SQL"].map((story, i) => (
                  <div
                    key={story}
                    className="flex items-center justify-between rounded-lg border border-white/[0.08] bg-white/[0.03] px-3.5 py-2.5"
                  >
                    <span className="truncate text-[14px] font-medium text-white/85">{story}</span>
                    <span className="ml-2 shrink-0 rounded-lg bg-white/[0.06] px-2 py-0.5 text-[12px] font-semibold text-white/65">
                      used {2 - i}×
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          </Reveal>

          <Reveal delay={0.1}>
            <Card
              title="Drill me on my resume"
              body="The interviewer reads your bullets and asks what a sharp hiring manager would."
            >
              <div className="rounded-lg border border-white/[0.08] bg-black/40 p-4">
                <p className="text-[14px] leading-relaxed text-white/70">
                  Automated reconciliations,{" "}
                  <mark className="rounded-lg bg-primary/20 px-1 text-white">
                    cutting close from 9 days to 5
                  </mark>
                </p>
                <div className="mt-4 flex items-start gap-2.5">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-[#dc3019] text-white">
                    <Mic className="size-3.5" aria-hidden />
                  </span>
                  <p className="text-[14px] font-medium leading-relaxed text-white">
                    Which step was slowest before, and how did you prove it?
                  </p>
                </div>
              </div>
            </Card>
          </Reveal>

          <Reveal delay={0.14} className="md:col-span-2">
            <Card
              title="Sourced, always"
              body="Research tells you where each claim came from and how sure it is. Thin evidence is labelled, never dressed up."
            >
              <div className="grid gap-2.5 sm:grid-cols-3">
                {[
                  { icon: Globe, kind: "Official", text: "Firm careers page", n: 2 },
                  { icon: Search, kind: "Guide", text: "Assessment guide", n: 1 },
                  { icon: Users, kind: "Candidates", text: "Interview threads", n: 4 },
                ].map((s) => (
                  <div key={s.kind} className="rounded-lg border border-white/[0.08] bg-white/[0.03] p-4">
                    <div className="flex items-center justify-between">
                      <span className="flex size-8 items-center justify-center rounded-lg bg-primary/15 text-[#ff7a5c]">
                        <s.icon className="size-4" aria-hidden />
                      </span>
                      <span className="font-mono text-[13px] text-white/60">×{s.n}</span>
                    </div>
                    <p className="mt-3 text-[15px] font-semibold text-white">{s.text}</p>
                    <p className="text-[13px] font-medium text-white/60">{s.kind}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-center gap-3">
                <span className="text-[13px] font-medium text-white/65">Confidence</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/[0.07]">
                  <div className="h-full w-[72%] rounded-full bg-gradient-to-r from-[#ff8a00] to-[#fb4128]" />
                </div>
                <span className="text-[13px] font-semibold text-white">High</span>
              </div>
            </Card>
          </Reveal>
        </div>
      </Container>
    </Section>
  );
}

function Card({ title, body, children }: { title: string; body: string; children: React.ReactNode }) {
  return (
    <SpotlightCard className="flex h-full flex-col p-6 sm:p-7">
      <div className="flex-1">{children}</div>
      <h3 className="mt-7 text-[22px] font-semibold tracking-[-0.02em] text-white">{title}</h3>
      <p className="mt-2 text-base leading-relaxed text-white/70">{body}</p>
    </SpotlightCard>
  );
}

const Node = forwardRef<HTMLDivElement, { icon: LucideIcon; label: string; className?: string }>(
  function Node({ icon: Icon, label, className }, ref) {
    return (
      <div className={cn("relative z-10 flex flex-col items-center gap-2", className)}>
        <div
          ref={ref}
          className="flex size-12 items-center justify-center rounded-lg border border-white/12 bg-[#151515] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_8px_24px_-8px_rgba(0,0,0,0.8)] sm:size-14"
        >
          <Icon className="size-5 text-[#ff7a5c]" aria-hidden />
        </div>
        <span className="text-[13px] font-semibold text-white/80">{label}</span>
      </div>
    );
  },
);

function BeamDiagram() {
  const reduce = useReducedMotion();
  const container = useRef<HTMLDivElement>(null);
  const resume = useRef<HTMLDivElement>(null);
  const job = useRef<HTMLDivElement>(null);
  const hub = useRef<HTMLDivElement>(null);
  const roadmap = useRef<HTMLDivElement>(null);
  const mock = useRef<HTMLDivElement>(null);
  const report = useRef<HTMLDivElement>(null);

  const beam = {
    containerRef: container,
    gradientStartColor: "#ff8a00",
    gradientStopColor: "#fb4128",
    pathColor: "#ffffff",
    pathOpacity: reduce ? 0.25 : 0.08,
    duration: 4,
    repeat: reduce ? 0 : Infinity,
  };

  return (
    <div
      ref={container}
      className="relative flex items-center justify-between gap-4 px-1 py-4 sm:px-6"
      role="img"
      aria-label="Your resume and a job post flow into Dossier, which builds your roadmap and mock interviews; the interview report flows back into Dossier."
    >
      <div className="flex flex-col gap-10">
        <Node ref={resume} icon={FileText} label="Resume" />
        <Node ref={job} icon={Briefcase} label="Job post" />
      </div>

      <div className="relative z-10 flex flex-col items-center gap-2">
        <div
          ref={hub}
          className="flex size-20 items-center justify-center rounded-lg border border-[#ff6a4a]/40 bg-[#1a0d0a] shadow-[0_0_60px_-10px_rgba(251,65,40,0.7),inset_0_1px_0_rgba(255,255,255,0.1)] sm:size-24"
        >
          <Image src="/logo.png" alt="" width={48} height={48} className="size-10 sm:size-12" />
        </div>
        <span className="text-[13px] font-bold text-white">Dossier</span>
      </div>

      <div className="flex flex-col gap-6">
        <Node ref={roadmap} icon={Map} label="Roadmap" />
        <Node ref={mock} icon={Mic} label="Mock" />
        <Node ref={report} icon={Gauge} label="Report" />
      </div>

      <AnimatedBeam {...beam} fromRef={resume} toRef={hub} curvature={-30} />
      <AnimatedBeam {...beam} fromRef={job} toRef={hub} curvature={30} delay={0.6} />
      <AnimatedBeam {...beam} fromRef={hub} toRef={roadmap} curvature={-30} delay={1.2} />
      <AnimatedBeam {...beam} fromRef={hub} toRef={mock} delay={1.6} />
      <AnimatedBeam {...beam} fromRef={report} toRef={hub} curvature={30} reverse delay={2.2} />
    </div>
  );
}

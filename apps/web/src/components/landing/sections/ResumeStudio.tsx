"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useInView } from "motion/react";
import { FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { Accent, Container, Section, SectionHeading } from "../SectionHeading";
import { Reveal, EASE_OUT } from "../motion/Reveal";
import { LanguageDemo } from "../mocks/resume/LanguageDemo";
import { AtsMock, DutiesMock, PaperMock, QuestionsMock, TailorMock } from "../mocks/resume/StoryMocks";

const STEPS = [
  {
    title: "Tap, don't type",
    body: "A few short questions picked for your role, each with answers you can tap. Don't know one? Skip it.",
    Mock: QuestionsMock,
  },
  {
    title: "Tick what you actually did",
    body: "Dossier lists the usual duties for your job, whether that's a classroom, a hospital ward or a shop floor. Tick yours, and only those go in.",
    Mock: DutiesMock,
  },
  {
    title: "A finished file, not a text dump",
    body: "One clean layout that sizes itself to fill the page. Download it as a PDF or a Word file, free, with no watermark. A photo is suggested only where your field expects one.",
    Mock: PaperMock,
  },
  {
    title: "See what the ATS sees",
    body: "Hiring systems read your resume as plain text. Dossier shows you exactly what they pull out, plus tips for lines that undersell you.",
    Mock: AtsMock,
  },
  {
    title: "Tailor it to a job, honestly",
    body: "Paste a job post or start from a company kit. Every requirement is marked covered, partial or missing, with the line that proves it. No made-up score, and you approve every change.",
    Mock: TailorMock,
  },
];

export function ResumeStudio() {
  const [active, setActive] = useState(0);
  const Active = STEPS[active].Mock;

  return (
    <Section id="resume-studio">
      <Container>
        <SectionHeading
          icon={FileText}
          eyebrow="Resume Studio · launching next"
          title={
            <>
              Say it your way. Get a resume in <Accent>English</Accent>.
            </>
          }
          sub="For teachers, nurses, shop managers and freshers, not just developers. Type or speak in any language, and every line on your resume is something you actually told us."
        />

        <Reveal className="relative mt-16 sm:mt-20">
          <div
            aria-hidden
            className="pointer-events-none absolute -inset-x-10 -inset-y-16 rounded-[50%] bg-[radial-gradient(ellipse_at_center,rgba(251,65,40,0.13),transparent_70%)] blur-2xl"
          />
          <div className="relative">
            <LanguageDemo />
          </div>
        </Reveal>

        <div className="mt-24 grid gap-x-16 sm:mt-32 lg:grid-cols-[0.8fr_1.2fr]">
          <ol className="relative flex flex-col gap-16 lg:gap-0">
            <span
              aria-hidden
              className="absolute bottom-[35vh] left-[15px] top-[35vh] hidden w-px bg-white/10 lg:block"
            >
              <span
                className="absolute inset-0 origin-top bg-gradient-to-b from-[#ff8a00] to-[#fb4128] transition-transform duration-700"
                style={{ transform: `scaleY(${active / (STEPS.length - 1)})` }}
              />
            </span>
            {STEPS.map((s, i) => (
              <Step key={s.title} index={i} active={active === i} onActive={setActive} {...s} />
            ))}
          </ol>

          <div className="hidden lg:block">
            <div className="sticky top-[calc(50vh-280px)] flex h-[560px] items-center">
              <div className="relative w-full">
                <div
                  aria-hidden
                  className="absolute -inset-10 rounded-[50%] bg-[radial-gradient(ellipse_at_center,rgba(251,65,40,0.16),transparent_70%)] blur-2xl"
                />
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={active}
                    initial={{ opacity: 0, y: 24, filter: "blur(6px)" }}
                    animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                    exit={{ opacity: 0, y: -24, filter: "blur(6px)" }}
                    transition={{ duration: 0.45, ease: EASE_OUT }}
                    className="relative"
                  >
                    <Active />
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>
      </Container>
    </Section>
  );
}

function Step({
  index,
  title,
  body,
  Mock,
  active,
  onActive,
}: {
  index: number;
  title: string;
  body: string;
  Mock: () => React.ReactNode;
  active: boolean;
  onActive: (i: number) => void;
}) {
  const ref = useRef<HTMLLIElement>(null);
  const inMiddle = useInView(ref, { margin: "-50% 0px -50% 0px" });

  useEffect(() => {
    if (inMiddle) onActive(index);
  }, [inMiddle, index, onActive]);

  return (
    <li ref={ref} className="relative lg:flex lg:min-h-[70vh] lg:items-center">
      <Reveal>
        <div className={cn("relative transition-opacity duration-500 lg:pl-14", !active && "lg:opacity-35")}>
          <span
            className={cn(
              "flex size-8 items-center justify-center rounded-lg text-sm font-bold transition-colors duration-500 lg:absolute lg:left-0 lg:top-1/2 lg:-translate-y-1/2",
              active
                ? "bg-[#dc3019] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_8px_24px_-8px_rgba(251,65,40,0.8)]"
                : "bg-[#1a1a1a] text-white/80 ring-1 ring-white/10",
            )}
          >
            {index + 1}
          </span>
          <h3 className="mt-5 text-balance text-[28px] font-semibold leading-[1.1] tracking-[-0.03em] text-white sm:text-[36px] lg:mt-0">
            {title}
          </h3>
          <p className="mt-4 max-w-md text-pretty text-[17px] leading-relaxed text-white/70">{body}</p>
        </div>
      </Reveal>
      <div className="mt-8 lg:hidden">
        <Mock />
      </div>
    </li>
  );
}

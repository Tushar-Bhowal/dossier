import { Check, FileText, Map, Mic, LayoutGrid, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Accent, Container, Eyebrow, Section, SectionHeading } from "../SectionHeading";
import { Reveal } from "../motion/Reveal";
import { TopicMock } from "../mocks/TopicMock";
import { InterviewMock } from "../mocks/InterviewMock";
import { ResumeMock } from "../mocks/ResumeMock";

const ROWS = [
  {
    icon: Map as LucideIcon,
    eyebrow: "Roadmaps",
    title: (
      <>
        Concepts first. <Accent>Then</Accent> the curveballs.
      </>
    ),
    body: "Every roadmap starts by making sure you understand the idea, then drills it, then throws the scenario questions real interviewers ask.",
    points: [
      "Interview rounds discovered per field, not a one-size template",
      "Every question shows where it came from",
      "Flashcards that return just before you'd forget",
    ],
    mock: <TopicMock />,
  },
  {
    icon: Mic as LucideIcon,
    eyebrow: "Mock interview",
    title: (
      <>
        Feedback that <Accent>quotes</Accent> you.
      </>
    ),
    body: "Generic feedback is the top complaint about AI interview tools. Dossier's grader has to point at your actual words before it's allowed to score them.",
    points: [
      "Speak out loud with a voice interviewer, or type",
      "Scored on structure, depth and ownership",
      "Filler words and pace, straight from the transcript",
    ],
    mock: <InterviewMock />,
  },
  {
    icon: FileText as LucideIcon,
    eyebrow: "Resume Studio",
    title: (
      <>
        LaTeX quality, <Accent>without</Accent> the LaTeX.
      </>
    ),
    body: "Tell it about your work in plain words. It writes the LaTeX, compiles it in your browser, and shows you exactly which job requirements your resume proves.",
    points: [
      "Chat or dictate, then edit the source by hand",
      "Upload an old resume to start from",
      "Tailor to a job with a diff you approve",
    ],
    mock: <ResumeMock />,
  },
];

export function DeepDives() {
  return (
    <Section id="features">
      <Container>
        <SectionHeading
          icon={LayoutGrid}
          eyebrow="Features"
          title={
            <>
              Built for the <Accent>hard</Accent> parts.
            </>
          }
          sub="The places other tools go vague are where Dossier gets specific."
        />

        <div className="mt-20 flex flex-col gap-24 sm:mt-28 sm:gap-40">
          {ROWS.map((row, i) => (
            <div
              key={row.eyebrow}
              className={cn(
                "grid items-center gap-10 lg:gap-16",
                i % 2 === 1 ? "lg:grid-cols-[1.15fr_0.85fr]" : "lg:grid-cols-[0.85fr_1.15fr]",
              )}
            >
              <Reveal className={cn(i % 2 === 1 && "lg:order-2")}>
                <Eyebrow icon={row.icon}>{row.eyebrow}</Eyebrow>
                <h3 className="mt-6 text-balance text-[32px] font-semibold leading-[1.08] tracking-[-0.035em] text-white sm:text-[44px]">
                  {row.title}
                </h3>
                <p className="mt-5 text-pretty text-[17px] leading-relaxed text-white/70 sm:text-lg">
                  {row.body}
                </p>
                <ul className="mt-7 space-y-3">
                  {row.points.map((p) => (
                    <li key={p} className="flex items-start gap-3 text-base font-medium text-white/85">
                      <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-lg bg-[#dc3019] shadow-[inset_0_1px_0_rgba(255,255,255,0.3)]">
                        <Check className="size-3.5 text-white" aria-hidden />
                      </span>
                      {p}
                    </li>
                  ))}
                </ul>
              </Reveal>
              <Reveal delay={0.1} className="relative">
                <div
                  aria-hidden
                  className="absolute -inset-8 rounded-[50%] bg-[radial-gradient(ellipse_at_center,rgba(251,65,40,0.14),transparent_70%)] blur-2xl"
                />
                <div className="relative">{row.mock}</div>
              </Reveal>
            </div>
          ))}
        </div>
      </Container>
    </Section>
  );
}

import { Ban, Download, Link2, ScanSearch, ShieldCheck } from "lucide-react";
import { Accent, Container, Section, SectionHeading } from "../SectionHeading";
import { Reveal } from "../motion/Reveal";
import { SpotlightCard } from "../SpotlightCard";

const PRINCIPLES = [
  {
    icon: Download,
    title: "Free PDF and Word. Always.",
    body: "No 45 minutes of work followed by a paywall on the download button, and no watermark.",
  },
  {
    icon: ScanSearch,
    title: "No fake ATS score",
    body: "Instead of a made-up number, you see which job requirements your resume actually proves, line by line.",
  },
  {
    icon: Link2,
    title: "Nothing made up",
    body: "Research links back to where it came from. Every resume line traces back to something you told us.",
  },
  {
    icon: Ban,
    title: "Prep, not cheating",
    body: "No hidden copilot feeding you answers in a real interview. You'll walk in actually knowing it.",
  },
];

export function Principles() {
  return (
    <Section id="principles">
      <Container>
        <SectionHeading
          icon={ShieldCheck}
          eyebrow="Principles"
          title={
            <>
              Built to be <Accent>honest</Accent> with you.
            </>
          }
          sub="Career tools are known for dark patterns. These are the lines Dossier doesn't cross."
        />

        <div className="mt-16 grid gap-4 sm:mt-20 sm:grid-cols-2 lg:grid-cols-4">
          {PRINCIPLES.map((p, i) => (
            <Reveal key={p.title} delay={i * 0.06}>
              <SpotlightCard className="h-full p-7">
                <span className="flex size-11 items-center justify-center rounded-lg bg-[#dc3019] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_8px_24px_-8px_rgba(251,65,40,0.7)]">
                  <p.icon className="size-5" aria-hidden />
                </span>
                <h3 className="mt-7 text-[20px] font-semibold tracking-[-0.02em] text-white">{p.title}</h3>
                <p className="mt-2.5 text-base leading-relaxed text-white/70">{p.body}</p>
              </SpotlightCard>
            </Reveal>
          ))}
        </div>
      </Container>
    </Section>
  );
}

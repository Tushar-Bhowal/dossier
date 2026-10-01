import { Accordion } from "radix-ui";
import { CircleHelp, Plus } from "lucide-react";
import { Container, Section, SectionHeading, Accent } from "../SectionHeading";
import { Reveal } from "../motion/Reveal";

const FAQS = [
  {
    q: "Is Dossier free?",
    a: "Yes, it's free to start and needs no card. Resume Studio's PDF export will always be free, with no paywall at the download button.",
  },
  {
    q: "Which fields does it cover?",
    a: "Any field. Dossier doesn't use a fixed list of industries. It researches how your target role is interviewed and builds the rounds from that, whether it's audit, marketing, nursing or software.",
  },
  {
    q: "Where does the research come from?",
    a: "Public sources only: company careers pages, published guides and candidate discussions. Each item links back to its source, candidate reports are labelled as such, and thin evidence is marked low-confidence instead of filled in.",
  },
  {
    q: "What's available today?",
    a: "Company kits are live now: paste a job description and a company URL and get a researched prep kit. Roadmaps, the mock interviewer and Resume Studio are being built and will roll out in that order.",
  },
  {
    q: "Is the mock interview a real conversation?",
    a: "Yes, you speak and the interviewer responds out loud. A separate grader then reviews the full transcript, so the feedback is careful rather than instant. You can also type if you prefer.",
  },
  {
    q: "Will it help me during a live interview?",
    a: "No, deliberately. Dossier prepares you beforehand. It won't listen to a real interview or feed you answers.",
  },
  {
    q: "What happens to my data?",
    a: "Everything you create is private to your account, and you can delete any of it at any time.",
  },
];

export function Faq() {
  return (
    <Section id="faq">
      <Container className="max-w-[820px]">
        <SectionHeading
          icon={CircleHelp}
          eyebrow="FAQ"
          title={
            <>
              Questions, <Accent>answered</Accent>.
            </>
          }
        />
        <Reveal className="mt-14 sm:mt-16">
          <Accordion.Root type="single" collapsible className="flex flex-col gap-2">
            {FAQS.map((f) => (
              <Accordion.Item
                key={f.q}
                value={f.q}
                className="overflow-hidden rounded-lg border border-white/[0.08] bg-[#0f0f0f] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] transition-colors data-[state=open]:border-primary/30"
              >
                <Accordion.Header>
                  <Accordion.Trigger className="group flex w-full items-center justify-between gap-6 px-5 py-5 text-left text-[17px] font-semibold text-white outline-none transition-colors hover:text-foreground focus-visible:bg-white/[0.03] sm:px-6 sm:py-5">
                    {f.q}
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-[#ff7a5c] transition-transform duration-300 group-data-[state=open]:rotate-45">
                      <Plus className="size-4" aria-hidden />
                    </span>
                  </Accordion.Trigger>
                </Accordion.Header>
                <Accordion.Content className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down motion-reduce:animate-none">
                  <p className="px-5 pb-5 text-base leading-relaxed text-white/70 sm:px-6 sm:pb-6">{f.a}</p>
                </Accordion.Content>
              </Accordion.Item>
            ))}
          </Accordion.Root>
        </Reveal>
      </Container>
    </Section>
  );
}

import { BookOpen, CirclePlay, Link2, Newspaper, RotateCcw } from "lucide-react";
import { MockFrame } from "./MockFrame";

export function TopicMock() {
  return (
    <MockFrame
      title="Big Four audit associate"
      label="Topic view: Materiality and audit risk, with an explanation, a practice question with its source, a flashcard due tomorrow, and two linked resources."
      right={<span className="font-mono text-[13px] text-white/65">02 / 08 concepts</span>}
    >
      <div className="grid gap-3 p-4 sm:p-5 lg:grid-cols-[1.25fr_1fr]">
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4">
          <div className="flex items-center gap-2 text-[13px] text-primary">
            <BookOpen className="size-3.5" aria-hidden /> Concept
          </div>
          <h4 className="mt-2 text-[15px] font-medium tracking-tight">Materiality and audit risk</h4>
          <p className="mt-2 text-[14px] leading-relaxed text-white/65">
            Materiality is the size of a misstatement that would change a reader&apos;s decision. Audit risk
            is the chance you sign off on statements that are materially wrong, and it falls as you gather
            more evidence.
          </p>
          <div className="mt-4 rounded-lg border border-white/[0.06] bg-black/40 p-3">
            <p className="text-[13px] font-medium uppercase tracking-[0.1em] text-white/65">
              Practice question
            </p>
            <p className="mt-1.5 text-[14px] text-foreground/90">
              Revenue is up 30% but receivables are up 80%. What do you test first, and why?
            </p>
            <p className="mt-2 flex items-center gap-1.5 text-[13px] text-white/65">
              <Link2 className="size-3 text-primary" aria-hidden /> Seen in candidate reports · 3 sources
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <div className="relative rounded-lg border border-white/[0.06] bg-gradient-to-br from-white/[0.04] to-transparent p-4">
            <div className="flex items-center justify-between text-[13px] text-white/65">
              <span>Flashcard · box 3</span>
              <span className="flex items-center gap-1">
                <RotateCcw className="size-3" aria-hidden /> due tomorrow
              </span>
            </div>
            <p className="mt-3 text-[14px] font-medium">What lowers detection risk?</p>
            <p className="mt-1.5 text-[13px] text-white/65">
              More, better evidence: larger samples, substantive testing.
            </p>
          </div>
          <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4">
            <p className="text-[13px] font-medium uppercase tracking-[0.1em] text-white/65">Resources</p>
            <ul className="mt-2.5 space-y-2">
              <li className="flex items-center gap-2.5 text-[13px] text-foreground/85">
                <CirclePlay className="size-4 shrink-0 text-primary" aria-hidden />
                <span className="truncate">Audit risk model, explained simply · 12 min</span>
              </li>
              <li className="flex items-center gap-2.5 text-[13px] text-foreground/85">
                <Newspaper className="size-4 shrink-0 text-white/65" aria-hidden />
                <span className="truncate">Setting materiality: a worked example</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </MockFrame>
  );
}

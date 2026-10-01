"use client";

import * as React from "react";
import { CheckCircle2, CircleAlert, Lightbulb, LoaderCircle, ScanText, XCircle } from "lucide-react";
import type { LintHint, RenderData } from "@dossier/core/resume";
import { useResumePdf } from "@/lib/resume/typst/compiler";
import { extractPdfText } from "@/lib/resume/pdfText";
import { checkAtsText, type AtsCheckResult, type CheckStatus } from "@/lib/resume/atsCheck";
import { useScenario } from "@/lib/resume/demo/scenario";
import { cn } from "@/lib/utils";

const STATUS_ICON: Record<CheckStatus, React.ReactNode> = {
  pass: <CheckCircle2 className="size-5 text-emerald-400" aria-label="Passed" />,
  warn: <CircleAlert className="size-5 text-amber-300" aria-label="Worth a look" />,
  fail: <XCircle className="size-5 text-destructive" aria-label="Problem" />,
};

function AtsPreview({ data }: { data: RenderData }) {
  const scenario = useScenario();
  const { pdf, source, status } = useResumePdf(data, { debounceMs: 600, simulateFailure: scenario.fail === "typst" });
  const [result, setResult] = React.useState<{ text: string; check: AtsCheckResult } | null>(null);
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    if (!pdf || !source) return;
    let cancelled = false;
    extractPdfText(pdf).then(
      (text) => {
        if (cancelled) return;
        setFailed(false);
        setResult({ text, check: checkAtsText(source, text) });
      },
      () => {
        if (!cancelled) setFailed(true);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [pdf, source]);

  return (
    <section className="rounded-lg border border-white/[0.08] bg-[#111111] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-[#ff7a5c] ring-1 ring-primary/25">
          <ScanText className="size-[18px]" aria-hidden />
        </span>
        <div>
          <h2 className="text-lg font-semibold text-white">What an ATS sees</h2>
          <p className="mt-1 text-sm leading-relaxed text-white/60">
            We read the text back out of your actual PDF, the way an applicant tracking system does, and check
            nothing got lost or scrambled.
          </p>
        </div>
      </div>

      {status === "error" || failed ? (
        <p role="alert" className="mt-4 text-sm font-medium text-amber-300">
          This check needs the PDF, and it couldn&apos;t be rendered right now. Your Word download still works.
        </p>
      ) : !result ? (
        <p role="status" className="mt-4 flex items-center gap-2 text-sm font-medium text-white/60">
          <LoaderCircle className="size-4 animate-spin" aria-hidden />
          Reading your PDF…
        </p>
      ) : (
        <>
          <ul className="mt-4 flex flex-col gap-3">
            {result.check.checks.map((c) => (
              <li key={c.id} className="flex items-start gap-3">
                <span className="mt-0.5 shrink-0">{STATUS_ICON[c.status]}</span>
                <div>
                  <p className="text-[15px] font-semibold text-white">{c.label}</p>
                  <p className="text-sm leading-relaxed text-white/60">{c.detail}</p>
                </div>
              </li>
            ))}
          </ul>
          {result.check.missingBullets.length > 0 && (
            <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 p-4">
              <p className="text-sm font-semibold text-white">These lines didn&apos;t read back cleanly:</p>
              <ul className="mt-2 list-disc pl-5 text-sm text-white/75">
                {result.check.missingBullets.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            </div>
          )}
          <details className="mt-4 rounded-lg border border-white/[0.08] bg-white/[0.02] p-4">
            <summary className="cursor-pointer text-sm font-semibold text-white/80">Show the exact text an ATS reads</summary>
            <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap font-sans text-sm leading-relaxed text-white/70">
              {result.text}
            </pre>
          </details>
        </>
      )}
    </section>
  );
}

function LintList({ hints, onJump }: { hints: LintHint[]; onJump: (targetId: string) => void }) {
  return (
    <section className="rounded-lg border border-white/[0.08] bg-[#111111] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/25">
          <Lightbulb className="size-[18px]" aria-hidden />
        </span>
        <div>
          <h2 className="text-lg font-semibold text-white">Writing tips</h2>
          <p className="mt-1 text-sm leading-relaxed text-white/60">
            Suggestions, not rules. Ignore any that don&apos;t fit your work.
          </p>
        </div>
      </div>
      {hints.length === 0 ? (
        <p className="mt-4 flex items-center gap-2 text-sm font-medium text-emerald-300">
          <CheckCircle2 className="size-4" aria-hidden />
          Nothing to flag. Your lines read clearly.
        </p>
      ) : (
        <ul className="mt-4 flex flex-col gap-2">
          {hints.map((h, i) => (
            <li key={`${h.targetId}-${h.rule}-${i}`}>
              <button
                type="button"
                onClick={() => onJump(h.targetId)}
                className={cn(
                  "w-full rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 text-left text-sm font-medium leading-relaxed text-white/80",
                  "transition-colors hover:border-white/15 hover:text-white",
                )}
              >
                {h.message}
                <span className="mt-1 block text-[13px] font-semibold text-[#ff7a5c]">Go to this line</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function CheckPanel({
  data,
  hints,
  onJump,
}: {
  data: RenderData;
  hints: LintHint[];
  onJump: (targetId: string) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <AtsPreview data={data} />
      <LintList hints={hints} onJump={onJump} />
    </div>
  );
}

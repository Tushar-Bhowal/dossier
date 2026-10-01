"use client";

import { Check, X } from "lucide-react";
import type { Fact, Proposal, Requirement } from "@dossier/core/resume";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type Decision = "accepted" | "rejected";

export function ProposalDiff({
  proposal,
  facts,
  requirements,
  decision,
  onDecide,
}: {
  proposal: Proposal;
  facts: Map<string, Fact>;
  requirements: Map<string, Requirement>;
  decision: Decision | undefined;
  onDecide: (decision: Decision | undefined) => void;
}) {
  const settled = proposal.status !== "pending";
  const shown = settled ? proposal.status : decision;
  const cited = proposal.change.factIds.map((id) => facts.get(id)).filter((f): f is Fact => Boolean(f));
  const reasons = proposal.requirementIds.map((id) => requirements.get(id)?.text).filter(Boolean);

  return (
    <li
      className={cn(
        "rounded-lg border p-4 transition-colors",
        shown === "accepted"
          ? "border-emerald-500/35 bg-emerald-500/[0.06]"
          : shown === "rejected"
            ? "border-white/[0.06] bg-white/[0.01] opacity-60"
            : "border-white/[0.08] bg-white/[0.02]",
      )}
    >
      {reasons.length > 0 && <p className="text-[13px] font-semibold text-[#ff7a5c]">For: {reasons.join(" · ")}</p>}

      <div className="mt-2 flex flex-col gap-2">
        {proposal.before ? (
          <p className="text-sm leading-relaxed text-white/50">
            <span className="mr-2 font-semibold text-white/40">Now</span>
            <span className="line-through decoration-white/30">{proposal.before}</span>
          </p>
        ) : (
          <p className="text-[13px] font-semibold text-white/45">New line</p>
        )}
        <p className="text-[15px] font-medium leading-relaxed text-white">
          {proposal.before && <span className="mr-2 text-sm font-semibold text-emerald-300">New</span>}
          {proposal.change.text}
        </p>
      </div>

      {cited.length > 0 && (
        <div className="mt-3 rounded-lg border border-white/[0.06] bg-black/20 p-3">
          <p className="text-[13px] font-semibold text-white/55">Based only on what you told us:</p>
          <ul className="mt-1.5 flex flex-col gap-1">
            {cited.map((f) => (
              <li key={f.id} className="text-sm leading-relaxed text-white/75">
                “{f.text}”
              </li>
            ))}
          </ul>
        </div>
      )}

      {settled ? (
        <p className="mt-3 text-sm font-semibold text-white/60">{proposal.status === "accepted" ? "Added to your resume" : "Skipped"}</p>
      ) : (
        <div className="mt-3 flex gap-2">
          <Button
            size="sm"
            variant={decision === "accepted" ? "default" : "outline"}
            aria-pressed={decision === "accepted"}
            onClick={() => onDecide(decision === "accepted" ? undefined : "accepted")}
          >
            <Check className="size-3.5" />
            Accept
          </Button>
          <Button
            size="sm"
            variant="outline"
            aria-pressed={decision === "rejected"}
            className={cn(decision === "rejected" && "border-white/25 bg-white/[0.08]")}
            onClick={() => onDecide(decision === "rejected" ? undefined : "rejected")}
          >
            <X className="size-3.5" />
            Skip
          </Button>
        </div>
      )}
    </li>
  );
}

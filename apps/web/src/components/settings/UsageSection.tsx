"use client";

import { useQuery } from "@tanstack/react-query";
import type { QuotaKind, UsageMeter } from "@dossier/core/account";
import { AlertCircle, Clock, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { QuotaNotice } from "@/components/quota-notice";
import { accountKeys, getUsage } from "@/lib/account/api";
import { formatResetTime } from "@/lib/account/usage";
import { cn } from "@/lib/utils";
import { Panel, SettingsSection } from "./parts";

const METERS: Record<QuotaKind, { label: string; hint: string }> = {
  research: { label: "Kits and roadmaps built", hint: "Each new interview kit or roadmap counts as one." },
  llm: { label: "AI edits and answers", hint: "Chat replies, resume edits and other quick AI help." },
  voice: { label: "Mock interviews", hint: "Spoken practice interviews." },
};

// Your own key lifts these two; mock interviews keep their limit either way.
const LIFTED_BY_OWN_KEY: QuotaKind[] = ["research", "llm"];

function Meter({ meter, unlimited }: { meter: UsageMeter; unlimited: boolean }) {
  const { label, hint } = METERS[meter.kind];
  const ratio = meter.used / meter.limit;
  const full = !unlimited && meter.used >= meter.limit;
  const near = !unlimited && !full && ratio >= 0.8;

  return (
    <li className="flex flex-col gap-3 py-5 first:pt-0 last:pb-0">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <p className="text-[15px] font-semibold text-white">{label}</p>
          <p className="mt-0.5 text-sm font-medium text-white/55">{hint}</p>
        </div>
        <p
          className={cn(
            "text-[15px] font-semibold tabular-nums",
            full ? "text-amber-300" : near ? "text-amber-200" : unlimited ? "text-emerald-300" : "text-white/80",
          )}
        >
          {unlimited
            ? `No daily limit · ${meter.used} today`
            : full
              ? `All ${meter.limit} used`
              : `${meter.used} of ${meter.limit} used`}
        </p>
      </div>
      {!unlimited && (
        <Progress
          value={Math.min(100, ratio * 100)}
          aria-label={`${label}: ${meter.used} of ${meter.limit} used today`}
          className={cn(
            "h-2 bg-white/[0.06]",
            full || near ? "*:data-[slot=progress-indicator]:bg-amber-400" : "*:data-[slot=progress-indicator]:bg-[#ff7a5c]",
          )}
        />
      )}
    </li>
  );
}

export function UsageSection() {
  const usage = useQuery({ queryKey: accountKeys.usage, queryFn: getUsage });
  const data = usage.data;
  const capped =
    data && !data.ownKey && data.meters.some((m) => LIFTED_BY_OWN_KEY.includes(m.kind) && m.used >= m.limit);

  return (
    <SettingsSection
      id="usage"
      sample
      title="Today's AI use"
      description="Dossier is free, so everyone gets a daily allowance of AI help. Anything you've already made stays usable when it runs out."
    >
      <div className="flex flex-col gap-4">
        {capped && <QuotaNotice resetsAt={data.resetsAt} />}

        {usage.isPending ? (
          <Panel aria-busy="true">
            <span className="sr-only" role="status">
              Loading today&apos;s usage…
            </span>
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex flex-col gap-3 py-5 first:pt-0 last:pb-0">
                <div className="flex justify-between gap-4">
                  <Skeleton className="h-5 w-48 rounded-lg bg-white/[0.06]" />
                  <Skeleton className="h-5 w-24 rounded-lg bg-white/[0.06]" />
                </div>
                <Skeleton className="h-4 w-64 max-w-full rounded-lg bg-white/[0.04]" />
                <Skeleton className="h-2 w-full rounded-full bg-white/[0.06]" />
              </div>
            ))}
          </Panel>
        ) : usage.isError ? (
          <Panel className="flex flex-col gap-4 border-destructive/30 bg-destructive/[0.06] sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3" role="alert">
              <AlertCircle className="mt-0.5 size-5 shrink-0 text-destructive" aria-hidden />
              <div>
                <p className="text-[15px] font-semibold text-white">We couldn&apos;t load today&apos;s usage</p>
                <p className="mt-1 text-sm leading-relaxed text-white/70">
                  Your limits still apply as normal. Try again in a moment.
                </p>
              </div>
            </div>
            <Button variant="outline" className="h-11 shrink-0 sm:h-10" onClick={() => void usage.refetch()}>
              <RefreshCcw className="size-4" aria-hidden />
              Try again
            </Button>
          </Panel>
        ) : (
          <Panel>
            <ul className="flex flex-col divide-y divide-white/[0.06]">
              {usage.data.meters.map((meter) => (
                <Meter key={meter.kind} meter={meter} unlimited={usage.data.ownKey && LIFTED_BY_OWN_KEY.includes(meter.kind)} />
              ))}
            </ul>
            <p className="mt-6 flex items-center gap-2 border-t border-white/[0.06] pt-5 text-sm font-medium text-white/60">
              <Clock className="size-4 shrink-0" aria-hidden />
              Resets at {formatResetTime(usage.data.resetsAt)} your time (midnight UTC).
            </p>
          </Panel>
        )}
      </div>
    </SettingsSection>
  );
}

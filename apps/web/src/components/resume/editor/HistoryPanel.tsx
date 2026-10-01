"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { History, RotateCcw } from "lucide-react";
import type { ResumeSnapshot } from "@dossier/core/resume";
import { getResumeHistory, resumeKeys } from "@/lib/resume/api";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { AiErrorNotice } from "../AiStatus";

function when(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

export function HistoryPanel({ resumeId, onRestore }: { resumeId: string; onRestore: (snapshot: ResumeSnapshot) => void }) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: resumeKeys.history(resumeId),
    queryFn: () => getResumeHistory(resumeId),
  });
  const [pending, setPending] = React.useState<ResumeSnapshot | null>(null);

  return (
    <section className="rounded-lg border border-white/[0.08] bg-[#111111] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-[#ff7a5c] ring-1 ring-primary/25">
          <History className="size-[18px]" aria-hidden />
        </span>
        <div>
          <h2 className="text-lg font-semibold text-white">Earlier versions</h2>
          <p className="mt-1 text-sm leading-relaxed text-white/60">We keep your last 20 versions.</p>
        </div>
      </div>

      {isLoading && <Skeleton className="mt-4 h-24 w-full rounded-lg" />}
      {error && <AiErrorNotice className="mt-4" error={error} onRetry={() => void refetch()} />}
      {data && data.length === 0 && (
        <p className="mt-4 text-sm font-medium text-white/60">No earlier versions yet. They appear as you edit.</p>
      )}
      {data && data.length > 0 && (
        <ol className="mt-4 flex flex-col gap-2">
          {data.map((snapshot) => (
            <li
              key={snapshot.at + snapshot.note}
              className="flex items-center justify-between gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3"
            >
              <div>
                <p className="text-[15px] font-semibold text-white">{snapshot.note}</p>
                <p className="text-sm font-medium text-white/55">{when(snapshot.at)}</p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => setPending(snapshot)}>
                <RotateCcw className="size-3.5" />
                Restore
              </Button>
            </li>
          ))}
        </ol>
      )}

      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open) setPending(null);
        }}
        title="Restore this version?"
        description="It replaces the sections on your resume now. Your contact details stay as they are."
        confirmLabel="Restore"
        confirmingLabel="Restoring…"
        variant="default"
        onConfirm={() => {
          if (pending) onRestore(pending);
        }}
      />
    </section>
  );
}

"use client";

import * as React from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import {
  AlertCircle,
  Briefcase,
  CalendarDays,
  FileText,
  FolderKanban,
  HelpCircle,
  Layers,
  Plus,
  RefreshCcw,
} from "lucide-react";
import { listKits } from "@/lib/api";
import { useMe } from "@/hooks/use-me";
import { LightRays } from "@/components/ui/light-rays";
import { useActiveRuns } from "@/hooks/use-active-runs";
import { NewKitTile } from "@/components/kit/NewKitTile";
import { KitCard } from "@/components/kit/KitCard";
import { GeneratingKitCard } from "@/components/kit/GeneratingKitCard";
import { CreateKitSheet } from "@/components/kit/CreateKitSheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default function KitsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { activeRuns, summary } = useActiveRuns();
  const { data: user } = useMe();

  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [prefillSample, setPrefillSample] = React.useState(false);

  // ?new=true auto-opens the sheet. Adjusted during render rather than in an effect, so the sheet
  // doesn't paint closed for a frame first when arriving on this URL directly.
  const newParam = searchParams?.get("new");
  const [lastNewParam, setLastNewParam] = React.useState<string | null | undefined>(null);
  if (newParam !== lastNewParam) {
    setLastNewParam(newParam);
    if (newParam === "true") {
      setSheetOpen(true);
      if (searchParams?.get("sample") === "true") {
        setPrefillSample(true);
      }
    }
  }

  const handleOpenSheet = (withSample = false) => {
    setPrefillSample(withSample);
    setSheetOpen(true);
  };

  const handleSheetOpenChange = (open: boolean) => {
    setSheetOpen(open);
    if (!open) {
      setPrefillSample(false);
      // Clean up URL query if ?new was present
      if (searchParams?.get("new") === "true") {
        router.replace("/kits");
      }
    }
  };

  const {
    data: kits,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["kits"],
    queryFn: listKits,
  });

  // A run's card stays mounted for a few seconds after it succeeds so its own completion state can
  // show — the just-finished kit must not also render as a second, separate KitCard in the same
  // grid while that's happening. Scoped to `succeeded` runs only: a run in any other state must
  // never suppress a real kit, or a stuck card would hide a kit the user already owns.
  const activeKitIds = React.useMemo(
    () =>
      new Set(
        activeRuns
          .filter((r) => r.status === "succeeded")
          .map((r) => r.kitId)
          .filter((id): id is string => Boolean(id)),
      ),
    [activeRuns],
  );
  const visibleKits = React.useMemo(
    () => kits?.filter((kit) => !activeKitIds.has(kit.id)),
    [kits, activeKitIds],
  );

  const hasActiveRuns = activeRuns.length > 0;
  const hasKits = Boolean(kits && kits.length > 0);
  const isEmpty = !isLoading && !hasKits && !hasActiveRuns;

  // Built from every state a run card can be in, so the badge always accounts for the cards on
  // screen — counting only running/queued left it reading "2 running" above five cards, or
  // rendering as a bare pulsing dot with no text at all once nothing was left in flight.
  // "Slot #N" counts position within the queue, not the index of the card in the whole grid.
  const queuePositions = React.useMemo(() => {
    const positions = new Map<string, number>();
    let position = 0;
    for (const run of activeRuns) {
      if (run.status !== "queued") continue;
      position += 1;
      positions.set(run.id, position);
    }
    return positions;
  }, [activeRuns]);

  const isBusy = summary.runningCount > 0 || summary.queuedCount > 0;
  const activityLabel = [
    summary.runningCount > 0 && `${summary.runningCount} running`,
    summary.queuedCount > 0 && `${summary.queuedCount} queued`,
    summary.attentionCount > 0 && `${summary.attentionCount} needs attention`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="mx-auto flex w-full flex-col gap-8">
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="text-[15px] font-medium text-white/55">
            {greeting()}
            {user?.email ? `, ${user.email.split("@")[0]}` : ""}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-3">
            <h1 className="text-[32px] font-semibold leading-tight tracking-[-0.035em] text-white">
              Your interview kits
            </h1>
            {activityLabel && (
              <Badge
                variant="outline"
                className={cn(
                  "gap-1.5",
                  isBusy
                    ? "border-sky-500/30 bg-sky-500/10 text-sky-300"
                    : "border-amber-500/30 bg-amber-500/10 text-amber-300",
                )}
                role="status"
                aria-live="polite"
              >
                <span
                  className={cn(
                    "size-1.5 rounded-full",
                    isBusy ? "animate-pulse bg-sky-400" : "bg-amber-400",
                  )}
                />
                {activityLabel}
              </Badge>
            )}
          </div>
          <p className="mt-2 text-base text-white/60">
            Every kit is researched from the company&apos;s own pages and the job description.
          </p>
        </div>
        <Button size="lg" onClick={() => handleOpenSheet(false)} className="shrink-0">
          <Plus className="size-4" />
          New kit
        </Button>
      </div>

      {hasKits && kits && (
        <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { icon: FolderKanban, label: "Kits", value: kits.length },
            {
              icon: HelpCircle,
              label: "Questions",
              value: kits.reduce((n, k) => n + (k.kit.questions?.length ?? 0), 0),
            },
            {
              icon: Layers,
              label: "Flashcards",
              value: kits.reduce((n, k) => n + (k.kit.flashcards?.length ?? 0), 0),
            },
            {
              icon: CalendarDays,
              label: "Study days planned",
              value: kits.reduce((n, k) => n + (k.kit.schedule?.days_available ?? 0), 0),
            },
          ].map(({ icon: Icon, label, value }) => (
            <div
              key={label}
              className="flex items-center gap-4 rounded-lg border border-white/[0.08] bg-[#111111] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
            >
              <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-[#ff7a5c] ring-1 ring-primary/25">
                <Icon className="size-5" aria-hidden />
              </span>
              <div>
                <dd className="text-2xl font-semibold tabular-nums tracking-[-0.02em] text-white">{value}</dd>
                <dt className="text-[13px] font-medium text-white/55">{label}</dt>
              </div>
            </div>
          ))}
        </dl>
      )}

      {/* Error state */}
      {isError && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>Couldn&apos;t load your kits</AlertTitle>
          <AlertDescription className="flex items-center justify-between mt-1">
            <span>There was an error loading your interview kits from the server.</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void refetch()}
              className="gap-1.5 border-destructive/40 text-destructive hover:bg-destructive/10 rounded-lg"
            >
              <RefreshCcw className="size-3.5" />
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Loading state skeleton grid */}
      {isLoading && (
        <div
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3"
          role="status"
          aria-label="Loading workspace"
        >
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-60 w-full rounded-lg" />
          ))}
        </div>
      )}

      {isEmpty && (
        <div className="relative flex flex-col items-center justify-center overflow-hidden rounded-lg border border-white/[0.08] bg-[#0f0f0f] px-6 py-20 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <div className="absolute left-1/2 top-0 h-[420px] w-[820px] -translate-x-1/2 bg-[radial-gradient(ellipse_50%_60%_at_50%_0%,rgba(255,96,48,0.22),transparent_75%)]" />
            <LightRays color="rgba(255, 96, 48, 0.2)" count={5} blur={40} speed={16} length="90%" />
          </div>
          <div className="relative flex size-14 items-center justify-center rounded-lg bg-[#dc3019] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_14px_40px_-12px_rgba(251,65,40,0.8)]">
            <Briefcase className="size-7" />
          </div>
          <h2 className="relative mt-6 text-2xl font-semibold tracking-[-0.03em] text-white">
            Create your first kit
          </h2>
          <p className="relative mt-2 max-w-md text-base leading-relaxed text-white/60">
            Paste a job description and the company&apos;s URL. Dossier researches the company and builds
            questions, flashcards and a study plan around your interview date.
          </p>
          <div className="relative mt-8 flex flex-col items-center gap-3 sm:flex-row">
            <Button size="lg" onClick={() => handleOpenSheet(false)}>
              <Plus className="size-4" />
              New kit
            </Button>
            <Button size="lg" variant="outline" onClick={() => handleOpenSheet(true)}>
              <FileText className="size-4 text-[#ff7a5c]" />
              Try a sample job description
            </Button>
          </div>
        </div>
      )}

      {/* Populated workspace grid */}
      {!isLoading && (hasKits || hasActiveRuns) && (
        <div
          role="list"
          aria-label="Interview kits list"
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3"
        >
          {/* Cell 1: Always New Kit tile */}
          <div role="listitem">
            <NewKitTile onClick={() => handleOpenSheet(false)} />
          </div>

          {/* Cells 2: Active & queued in-flight runs */}
          <AnimatePresence mode="popLayout">
            {activeRuns.map((run) => (
              <motion.div
                key={run.id}
                role="listitem"
                layout
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.2 }}
                className="h-full"
              >
                <GeneratingKitCard run={run} queuePosition={queuePositions.get(run.id)} />
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Cells 3: Completed kits */}
          {visibleKits?.map((kit) => (
            <div key={kit.id} role="listitem" className="h-full">
              <KitCard kit={kit} />
            </div>
          ))}
        </div>
      )}

      {/* Create Kit Side Sheet */}
      <CreateKitSheet open={sheetOpen} onOpenChange={handleSheetOpenChange} prefillSample={prefillSample} />
    </div>
  );
}

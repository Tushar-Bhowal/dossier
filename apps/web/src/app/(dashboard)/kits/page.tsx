"use client";

import * as React from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { FileText, Plus, AlertCircle, RefreshCcw, Briefcase } from "lucide-react";
import { listKits } from "@/lib/api";
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

export default function KitsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { activeRuns, summary } = useActiveRuns();

  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [prefillSample, setPrefillSample] = React.useState(false);

  // ?new=true auto-opens the sheet. Adjusted during render rather than in an effect, so the sheet
  // doesn't paint closed for a frame first when arriving on this URL directly.
  const newParam = searchParams?.get("new");
  const [lastNewParam, setLastNewParam] = React.useState(newParam);
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
          .filter((id): id is string => Boolean(id))
      ),
    [activeRuns]
  );
  const visibleKits = React.useMemo(
    () => kits?.filter((kit) => !activeKitIds.has(kit.id)),
    [kits, activeKitIds]
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
    <div className="flex flex-col gap-6 w-full mx-auto">
      {/* Workspace Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Interview Kits
          </h1>
          {kits && (
            <Badge variant="secondary" className="px-2 py-0.5 text-xs font-semibold rounded-lg">
              {kits.length}
            </Badge>
          )}
          {activityLabel && (
            <Badge
              variant="outline"
              className={cn(
                "gap-1.5 px-2.5 py-0.5 text-xs rounded-lg",
                isBusy
                  ? "border-sky-500/30 bg-sky-500/10 text-sky-400"
                  : "border-amber-500/30 bg-amber-500/10 text-amber-400"
              )}
              role="status"
              aria-live="polite"
            >
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  isBusy ? "bg-sky-400 animate-pulse" : "bg-amber-400"
                )}
              />
              {activityLabel}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={() => handleOpenSheet(false)}
            className="bg-[#FB4128] hover:bg-[#FB4128]/90 text-white font-medium gap-1.5 shadow-sm rounded-lg"
          >
            <Plus className="size-4" />
            New kit
          </Button>
        </div>
      </div>

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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" role="status" aria-label="Loading workspace">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="min-h-[12rem] h-48 w-full rounded-lg" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {isEmpty && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border/70 bg-card/40 p-12 text-center my-6">
          <div className="flex size-14 items-center justify-center rounded-lg bg-muted/60 mb-4 text-muted-foreground/60 ring-1 ring-border/50">
            <Briefcase className="size-7" />
          </div>
          <h2 className="text-xl font-semibold tracking-tight text-foreground mb-1.5">
            No interview kits yet
          </h2>
          <p className="text-sm text-muted-foreground max-w-md mb-6 leading-relaxed">
            Paste a job description to generate your first tailored interview prep kit with company
            research, targeted questions, flashcards, and a structured study plan.
          </p>
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <Button
              onClick={() => handleOpenSheet(false)}
              className="bg-[#FB4128] hover:bg-[#FB4128]/90 text-white gap-2 font-medium rounded-lg"
            >
              <Plus className="size-4" />
              Create your first kit
            </Button>
            <Button
              variant="outline"
              onClick={() => handleOpenSheet(true)}
              className="gap-2 border-border/80 text-foreground hover:bg-muted rounded-lg"
            >
              <FileText className="size-4 text-[#FB4128]" />
              Try with a sample JD
            </Button>
          </div>
        </div>
      )}

      {/* Populated workspace grid */}
      {!isLoading && (hasKits || hasActiveRuns) && (
        <div
          role="list"
          aria-label="Interview kits list"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
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
      <CreateKitSheet
        open={sheetOpen}
        onOpenChange={handleSheetOpenChange}
        prefillSample={prefillSample}
      />
    </div>
  );
}

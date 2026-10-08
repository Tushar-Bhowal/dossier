"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import type { RoadmapListItem } from "@dossier/core/roadmap";
import { AlertCircle, Briefcase, CalendarDays, GraduationCap, LoaderCircle, Map as MapIcon, Plus, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SampleBanner } from "@/components/demo/SampleBanner";
import { listRoadmaps, roadmapKeys, ROADMAP_SAMPLE } from "@/lib/roadmap/api";
import { cn } from "@/lib/utils";
import { CreateRoadmapSheet, type RoadmapDraft } from "./CreateRoadmapSheet";
import { ConfidenceChip, ProgressBar, interviewLabel } from "./parts";

const STARTERS: RoadmapDraft[] = [
  { kind: "role", subject: "Staff nurse", company: "Apollo Hospitals" },
  { kind: "role", subject: "Audit associate", company: "Deloitte" },
  { kind: "skill", subject: "Excel" },
  { kind: "skill", subject: "JavaScript" },
];

function RoadmapCard({ item }: { item: RoadmapListItem }) {
  const Icon = item.kind === "role" ? Briefcase : GraduationCap;
  const when = interviewLabel(item.interviewDate);

  return (
    <Link
      href={`/roadmaps/${item.id}`}
      className={cn(
        "group relative flex h-full min-h-[13rem] flex-col rounded-lg border border-white/[0.08] bg-[#111111] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] transition-[transform,border-color] duration-200",
        "bg-[radial-gradient(120%_70%_at_100%_0%,rgba(251,65,40,0.08),transparent_55%)] hover:-translate-y-0.5 hover:border-primary/40 motion-reduce:hover:translate-y-0",
        "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="flex size-10 items-center justify-center rounded-lg bg-[#dc3019] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.3)]">
          <Icon className="size-5" aria-hidden />
        </span>
        {item.status === "ready" && item.confidence === "low" && <ConfidenceChip confidence="low" />}
      </div>
      <h3 className="mt-4 line-clamp-2 text-[19px] font-semibold leading-snug tracking-[-0.02em] text-white group-hover:text-[#ff7a5c]">
        {item.subject}
      </h3>
      <p className="mt-1 truncate text-sm font-medium text-white/55">
        {item.company ? `at ${item.company}` : item.kind === "role" ? "Job role" : "Skill"}
      </p>

      <div className="mt-auto pt-5">
        {item.status === "generating" ? (
          <p className="flex items-center gap-2 text-sm font-semibold text-white/75" role="status">
            <LoaderCircle className="size-4 animate-spin text-[#ff7a5c] motion-reduce:animate-none" aria-hidden />
            Researching and building…
          </p>
        ) : item.status === "failed" ? (
          <p className="flex items-center gap-2 text-sm font-semibold text-[#ff8a70]">
            <AlertCircle className="size-4" aria-hidden />
            Couldn&apos;t build this. Open to try again.
          </p>
        ) : (
          <>
            <div className="mb-2 flex items-center justify-between text-sm font-medium text-white/60">
              <span>
                {item.topicsDone} of {item.topicsTotal} topics done
              </span>
              {when && (
                <span className="flex items-center gap-1.5">
                  <CalendarDays className="size-4" aria-hidden />
                  {when}
                </span>
              )}
            </div>
            <ProgressBar done={item.topicsDone} total={item.topicsTotal} />
          </>
        )}
      </div>
    </Link>
  );
}

export function RoadmapsHome() {
  const params = useSearchParams();
  const list = useQuery({
    queryKey: roadmapKeys.list,
    queryFn: listRoadmaps,
    refetchInterval: (q) => (q.state.data?.some((r) => r.status === "generating") ? 2000 : false),
  });
  const [sheetOpen, setSheetOpen] = React.useState(params?.get("new") === "1");
  const [draft, setDraft] = React.useState<RoadmapDraft | null>(() => {
    const subject = params?.get("subject");
    if (!subject) return null;
    return { kind: params?.get("kind") === "skill" ? "skill" : "role", subject, company: params?.get("company") ?? undefined };
  });

  function start(next: RoadmapDraft | null) {
    setDraft(next);
    setSheetOpen(true);
  }

  const empty = list.data?.length === 0;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-[32px] font-semibold leading-tight tracking-[-0.035em] text-white">Roadmaps</h1>
          <p className="mt-2 max-w-2xl text-base leading-relaxed text-white/60">
            A step-by-step plan for any job or skill, researched from public sources. Edit anything.
          </p>
        </div>
        {!empty && (
          <Button size="lg" className="h-11 self-start sm:self-auto" onClick={() => start(null)}>
            <Plus className="size-4" aria-hidden />
            New roadmap
          </Button>
        )}
      </div>

      {ROADMAP_SAMPLE && <SampleBanner>Roadmaps aren&apos;t connected yet, so nothing you create or edit here is saved.</SampleBanner>}

      {list.isPending && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3" role="status" aria-label="Loading roadmaps">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-52 w-full rounded-lg bg-white/[0.04]" />
          ))}
        </div>
      )}

      {list.isError && (
        <div role="alert" className="flex flex-col gap-4 rounded-lg border border-destructive/35 bg-destructive/10 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 size-5 shrink-0 text-destructive" aria-hidden />
            <div>
              <p className="text-[15px] font-semibold text-white">We couldn&apos;t load your roadmaps</p>
              <p className="mt-1 text-sm text-white/70">Nothing is lost. Try again in a moment.</p>
            </div>
          </div>
          <Button variant="outline" className="h-11 shrink-0 sm:h-10" onClick={() => void list.refetch()}>
            <RefreshCcw className="size-4" aria-hidden />
            Try again
          </Button>
        </div>
      )}

      {empty && (
        <section className="flex flex-col items-center rounded-lg border border-white/[0.08] bg-[#111111] bg-[radial-gradient(80%_60%_at_50%_0%,rgba(251,65,40,0.10),transparent_60%)] px-6 py-14 text-center sm:py-16">
          <span className="flex size-12 items-center justify-center rounded-lg bg-[#dc3019] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.3)]">
            <MapIcon className="size-6" aria-hidden />
          </span>
          <h2 className="mt-5 text-2xl font-semibold tracking-[-0.03em] text-white">Plan your prep, one step at a time</h2>
          <p className="mt-2 max-w-lg text-[15px] leading-relaxed text-white/65">
            Name a job or a skill. We find out how the interviews usually go and lay out what to learn, what to practise and
            when, from basics to a full mock interview.
          </p>
          <Button size="lg" className="mt-6 h-11 px-5" onClick={() => start(null)}>
            <Plus className="size-4" aria-hidden />
            New roadmap
          </Button>
          <p className="mt-8 text-sm font-semibold text-white/55">Or start from an example</p>
          <ul className="mt-3 flex flex-wrap justify-center gap-2">
            {STARTERS.map((s) => (
              <li key={s.subject}>
                <button
                  type="button"
                  onClick={() => start(s)}
                  className="h-10 rounded-lg border border-white/10 bg-white/[0.03] px-3.5 text-sm font-semibold text-white/80 transition-colors hover:bg-white/[0.07] hover:text-white"
                >
                  {s.subject}
                  {s.company ? ` at ${s.company}` : ""}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {list.data && list.data.length > 0 && (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {list.data.map((item) => (
            <li key={item.id}>
              <RoadmapCard item={item} />
            </li>
          ))}
        </ul>
      )}

      <CreateRoadmapSheet open={sheetOpen} onOpenChange={setSheetOpen} draft={draft} />
    </div>
  );
}

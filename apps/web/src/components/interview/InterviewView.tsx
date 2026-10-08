"use client";

import { useQuery } from "@tanstack/react-query";
import { RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BackLink } from "@/components/roadmap/RoadmapView";
import { ApiError } from "@/lib/api";
import { getInterview, interviewKeys } from "@/lib/interview/api";
import { InterviewReportView } from "./InterviewReport";
import { LiveInterview } from "./LiveInterview";

export function InterviewView({ id }: { id: string }) {
  const query = useQuery({
    queryKey: interviewKeys.one(id),
    queryFn: () => getInterview(id),
    refetchInterval: (q) => (q.state.data?.status === "grading" ? 1500 : false),
    refetchOnWindowFocus: false,
  });

  if (query.isPending) {
    return (
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-5" role="status" aria-label="Loading interview">
        <Skeleton className="h-6 w-40 rounded-lg bg-white/[0.05]" />
        <Skeleton className="h-10 w-96 max-w-full rounded-lg bg-white/[0.06]" />
        <Skeleton className="h-40 w-full rounded-lg bg-white/[0.04]" />
        <Skeleton className="h-72 w-full rounded-lg bg-white/[0.03]" />
      </div>
    );
  }

  if (query.isError) {
    const missing = query.error instanceof ApiError && query.error.status === 404;
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <BackLink href="/interviews">Mock interviews</BackLink>
        <div role="alert" className="flex flex-col gap-4 rounded-lg border border-white/[0.08] bg-[#111111] p-6">
          <p className="text-lg font-semibold text-white">{missing ? "This interview doesn't exist" : "We couldn't load this interview"}</p>
          <p className="text-[15px] text-white/65">{missing ? "It may have been deleted." : "Your report is safe. Try again in a moment."}</p>
          {!missing && (
            <Button variant="outline" className="h-11 self-start" onClick={() => void query.refetch()}>
              <RefreshCcw className="size-4" aria-hidden />
              Try again
            </Button>
          )}
        </div>
      </div>
    );
  }

  return query.data.status === "live" ? <LiveInterview record={query.data} /> : <InterviewReportView record={query.data} />;
}

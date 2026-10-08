"use client";

import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import { GraduationCap } from "lucide-react";
import { PracticeDeck } from "@/components/kit/FlashcardDeck";
import { SampleBanner } from "@/components/demo/SampleBanner";
import { BackLink } from "@/components/roadmap/RoadmapView";
import { getRoadmap, getRoadmapPractice, reviewRoadmapCard, roadmapKeys, ROADMAP_SAMPLE } from "@/lib/roadmap/api";

export default function RoadmapPracticePage({ params }: PageProps<"/roadmaps/[id]/practice">) {
  const { id } = use(params);
  const { data } = useQuery({ queryKey: roadmapKeys.one(id), queryFn: () => getRoadmap(id), refetchOnWindowFocus: false });
  const practice = useQuery({ queryKey: roadmapKeys.practice(id), queryFn: () => getRoadmapPractice(id) });
  const subject = data?.request.subject ?? "Roadmap";

  return (
    <div className="mx-auto flex w-full flex-col gap-6 pb-12">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div className="min-w-0">
          <BackLink href={`/roadmaps/${id}`}>{subject}</BackLink>
          <h1 className="mt-2 text-[28px] font-semibold tracking-[-0.03em] text-white sm:text-[32px]">Flashcards</h1>
          <p className="mt-1 text-[15px] text-white/60">
            Every card from this roadmap. Ones you know come back less often{data?.request.interviewDate ? ", all before your interview" : ""}.
          </p>
        </div>
        <span className="inline-flex h-8 items-center gap-2 self-start rounded-lg border border-white/10 bg-white/[0.04] px-3 text-[13px] font-semibold text-white/75 sm:self-auto">
          <GraduationCap className="size-4 text-[#ff7a5c]" aria-hidden />
          Spaced repetition
        </span>
      </div>
      {ROADMAP_SAMPLE && <SampleBanner>Your practice progress here isn&apos;t saved yet.</SampleBanner>}
      <PracticeDeck
        queryKey={roadmapKeys.practice(id)}
        load={() => getRoadmapPractice(id)}
        review={(cardId, confidence) => reviewRoadmapCard(id, cardId, confidence)}
        backHref={`/roadmaps/${id}`}
        backLabel="Back to roadmap"
        emptyHref={`/roadmaps/${id}`}
        emptyBody="This roadmap has no flashcards yet. Open a topic and add a few."
        hasDeadline={practice.data?.hasDeadline ?? true}
      />
    </div>
  );
}

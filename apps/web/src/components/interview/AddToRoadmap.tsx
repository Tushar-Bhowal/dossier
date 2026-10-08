"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DropdownMenu } from "radix-ui";
import type { InterviewRecord, Weakness } from "@dossier/core/interview";
import { ArrowRight, Check, ChevronDown, LoaderCircle, Map as MapIcon, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { describeAiError } from "@/components/resume/AiStatus";
import { addWeaknessToRoadmap, interviewKeys } from "@/lib/interview/api";
import { listRoadmaps, roadmapKeys } from "@/lib/roadmap/api";

// Turns a weak spot into a practice topic on a roadmap, so it shows up in the plan instead of being forgotten.
export function AddToRoadmap({ record, weakness }: { record: InterviewRecord; weakness: Weakness }) {
  const queryClient = useQueryClient();
  const roadmaps = useQuery({ queryKey: roadmapKeys.list, queryFn: listRoadmaps, enabled: !weakness.roadmapTopic });
  const add = useMutation({
    mutationFn: (roadmapId: string) => addWeaknessToRoadmap(record.id, weakness.id, roadmapId),
    onSuccess: (next, roadmapId) => {
      queryClient.setQueryData(interviewKeys.one(record.id), next);
      void queryClient.invalidateQueries({ queryKey: roadmapKeys.one(roadmapId) });
      void queryClient.invalidateQueries({ queryKey: roadmapKeys.list });
      toast.success("Added to your roadmap", { description: `"${weakness.title}" is now a practice topic.` });
    },
    onError: (err) => toast.error(describeAiError(err).title, { description: describeAiError(err).body }),
  });

  if (weakness.roadmapTopic) {
    const { roadmapId, topicId } = weakness.roadmapTopic;
    return (
      <Link
        href={`/roadmaps/${roadmapId}/topics/${topicId}`}
        className="flex h-11 items-center gap-2 text-sm font-semibold text-emerald-300 hover:text-emerald-200"
      >
        <Check className="size-4" aria-hidden />
        On your roadmap
        <ArrowRight className="size-4" aria-hidden />
      </Link>
    );
  }

  const ready = (roadmaps.data ?? []).filter((r) => r.status === "ready");
  const own = record.source.type === "roadmap" ? ready.find((r) => r.id === record.source.id) : undefined;
  const busy = add.isPending;

  if (own) {
    return (
      <Button variant="outline" className="h-11 self-start" onClick={() => add.mutate(own.id)} disabled={busy}>
        {busy ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <Plus className="size-4" aria-hidden />}
        Add to my roadmap
      </Button>
    );
  }
  if (roadmaps.isPending) return null;
  if (!ready.length) {
    return (
      <Link href="/roadmaps?new=1" className="flex h-11 items-center gap-1.5 text-sm font-semibold text-[#ff7a5c] hover:text-[#ff9478]">
        <MapIcon className="size-4" aria-hidden />
        Make a roadmap to track this
      </Link>
    );
  }
  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger asChild>
        <Button variant="outline" className="h-11 self-start" disabled={busy}>
          {busy ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <Plus className="size-4" aria-hidden />}
          Add to a roadmap
          <ChevronDown className="size-4" aria-hidden />
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          sideOffset={6}
          className="z-50 w-72 max-w-[calc(100vw-32px)] rounded-lg border border-white/10 bg-[#141414] p-1.5 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.9)]"
        >
          {ready.map((r) => (
            <DropdownMenu.Item
              key={r.id}
              onSelect={() => add.mutate(r.id)}
              className="flex min-h-11 cursor-pointer flex-col justify-center rounded-md px-3 py-2 outline-none data-[highlighted]:bg-white/[0.07]"
            >
              <span className="text-[15px] font-semibold text-white">{r.subject}</span>
              {r.company && <span className="text-[13px] font-medium text-white/55">at {r.company}</span>}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

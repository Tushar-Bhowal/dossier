"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { RoadmapRecord, RoadmapTopic } from "@dossier/core/roadmap";
import { getRoadmap, roadmapKeys, saveRoadmap } from "@/lib/roadmap/api";
import { useDebouncedCallback, type SaveStatus } from "@/lib/optimistic";

// Edits show at once and are saved shortly after as one whole document with its version, like kits.
export function useRoadmap(id: string) {
  const queryClient = useQueryClient();
  const key = React.useMemo(() => roadmapKeys.one(id), [id]);
  const query = useQuery({
    queryKey: key,
    queryFn: () => getRoadmap(id),
    refetchInterval: (q) => (q.state.data?.status === "generating" ? 1500 : false),
    // A background refetch would replace edits that haven't been saved yet.
    refetchOnWindowFocus: false,
  });
  const [status, setStatus] = React.useState<SaveStatus>("saved");
  const inFlight = React.useRef(false);
  const again = React.useRef(false);

  // One save at a time; edits made while a save is in flight trigger one more round.
  const flush = React.useCallback(async () => {
    if (inFlight.current) {
      again.current = true;
      return;
    }
    inFlight.current = true;
    try {
      do {
        again.current = false;
        const record = queryClient.getQueryData<RoadmapRecord>(key);
        if (!record?.roadmap) break;
        setStatus("saving");
        try {
          const saved = await saveRoadmap(id, { version: record.version, roadmap: record.roadmap, doneTopicIds: record.doneTopicIds });
          queryClient.setQueryData<RoadmapRecord>(key, (current) =>
            current ? { ...current, version: saved.version, updatedAt: saved.updatedAt } : saved,
          );
          void queryClient.invalidateQueries({ queryKey: roadmapKeys.list });
          setStatus("saved");
        } catch {
          setStatus("retry");
          break;
        }
      } while (again.current);
    } finally {
      inFlight.current = false;
    }
  }, [id, key, queryClient]);

  const { schedule } = useDebouncedCallback(() => void flush(), 600);

  const update = React.useCallback(
    (fn: (record: RoadmapRecord) => RoadmapRecord) => {
      queryClient.setQueryData<RoadmapRecord>(key, (current) => (current ? fn(current) : current));
      setStatus("saving");
      schedule();
    },
    [queryClient, schedule, key],
  );

  const updateTopic = React.useCallback(
    (topicId: string, fn: (topic: RoadmapTopic) => RoadmapTopic) =>
      update((record) =>
        record.roadmap
          ? { ...record, roadmap: { ...record.roadmap, topics: record.roadmap.topics.map((t) => (t.id === topicId ? fn(t) : t)) } }
          : record,
      ),
    [update],
  );

  const toggleDone = React.useCallback(
    (topicId: string) =>
      update((record) => ({
        ...record,
        doneTopicIds: record.doneTopicIds.includes(topicId)
          ? record.doneTopicIds.filter((t) => t !== topicId)
          : [...record.doneTopicIds, topicId],
      })),
    [update],
  );

  return { query, status, update, updateTopic, toggleDone, retrySave: () => void flush() };
}

export function nextItemId(record: RoadmapRecord, prefix: "q" | "f"): string {
  const used = (record.roadmap?.topics ?? []).flatMap((t) => (prefix === "q" ? t.questions : t.flashcards).map((i) => Number(i.id.slice(1))));
  return `${prefix}${Math.max(0, ...used) + 1}`;
}

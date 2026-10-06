"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  applyStatusChange,
  type Application,
  type ApplicationCreate,
  type ApplicationInput,
  type ApplicationRecord,
} from "@dossier/core/applications";
import {
  ApiError,
  createApplication,
  deleteApplication,
  listApplications,
  updateApplication,
  type SaveApplicationResult,
} from "@/lib/api";
import { toast } from "@/components/ui/toast";

const KEY = ["applications"];

// The editable part of an application; history and source belong to the server.
export function toInput(app: Application): ApplicationInput {
  const input: Partial<Application> = { ...app };
  delete input.statusHistory;
  delete input.source;
  return input as ApplicationInput;
}

export function useApplications() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: KEY, queryFn: listApplications });
  // One save in flight per application, in order: two quick edits would otherwise both send the
  // same version and the second would bounce as a conflict.
  const queues = React.useRef(new Map<string, Promise<void>>());

  const get = React.useCallback(
    (id: string) => queryClient.getQueryData<ApplicationRecord[]>(KEY)?.find((r) => r.id === id),
    [queryClient],
  );
  const put = React.useCallback(
    (record: ApplicationRecord) =>
      queryClient.setQueryData<ApplicationRecord[]>(KEY, (list = []) => list.map((r) => (r.id === record.id ? record : r))),
    [queryClient],
  );

  const update = React.useCallback(
    function update(id: string, change: (input: ApplicationInput) => ApplicationInput, undoMessage?: string) {
      const before = get(id);
      if (!before) return;
      const changed = change(toInput(before.application));
      const derived = applyStatusChange(before.application, changed, new Date());
      // Sent with the browser's own date, so "applied today" is the user's today, not the server's.
      const input = { ...changed, appliedOn: derived.appliedOn, round: derived.round };
      // Shown at once; the server recomputes history the same way and its copy wins when it lands.
      put({ ...before, application: { ...before.application, ...input, statusHistory: derived.statusHistory } });

      if (undoMessage) {
        toast.success(undoMessage, {
          action: { label: "Undo", onClick: () => update(id, () => toInput(before.application)) },
        });
      }

      const task = (queues.current.get(id) ?? Promise.resolve()).then(async () => {
        const latest = get(id);
        if (!latest) return;
        try {
          const result = await updateApplication(id, latest.version, input);
          const isLast = queues.current.get(id) === task;
          if (result.ok) {
            // A newer edit is still queued: keep it on screen and only take the new version number.
            put(isLast ? result.record : { ...(get(id) ?? result.record), version: result.record.version });
          } else if (result.reason === "conflict" && result.record) {
            put(result.record);
            toast.info("This application changed somewhere else", { description: "Showing the latest version." });
          } else {
            toast.error("That job link is already tracked", { description: "Each job link can be added once." });
            await queryClient.invalidateQueries({ queryKey: KEY });
          }
        } catch (err) {
          toast.error("Couldn't save that change", {
            description: err instanceof ApiError ? err.message : "Check your connection and try again.",
          });
          await queryClient.invalidateQueries({ queryKey: KEY });
        }
      });
      queues.current.set(id, task);
    },
    [get, put, queryClient],
  );

  const create = React.useCallback(
    async (input: ApplicationCreate): Promise<SaveApplicationResult> => {
      const result = await createApplication(input);
      if (result.ok) {
        queryClient.setQueryData<ApplicationRecord[]>(KEY, (list = []) => [result.record, ...list]);
      }
      return result;
    },
    [queryClient],
  );

  const remove = React.useCallback(
    async (id: string) => {
      await deleteApplication(id);
      queryClient.setQueryData<ApplicationRecord[]>(KEY, (list = []) => list.filter((r) => r.id !== id));
    },
    [queryClient],
  );

  return { ...query, records: query.data ?? [], update, create, remove };
}

export type ApplicationsApi = ReturnType<typeof useApplications>;

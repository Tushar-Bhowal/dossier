"use client";

import { useRef, useState } from "react";
import type { Kit } from "@dossier/core";
import { ApiError, getKit, patchKit, regenerateSection, type RegenerateSection } from "@/lib/api";
import { useDebouncedCallback, type SaveStatus } from "@/lib/optimistic";
import { toast } from "@/components/ui/toast";

export interface KitEditor {
  kit: Kit;
  version: number;
  status: Record<string, SaveStatus>;
  /** Applies a local edit immediately and schedules a debounced PATCH (for continuous typing). */
  editField: (key: string, mutator: (kit: Kit) => Kit) => void;
  /** Applies a local edit immediately and PATCHes right away (for discrete actions: reorder, add, delete, pin). */
  mutateNow: (key: string, mutator: (kit: Kit) => Kit) => void;
  regenerating: Set<string>;
  regenerateError: Record<string, string>;
  regenerate: (section: RegenerateSection, key: string) => Promise<void>;
}

const DEBOUNCE_MS = 500;

export function useKitEditor(id: string, initial: { kit: Kit; version: number }): KitEditor {
  const [kit, setKit] = useState(initial.kit);
  const [version, setVersion] = useState(initial.version);
  const [status, setStatus] = useState<Record<string, SaveStatus>>({});
  const [regenerating, setRegenerating] = useState<Set<string>>(new Set());
  const [regenerateError, setRegenerateError] = useState<Record<string, string>>({});

  // Refs mirror the state above so the debounced flush and the retry-on-409 path always read the
  // latest values, never a stale closure from the render that scheduled the timer.
  const kitRef = useRef(kit);
  const versionRef = useRef(version);
  const pendingKeysRef = useRef(new Set<string>());
  const editorsRef = useRef(new Map<string, (kit: Kit) => Kit>());
  const flushInFlightRef = useRef(false);
  const flushQueuedRef = useRef(false);

  async function flush(retriesLeft = 1): Promise<void> {
    if (flushInFlightRef.current) {
      flushQueuedRef.current = true;
      return;
    }
    const keys = Array.from(pendingKeysRef.current);
    if (keys.length === 0) return;
    pendingKeysRef.current.clear();
    flushInFlightRef.current = true;
    setStatus((prev) => {
      const next = { ...prev };
      for (const k of keys) next[k] = "saving";
      return next;
    });

    try {
      const result = await patchKit(id, versionRef.current, kitRef.current);
      if (result.ok) {
        // Reapply any edits made *while this request was in flight* on top of the server's
        // response — otherwise a keystroke typed during the round-trip would be silently
        // discarded when the response's snapshot overwrites local state.
        let nextKit = result.data.kit;
        for (const k of pendingKeysRef.current) {
          const mutator = editorsRef.current.get(k);
          if (mutator) nextKit = mutator(nextKit);
        }
        kitRef.current = nextKit;
        versionRef.current = result.data.version;
        setKit(nextKit);
        setVersion(result.data.version);
        const hasTextEdit = keys.some(
          (k) =>
            !k.includes(".pinned") &&
            !k.includes(".delete") &&
            !k.includes(".add") &&
            !k.includes(".move")
        );
        if (hasTextEdit) {
          toast.success("Changes saved");
        }

        for (const k of keys) editorsRef.current.delete(k);
        setStatus((prev) => {
          const next = { ...prev };
          for (const k of keys) next[k] = "saved";
          return next;
        });
      } else {
        // Edit-in-flight: rebase onto the server's current kit, then reapply exactly the local
        // edits that were mid-flight in this batch (never the ones already saved elsewhere).
        let rebased = result.conflict.kit;
        for (const k of keys) {
          const mutator = editorsRef.current.get(k);
          if (mutator) rebased = mutator(rebased);
        }
        kitRef.current = rebased;
        versionRef.current = result.conflict.version;
        setKit(rebased);
        setVersion(result.conflict.version);

        for (const k of keys) pendingKeysRef.current.add(k);
        flushInFlightRef.current = false;
        if (retriesLeft > 0) {
          await flush(retriesLeft - 1);
        } else {
          setStatus((prev) => {
            const next = { ...prev };
            for (const k of keys) next[k] = "retry";
            return next;
          });
          toast.error("Failed to save changes. Please try again.");
        }
        return;
      }
    } catch (err) {
      for (const k of keys) pendingKeysRef.current.add(k);
      setStatus((prev) => {
        const next = { ...prev };
        for (const k of keys) next[k] = "retry";
        return next;
      });
      // A real fetch/DNS failure throws something other than ApiError with no useful message;
      // an ApiError means the request reached the server and it said something specific — showing
      // "network error" for that instead sends the user checking their wifi for a server-side bug.
      toast.error(err instanceof ApiError ? err.message : "Network error while saving changes.");
    } finally {
      flushInFlightRef.current = false;
      if (flushQueuedRef.current) {
        flushQueuedRef.current = false;
        void flush();
      }
    }
  }

  const { schedule: scheduleFlush, cancel: cancelFlush } = useDebouncedCallback(() => void flush(), DEBOUNCE_MS);

  function editField(key: string, mutator: (kit: Kit) => Kit) {
    editorsRef.current.set(key, mutator);
    kitRef.current = mutator(kitRef.current);
    setKit(kitRef.current);
    pendingKeysRef.current.add(key);
    setStatus((prev) => ({ ...prev, [key]: "saving" }));
    scheduleFlush();
  }

  function mutateNow(key: string, mutator: (kit: Kit) => Kit) {
    editorsRef.current.set(key, mutator);
    kitRef.current = mutator(kitRef.current);
    setKit(kitRef.current);
    pendingKeysRef.current.add(key);
    setStatus((prev) => ({ ...prev, [key]: "saving" }));
    cancelFlush();
    void flush();
  }

  async function regenerate(section: RegenerateSection, key: string): Promise<void> {
    const sectionName = section.replace(/^[a-z]/, (c) => c.toUpperCase());
    cancelFlush();
    await flush();
    setRegenerateError((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setRegenerating((prev) => new Set(prev).add(key));
    toast.info(`Regenerating ${sectionName}…`, {
      description: "Generating fresh content with AI...",
    });
    try {
      const data = await regenerateSection(id, section);
      kitRef.current = data.kit;
      versionRef.current = data.version;
      setKit(data.kit);
      setVersion(data.version);
      toast.success(`${sectionName} regenerated successfully!`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        const fresh = await getKit(id);
        kitRef.current = fresh.kit;
        versionRef.current = fresh.version;
        setKit(fresh.kit);
        setVersion(fresh.version);
        const msg = "This kit changed elsewhere — reloaded the latest version, try again.";
        setRegenerateError((prev) => ({ ...prev, [key]: msg }));
        toast.error("Conflict detected", { description: msg });
      } else {
        const message = err instanceof ApiError ? err.message : "Regeneration failed.";
        setRegenerateError((prev) => ({ ...prev, [key]: message }));
        toast.error(`Regeneration failed`, { description: message });
      }
    } finally {
      setRegenerating((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  }

  return { kit, version, status, editField, mutateNow, regenerating, regenerateError, regenerate };
}

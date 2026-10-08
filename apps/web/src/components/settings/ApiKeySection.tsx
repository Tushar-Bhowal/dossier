"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { SaveApiKeyRequest, type ApiKeyStatus, type UsageToday } from "@dossier/core/account";
import { AlertCircle, ArrowUpRight, KeyRound, LoaderCircle, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast";
import { ApiError } from "@/lib/api";
import { accountKeys, getApiKey, removeApiKey, saveApiKey } from "@/lib/account/api";
import { Panel, SettingsSection } from "./parts";

const AI_STUDIO_URL = "https://aistudio.google.com/apikey";
const UNDO_MS = 6000;

function keyErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === "validation_error") return error.message;
    if (error.code === "invalid_key") {
      return "Google says this key isn't valid. Copy it again from AI Studio and check nothing is missing at either end.";
    }
    if (error.code === "key_quota") {
      return "This key works, but it has used up its own free allowance for today. Try again tomorrow, or create a new key.";
    }
    if (error.code === "key_check_unavailable") {
      return "We couldn't reach Google to check your key. Nothing was saved. Try again in a minute.";
    }
  }
  return "Something went wrong and the key wasn't saved. Please try again.";
}

function KeyForm({ replacing, onCancel }: { replacing: boolean; onCancel?: () => void }) {
  const queryClient = useQueryClient();
  const [value, setValue] = React.useState("");
  const [localError, setLocalError] = React.useState<string | null>(null);
  const [slow, setSlow] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const save = useMutation({
    mutationFn: saveApiKey,
    onSuccess: (status) => {
      queryClient.setQueryData(accountKeys.apiKey, status);
      void queryClient.invalidateQueries({ queryKey: accountKeys.usage });
      setValue("");
      toast.success("Your key is saved", { description: "Kits, roadmaps and AI edits now have no daily limit." });
    },
    onError: () => inputRef.current?.focus(),
  });

  React.useEffect(() => {
    if (!save.isPending) return;
    const timer = window.setTimeout(() => setSlow(true), 8000);
    return () => {
      window.clearTimeout(timer);
      setSlow(false);
    };
  }, [save.isPending]);

  const error = localError ?? (save.error ? keyErrorMessage(save.error) : null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = SaveApiKeyRequest.safeParse({ key: value });
    if (!parsed.success) {
      setLocalError(value.trim() ? (parsed.error.issues[0]?.message ?? "Check the key") : "Paste your key first");
      inputRef.current?.focus();
      return;
    }
    setLocalError(null);
    save.mutate(parsed.data);
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-3">
      <Label htmlFor="gemini-key" className="text-[15px] font-semibold text-white">
        {replacing ? "Paste your new key" : "Paste your key"}
      </Label>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Input
          ref={inputRef}
          id="gemini-key"
          type="password"
          autoComplete="off"
          spellCheck={false}
          placeholder="AIza…"
          value={value}
          disabled={save.isPending}
          onChange={(e) => {
            setValue(e.target.value);
            if (localError) setLocalError(null);
            if (save.isError) save.reset();
          }}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "gemini-key-error" : "gemini-key-hint"}
          className="h-11 font-mono text-[15px] md:text-[15px]"
        />
        <Button type="submit" size="lg" disabled={save.isPending} className="h-11 shrink-0 px-5">
          {save.isPending && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
          {save.isPending ? "Checking with Google…" : "Check and save"}
        </Button>
      </div>
      {error ? (
        <p id="gemini-key-error" role="alert" className="flex items-start gap-2 text-sm font-medium leading-relaxed text-[#ff8a70]">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          {error}
        </p>
      ) : slow ? (
        <p role="status" className="text-sm font-medium text-white/60">
          Still checking. Google is slow right now; you can keep waiting.
        </p>
      ) : (
        <p id="gemini-key-hint" className="text-sm font-medium text-white/55">
          We check it with Google once, then store it encrypted. Only the last 4 characters are ever shown again.
        </p>
      )}
      {replacing && onCancel && (
        <div>
          <Button type="button" variant="ghost" className="h-11 sm:h-9" onClick={onCancel} disabled={save.isPending}>
            Keep my current key
          </Button>
        </div>
      )}
    </form>
  );
}

function Steps() {
  const steps = [
    <>
      Open{" "}
      <a
        href={AI_STUDIO_URL}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-0.5 font-semibold text-[#ff7a5c] underline-offset-4 hover:underline"
      >
        Google AI Studio
        <ArrowUpRight className="size-4" aria-hidden />
        <span className="sr-only">(opens in a new tab)</span>
      </a>{" "}
      and sign in with your Google account.
    </>,
    <>Press &ldquo;Create API key&rdquo;, then copy the key it shows you.</>,
    <>Paste it below. It&apos;s free, and you can remove it any time.</>,
  ];
  return (
    <ol className="flex flex-col gap-3">
      {steps.map((step, i) => (
        <li key={i} className="flex items-start gap-3 text-[15px] font-medium leading-relaxed text-white/80">
          <span
            aria-hidden
            className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] text-[13px] font-bold text-white/80"
          >
            {i + 1}
          </span>
          <span>{step}</span>
        </li>
      ))}
    </ol>
  );
}

function SavedKey({ status, onReplace, onRemove }: { status: ApiKeyStatus; onReplace: () => void; onRemove: () => void }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-300" aria-hidden>
          <ShieldCheck className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="text-[15px] font-semibold text-white">
            Gemini key <span className="font-mono tracking-wider text-white/80">•••• {status.last4}</span>
          </p>
          <p className="mt-0.5 text-sm font-medium text-white/55">
            Added {new Date(status.addedAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
            {" · "}in use for kits, roadmaps and AI edits
          </p>
        </div>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" className="h-11 flex-1 sm:h-9 sm:flex-none" onClick={onReplace}>
          Replace
        </Button>
        <Button
          variant="ghost"
          className="h-11 flex-1 text-white/70 hover:bg-destructive/10 hover:text-[#ff8a70] sm:h-9 sm:flex-none"
          onClick={onRemove}
        >
          Remove
        </Button>
      </div>
    </div>
  );
}

// Lives outside the component so switching tabs or closing Settings doesn't cut the Undo window
// short; closing the browser tab inside the window still sends the removal.
let pendingRemoval: { timer: number; commit: () => void } | null = null;

function scheduleRemoval(onDone: () => void) {
  cancelRemoval();
  const commit = () => {
    if (!pendingRemoval) return;
    window.clearTimeout(pendingRemoval.timer);
    window.removeEventListener("pagehide", commit);
    pendingRemoval = null;
    removeApiKey()
      .catch(() => toast.error("Couldn't remove your key", { description: "It's still saved. Try again in a moment." }))
      .finally(onDone);
  };
  pendingRemoval = { timer: window.setTimeout(commit, UNDO_MS), commit };
  window.addEventListener("pagehide", commit);
}

function cancelRemoval() {
  if (!pendingRemoval) return;
  window.clearTimeout(pendingRemoval.timer);
  window.removeEventListener("pagehide", pendingRemoval.commit);
  pendingRemoval = null;
}

export function ApiKeySection() {
  const queryClient = useQueryClient();
  const key = useQuery({ queryKey: accountKeys.apiKey, queryFn: getApiKey });
  const [replacing, setReplacing] = React.useState(false);
  // Removal waits out the Undo window before it reaches the server.
  function remove(status: ApiKeyStatus) {
    const usage = queryClient.getQueryData<UsageToday>(accountKeys.usage);
    queryClient.setQueryData(accountKeys.apiKey, null);
    if (usage) queryClient.setQueryData<UsageToday>(accountKeys.usage, { ...usage, ownKey: false });
    setReplacing(false);
    scheduleRemoval(() => void queryClient.invalidateQueries({ queryKey: accountKeys.all }));
    toast.success("Key removed", {
      description: "Daily limits apply again.",
      duration: UNDO_MS,
      action: {
        label: "Undo",
        onClick: () => {
          cancelRemoval();
          queryClient.setQueryData(accountKeys.apiKey, status);
          if (usage) queryClient.setQueryData(accountKeys.usage, usage);
        },
      },
    });
  }

  return (
    <SettingsSection
      id="key"
      sample
      title="Your own Gemini key"
      description="Optional, for heavy use. Add a free key from Google and kits, roadmaps and AI edits have no daily limit. Most people never need this."
    >
      <Panel className="flex flex-col gap-6">
        {key.isPending ? (
          <div className="flex flex-col gap-3" aria-busy="true">
            <span className="sr-only" role="status">
              Loading your key…
            </span>
            <Skeleton className="h-5 w-56 rounded-lg bg-white/[0.06]" />
            <Skeleton className="h-5 w-72 max-w-full rounded-lg bg-white/[0.04]" />
            <Skeleton className="h-11 w-full rounded-lg bg-white/[0.06]" />
          </div>
        ) : key.isError ? (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p role="alert" className="flex items-start gap-2 text-[15px] font-medium text-white/80">
              <AlertCircle className="mt-0.5 size-5 shrink-0 text-destructive" aria-hidden />
              We couldn&apos;t check whether you&apos;ve added a key. Try again in a moment.
            </p>
            <Button variant="outline" className="h-11 shrink-0 sm:h-10" onClick={() => void key.refetch()}>
              Try again
            </Button>
          </div>
        ) : key.data && !replacing ? (
          <SavedKey status={key.data} onReplace={() => setReplacing(true)} onRemove={() => remove(key.data!)} />
        ) : (
          <>
            {!key.data && (
              <div className="flex flex-col gap-4">
                <p className="flex items-center gap-2 text-[15px] font-semibold text-white">
                  <KeyRound className="size-4 text-[#ff7a5c]" aria-hidden />
                  Get a free key in about a minute
                </p>
                <Steps />
              </div>
            )}
            <KeyForm replacing={Boolean(key.data)} onCancel={() => setReplacing(false)} />
            <p className="border-t border-white/[0.06] pt-5 text-sm font-medium leading-relaxed text-white/55">
              On Google&apos;s free plan, Google may use what you send to improve its products. That&apos;s the same as
              Dossier&apos;s shared key, so avoid pasting anything private.
            </p>
          </>
        )}
      </Panel>
    </SettingsSection>
  );
}

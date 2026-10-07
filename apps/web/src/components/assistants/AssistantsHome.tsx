"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Plug, ShieldCheck } from "lucide-react";
import { disconnectAssistant, listAssistants, type ConnectedAssistant } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

const sectionTitle = "text-[13px] font-semibold uppercase tracking-[0.08em] text-white/45";
const noSubscribe = () => () => {};

type ClientId = "claude" | "chatgpt" | "code" | "cursor";

const CLIENTS: { id: ClientId; label: string }[] = [
  { id: "claude", label: "Claude" },
  { id: "chatgpt", label: "ChatGPT" },
  { id: "code", label: "Claude Code" },
  { id: "cursor", label: "Cursor" },
];

const PROMPTS = [
  "Check my Gmail for recruiter emails from the last 7 days and suggest updates to my Dossier tracker.",
  "Which of my applications haven't heard back in 3 weeks? Draft a short follow-up for each.",
  "Help me prepare for my next interview using its job description from Dossier.",
];

function CopyField({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/30 p-1.5 pl-3.5">
      <code className="min-w-0 flex-1 truncate font-mono text-sm text-white/85">{value}</code>
      <Button
        size="sm"
        variant="outline"
        aria-label={`Copy ${label}`}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          } catch {
            toast.error("Couldn't copy", { description: "Select the text and copy it yourself." });
          }
        }}
      >
        {copied ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
        {copied ? "Copied" : "Copy"}
      </Button>
    </div>
  );
}

function Steps({ client, url }: { client: ClientId; url: string }) {
  const step = "text-[15px] font-medium leading-relaxed text-white/75";
  if (client === "code") {
    return (
      <div className="flex flex-col gap-3">
        <p className={step}>Run this in your terminal, then type /mcp in Claude Code and choose Dossier to sign in.</p>
        <CopyField label="command" value={`claude mcp add --transport http dossier ${url}`} />
      </div>
    );
  }
  if (client === "cursor") {
    return (
      <div className="flex flex-col gap-3">
        <p className={step}>Add this to ~/.cursor/mcp.json, then open Cursor&apos;s MCP settings and sign in to Dossier.</p>
        <CopyField label="config" value={JSON.stringify({ mcpServers: { dossier: { url } } })} />
      </div>
    );
  }
  return (
    <ol className="flex list-decimal flex-col gap-2 pl-5">
      {(client === "claude"
        ? [
            "In Claude, open Settings → Connectors → Add custom connector.",
            "Name it Dossier and paste the address above.",
            "Press Connect, sign in to Dossier, and press Allow.",
            "Connect Gmail in Claude too if you want it to read recruiter emails.",
          ]
        : [
            "In ChatGPT, turn on developer mode (Settings → Connectors → Advanced). It depends on your plan.",
            "Create a connector, name it Dossier and paste the address above.",
            "Sign in to Dossier when asked and press Allow.",
          ]
      ).map((line) => (
        <li key={line} className={step}>
          {line}
        </li>
      ))}
    </ol>
  );
}

function Connected() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["assistants"], queryFn: listAssistants });
  const [confirm, setConfirm] = React.useState<ConnectedAssistant | null>(null);

  if (isLoading) return <Skeleton className="h-16 rounded-lg" />;
  if (!data?.length) {
    return <p className="text-[15px] font-medium text-white/50">No assistants connected yet.</p>;
  }
  return (
    <>
      <ul className="flex flex-col divide-y divide-white/[0.06] rounded-lg border border-white/[0.08]">
        {data.map((a) => (
          <li key={a.clientId} className="flex items-center gap-3 px-4 py-3.5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-[#ff7a5c]" aria-hidden>
              <Plug className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-semibold text-white">{a.clientName}</p>
              <p className="text-sm font-medium text-white/50">
                Connected {new Date(a.connectedAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setConfirm(a)}>
              Disconnect
            </Button>
          </li>
        ))}
      </ul>
      <ConfirmDialog
        open={Boolean(confirm)}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={`Disconnect ${confirm?.clientName ?? "this app"}?`}
        description="It loses access to your tracker straight away. You can connect it again later."
        onConfirm={async () => {
          if (!confirm) return;
          await disconnectAssistant(confirm.clientId);
          queryClient.setQueryData<ConnectedAssistant[]>(["assistants"], (list = []) => list.filter((x) => x.clientId !== confirm.clientId));
          toast.success(`${confirm.clientName} disconnected`);
          setConfirm(null);
        }}
      />
    </>
  );
}

export function AssistantsHome() {
  const [client, setClient] = React.useState<ClientId>("claude");
  // Empty on the server, the real address once in the browser (this deployment's own origin).
  const origin = React.useSyncExternalStore(noSubscribe, () => window.location.origin, () => "");
  const url = `${origin}/api/v1/mcp`;

  return (
    <div className="mx-auto flex w-full flex-col gap-8">
      <div>
        <h1 className="text-[32px] font-semibold leading-tight tracking-[-0.035em] text-white">AI assistants</h1>
        <p className="mt-2 text-base leading-relaxed text-white/60">
          Connect Claude, ChatGPT or your code editor to Dossier. Your assistant can read your applications and suggest updates, for
          example from recruiter emails it reads with its own Gmail access. Dossier never sees your email.
        </p>
      </div>

      <section className="flex flex-col gap-3" aria-labelledby="address-heading">
        <h2 id="address-heading" className={sectionTitle}>
          Dossier&apos;s address for assistants
        </h2>
        <CopyField label="address" value={url} />
      </section>

      <section className="flex flex-col gap-4" aria-labelledby="setup-heading">
        <h2 id="setup-heading" className={sectionTitle}>
          Set it up
        </h2>
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 [scrollbar-width:none]" role="tablist" aria-label="Assistant">
          {CLIENTS.map((c) => (
            <button
              key={c.id}
              type="button"
              role="tab"
              aria-selected={client === c.id}
              onClick={() => setClient(c.id)}
              className={cn(
                "h-9 shrink-0 rounded-lg px-3 text-sm font-semibold transition-colors",
                client === c.id ? "bg-white/10 text-white" : "text-white/55 hover:bg-white/[0.04] hover:text-white",
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
        <div role="tabpanel" className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-5">
          <Steps client={client} url={url} />
        </div>
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="try-heading">
        <h2 id="try-heading" className={sectionTitle}>
          Things to ask
        </h2>
        <ul className="flex flex-col gap-2">
          {PROMPTS.map((p) => (
            <li key={p} className="rounded-lg border border-white/[0.08] bg-[#141414] px-4 py-3 text-[15px] font-medium text-white/80">
              “{p}”
            </li>
          ))}
        </ul>
      </section>

      <section className="flex gap-3 rounded-lg border border-emerald-400/20 bg-emerald-400/[0.05] p-4" aria-label="What assistants can do">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-emerald-400" aria-hidden />
        <p className="text-[15px] font-medium leading-relaxed text-white/75">
          Assistants can only read your tracker and <span className="font-semibold text-white">suggest</span> changes. Suggestions wait under
          Applications → Updates to review until you apply them. They can&apos;t see your resumes, interview kits or password.
        </p>
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="connected-heading">
        <h2 id="connected-heading" className={sectionTitle}>
          Connected
        </h2>
        <Connected />
      </section>
    </div>
  );
}

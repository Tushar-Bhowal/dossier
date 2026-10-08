"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { AccountDataSummary } from "@dossier/core/account";
import { ArrowRight, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast";
import { ACCOUNT_SAMPLE, accountKeys, deleteAccount, getDataSummary } from "@/lib/account/api";
import { Panel, SettingsSection } from "./parts";

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

function summaryLines(s: AccountDataSummary): string[] {
  return [
    s.kits && plural(s.kits, "interview kit and its practice progress", "interview kits and their practice progress"),
    s.applications && plural(s.applications, "job application and its interviews", "job applications and their interviews"),
    s.resumes && plural(s.resumes, "resume", "resumes"),
    s.chatMessages && plural(s.chatMessages, "chat message", "chat messages"),
    s.assistants && plural(s.assistants, "connected AI assistant", "connected AI assistants"),
    "Your reminder settings and your own Gemini key, if you added one",
  ].filter((line): line is string => Boolean(line));
}

function DeleteSummary({ open }: { open: boolean }) {
  const summary = useQuery({ queryKey: accountKeys.summary, queryFn: getDataSummary, enabled: open });

  return (
    <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-4">
      <p className="text-sm font-semibold text-white">This removes:</p>
      {summary.isPending ? (
        <div className="mt-3 flex flex-col gap-2" aria-busy="true">
          <Skeleton className="h-4 w-56 rounded-lg bg-white/[0.06]" />
          <Skeleton className="h-4 w-44 rounded-lg bg-white/[0.06]" />
          <Skeleton className="h-4 w-52 rounded-lg bg-white/[0.06]" />
        </div>
      ) : (
        <ul className="mt-2 flex list-disc flex-col gap-1.5 pl-5 text-sm font-medium leading-relaxed text-white/75 marker:text-white/30">
          {summary.isError ? (
            <li>Everything in your account: kits, applications, resumes, chat, reminders and connected assistants</li>
          ) : (
            summaryLines(summary.data).map((line) => <li key={line}>{line}</li>)
          )}
        </ul>
      )}
    </div>
  );
}

export function DataSection() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  async function handleDelete() {
    try {
      await deleteAccount();
    } catch (err) {
      toast.error("Couldn't delete your account", { description: "Nothing was removed. Try again in a moment." });
      throw err;
    }
    if (ACCOUNT_SAMPLE) {
      toast.success("Account deleted (sample)", {
        description: "This page isn't connected yet, so nothing was actually deleted.",
      });
      return;
    }
    queryClient.clear();
    toast.success("Your account and everything in it is deleted.");
    router.replace("/");
  }

  return (
    <SettingsSection
      id="data"
      sample
      title="Privacy and your data"
      description="Only you can see what's in your account. Read how it's handled, or delete all of it."
    >
      <div className="flex flex-col gap-4">
        <Panel className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[15px] font-semibold text-white">What Dossier stores</p>
            <p className="mt-0.5 text-sm font-medium text-white/55">What&apos;s kept, who processes it, and for how long.</p>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="outline" className="h-11 flex-1 sm:h-9 sm:flex-none">
              <Link href="/privacy">
                Privacy
                <ArrowRight className="size-4" aria-hidden />
              </Link>
            </Button>
            <Button asChild variant="ghost" className="h-11 flex-1 sm:h-9 sm:flex-none">
              <Link href="/terms">Terms</Link>
            </Button>
          </div>
        </Panel>

        <Panel className="flex flex-col gap-4 border-destructive/25 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[15px] font-semibold text-white">Delete my account</p>
            <p className="mt-0.5 text-sm font-medium text-white/55">
              Permanently removes your account and everything in it. This can&apos;t be undone.
            </p>
          </div>
          <Button variant="destructive" className="h-11 shrink-0 sm:h-9" onClick={() => setConfirmOpen(true)}>
            <Trash2 className="size-4" aria-hidden />
            Delete my account
          </Button>
        </Panel>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Delete your account?"
        description="Your account and everything in it is deleted for good. You'll be signed out, and this can't be undone."
        confirmLabel="Delete my account"
        confirmingLabel="Deleting…"
        icon={<Trash2 className="size-4" />}
        onConfirm={handleDelete}
      >
        <DeleteSummary open={confirmOpen} />
      </ConfirmDialog>
    </SettingsSection>
  );
}

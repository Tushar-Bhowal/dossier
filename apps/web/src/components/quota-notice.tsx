"use client";

import Link from "next/link";
import { Clock, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useOpenSettings } from "@/components/settings/SettingsDialog";
import { formatResetTime } from "@/lib/account/usage";
import { cn } from "@/lib/utils";

// The one "daily limit reached" message every AI feature shows.
export function QuotaNotice({ resetsAt, className }: { resetsAt?: string; className?: string }) {
  const openSettings = useOpenSettings();
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col gap-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-5 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <Clock className="mt-0.5 size-5 shrink-0 text-amber-300" aria-hidden />
        <div>
          <p className="text-[15px] font-semibold text-white">Today&apos;s free AI requests are used up</p>
          <p className="mt-1 text-sm leading-relaxed text-white/70">
            They come back at {formatResetTime(resetsAt)} your time. Everything you&apos;ve made is still here to edit and
            download.
          </p>
        </div>
      </div>
      {openSettings ? (
        <Button variant="outline" className="h-11 shrink-0 sm:h-10" onClick={() => openSettings("key")}>
          <KeyRound className="size-4" aria-hidden />
          Use your own free key
        </Button>
      ) : (
        <Button asChild variant="outline" className="h-11 shrink-0 sm:h-10">
          <Link href="/home?settings=key">
            <KeyRound className="size-4" aria-hidden />
            Use your own free key
          </Link>
        </Button>
      )}
    </div>
  );
}

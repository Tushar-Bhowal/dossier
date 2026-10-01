"use client";

import * as React from "react";
import { Camera, LoaderCircle } from "lucide-react";
import type { CareerProfile } from "@dossier/core/resume";
import { resizePhoto } from "@/lib/resume/photo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function PhotoControl({
  profile,
  showPhoto,
  onToggle,
  onProfileSave,
}: {
  profile: CareerProfile;
  showPhoto: boolean;
  onToggle: (on: boolean) => void;
  onProfileSave: (profile: CareerProfile) => Promise<void>;
}) {
  const input = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const add = async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      const photo = await resizePhoto(file);
      await onProfileSave({ ...profile, photo });
      onToggle(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't add that photo.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-white/[0.08] bg-[#111111] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] sm:flex-row sm:items-center">
      <div className="flex flex-1 items-center gap-3">
        {profile.photo ? (
          // eslint-disable-next-line @next/next/no-img-element -- a local data URL, nothing to optimise
          <img src={profile.photo.dataUrl} alt="Your resume photo" className="h-14 w-11 rounded-md object-cover" />
        ) : (
          <span className="flex size-11 items-center justify-center rounded-lg bg-white/[0.04] text-white/60">
            <Camera className="size-5" aria-hidden />
          </span>
        )}
        <div>
          <p className="text-base font-semibold text-white">Photo</p>
          <p className="text-sm font-medium text-white/55">
            Off by default. Some schools and government jobs in India expect one; most companies don&apos;t.
          </p>
        </div>
      </div>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void add(file);
          e.target.value = "";
        }}
      />
      <div className="flex items-center gap-2">
        {profile.photo && (
          <button
            type="button"
            role="switch"
            aria-checked={showPhoto}
            onClick={() => onToggle(!showPhoto)}
            className="flex h-9 items-center gap-2.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 text-sm font-semibold text-white/85"
          >
            <span className={cn("relative h-5 w-9 rounded-full transition-colors", showPhoto ? "bg-[#dc3019]" : "bg-white/15")}>
              <span
                className={cn(
                  "absolute top-0.5 size-4 rounded-full bg-white transition-transform",
                  showPhoto ? "translate-x-[18px]" : "translate-x-0.5",
                )}
              />
            </span>
            {showPhoto ? "Shown" : "Hidden"}
          </button>
        )}
        <Button type="button" variant="outline" size="sm" onClick={() => input.current?.click()} disabled={busy}>
          {busy && <LoaderCircle className="size-3.5 animate-spin" />}
          {profile.photo ? "Replace" : "Add a photo"}
        </Button>
      </div>
      {error && <p className="text-[13px] font-medium text-amber-300 sm:basis-full">{error}</p>}
    </section>
  );
}

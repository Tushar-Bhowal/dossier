"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, LoaderCircle, PenLine } from "lucide-react";
import { toRenderData, type CareerProfile } from "@dossier/core/resume";
import { getResume, resumeKeys, saveProfile, saveResume } from "@/lib/resume/api";
import { useResumePdf } from "@/lib/resume/typst/compiler";
import { resizePhoto } from "@/lib/resume/photo";
import { useScenario } from "@/lib/resume/demo/scenario";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PdfPages } from "../PdfPages";
import { DownloadMenu } from "../DownloadMenu";
import { cardClass } from "./Thread";

export function DoneCard({
  resumeId,
  profile,
  photoNote,
}: {
  resumeId: string;
  profile: CareerProfile;
  photoNote: string | null;
}) {
  const queryClient = useQueryClient();
  const scenario = useScenario();
  const [current, setCurrent] = React.useState(profile);
  const [photoDecided, setPhotoDecided] = React.useState(false);
  const [photoBusy, setPhotoBusy] = React.useState(false);
  const [photoError, setPhotoError] = React.useState<string | null>(null);
  const input = React.useRef<HTMLInputElement>(null);

  const resume = useQuery({ queryKey: resumeKeys.resume(resumeId), queryFn: () => getResume(resumeId) });
  const data = React.useMemo(() => (resume.data ? toRenderData(current, resume.data) : null), [resume.data, current]);
  const { pdf, status } = useResumePdf(data, { simulateFailure: scenario.fail === "typst" });

  const addPhoto = async (file: File) => {
    if (!resume.data) return;
    setPhotoBusy(true);
    setPhotoError(null);
    try {
      const photo = await resizePhoto(file);
      const saved = await saveProfile({ ...current, photo });
      await saveResume({ ...resume.data, showPhoto: true });
      setCurrent(saved);
      setPhotoDecided(true);
      await queryClient.invalidateQueries({ queryKey: resumeKeys.all });
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : "Couldn't add that photo.");
    } finally {
      setPhotoBusy(false);
    }
  };

  return (
    <div className={cardClass}>
      <div className="flex flex-col gap-5 sm:flex-row">
        <div className="w-full shrink-0 overflow-hidden rounded-md bg-[#1a1a1a] p-2 sm:w-44">
          {pdf && status !== "error" ? (
            <div className="max-h-60 overflow-hidden">
              <PdfPages pdf={pdf} label="Your new resume" />
            </div>
          ) : status === "error" ? (
            <p className="p-3 text-[13px] font-medium text-white/60">Preview unavailable — you can still download it as Word.</p>
          ) : (
            <Skeleton className="aspect-[1/1.414] w-full rounded-[3px]" />
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <h2 className="text-[20px] font-semibold tracking-[-0.02em] text-white">Your resume is ready</h2>
          <p className="mt-1.5 text-[15px] leading-relaxed text-white/65">
            One page, single column, standard headings — the layout every company and job site reads. Every line comes from
            something you told me.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button asChild size="lg">
              <Link href={`/resumes/${resumeId}`}>
                <PenLine className="size-4" />
                Open and edit
              </Link>
            </Button>
            {data && <DownloadMenu data={data} pdf={pdf} pdfFailed={status === "error"} variant="outline" size="lg" />}
          </div>
        </div>
      </div>

      {photoNote && !photoDecided && !current.photo && (
        <div className="mt-5 flex flex-col gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] p-4 sm:flex-row sm:items-center">
          <Camera className="size-5 shrink-0 text-[#ff7a5c]" aria-hidden />
          <p className="flex-1 text-sm leading-relaxed text-white/75">
            {photoNote} Most private companies prefer none, so it&apos;s off unless you add one.
          </p>
          <input
            ref={input}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            tabIndex={-1}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void addPhoto(file);
              e.target.value = "";
            }}
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={() => input.current?.click()} disabled={photoBusy}>
              {photoBusy && <LoaderCircle className="size-3.5 animate-spin" />}
              Add a photo
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setPhotoDecided(true)} disabled={photoBusy}>
              No thanks
            </Button>
          </div>
          {photoError && <p className="text-[13px] font-medium text-amber-300 sm:basis-full">{photoError}</p>}
        </div>
      )}
    </div>
  );
}

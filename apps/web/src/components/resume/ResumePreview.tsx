"use client";

import * as React from "react";
import { AlertCircle, LoaderCircle } from "lucide-react";
import type { RenderData } from "@dossier/core/resume";
import type { ResumePdfState } from "@/lib/resume/typst/compiler";
import { Skeleton } from "@/components/ui/skeleton";
import { DownloadMenu } from "./DownloadMenu";
import { PdfPages } from "./PdfPages";
import { PageCount } from "./editor/LayoutPanel";

export function ResumePreview({
  data,
  pdfState: { pdf, status, error },
  pages,
}: {
  data: RenderData;
  pdfState: ResumePdfState;
  pages: number | null;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <DownloadMenu data={data} pdf={pdf} pdfFailed={status === "error"} />
        <span className="ml-auto flex items-center gap-2">
          {status === "rendering" && pdf && (
            <span className="flex items-center gap-1.5 text-[13px] font-medium text-white/60" role="status">
              <LoaderCircle className="size-3.5 animate-spin" aria-hidden />
              Updating
            </span>
          )}
          {pages !== null && status !== "error" && <PageCount pages={pages} />}
        </span>
      </div>

      {status === "error" ? (
        <div role="alert" className="flex flex-col gap-3 rounded-lg border border-destructive/35 bg-destructive/10 p-5">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 size-5 shrink-0 text-destructive" aria-hidden />
            <div>
              <p className="text-[15px] font-semibold text-white">The PDF preview couldn&apos;t load</p>
              <p className="mt-1 text-sm leading-relaxed text-white/70">
                Your resume is saved. You can still download it as a Word or text file from the arrow next to Download PDF
                {error && !/failed to load/i.test(error) ? ` (${error})` : ""}.
              </p>
            </div>
          </div>
        </div>
      ) : pdf ? (
        <div className="rounded-lg border border-white/[0.08] bg-[#1a1a1a] p-3 sm:p-5">
          <PdfPages pdf={pdf} label={`Preview of ${data.contact.name}'s resume`} />
        </div>
      ) : (
        <div className="flex flex-col gap-3 rounded-lg border border-white/[0.08] bg-[#1a1a1a] p-5" role="status">
          <p className="flex items-center gap-2 text-sm font-medium text-white/60">
            <LoaderCircle className="size-4 animate-spin" aria-hidden />
            Preparing your preview — the first one takes a few seconds
          </p>
          <Skeleton className="aspect-[1/1.414] w-full rounded-[3px]" />
        </div>
      )}
    </div>
  );
}

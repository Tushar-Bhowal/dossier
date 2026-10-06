"use client";

import * as React from "react";
import { AlertCircle, LoaderCircle, Minus, Plus } from "lucide-react";
import type { RenderData } from "@dossier/core/resume";
import type { ResumePdfState } from "@/lib/resume/typst/compiler";
import { Skeleton } from "@/components/ui/skeleton";
import { DownloadMenu } from "./DownloadMenu";
import { PdfViewer } from "./PdfViewer";
import { PageCount } from "./editor/LayoutPanel";

const ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3];

function ZoomControl({ zoom, onChange }: { zoom: number; onChange: (zoom: number) => void }) {
  const smaller = ZOOM_STEPS.filter((s) => s < zoom - 0.001).at(-1);
  const larger = ZOOM_STEPS.find((s) => s > zoom + 0.001);
  const percent = Math.round(zoom * 100);
  const step = "flex size-9 items-center justify-center text-white/75 transition-colors hover:bg-white/[0.06] hover:text-white disabled:pointer-events-none disabled:opacity-35";
  return (
    <div role="group" aria-label="Zoom" className="flex h-9 items-center overflow-hidden rounded-lg border border-white/10 bg-white/[0.03]">
      <button type="button" className={step} onClick={() => smaller && onChange(smaller)} disabled={!smaller} aria-label="Zoom out">
        <Minus className="size-4" aria-hidden />
      </button>
      <button
        type="button"
        onClick={() => onChange(1)}
        title="Reset to 100%. You can also pinch, or hold Ctrl / ⌘ and scroll, on the preview."
        aria-label={`Zoom ${percent}%, reset to 100%`}
        className="h-full min-w-14 border-x border-white/10 px-2 text-sm font-semibold tabular-nums text-white/85 transition-colors hover:bg-white/[0.06]"
      >
        {percent}%
      </button>
      <button type="button" className={step} onClick={() => larger && onChange(larger)} disabled={!larger} aria-label="Zoom in">
        <Plus className="size-4" aria-hidden />
      </button>
    </div>
  );
}

export function ResumePreview({
  data,
  pdfState: { pdf, status, error },
  pages,
}: {
  data: RenderData;
  pdfState: ResumePdfState;
  pages: number | null;
}) {
  const [zoom, setZoom] = React.useState(1);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <DownloadMenu data={data} pdf={pdf} pdfFailed={status === "error"} />
        {pdf && status !== "error" && <ZoomControl zoom={zoom} onChange={setZoom} />}
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
        <PdfViewer
          pdf={pdf}
          zoom={zoom}
          onZoomChange={setZoom}
          label={`Preview of ${data.contact.name}'s resume`}
          className="rounded-lg border border-white/[0.08] bg-[#1a1a1a] p-3 sm:p-5 lg:max-h-[calc(100vh-11rem)]"
        />
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

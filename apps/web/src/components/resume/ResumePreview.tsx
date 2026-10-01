"use client";

import * as React from "react";
import { AlertCircle, FileDown, FileText, LoaderCircle } from "lucide-react";
import type { RenderData } from "@dossier/core/resume";
import { useResumePdf } from "@/lib/resume/typst/compiler";
import { buildResumeDocx, downloadBlob, resumeFileName } from "@/lib/resume/docx";
import { useScenario } from "@/lib/resume/demo/scenario";
import { toast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PdfPages } from "./PdfPages";

export function ResumePreview({ data }: { data: RenderData }) {
  const scenario = useScenario();
  const { pdf, status, error } = useResumePdf(data, { simulateFailure: scenario.fail === "typst" });
  const [exportingWord, setExportingWord] = React.useState(false);

  const downloadPdf = () => {
    if (!pdf) return;
    downloadBlob(new Blob([pdf.slice().buffer as ArrayBuffer], { type: "application/pdf" }), resumeFileName(data.contact.name, "pdf"));
  };

  const downloadWord = async () => {
    setExportingWord(true);
    try {
      downloadBlob(await buildResumeDocx(data), resumeFileName(data.contact.name, "docx"));
    } catch {
      toast.error("Couldn't create the Word file", { description: "Please try again." });
    } finally {
      setExportingWord(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={downloadPdf} disabled={!pdf || status === "error"}>
          <FileDown className="size-4" />
          Download PDF
        </Button>
        <Button variant="outline" onClick={() => void downloadWord()} disabled={exportingWord}>
          {exportingWord ? <LoaderCircle className="size-4 animate-spin" /> : <FileText className="size-4" />}
          Download Word
        </Button>
        {status === "rendering" && pdf && (
          <span className="ml-auto flex items-center gap-1.5 text-[13px] font-medium text-white/55" role="status">
            <LoaderCircle className="size-3.5 animate-spin" aria-hidden />
            Updating
          </span>
        )}
      </div>

      {status === "error" ? (
        <div role="alert" className="flex flex-col gap-3 rounded-lg border border-destructive/35 bg-destructive/10 p-5">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 size-5 shrink-0 text-destructive" aria-hidden />
            <div>
              <p className="text-[15px] font-semibold text-white">The PDF preview couldn&apos;t load</p>
              <p className="mt-1 text-sm leading-relaxed text-white/70">
                Your resume is saved. You can still download it as a Word file
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

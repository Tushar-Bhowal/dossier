"use client";

import * as React from "react";
import { DropdownMenu } from "radix-ui";
import { ChevronDown, ClipboardCopy, FileCode2, FileDown, FileText, LoaderCircle, type LucideIcon } from "lucide-react";
import { toMarkdown, type RenderData } from "@dossier/core/resume";
import { buildResumeDocx, downloadBlob, resumeFileName } from "@/lib/resume/docx";
import { toast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function DownloadMenu({
  data,
  pdf,
  pdfFailed = false,
  variant = "default",
  size = "default",
}: {
  data: RenderData;
  pdf: Uint8Array | null;
  pdfFailed?: boolean;
  variant?: "default" | "outline";
  size?: "default" | "lg";
}) {
  const [busy, setBusy] = React.useState(false);
  const pdfReady = Boolean(pdf) && !pdfFailed;

  const downloadPdf = () => {
    if (!pdf) return;
    downloadBlob(new Blob([pdf.slice().buffer as ArrayBuffer], { type: "application/pdf" }), resumeFileName(data.contact.name, "pdf"));
  };

  const downloadWord = async () => {
    setBusy(true);
    try {
      downloadBlob(await buildResumeDocx(data), resumeFileName(data.contact.name, "docx"));
    } catch {
      toast.error("Couldn't create the Word file", { description: "Please try again." });
    } finally {
      setBusy(false);
    }
  };

  const downloadMarkdown = () =>
    downloadBlob(new Blob([toMarkdown(data)], { type: "text/markdown;charset=utf-8" }), resumeFileName(data.contact.name, "md"));

  const copyForAi = async () => {
    try {
      await navigator.clipboard.writeText(toMarkdown(data, { forAi: true }));
      toast.success("Copied — paste it into any AI chat", { description: "Your email and phone number were left out." });
    } catch {
      toast.error("Couldn't copy", { description: "Your browser blocked the clipboard. Try the .md download instead." });
    }
  };

  return (
    <div className="inline-flex">
      <Button
        variant={variant}
        size={size}
        onClick={downloadPdf}
        disabled={!pdfReady}
        className="rounded-r-none"
      >
        {!pdf && !pdfFailed ? <LoaderCircle className="size-4 animate-spin" /> : <FileDown className="size-4" />}
        Download<span className="hidden sm:inline">PDF</span>
      </Button>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <Button
            variant={variant}
            size={size === "lg" ? "icon-lg" : "icon"}
            aria-label="More download options"
            className={cn("rounded-l-none border-l", variant === "default" ? "border-l-black/25" : "border-l-white/10")}
          >
            {busy ? <LoaderCircle className="size-4 animate-spin" /> : <ChevronDown className="size-4" />}
          </Button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="end"
            sideOffset={6}
            className="z-50 w-[300px] max-w-[calc(100vw-32px)] rounded-lg border border-white/10 bg-[#141414] p-1.5 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.9)] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
          >
            <Item icon={FileDown} label="PDF" hint="Best for applying to jobs" disabled={!pdfReady} onSelect={downloadPdf} />
            <Item icon={FileText} label="Word (.docx)" hint="Edit it in Word or Google Docs" onSelect={() => void downloadWord()} />
            <Item
              icon={FileCode2}
              label="Text for AI tools (.md)"
              hint="Cheaper for AI to read than a PDF. Don't send it to employers."
              onSelect={downloadMarkdown}
            />
            <DropdownMenu.Separator className="my-1.5 h-px bg-white/[0.08]" />
            <Item
              icon={ClipboardCopy}
              label="Copy for AI"
              hint="Paste straight into ChatGPT or Claude. Leaves out your email and phone."
              onSelect={() => void copyForAi()}
            />
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </div>
  );
}

function Item({
  icon: Icon,
  label,
  hint,
  disabled,
  onSelect,
}: {
  icon: LucideIcon;
  label: string;
  hint: string;
  disabled?: boolean;
  onSelect: () => void;
}) {
  return (
    <DropdownMenu.Item
      disabled={disabled}
      onSelect={onSelect}
      className="flex cursor-pointer items-start gap-3 rounded-md px-3 py-2.5 outline-none transition-colors data-[disabled]:pointer-events-none data-[highlighted]:bg-white/[0.07] data-[disabled]:opacity-50"
    >
      <Icon className="mt-0.5 size-4 shrink-0 text-[#ff7a5c]" aria-hidden />
      <span className="flex flex-col gap-0.5">
        <span className="text-[14px] font-semibold text-white">{label}</span>
        <span className="text-[13px] font-medium leading-snug text-white/60">{hint}</span>
      </span>
    </DropdownMenu.Item>
  );
}

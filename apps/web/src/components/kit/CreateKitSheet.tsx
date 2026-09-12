"use client";

import * as React from "react";
import { FileText, Upload, FileCode2, AlertCircle } from "lucide-react";
import { useActiveRuns } from "@/hooks/use-active-runs";
import { type RunCreateInput } from "@/lib/api";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export const SAMPLE_JD = `Role: Senior Backend Engineer, Infrastructure & Core Payments
Company: Stripe
Location: San Francisco, CA / Remote

About Stripe:
Stripe builds economic infrastructure for the internet. Businesses of every size, from new startups to public companies, use our software to accept payments and manage their businesses online.

About the Role:
We are looking for senior backend engineers to join our Core Payments Infrastructure team. You will be responsible for designing, building, and operating high-throughput, low-latency distributed systems that process billions of dollars in transactions daily with 99.999% availability.

Responsibilities:
- Architect, build, and maintain resilient distributed payment systems and transactional ledgers.
- Drive high availability, data consistency, and low latency across global data centers.
- Collaborate with product managers, security engineers, and data teams to deliver new payment rails.
- Write readable, testable, and maintainable code in Go, Java, or Ruby.
- Participate in on-call rotations and lead incident responses and post-mortems.

Requirements:
- 5+ years of software engineering experience building large-scale backend distributed systems.
- Deep expertise in relational databases (PostgreSQL/MySQL), transaction isolation levels, and distributed locking.
- Strong proficiency in concurrency, idempotency, and asynchronous event-driven messaging (Kafka, SQS).
- Solid foundation in system design, API design (REST/gRPC), and domain-driven architecture.
- Experience operating production systems at scale with high reliability requirements.`;

export const SAMPLE_COMPANY_URL = "https://stripe.com";
export const SAMPLE_DAYS = 14;

const MAX_DAYS = 90;

function validateRow(raw: unknown, index: number): { row: RunCreateInput } | { error: string } {
  const label = `Row ${index + 1}`;
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { error: `${label}: expected an object with jd, company_url, days` };
  }
  const obj = raw as Record<string, unknown>;
  if (typeof obj.jd !== "string" || obj.jd.trim().length === 0) {
    return { error: `${label}: "jd" must be a non-empty string` };
  }
  if (typeof obj.company_url !== "string") {
    return { error: `${label}: "company_url" must be a string` };
  }
  try {
    new URL(obj.company_url);
  } catch {
    return { error: `${label}: "company_url" is not a valid URL` };
  }
  if (typeof obj.days !== "number" || !Number.isInteger(obj.days) || obj.days < 1 || obj.days > MAX_DAYS) {
    return { error: `${label}: "days" must be an integer between 1 and ${MAX_DAYS}` };
  }
  return { row: { jd: obj.jd, company_url: obj.company_url, days: obj.days } };
}

interface CreateKitSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prefillSample?: boolean;
}

export function CreateKitSheet({ open, onOpenChange, prefillSample = false }: CreateKitSheetProps) {
  const { addRun, addBulkRuns } = useActiveRuns();

  const [activeTab, setActiveTab] = React.useState<"single" | "bulk">("single");

  // Single kit form state
  const [jd, setJd] = React.useState("");
  const [companyUrl, setCompanyUrl] = React.useState("");
  const [days, setDays] = React.useState("14");
  const [singleError, setSingleError] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Bulk upload state
  const [bulkRows, setBulkRows] = React.useState<RunCreateInput[] | null>(null);
  const [fileError, setFileError] = React.useState<string | null>(null);
  const [isBulkSubmitting, setIsBulkSubmitting] = React.useState(false);

  // If prefillSample is requested, populate on open
  React.useEffect(() => {
    if (open && prefillSample) {
      setJd(SAMPLE_JD);
      setCompanyUrl(SAMPLE_COMPANY_URL);
      setDays(String(SAMPLE_DAYS));
      setSingleError(null);
    }
  }, [open, prefillSample]);

  const handleFillSample = () => {
    setJd(SAMPLE_JD);
    setCompanyUrl(SAMPLE_COMPANY_URL);
    setDays(String(SAMPLE_DAYS));
    setSingleError(null);
  };

  const handleSingleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSingleError(null);

    const daysNum = Number(days);
    if (jd.trim().length === 0) {
      setSingleError("Paste a job description first.");
      return;
    }
    try {
      new URL(companyUrl.startsWith("http") ? companyUrl : `https://${companyUrl}`);
    } catch {
      setSingleError("Enter a valid company URL, including https://.");
      return;
    }
    if (!Number.isInteger(daysNum) || daysNum < 1 || daysNum > MAX_DAYS) {
      setSingleError(`Days must be an integer between 1 and ${MAX_DAYS}.`);
      return;
    }

    const normalizedUrl = companyUrl.startsWith("http") ? companyUrl : `https://${companyUrl}`;

    setIsSubmitting(true);
    try {
      await addRun({
        jd: jd.trim(),
        company_url: normalizedUrl,
        days: daysNum,
      });

      // Clear form and close immediately! Zero wait, no redirect.
      setJd("");
      setCompanyUrl("");
      setDays("14");
      onOpenChange(false);
    } catch (err) {
      setSingleError(err instanceof Error ? err.message : "Couldn't start generation. Try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFileError(null);
    setBulkRows(null);
    const file = e.target.files?.[0];
    if (!file) return;

    file
      .text()
      .then((text) => {
        let parsed: unknown;
        try {
          parsed = JSON.parse(text);
        } catch {
          setFileError("That file isn't valid JSON.");
          return;
        }
        if (!Array.isArray(parsed)) {
          setFileError("The file must contain a JSON array of { jd, company_url, days } objects.");
          return;
        }
        if (parsed.length === 0) {
          setFileError("The file is empty — add at least one row.");
          return;
        }

        const validRows: RunCreateInput[] = [];
        const errors: string[] = [];
        parsed.forEach((item, i) => {
          const result = validateRow(item, i);
          if ("error" in result) {
            errors.push(result.error);
          } else {
            validRows.push(result.row);
          }
        });

        if (errors.length > 0) {
          setFileError(errors.join(" · "));
          return;
        }

        setBulkRows(validRows);
      })
      .catch(() => setFileError("Couldn't read that file."));
  };

  const handleBulkSubmit = async () => {
    if (!bulkRows || bulkRows.length === 0) return;
    setIsBulkSubmitting(true);
    try {
      await addBulkRuns(bulkRows);
      setBulkRows(null);
      setFileError(null);
      onOpenChange(false);
    } catch (err) {
      setFileError(err instanceof Error ? err.message : "Failed to queue bulk runs.");
    } finally {
      setIsBulkSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col gap-5 sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <div className="flex items-center justify-between pr-6">
            <SheetTitle>Create interview kit</SheetTitle>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleFillSample}
              className="text-xs text-[#FB4128] hover:text-[#FB4128] hover:bg-[#FB4128]/10 gap-1.5 h-8 px-2 rounded-lg"
            >
              <FileText className="size-3.5" />
              Fill with sample
            </Button>
          </div>
          <SheetDescription>
            Researching the company and role takes ~2 minutes. Runs execute live in your workspace.
          </SheetDescription>
        </SheetHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "single" | "bulk")} className="w-full">
          <TabsList className="w-full grid grid-cols-2 mb-4">
            <TabsTrigger value="single">Single kit</TabsTrigger>
            <TabsTrigger value="bulk">Bulk upload</TabsTrigger>
          </TabsList>

          <TabsContent value="single" className="flex flex-col gap-4 focus-visible:outline-hidden mt-0">
            <form onSubmit={handleSingleSubmit} className="flex flex-col gap-4" noValidate>
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="sheet-jd">Job description</Label>
                  <span className="text-[11px] text-muted-foreground">Pasted text</span>
                </div>
                <Textarea
                  id="sheet-jd"
                  required
                  rows={11}
                  value={jd}
                  onChange={(e) => setJd(e.target.value)}
                  disabled={isSubmitting}
                  placeholder="Paste the full job description or requirements here…"
                  className="font-mono text-xs resize-y min-h-[180px]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="sheet-url">Company URL</Label>
                  <Input
                    id="sheet-url"
                    type="url"
                    required
                    value={companyUrl}
                    onChange={(e) => setCompanyUrl(e.target.value)}
                    disabled={isSubmitting}
                    placeholder="https://example.com"
                    className="text-xs"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="sheet-days">Days until interview</Label>
                  <Input
                    id="sheet-days"
                    type="number"
                    min={1}
                    max={MAX_DAYS}
                    required
                    value={days}
                    onChange={(e) => setDays(e.target.value)}
                    disabled={isSubmitting}
                    className="text-xs"
                  />
                </div>
              </div>

              {singleError ? (
                <Alert variant="destructive" className="py-2.5">
                  <AlertCircle className="size-4" />
                  <AlertDescription className="text-xs">{singleError}</AlertDescription>
                </Alert>
              ) : null}

              <div className="flex items-center justify-between pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onOpenChange(false)}
                  disabled={isSubmitting}
                  className="rounded-lg"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-[#FB4128] hover:bg-[#FB4128]/90 text-white font-medium rounded-lg"
                >
                  {isSubmitting ? "Starting generation…" : "Generate kit"}
                </Button>
              </div>
            </form>
          </TabsContent>

          <TabsContent value="bulk" className="flex flex-col gap-4 focus-visible:outline-hidden mt-0">
            <div className="flex flex-col gap-3 rounded-lg border border-dashed border-border/80 bg-muted/20 p-6 text-center">
              <div className="mx-auto flex size-10 items-center justify-center rounded-lg bg-muted">
                <Upload className="size-5 text-muted-foreground" />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium text-foreground">Upload JSON array</span>
                <span className="text-xs text-muted-foreground">
                  Array of {`{ jd, company_url, days }`} objects. Max 2 run concurrently.
                </span>
              </div>
              <Input
                id="bulk-file-upload"
                type="file"
                accept="application/json,.json"
                onChange={handleFileChange}
                disabled={isBulkSubmitting}
                className="cursor-pointer text-xs"
              />
            </div>

            {fileError ? (
              <Alert variant="destructive" className="py-2.5">
                <AlertCircle className="size-4" />
                <AlertTitle className="text-xs font-semibold">Invalid file format</AlertTitle>
                <AlertDescription className="text-xs">{fileError}</AlertDescription>
              </Alert>
            ) : null}

            {bulkRows && (
              <div className="flex flex-col gap-2 rounded-lg border border-border/60 bg-card p-3">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 font-medium text-foreground">
                    <FileCode2 className="size-4 text-[#FB4128]" />
                    <span>{bulkRows.length} valid row{bulkRows.length === 1 ? "" : "s"} ready</span>
                  </div>
                  <span className="text-muted-foreground text-[11px]">2 concurrent, {Math.max(0, bulkRows.length - 2)} queued</span>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
                disabled={isBulkSubmitting}
                className="rounded-lg"
              >
                Cancel
              </Button>
              <Button
                onClick={handleBulkSubmit}
                disabled={!bulkRows || isBulkSubmitting}
                className="bg-[#FB4128] hover:bg-[#FB4128]/90 text-white font-medium rounded-lg"
              >
                {isBulkSubmitting
                  ? "Queuing runs…"
                  : `Start ${bulkRows ? bulkRows.length : 0} runs`}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

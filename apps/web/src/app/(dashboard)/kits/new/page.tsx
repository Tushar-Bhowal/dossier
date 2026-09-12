"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createRun, ApiError, type RunCreateInput } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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

interface RowResult {
  index: number;
  status: "pending" | "running" | "done" | "error";
  message?: string;
  runId?: string;
}

export default function NewKitPage() {
  const router = useRouter();

  const [jd, setJd] = useState("");
  const [companyUrl, setCompanyUrl] = useState("");
  const [days, setDays] = useState("14");
  const [singleError, setSingleError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  const [rows, setRows] = useState<RunCreateInput[] | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [results, setResults] = useState<RowResult[]>([]);
  const [bulkRunning, setBulkRunning] = useState(false);

  async function onSingleSubmit(e: FormEvent) {
    e.preventDefault();
    setSingleError(null);
    const daysNum = Number(days);
    if (jd.trim().length === 0) {
      setSingleError("Paste a job description first.");
      return;
    }
    try {
      new URL(companyUrl);
    } catch {
      setSingleError("Enter a valid company URL, including https://.");
      return;
    }
    if (!Number.isInteger(daysNum) || daysNum < 1 || daysNum > MAX_DAYS) {
      setSingleError(`Days must be an integer between 1 and ${MAX_DAYS}.`);
      return;
    }

    setGenerating(true);
    try {
      const run = await createRun({ jd, company_url: companyUrl, days: daysNum });
      router.push(`/runs/${run.id}`);
    } catch (err) {
      setSingleError(err instanceof ApiError ? err.message : "Couldn't start the run. Try again.");
      setGenerating(false);
    }
  }

  function onFileChange(e: ChangeEvent<HTMLInputElement>) {
    setFileError(null);
    setRows(null);
    setResults([]);
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
          setFileError("The file must contain a JSON array of {jd, company_url, days} objects.");
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
        setRows(validRows);
      })
      .catch(() => setFileError("Couldn't read that file."));
  }

  async function onBulkSubmit(currentRows: RunCreateInput[]) {
    setBulkRunning(true);
    const initial: RowResult[] = currentRows.map((_, index) => ({ index, status: "pending" }));
    setResults(initial);

    const CONCURRENCY = 2;
    let cursor = 0;

    async function worker() {
      while (cursor < currentRows.length) {
        const index = cursor++;
        const row = currentRows[index]!;
        setResults((prev) => prev.map((r) => (r.index === index ? { ...r, status: "running" } : r)));
        try {
          const run = await createRun(row);
          setResults((prev) =>
            prev.map((r) => (r.index === index ? { ...r, status: "done", runId: run.id } : r)),
          );
        } catch (err) {
          const message = err instanceof ApiError ? err.message : "Couldn't start this run.";
          setResults((prev) => prev.map((r) => (r.index === index ? { ...r, status: "error", message } : r)));
        }
      }
    }

    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, currentRows.length) }, () => worker()));
    setBulkRunning(false);
  }

  const bulkDone = results.length > 0 && results.every((r) => r.status === "done" || r.status === "error");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New kit</h1>
        <p className="text-sm text-muted-foreground">
          Generation researches the company and can take a few minutes — you&apos;ll watch it progress
          step by step.
        </p>
      </div>

      <Tabs defaultValue="single">
        <TabsList>
          <TabsTrigger value="single">Single kit</TabsTrigger>
          <TabsTrigger value="bulk">Bulk upload</TabsTrigger>
        </TabsList>

        <TabsContent value="single">
          <Card>
            <CardHeader>
              <CardTitle>Job description &amp; company</CardTitle>
              <CardDescription>Paste the JD as text — Dossier never fetches it from a job board.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={onSingleSubmit} className="flex flex-col gap-4" noValidate>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="jd">Job description</Label>
                  <Textarea
                    id="jd"
                    required
                    rows={10}
                    value={jd}
                    onChange={(e) => setJd(e.target.value)}
                    disabled={generating}
                    placeholder="Paste the full job description here…"
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="company_url">Company URL</Label>
                    <Input
                      id="company_url"
                      type="url"
                      required
                      value={companyUrl}
                      onChange={(e) => setCompanyUrl(e.target.value)}
                      disabled={generating}
                      placeholder="https://example.com"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="days">Days available</Label>
                    <Input
                      id="days"
                      type="number"
                      min={1}
                      max={MAX_DAYS}
                      required
                      value={days}
                      onChange={(e) => setDays(e.target.value)}
                      disabled={generating}
                    />
                  </div>
                </div>
                {singleError ? (
                  <Alert variant="destructive">
                    <AlertDescription>{singleError}</AlertDescription>
                  </Alert>
                ) : null}
                <Button type="submit" disabled={generating} className="self-start">
                  {generating ? "Starting generation…" : "Generate kit"}
                </Button>
                {generating ? (
                  <p className="text-sm text-muted-foreground" role="status">
                    This can take a few minutes while Dossier researches the company. Hang tight —
                    you&apos;ll be taken to a live progress view.
                  </p>
                ) : null}
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bulk">
          <Card>
            <CardHeader>
              <CardTitle>Bulk upload</CardTitle>
              <CardDescription>
                Upload a JSON file that&apos;s an array of {"{ jd, company_url, days }"} objects. Each row
                starts its own run.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="bulk-file">JSON file</Label>
                <Input id="bulk-file" type="file" accept="application/json,.json" onChange={onFileChange} />
              </div>

              {fileError ? (
                <Alert variant="destructive">
                  <AlertTitle>Couldn&apos;t use this file</AlertTitle>
                  <AlertDescription>{fileError}</AlertDescription>
                </Alert>
              ) : null}

              {rows && results.length === 0 ? (
                <div className="flex flex-col gap-3">
                  <p className="text-sm text-muted-foreground">
                    {rows.length} valid row{rows.length === 1 ? "" : "s"} ready to submit.
                  </p>
                  <Button onClick={() => onBulkSubmit(rows)} disabled={bulkRunning} className="self-start">
                    {bulkRunning ? "Starting runs…" : `Start ${rows.length} run${rows.length === 1 ? "" : "s"}`}
                  </Button>
                </div>
              ) : null}

              {results.length > 0 ? (
                <ul className="flex flex-col gap-2">
                  {results.map((r) => (
                    <li
                      key={r.index}
                      className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-sm"
                    >
                      <span className="text-muted-foreground">Row {r.index + 1}</span>
                      {r.status === "pending" || r.status === "running" ? (
                        <span className="text-muted-foreground">
                          {r.status === "running" ? "Starting…" : "Waiting…"}
                        </span>
                      ) : r.status === "done" && r.runId ? (
                        <Link href={`/runs/${r.runId}`} className="underline underline-offset-4">
                          View run
                        </Link>
                      ) : (
                        <span className="text-destructive">{r.message}</span>
                      )}
                    </li>
                  ))}
                </ul>
              ) : null}

              {bulkDone ? (
                <p className="text-sm text-muted-foreground">
                  All rows processed. Successful runs are linked above —{" "}
                  <Link href="/kits" className="underline underline-offset-4">
                    view your kits
                  </Link>{" "}
                  once they finish.
                </p>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

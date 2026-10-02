"use client";

import * as React from "react";
import type { RenderData } from "@dossier/core/resume";
import type { CompileRequest, CompileResponse } from "./compileWorker";
import { countPdfPages } from "../pdfText";

type Pending = { resolve: (pdf: Uint8Array) => void; reject: (err: Error) => void };

let worker: Worker | null = null;
let nextId = 0;
const pending = new Map<number, Pending>();

function rejectAll(message: string) {
  for (const p of pending.values()) p.reject(new Error(message));
  pending.clear();
}

function getWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL("./compileWorker.ts", import.meta.url), { type: "module" });
  worker.onmessage = (event: MessageEvent<CompileResponse>) => {
    const res = event.data;
    const p = pending.get(res.id);
    if (!p) return;
    pending.delete(res.id);
    if (res.ok) p.resolve(res.pdf);
    else p.reject(new Error(res.error));
  };
  worker.onerror = () => {
    worker?.terminate();
    worker = null;
    rejectAll("The PDF renderer failed to load.");
  };
  return worker;
}

export function compileResumePdf(data: RenderData): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const id = ++nextId;
    pending.set(id, { resolve, reject });
    const request: CompileRequest = { id, data };
    getWorker().postMessage(request);
  });
}

export type PdfStatus = "idle" | "rendering" | "ready" | "error";

export interface ResumePdfState {
  pdf: Uint8Array | null;
  // The data this PDF was rendered from — it can lag behind the latest edits while a render runs.
  source: RenderData | null;
  status: PdfStatus;
  error: string | null;
}

// Debounced so typing doesn't queue a compile per keystroke; a stale result never overwrites a
// newer one because only the latest request's answer is applied.
export function useResumePdf(
  data: RenderData | null,
  { debounceMs = 300, simulateFailure = false }: { debounceMs?: number; simulateFailure?: boolean } = {},
): ResumePdfState {
  const [state, setState] = React.useState<ResumePdfState>({ pdf: null, source: null, status: "idle", error: null });
  const latest = React.useRef(0);
  const key = React.useMemo(() => (data ? JSON.stringify(data) : null), [data]);

  React.useEffect(() => {
    if (!key) return;
    const ticket = ++latest.current;
    const timer = window.setTimeout(() => {
      setState((s) => ({ ...s, status: "rendering", error: null }));
      const source = JSON.parse(key) as RenderData;
      const run = simulateFailure
        ? Promise.reject(new Error("The PDF renderer failed to load."))
        : compileResumePdf(source);
      run.then(
        (pdf) => {
          if (ticket === latest.current) setState({ pdf, source, status: "ready", error: null });
        },
        (err: Error) => {
          if (ticket === latest.current) setState((s) => ({ ...s, status: "error", error: err.message }));
        },
      );
    }, debounceMs);
    return () => window.clearTimeout(timer);
  }, [key, debounceMs, simulateFailure]);

  return state;
}

// Null until the first PDF is counted; keeps the last count while a newer PDF is being read.
export function usePageCount(pdf: Uint8Array | null): number | null {
  const [count, setCount] = React.useState<number | null>(null);
  React.useEffect(() => {
    if (!pdf) return;
    let cancelled = false;
    countPdfPages(pdf).then(
      (n) => !cancelled && setCount(n),
      () => {},
    );
    return () => {
      cancelled = true;
    };
  }, [pdf]);
  return count;
}

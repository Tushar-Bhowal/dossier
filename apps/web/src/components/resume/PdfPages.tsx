"use client";

import * as React from "react";
import { loadPdfJs } from "@/lib/resume/pdfText";

// Draws each page onto a canvas with pdf.js. An <iframe> PDF viewer would be simpler, but mobile
// browsers (Android Chrome in particular) download the file instead of showing it.
export function PdfPages({ pdf, label }: { pdf: Uint8Array; label: string }) {
  const container = React.useRef<HTMLDivElement>(null);
  const [width, setWidth] = React.useState(0);

  React.useEffect(() => {
    const el = container.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(Math.round(entry.contentRect.width));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  React.useEffect(() => {
    const el = container.current;
    if (!el || width === 0) return;
    let cancelled = false;

    (async () => {
      const pdfjs = await loadPdfJs();
      const task = pdfjs.getDocument({ data: pdf.slice() });
      const doc = await task.promise;
      const canvases: HTMLCanvasElement[] = [];
      try {
        for (let n = 1; n <= doc.numPages; n++) {
          const page = await doc.getPage(n);
          const base = page.getViewport({ scale: 1 });
          const ratio = window.devicePixelRatio || 1;
          const viewport = page.getViewport({ scale: (width / base.width) * ratio });
          const canvas = document.createElement("canvas");
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
          canvas.style.width = `${width}px`;
          canvas.style.height = `${Math.floor(viewport.height / ratio)}px`;
          canvas.className = "block rounded-[3px] bg-white shadow-[0_18px_50px_-24px_rgba(0,0,0,0.9)]";
          await page.render({ canvas, viewport }).promise;
          canvases.push(canvas);
        }
      } finally {
        await task.destroy();
      }
      if (!cancelled) el.replaceChildren(...canvases);
    })().catch(() => {
      // The previous pages stay on screen if a re-render fails.
    });

    return () => {
      cancelled = true;
    };
  }, [pdf, width]);

  return <div ref={container} role="img" aria-label={label} className="flex w-full flex-col gap-4" />;
}

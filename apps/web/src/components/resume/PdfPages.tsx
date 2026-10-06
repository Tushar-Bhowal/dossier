"use client";

import * as React from "react";
import { loadPdfJs } from "@/lib/resume/pdfText";

// Draws each page onto a canvas with pdf.js. An <iframe> PDF viewer would be simpler, but mobile
// browsers (Android Chrome in particular) download the file instead of showing it.
const MAX_CANVAS_WIDTH = 4096;

// `zoom` sets the drawing resolution. `liveZoom`, when given, is the zoom at the moment the pages are
// swapped in — a viewer may have kept zooming while they were drawn.
export function PdfPages({
  pdf,
  label,
  zoom = 1,
  liveZoom,
}: {
  pdf: Uint8Array;
  label: string;
  zoom?: number;
  liveZoom?: React.RefObject<number>;
}) {
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
    const pageWidth = Math.round(width * zoom);

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
          const scale = Math.min((pageWidth / base.width) * ratio, MAX_CANVAS_WIDTH / base.width);
          const viewport = page.getViewport({ scale });
          const canvas = document.createElement("canvas");
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
          canvas.dataset.aspect = String(viewport.height / viewport.width);
          // mx-auto centres pages zoomed out; once wider than the box the margins drop to 0, so it scrolls instead of clipping the left edge.
          canvas.className = "mx-auto block shrink-0 rounded-[3px] bg-white shadow-[0_18px_50px_-24px_rgba(0,0,0,0.9)]";
          await page.render({ canvas, viewport }).promise;
          canvases.push(canvas);
        }
      } finally {
        await task.destroy();
      }
      if (cancelled) return;
      const cssWidth = Math.round(width * (liveZoom?.current ?? zoom));
      for (const canvas of canvases) {
        canvas.style.width = `${cssWidth}px`;
        canvas.style.height = `${Math.round(cssWidth * Number(canvas.dataset.aspect))}px`;
      }
      el.replaceChildren(...canvases);
    })().catch(() => {
      // The previous pages stay on screen if a re-render fails.
    });

    return () => {
      cancelled = true;
    };
  }, [pdf, width, zoom, liveZoom]);

  return <div ref={container} role="img" aria-label={label} className="flex w-full flex-col gap-4" />;
}

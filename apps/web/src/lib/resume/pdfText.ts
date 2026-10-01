"use client";

type PdfJs = typeof import("pdfjs-dist");

let pdfjsPromise: Promise<PdfJs> | null = null;

// Loaded on demand: pdf.js touches browser-only globals at import time, so it must never be
// evaluated during server rendering.
export function loadPdfJs(): Promise<PdfJs> {
  pdfjsPromise ??= import("pdfjs-dist").then((pdfjs) => {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
    return pdfjs;
  });
  return pdfjsPromise;
}

interface PositionedItem {
  str: string;
  x: number;
  y: number;
  width: number;
  hasEOL: boolean;
}

// pdf.js hands back text runs in content-stream order; rebuild lines from their positions and only
// insert a space where there is a visible gap, so words split across runs don't gain stray spaces.
export async function extractPdfText(data: Uint8Array): Promise<string> {
  const pdfjs = await loadPdfJs();
  // getDocument detaches the buffer it is given, so it gets a copy.
  const task = pdfjs.getDocument({ data: data.slice() });
  const doc = await task.promise;
  const lines: string[] = [];

  try {
    for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) {
      const page = await doc.getPage(pageNumber);
      const content = await page.getTextContent();
      let line = "";
      let last: PositionedItem | null = null;

      for (const raw of content.items) {
        if (!("str" in raw)) continue;
        const item: PositionedItem = {
          str: raw.str,
          x: raw.transform[4] as number,
          y: raw.transform[5] as number,
          width: raw.width,
          hasEOL: raw.hasEOL,
        };

        if (last && Math.abs(item.y - last.y) > 2) {
          lines.push(line);
          line = "";
        } else if (last && line && item.x - (last.x + last.width) > 1 && !line.endsWith(" ") && !item.str.startsWith(" ")) {
          line += " ";
        }
        line += item.str;
        last = item;

        if (item.hasEOL) {
          lines.push(line);
          line = "";
          last = null;
        }
      }
      if (line) lines.push(line);
    }
  } finally {
    await task.destroy();
  }

  return lines
    .map((l) => l.trim())
    .filter(Boolean)
    .join("\n");
}

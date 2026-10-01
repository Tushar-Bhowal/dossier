"use client";

import type { RenderData } from "@dossier/core/resume";

// A4 in twips, with the same margins as the PDF template (1.7cm × 1.5cm).
const PAGE = { width: 11906, height: 16838 };
const MARGIN = { left: 964, right: 964, top: 850, bottom: 850 };
const RIGHT_TAB = PAGE.width - MARGIN.left - MARGIN.right;

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const binary = atob(dataUrl.slice(dataUrl.indexOf(",") + 1));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// Calibri in Word, Carlito in the PDF — the two share metrics, so both files lay out the same.
export async function buildResumeDocx(data: RenderData): Promise<Blob> {
  const { AlignmentType, BorderStyle, Document, ImageRun, Packer, Paragraph, TabStopType, TextRun } = await import("docx");

  const children: InstanceType<typeof Paragraph>[] = [];
  const { contact } = data;

  if (data.photo) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [
          new ImageRun({
            type: "jpg",
            data: dataUrlToBytes(data.photo.dataUrl),
            transformation: { width: 94, height: 117 },
          }),
        ],
      }),
    );
  }

  children.push(new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: contact.name, bold: true, size: 40 })] }));

  const contactParts = [contact.email, contact.phone, contact.location, ...contact.links.map((l) => l.url)].filter(
    (p): p is string => Boolean(p),
  );
  if (contactParts.length) {
    children.push(
      new Paragraph({
        spacing: { after: 120 },
        children: [new TextRun({ text: contactParts.join("   |   "), size: 19, color: "464646" })],
      }),
    );
  }

  for (const section of data.sections) {
    children.push(
      new Paragraph({
        spacing: { before: 200, after: 80 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "8C8C8C", space: 2 } },
        children: [new TextRun({ text: section.title.toUpperCase(), bold: true, size: 22 })],
      }),
    );

    if (section.text) children.push(new Paragraph({ spacing: { after: 80 }, children: [new TextRun(section.text)] }));
    if (section.list) children.push(new Paragraph({ spacing: { after: 80 }, children: [new TextRun(section.list.join(", "))] }));

    for (const item of section.items ?? []) {
      children.push(
        new Paragraph({
          spacing: { before: 80, after: 40 },
          tabStops: [{ type: TabStopType.RIGHT, position: RIGHT_TAB }],
          children: [
            new TextRun({ text: item.title, bold: true }),
            ...(item.org ? [new TextRun(`, ${item.org}`)] : []),
            ...(item.place ? [new TextRun({ text: `, ${item.place}`, color: "464646" })] : []),
            ...(item.dates ? [new TextRun({ text: `\t${item.dates}`, color: "464646" })] : []),
          ],
        }),
      );
      for (const bullet of item.bullets) {
        children.push(new Paragraph({ bullet: { level: 0 }, spacing: { after: 30 }, children: [new TextRun(bullet)] }));
      }
    }
  }

  const doc = new Document({
    creator: contact.name,
    title: `${contact.name} — Resume`,
    styles: { default: { document: { run: { font: "Calibri", size: 21 } } } },
    sections: [{ properties: { page: { size: PAGE, margin: MARGIN } }, children }],
  });

  return Packer.toBlob(doc);
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function resumeFileName(name: string, ext: "pdf" | "docx"): string {
  const base = name.trim().replace(/[^\p{L}\p{N}]+/gu, "_").replace(/^_+|_+$/g, "") || "Resume";
  return `${base}_Resume.${ext}`;
}

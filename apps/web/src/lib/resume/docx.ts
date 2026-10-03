"use client";

import type { RenderData } from "@dossier/core/resume";

// A4 in twips. Margins and gaps follow the resume's layout; Word can't measure ahead, so there is no
// fit-to-one-page here — text stays at its normal size.
const PAGE = { width: 11906, height: 16838 };
const TWIPS_PER_MM = 1440 / 25.4;
const DENSITY = { auto: 1, compact: 0.8, balanced: 1, spacious: 1.3 } as const;

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const binary = atob(dataUrl.slice(dataUrl.indexOf(",") + 1));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

const LINK_COLOUR = "1A4FA3";
const MUTED = "464646";

// Calibri in Word, Carlito in the PDF — the two share metrics, so both files lay out the same.
export async function buildResumeDocx(data: RenderData): Promise<Blob> {
  const {
    AlignmentType,
    BorderStyle,
    Document,
    ExternalHyperlink,
    Header,
    ImageRun,
    Packer,
    PageNumber,
    Paragraph,
    Table,
    TableCell,
    TableRow,
    TabStopType,
    TextRun,
    VerticalAlign,
    WidthType,
  } = await import("docx");

  type Run = InstanceType<typeof TextRun> | InstanceType<typeof ExternalHyperlink>;
  const children: (InstanceType<typeof Paragraph> | InstanceType<typeof Table>)[] = [];
  const { contact, layout } = data;
  const margin = {
    top: Math.round(layout.margins.top * TWIPS_PER_MM),
    bottom: Math.round(layout.margins.bottom * TWIPS_PER_MM),
    left: Math.round(layout.margins.left * TWIPS_PER_MM),
    right: Math.round(layout.margins.right * TWIPS_PER_MM),
  };
  const rightTab = PAGE.width - margin.left - margin.right;
  const k = DENSITY[layout.spacing];
  const gap = (twips: number) => Math.round(twips * k);

  const linkRun = (text: string, href: string, size?: number) =>
    new ExternalHyperlink({ link: href, children: [new TextRun({ text, color: LINK_COLOUR, ...(size ? { size } : {}) })] });
  const joined = (runs: Run[], size?: number): Run[] =>
    runs.flatMap((r, i) => (i ? [new TextRun({ text: "   |   ", color: MUTED, ...(size ? { size } : {}) }), r] : [r]));

  const header = [new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: contact.name, bold: true, size: 40 })] })];
  if (data.contactLine.length) {
    const runs = data.contactLine.map((p) =>
      p.href ? linkRun(p.text, p.href, 19) : new TextRun({ text: p.text, size: 19, color: MUTED }),
    );
    header.push(new Paragraph({ spacing: { after: 120 }, children: joined(runs, 19) }));
  }

  if (data.photo) {
    // Photo column: 2.4 cm plus a 14 pt gutter, matching the PDF.
    const photoCol = Math.round(24 * TWIPS_PER_MM) + 280;
    const none = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
    const noBorders = { top: none, bottom: none, left: none, right: none, insideHorizontal: none, insideVertical: none };
    children.push(
      new Table({
        width: { size: rightTab, type: WidthType.DXA },
        columnWidths: [rightTab - photoCol, photoCol],
        borders: noBorders,
        rows: [
          new TableRow({
            children: [
              new TableCell({
                width: { size: rightTab - photoCol, type: WidthType.DXA },
                verticalAlign: VerticalAlign.TOP,
                margins: { top: 0, bottom: 0, left: 0, right: 0 },
                children: header,
              }),
              new TableCell({
                width: { size: photoCol, type: WidthType.DXA },
                verticalAlign: VerticalAlign.TOP,
                margins: { top: 0, bottom: 0, left: 0, right: 0 },
                children: [
                  new Paragraph({
                    alignment: AlignmentType.RIGHT,
                    children: [
                      new ImageRun({
                        type: "jpg",
                        data: dataUrlToBytes(data.photo.dataUrl),
                        transformation: { width: 91, height: 117 },
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    );
  } else {
    children.push(...header);
  }

  for (const section of data.sections) {
    children.push(
      new Paragraph({
        spacing: { before: Math.round(200 * k * layout.sectionGap) + section.spaceBefore * 20, after: gap(80) },
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "8C8C8C", space: 2 } },
        children: [new TextRun({ text: section.title.toUpperCase(), bold: true, size: 22 })],
      }),
    );

    if (section.text) children.push(new Paragraph({ spacing: { after: gap(80) }, children: [new TextRun(section.text)] }));
    if (section.groups) {
      for (const g of section.groups) {
        children.push(
          new Paragraph({
            spacing: { after: gap(40) },
            children: [new TextRun({ text: `${g.title}: `, bold: true }), new TextRun(g.items.join(", "))],
          }),
        );
      }
    } else if (section.list) {
      children.push(new Paragraph({ spacing: { after: gap(80) }, children: [new TextRun(section.list.join(", "))] }));
    }
    for (const pair of section.pairs ?? []) {
      children.push(
        new Paragraph({
          spacing: { after: gap(30) },
          children: [new TextRun({ text: `${pair.label}: `, bold: true }), new TextRun(pair.value)],
        }),
      );
    }
    if (section.signature) {
      children.push(
        new Paragraph({
          spacing: { before: gap(200) },
          tabStops: [{ type: TabStopType.RIGHT, position: rightTab }],
          children: [
            new TextRun({ text: section.signature.place ? `Place: ${section.signature.place}` : "", color: MUTED }),
            new TextRun({ text: `\t(${section.signature.name})`, bold: true }),
          ],
        }),
      );
    }

    for (const item of section.items ?? []) {
      children.push(
        new Paragraph({
          spacing: { before: gap(80), after: gap(40) },
          tabStops: [{ type: TabStopType.RIGHT, position: rightTab }],
          children: [
            new TextRun({ text: item.title, bold: true }),
            ...(item.org ? [new TextRun(`, ${item.org}`)] : []),
            ...(item.place ? [new TextRun({ text: `, ${item.place}`, color: MUTED })] : []),
            ...(item.dates ? [new TextRun({ text: `\t${item.dates}`, color: MUTED })] : []),
          ],
        }),
      );
      const details: Run[] = [
        ...(item.grade ? [new TextRun({ text: `Grade: ${item.grade}`, color: MUTED })] : []),
        ...(item.credentialId ? [new TextRun({ text: `ID: ${item.credentialId}`, color: MUTED })] : []),
        ...(item.link ? [linkRun(item.link.text, item.link.href)] : []),
      ];
      if (details.length) children.push(new Paragraph({ spacing: { after: gap(40) }, children: joined(details) }));
      for (const bullet of item.bullets) {
        children.push(new Paragraph({ bullet: { level: 0 }, spacing: { after: gap(30) }, children: [new TextRun(bullet)] }));
      }
    }
  }

  // Page 1 has no header; from page 2 on, the name and page number, like the PDF.
  const runningHeader = new Header({
    children: [
      new Paragraph({
        tabStops: [{ type: TabStopType.RIGHT, position: rightTab }],
        children: [
          new TextRun({ text: contact.name, size: 17, color: MUTED }),
          new TextRun({ children: ["\tPage ", PageNumber.CURRENT], size: 17, color: MUTED }),
        ],
      }),
    ],
  });

  const doc = new Document({
    creator: contact.name,
    title: `${contact.name} — Resume`,
    styles: { default: { document: { run: { font: "Calibri", size: 21 } } } },
    sections: [
      {
        properties: { page: { size: PAGE, margin }, titlePage: true },
        headers: { default: runningHeader, first: new Header({ children: [] }) },
        children,
      },
    ],
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

export function resumeFileName(name: string, ext: "pdf" | "docx" | "md"): string {
  const base = name.trim().replace(/[^\p{L}\p{N}]+/gu, "_").replace(/^_+|_+$/g, "") || "Resume";
  return `${base}_Resume.${ext}`;
}

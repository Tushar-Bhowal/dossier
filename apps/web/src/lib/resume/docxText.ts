"use client";

const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

// A paragraph inside a text box sits inside an outer paragraph; each run belongs only to its nearest one.
function ownerParagraph(node: Node): Node | null {
  let current = node.parentNode;
  while (current && !(current instanceof Element && current.namespaceURI === W && current.localName === "p")) {
    current = current.parentNode;
  }
  return current;
}

function paragraphsOf(xml: string): string[] {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  const lines: string[] = [];
  for (const p of Array.from(doc.getElementsByTagNameNS(W, "p"))) {
    let line = "";
    const walker = doc.createTreeWalker(p, NodeFilter.SHOW_ELEMENT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const el = node as Element;
      if (el.namespaceURI !== W || ownerParagraph(el) !== p) continue;
      if (el.localName === "t") line += el.textContent ?? "";
      else if (el.localName === "tab") line += "\t";
      else if (el.localName === "br") line += "\n";
    }
    if (line.trim()) lines.push(line.trim());
  }
  return lines;
}

// Read in the browser like PDFs: nothing is uploaded. Headers come first because many resumes keep
// the name, phone and email there.
export async function extractDocxText(data: ArrayBuffer): Promise<string> {
  const { default: JSZip } = await import("jszip");
  const zip = await JSZip.loadAsync(data);
  const body = zip.file("word/document.xml");
  if (!body) throw new Error("not a Word document");
  const headers = zip.file(/^word\/header\d*\.xml$/).sort((a, b) => a.name.localeCompare(b.name));
  // A document can carry the same header three times (first page, odd, even pages).
  const headerLines = [...new Set((await Promise.all(headers.map((f) => f.async("string")))).flatMap(paragraphsOf))];
  return [...headerLines, ...paragraphsOf(await body.async("string"))].join("\n");
}

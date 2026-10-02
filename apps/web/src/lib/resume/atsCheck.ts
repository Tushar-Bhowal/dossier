import { SECTION_TITLES, type RenderData } from "@dossier/core/resume";

export type CheckStatus = "pass" | "warn" | "fail";

export interface AtsCheckItem {
  id: string;
  label: string;
  status: CheckStatus;
  detail: string;
}

export interface AtsCheckResult {
  checks: AtsCheckItem[];
  bulletsFound: number;
  bulletsTotal: number;
  missingBullets: string[];
}

// Typst turns straight quotes into curly ones and ligatures can come back as single glyphs, so both
// sides are normalised the same way before comparing.
export function normaliseForMatch(text: string): string {
  return text
    .normalize("NFKC")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

const STANDARD_TITLES = new Set(
  [
    ...Object.values(SECTION_TITLES),
    "Awards",
    "Publications",
    "Extracurricular Activities",
    "Hobbies",
    "Interests",
    "Training",
    "Internships",
  ].map((t) => t.toLowerCase()),
);

export function checkAtsText(data: RenderData, extracted: string): AtsCheckResult {
  // Page 2 onwards carries a running "Name … Page N" line; drop it so a line split across a page
  // break still reads as one.
  const running = new RegExp(`^\\s*${data.contact.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*Page \\d+\\s*$`, "i");
  const text = normaliseForMatch(
    extracted
      .split("\n")
      .filter((l) => !running.test(l))
      .join("\n"),
  );
  const firstLine = normaliseForMatch(extracted.split("\n").find((l) => l.trim()) ?? "");
  const checks: AtsCheckItem[] = [];

  const name = normaliseForMatch(data.contact.name);
  checks.push(
    firstLine.includes(name)
      ? { id: "name", label: "Your name comes first", status: "pass", detail: "The first line an ATS reads is your name." }
      : { id: "name", label: "Your name comes first", status: "fail", detail: "Your name isn't the first thing read from the PDF." },
  );

  const { email, phone } = data.contact;
  if (!email && !phone) {
    checks.push({
      id: "contact",
      label: "Contact details",
      status: "warn",
      detail: "Add an email or phone number so recruiters can reach you.",
    });
  } else {
    const missing = [
      email && !text.includes(normaliseForMatch(email)) ? "email" : null,
      phone && !text.includes(normaliseForMatch(phone)) ? "phone" : null,
    ].filter(Boolean);
    checks.push(
      missing.length === 0
        ? { id: "contact", label: "Contact details", status: "pass", detail: "Email and phone come out as plain text." }
        : { id: "contact", label: "Contact details", status: "fail", detail: `Couldn't read your ${missing.join(" and ")}.` },
    );
  }

  const nonStandard = data.sections.filter((s) => !STANDARD_TITLES.has(s.title.toLowerCase())).map((s) => s.title);
  const unreadable = data.sections.filter((s) => !text.includes(normaliseForMatch(s.title))).map((s) => s.title);
  checks.push(
    unreadable.length
      ? { id: "headings", label: "Section headings", status: "fail", detail: `Couldn't read: ${unreadable.join(", ")}.` }
      : nonStandard.length
        ? {
            id: "headings",
            label: "Section headings",
            status: "warn",
            detail: `ATS systems look for standard names. Consider renaming: ${nonStandard.join(", ")}.`,
          }
        : { id: "headings", label: "Section headings", status: "pass", detail: "All headings use the standard names ATS systems look for." },
  );

  const bullets = data.sections.flatMap((s) => s.items?.flatMap((i) => i.bullets) ?? []);
  const missingBullets: string[] = [];
  let cursor = 0;
  for (const bullet of bullets) {
    const at = text.indexOf(normaliseForMatch(bullet), cursor);
    if (at === -1) missingBullets.push(bullet);
    else cursor = at;
  }
  const found = bullets.length - missingBullets.length;
  checks.push(
    missingBullets.length === 0
      ? {
          id: "order",
          label: "Every line, in order",
          status: "pass",
          detail: `All ${bullets.length} lines come out complete and in the order you wrote them.`,
        }
      : {
          id: "order",
          label: "Every line, in order",
          status: "fail",
          detail: `${found} of ${bullets.length} lines read back correctly.`,
        },
  );

  checks.push({
    id: "layout",
    label: "Single column, no tables or graphics",
    status: "pass",
    detail: "The layout ATS systems read most reliably.",
  });

  return { checks, bulletsFound: found, bulletsTotal: bullets.length, missingBullets };
}

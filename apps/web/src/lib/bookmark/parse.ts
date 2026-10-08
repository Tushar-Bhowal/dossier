export interface PageInfo {
  url: string;
  title: string;
  text: string;
}

export type FieldSource = "found" | "guessed" | "missing";

export interface ParsedJob {
  company: string;
  role: string;
  location: string;
  jobUrl: string;
  jdText: string;
  sources: { company: FieldSource; role: FieldSource; location: FieldSource };
}

const BOARD_SUFFIX = /\s*[|·–-]\s*(LinkedIn|Indeed(\.com)?|Naukri(\.com)?|Glassdoor|Wellfound|Instahyre|Foundit|Greenhouse|Lever|Workday)\s*$/i;

function titleCase(word: string): string {
  return word ? word.charAt(0).toUpperCase() + word.slice(1) : word;
}

// careers.razorpay.com → Razorpay; jobs.lever.co/razorpay/... → Razorpay
function companyFromUrl(url: URL): string {
  const host = url.hostname.replace(/^www\./, "");
  if (/(lever\.co|greenhouse\.io|ashbyhq\.com|workable\.com)$/.test(host)) {
    const slug = url.pathname.split("/").filter(Boolean)[0] ?? "";
    return titleCase(slug.replace(/[-_]+/g, " "));
  }
  if (/(linkedin|indeed|naukri|glassdoor|foundit|instahyre|wellfound)\./.test(host)) return "";
  const parts = host.split(".");
  const name = parts.length > 2 ? parts[parts.length - 2] : parts[0];
  return titleCase(name ?? "");
}

// Reads the page title the way the big job boards write it; anything else falls back to the address.
export function parseJobPage(page: PageInfo): ParsedJob {
  let url: URL | null = null;
  try {
    url = new URL(page.url);
  } catch {
    url = null;
  }
  const title = page.title.replace(BOARD_SUFFIX, "").trim();
  let company = "";
  let role = "";
  let location = "";

  const linkedin = title.match(/^(.+?) hiring (.+?)(?: in (.+?))?$/i);
  const greenhouse = title.match(/^Job Application for (.+?) at (.+)$/i);
  const naukri = title.match(/^(.+?) Job in (.+?)(?: at (.+?))?$/i);
  const indeed = title.match(/^(.+?) - (.+?) - (.+)$/);
  const at = title.match(/^(.+?) at (.+)$/i);
  const dash = title.match(/^(.+?) [-|–] (.+)$/);

  if (linkedin) [, company, role, location] = linkedin.map((x) => x ?? "");
  else if (greenhouse) [, role, company] = greenhouse;
  else if (naukri) [, role, company, location] = naukri.map((x) => x ?? "");
  else if (indeed) [, role, company, location] = indeed;
  else if (at) [, role, company] = at;
  else if (dash) {
    const fromUrl = url ? companyFromUrl(url) : "";
    // "Razorpay - Frontend Engineer" (Lever) or "Frontend Engineer - Razorpay"
    if (fromUrl && dash[1].toLowerCase().includes(fromUrl.toLowerCase())) [, company, role] = dash;
    else [, role, company] = dash;
  } else role = title;

  const urlCompany = url ? companyFromUrl(url) : "";
  const companySource: FieldSource = company ? "found" : urlCompany ? "guessed" : "missing";
  const text = page.text.trim();

  return {
    company: (company || urlCompany).trim(),
    role: role.trim(),
    location: location.trim(),
    jobUrl: url && /^https?:$/.test(url.protocol) ? url.toString() : "",
    jdText: text.length >= 200 ? text.slice(0, 20_000) : "",
    sources: {
      company: companySource,
      role: role ? "found" : "missing",
      location: location ? "found" : "missing",
    },
  };
}

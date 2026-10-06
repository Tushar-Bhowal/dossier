import type { ApplicationPreview } from '../contracts/application.js';
import { htmlToText } from '../adapters/fetch/htmlToText.js';

// Job boards that put the company in the URL path or subdomain.
const BOARD_HOSTS: { host: RegExp; companyFrom: 'path' | 'subdomain' }[] = [
  { host: /^(boards|job-boards)(\.eu)?\.greenhouse\.io$/, companyFrom: 'path' },
  { host: /^jobs\.(eu\.)?lever\.co$/, companyFrom: 'path' },
  { host: /^jobs\.ashbyhq\.com$/, companyFrom: 'path' },
  { host: /\.myworkdayjobs\.com$/, companyFrom: 'subdomain' },
];

function titleCase(slug: string): string {
  return slug
    .replace(/[-_]+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function metaContent(html: string, property: string): string | undefined {
  const tag = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${property}["'][^>]*>`, 'i'))?.[0];
  const content = tag?.match(/content=["']([^"']*)["']/i)?.[1];
  return content ? htmlToText(content, 300) || undefined : undefined;
}

function pageTitle(html: string): string | undefined {
  const raw = metaContent(html, 'og:title') ?? html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  return raw ? htmlToText(raw, 300) || undefined : undefined;
}

// "Job Application for Senior Engineer at Stripe", "Senior Engineer at Stripe", "Stripe - Senior
// Engineer", "Senior Engineer | Careers". When the company is already known, the other part is the role.
function splitTitle(title: string, company?: string): { role?: string; company?: string } {
  const at = title.match(/^(?:job application for\s+)?(.+?)\s+(?:at|@)\s+(.+?)(?:\s+[|–—-]\s+.*)?$/i);
  if (at) return { role: at[1]!.trim(), company: at[2]!.trim() };

  const parts = title.split(/\s+[|–—-]\s+/).map((p) => p.trim()).filter(Boolean);
  if (company) {
    const name = company.toLowerCase();
    const other = parts.find((p) => !p.toLowerCase().includes(name) && !/careers|jobs/i.test(p));
    return { role: other };
  }
  return { role: parts[0] };
}

export function previewFromJobPage(url: string, html: string): ApplicationPreview {
  const { hostname, pathname, origin } = new URL(url);
  const board = BOARD_HOSTS.find((b) => b.host.test(hostname));

  let company: string | undefined;
  if (board?.companyFrom === 'path') {
    const slug = pathname.split('/').filter(Boolean)[0];
    company = slug ? titleCase(slug) : undefined;
  } else if (board?.companyFrom === 'subdomain') {
    company = titleCase(hostname.split('.')[0]!);
  }
  company ??= metaContent(html, 'og:site_name');

  const title = pageTitle(html);
  const fromTitle = title ? splitTitle(title, company) : {};
  // A company's own careers site: its main site is the same domain without the careers/jobs prefix.
  const companyUrl = board ? undefined : origin.replace(/:\/\/(careers|jobs)\./, '://');
  const jdText = htmlToText(html, 20_000);

  return {
    company: company ?? fromTitle.company,
    role: fromTitle.role,
    companyUrl,
    jdText: jdText.length >= 200 ? jdText : undefined,
  };
}

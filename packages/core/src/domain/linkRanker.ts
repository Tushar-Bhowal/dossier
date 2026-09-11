export interface CrawlLink {
  url: string;
  anchorText: string;
  depth: number;
}

export interface RankedLink extends CrawlLink {
  score: number;
}

const HIRING_SIGNALS = [
  'careers',
  'career',
  'jobs',
  'join',
  'hiring',
  'interview',
  'process',
  'handbook',
  'life-at',
  'working-at',
  'culture',
];
const ABOUT_SIGNALS = ['about', 'company', 'mission', 'what-we-do'];
const NEGATIVE_SIGNALS = ['login', 'signin', 'sign-in', 'privacy', 'terms', 'cookie'];

// e.g. /blog/2024/01/we-raised-a-round — a dated post path, not a durable hiring/about page.
const DATED_BLOG_PATH = /\/\d{4}\/\d{1,2}\//;
const BINARY_EXTENSION = /\.(pdf|zip|jpe?g|png|svg|gif|docx?)$/i;

export function scoreLink(link: CrawlLink): number {
  const haystack = `${link.url} ${link.anchorText}`.toLowerCase();
  let score = 0;

  for (const signal of HIRING_SIGNALS) if (haystack.includes(signal)) score += 10;
  for (const signal of ABOUT_SIGNALS) if (haystack.includes(signal)) score += 6;
  for (const signal of NEGATIVE_SIGNALS) if (haystack.includes(signal)) score -= 10;

  if (DATED_BLOG_PATH.test(link.url)) score -= 8;
  if (BINARY_EXTENSION.test(link.url)) score -= 10;

  // A mild shallow-page preference — a tiebreaker, not a dominant factor, so a deep page with
  // strong hiring signal (a handbook interview-process page a level below /careers) still wins
  // over a shallow page with no signal at all.
  score -= link.depth * 0.5;

  return score;
}

export function rankLinks(links: CrawlLink[]): RankedLink[] {
  return links
    .map((link) => ({ ...link, score: scoreLink(link) }))
    .sort((a, b) => b.score - a.score || a.url.localeCompare(b.url));
}

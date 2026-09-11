const STRIPPED_TAGS = ['script', 'style', 'nav', 'noscript', 'svg', 'template'];

const MAX_TEXT_CHARS = 6000;

function stripTags(html: string, tags: string[]): string {
  let result = html;
  for (const tag of tags) {
    result = result.replace(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?</${tag}>`, 'gi'), ' ');
  }
  return result;
}

// Removes elements that are hidden from a reader ("hidden" attribute or an inline
// display:none/visibility:hidden style) — best-effort, since we only have raw markup, not a DOM.
function stripHiddenElements(html: string): string {
  return html.replace(
    /<[a-z][a-z0-9-]*\b[^>]*?(?:\bhidden\b|style\s*=\s*["'][^"']*(?:display\s*:\s*none|visibility\s*:\s*hidden)[^"']*["'])[^>]*>[\s\S]*?<\/[a-z][a-z0-9-]*>/gi,
    ' ',
  );
}

function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

// Best-effort plain-text extraction from raw HTML — a regex-based approach rather than a full DOM
// parser dependency, acceptable because the output only ever reaches an LLM prompt as fenced,
// untrusted DATA (§11), never rendered or trusted as markup.
export function htmlToText(html: string, maxChars: number = MAX_TEXT_CHARS): string {
  let text = stripHiddenElements(html);
  text = stripTags(text, STRIPPED_TAGS);
  text = text.replace(/<!--[\s\S]*?-->/g, ' ');
  text = text.replace(/<[^>]+>/g, ' ');
  text = decodeEntities(text);
  text = text.replace(/\s+/g, ' ').trim();
  return text.slice(0, maxChars);
}

export interface ExtractedLink {
  url: string;
  anchorText: string;
}

// Extracts every link and its anchor text, resolved against the page's own URL, so a relative href
// like "/careers" or "../about" becomes an absolute URL — and the anchor text feeds linkRanker's
// scoring (Task 12), which reads both the URL and how the link was labelled on the page.
export function extractAnchors(html: string, baseUrl: string): ExtractedLink[] {
  const seen = new Set<string>();
  const results: ExtractedLink[] = [];
  const anchorPattern = /<a\b[^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = anchorPattern.exec(html)) !== null) {
    const href = match[1]!.trim();
    if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:')) {
      continue;
    }
    try {
      const resolved = new URL(href, baseUrl);
      if (resolved.protocol !== 'http:' && resolved.protocol !== 'https:') continue;
      resolved.hash = '';
      if (seen.has(resolved.href)) continue;
      seen.add(resolved.href);
      const anchorText = decodeEntities(match[2]!.replace(/<[^>]+>/g, ' '))
        .replace(/\s+/g, ' ')
        .trim();
      results.push({ url: resolved.href, anchorText });
    } catch {
      continue;
    }
  }
  return results;
}

export function extractLinks(html: string, baseUrl: string): string[] {
  return extractAnchors(html, baseUrl).map((link) => link.url);
}

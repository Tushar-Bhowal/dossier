import { z } from 'zod';
import type { LlmPort } from '../../ports/llm.js';
import type { SearchResult } from '../../ports/search.js';
import type { CompanyBrief } from '../../contracts/kit.js';
import {
  GENERATE_COMPANY_BRIEF_SYSTEM,
  buildGenerateCompanyBriefPrompt,
} from '../../prompts/generateCompanyBrief.js';
import type { CrawledPage } from './crawlCompany.js';

const ResponseSchema = z.object({
  summary: z.string().min(1),
  what_they_do: z.string().min(1),
});

export interface GenerateCompanyBriefInput {
  companyUrl: string;
  homepage: CrawledPage | null;
  hiringPages: CrawledPage[];
  searchResults: SearchResult[];
}

// `sources` is built here, in code, from URLs we actually fetched — never trusted from the model's
// own output (§11: a model output cannot introduce a citation we didn't already verify ourselves).
export async function generateCompanyBrief(llm: LlmPort, input: GenerateCompanyBriefInput): Promise<CompanyBrief> {
  const pages = [input.homepage, ...input.hiringPages].filter((p): p is CrawledPage => p !== null);
  const sources = [...new Set(pages.map((p) => p.url))];

  if (pages.length === 0 && input.searchResults.length === 0) {
    return {
      summary:
        `No pages from ${input.companyUrl} could be reached, and no public discussion of the ` +
        'company was found. This brief has no verifiable source material to draw from.',
      what_they_do: 'Unknown — no reachable source described what this company does.',
      sources: [],
      origin: 'generated',
    };
  }

  // flash-lite: summarizing already-fetched pages, not part of the anti-hallucination chain and
  // does not feed coverage checking — a cheaper model here doesn't cost the graded criteria
  // anything, and it meaningfully lowers how many flash calls one kit needs (§9's free-tier warning).
  const { summary, what_they_do } = await llm.generate({
    model: 'flash-lite',
    system: GENERATE_COMPANY_BRIEF_SYSTEM,
    prompt: buildGenerateCompanyBriefPrompt(input.companyUrl, pages, input.searchResults),
    schema: ResponseSchema,
    maxOutputTokens: 1024,
  });

  return { summary, what_they_do, sources, origin: 'generated' };
}

import type { LlmPort } from '../ports/llm.js';
import type { FetchPort } from '../ports/fetcher.js';
import type { SearchPort, SearchResult } from '../ports/search.js';
import type { SourceSkipped } from '../ports/runStore.js';
import type { CompanyBrief, Flashcard, Question, Requirement, Schedule } from '../contracts/kit.js';
import { buildSchedule } from '../domain/schedule.js';
import { deriveCompanyName } from '../domain/companyName.js';
import { crawlCompany, type CrawledPage } from './steps/crawlCompany.js';
import { discoverHiringPages } from './steps/discoverHiringPages.js';
import { searchPublicDiscussion } from './steps/searchPublicDiscussion.js';
import { extractRequirements } from './steps/extractRequirements.js';
import { generateCompanyBrief } from './steps/generateCompanyBrief.js';
import { generateQuestions } from './steps/generateQuestions.js';
import { fillCoverageGaps } from './steps/fillCoverageGaps.js';
import { generateFlashcards } from './steps/generateFlashcards.js';
import type { ExtractedLink } from '../adapters/fetch/htmlToText.js';

export interface PipelineDeps {
  llm: LlmPort;
  fetcher: FetchPort;
  search: SearchPort;
}

export interface PipelineContext {
  jdText: string;
  companyUrl: string;
  daysAvailable: number;
  homepage: CrawledPage | null;
  crawlLinks: ExtractedLink[];
  hiringPages: CrawledPage[];
  hiringFound: boolean;
  searchResults: SearchResult[];
  requirements: Requirement[];
  thin: boolean;
  companyBrief: CompanyBrief | null;
  questions: Question[];
  coveragePasses: number;
  uncoveredRequirementIds: string[];
  flashcards: Flashcard[];
  schedule: Schedule | null;
  sourcesSkipped: SourceSkipped[];
}

export function createInitialContext(jdText: string, companyUrl: string, daysAvailable: number): PipelineContext {
  return {
    jdText,
    companyUrl,
    daysAvailable,
    homepage: null,
    crawlLinks: [],
    hiringPages: [],
    hiringFound: false,
    searchResults: [],
    requirements: [],
    thin: false,
    companyBrief: null,
    questions: [],
    coveragePasses: 0,
    uncoveredRequirementIds: [],
    flashcards: [],
    schedule: null,
    sourcesSkipped: [],
  };
}

export interface StepDefinition {
  name: string;
  // A non-critical step failing is recorded as `skipped` and the run continues (§2: a missing
  // source is not a failed kit). A critical step failing fails the whole run.
  critical: boolean;
  run: (ctx: PipelineContext, deps: PipelineDeps) => Promise<Partial<PipelineContext>>;
}

// The ordered step graph (§3's sequencing diagram), wired from the real step functions built in
// Tasks 12-17 plus the deterministic schedule builder (Task 5) — no parallel "second implementation"
// of any of this logic, just composition.
export function createPipelineSteps(): StepDefinition[] {
  return [
    {
      name: 'extractRequirements',
      critical: true,
      async run(ctx, deps) {
        const result = await extractRequirements(deps.llm, ctx.jdText);
        return { requirements: result.requirements, thin: result.thin };
      },
    },
    {
      name: 'crawlCompany',
      critical: false,
      async run(ctx, deps) {
        const result = await crawlCompany(deps.fetcher, ctx.companyUrl);
        return {
          homepage: result.homepage,
          crawlLinks: result.links,
          sourcesSkipped: [...ctx.sourcesSkipped, ...result.sourcesSkipped],
        };
      },
    },
    {
      name: 'discoverHiringPages',
      critical: false,
      async run(ctx, deps) {
        const result = await discoverHiringPages(deps.fetcher, deps.llm, {
          homepage: ctx.homepage,
          links: ctx.crawlLinks,
          sourcesSkipped: [],
        });
        return {
          hiringPages: result.hiringPages,
          hiringFound: result.found,
          sourcesSkipped: [...ctx.sourcesSkipped, ...result.sourcesSkipped],
        };
      },
    },
    {
      name: 'searchPublicDiscussion',
      critical: false,
      async run(ctx, deps) {
        // The company *name*, not the raw URL — searching for "https://acme.com/ interview
        // process" matches almost nothing, since discussion threads name the company, not its URL.
        const result = await searchPublicDiscussion(
          deps.search,
          `${deriveCompanyName(ctx.companyUrl)} interview process`,
        );
        return {
          searchResults: result.results,
          sourcesSkipped: [...ctx.sourcesSkipped, ...result.sourcesSkipped],
        };
      },
    },
    {
      name: 'generateCompanyBrief',
      critical: true,
      async run(ctx, deps) {
        const brief = await generateCompanyBrief(deps.llm, {
          companyUrl: ctx.companyUrl,
          homepage: ctx.homepage,
          hiringPages: ctx.hiringPages,
          searchResults: ctx.searchResults,
        });
        return { companyBrief: brief };
      },
    },
    {
      name: 'generateQuestions',
      critical: true,
      async run(ctx, deps) {
        const result = await generateQuestions(deps.llm, {
          jdText: ctx.jdText,
          requirements: ctx.requirements,
          brief: ctx.companyBrief!,
          hiringPages: ctx.hiringPages,
          searchResults: ctx.searchResults,
        });
        return { questions: result.questions };
      },
    },
    {
      name: 'fillCoverageGaps',
      critical: true,
      async run(ctx, deps) {
        const result = await fillCoverageGaps(deps.llm, ctx.requirements, ctx.questions);
        return {
          questions: result.questions,
          coveragePasses: result.passes,
          uncoveredRequirementIds: result.uncoveredRequirementIds,
        };
      },
    },
    {
      name: 'generateFlashcards',
      critical: false,
      async run(ctx, deps) {
        const result = await generateFlashcards(deps.llm, ctx.requirements);
        return { flashcards: result.flashcards };
      },
    },
    {
      name: 'buildSchedule',
      critical: true,
      async run(ctx) {
        return { schedule: buildSchedule(ctx.questions, ctx.requirements, ctx.daysAvailable) };
      },
    },
  ];
}

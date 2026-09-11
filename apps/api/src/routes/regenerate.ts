import { Router } from 'express';
import {
  Kit,
  type Requirement,
  type Question,
  type Flashcard,
  mergeRegeneration,
  highestIdNumber,
  createIdMinter,
  extractRequirements,
  generateFlashcards,
  generateCompanyBrief,
  crawlCompany,
  discoverHiringPages,
  searchPublicDiscussion,
  generateCategory,
  TECHNICAL_QUESTIONS_SYSTEM,
  buildTechnicalQuestionsPrompt,
  BEHAVIOURAL_QUESTIONS_SYSTEM,
  buildBehaviouralQuestionsPrompt,
  SYSTEM_DESIGN_QUESTIONS_SYSTEM,
  buildSystemDesignQuestionsPrompt,
  COMPANY_FIT_QUESTIONS_SYSTEM,
  buildCompanyFitQuestionsPrompt,
} from '@dossier/core';
import { requireAuth } from '../middleware/auth.js';
import { AppError } from '../middleware/error.js';
import { getOwnedKit, replaceOwnedKit } from '../db/kits.js';
import { buildPipelineDeps } from '../pipelineDeps.js';

export const regenerateRouter = Router();

regenerateRouter.use(requireAuth);

const QUESTION_CATEGORIES = ['technical', 'behavioural', 'system-design', 'company-fit'] as const;
type QuestionCategory = (typeof QUESTION_CATEGORIES)[number];

type Section =
  | { kind: 'company_brief' }
  | { kind: 'requirements' }
  | { kind: 'flashcards' }
  | { kind: 'questions'; category: QuestionCategory };

function parseSection(raw: string): Section {
  if (raw === 'company_brief') return { kind: 'company_brief' };
  if (raw === 'requirements') return { kind: 'requirements' };
  if (raw === 'flashcards') return { kind: 'flashcards' };
  const match = /^questions:(.+)$/.exec(raw);
  const category = match?.[1];
  if (category && (QUESTION_CATEGORIES as readonly string[]).includes(category)) {
    return { kind: 'questions', category: category as QuestionCategory };
  }
  throw new AppError(
    400,
    'invalid_section',
    `unknown section "${raw}" — expected company_brief, requirements, flashcards, or questions:<category>`,
  );
}

async function regenerateQuestionsCategory(
  category: QuestionCategory,
  kit: Kit,
  jdText: string,
  companyUrl: string,
): Promise<Question[]> {
  const deps = buildPipelineDeps();
  const validRequirementIds = new Set(kit.role.requirements.map((r) => r.id));
  const mintId = createIdMinter('q', highestIdNumber(kit.questions.map((q) => q.id), 'q'));

  if (category === 'technical' || category === 'behavioural' || category === 'system-design') {
    const requirements = kit.role.requirements.filter((r) => r.kind === 'technical');
    const behavioural = kit.role.requirements.filter((r) => r.kind === 'behavioural');
    if (category === 'technical') {
      return generateCategory(deps.llm, 'technical', TECHNICAL_QUESTIONS_SYSTEM, buildTechnicalQuestionsPrompt(requirements), validRequirementIds, mintId, 0);
    }
    if (category === 'behavioural') {
      return generateCategory(deps.llm, 'behavioural', BEHAVIOURAL_QUESTIONS_SYSTEM, buildBehaviouralQuestionsPrompt(behavioural), validRequirementIds, mintId, 0);
    }
    return generateCategory(deps.llm, 'system-design', SYSTEM_DESIGN_QUESTIONS_SYSTEM, buildSystemDesignQuestionsPrompt(requirements), validRequirementIds, mintId, 0);
  }

  // company-fit needs the hiring-process findings, which the kit itself doesn't retain — re-crawl
  // the company site fresh rather than persist a second copy of Task 12's output.
  const crawl = await crawlCompany(deps.fetcher, companyUrl);
  const discovery = await discoverHiringPages(deps.fetcher, deps.llm, { homepage: crawl.homepage, links: crawl.links, sourcesSkipped: [] });
  const search = await searchPublicDiscussion(deps.search, `${companyUrl} interview process`);
  return generateCategory(
    deps.llm,
    'company-fit',
    COMPANY_FIT_QUESTIONS_SYSTEM,
    buildCompanyFitQuestionsPrompt(kit.company_brief, discovery.hiringPages, search.results),
    validRequirementIds,
    mintId,
    0,
  );
}

// Wires Task 6's `mergeRegeneration`: a hand-edited or pinned item survives, and the write is
// scoped to exactly this section's path in the document — every other section's array is passed
// through completely untouched, not merely re-derived to look the same.
regenerateRouter.post('/:id/sections/:section/regenerate', async (req, res, next) => {
  try {
    const doc = await getOwnedKit(req.params.id!, req.userId!);
    if (!doc) {
      next(new AppError(404, 'not_found', 'kit not found'));
      return;
    }
    const section = parseSection(req.params.section!);
    const { kit, input } = doc;
    let nextKit: Kit = kit;

    if (section.kind === 'company_brief') {
      const deps = buildPipelineDeps();
      const crawl = await crawlCompany(deps.fetcher, input.companyUrl);
      const discovery = await discoverHiringPages(deps.fetcher, deps.llm, { homepage: crawl.homepage, links: crawl.links, sourcesSkipped: [] });
      const search = await searchPublicDiscussion(deps.search, `${input.companyUrl} interview process`);
      const brief = await generateCompanyBrief(deps.llm, {
        companyUrl: input.companyUrl,
        homepage: crawl.homepage,
        hiringPages: discovery.hiringPages,
        searchResults: search.results,
      });
      nextKit = { ...kit, company_brief: brief };
    } else if (section.kind === 'requirements') {
      const deps = buildPipelineDeps();
      const fresh = await extractRequirements(deps.llm, input.jdText);
      const mintId = createIdMinter('r', highestIdNumber(kit.role.requirements.map((r) => r.id), 'r'));
      const reminted: Requirement[] = fresh.requirements.map((r) => ({ ...r, id: mintId() }));
      const merged = mergeRegeneration(kit.role.requirements, reminted);
      nextKit = { ...kit, role: { ...kit.role, requirements: merged } };
    } else if (section.kind === 'flashcards') {
      const deps = buildPipelineDeps();
      const fresh = await generateFlashcards(deps.llm, kit.role.requirements);
      const mintId = createIdMinter('f', highestIdNumber(kit.flashcards.map((f) => f.id), 'f'));
      const reminted: Flashcard[] = fresh.flashcards.map((f) => ({ ...f, id: mintId() }));
      const merged = mergeRegeneration(kit.flashcards, reminted);
      nextKit = { ...kit, flashcards: merged };
    } else {
      const freshQuestions = await regenerateQuestionsCategory(section.category, kit, input.jdText, input.companyUrl);
      const existingInCategory = kit.questions.filter((q) => q.category === section.category);
      const mergedCategory = mergeRegeneration(existingInCategory, freshQuestions);
      const otherCategories = kit.questions.filter((q) => q.category !== section.category);
      nextKit = { ...kit, questions: [...otherCategories, ...mergedCategory] };
    }

    const validated = Kit.safeParse(nextKit);
    if (!validated.success) {
      next(new AppError(500, 'invalid_kit', `regenerated kit failed validation: ${validated.error.message}`));
      return;
    }

    const updated = await replaceOwnedKit(req.params.id!, req.userId!, doc.version, validated.data);
    if (!updated) {
      next(new AppError(409, 'version_conflict', 'kit was modified concurrently; reload and retry'));
      return;
    }
    res.json({ id: updated._id, version: updated.version, kit: updated.kit, updatedAt: updated.updatedAt });
  } catch (err) {
    next(err);
  }
});

import { z } from 'zod';
import type { LlmPort } from '../../ports/llm.js';
import type { SearchResult } from '../../ports/search.js';
import type { CompanyBrief, Question, Requirement } from '../../contracts/kit.js';
import { createIdMinter } from '../../contracts/ids.js';
import { TECHNICAL_QUESTIONS_SYSTEM, buildTechnicalQuestionsPrompt } from '../../prompts/questions.technical.js';
import {
  BEHAVIOURAL_QUESTIONS_SYSTEM,
  buildBehaviouralQuestionsPrompt,
} from '../../prompts/questions.behavioural.js';
import {
  SYSTEM_DESIGN_QUESTIONS_SYSTEM,
  buildSystemDesignQuestionsPrompt,
} from '../../prompts/questions.systemDesign.js';
import {
  COMPANY_FIT_QUESTIONS_SYSTEM,
  buildCompanyFitQuestionsPrompt,
} from '../../prompts/questions.companyFit.js';
import type { CrawledPage } from './crawlCompany.js';

const QuestionCandidateSchema = z.object({
  prompt: z.string().min(1),
  answer_outline: z.string(),
  difficulty: z.int().min(1).max(3),
  requirement_ids: z.array(z.string()),
});
const ResponseSchema = z.object({ questions: z.array(QuestionCandidateSchema) });

// A senior-sounding title paired with enough technical requirements to actually design something
// around is what gates the system-design call — asking it for a two-line, junior JD wastes a call.
const SENIOR_PATTERN = /\b(senior|staff|principal|lead|architect)\b/i;
const TECHNICAL_DENSITY_THRESHOLD = 3;

async function generateCategory(
  llm: LlmPort,
  category: Question['category'],
  system: string,
  prompt: string,
  validRequirementIds: Set<string>,
  mintId: () => string,
  startOrder: number,
): Promise<Question[]> {
  const { questions } = await llm.generate({
    model: 'flash',
    system,
    prompt,
    schema: ResponseSchema,
    maxOutputTokens: 2048,
  });

  return questions.map((q, index) => ({
    id: mintId(),
    // Dropped, not trusted: a requirement id the model invented cannot survive into the kit.
    requirement_ids: q.requirement_ids.filter((id) => validRequirementIds.has(id)),
    category,
    prompt: q.prompt,
    answer_outline: q.answer_outline,
    difficulty: q.difficulty,
    origin: 'generated',
    pinned: false,
    order: startOrder + index,
  }));
}

export interface GenerateQuestionsInput {
  jdText: string;
  requirements: Requirement[];
  brief: CompanyBrief;
  hiringPages: CrawledPage[];
  searchResults: SearchResult[];
}

export interface GenerateQuestionsResult {
  questions: Question[];
}

// §3: one call PER CATEGORY with distinct instructions, not one call asking for everything — "5
// years of React" and "mentoring junior engineers" genuinely need different prompts.
export async function generateQuestions(llm: LlmPort, input: GenerateQuestionsInput): Promise<GenerateQuestionsResult> {
  const mintId = createIdMinter('q');
  const validRequirementIds = new Set(input.requirements.map((r) => r.id));
  const technicalRequirements = input.requirements.filter((r) => r.kind === 'technical');
  const behaviouralRequirements = input.requirements.filter((r) => r.kind === 'behavioural');

  const questions: Question[] = [];

  if (technicalRequirements.length > 0) {
    questions.push(
      ...(await generateCategory(
        llm,
        'technical',
        TECHNICAL_QUESTIONS_SYSTEM,
        buildTechnicalQuestionsPrompt(technicalRequirements),
        validRequirementIds,
        mintId,
        questions.length,
      )),
    );
  }

  if (behaviouralRequirements.length > 0) {
    questions.push(
      ...(await generateCategory(
        llm,
        'behavioural',
        BEHAVIOURAL_QUESTIONS_SYSTEM,
        buildBehaviouralQuestionsPrompt(behaviouralRequirements),
        validRequirementIds,
        mintId,
        questions.length,
      )),
    );
  }

  const isSenior = SENIOR_PATTERN.test(input.jdText);
  if (isSenior && technicalRequirements.length >= TECHNICAL_DENSITY_THRESHOLD) {
    questions.push(
      ...(await generateCategory(
        llm,
        'system-design',
        SYSTEM_DESIGN_QUESTIONS_SYSTEM,
        buildSystemDesignQuestionsPrompt(technicalRequirements),
        validRequirementIds,
        mintId,
        questions.length,
      )),
    );
  }

  questions.push(
    ...(await generateCategory(
      llm,
      'company-fit',
      COMPANY_FIT_QUESTIONS_SYSTEM,
      buildCompanyFitQuestionsPrompt(input.brief, input.hiringPages, input.searchResults),
      validRequirementIds,
      mintId,
      questions.length,
    )),
  );

  return { questions };
}

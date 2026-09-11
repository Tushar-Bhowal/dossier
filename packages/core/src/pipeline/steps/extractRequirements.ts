import { z } from 'zod';
import type { LlmPort } from '../../ports/llm.js';
import { verifyAgainstSource, type RawRequirementCandidate } from '../../domain/requirementRules.js';
import { createIdMinter } from '../../contracts/ids.js';
import type { Requirement } from '../../contracts/kit.js';
import { EXTRACT_REQUIREMENTS_SYSTEM, buildExtractRequirementsPrompt } from '../../prompts/extractRequirements.js';

const CandidateSchema = z.object({
  text: z.string().min(1),
  kind: z.enum(['technical', 'behavioural', 'domain']),
  priority: z.enum(['must', 'nice']),
  // min(3) rather than min(1): a real requirement's exact quote is never one or two characters —
  // this closes the trivial case of a single-letter "quote" trivially matching almost any JD,
  // without rejecting genuinely short real quotes ("SQL", "AWS", "Go").
  quote: z.string().min(3),
});

const ResponseSchema = z.object({ requirements: z.array(CandidateSchema) });

// Fewer than this many verified requirements is treated as an honestly-thin JD (§5), not a failure —
// no padding is ever added to reach it.
const THIN_THRESHOLD = 3;

export interface ExtractRequirementsResult {
  requirements: Requirement[];
  thin: boolean;
}

// Wires Task 7's anti-hallucination gate: the model's candidates (with a verbatim `quote`) are
// verified against the JD text before any of them become a real `Requirement`. The quote itself is
// never carried onto the returned objects — see the NOTE in contracts/kit.ts.
export async function extractRequirements(llm: LlmPort, jdText: string): Promise<ExtractRequirementsResult> {
  const { requirements: candidates } = await llm.generate({
    model: 'flash',
    system: EXTRACT_REQUIREMENTS_SYSTEM,
    prompt: buildExtractRequirementsPrompt(jdText),
    schema: ResponseSchema,
    maxOutputTokens: 2048,
  });

  const verified = verifyAgainstSource(candidates as RawRequirementCandidate[], jdText);

  const mintId = createIdMinter('r');
  const requirements: Requirement[] = verified.map((candidate, index) => ({
    id: mintId(),
    text: candidate.text,
    kind: candidate.kind,
    priority: candidate.priority,
    origin: 'generated',
    pinned: false,
    order: index,
  }));

  return { requirements, thin: requirements.length < THIN_THRESHOLD };
}

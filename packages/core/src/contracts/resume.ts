import { z } from 'zod';
import { Requirement, RequirementKind, RequirementPriority } from './kit.js';

// camelCase on purpose: kit.ts is snake_case only because the assessment's Appendix A fixed it.
// Ids are crypto.randomUUID() strings, minted wherever the object is created (browser or server).
const Id = z.string().min(1);
const YearMonth = z.string().regex(/^\d{4}(-(0[1-9]|1[0-2]))?$/); // "2024" or "2024-06"

export const Region = z.enum(['IN', 'abroad']);
export type Region = z.infer<typeof Region>;

export const EntryKind = z.enum(['job', 'education', 'project', 'certification', 'volunteer']);
export type EntryKind = z.infer<typeof EntryKind>;

export const FactSource = z.enum(['describe', 'answer', 'duty', 'upload', 'manual']);
export type FactSource = z.infer<typeof FactSource>;

// ---------- profile (one per user) ----------

// Never put in a prompt.
export const Contact = z.object({
  name: z.string().min(1).max(120),
  email: z.email().optional(),
  phone: z.string().max(40).optional(),
  location: z.string().max(120).optional(),
  links: z.array(z.object({ label: z.string().max(40), url: z.url() })).max(5),
});
export type Contact = z.infer<typeof Contact>;

export const Entry = z.object({
  id: Id,
  kind: EntryKind,
  title: z.string().min(1).max(160),
  org: z.string().max(160).optional(),
  place: z.string().max(120).optional(),
  start: YearMonth.optional(),
  end: YearMonth.optional(),
  current: z.boolean(),
});
export type Entry = z.infer<typeof Entry>;

export const Fact = z.object({
  id: Id,
  entryId: Id.nullable(),
  text: z.string().min(1).max(400),
  originalText: z.string().max(1000).optional(),
  source: FactSource,
});
export type Fact = z.infer<typeof Fact>;

// A self-declared skill never justifies a bullet — grounding ignores it as backing.
export const Skill = z.object({
  name: z.string().min(1).max(60),
  source: z.enum(['fact', 'self-declared']),
});
export type Skill = z.infer<typeof Skill>;

// Resized in the browser; never sent to an LLM.
export const Photo = z.object({
  dataUrl: z.string().startsWith('data:image/jpeg;base64,').max(140_000),
});
export type Photo = z.infer<typeof Photo>;

export const CareerProfile = z.object({
  region: Region,
  canonicalRole: z.string().max(80).optional(),
  contact: Contact,
  photo: Photo.optional(),
  entries: z.array(Entry),
  facts: z.array(Fact),
  skills: z.array(Skill),
  languages: z.array(z.string().max(40)),
  skillsToLearn: z.array(z.string().max(60)),
  version: z.int().positive(),
  updatedAt: z.iso.datetime(),
});
export type CareerProfile = z.infer<typeof CareerProfile>;

// ---------- resume (many per user) ----------

export const Bullet = z.object({
  id: Id,
  text: z.string().min(1).max(300),
  // Empty only when origin is 'user'. 'fallback' = the fact's own text, kept after grounding
  // rejected the AI's wording twice.
  factIds: z.array(Id),
  origin: z.enum(['ai', 'user', 'fallback']),
});
export type Bullet = z.infer<typeof Bullet>;

export const EntryBlock = z.object({ entryId: Id, bullets: z.array(Bullet) });
export type EntryBlock = z.infer<typeof EntryBlock>;

export const EntrySectionKind = z.enum(['experience', 'education', 'projects', 'certifications', 'volunteer']);
export type EntrySectionKind = z.infer<typeof EntrySectionKind>;

const sectionBase = { id: Id, title: z.string().min(1).max(40), hidden: z.boolean() };

export const Section = z.discriminatedUnion('kind', [
  z.object({ ...sectionBase, kind: z.literal('summary'), text: z.string().max(600), factIds: z.array(Id) }),
  z.object({ ...sectionBase, kind: EntrySectionKind, items: z.array(EntryBlock) }),
  z.object({ ...sectionBase, kind: z.literal('skills'), skills: z.array(z.string().max(60)) }),
  z.object({ ...sectionBase, kind: z.literal('languages'), languages: z.array(z.string().max(40)) }),
]);
export type Section = z.infer<typeof Section>;
export type SectionKind = Section['kind'];

export const TailorTarget = z.object({
  jdText: z.string().min(50).max(20_000),
  company: z.string().max(120).optional(),
  role: z.string().max(120).optional(),
  kitId: Id.optional(),
});
export type TailorTarget = z.infer<typeof TailorTarget>;

export const Resume = z.object({
  id: Id,
  title: z.string().min(1).max(80),
  template: z.literal('universal'),
  showPhoto: z.boolean(),
  // Array order is render order.
  sections: z.array(Section),
  target: TailorTarget.optional(),
  baseResumeId: Id.optional(),
  version: z.int().positive(),
  updatedAt: z.iso.datetime(),
});
export type Resume = z.infer<typeof Resume>;

export const ResumeListItem = z.object({
  id: Id,
  title: z.string(),
  baseResumeId: Id.optional(),
  targetRole: z.string().optional(),
  targetCompany: z.string().optional(),
  updatedAt: z.iso.datetime(),
});
export type ResumeListItem = z.infer<typeof ResumeListItem>;

export const ResumeSnapshot = z.object({
  at: z.iso.datetime(),
  note: z.string().max(80),
  sections: z.array(Section),
});
export type ResumeSnapshot = z.infer<typeof ResumeSnapshot>;

// ---------- guided builder ----------

export const FollowUpQuestion = z.object({
  id: Id,
  text: z.string().max(160),
  examples: z.array(z.string().max(40)).max(4),
  entryId: Id.nullable(),
});
export type FollowUpQuestion = z.infer<typeof FollowUpQuestion>;

// Shared across users, cached per canonical role + region.
export const RolePack = z.object({
  role: z.string().max(80),
  region: Region,
  duties: z.array(z.string().max(80)).max(12),
  skills: z.array(z.string().max(60)).max(20),
  certifications: z.array(z.string().max(80)).max(10),
  questions: z.array(FollowUpQuestion.omit({ entryId: true })).max(10),
  photoCommon: z.boolean(),
  photoNote: z.string().max(120).optional(),
});
export type RolePack = z.infer<typeof RolePack>;

export const ParseRequest = z.object({ text: z.string().min(10).max(4000), region: Region });
export type ParseRequest = z.infer<typeof ParseRequest>;

export const ImportRequest = z.object({ redactedText: z.string().min(50).max(20_000), region: Region });
export type ImportRequest = z.infer<typeof ImportRequest>;

// Returned by both /parse and /import. A null rolePack means generic questions, no duty picker.
export const ParseResult = z.object({
  detectedLanguage: z.string().max(60),
  canonicalRole: z.string().max(80).nullable(),
  entries: z.array(Entry),
  facts: z.array(Fact),
  skills: z.array(Skill),
  languages: z.array(z.string().max(40)),
  rolePack: RolePack.nullable(),
  questions: z.array(FollowUpQuestion).max(6),
  suggestedDuties: z.array(z.object({ text: z.string().max(80), entryId: Id })).max(10),
});
export type ParseResult = z.infer<typeof ParseResult>;

export const AnswersRequest = z.object({
  answers: z.array(z.object({ questionId: Id, text: z.string().min(1).max(1000) })),
  tickedDuties: z.array(z.object({ text: z.string().max(80), entryId: Id })),
});
export type AnswersRequest = z.infer<typeof AnswersRequest>;

export const AnswersResult = z.object({
  facts: z.array(Fact),
  entries: z.array(Entry),
  skills: z.array(Skill),
});
export type AnswersResult = z.infer<typeof AnswersResult>;

// Anything typed into the composer after the first message. Entries (no contact details) let the
// server attach the new facts to the right job or degree.
export const NoteRequest = z.object({ text: z.string().min(2).max(1000), entries: z.array(Entry) });
export type NoteRequest = z.infer<typeof NoteRequest>;

export const ComposeRequest = z.object({ title: z.string().max(80).optional() });
export type ComposeRequest = z.infer<typeof ComposeRequest>;

export const ComposeResult = z.object({ resume: Resume, fallbackBulletIds: z.array(Id) });
export type ComposeResult = z.infer<typeof ComposeResult>;

// ---------- tailoring ----------

export const Verdict = z.enum(['covered', 'partial', 'missing']);
export type Verdict = z.infer<typeof Verdict>;

export const Evidence = z.object({
  quote: z.string().max(400),
  bulletId: Id.optional(),
  factId: Id.optional(),
});
export type Evidence = z.infer<typeof Evidence>;

export const RequirementVerdict = z.object({
  requirementId: z.string(),
  verdict: Verdict,
  evidence: z.array(Evidence).max(3),
  note: z.string().max(200).optional(),
});
export type RequirementVerdict = z.infer<typeof RequirementVerdict>;

export const RecruiterTerm = z.object({
  term: z.string().max(60),
  requirementId: z.string(),
  priority: RequirementPriority,
});
export type RecruiterTerm = z.infer<typeof RecruiterTerm>;

export const BulletChange = z.discriminatedUnion('op', [
  z.object({ op: z.literal('replace'), bulletId: Id, text: z.string().max(300), factIds: z.array(Id).min(1) }),
  z.object({
    op: z.literal('add'),
    entryId: Id,
    afterBulletId: Id.nullable(),
    text: z.string().max(300),
    factIds: z.array(Id).min(1),
  }),
]);
export type BulletChange = z.infer<typeof BulletChange>;

export const Proposal = z.object({
  id: Id,
  requirementIds: z.array(z.string()).min(1),
  change: BulletChange,
  before: z.string().nullable(),
  status: z.enum(['pending', 'accepted', 'rejected']),
});
export type Proposal = z.infer<typeof Proposal>;

export const GapQuestion = z.object({
  id: Id,
  requirementId: z.string(),
  text: z.string().max(200),
  examples: z.array(z.string().max(60)).max(3),
});
export type GapQuestion = z.infer<typeof GapQuestion>;

export const StartTailoringRequest = z.object({ resumeId: Id, target: TailorTarget });
export type StartTailoringRequest = z.infer<typeof StartTailoringRequest>;

export const TailoringDecision = z.object({
  accepted: z.array(Id),
  rejected: z.array(Id),
  answers: z.array(z.object({ questionId: Id, text: z.string().min(1).max(1000) })),
  finish: z.boolean(),
});
export type TailoringDecision = z.infer<typeof TailoringDecision>;

export const TailoringState = z.object({
  sessionId: Id,
  baseResumeId: Id,
  tailoredResumeId: Id,
  round: z.int().positive(),
  status: z.enum(['awaiting_review', 'done', 'failed']),
  requirements: z.array(Requirement),
  terms: z.array(RecruiterTerm),
  verdicts: z.array(RequirementVerdict),
  proposals: z.array(Proposal),
  questions: z.array(GapQuestion),
  mustCovered: z.int().nonnegative(),
  mustTotal: z.int().nonnegative(),
});
export type TailoringState = z.infer<typeof TailoringState>;

// ---------- market terms ----------

export const MarketTerm = z.object({
  term: z.string().max(60),
  count: z.int().positive(),
  kind: RequirementKind,
  sampleUrls: z.array(z.url()).max(3),
});
export type MarketTerm = z.infer<typeof MarketTerm>;

export const MarketTerms = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('ready'),
    role: z.string(),
    region: Region,
    postingCount: z.int(),
    terms: z.array(MarketTerm),
    fetchedAt: z.iso.datetime(),
  }),
  z.object({ status: z.literal('not_enough_data'), role: z.string(), region: Region, postingCount: z.int() }),
]);
export type MarketTerms = z.infer<typeof MarketTerms>;

const term = z.string().max(60);

export const MarketTermChoice = z.discriminatedUnion('choice', [
  z.object({ choice: z.literal('used'), term, where: z.string().min(3).max(300) }),
  z.object({ choice: z.literal('practised'), term, where: z.string().min(3).max(300) }),
  z.object({ choice: z.literal('learn'), term }),
  z.object({ choice: z.literal('add-anyway'), term }),
]);
export type MarketTermChoice = z.infer<typeof MarketTermChoice>;

export const MarketAnswersRequest = z.object({ resumeId: Id, choices: z.array(MarketTermChoice).min(1) });
export type MarketAnswersRequest = z.infer<typeof MarketAnswersRequest>;

export const MarketAnswersResult = z.object({
  facts: z.array(Fact),
  skills: z.array(Skill),
  proposals: z.array(Proposal),
  skillsToLearn: z.array(z.string()),
});
export type MarketAnswersResult = z.infer<typeof MarketAnswersResult>;

import { z } from 'zod';

export const Origin = z.enum(['generated', 'edited', 'manual', 'template']);
export type Origin = z.infer<typeof Origin>;

export const RequirementKind = z.enum(['technical', 'behavioural', 'domain']);
export const RequirementPriority = z.enum(['must', 'nice']);

export const Requirement = z.object({
  id: z.string().regex(/^r\d+$/),
  text: z.string().min(1),
  kind: RequirementKind,
  priority: RequirementPriority,
  origin: Origin,
  pinned: z.boolean(),
  order: z.int(),
});
export type Requirement = z.infer<typeof Requirement>;

export const QuestionCategory = z.enum(['technical', 'behavioural', 'system-design', 'company-fit']);

export const Question = z.object({
  id: z.string().regex(/^q\d+$/),
  requirement_ids: z.array(z.string()),
  category: QuestionCategory,
  prompt: z.string().min(1),
  answer_outline: z.string(),
  difficulty: z.int().min(1).max(3),
  origin: Origin,
  pinned: z.boolean(),
  order: z.int(),
});
export type Question = z.infer<typeof Question>;

export const Flashcard = z.object({
  id: z.string().regex(/^f\d+$/),
  front: z.string().min(1),
  back: z.string().min(1),
  requirement_ids: z.array(z.string()),
  origin: Origin,
  pinned: z.boolean(),
  order: z.int(),
});
export type Flashcard = z.infer<typeof Flashcard>;

export const SourceMeta = z.object({
  company: z.string(),
  company_url: z.url(),
  role: z.string(),
  location: z.string(),
  jd_chars: z.int().nonnegative(),
  researched_at: z.iso.datetime(),
  pages_used: z.array(z.url()),
});
export type SourceMeta = z.infer<typeof SourceMeta>;

// `origin` is the only provenance extension here — company_brief is regenerated as one unit
// (§6 lists "the company brief" as a whole section, not per-field), so `pinned`/`order` don't apply.
export const CompanyBrief = z.object({
  summary: z.string(),
  what_they_do: z.string(),
  sources: z.array(z.url()),
  origin: Origin,
});
export type CompanyBrief = z.infer<typeof CompanyBrief>;

export const RoleSection = z.object({
  title: z.string(),
  seniority: z.string(),
  responsibilities: z.array(z.string()),
  requirements: z.array(Requirement),
});
export type RoleSection = z.infer<typeof RoleSection>;

export const ScheduleDay = z.object({
  day: z.int().positive(),
  focus: z.string(),
  question_ids: z.array(z.string()),
  // nonnegative, not positive: Appendix A only says "minutes is an integer" — a day with
  // genuinely nothing to study (e.g. a JD too thin to yield any requirements) should be able to
  // report 0 honestly rather than be forced into a fabricated positive number.
  minutes: z.int().nonnegative(),
});
export type ScheduleDay = z.infer<typeof ScheduleDay>;

// Schedule carries no provenance fields — it's always fully derived by domain/schedule.ts,
// never hand-edited (§6/§8), so there's no "edited day" state a regeneration could clobber.
export const Schedule = z
  .object({
    days_available: z.int().positive(),
    days: z.array(ScheduleDay),
  })
  .check((ctx) => {
    // §8: "the number of days in the schedule equals the number of days requested" — enforced
    // here so a malformed schedule can never be persisted, not just trusted from the generator.
    if (ctx.value.days.length !== ctx.value.days_available) {
      ctx.issues.push({
        code: 'custom',
        input: ctx.value.days.length,
        message: `schedule.days has ${ctx.value.days.length} entries but days_available is ${ctx.value.days_available}`,
        path: ['days'],
      });
    }
  });
export type Schedule = z.infer<typeof Schedule>;

export const Coverage = z.object({
  uncovered_requirement_ids: z.array(z.string()),
  passes: z.int().nonnegative(),
});
export type Coverage = z.infer<typeof Coverage>;

export const Kit = z
  .object({
    source: SourceMeta,
    company_brief: CompanyBrief,
    role: RoleSection,
    questions: z.array(Question),
    flashcards: z.array(Flashcard),
    schedule: Schedule,
    coverage: Coverage,
  })
  .check((ctx) => {
    const kit = ctx.value;
    const questionIds = new Set(kit.questions.map((q) => q.id));
    kit.schedule.days.forEach((day, dayIdx) => {
      day.question_ids.forEach((qid, qidIdx) => {
        if (!questionIds.has(qid)) {
          ctx.issues.push({
            code: 'custom',
            input: qid,
            message: `schedule.days[${dayIdx}].question_ids[${qidIdx}] references unknown question "${qid}"`,
            path: ['schedule', 'days', dayIdx, 'question_ids', qidIdx],
          });
        }
      });
    });
  });
export type Kit = z.infer<typeof Kit>;

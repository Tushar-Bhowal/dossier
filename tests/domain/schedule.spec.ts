import { describe, expect, it } from 'vitest';
import { buildSchedule, type Requirement, type Question } from '@dossier/core';

function requirement(id: string, priority: 'must' | 'nice', order: number): Requirement {
  return {
    id,
    text: `Requirement ${id}`,
    kind: 'technical',
    priority,
    origin: 'generated',
    pinned: false,
    order,
  };
}

function question(
  id: string,
  requirement_ids: string[],
  difficulty: 1 | 2 | 3,
  order: number,
  category: Question['category'] = 'technical',
): Question {
  return {
    id,
    requirement_ids,
    category,
    prompt: `Question ${id}`,
    answer_outline: '',
    difficulty,
    origin: 'generated',
    pinned: false,
    order,
  };
}

describe('buildSchedule', () => {
  it('days=1: every question lands on the single day, minutes summed, nothing dropped', () => {
    const requirements = [requirement('r1', 'must', 0), requirement('r2', 'must', 1)];
    const questions = [
      question('q1', ['r1'], 3, 0),
      question('q2', ['r2'], 2, 1),
      question('q3', ['r1'], 1, 2),
    ];
    const schedule = buildSchedule(questions, requirements, 1);

    expect(schedule.days).toHaveLength(1);
    expect(schedule.days[0]!.question_ids.sort()).toEqual(['q1', 'q2', 'q3']);
    expect(schedule.days[0]!.minutes).toBe(25 + 20 + 15); // 10+5*diff per question
  });

  it('days=60 with 12 questions: every day exists, and trailing days cycle back through the sorted list', () => {
    const requirements = Array.from({ length: 12 }, (_, i) => requirement(`r${i + 1}`, 'must', i));
    const questions = requirements.map((r, i) => question(`q${i + 1}`, [r.id], 2, i));
    const schedule = buildSchedule(questions, requirements, 60);

    expect(schedule.days).toHaveLength(60);
    expect(schedule.days_available).toBe(60);

    const allQuestionIds = new Set(questions.map((q) => q.id));
    for (const day of schedule.days) {
      expect(day.question_ids.length).toBeGreaterThan(0);
      for (const qid of day.question_ids) expect(allQuestionIds.has(qid)).toBe(true);
    }

    // primary placement used far fewer than 60 days (12 questions, small per-day budgets) —
    // trailing days must be review days that reuse earlier question ids, not fresh content.
    const lastDay = schedule.days[schedule.days.length - 1]!;
    expect(lastDay.focus).toMatch(/^Review —/);
  });

  it('every must-have requirement appears in some day of the schedule', () => {
    const requirements = [
      requirement('r1', 'must', 0),
      requirement('r2', 'nice', 1),
      requirement('r3', 'must', 2),
    ];
    const questions = [
      question('q1', ['r1'], 2, 0),
      question('q2', ['r2'], 1, 1),
      question('q3', ['r3'], 3, 2),
    ];
    const schedule = buildSchedule(questions, requirements, 3);

    const scheduledQuestionIds = new Set(schedule.days.flatMap((d) => d.question_ids));
    const mustQuestionIds = questions
      .filter((q) => q.requirement_ids.some((id) => id === 'r1' || id === 'r3'))
      .map((q) => q.id);
    for (const qid of mustQuestionIds) expect(scheduledQuestionIds.has(qid)).toBe(true);
  });

  it('sorts must-priority, higher-difficulty questions earlier', () => {
    const requirements = [requirement('r1', 'nice', 0), requirement('r2', 'must', 1)];
    const questions = [
      question('easy-nice', ['r1'], 1, 0),
      question('hard-must', ['r2'], 3, 1),
    ];
    const schedule = buildSchedule(questions, requirements, 2);
    // hard-must should land on day 1 (or at least no later than easy-nice)
    const dayOf = (qid: string) => schedule.days.findIndex((d) => d.question_ids.includes(qid));
    expect(dayOf('hard-must')).toBeLessThanOrEqual(dayOf('easy-nice'));
  });

  it('minutes are always non-negative integers', () => {
    const requirements = [requirement('r1', 'must', 0)];
    const questions = [question('q1', ['r1'], 2, 0)];
    const schedule = buildSchedule(questions, requirements, 5);
    for (const day of schedule.days) {
      expect(Number.isInteger(day.minutes)).toBe(true);
      expect(day.minutes).toBeGreaterThanOrEqual(0);
    }
  });

  it('handles zero questions honestly: daysAvailable empty days, not a crash', () => {
    const schedule = buildSchedule([], [], 4);
    expect(schedule.days).toHaveLength(4);
    for (const day of schedule.days) {
      expect(day.question_ids).toEqual([]);
      expect(day.minutes).toBe(0);
    }
  });

  it('derives focus from the dominant category, never leaving it blank', () => {
    const requirements = [requirement('r1', 'must', 0)];
    const questions = [
      question('q1', ['r1'], 1, 0, 'behavioural'),
      question('q2', ['r1'], 1, 1, 'behavioural'),
      question('q3', ['r1'], 1, 2, 'technical'),
    ];
    const schedule = buildSchedule(questions, requirements, 1);
    expect(schedule.days[0]!.focus).toBe('Behavioural');
  });
});

// A tiny seeded PRNG so the "randomised" property test below is reproducible across runs —
// no fast-check dependency needed for what a plain loop with fixed seeds already proves.
function mulberry32(seed: number) {
  let s = seed >>> 0;
  return function rand() {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomInt(rand: () => number, min: number, max: number): number {
  return min + Math.floor(rand() * (max - min + 1));
}

const CATEGORIES: Question['category'][] = ['technical', 'behavioural', 'system-design', 'company-fit'];

function randomTrial(rand: () => number) {
  const reqCount = randomInt(rand, 1, 8);
  const requirements: Requirement[] = Array.from({ length: reqCount }, (_, i) =>
    requirement(`r${i + 1}`, rand() < 0.5 ? 'must' : 'nice', i),
  );

  // Every requirement gets at least one covering question, mirroring the real pipeline's state
  // by the time buildSchedule ever runs (after the coverage check + gap-fill loop already ran).
  let qCounter = 0;
  const questions: Question[] = requirements.map((r) => {
    qCounter += 1;
    return question(`q${qCounter}`, [r.id], randomInt(rand, 1, 3) as 1 | 2 | 3, qCounter - 1, CATEGORIES[randomInt(rand, 0, 3)]);
  });
  const extra = randomInt(rand, 0, 6);
  for (let i = 0; i < extra; i += 1) {
    qCounter += 1;
    const covered = requirements.length > 0 ? [requirements[randomInt(rand, 0, requirements.length - 1)]!.id] : [];
    questions.push(
      question(`q${qCounter}`, covered, randomInt(rand, 1, 3) as 1 | 2 | 3, qCounter - 1, CATEGORIES[randomInt(rand, 0, 3)]),
    );
  }

  return { requirements, questions, daysAvailable: randomInt(rand, 1, 60) };
}

describe('buildSchedule — property test (200 seeded random trials)', () => {
  it('always satisfies: correct day count, valid question refs, all musts present, positive-int minutes', () => {
    const rand = mulberry32(20260911);
    for (let trial = 0; trial < 200; trial += 1) {
      const { requirements, questions, daysAvailable } = randomTrial(rand);
      const schedule = buildSchedule(questions, requirements, daysAvailable);

      expect(schedule.days).toHaveLength(daysAvailable);

      const validQuestionIds = new Set(questions.map((q) => q.id));
      const scheduledQuestionIds = new Set<string>();
      for (const day of schedule.days) {
        expect(Number.isInteger(day.minutes)).toBe(true);
        expect(day.minutes).toBeGreaterThanOrEqual(0);
        for (const qid of day.question_ids) {
          expect(validQuestionIds.has(qid)).toBe(true);
          scheduledQuestionIds.add(qid);
        }
      }

      const mustRequirementIds = new Set(requirements.filter((r) => r.priority === 'must').map((r) => r.id));
      const questionCoversAMust = (q: Question) => q.requirement_ids.some((id) => mustRequirementIds.has(id));
      for (const q of questions) {
        if (questionCoversAMust(q)) {
          expect(scheduledQuestionIds.has(q.id)).toBe(true);
        }
      }
    }
  });
});

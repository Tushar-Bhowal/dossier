import type { Question, Requirement, Schedule, ScheduleDay } from '../contracts/kit.js';

const CATEGORY_LABEL: Record<Question['category'], string> = {
  technical: 'Technical',
  behavioural: 'Behavioural',
  'system-design': 'System design',
  'company-fit': 'Company fit',
};

function costMinutes(q: Question): number {
  return 10 + q.difficulty * 5;
}

// Question has no `priority` field of its own (only Requirement does) — a question is treated as
// must-priority if any requirement it covers is a must-have, since that's what actually determines
// how urgently it belongs earlier in the schedule.
function isMustPriority(q: Question, mustRequirementIds: Set<string>): boolean {
  return q.requirement_ids.some((id) => mustRequirementIds.has(id));
}

function weight(q: Question, mustRequirementIds: Set<string>): number {
  return (isMustPriority(q, mustRequirementIds) ? 2 : 1) * q.difficulty;
}

function dominantCategoryLabel(questions: Question[]): string {
  if (questions.length === 0) return 'Review';
  const counts = new Map<Question['category'], number>();
  for (const q of questions) counts.set(q.category, (counts.get(q.category) ?? 0) + 1);

  let best = questions[0]!.category;
  let bestCount = 0;
  for (const [category, count] of [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    if (count > bestCount) {
      best = category;
      bestCount = count;
    }
  }
  return CATEGORY_LABEL[best];
}

export function buildSchedule(
  questions: Question[],
  requirements: Requirement[],
  daysAvailable: number,
): Schedule {
  if (questions.length === 0) {
    // A genuinely empty question bank (e.g. a JD too thin to yield any requirements) still owes
    // the user `daysAvailable` days — just honestly empty ones, not fabricated content.
    return {
      days_available: daysAvailable,
      days: Array.from({ length: daysAvailable }, (_, i): ScheduleDay => ({
        day: i + 1,
        focus: 'No material to schedule yet',
        question_ids: [],
        minutes: 0,
      })),
    };
  }

  const requirementOrderById = new Map(requirements.map((r) => [r.id, r.order]));
  const mustRequirementIds = new Set(requirements.filter((r) => r.priority === 'must').map((r) => r.id));

  const minRequirementOrder = (q: Question): number => {
    const orders = q.requirement_ids
      .map((id) => requirementOrderById.get(id))
      .filter((o): o is number => o !== undefined);
    return orders.length > 0 ? Math.min(...orders) : Number.MAX_SAFE_INTEGER;
  };

  // Sort: must-priority + harder first, then by the earliest-extracted covered requirement, then
  // by the question's own extraction order — fully deterministic, no ties left to array order.
  const sorted = [...questions].sort((a, b) => {
    const wa = weight(a, mustRequirementIds);
    const wb = weight(b, mustRequirementIds);
    if (wa !== wb) return wb - wa;
    const ra = minRequirementOrder(a);
    const rb = minRequirementOrder(b);
    if (ra !== rb) return ra - rb;
    return a.order - b.order;
  });

  const total = sorted.reduce((sum, q) => sum + costMinutes(q), 0);
  const average = total / daysAvailable;

  // Front-loaded budget curve: day 1 gets ~1.3x the average, the last day ~0.7x, linear between —
  // this is what puts harder/higher-priority material earlier rather than the night before.
  const dayBudget = (dayIndex: number): number => {
    if (daysAvailable === 1) return total;
    const t = dayIndex / (daysAvailable - 1);
    return (1.3 - 0.6 * t) * average;
  };

  const days: { questions: Question[]; minutes: number }[] = Array.from({ length: daysAvailable }, () => ({
    questions: [],
    minutes: 0,
  }));

  let dayIndex = 0;
  for (const q of sorted) {
    const cost = costMinutes(q);
    const current = days[dayIndex]!;
    const wouldExceedBudget = current.minutes + cost > dayBudget(dayIndex);
    // Only advance once the current day already holds something — a single question is never
    // dropped or split just because it alone exceeds that day's budget (days=1 relies on this:
    // there's nowhere to advance to, so everything lands on the one day, no truncation).
    if (wouldExceedBudget && current.questions.length > 0 && dayIndex < daysAvailable - 1) {
      dayIndex += 1;
    }
    const target = days[dayIndex]!;
    target.questions.push(q);
    target.minutes += cost;
  }

  const lastPrimaryDayIndex = days.reduce(
    (last, day, idx) => (day.questions.length > 0 ? idx : last),
    -1,
  );

  // Trailing days beyond what the primary pass needed (e.g. many days requested, few questions
  // to fill them) become review days — cycling back through the same priority-ordered list, so
  // the highest-priority material is also what gets revisited most as the cycle repeats. This is
  // a static, priority-ordered re-exposure, not adaptive spaced repetition — real confidence-based
  // spacing lives in practice mode (domain/leitner.ts), which needs practice data that doesn't
  // exist yet at schedule-generation time.
  for (let idx = lastPrimaryDayIndex + 1; idx < daysAvailable; idx += 1) {
    const reviewQuestion = sorted[(idx - lastPrimaryDayIndex - 1) % sorted.length]!;
    days[idx] = {
      questions: [reviewQuestion],
      minutes: Math.max(10, Math.round(costMinutes(reviewQuestion) / 2)),
    };
  }

  const scheduleDays: ScheduleDay[] = days.map((day, idx) => ({
    day: idx + 1,
    focus:
      idx > lastPrimaryDayIndex
        ? `Review — ${dominantCategoryLabel(day.questions)}`
        : dominantCategoryLabel(day.questions),
    question_ids: day.questions.map((q) => q.id),
    minutes: day.minutes,
  }));

  return { days_available: daysAvailable, days: scheduleDays };
}

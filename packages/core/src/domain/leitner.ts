export type LeitnerBox = 1 | 2 | 3 | 4 | 5;
export type Confidence = 'low' | 'medium' | 'high';

const MAX_BOX: LeitnerBox = 5;

// Standard Leitner doubling, in days — this is the *unconstrained* interval. It gets compressed
// against the days actually remaining before the interview in nextReviewInDays below, because an
// unmodified spaced-repetition schedule assumes weeks of runway a five-day prep window doesn't have.
const BASE_INTERVAL_DAYS: Record<LeitnerBox, number> = { 1: 1, 2: 2, 3: 4, 4: 8, 5: 16 };

export function nextBox(currentBox: LeitnerBox, confidence: Confidence): LeitnerBox {
  if (confidence === 'high') return (Math.min(currentBox + 1, MAX_BOX)) as LeitnerBox;
  if (confidence === 'low') return 1;
  return currentBox;
}

// Deadline-aware: the review offset is clamped to [1, daysRemaining], so a card can never be
// scheduled to resurface after the interview has already happened. `daysRemaining <= 0` means the
// interview is today or has passed — there's no valid future day left, so the offset is 0 (review
// now, not later).
export function nextReviewInDays(box: LeitnerBox, daysRemaining: number): number {
  if (daysRemaining <= 0) return 0;
  const base = BASE_INTERVAL_DAYS[box];
  return Math.max(1, Math.min(base, daysRemaining));
}

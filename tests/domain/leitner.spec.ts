import { describe, expect, it } from 'vitest';
import { nextBox, nextReviewInDays, type LeitnerBox, type Confidence } from '@dossier/core';

describe('nextBox', () => {
  it('promotes on high confidence, capped at box 5', () => {
    expect(nextBox(1, 'high')).toBe(2);
    expect(nextBox(4, 'high')).toBe(5);
    expect(nextBox(5, 'high')).toBe(5);
  });

  it('resets to box 1 on low confidence, from any box', () => {
    expect(nextBox(1, 'low')).toBe(1);
    expect(nextBox(3, 'low')).toBe(1);
    expect(nextBox(5, 'low')).toBe(1);
  });

  it('stays in the same box on medium confidence', () => {
    expect(nextBox(3, 'medium')).toBe(3);
  });
});

describe('nextReviewInDays', () => {
  it('never schedules a review beyond the days remaining before the interview', () => {
    expect(nextReviewInDays(5, 2)).toBeLessThanOrEqual(2); // box 5's base interval is 16 days
    expect(nextReviewInDays(4, 3)).toBeLessThanOrEqual(3);
  });

  it('returns 0 when the interview is today or has passed', () => {
    expect(nextReviewInDays(3, 0)).toBe(0);
    expect(nextReviewInDays(3, -1)).toBe(0);
  });

  it('returns exactly the base interval when there is ample runway', () => {
    expect(nextReviewInDays(1, 60)).toBe(1);
    expect(nextReviewInDays(3, 60)).toBe(4);
    expect(nextReviewInDays(5, 60)).toBe(16);
  });

  it('always returns at least 1 day when daysRemaining >= 1', () => {
    expect(nextReviewInDays(5, 1)).toBe(1);
  });
});

// A small deterministic PRNG, consistent with the property test in schedule.spec.ts — no new
// dependency for exhaustive random coverage of the "provably never" guarantee.
function mulberry32(seed: number) {
  let s = seed >>> 0;
  return function rand() {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('nextReviewInDays — property test (500 seeded random trials)', () => {
  it('the returned interval is always within [0, daysRemaining]', () => {
    const rand = mulberry32(20260911);
    const boxes: LeitnerBox[] = [1, 2, 3, 4, 5];
    for (let i = 0; i < 500; i += 1) {
      const box = boxes[Math.floor(rand() * boxes.length)]!;
      const daysRemaining = Math.floor(rand() * 90) - 5; // includes negative and 0 cases
      const interval = nextReviewInDays(box, daysRemaining);
      expect(interval).toBeGreaterThanOrEqual(0);
      expect(interval).toBeLessThanOrEqual(Math.max(0, daysRemaining));
    }
  });

  it('nextBox always returns a valid box in [1, 5] for any starting box and confidence', () => {
    const rand = mulberry32(42);
    const boxes: LeitnerBox[] = [1, 2, 3, 4, 5];
    const confidences: Confidence[] = ['low', 'medium', 'high'];
    for (let i = 0; i < 500; i += 1) {
      const box = boxes[Math.floor(rand() * boxes.length)]!;
      const confidence = confidences[Math.floor(rand() * confidences.length)]!;
      const result = nextBox(box, confidence);
      expect(result).toBeGreaterThanOrEqual(1);
      expect(result).toBeLessThanOrEqual(5);
    }
  });
});

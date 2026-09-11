import { describe, expect, it } from 'vitest';
import { mergeRegeneration, type Question } from '@dossier/core';

function question(
  id: string,
  origin: Question['origin'],
  pinned: boolean,
  order: number,
): Question {
  return {
    id,
    requirement_ids: [],
    category: 'technical',
    prompt: `Question ${id}`,
    answer_outline: '',
    difficulty: 1,
    origin,
    pinned,
    order,
  };
}

describe('mergeRegeneration', () => {
  it('replaces an unpinned generated item with fresh content', () => {
    const existing = [question('q1', 'generated', false, 0)];
    const fresh = [question('q2', 'generated', false, 0)];
    const result = mergeRegeneration(existing, fresh);
    expect(result.map((q) => q.id)).toEqual(['q2']);
  });

  it('preserves an edited item untouched', () => {
    const existing = [question('q1', 'edited', false, 0)];
    const result = mergeRegeneration(existing, [question('q2', 'generated', false, 0)]);
    const survivor = result.find((q) => q.id === 'q1');
    expect(survivor).toBeDefined();
    expect(survivor).toEqual(existing[0]);
  });

  it('preserves a manual item untouched', () => {
    const existing = [question('q1', 'manual', false, 0)];
    const result = mergeRegeneration(existing, [question('q2', 'generated', false, 0)]);
    expect(result.find((q) => q.id === 'q1')).toEqual(existing[0]);
  });

  it('preserves a pinned generated item even though its origin is generated', () => {
    const existing = [question('q1', 'generated', true, 0)];
    const result = mergeRegeneration(existing, [question('q2', 'generated', false, 0)]);
    expect(result.map((q) => q.id).sort()).toEqual(['q1', 'q2']);
  });

  it('replaces an unpinned template item (coverage safety-net fallback) like a generated one', () => {
    const existing = [question('q1', 'template', false, 0)];
    const result = mergeRegeneration(existing, [question('q2', 'generated', false, 0)]);
    expect(result.map((q) => q.id)).toEqual(['q2']);
  });

  it('preserves a pinned template item', () => {
    const existing = [question('q1', 'template', true, 0)];
    const result = mergeRegeneration(existing, [question('q2', 'generated', false, 0)]);
    expect(result.map((q) => q.id).sort()).toEqual(['q1', 'q2']);
  });

  it('keeps survivors in their original relative order and appends new items after them', () => {
    const existing = [
      question('edited-first', 'edited', false, 0),
      question('generated-mid', 'generated', false, 1),
      question('manual-last', 'manual', false, 2),
    ];
    const fresh = [question('new1', 'generated', false, 0), question('new2', 'generated', false, 0)];
    const result = mergeRegeneration(existing, fresh);

    expect(result.map((q) => q.id)).toEqual(['edited-first', 'manual-last', 'new1', 'new2']);
    // survivors keep their original order values untouched
    expect(result.find((q) => q.id === 'edited-first')!.order).toBe(0);
    expect(result.find((q) => q.id === 'manual-last')!.order).toBe(2);
    // new items are renumbered to continue after the highest surviving order
    expect(result.find((q) => q.id === 'new1')!.order).toBe(3);
    expect(result.find((q) => q.id === 'new2')!.order).toBe(4);
  });

  it('throws if a fresh item id collides with a surviving item id', () => {
    const existing = [question('q1', 'edited', false, 0)];
    expect(() => mergeRegeneration(existing, [question('q1', 'generated', false, 0)])).toThrow();
  });

  it('fully replaces the set when nothing is edited, manual, or pinned', () => {
    const existing = [question('q1', 'generated', false, 0), question('q2', 'template', false, 1)];
    const fresh = [question('q3', 'generated', false, 0)];
    const result = mergeRegeneration(existing, fresh);
    expect(result.map((q) => q.id)).toEqual(['q3']);
    expect(result[0]!.order).toBe(0);
  });

  it('handles an empty fresh set, leaving only survivors', () => {
    const existing = [question('q1', 'edited', false, 0), question('q2', 'generated', false, 1)];
    const result = mergeRegeneration(existing, []);
    expect(result.map((q) => q.id)).toEqual(['q1']);
  });
});

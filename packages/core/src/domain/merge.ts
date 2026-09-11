import type { Origin } from '../contracts/kit.js';

interface Provenanced {
  id: string;
  origin: Origin;
  pinned: boolean;
  order: number;
}

// Regenerating a section replaces only what the user hasn't touched and hasn't pinned. `template`
// items (the coverage safety net's synthesized fallback questions) are treated the same as
// `generated` here, not preserved — they're machine-authored placeholders born from a generation
// failure, and a regeneration is exactly the chance to replace one with real content. Only `edited`
// and `manual` origins, or anything explicitly `pinned`, survive by default.
function isReplaceable(item: Provenanced): boolean {
  return (item.origin === 'generated' || item.origin === 'template') && !item.pinned;
}

// `freshlyGenerated` must already carry unique ids (minted by the caller) — this function only
// decides who survives and renumbers `order`, it never mints or reuses ids itself, since an id
// getting silently reassigned to different content would corrupt every place elsewhere in the kit
// that references it by id (e.g. a schedule day's question_ids).
export function mergeRegeneration<T extends Provenanced>(existing: T[], freshlyGenerated: T[]): T[] {
  const survivors = existing.filter((item) => !isReplaceable(item));

  const survivorIds = new Set(survivors.map((s) => s.id));
  for (const item of freshlyGenerated) {
    if (survivorIds.has(item.id)) {
      throw new Error(`mergeRegeneration: fresh item id "${item.id}" collides with a surviving item`);
    }
  }

  // Survivors keep their existing `order` untouched — regenerating never moves an item the user
  // kept. New items are appended after the highest surviving order, in the order they arrived.
  const maxOrder = survivors.reduce((max, s) => Math.max(max, s.order), -1);
  const renumbered = freshlyGenerated.map((item, i) => ({ ...item, order: maxOrder + 1 + i }));

  return [...survivors, ...renumbered].sort((a, b) => a.order - b.order);
}

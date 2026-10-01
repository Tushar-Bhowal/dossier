import type { Bullet, BulletChange, Resume } from '../../contracts/resume.js';

function newBulletId(resume: Resume, factIds: string[]): string {
  const taken = new Set(
    resume.sections.flatMap((s) => ('items' in s ? s.items.flatMap((i) => i.bullets.map((b) => b.id)) : [])),
  );
  const preferred = `b-${factIds[0] ?? 'new'}`;
  return taken.has(preferred) ? `${preferred}-${globalThis.crypto.randomUUID().slice(0, 8)}` : preferred;
}

// Applies one accepted change by bullet id, so it merges with any manual edits made meanwhile.
// Returns null when the target is gone (the user deleted that bullet or entry), so the caller can
// skip the change instead of guessing where it should go.
export function applyBulletChange(resume: Resume, change: BulletChange): Resume | null {
  let applied = false;

  const sections = resume.sections.map((section) => {
    if (!('items' in section)) return section;
    const items = section.items.map((block) => {
      if (change.op === 'replace') {
        if (!block.bullets.some((b) => b.id === change.bulletId)) return block;
        applied = true;
        return {
          ...block,
          bullets: block.bullets.map((b): Bullet =>
            b.id === change.bulletId ? { ...b, text: change.text, factIds: change.factIds, origin: 'ai' } : b,
          ),
        };
      }

      if (block.entryId !== change.entryId || applied) return block;
      applied = true;
      const bullet: Bullet = {
        id: newBulletId(resume, change.factIds),
        text: change.text,
        factIds: change.factIds,
        origin: 'ai',
      };
      const at = change.afterBulletId ? block.bullets.findIndex((b) => b.id === change.afterBulletId) : -1;
      const bullets = [...block.bullets];
      bullets.splice(at === -1 ? bullets.length : at + 1, 0, bullet);
      return { ...block, bullets };
    });
    return { ...section, items };
  });

  return applied ? { ...resume, sections } : null;
}

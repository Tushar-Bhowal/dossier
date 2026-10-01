import type { Resume } from '../../contracts/resume.js';

export type LintRule = 'generic-phrase' | 'weak-opener' | 'first-person' | 'too-long' | 'add-number';

// Hints, never errors: a teacher's resume is not wrong for lacking a metric.
export interface LintHint {
  targetId: string;
  rule: LintRule;
  message: string;
}

const GENERIC_PHRASES = [
  'spearheaded',
  'results-driven',
  'results driven',
  'proven track record',
  'synergy',
  'synergized',
  'leveraged',
  'go-getter',
  'team player',
  'hard-working',
  'hardworking',
  'detail-oriented',
  'dynamic professional',
  'passionate about',
  'think outside the box',
  'self-starter',
  'go-to person',
  'wear many hats',
];

const WEAK_OPENERS = ['responsible for', 'worked on', 'helped with', 'involved in', 'duties included', 'tasked with'];

const MAX_BULLET_CHARS = 220;

function textHints(targetId: string, text: string): LintHint[] {
  const hints: LintHint[] = [];
  const lower = text.toLowerCase();

  for (const phrase of GENERIC_PHRASES) {
    if (lower.includes(phrase)) {
      hints.push({
        targetId,
        rule: 'generic-phrase',
        message: `"${phrase}" is one of the phrases recruiters read as filler. Say what you actually did instead.`,
      });
    }
  }

  if (/\b(I|me|my|we|our)\b/.test(text) || /^(i|my)\b/i.test(text.trim())) {
    hints.push({
      targetId,
      rule: 'first-person',
      message: 'Resumes usually leave out "I" and "my". Start with what you did.',
    });
  }

  return hints;
}

export function lintBullet(targetId: string, text: string): LintHint[] {
  const hints = textHints(targetId, text);
  const lower = text.trim().toLowerCase();

  const opener = WEAK_OPENERS.find((o) => lower.startsWith(o));
  if (opener) {
    hints.push({
      targetId,
      rule: 'weak-opener',
      message: `Starting with "${opener}" hides what you did. Try a verb like "Taught", "Managed" or "Built".`,
    });
  }

  if (text.length > MAX_BULLET_CHARS) {
    hints.push({ targetId, rule: 'too-long', message: 'Long line. Two lines at most reads best.' });
  }

  return hints;
}

export function lintResume(resume: Resume): LintHint[] {
  const hints: LintHint[] = [];

  for (const section of resume.sections) {
    if (section.hidden) continue;
    if (section.kind === 'summary') {
      hints.push(...textHints(section.id, section.text));
      continue;
    }
    if (section.kind === 'skills' || section.kind === 'languages') continue;

    for (const block of section.items) {
      for (const bullet of block.bullets) hints.push(...lintBullet(bullet.id, bullet.text));

      // At most one gentle nudge per entry, and only when nothing in it has a number yet.
      const first = block.bullets[0];
      if (section.kind === 'experience' && first && !block.bullets.some((b) => /\d/.test(b.text))) {
        hints.push({
          targetId: first.id,
          rule: 'add-number',
          message: 'If you know a number — students, people, %, ₹ — adding one makes this stronger.',
        });
      }
    }
  }

  return hints;
}

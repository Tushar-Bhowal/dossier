import type { DeliveryMetrics, InterviewTurn } from '../contracts/interview.js';

// Words that pad speech rather than carry meaning. "Like" and "so" are left out: they are too often
// used properly for a word count to tell the two apart.
const FILLERS = ['um', 'uh', 'erm', 'hmm', 'basically', 'actually', 'literally', 'you know', 'i mean', 'kind of', 'sort of'];

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function computeDelivery(turns: InterviewTurn[]): DeliveryMetrics {
  const answers = turns.filter((t) => t.role === 'candidate' && t.text.trim());
  const words = answers.reduce((n, t) => n + countWords(t.text), 0);
  const speakingMs = answers.reduce((n, t) => n + Math.max(0, t.endMs - t.startMs), 0);
  const minutes = speakingMs / 60_000;

  const counts = new Map<string, number>();
  for (const answer of answers) {
    const text = ` ${answer.text.toLowerCase().replace(/[^a-z'\s]/g, ' ')} `;
    for (const filler of FILLERS) {
      const hits = text.split(` ${filler} `).length - 1;
      if (hits) counts.set(filler, (counts.get(filler) ?? 0) + hits);
    }
  }
  const fillerCount = [...counts.values()].reduce((a, b) => a + b, 0);

  const perQuestion = new Map<string, number>();
  for (const answer of answers) {
    const key = answer.questionId ?? 'none';
    perQuestion.set(key, (perQuestion.get(key) ?? 0) + Math.max(0, answer.endMs - answer.startMs));
  }

  return {
    wordsPerMinute: minutes > 0 ? Math.round(words / minutes) : 0,
    fillerCount,
    fillersPerMinute: minutes > 0 ? Math.round((fillerCount / minutes) * 10) / 10 : 0,
    topFillers: [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([word, count]) => ({ word, count })),
    longestAnswerSec: Math.round(Math.max(0, ...perQuestion.values()) / 1000),
  };
}

import {
  computeDelivery,
  type CriterionScore,
  type InterviewQuestion,
  type InterviewReport,
  type InterviewTurn,
  type QuestionScore,
  type RubricCriterion,
  type Weakness,
} from "@dossier/core/interview";

// A stand-in for the real AI grader: simple, honest signals over the user's own words, and every
// score quotes a sentence they actually said or typed.

const SEQUENCE = /\b(first|firstly|then|next|after that|finally|last|so that|because|which meant|as a result)\b/i;
const ACTION = /\b(I|we)\s+(\w+ed|built|led|ran|made|wrote|set|cut|took|found|moved|planned|taught|did|showed|sent|split|use|used)\b/i;
const NUMBER = /\d/;
const FILLER_WORDS = "um|uh|erm|basically|you know|i mean|kind of|sort of";
const FILLER_ALL = new RegExp(`\\b(${FILLER_WORDS})\\b`, "gi");
const FILLER_ONE = new RegExp(`\\b(${FILLER_WORDS})\\b`, "i");

function sentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function quote(sentence: string): string {
  return sentence.length > 170 ? `${sentence.slice(0, 167).trimEnd()}…` : sentence;
}

const clamp = (n: number) => Math.max(1, Math.min(5, Math.round(n)));

function scoreAnswer(text: string): CriterionScore[] {
  const parts = sentences(text);
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const fillers = (text.match(FILLER_ALL) ?? []).length;
  // Each score quotes a different sentence where the answer has enough of them.
  const used = new Set<string>();
  const pick = (...preferred: (string | undefined)[]) => {
    const choice = preferred.find((c) => c && !used.has(c)) ?? parts.find((c) => !used.has(c)) ?? preferred.find(Boolean) ?? text;
    used.add(choice);
    return choice;
  };
  const withNumber = parts.find((s) => NUMBER.test(s));
  const withAction = parts.find((s) => ACTION.test(s));
  const withFiller = parts.find((s) => FILLER_ONE.test(s));
  const longest = [...parts].sort((a, b) => b.length - a.length)[0];
  const evidenceQuote = pick(withNumber, withAction);
  const fillerQuote = pick(withFiller, parts.at(-1));
  const firstQuote = pick(parts[0]);
  const depthQuote = pick(longest);

  const structure = clamp(1 + (parts.length >= 3 ? 1.5 : parts.length >= 2 ? 0.5 : 0) + (SEQUENCE.test(text) ? 1.5 : 0) + (words > 50 ? 1 : 0));
  const depth = clamp(words >= 70 ? 4.5 : words >= 45 ? 3.5 : words >= 25 ? 2.5 : 1.5);
  const evidence = clamp(withNumber && withAction ? 5 : withNumber || withAction ? 3.5 : 1.5);
  const communication = clamp(5 - fillers * 0.8 - (words < 20 ? 1 : 0));

  return [
    {
      criterion: "structure",
      score: structure,
      evidence: quote(firstQuote),
      note:
        structure >= 4
          ? "Clear order: you set it up, walked through the steps and landed on an outcome."
          : "Jumps straight in. Try: the situation, what you did step by step, and how it ended.",
    },
    {
      criterion: "depth",
      score: depth,
      evidence: quote(depthQuote),
      note: depth >= 4 ? "Enough detail to show you've really done this." : "Stays at the surface. Add the how and the why behind one step.",
    },
    {
      criterion: "evidence",
      score: evidence,
      evidence: quote(evidenceQuote),
      note:
        evidence >= 4
          ? "Backed by something real: your own action and a number."
          : "No specific example or result. Add one real moment, ideally with a number.",
    },
    {
      criterion: "communication",
      score: communication,
      evidence: quote(fillerQuote),
      note: communication >= 4 ? "Easy to follow, with few filler words." : "Filler words and short fragments make this harder to follow.",
    },
  ];
}

const LABEL: Record<RubricCriterion, string> = {
  structure: "clear structure",
  depth: "depth",
  evidence: "specific examples",
  communication: "clear delivery",
};

const WEAKNESS: Record<RubricCriterion, Omit<Weakness, "id" | "roadmapTopic">> = {
  evidence: {
    title: "Back answers with a real example",
    why: "Some answers stayed general. Interviewers trust one specific moment with a result over a list of qualities.",
    resource: { id: "x1", kind: "article", title: "The STAR method, explained", url: "https://www.themuse.com/advice/star-interview-method", publisher: "The Muse", minutes: 8 },
  },
  structure: {
    title: "Give each answer a clear shape",
    why: "Some answers jumped between points. A simple order (situation, what you did, result) makes them easy to follow.",
    resource: { id: "x2", kind: "article", title: "The STAR method, explained", url: "https://www.themuse.com/advice/star-interview-method", publisher: "The Muse", minutes: 8 },
  },
  depth: {
    title: "Go one level deeper",
    why: "Answers named the right ideas but stopped there. Explain how one step actually works.",
    resource: null,
  },
  communication: {
    title: "Cut filler words",
    why: "Words like “um” and “basically” came up often. Pausing silently sounds more confident.",
    resource: { id: "x3", kind: "article", title: "Speaking tips", url: "https://www.toastmasters.org/", publisher: "Toastmasters International", minutes: 10 },
  },
};

export function gradeInterview(questions: InterviewQuestion[], turns: InterviewTurn[], voice: boolean): InterviewReport {
  const scored: QuestionScore[] = questions.map((q) => {
    const answer = turns
      .filter((t) => t.role === "candidate" && t.questionId === q.id)
      .map((t) => t.text)
      .join(" ")
      .trim();
    if (!answer) {
      return { questionId: q.id, prompt: q.prompt, answered: false, scores: [], strength: "", improve: "You didn't get to this one." };
    }
    const scores = scoreAnswer(answer);
    const best = [...scores].sort((a, b) => b.score - a.score)[0];
    const worst = [...scores].sort((a, b) => a.score - b.score)[0];
    return { questionId: q.id, prompt: q.prompt, answered: true, scores, strength: best.note, improve: worst.note };
  });

  const all = scored.flatMap((q) => q.scores);
  const overall = all.length ? Math.round((all.reduce((n, s) => n + s.score, 0) / all.length) * 10) / 10 : 1;
  const average = (c: RubricCriterion) => {
    const list = all.filter((s) => s.criterion === c);
    return list.length ? list.reduce((n, s) => n + s.score, 0) / list.length : 5;
  };
  const ranked = (["structure", "depth", "evidence", "communication"] as RubricCriterion[]).sort((a, b) => average(a) - average(b));
  const lowest = (c: RubricCriterion) => Math.min(5, ...all.filter((s) => s.criterion === c).map((s) => s.score));
  const weak = ranked.filter((c) => average(c) < 3.5 || lowest(c) <= 2).slice(0, 3);
  const strongest = ranked[ranked.length - 1];

  return {
    overall: Math.max(1, overall),
    headline: all.length
      ? weak.length
        ? `Good ${LABEL[strongest]}. Biggest gain: ${LABEL[weak[0]]}.`
        : `Strong all round, especially ${LABEL[strongest]}.`
      : "There wasn't enough to score.",
    questions: scored,
    delivery: voice ? computeDelivery(turns) : null,
    weaknesses: weak.map((c, i) => ({ id: `w${i + 1}`, ...WEAKNESS[c], roadmapTopic: null })),
  };
}

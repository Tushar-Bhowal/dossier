import type { InterviewQuestion } from "@dossier/core/interview";

// What the scripted interviewer says. The real one (S5) is a live voice model given these questions.
export function interviewerLines(subject: string, questions: InterviewQuestion[]) {
  const n = questions.length;
  return {
    intro: `Hi, thanks for joining. This is a practice interview for ${subject}. I'll ask ${n} questions. Take a moment to think before you answer; there's no rush.`,
    ask: (i: number) => {
      const lead = i === 0 ? "Let's start." : i === n - 1 ? "Last question." : "Next question.";
      return `${lead} ${questions[i]?.prompt ?? ""}`;
    },
    followUp: "Could you give me one specific example of that, from something you actually did?",
    outro: "That's all my questions. Thank you. I'll put your report together now.",
  };
}

// The interviewer asks for an example once, when a first answer is short and has nothing concrete.
export function needsFollowUp(answer: string): boolean {
  const wordCount = answer.trim().split(/\s+/).filter(Boolean).length;
  return wordCount > 0 && wordCount < 35 && !/\d/.test(answer);
}

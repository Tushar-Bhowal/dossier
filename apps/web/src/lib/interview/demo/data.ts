import type { InterviewQuestion, InterviewSourceOption, InterviewSourceType } from "@dossier/core/interview";
import type { Roadmap, RoadmapStage } from "@dossier/core/roadmap";
import type { Persona } from "@/lib/demo/scenario";
import { seedFor } from "@/lib/roadmap/demo/data";
import { getStore as getResumeStore } from "@/lib/resume/demo/store";

export interface DemoSource {
  option: InterviewSourceOption;
  questions: InterviewQuestion[];
}

const STAGE_ORDER: RoadmapStage[] = ["concepts", "practice", "scenario", "mock"];

// One question per stage in turn, so a short interview covers basics, practice and a real situation.
export function questionsFromRoadmap(roadmap: Roadmap): InterviewQuestion[] {
  const rounds = new Map(roadmap.rounds.map((r) => [r.id, r.name]));
  const byStage = STAGE_ORDER.map((stage) =>
    roadmap.topics
      .filter((t) => t.stage === stage)
      .sort((a, b) => a.order - b.order)
      .flatMap((t) => t.questions),
  );
  const out: InterviewQuestion[] = [];
  for (let i = 0; out.length < 12 && byStage.some((s) => s.length > i); i++) {
    for (const stage of byStage) {
      const q = stage[i];
      if (q) out.push({ id: `iq${out.length + 1}`, prompt: q.prompt, round: q.round_id ? (rounds.get(q.round_id) ?? null) : null, from: null });
    }
  }
  return out;
}

const KITS: Record<Persona, { id: string; label: string; questions: [string, string | null][] }> = {
  engineer: {
    id: "kit-stripe",
    label: "Software engineer at Stripe",
    questions: [
      ["Tell me about a time you made a system faster. How did you know it worked?", "Technical"],
      ["How would you design an API that charges a card exactly once, even if the request is retried?", "System design"],
      ["Describe a disagreement with a teammate about a technical decision.", "Behavioural"],
      ["Why Stripe, and which of our products have you used?", "Company fit"],
      ["Walk me through how you review someone else's pull request.", "Technical"],
    ],
  },
  teacher: {
    id: "kit-ryan",
    label: "Class teacher at Ryan International School",
    questions: [
      ["How do you keep parents informed about their child's progress?", "Parents"],
      ["Describe a lesson where you used technology well.", "Teaching"],
      ["How do you handle bullying in your class?", "Behaviour"],
      ["What would you do in your first week with a new class?", "Teaching"],
      ["Why do you want to join Ryan International?", "Fit"],
    ],
  },
};

// The drill reads the user's first resume in Resume Studio (its demo store here), preferring lines
// with a number in them, since those make the best "walk me through it" questions.
export function resumeForDrill(): { id: string; label: string; bullets: string[] } | null {
  const resume = [...getResumeStore().resumes.values()][0];
  if (!resume) return null;
  const bullets = resume.sections.flatMap((section) =>
    "items" in section && (section.kind === "experience" || section.kind === "projects")
      ? section.items.flatMap((item) => item.bullets.map((b) => b.text))
      : [],
  );
  const ranked = [...bullets.filter((b) => /\d/.test(b)), ...bullets.filter((b) => !/\d/.test(b))].slice(0, 3);
  return ranked.length ? { id: resume.id, label: resume.title, bullets: ranked } : null;
}

// "Drill me on my resume": each question asks about one line, so answers rest on real experience.
function resumeQuestions(bullets: string[]): InterviewQuestion[] {
  return bullets.flatMap((bullet, i) => [
    { id: `iq${i * 2 + 1}`, prompt: `Your resume says: "${bullet}." Walk me through how you did it.`, round: "Your experience", from: bullet },
    { id: `iq${i * 2 + 2}`, prompt: "What would you do differently if you did it again?", round: "Your experience", from: bullet },
  ]);
}

export function sourcesFor(persona: Persona, empty: boolean): DemoSource[] {
  if (empty) return [];
  const roadmaps = seedFor(persona).map((seed): DemoSource => {
    const questions = questionsFromRoadmap(seed.roadmap);
    return {
      option: {
        type: "roadmap",
        id: seed.id,
        label: seed.request.company ? `${seed.request.subject} at ${seed.request.company}` : seed.request.subject,
        detail: "Roadmap",
        questionCount: questions.length,
      },
      questions,
    };
  });
  const kit = KITS[persona];
  const resume = resumeForDrill();
  return [
    ...roadmaps,
    {
      option: { type: "kit", id: kit.id, label: kit.label, detail: "Interview kit", questionCount: kit.questions.length },
      questions: kit.questions.map(([prompt, round], i) => ({ id: `iq${i + 1}`, prompt, round, from: null })),
    },
    ...(resume
      ? [
          {
            option: { type: "resume" as const, id: resume.id, label: resume.label, detail: "Questions about your own resume", questionCount: resume.bullets.length * 2 },
            questions: resumeQuestions(resume.bullets),
          },
        ]
      : []),
  ];
}

export function findSource(persona: Persona, type: InterviewSourceType, id: string): DemoSource | undefined {
  return sourcesFor(persona, false).find((s) => s.option.type === type && s.option.id === id);
}

// Sample answers, deliberately mixed in quality so reports show real strengths and gaps.
const MATCHED: Record<string, string> = {
  "What happens between typing a URL and seeing the page?":
    "First the browser looks up the domain with DNS and opens a connection, with TLS for https. Then it sends the request and starts parsing the HTML into the DOM as it streams in. CSS becomes the CSSOM, and together they make the render tree. After that it does layout, paint and compositing. On our checkout page a blocking script in the head was delaying first paint by about 800 milliseconds, so we moved it to defer.",
  "Find the first character in a string that doesn't repeat.":
    "So I'd um, basically count every character first. I'd use a map. Then go through the string again and return the first one with count one. That's linear time.",
  "Design the frontend for a checkout page with cards, UPI and net banking.":
    "I'd split it into a method picker and one component per method. Card details never touch our code, they go in the provider's hosted fields. The Pay button disables after one click and we send an idempotency key, so a double tap can't charge twice. Then loading, failure and retry states, and on mobile the UPI intent opens the app directly.",
  "What does NEP 2020 change for primary classes?":
    "The biggest change is the focus on foundational literacy and numeracy by Class 3. In my class that meant 20 minutes of reading every morning. It also asks for activity-based learning and continuous assessment instead of one big exam, so I use short weekly checks.",
  "Plan a demo lesson on 'Living and non-living things' for Class 2.":
    "Um, I would start with, you know, a bag of objects, like a leaf, a stone, a toy car. The children sort them. Then I explain. Basically that's it, and then a worksheet.",
  "A parent says their child was marked unfairly. How do you respond?":
    "First I would listen to the parent fully without interrupting. Then I'd show them the answer sheet and the marking scheme, and explain where marks were lost. Last year a parent came in about a maths test; after we went through it together she agreed, and we planned extra practice for two weeks. I'd also tell the coordinator so they're aware.",
};

const POOL: Record<Persona, string[]> = {
  engineer: [
    "In my last team our dashboard took 6 seconds to load. I profiled it, found three API calls running one after another, and made them run in parallel. Load time dropped to 2.1 seconds, and I added a performance budget in CI so it couldn't creep back.",
    "I think it depends. Um, you'd want it to be reliable, and basically scalable. I'd probably use a queue.",
    "We disagreed about adopting a state library. I wrote down both options with the trade-offs, we tried each on one screen for a week, and the team picked the simpler one. I was on the losing side, and that was fine.",
  ],
  teacher: [
    "Every month I send a short note home with one thing the child did well and one thing to practise. For children who are struggling I call the parents, and we agree one small goal. Last term this helped a boy move from reading single words to short sentences.",
    "I would, um, talk to the children. Basically tell them it's not okay. And inform the parents.",
    "In my first week I learn every child's name, set up three routines with them, and do a quick reading and maths check so I know where each child is. By Friday I have groups for the next month.",
  ],
};

export function sampleAnswer(persona: Persona, prompt: string, index: number): string {
  return MATCHED[prompt] ?? POOL[persona][index % POOL[persona].length];
}

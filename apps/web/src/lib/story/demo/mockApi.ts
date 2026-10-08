import { StoryInput, type ExtractStoriesResult, type Story } from "@dossier/core/resume";
import { ApiError } from "@/lib/api";
import { READ_DELAY_MS, sleep, type Persona } from "@/lib/demo/scenario";
import { aiDelayMs, getScenario } from "@/lib/resume/demo/scenario";
import { getStore as getResumeStore } from "@/lib/resume/demo/store";

const ago = (days: number) => new Date(Date.now() - days * 864e5).toISOString();

const SEEDS: Record<Persona, Omit<Story, "id" | "updatedAt">[]> = {
  engineer: [
    {
      title: "Making the loan-status API fast enough for the app",
      situation: "Our mobile app showed a spinner for almost a second every time someone checked their loan status, and support tickets about it kept coming.",
      task: "I owned the loan-status API and had a sprint to bring it under 400 ms at p95 without changing the app.",
      action: "I profiled the slowest requests and found the same three database lookups on every call. I added Redis caching for those with a short expiry, plus invalidation when a loan changed, and load-tested before release.",
      result: "p95 latency fell from 900 ms to 350 ms, and the 'app is slow' tickets stopped within two weeks.",
      skills: ["Performance", "Redis", "Ownership"],
      fromBullet: "Reduced p95 latency of the loan-status API from 900 ms to 350 ms by adding Redis caching",
      origin: "edited",
    },
    {
      title: "Getting the team to trust our tests",
      situation: "",
      task: "",
      action: "Wrote integration tests with pytest, raising coverage from 55% to 80%",
      result: "Coverage went from 55% to 80%.",
      skills: ["Testing"],
      fromBullet: "Wrote integration tests with pytest, raising coverage from 55% to 80%",
      origin: "generated",
    },
  ],
  teacher: [
    {
      title: "Helping a struggling group pass Class 8 maths",
      situation: "Almost a third of my Class 8 section was failing algebra unit tests, eight weeks before the half-yearly exam.",
      task: "Get that group ready without slowing down the rest of the class.",
      action: "I gave a quick diagnostic test, split the class into three groups, ran 15-minute warm-ups on the basics every morning, and posted practice sheets with worked answers on Google Classroom.",
      result: "The section's pass rate rose from 68% to 90% in the half-yearly, and two of the weakest students scored above 60%.",
      skills: ["Differentiated teaching", "Assessment", "Google Classroom"],
      fromBullet: "Teaches Mathematics and Science to classes 6 to 8",
      origin: "edited",
    },
    {
      title: "Bringing back the school science fair",
      situation: "Our school hadn't held a science fair for three years and students had no place to show project work.",
      task: "The principal asked me to organise one in six weeks.",
      action: "I formed a team of four teachers, gave each class a theme, ran two after-school sessions a week for projects, and invited parents.",
      result: "42 projects were shown to about 300 visitors, and it's now on the school calendar every year.",
      skills: ["Organising", "Teamwork"],
      fromBullet: null,
      origin: "manual",
    },
  ],
};

let store: { key: string; stories: Story[] } | null = null;
let counter = 0;
const clone = <T,>(v: T): T => structuredClone(v);

function getStore() {
  const { persona, empty } = getScenario();
  const key = `${persona}:${empty}`;
  if (store?.key !== key) {
    store = {
      key,
      stories: empty ? [] : SEEDS[persona].map((s, i) => ({ ...s, id: `st-${persona}-${i + 1}`, updatedAt: ago(i + 2) })),
    };
  }
  return store;
}

function resumeLines(): string[] {
  const resume = [...getResumeStore().resumes.values()][0];
  if (!resume) return [];
  return resume.sections.flatMap((section) =>
    "items" in section && (section.kind === "experience" || section.kind === "projects")
      ? section.items.flatMap((item) => item.bullets.map((b) => b.text))
      : [],
  );
}

// A line makes a story when it describes a change or result, or something the person drove themselves.
const RESULT = /\bfrom\b.+\bto\b|%|\b(raised|reduced|improved|increased|cut|grew|saved|won)\b/i;
const ACHIEVEMENT = /^(built|led|launched|designed|organised|organized|helped organise|helped organize|started|introduced|created|ran)\b/i;

export const mockApi = {
  async listStories(): Promise<Story[]> {
    await sleep(READ_DELAY_MS);
    return clone(getStore().stories).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },

  // Only what the line says goes in; the rest is left blank for the user, never invented.
  async extractStories(): Promise<ExtractStoriesResult> {
    await sleep(aiDelayMs());
    const { fail } = getScenario();
    if (fail === "ai_down") throw new ApiError(503, "llm_unavailable", "Our AI service isn't responding right now.");
    if (fail === "quota") throw new ApiError(429, "quota_exceeded", "You've used today's free AI requests.");
    const lines = resumeLines();
    if (!lines.length) throw new ApiError(404, "no_resume", "Make a resume first, then we can find stories in it.");
    const s = getStore();
    const known = new Set(s.stories.map((x) => x.fromBullet));
    const added: Story[] = [];
    const skipped: string[] = [];
    for (const line of lines) {
      if (known.has(line)) continue;
      if (!(RESULT.test(line) || ACHIEVEMENT.test(line)) || line.split(/\s+/).length < 5) {
        skipped.push(line);
        continue;
      }
      counter += 1;
      const did = ACHIEVEMENT.test(line);
      const change = line.match(/\bfrom\b.+$/i)?.[0];
      const result = change ? `Went ${change}` : RESULT.test(line) && !did ? line : "";
      added.push({
        id: `st-new-${counter}`,
        title: line.length > 70 ? `${line.slice(0, 67).trimEnd()}…` : line,
        situation: "",
        task: "",
        action: did ? line : "",
        result,
        skills: [],
        fromBullet: line,
        origin: "generated",
        updatedAt: new Date().toISOString(),
      });
    }
    s.stories = [...added, ...s.stories];
    return { added: clone(added), skipped };
  },

  async saveStory(id: string, input: StoryInput): Promise<Story> {
    const parsed = StoryInput.safeParse(input);
    if (!parsed.success) throw new ApiError(400, "validation_error", parsed.error.issues[0]?.message ?? "Check the story");
    await sleep(READ_DELAY_MS);
    const s = getStore();
    const current = s.stories.find((x) => x.id === id);
    if (!current) throw new ApiError(404, "not_found", "story not found");
    const next: Story = { ...current, ...parsed.data, origin: current.origin === "manual" ? "manual" : "edited", updatedAt: new Date().toISOString() };
    s.stories = s.stories.map((x) => (x.id === id ? next : x));
    return clone(next);
  },

  async createStory(input: StoryInput): Promise<Story> {
    const parsed = StoryInput.safeParse(input);
    if (!parsed.success) throw new ApiError(400, "validation_error", parsed.error.issues[0]?.message ?? "Check the story");
    await sleep(READ_DELAY_MS);
    counter += 1;
    const story: Story = { ...parsed.data, id: `st-new-${counter}`, fromBullet: null, origin: "manual", updatedAt: new Date().toISOString() };
    getStore().stories = [story, ...getStore().stories];
    return clone(story);
  },

  async deleteStory(id: string): Promise<void> {
    await sleep(READ_DELAY_MS);
    const s = getStore();
    s.stories = s.stories.filter((x) => x.id !== id);
  },

  async restoreStory(story: Story): Promise<void> {
    await sleep(READ_DELAY_MS);
    getStore().stories = [story, ...getStore().stories.filter((x) => x.id !== story.id)];
  },
};

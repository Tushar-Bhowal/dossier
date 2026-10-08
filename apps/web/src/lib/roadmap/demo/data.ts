import type {
  CreateRoadmapRequest,
  InterviewRound,
  Roadmap,
  RoadmapSource,
  RoadmapStage,
  RoadmapTopic,
  SourceConfidence,
} from "@dossier/core/roadmap";
import type { Persona } from "@/lib/demo/scenario";

type Q = [prompt: string, outline: string, round: string | null, difficulty: 1 | 2 | 3];
type C = [front: string, back: string];
type X = [kind: "video" | "article", title: string, url: string, publisher: string, minutes: number | null];

interface TopicSpec {
  stage: RoadmapStage;
  title: string;
  needs?: number[];
  explanation: string;
  questions?: Q[];
  cards?: C[];
  resources?: X[];
}

interface RoadmapSpec {
  kind: Roadmap["kind"];
  subject: string;
  company: string | null;
  domain: string;
  confidence: SourceConfidence;
  sources: Omit<RoadmapSource, "id">[];
  rounds: [name: string, tests: string, sources: number[]][];
  topics: TopicSpec[];
}

// Ids are minted here so specs stay readable: topics t1.., questions q1.., cards f1.., links x1..
export function buildRoadmap(spec: RoadmapSpec): Roadmap {
  let q = 0;
  let f = 0;
  let x = 0;
  const rounds: InterviewRound[] = spec.rounds.map(([name, tests, sources], i) => ({
    id: `rd${i + 1}`,
    name,
    what_it_tests: tests,
    source_ids: sources.map((n) => `s${n}`),
  }));
  const topics: RoadmapTopic[] = spec.topics.map((t, i) => ({
    id: `t${i + 1}`,
    title: t.title,
    stage: t.stage,
    prerequisite_ids: (t.needs ?? []).map((n) => `t${n}`),
    explanation: t.explanation,
    questions: (t.questions ?? []).map(([prompt, outline, round, difficulty]) => {
      q += 1;
      return { id: `q${q}`, prompt, answer_outline: outline, round_id: round, difficulty, origin: "generated", pinned: false, order: q };
    }),
    flashcards: (t.cards ?? []).map(([front, back]) => {
      f += 1;
      return { id: `f${f}`, front, back, origin: "generated", pinned: false, order: f };
    }),
    resources: (t.resources ?? []).map(([kind, title, url, publisher, minutes]) => {
      x += 1;
      return { id: `x${x}`, kind, title, url, publisher, minutes };
    }),
    origin: "generated",
    pinned: false,
    order: i,
  }));
  return {
    kind: spec.kind,
    subject: spec.subject,
    company: spec.company,
    domain: spec.domain,
    rounds,
    topics,
    sources: spec.sources.map((s, i) => ({ ...s, id: `s${i + 1}` })),
    confidence: spec.confidence,
  };
}

const FRONTEND: RoadmapSpec = {
  kind: "role",
  subject: "Frontend engineer",
  company: "Razorpay",
  domain: "Software engineering",
  confidence: "high",
  sources: [
    { title: "Razorpay careers: engineering roles", url: "https://razorpay.com/jobs/", kind: "official" },
    { title: "Frontend interview at Razorpay, 2025 (candidate report)", url: "https://leetcode.com/discuss/interview-experience/", kind: "candidate" },
    { title: "Machine coding rounds at Indian product companies (candidate reports)", url: "https://www.geeksforgeeks.org/", kind: "candidate" },
  ],
  rounds: [
    ["Online coding test", "Two or three timed problems on arrays, strings and hash maps, usually on HackerRank.", [2, 3]],
    ["JavaScript and React deep dive", "How JavaScript really works (closures, the event loop) and how React renders.", [2, 3]],
    ["Machine coding round", "Build a small working UI in 60–90 minutes, like a search box or checkout form, with clean code.", [3]],
    ["Hiring manager round", "Past projects, ownership, and how you handle disagreements and deadlines.", [1, 2]],
  ],
  topics: [
    {
      stage: "concepts",
      title: "How the browser turns code into pixels",
      explanation:
        "When a page loads, the browser builds two trees: the DOM from your HTML and the CSSOM from your CSS. It combines them into a render tree, works out where everything goes (layout), paints it, and composites the layers. JavaScript can pause this whenever it runs, which is why scripts in the head slow the first paint. Interviewers use this to see whether you can reason about performance instead of guessing.",
      questions: [
        ["What happens between typing a URL and seeing the page?", "DNS lookup → connection (TCP, TLS) → HTTP request → HTML parsed into the DOM, CSS into the CSSOM → render tree → layout → paint → composite. Say that JavaScript can block parsing unless it's deferred.", "rd2", 2],
        ["What causes a layout shift, and how do you avoid it?", "Content changing size after first paint: images without dimensions, late-loading fonts, injected banners. Fix with width/height or aspect-ratio, font-display, and reserved space.", "rd2", 2],
      ],
      cards: [
        ["What is the critical rendering path?", "The steps from HTML, CSS and JS to pixels: DOM, CSSOM, render tree, layout, paint."],
        ["Why does a script in the head slow the first paint?", "It blocks HTML parsing until it downloads and runs, unless it's marked defer or async."],
      ],
      resources: [
        ["article", "Critical rendering path", "https://developer.mozilla.org/en-US/docs/Web/Performance/Critical_rendering_path", "MDN", 12],
        ["article", "How browsers work", "https://developer.mozilla.org/en-US/docs/Web/Performance/How_browsers_work", "MDN", 15],
      ],
    },
    {
      stage: "concepts",
      title: "Closures, scope and the event loop",
      explanation:
        "A closure is a function that remembers the variables from the place it was created. The event loop decides what runs next: all synchronous code first, then every queued promise callback (microtasks), then the next timer or event (tasks). Most 'what does this log?' questions test exactly this order.",
      questions: [
        ["Explain a closure with an example you'd use at work.", "A function that keeps access to variables from where it was made. Example: a debounce helper that keeps its timer id between calls. Mention that closures keep those variables in memory.", "rd2", 2],
        ["In what order do these run: setTimeout(0), a resolved promise's then, and a console.log?", "The plain log first, then the promise callback (a microtask), then the timeout (a task). Microtasks all run before the next task.", "rd2", 3],
      ],
      cards: [
        ["What is a closure?", "A function plus the variables it captured from the scope where it was created."],
        ["Microtask or task: which runs first?", "Microtasks (promise callbacks) run before the next task (timers, events)."],
      ],
      resources: [
        ["video", "What the heck is the event loop anyway? (Philip Roberts, JSConf EU)", "https://www.youtube.com/watch?v=8aGhZQkoFbQ", "JSConf", 27],
        ["article", "Closures", "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Closures", "MDN", 10],
      ],
    },
    {
      stage: "concepts",
      title: "How React renders and updates",
      needs: [2],
      explanation:
        "React re-runs a component when its state changes, when its parent re-renders, or when a context it reads changes. It then compares the new output with the old and updates only what changed in the page. Keys tell React which list item is which between renders. Knowing this lets you explain slow screens and odd bugs with inputs.",
      questions: [
        ["What triggers a re-render, and how do you stop needless ones?", "State or props change, parent re-render, context change. Fix with memo, stable callbacks, splitting state and good keys, but measure with the Profiler first.", "rd2", 2],
        ["Why do lists need keys?", "Keys let React match items between renders. Index keys break when items are reordered, so typed text ends up in the wrong row.", "rd2", 1],
      ],
      cards: [
        ["When does a component re-render?", "When its state changes, its parent re-renders, or a context it reads changes."],
        ["What does a key do in a list?", "Tells React which item is which between renders, so state stays with the right item."],
      ],
      resources: [
        ["article", "Render and commit", "https://react.dev/learn/render-and-commit", "react.dev", 8],
        ["article", "Preserving and resetting state", "https://react.dev/learn/preserving-and-resetting-state", "react.dev", 12],
      ],
    },
    {
      stage: "practice",
      title: "Array, string and hash map problems",
      explanation:
        "The online test is mostly short problems where a hash map turns a slow double loop into one pass. Practise saying the time and space cost out loud and checking edge cases (empty input, duplicates, no answer) before you code.",
      questions: [
        ["Find the first character in a string that doesn't repeat.", "Count characters with a Map in one pass, then scan again for a count of 1. O(n) time. Mention the empty string and all-repeating cases.", "rd1", 1],
        ["Return the two numbers in an array that add up to a target.", "One pass with a Map of value → index; for each x, look up target − x. O(n). Discuss duplicates and the no-answer case.", "rd1", 2],
        ["Group words that are anagrams of each other.", "Key each word by its sorted letters (or a 26-letter count) in a Map of arrays. O(n·k log k).", "rd1", 2],
      ],
      cards: [
        ["Two-sum in one pass?", "Keep seen values in a Map; for each x, look up target − x."],
        ["A good key for grouping anagrams?", "The word's letters sorted, or a count of each letter."],
      ],
      resources: [["article", "Two Sum", "https://leetcode.com/problems/two-sum/", "LeetCode", null]],
    },
    {
      stage: "practice",
      title: "Build a debounced search box",
      needs: [2, 3],
      explanation:
        "A classic machine-coding task: a search input that waits until the user stops typing, then calls an API. What they look for is less the debounce itself and more the details: cancelling old requests, loading and empty states, and keyboard support.",
      questions: [
        ["Build a search input that calls an API 300 ms after the user stops typing.", "Debounce with a timer kept in a ref; cancel stale requests with AbortController so old results can't overwrite new ones; show loading, empty and error states; make it keyboard friendly.", "rd3", 2],
        ["How would you make repeat searches instant?", "Cache results in a Map keyed by the query (or use TanStack Query), cap its size, and expire entries after a while.", "rd3", 2],
      ],
      cards: [
        ["Debounce or throttle?", "Debounce waits until calls stop; throttle runs at most once per interval."],
        ["Why use AbortController in a search box?", "To cancel stale requests so an old response can't replace a newer one."],
      ],
      resources: [["article", "AbortController", "https://developer.mozilla.org/en-US/docs/Web/API/AbortController", "MDN", 6]],
    },
    {
      stage: "practice",
      title: "Accessibility basics they check",
      needs: [1],
      explanation:
        "Payments products must work for everyone, so reviewers check that your UI works with a keyboard and a screen reader. Use real buttons, labels and native elements first; reach for ARIA only when there's no native option.",
      questions: [["How do you make a custom dropdown accessible?", "Prefer a native select. Otherwise: a button with aria-expanded, listbox roles, arrow keys, Escape to close, focus back on the button, and a visible focus ring.", "rd3", 2]],
      cards: [["The first rule of ARIA?", "If a native HTML element does the job, use it instead of adding ARIA."]],
      resources: [["article", "ARIA", "https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA", "MDN", 15]],
    },
    {
      stage: "scenario",
      title: "Design a payment checkout page",
      needs: [3, 5],
      explanation:
        "A scenario you're likely to get at a payments company. Talk through the parts (method picker, forms, validation), what must never happen (storing card numbers, charging twice), and every state: loading, failure, retry and success.",
      questions: [
        ["Design the frontend for a checkout page with cards, UPI and net banking.", "A component per method; form state and validation; never touch raw card data (hosted fields); loading, failure and retry; protection against double submits; mobile first.", "rd3", 3],
        ["The payment went through but the page shows an error. What do you check?", "The network tab for the callback, the idempotency key, a race between redirect and webhook, and polling the order status as the source of truth.", "rd4", 3],
      ],
      cards: [["Why disable Pay after one click?", "To stop double charges from double submits; pair it with an idempotency key on the server."]],
      resources: [["article", "Payments documentation", "https://razorpay.com/docs/payments/", "Razorpay", 10]],
    },
    {
      stage: "scenario",
      title: "Find and fix a slow React list",
      needs: [3],
      explanation:
        "They'll describe a screen that stutters and watch how you investigate. Measure before changing anything, then fix the biggest cost first: usually rendering thousands of rows at once.",
      questions: [["A list of 5,000 transactions scrolls badly. Walk me through fixing it.", "Measure first (React Profiler, Performance tab); virtualise the list; memoise rows; avoid new objects in props; paginate on the server.", "rd2", 3]],
      cards: [["What is list virtualisation?", "Rendering only the rows on screen, so 5,000 items cost about as much as 20."]],
      resources: [["article", "Profiler", "https://react.dev/reference/react/Profiler", "react.dev", 9]],
    },
    {
      stage: "mock",
      title: "Mock: JavaScript and React round",
      needs: [2, 3],
      explanation: "A practice run of the deep-dive round. Answer out loud, as if the interviewer were in front of you, then compare with the outlines.",
      questions: [
        ["Tell me about a bug you fixed that was caused by stale state.", "Situation, what you saw, how you narrowed it down, the fix (functional updates or refs), and what you changed afterwards.", "rd2", 2],
        ["Explain useMemo and useCallback to a junior developer.", "useMemo keeps a value, useCallback keeps a function; both only help when something depends on staying the same between renders.", "rd2", 2],
      ],
    },
    {
      stage: "mock",
      title: "Mock: hiring manager round",
      explanation: "A practice run of the last round. Keep each answer to about two minutes and end with what you learned.",
      questions: [
        ["Tell me about a project you owned end to end.", "Pick one with a result you can measure; your part versus the team's; one hard decision; what you'd do differently.", "rd4", 2],
        ["Why Razorpay, and why now?", "Link payments to something you've built or used; be specific about their products, not generic praise.", "rd4", 1],
      ],
    },
  ],
};

const TYPESCRIPT: RoadmapSpec = {
  kind: "skill",
  subject: "TypeScript",
  company: null,
  domain: "Software engineering",
  confidence: "high",
  sources: [
    { title: "The TypeScript Handbook", url: "https://www.typescriptlang.org/docs/handbook/intro.html", kind: "guide" },
    { title: "Total TypeScript: free tutorials", url: "https://www.totaltypescript.com/tutorials", kind: "guide" },
  ],
  rounds: [
    ["Basics questions", "Types, interfaces, unions and how TypeScript checks code.", [1]],
    ["Hands-on task", "Typing real code: API responses, React props and helper functions.", [1, 2]],
  ],
  topics: [
    {
      stage: "concepts",
      title: "Types, interfaces and unions",
      explanation: "TypeScript describes the shape of your data so mistakes show up while you type, not in production. Most code needs just a few tools: object types, unions of literal values, and optional fields.",
      questions: [["When would you use a union type instead of an enum?", "String-literal unions are simpler and need no runtime object; use an enum only when you need the values at runtime.", "rd1", 1]],
      cards: [["Interface or type alias?", "Mostly interchangeable; interfaces can be extended by re-declaring, type aliases can name unions."]],
      resources: [["article", "Everyday types", "https://www.typescriptlang.org/docs/handbook/2/everyday-types.html", "TypeScript Handbook", 20]],
    },
    {
      stage: "concepts",
      title: "Narrowing and type guards",
      needs: [1],
      explanation: "Inside an if, TypeScript narrows a broad type to a specific one based on your check. Discriminated unions, where every member shares a field like kind, make this reliable.",
      questions: [["How does TypeScript know a value is a string inside an if?", "Narrowing: typeof, instanceof, in, equality checks and custom guards (x is T) refine the type in that branch.", "rd1", 2]],
      cards: [["What is a discriminated union?", "A union where every member has a shared literal field (like kind) you can switch on."]],
      resources: [["article", "Narrowing", "https://www.typescriptlang.org/docs/handbook/2/narrowing.html", "TypeScript Handbook", 18]],
    },
    {
      stage: "practice",
      title: "Generics in everyday code",
      needs: [1],
      explanation: "Generics let one function work with many types while keeping the exact type. You use them every day through arrays and promises; writing your own is the next step.",
      questions: [["Type a function that returns the first item of any array.", "function first<T>(items: T[]): T | undefined. The generic keeps the item's type.", "rd2", 2]],
      cards: [["What does a generic do?", "Lets a function or type work with many types while keeping the exact type."]],
      resources: [["article", "Generics", "https://www.typescriptlang.org/docs/handbook/2/generics.html", "TypeScript Handbook", 15]],
    },
    {
      stage: "scenario",
      title: "Type an API response safely",
      needs: [2, 3],
      explanation: "Types disappear when the code runs, so data from an API is unchecked. Validate it where it enters your app and let the type come from that check.",
      questions: [["Data from fetch is typed as any. How do you make it safe?", "Validate at the boundary (for example a Zod schema and parse), infer the type from the schema, and handle the failure case.", "rd2", 3]],
      cards: [["Why validate API data at runtime?", "Types vanish at runtime; only a check like a Zod parse proves the shape."]],
      resources: [["article", "Zod documentation", "https://zod.dev/", "zod.dev", 10]],
    },
  ],
};

const TEACHER: RoadmapSpec = {
  kind: "role",
  subject: "Primary school teacher",
  company: "Delhi Public School",
  domain: "Education",
  confidence: "medium",
  sources: [
    { title: "Ministry of Education: National Education Policy 2020", url: "https://www.education.gov.in/", kind: "official" },
    { title: "Primary teacher interviews at CBSE schools (candidate reports)", url: "https://www.quora.com/", kind: "candidate" },
    { title: "CBSE teacher training resources", url: "https://cbseacademic.nic.in/", kind: "guide" },
  ],
  rounds: [
    ["Written test", "Subject knowledge for your classes, child development basics and English.", [2]],
    ["Demo lesson", "A 15–20 minute lesson with a class or the panel: planning, keeping children engaged, and checking they understood.", [2, 3]],
    ["Panel interview", "The principal and a coordinator ask about your teaching style, discipline and working with parents.", [2]],
  ],
  topics: [
    {
      stage: "concepts",
      title: "Child-centred teaching and NEP 2020",
      explanation:
        "Schools now expect teaching that follows the National Education Policy 2020: reading and maths foundations first, learning through play and activity in the early years, and checking progress all year instead of one big exam. Panels often ask what this means in your own classroom, so have one concrete example ready.",
      questions: [
        ["What does NEP 2020 change for primary classes?", "Foundational literacy and numeracy first; play- and activity-based learning in the early years; the mother tongue where possible; less rote learning; continuous assessment.", "rd3", 2],
        ["What does 'child-centred' look like in your classroom?", "Children talk and do more than you; they get choices; you start from what they already know; examples come from their lives.", "rd3", 1],
      ],
      cards: [
        ["What is FLN?", "Foundational Literacy and Numeracy: every child reading with meaning and doing basic maths by Class 3."],
        ["In NEP's 5+3+3+4, what is the first 5?", "The foundational stage: three years of pre-school plus Classes 1 and 2."],
      ],
      resources: [["article", "National Education Policy 2020", "https://www.education.gov.in/", "Ministry of Education", 30]],
    },
    {
      stage: "concepts",
      title: "Lesson planning with the 5E model",
      explanation:
        "The 5E model gives every lesson the same simple shape: Engage (a question or object that sparks interest), Explore (children try something), Explain (you name what they found), Elaborate (they use it in a new way) and Evaluate (a quick check). Using it in your demo shows the panel you plan on purpose.",
      questions: [["Walk us through how you plan a lesson.", "A clear learning goal, then engage → explore → explain → elaborate → evaluate, with timings and materials written down.", "rd2", 2]],
      cards: [["The 5Es, in order?", "Engage, Explore, Explain, Elaborate, Evaluate."]],
      resources: [["article", "Lesson planning ideas for primary teachers", "https://www.edutopia.org/", "Edutopia", 10]],
    },
    {
      stage: "concepts",
      title: "Checking understanding during a lesson",
      explanation:
        "Good teachers check every few minutes whether children are following, not just at the end. Quick signals (thumbs up, mini whiteboards, one-question exit tickets) tell you when to slow down.",
      questions: [["How do you know the class has understood?", "Short checks every few minutes: thumbs up, mini whiteboards, exit tickets, asking a quiet child; change pace if many are stuck.", "rd2", 1]],
      cards: [["What is an exit ticket?", "A one-question check at the end of a lesson that shows who understood."]],
    },
    {
      stage: "practice",
      title: "Plan a 20-minute demo lesson",
      needs: [2, 3],
      explanation: "Rehearse one demo lesson until you can run it calmly with any class. Keep the hook short, get children doing something within five minutes, and end with a quick check.",
      questions: [
        ["Plan a demo lesson on 'Living and non-living things' for Class 2.", "Hook with real objects in a bag; children sort them in pairs; each pair explains one choice; you name the features (grows, breathes, needs food); quick check with picture cards.", "rd2", 2],
        ["Your demo class is noisier than expected. What do you do?", "Stay calm; use the attention signal you set at the start; give a short task with a timer; praise the group that's ready.", "rd2", 2],
      ],
      cards: [["How long should a demo hook be?", "About two minutes: enough to spark interest without eating the lesson."]],
    },
    {
      stage: "practice",
      title: "Classroom routines and behaviour",
      explanation: "Panels want to hear calm, specific routines rather than strictness. Have two or three you actually use, and one story of a child whose behaviour improved.",
      questions: [["How do you handle a child who keeps disrupting the class?", "Find the reason first; a quiet word, not a public one; a clear routine and consequence; involve the parent if it continues; note what works.", "rd3", 2]],
      cards: [["Positive behaviour management in one line?", "Notice and name the behaviour you want more often than the behaviour you don't."]],
    },
    {
      stage: "practice",
      title: "Answering 'Why teaching?' well",
      explanation: "Almost every panel asks this. A real moment beats a general statement, and a line about this particular school shows you prepared.",
      questions: [["Why do you want to teach at our school?", "A real moment that made you choose teaching; something specific about this school; what you'd bring (for example storytelling or art).", "rd3", 1]],
    },
    {
      stage: "scenario",
      title: "A parent is unhappy about marks",
      needs: [5],
      explanation: "Scenario questions test whether you stay calm and fair. Show that you listen first, explain with evidence, and agree a next step.",
      questions: [["A parent says their child was marked unfairly. How do you respond?", "Listen fully; show the work and the marking criteria; explain calmly; agree a next step (extra practice, a review in two weeks); tell the coordinator if needed.", "rd3", 2]],
      cards: [["First step with an upset parent?", "Listen without interrupting, then sum up what you heard."]],
    },
    {
      stage: "scenario",
      title: "A child who won't take part",
      explanation: "There's no single right answer here. The panel wants to see patience and a few different things you'd try.",
      questions: [["A shy child never answers in class. What do you try?", "Pair work first; let them answer in writing or by pointing; give them a small job; talk with them alone; involve the parents gently.", "rd3", 1]],
    },
    {
      stage: "mock",
      title: "Mock: panel interview",
      needs: [1, 5],
      explanation: "A practice run of the panel. Answer out loud in about two minutes each, then compare with the outlines.",
      questions: [
        ["Tell us about a lesson that didn't go as planned.", "A real one; what went wrong; what you changed in the moment; what you changed next time.", "rd3", 2],
        ["How would you include a child with a learning difficulty?", "Learn their needs from parents and records; break tasks into steps; use visuals; allow extra time; work with the special educator.", "rd3", 2],
      ],
    },
  ],
};

const MONTESSORI: RoadmapSpec = {
  kind: "role",
  subject: "Montessori teacher",
  company: "Little Sprouts Montessori",
  domain: "Education",
  confidence: "low",
  sources: [{ title: "Association Montessori Internationale", url: "https://montessori-ami.org/", kind: "guide" }],
  rounds: [
    ["Conversation with the director", "Your approach to young children and why Montessori.", []],
    ["Classroom observation or demo", "How you present a material and let a child work on their own.", [1]],
  ],
  topics: [
    {
      stage: "concepts",
      title: "Montessori basics: the prepared classroom",
      explanation: "In Montessori classrooms the teacher guides rather than lectures. You prepare the room so children can choose materials themselves, show each material one to one, then step back and observe.",
      questions: [["How is a Montessori teacher's role different?", "You guide rather than lecture; prepare the room; observe; show materials one to one; let the child repeat and correct themselves.", "rd1", 1]],
      cards: [["What is a prepared environment?", "A classroom set up so children can choose and use materials on their own."]],
      resources: [["article", "What is Montessori education?", "https://montessori-ami.org/", "AMI", 8]],
    },
    {
      stage: "practice",
      title: "Show a material, step by step",
      needs: [1],
      explanation: "If there's a demo, you'll likely show one material to one child. Move slowly, speak little, and let the material show the child their mistakes.",
      questions: [["Show how you'd present the pink tower to a three-year-old.", "Invite the child; carry the pieces one by one; build slowly and quietly; let the child try; don't correct, let the material show the error.", "rd2", 2]],
    },
    {
      stage: "scenario",
      title: "Two children want the same material",
      explanation: "A common real situation. Show respect for the child who is working and help the other one wait.",
      questions: [["What do you do when two children want the same material?", "Acknowledge both; show the waiting child how to ask and wait; offer another choice; never force sharing in the middle of work.", "rd2", 1]],
    },
    {
      stage: "mock",
      title: "Mock: conversation with the director",
      explanation: "A practice run of the first conversation.",
      questions: [["Why Montessori, and not a regular preschool?", "Your real reason; something you've seen children do when given independence; your training, done or planned.", "rd1", 1]],
    },
  ],
};

function inDays(days: number): string {
  return new Date(Date.now() + days * 864e5).toISOString().slice(0, 10);
}

export interface SeedRoadmap {
  id: string;
  request: CreateRoadmapRequest;
  roadmap: Roadmap;
  doneTopicIds: string[];
  ageDays: number;
}

export function seedFor(persona: Persona): SeedRoadmap[] {
  if (persona === "engineer") {
    return [
      {
        id: "rm-frontend-razorpay",
        request: { kind: "role", subject: "Frontend engineer", company: "Razorpay", interviewDate: inDays(12) },
        roadmap: buildRoadmap(FRONTEND),
        doneTopicIds: ["t1", "t2", "t4"],
        ageDays: 2,
      },
      {
        id: "rm-typescript",
        request: { kind: "skill", subject: "TypeScript", company: null, interviewDate: null },
        roadmap: buildRoadmap(TYPESCRIPT),
        doneTopicIds: ["t1"],
        ageDays: 9,
      },
    ];
  }
  return [
    {
      id: "rm-teacher-dps",
      request: { kind: "role", subject: "Primary school teacher", company: "Delhi Public School", interviewDate: inDays(9) },
      roadmap: buildRoadmap(TEACHER),
      doneTopicIds: ["t1", "t2"],
      ageDays: 1,
    },
    {
      id: "rm-montessori",
      request: { kind: "role", subject: "Montessori teacher", company: "Little Sprouts Montessori", interviewDate: null },
      roadmap: buildRoadmap(MONTESSORI),
      doneTopicIds: [],
      ageDays: 5,
    },
  ];
}

// What a brand-new roadmap looks like in the demo: honest, generic rounds for any subject.
export function genericRoadmap(req: CreateRoadmapRequest, confidence: SourceConfidence): Roadmap {
  const s = req.subject;
  const at = req.company ? ` at ${req.company}` : "";
  const role = req.kind === "role";
  return buildRoadmap({
    kind: req.kind,
    subject: s,
    company: req.company,
    domain: "General",
    confidence,
    sources: [
      { title: `How ${s} interviews usually run (careers guide)`, url: "https://www.indeed.com/career-advice", kind: "guide" },
      ...(confidence === "low" ? [] : [{ title: `${s}${at}: interview experiences (candidate reports)`, url: "https://www.reddit.com/", kind: "candidate" as const }]),
    ],
    rounds: role
      ? [
          ["Screening call", `A short call about your background and why ${s}${at}.`, [1]],
          ["Skills interview", `Questions on the core skills a ${s} uses every day.`, [1, 2]],
          ["Practical task or case", "A short task or situation to talk through, like the real work.", [2]],
          ["Final round", "Fit with the team, motivation and your questions for them.", [1]],
        ]
      : [
          ["Basics questions", `Key ideas and terms in ${s}.`, [1]],
          ["Hands-on task", `Using ${s} on a small, realistic problem.`, [1]],
        ],
    topics: [
      {
        stage: "concepts",
        title: `What ${s} involves day to day`,
        explanation: `Start with the everyday work: what a ${s} is responsible for, who they work with, and what good looks like. Interviewers check this first.`,
        questions: [[`What does a typical week look like for a ${s}?`, "Main tasks, who you work with, how success is measured; give one real example.", "rd1", 1]],
        cards: [[`One-line summary of the ${s} role?`, "Write it in your own words: what you do, for whom, and why it matters."]],
      },
      {
        stage: "concepts",
        title: `Key terms in ${s}`,
        needs: [1],
        explanation: `Learn the ten or so terms that come up in almost every ${s} conversation, and be able to explain each in one sentence.`,
        cards: [["Pick a term you'd struggle to explain.", "Write a one-sentence explanation and an example from your own work."]],
      },
      {
        stage: "practice",
        title: `Common ${s} questions`,
        needs: [2],
        explanation: "Practise answering out loud. Keep each answer under two minutes and end with a result.",
        questions: [[`Tell me about a time you used ${s} skills to solve a problem.`, "Situation, task, what you did, and the result, with a number if you can.", role ? "rd2" : "rd1", 2]],
      },
      {
        stage: "scenario",
        title: "Handle a tricky situation",
        explanation: "Interviewers often describe a realistic problem and listen to how you think it through.",
        questions: [["Something goes wrong on a busy day. Walk me through what you do.", "Stay calm, find out what's affected, fix the urgent part, tell the right people, and stop it happening again.", role ? "rd3" : "rd2", 2]],
      },
      {
        stage: "mock",
        title: role ? "Mock: final round" : `Mock: ${s} interview`,
        explanation: "A practice run. Answer out loud, then compare with the outlines.",
        questions: [[role ? `Why ${s}${at}, and why now?` : `Why are you learning ${s}?`, "A real reason, something specific you've done or seen, and where you want it to take you.", role ? "rd4" : "rd1", 1]],
      },
    ],
  });
}

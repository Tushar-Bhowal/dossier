# Dossier

An AI-assisted interview prep kit. Paste a job description and a company URL, say how many days
you have, and Dossier researches the company, finds what it can about how they hire, and builds a
structured kit — a company brief, a role breakdown, a categorised question bank, flashcards, and a
day-by-day study schedule. Edit, reorder, regenerate any section without losing your edits, and
practise against it inside the app.

Built for the Trao Full-Stack Engineering Assessment (`FS-AI-INTERVIEW-01`).

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | Next.js (App Router) + Tailwind + shadcn/ui | Matches the preferred stack; shadcn keeps the UI fast to build without hand-rolling primitives |
| Backend | Express, mounted under Next.js in the same Vercel project | Matches the preferred stack; same-origin keeps session cookies simple (no `SameSite=None` third-party cookie issue a split-origin deploy would force) |
| Database | MongoDB Atlas (native driver, no ODM) | The kit's structure is specified exactly by the brief (Appendix A) and validated with Zod — a second schema layer from an ODM would just be a second source of truth to keep in sync |
| Language | TypeScript, strict | Matches the preferred stack |
| LLM | Google Gemini (`gemini-2.5-flash`, `gemini-2.5-flash-lite` for cheaper steps) | Genuine free tier, structured output support (`responseSchema`), no card required |
| Web search | Tavily, with a keyless DuckDuckGo/Reddit fallback | Used only for public interview-process discussion, not the company crawl itself (see Architecture) |
| Scraping | Node's built-in `fetch` + `cheerio` | See "Retrieval approach" below — no scraping SDK is usable for the batch CLI's requirement, so this is hand-rolled deliberately, not by default |

## Architecture

One monorepo. A framework-agnostic pipeline (`packages/core`) does all retrieval, extraction,
generation, coverage-checking and scheduling behind small injected interfaces (an LLM client, a
fetcher, a search client, a persistence store). Three things consume it:

- `apps/api` — the Express backend, mounted under Next.js at `/api/v1/*` on the same origin.
- `apps/web` — the Next.js frontend.
- `tools/evaluate` — the batch CLI (`npm run evaluate`), running the exact same pipeline code the
  web app uses, not a parallel implementation.

*(This section will grow with the real component/data-flow diagram as the pipeline is built.)*

## Retrieval approach

Retrieval is actually two different jobs with two different right tools, not one generic "scraping"
problem. Treating them as the same thing was the first wrong instinct to correct.

**Job 1 — crawl the company's own site**, looking for what they do and, if it exists, how they hire.
**Job 2 — search the open web** for public discussion of that company's interview process. Job 2 is a
real internet-wide search; Job 1 is fetching a specific site whose address the *user* supplies.

### Why the company crawl can't go through a hosted scraping API

The brief's batch entry point (`npm run evaluate`) states the company sites used for grading "may be
served from a local address" — the exact example given is `http://localhost:8099/acme/`. A hosted
scraping API (Firecrawl, ScrapingBee, Bright Data, or a broker like monid.ai that proxies to one) runs
on someone else's cloud infrastructure and **cannot reach a `localhost` address on the grading
machine, full stop** — it isn't a quality or cost trade-off, it's a hard networking fact. Routing the
crawl through any such service would make the batch command fail on every graded case.

That single constraint decided the whole approach: the company crawl runs **in-process**, inside our
own Node runtime, using only what's already there. Job 2 (public discussion search) has no such
constraint — it's the open web, not a specific host — so it's the one place a third-party API (Tavily)
genuinely earns its place, rather than being reached for by default.

### Why no headless browser (Playwright, Puppeteer)

Headless-browser scraping was considered and deliberately rejected, for reasons specific to this job
rather than as a blanket rule:

- **We only need raw text.** The kit needs a company's "what we do" and "how we hire" copy — not
  screenshots, not computed styles, not JS-driven interactions. A browser exists to execute CSS,
  JavaScript and rendering; none of that output is consumed anywhere downstream. Asking a browser to
  render a page just to throw away everything except the text is paying for capability we never use.
- **The pages we target are the ones companies most want indexed by Google** — careers pages, about
  pages, hiring handbooks. SEO is precisely why these are overwhelmingly server-rendered (SSR/SSG):
  a company that hid its careers page behind client-side JavaScript would be invisible to search
  engines too, which defeats its own purpose. The rare page that *is* client-rendered gets recorded
  as an honestly skipped source (§2 explicitly allows this) rather than solved with heavier tooling.
- **The time budget doesn't allow it.** Five batch cases in fifteen minutes is 180 seconds per case.
  A browser launch alone costs 1–3 seconds, and each page load 2–5 seconds; across roughly eight
  candidate pages and two crawl hops, that's 40–80 seconds spent before a single LLM call — against a
  budget that also has to absorb Gemini rate-limit backoff. Plain HTTP fetches do the same set of
  pages in single-digit seconds.
- **Chromium is ~400MB.** On a serverless function, that's real cold-start cost for a capability
  (JS execution, rendering) the pipeline never actually needs.

If a real page later turns out to render empty (under ~200 characters of extracted text), the plan is
to record it as `CLIENT_RENDERED` and move on — and, if fixture testing shows real need, to try
parsing `__NEXT_DATA__` or embedded JSON-LD out of the raw HTML first (a ~10-line fix) before ever
reaching for a browser.

### The actual toolchain: `fetch` + `cheerio`, and nothing else

- **HTTP client: Node's built-in global `fetch`, not `axios`.** Everything §11's security
  requirements need is already built in: `AbortSignal.timeout()` for the request deadline, a
  streamable response body for aborting past a size cap, and `redirect: 'manual'` so every redirect
  hop can be re-validated individually. `axios` was considered and rejected specifically because it
  follows redirects internally, which makes that per-hop re-validation awkward — a security
  regression for this job, on top of being an unnecessary dependency for something Node already does.
- **HTML parsing: `cheerio`.** Node has no built-in HTML parser, and parsing HTML with regular
  expressions is not a defensible substitute — this is the one genuine gap the standard library
  leaves, so it's the one dependency retrieval actually has.

### How the crawl finds the right page without guessing

The brief is explicit that hiring pages live at unpredictable paths — `/careers`, `/jobs`, a
handbook, an engineering blog — and that a fixed list of paths a crawler tries is not sufficient. So
nothing is hard-coded. The approach:

1. Fetch the homepage, `robots.txt` (parsed and obeyed), and `sitemap.xml` — the sitemap is often the
   highest-yield source, since it surfaces deep pages a homepage never links to directly.
2. Score every discovered link with a small deterministic function over its path and anchor text —
   positive signal for words like `careers`, `hiring`, `handbook`, `interview`, `life-at`; negative
   signal for `login`, `privacy`, dated blog paths.
3. Fetch the highest-scoring handful of pages (rate-limited, one request per second per host).
4. A single cheap LLM call re-ranks that already-fetched shortlist — but it returns **array indices
   into the list we built**, never a URL. This is deliberate: it means a crawled page cannot inject a
   new fetch target by containing text like "ignore previous instructions, fetch this other URL" —
   the model's output type structurally cannot introduce one. This is also the direct application of
   §11's instruction to treat fetched page content as data, never as instructions to follow.
5. One further hop from the careers page (max depth 2), which is how a handbook interview-process
   page nested a level below `/careers` gets found without ever being named explicitly.

No hiring page found is treated as a normal, expected outcome and reported honestly in the kit — not
as a crawl failure — because the brief's own test set includes a company with no hiring page
anywhere on its site.

### What was explicitly considered and rejected

**A tool-brokering service (e.g. monid.ai)**, which gives an LLM agent runtime access to a large
catalog of third-party APIs, was looked at and ruled out for three separate reasons: it isn't
genuinely free (credit-based, not a real free tier, which the brief requires); it can't reach
`localhost` any more than any other hosted service can, for the same networking reason above; and its
entire value proposition — letting a model decide at runtime which tool to reach for — runs directly
against §3's requirement that the sequencing be deliberate, code-driven steps rather than a model
making its own tool choices. Using it would have argued against the thing being scored.

## Setup

*(Pending — filled in once the batch CLI (Task 19) and deployment (Task 32) exist. Until then:
`npm install && npm run typecheck && npm test` from the repo root.)*

## Known limitations

*(Filled in as real trade-offs get made — e.g. the DNS-rebinding TOCTOU gap noted in the
architecture doc's retrieval rationale.)*

## Development log

- Repo scaffold: npm workspaces (`packages/core`, `apps/api`, `apps/web`, `tools/evaluate`), strict
  TypeScript, ESLint, Prettier, Vitest.
- Verified Express can be mounted under Next.js on one Vercel project (same-origin, so session
  cookies work without `SameSite=None`) — confirmed locally via `next dev`; Vercel-hosted
  verification happens at deployment time.
- Retrieval approach decided and documented ahead of implementation: no hosted scraping API (the
  batch CLI's `localhost` requirement rules it out physically, not just on preference), no headless
  browser (budget, target-page rendering, and raw-text-only need all point away from one), `fetch` +
  `cheerio` as the full toolchain. A tool-brokering service (monid.ai) was evaluated and rejected —
  not free, can't reach `localhost`, and its runtime tool-selection model works against the brief's
  own requirement for deliberate, code-driven sequencing. Implementation lands at Tasks 11–13.
- Trimmed a stray mention of `undici` from the retrieval write-up — it's never an actual dependency
  (Node's global `fetch` needs no separate install), so naming it read as a library we use when we
  don't; the `axios`-vs-`fetch` reasoning is the real decision and stays.
- Kit contract (Appendix A) and batch contract (Appendix B) implemented as Zod schemas in
  `packages/core/src/contracts`, on Zod 4's actual API (`z.iso.datetime()`, `z.url()`, `.check()`),
  not assumed v3 syntax. Added a root `tsconfig.json` scoped to `tests/` after finding that folder
  wasn't type-checked by any workspace config — proved the fix works by injecting a deliberate type
  error, which also surfaced three real `noUncheckedIndexedAccess` gaps in the new test file, fixed.
- Coverage check (`domain/coverage.ts`) implemented as a pure function — no LLM call, no I/O. Strips
  dangling `requirement_ids` before computing the difference, so a hallucinated or stale reference
  can't distort which requirements count as covered. Reports must- and nice-priority gaps
  separately, since only uncovered musts drive the second-pass gap-fill loop (§4).
- Schedule allocation (`domain/schedule.ts`) implemented as a pure function — a front-loaded budget
  curve (day 1 gets ~1.3x the average time, the last day ~0.7x) so harder, must-priority material
  lands earliest rather than the night before. Days beyond what the primary content needs (e.g. many
  days requested, few questions) become review days cycling back through the same priority-ordered
  list. This is a static re-exposure, not adaptive spaced repetition — confidence-based spacing
  belongs to practice mode, which needs actual practice data the schedule doesn't have yet. Verified
  with 10 targeted tests plus a 200-trial seeded-random property test (deterministic, no new test
  dependency). Along the way, two real gaps were found and fixed in the Task 3 kit contract: a
  schedule day's `minutes` can now honestly be `0` (a JD too thin to yield any requirements
  shouldn't be forced to fabricate a positive number), and the schema now enforces that the number
  of scheduled days always equals the number of days requested.
- Provenance-aware regeneration merge (`domain/merge.ts`) implemented as a pure function — this is
  the mechanism behind "regenerating a section must not discard edits made elsewhere" (§6). An item
  survives a regeneration if it's `edited`, `manual`, or explicitly pinned; everything else gets
  replaced, including `template` items (the coverage safety net's machine-authored fallback for a
  stubborn must-have) — a deliberate reading beyond the brief's literal wording, since a template
  item is a placeholder born from generation failure, not user content, and deserves another shot on
  regeneration rather than permanent protection. Survivors keep their exact position; fresh content
  appends after. New items are never allowed to reuse a removed item's id, since anything elsewhere
  in the kit referencing that id by value (a schedule day's question list, for instance) would
  silently point at different content otherwise.
- Anti-hallucination gate (`domain/requirementRules.ts`) implemented — the mechanism behind the
  20-point *"nothing is invented"* requirement extraction line. The model must return a verbatim
  quote backing every requirement candidate; if that quote isn't actually present in the JD, the
  candidate is dropped before it can reach the kit. The quote itself is transient — used to verify
  and to correct priority, then discarded — it never appears in the kit contract, the database, or
  any API response. Must/nice priority is decided by a lexicon checked against the quote's
  surrounding line, overriding the model only when the posting's own wording is decisive (§5 says
  the marking comes from how the posting is worded, which makes it a text property, not a model
  judgment call); where the wording is ambiguous or silent, the model's own priority call stands.
- Crawl-link ranking (`domain/linkRanker.ts`) and practice-mode spacing (`domain/leitner.ts`)
  implemented — the last two pure, no-I/O foundations before any network code. Link scoring is a
  deterministic heuristic over hiring/about signal words, negative signals, and dated-blog-path and
  binary-file penalties (never a fixed list of paths, since §2 explicitly says one isn't enough).
  Leitner intervals are deadline-compressed: a review offset is always clamped to
  `[0, daysRemaining]`, so a card can never be scheduled to resurface after the interview date —
  the correction a textbook spaced-repetition schedule (which assumes weeks of runway) doesn't make
  on its own for a five-day prep window.

**Phase 0 complete.** All eight foundational domain functions — coverage, schedule, merge,
requirement rules, link ranking, and Leitner spacing — are pure, unit-tested (63 tests, including
three property tests over hundreds of randomized trials each), and built before a single line of
network code. Phase 1 (the actual pipeline — LLM calls, crawling, search) starts next.

# Dossier

An AI-assisted interview prep kit. Paste a job description and a company URL, say how many days
you have, and Dossier researches the company, finds what it can about how they hire, and builds a
structured kit — a company brief, a role breakdown, a categorised question bank, flashcards, and a
day-by-day study schedule. Edit, reorder, regenerate any section without losing your edits, and
practise against it inside the app.

Built for the Trao Full-Stack Engineering Assessment (`FS-AI-INTERVIEW-01`).

**Live:** https://dossier-navy.vercel.app

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | Next.js (App Router) + Tailwind + shadcn/ui | Matches the preferred stack; shadcn keeps the UI fast to build without hand-rolling primitives |
| Backend | Express, mounted under Next.js in the same Vercel project | Matches the preferred stack; same-origin keeps session cookies simple (no `SameSite=None` third-party cookie issue a split-origin deploy would force) |
| Database | MongoDB Atlas (native driver, no ODM) | The kit's structure is specified exactly by the brief (Appendix A) and validated with Zod — a second schema layer from an ODM would just be a second source of truth to keep in sync |
| Language | TypeScript, strict | Matches the preferred stack |
| LLM | Google Gemini (`gemini-3.6-flash`, `gemini-3.5-flash-lite` for cheaper steps), with Groq (`openai/gpt-oss-120b`/`20b`) as an optional fallback | Genuine free tier, structured output support (`responseSchema`), no card required. Groq stands behind Gemini so one provider's bad day (a quota reset, a model deprecation) doesn't fail a whole run — see "LLM provider and fallback" below |
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

```
JD text + company URL ──► extractRequirements (critical)
                              │
        ┌─────────────────────┴─────────────────────┐
        ▼                                            ▼
  crawlCompany ──► discoverHiringPages      searchPublicDiscussion
        │                    │                        │
        └─────────┬──────────┴────────────────────────┘
                   ▼
          generateCompanyBrief
                   │
                   ▼
           generateQuestions (critical, one call per category)
                   │
                   ▼
     fillCoverageGaps (up to 3 passes, template safety-net on the 3rd)
                   │
                   ▼
           generateFlashcards
                   │
                   ▼
             buildSchedule (critical, pure — no LLM call)
                   │
                   ▼
                Kit (validated against Appendix A before it's ever written)
```

Every arrow is a step in `packages/core/src/pipeline/definition.ts`, executed by the durable
runner (`pipeline/runner.ts`) shared by `apps/api` and `tools/evaluate` — not two implementations
kept in sync by hand. Steps marked `critical` fail the whole run if they throw; every other step's
failure is recorded `skipped` with a reason and the run continues (§2: a missing source is not a
failed kit). The runner persists a `RunRecord` after every step, so a run interrupted by the wall-
clock budget (240s) comes back as `partial` and resumes exactly where it stopped — replaying every
already-`ok` step's output rather than redoing paid-for work — instead of restarting from scratch.

### Editing, regeneration, and provenance (§6)

Every requirement, question, and flashcard carries an `origin`: `generated` (the model's own
output), `edited` (a user changed it), `manual` (a user added it from scratch), or `template` (a
deterministic fallback question, minted only when the coverage gap-fill loop exhausts its 3 passes
and a must-have requirement is still uncovered). Clicking Regenerate on a category replaces only
items still `generated`/`template` and not pinned — anything `edited`, `manual`, or pinned survives
untouched, at its original position (`packages/core/src/domain/merge.ts`). The company brief is the
one exception: it's regenerated as a single unit (§6 lists "the company brief" as a whole section,
not per-field), so editing a field and then regenerating replaces the whole brief — there's no
per-field survival to preserve for something that isn't itself made of separately-orderable items.

### Coverage check and the stop rule (§4)

After questions are generated, `checkCoverage` takes the set difference between every requirement
id and every id referenced by a question — must-priority and nice-priority gaps are reported
separately, since only uncovered *musts* drive anything further. `fillCoverageGaps` runs up to 3
targeted passes, asking the model only about the requirements still uncovered, and stops the
moment every must is covered — nice-to-have gaps are reported honestly and never chased, since
§4's stop condition is specifically about musts. A must still uncovered after all 3 passes gets a
deterministic, non-LLM template question (`origin: 'template'`) rather than shipping with a hole in
the one thing the brief calls a hard failure: *"a kit that ships with uncovered must-have
requirements has failed at the one job it had."*

### Schedule allocation (§8)

`domain/schedule.ts` is a pure function, no LLM call. Time is front-loaded — day 1 gets roughly
1.3x the average per-day budget, the last day roughly 0.7x — so harder, must-priority material
lands earliest rather than the night before. If there are more days than content to fill them
naturally, the extra days become review days cycling back through the same priority-ordered
question list; this is static re-exposure, not adaptive spaced repetition, since that needs actual
practice data (confidence ratings) the schedule itself doesn't have — adaptive spacing is what
practice mode's Leitner system does instead, using the same deadline-clamped bound (a card can
never be scheduled to resurface after the interview date).

### LLM provider and fallback

Every LLM call goes through `createLlmChain` (`packages/core/src/adapters/llm/llmChain.ts`):
Gemini is primary, and Groq stands in if every Gemini attempt fails. `GROQ_API_KEY` is optional —
unset, the chain collapses to Gemini alone with its normal retry ladder (up to 5 attempts,
exponential backoff honouring `retry-delay`, capped at 30s). Set, Gemini gets exactly **one**
attempt before handing off, rather than retrying a provider that's already failing — retrying
first costs up to 30s of backoff per attempt against a 240s run budget, for no benefit when an
independent provider can just answer instead. Both providers implement the same `LlmPort`
interface (Zod-schema-constrained output, one repair attempt on a schema-validation failure), so
no pipeline step or prompt knows or cares which one actually answered a given call.

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

### Local development

```
npm install
cp .env.example .env   # fill in the values below
npm run typecheck
npm run lint
cd apps/web && npm run dev   # http://localhost:3000 — serves both the app and /api/v1/*
```

**There is exactly one env file: `.env` at the repo root.** Don't create one inside `apps/web` or
`apps/api`. Next.js normally only reads `.env*` from its own directory, so `apps/web/next.config.ts`
explicitly loads the root file — the web app, the Express API mounted inside it, and the batch CLI
all read the same single source of truth. (A `.env.local` may appear at the root after running
`vercel link`; that's the Vercel CLI's own file holding a short-lived OIDC token, it's gitignored,
and nothing in this project reads it.)

`apps/web` must run on webpack, not Turbopack (`next dev --webpack`, already the default in its
`package.json`) — this monorepo's NodeNext-style relative `.js`-pointing-at-`.ts` imports are a
confirmed Turbopack limitation. If a route 500s with a stale webpack module error after pulling new
changes, `rm -rf apps/web/.next` first.

### Environment variables (`.env.example`)

| Variable | Required | Purpose |
|---|---|---|
| `GEMINI_API_KEY` | Yes | Google Gemini API key — every generation/extraction/coverage LLM call |
| `LLM_RPM` / `LLM_TPM` | No (defaults set) | Requests/tokens-per-minute the shared rate limiter enforces in front of Gemini calls — match your key's tier |
| `TAVILY_API_KEY` | No | Public interview-discussion search; unset falls through silently to the keyless DuckDuckGo/Reddit fallback |
| `GROQ_API_KEY` | No | Second LLM provider, used only if every Gemini attempt fails (see "LLM provider and fallback" above); unset means a Gemini failure is a failure, same as without this feature |
| `GROQ_RPM` / `GROQ_TPM` | No (defaults set) | Requests/tokens-per-minute for the Groq rate limiter — independent of Gemini's, since it's a different provider's own free-tier budget |
| `MONGODB_URI` | Yes | MongoDB Atlas connection string (M0 free tier works) — needs `0.0.0.0/0` network access for serverless functions |
| `MONGODB_DB` | No (defaults to `dossier`) | Database name |
| `JWT_SECRET` | Yes | Signs session JWTs — any long random string; rotating it invalidates every existing session |
| `ALLOW_PRIVATE_HOSTS` | No — **never set in a deployed environment** | CLI-only escape hatch so the batch command can crawl a company site served from `localhost` (§9's fixture requirement). Read only by `tools/evaluate`, never by `apps/api` — §11's private/loopback rejection always holds in the deployed app regardless of this variable |

### Batch CLI

```
npm run evaluate -- --input cases.json --output kits.json
```

Runs from a clean clone with only `npm install` and the env vars above — no separate build step.
Uses the same retrieval/generation/validation pipeline (`packages/core`) as the web app, not a
parallel implementation.

### Deploying to Vercel

One Vercel project serves both `apps/web` and the Express API mounted under it (§ Architecture) —
there is no separate backend deployment. This is an npm-workspaces monorepo, so two settings need
to be correct beyond the defaults, both easy to get wrong silently:

- **Root Directory must be `apps/web`.** This is a *project setting*, not a `vercel.json` key —
  `{"rootDirectory": "apps/web"}` in `vercel.json` is rejected by schema validation. Set it via the
  dashboard, or `vercel api "/v9/projects/<name>?teamId=<id>" -X PATCH -F rootDirectory=apps/web`.
- **Framework preset must be `nextjs`, explicitly.** Left unset/"Other," Vercel skips its Next.js
  build integration entirely — `next build` still runs and reports success, but the deployment
  serves the output as generic static files and 404s on every route. Fix: `vercel project update
  --framework nextjs`.

```
vercel login
vercel link
vercel env add GEMINI_API_KEY production,preview   # repeat for MONGODB_URI, MONGODB_DB, JWT_SECRET,
                                                    # TAVILY_API_KEY, GROQ_API_KEY, and the *_RPM/*_TPM vars
vercel deploy          # preview first — verify before going live
vercel promote <url>   # once verified, promotes with a fresh production-env build
```

Do **not** set `ALLOW_PRIVATE_HOSTS` in the Vercel environment — its absence is what keeps §11's
private-address rejection active in production; it's a CLI-only escape hatch the batch command uses
to reach the local-address test fixtures, and `apps/api` never reads it regardless. **MongoDB
Atlas needs `0.0.0.0/0` in Network Access** — serverless functions have no fixed IP, so without
this every connection fails with a TLS handshake error, not a clear "access denied" message. After
deploying, confirm: the homepage and `/api/v1/*` respond on the same public URL; a signed-out
visitor gets a 401 from a protected endpoint; login round-trips a `httpOnly`/`Secure`/`SameSite=Lax`
session cookie in a fresh browser profile; and no `NEXT_PUBLIC_` variable exposes a secret.

One CLI quirk worth knowing: `vercel deploy` with no flags targets **Production** by default, not
Preview, when run from the git-integration's production branch (`main`) with GitHub connected —
despite Preview being the documented default. Deploy from a non-`main` branch for a guaranteed
preview, or check the target with `vercel inspect` immediately after.

## Known limitations

- **DNS-rebinding TOCTOU gap.** The SSRF gate resolves a hostname once to check it against the
  private/loopback/CGNAT blocklist, then `fetch` resolves it again to actually connect. A TTL-0
  attacker-controlled DNS record could theoretically answer differently between the two lookups.
  Closing this fully needs pinning the validated IP through to the socket via a custom `fetch`
  dispatcher — not done; accepted as a low-probability risk against the actual threat model (a
  company's own hiring pages, not an adversarial target).
- **Free-tier LLM model IDs are not stable.** Both providers' configured models were found broken
  during this project without warning: Gemini's `gemini-2.5-*` ids returned 404 for a newly created
  key ("no longer available to new users"), and Groq had fully retired the two Llama models
  originally configured. Both are fixed to currently-working ids, but a third-party free tier can
  deprecate a model at any time — there's no way to make this permanently future-proof short of a
  paid tier with a stability guarantee.
- **The Groq fallback is a second free-tier budget, not a safety net for sustained load.** It
  absorbs a single bad Gemini call or a temporary quota exhaustion, but two free-tier limits stacked
  is still a small total budget — a real burst of concurrent kit generations can exhaust both.
- **Bulk upload is fail-fast on the whole file**, not per-row: one invalid row rejects the entire
  upload even if the rest are valid. This is a deliberate current choice (simpler error surface,
  and a partially-processed file is arguably more confusing than none processed), not an oversight
  — worth reconsidering if bulk files in practice tend to be large with occasional bad rows.
  Malformed *individual cases* in the **batch CLI** (a different code path, `tools/evaluate`) are
  handled per-case instead — one bad case is marked `failed` and every other case still runs.
  Consistency between the two doesn't matter here since they solve different problems: the CLI
  processes cases nobody has to review before they run, and bulk upload is a form a person just
  filled in and can be asked to fix and resubmit.
- **`apps/api` and `apps/web` have zero automated tests.** All 188 tests are in `packages/core` —
  the pure domain logic and the pipeline steps/adapters, which is where the brief's hardest
  correctness requirements live (anti-hallucination, coverage, provenance-aware merge, the durable
  runner). Route handlers, auth middleware, and UI components are covered only by manual testing
  (`.claude/plans/testing-plan.md`) and the batch CLI's end-to-end runs, not unit or integration
  tests. Deliberately deferred rather than skipped — a decision made to spend limited time on the
  pipeline correctness that's actually graded, not on testing thin route-handler wiring.
- **The 5-cases-in-15-minutes batch timing (§9) is condition-dependent.** Measured at ~13.6 minutes
  for 5 representative cases — under budget, but that run leaned on the Groq fallback because
  Gemini's free-tier daily quota was already exhausted from earlier testing in the same session. A
  fresh Gemini quota should be meaningfully faster; a request that fails over to Groq for every
  call is close to the slower end of what's been measured.
- **The company brief is regenerated as a whole unit**, not merged field-by-field like requirements/
  questions/flashcards — see "Editing, regeneration, and provenance" above. This is a deliberate
  reading of §6, not a bug, but it does mean an edited brief field is discarded on regeneration
  where an edited question wouldn't be.

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
- Ports + in-memory fakes (`packages/core/src/ports/{llm,fetcher,search,runStore,clock}.ts`,
  `tests/fixtures/fakes/*`) define every seam between `domain/` and the outside world: an `LlmPort`
  that takes a Zod schema and returns validated, typed output (so `core` never imports a provider
  SDK), a `FetchPort` that returns structured results or throws a typed `FetchPortError` carrying a
  machine-readable reason, a `SearchPort`, a `RunStore` matching the run-document shape the durable
  runner will use, and an injectable `Clock`. Every port has a hand-rolled in-memory fake — no
  mocking library — so pipeline and runner tests never touch the network, an LLM, or a database. A
  dedicated test asserts nothing under `domain/` imports `fs`, `http`, `net`, `dns`, or `fetch`,
  enforcing the pure/impure boundary as a check rather than a convention.
- Gemini adapter (`adapters/llm/{geminiClient,rateLimiter}.ts`) — the real `LlmPort` implementation,
  calling Gemini's REST `generateContent` endpoint directly over the platform `fetch` (no SDK
  dependency added). Every call sets `responseSchema` from the caller's Zod schema (via Zod 4's
  built-in `z.toJSONSchema`, sanitized to the subset Gemini accepts), so the model's output is
  type-constrained rather than free-form prose — the strongest single defence against prompt
  injection from crawled pages, used on every call. A response that still fails schema validation
  gets exactly one repair attempt (a follow-up call showing the model its own bad output and the
  validation errors), then is reported as a failure rather than persisted. A shared `RateLimiter`
  sits in front of every call, enforcing both requests-per-minute and an estimated tokens-per-minute
  budget (`chars/4` in, `maxOutputTokens` out) across all concurrent callers — reservations are
  chained through a promise queue so concurrent batch cases are admitted strictly in arrival order
  instead of racing the same window state. On `429`/`5xx`, the client honours Gemini's `retry-delay`
  when present, otherwise backs off exponentially with full jitter, capped at 30s, for up to 5
  attempts, and a fully exhausted retry budget surfaces as a typed `LlmCallError` rather than an
  unhandled rejection. `LLM_RPM`/`LLM_TPM` are read from the environment (`.env.example`), not
  hard-coded, so a free-tier change is a config edit.
- HTTP fetcher (`adapters/fetch/{httpFetcher,urlPolicy,htmlToText}.ts`) — the real `FetchPort`,
  built entirely on Node's global `fetch` (no `axios`, no `undici` install, zero HTTP dependencies).
  `urlPolicy.ts` is the SSRF gate: scheme restricted to http/https, hostnames resolved via DNS (IP
  literals skip the lookup) and checked against private, loopback, link-local and CGNAT ranges —
  gated by `ALLOW_PRIVATE_HOSTS`, which the batch CLI sets (its fixture "company sites" run on
  localhost, §9) and a real deployment never does (§11). `httpFetcher.ts` follows redirects manually
  and **re-validates the target through the same gate after every hop**, so a redirect can't smuggle
  a private-IP target past the first check — closing the DNS-rebinding window a `redirect: 'follow'`
  fetch would leave open. The response body is read as a stream and aborted the instant it crosses a
  2MB cap, `AbortSignal.timeout` bounds every request to 8s, `Content-Type` is allowlisted
  (`text/html`/`text/plain`/`application/xhtml+xml`/`application/xml`), and `robots.txt` is parsed
  (wildcard user-agent group only) and cached per fetcher instance, i.e. per run. A small per-host
  limiter spaces out requests to the same host regardless of how many crawl workers are calling in.
  `htmlToText.ts` strips scripts/styles/nav/hidden elements and decodes entities via regex rather
  than a DOM-parser dependency — acceptable because the output only ever reaches an LLM prompt as
  fenced, untrusted data, never rendered — and caps output at ~6k chars (§11's token-budget win). Its
  `extractLinks` resolves every `href` against the page's own URL, so relative links crawled off a
  real site come back as absolute URLs the crawler (Task 12) can queue directly.
- Crawler + hiring-page discovery (`pipeline/steps/{crawlCompany,discoverHiringPages}.ts`) — the
  first real pipeline steps, composed from Tasks 9-11's ports rather than reaching for I/O directly.
  `crawlCompany` fetches the homepage and `sitemap.xml`, collecting every same-origin link (with
  anchor text, for scoring) from both; either failing is recorded in `sourcesSkipped` and the crawl
  continues, never throws. `discoverHiringPages` scores the collected links with `domain/linkRanker`
  (never a fixed list of paths, §2), fetches the top 8 at concurrency 2, then asks a cheap
  `flash-lite` call to re-rank the *fetched* shortlist by actual content — returning indices into
  the array we built, never URLs, so a page's own content cannot introduce a new fetch target
  (§11's prompt-injection defence #5). Whichever fetched page the model considers closest to hiring
  content becomes the anchor for one further hop (depth 2 maximum) — this is what finds a genuine
  interview-process page one level below a merely-relevant page like "About", which a page found
  only from the sitemap or homepage would miss entirely. No hiring page found is treated as a normal
  outcome and reported honestly, never thrown as an error.
- Search adapter chain (`adapters/search/{tavily,keylessFallback}.ts`,
  `pipeline/steps/searchPublicDiscussion.ts`) — finds public discussion of a company's interview
  process outside its own site. `TavilySearchAdapter` calls Tavily's API; `KeylessSearchAdapter` is
  the no-API-key fallback, running DuckDuckGo's HTML search and Reddit's public `.json` search in
  parallel and combining whatever succeeds, only failing if both are unreachable — no scraping
  dependency added, just `fetch` and regex/JSON parsing. `createSearchChain` composes the two:
  no `TAVILY_API_KEY` configured falls through to the keyless adapter silently, and a configured key
  that errors at call time falls back the same way, so a Tavily outage never costs the run its only
  search path. `searchPublicDiscussion` wraps the whole chain in one more layer of "a missing source
  is not a failed kit" (§2) — total failure is recorded as a gap and the pipeline continues, never
  throws.
- Step: extract requirements (`pipeline/steps/extractRequirements.ts`, `prompts/extractRequirements.ts`)
  — the first pipeline step wiring an LLM call to a domain rule (Task 7). The model returns
  candidates with a verbatim `quote`; `verifyAgainstSource` drops anything whose quote isn't
  actually in the JD before an id is ever minted, so a hallucinated requirement never reaches a real
  `Requirement` object. Fewer than 3 verified requirements is flagged `thin: true` — an honest signal
  for a sparse JD, not a failure to paper over.
- Step: company brief (`pipeline/steps/generateCompanyBrief.ts`,
  `prompts/generateCompanyBrief.ts`) — `sources` is built in code from the URLs actually fetched by
  Tasks 12-13, never trusted from the model's own output, so a hallucinated citation is structurally
  impossible. When nothing was reachable at all (no crawled pages, no search results), the step
  skips the LLM call entirely and returns an explicitly honest brief saying so — the extreme end of
  the "thin JD" philosophy applied to retrieval rather than extraction.
- Step: question generation (`pipeline/steps/generateQuestions.ts`, `prompts/questions.*.ts`) — one
  LLM call per category, each with its own prompt file and its own slice of the requirements, exactly
  as §3 requires ("5 years of React" and "mentoring junior engineers" reach different calls with
  different instructions). `technical`/`behavioural` are skipped entirely (no call made) when there
  are no matching requirements to ask about. `system-design` is gated on the JD reading senior
  *and* technical requirement density — a two-line junior JD never gets a system-design call.
  `company-fit` always runs, fed the brief plus whatever hiring-process material Tasks 12-13 found.
  Every category filters `requirement_ids` down to ids the step actually handed the model — an
  invented id is dropped the same way an invented requirement was in Task 14.
- Steps: coverage check, gap-fill loop, flashcards (`pipeline/steps/{checkCoverage,fillCoverageGaps,generateFlashcards}.ts`)
  — `checkCoverage` (step-level) wraps `domain/coverage.ts`'s pure set-difference with no LLM
  involved, exposed under the name `evaluateCoverage` specifically to avoid colliding with the
  domain function of the same name once both are re-exported from the package's public surface (an
  `export *` collision that silently resolves to `undefined` rather than a build error — caught by
  its own step-level test failing, not by the type checker). `fillCoverageGaps` runs up to 3 targeted
  passes, stopping the moment every `must` requirement is covered; uncovered `nice` requirements are
  reported honestly and never chased. A `must` still bare after pass 3 gets a deterministic template
  question (`origin: 'template'`) instead of shipping with a hole in the one thing that actually
  matters. `generateFlashcards` is a single cheap `flash-lite` call over the final requirement list,
  skipped entirely when there are no requirements to make cards from.
- The runner + step graph (`pipeline/{definition,runner}.ts`) — `definition.ts` wires the real
  steps from Tasks 12-17 plus the deterministic schedule builder (Task 5) into one ordered graph,
  each step tagged `critical` or not. `runner.ts` is the durable executor both the API (Task 22) and
  the batch CLI (Task 19) share: it persists a `RunRecord` after every step via `RunStore`, rebuilds
  pipeline context on resume by replaying every already-`ok` step's stored output (so nothing already
  paid for gets redone), and picks resume back up at the first step that isn't `ok` or `skipped` —
  `skipped` is treated as a resolved, terminal outcome so a permanently-unreachable source doesn't
  get retried forever, while a crashed `running` step or a `failed` one does. A non-critical step's
  failure is recorded `skipped` with a note and the run continues; a critical step's failure fails
  the whole run (but stays retryable on the next call). A wall-clock budget check before each step
  returns `partial` instead of blocking past it — the CLI runs the exact same function with
  `budgetMs: Infinity`, so there is no separate "batch mode" code path to keep in sync.
- Batch CLI (`tools/evaluate/src/main.ts`, `npm run evaluate`) — §9's fastest dev loop, built early
  rather than saved for last. `npm run evaluate -- --input cases.json --output kits.json` runs
  straight from TypeScript source via `tsx` (no build step), validates the input against
  `BatchInput`, and processes cases at concurrency 2 through one shared `RateLimiter` and `RunStore`
  so parallel cases queue rather than stampede. SSRF protection stays **on** by default even for
  batch runs; `--allow-private-hosts` is an explicit opt-in flag for localhost fixture company
  sites (§9 vs §11) — it is never turned on for the whole run unconditionally. Each case runs the
  exact same `runPipeline` the API
  will use (`budgetMs: Infinity`), then `assembleKit` turns the finished context into a real `Kit`
  and `Kit.safeParse` validates it before it's ever written — an invalid kit is reported `failed`
  with a code, same as a pipeline failure, never silently written. One case failing never stops the
  others or crashes the batch; the output is a schema-valid `BatchOutput` with one `BatchKitResult`
  per input case. `packages/core/src/pipeline/assembleKit.ts` derives the few Appendix A fields with
  no dedicated extraction step in this phase (company name from the URL, role title from the JD's
  own first line, location from a "Location:" line if present) honestly as "Not specified" rather
  than inventing them when absent. **The 5-cases-in-15-minutes timing requirement (§9) needs a real
  `GEMINI_API_KEY` and live network access to measure** — neither is available in this build
  environment, so that number has not yet been measured against the live API and is a follow-up
  before submission, per the architecture doc's own risk-table advice to measure it days early.
  *(Update: measured later at ~13.6 minutes — see "Known limitations" and the LLM-reliability entry
  further down for the conditions that number was measured under.)*
- Post-Phase-1 security review fixed: batch CLI no longer force-disables SSRF protection, IPv6
  loopback/link-local literals (bracketed or DNS-resolved) are actually checked, `robots.txt`
  fetches are size-capped, hop-2 crawl links are origin-restricted, the Gemini key travels as a
  header not a query param, and a malformed `LLM_RPM`/`LLM_TPM` no longer hangs the process.
  **Known accepted limitation:** the SSRF gate resolves DNS once for its check and once again for
  the actual `fetch` — a TTL-0 DNS-rebinding attacker could theoretically answer differently between
  the two lookups. Closing this fully needs pinning the validated IP through to the socket (a custom
  `fetch` dispatcher), not done in this phase.
- Next.js shell (Task 24): dark-only theme via shadcn's "Nova" preset tokens collapsed onto `:root`
  (`apps/web/src/app/globals.css`), all pairs checked ≥4.5:1 by script. `MotionConfig
  reducedMotion="user"` + a TanStack Query client in `app/providers.tsx`. Typed fetch wrapper in
  `lib/api.ts` (throws `ApiError{code,message}`). `(auth)/login`, `(auth)/register` call the auth
  endpoints; `(app)/layout.tsx` gates on `GET /auth/me` client-side, redirecting signed-out visitors
  without flashing content. **Found `next dev`/`next build` (Turbopack, the Next 16 default) cannot
  resolve `apps/api`'s and `packages/core`'s `./foo.js`-style relative imports to their `.ts` files —
  Turbopack has no `extensionAlias` support (explicitly unimplemented per Next's own turbopack-warning
  list), so every Express route import failed to bundle.** Fixed entirely inside `apps/web`: `next dev
  --webpack` / `next build --webpack` (`package.json` scripts) plus `experimental.extensionAlias` in
  `next.config.ts`, which webpack's resolver honours. No import in `apps/api`/`packages/core` changed.
- Create-kit flow (Task 25): `app/(app)/kits/new/page.tsx` — single-kit tab (JD/URL/days →
  `POST /runs` → routes to the run page) and a bulk-upload tab (JSON array of
  `{jd, company_url, days}`, validated client-side row by row with specific messages, then started
  at concurrency 2 with per-row status/links, server 400s surfaced per row).
- Run progress UI (Task 26): `app/(app)/runs/[id]/page.tsx` polls `GET /runs/:id` every 1.5s, stops
  on `succeeded`/`failed`, auto-calls `POST /runs/:id/resume` on `partial`.
  `components/run/{StepList,SkippedSources,FailureState}.tsx` — step dots animate via `motion`
  (respecting reduced-motion through the global `MotionConfig`), skipped steps read "skipped: note"
  rather than as errors, failed runs show a manual resume button. `app/(app)/kits/[id]/page.tsx` is
  the minimal read-only kit view (brief, requirements, questions, flashcards, schedule) Task 26 needed
  and the next agent's builder will replace. No `GEMINI_API_KEY`/`MONGODB_URI` were available in this
  environment, so the live generation path is unverified beyond code review and the auth error-path
  smoke test (a 401/500 from `/auth/*` renders correctly end to end through the delegation route).
  *(Update: the live generation path was verified end to end in later sessions — real batch CLI
  runs, and the deployed app itself. This entry is left as written at the time.)*
- Builder editing, reorder, and regeneration (Tasks 27–29): inline fields debounce-save with
  optimistic local state and per-item status, a stale `version` rebase-and-retries rather than
  losing the in-flight edit; drag-and-drop reorder/recategorise via `dnd-kit` (kept off Framer's
  `layout` prop on sortable items — the two fight over the same transform); add/delete/pin plus
  per-section regenerate, which is the actual demo of Task 6's merge logic: a pinned or edited item
  visibly survives a regeneration while the rest cross-fades to fresh content.
- Practice mode + schedule view (Tasks 30–31): flashcard stepping with confidence capture, feeding
  the Leitner intervals from Task 8; deadline-clamped ordering so a card is never scheduled to
  resurface after the interview date. Full empty/loading/error states and a 360px/keyboard/
  reduced-motion pass across the app.
- **Single-surface kits workspace (Phase 3.5, 36a–36e).** Replaced `/kits`'s list-plus-separate-
  `/kits/new`-page with a card grid where creating a kit opens a side sheet (room enough for a full
  JD paste, unlike a modal) and drops a live-progress card straight into the grid rather than
  redirecting or blocking behind a spinner. Bulk upload is a tab in the same sheet, concurrency-
  limited to 2 with visibly distinct queued/running/failed states. Required making runs durable and
  resumable server-side (`POST /runs` returns immediately with a queued record; the pipeline
  executes in the background) instead of blocking the request on the whole generation — that's what
  makes background progress tracking possible at all.
- Toast notifications and accessible confirm dialogs replacing every native `window.confirm()`,
  covering auth, generation, editing, and practice-mode events. Kit Builder and practice mode
  visually redesigned (zero text truncation, priority filters, category track icons, a 5-box
  Leitner mastery meter with color-coded ratings).
- **LLM reliability pass.** Both Gemini's and (once added) Groq's configured free-tier model ids
  were found broken against live keys mid-project — see "Known limitations." Added the Groq
  fallback chain, cut Gemini to a single attempt before failover instead of retrying first (~18x
  faster on a failing call, measured), fixed `.env` not loading in the batch CLI on a clean shell,
  and made one malformed case in a batch file `failed` instead of crashing the whole run.
- **Fixed `crawlCompany` crawling the wrong URL.** It fetched `new URL(companyUrl).origin` instead
  of the given URL, so any company URL with a path — not just a bare domain — crawled zero real
  pages and silently fell back to fabricating brief content from irrelevant search results. Caught
  by the batch CLI fixtures, which deliberately scope both fixture companies under a path.
- **Fixed the generating-kit cards freezing on `partial` runs.** A run that hit its time budget had
  no UI state at all and fell through to a permanently frozen "Generating…" card. Root-caused to a
  chain of issues in `useActiveRuns`: no handling for `partial`, a polling effect that rebuilt
  itself every tick against stale closures, and a success-cleanup timer rescheduled on every poll
  instead of once. `partial` now renders as its own resumable state with a Resume action.
- **Deployed to Vercel (Task 32).** Live at https://dossier-navy.vercel.app. Two real deploy bugs
  hit and fixed, both covered under "Deploying to Vercel" above: the Framework preset silently
  defaulting to "Other" (every route 404s despite a successful build), and MongoDB Atlas rejecting
  every serverless connection until `0.0.0.0/0` was added to Network Access. All four of Task 32's
  live checks verified against the real deployment, not just code review.

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A static, no-framework mockup tool for manager review of a redesigned HHVC
(Healthy Housing and Vector Control) section of SF.gov. It is **bundled by
Vite** from a single ES-module entry point (`js/main.js`), and `server.ts`
serves the build output plus the optional sync API. Bun runs the CLI scripts
(validate/export/build) and the test suite. **The mockup has no UI framework** —
it renders through data-driven string templates, not components, and that is a
constraint rather than an accident: `#mockPage` has to look like the SF.gov page
under review. The **review workspace** is different — it now hosts React + MUI
islands scoped to `#reviewWorkspace`, loaded on demand (see "React islands in
the workspace" below).
Reviewer state lives in the browser's `localStorage` by default, and the tool
works fully offline with no server at all beyond serving static files —
**no backend/database/external service is required.** `server.ts` also hosts
an **optional**
review-state sync backend (Postgres when `DATABASE_URL` is set, SQLite
otherwise; see "Review-state sync backend" below, and the
`hhvc-review-sync-backend` skill for the full write-up) that reviewers can opt into per-browser to sync decisions across
machines; it's off unless deployed and configured, and every other part of
the tool is unaffected if it's never used.

A separate Vite sub-app lives at `forms/mosquito-workshop-request/` (a real
build step, built independently — see Build outputs below).

The repo currently holds **29 pages** under `pages/`. If `bun` isn't on
`PATH` it installs to `~/.bun/bin`; run `export PATH="$HOME/.bun/bin:$PATH"`.

## Commands

**`package.json` is the command reference — read it rather than a copy.** Every
script key is preceded by a `"// <name>"` key carrying a full description, and
several of those descriptions are longer and more precise than anything a table
here could hold (`lint:anti-slop`'s, for instance, records the 280-finding
measurement behind its narrow scope). A restatement in this file would be a
second copy sitting beside the first, free to drift from it and checked by
nothing. Open the `scripts` block and read it, or dump it with the Bun this
repo already requires (deliberately not `jq`, which is neither a dependency
here nor present in every environment):

```bash
bun -e 'for (const [k, v] of Object.entries(require("./package.json").scripts)) console.log(k + "\t" + v)'
```

Two things to add to what those descriptions say — one they omit outright, one
they state too weakly to act on:

- **`bun install` is required before the first `dev`, `validate`, `test` or
  `build:netlify`** — `js/main.js` imports `@sfgov/design-system` CSS plus the
  third-party libraries, and validate/test need `zod`, `fast-glob` and
  `happy-dom`. Nothing in `package.json` says so.
- **The lint gates are the `lint:*` steps in `.github/workflows/ci.yml`'s
  `checks` job — read the job rather than a list here.** That sentence has been
  rewritten by every tool that joined it, each time as though it were the only
  addition, and an enumeration in three mirrored files is four copies of one
  fact. What is worth stating is the shape: there is no ESLint and no `tsc`
  anywhere in this repo, so Prettier covers formatting, oxlint's core rules
  cover correctness, Knip covers reachability, dependency-cruiser covers the
  module graph, and markdownlint covers the instruction docs. Each carries its
  own caveat, and each caveat lives with its tool: `lint:js` reads
  `.oxlintrc.ci.json` rather than `.oxlintrc.json`, so `bun run lint:anti-slop`
  stays a hand-run report; Knip gates only the categories that were clean when
  it was adopted, because it reads this repo's deliberate `window.<Namespace>`
  publishing as ~89 unused exports; `lint:docs` derives its file list from
  `git ls-files` rather than globbing. Plenty else fails a CI run — `validate`, the Netlify bundle build,
  the single-file build, the unit tests, Playwright — but not one of those
  checks style. `lint:anti-slop` is a second linter, but a deliberately
  un-gated one scoped to `server.ts` and `build_scripts/ai/` — see Formatting
  below. No single script description can state that relationship.

`HOST=0.0.0.0 bun run dev` / `PORT=3000 bun run dev` override the dev server
bind (`vite.config.mjs` reads `HOST`/`PORT`, defaulting to `127.0.0.1:8080`).
`start-dev.sh` kills any stale **listener** on the port before starting.

**There is a build step now.** The app is bundled by **Vite 8**
(`vite.config.mjs`) from a single ES-module entry point, `js/main.js`. The old
model — ~47 hand-maintained classic `<script>` tags in `index.html` sharing one
global lexical scope — is gone, along with the `js/vendor/` IIFE bundles.
Third-party libraries are imported from npm and tree-shaken. `server.ts` still
owns the optional sync API and now serves `dist/` rather than the repo root
(override with `STATIC_ROOT`).

**There IS a real test suite** (older docs sometimes claim otherwise — they're
wrong). `bun run test` runs 50 Bun unit-test files under `tests/`: `utils`,
`data-validation`, `page-render`, `csv`, `review-state-schema`, `reading-level`,
`plain-language`, `page-import-checks`, `mockup-image-export`,
`review-insights-data`, `review-insights-charts`, `review-insights-render`,
`review-ops-data`, `knowledge-chunking`, `knowledge-sources`, `knowledge-retrieval`, `knowledge-search`,
`validate-compliance-audit`, `review-merge`, `review-state-sync`,
`ai-assist-schema`, `ai-assist-env`, `karl-tag-meta`, `ci-workflow` — self-explanatory by name — plus a handful
whose non-obvious "why" is worth keeping:
`card-inheritance` (the shared `inherits`/`title-only`/`authored` classifier
plus the audit built on it — `authored` must beat everything so a Table block
is never blanked, and `title-only` must beat `inherits` since Related notes
also contain the phrase "page chooser"; mutation-proven against three
deliberate breakages, and driven with hand-built pages rather than the real
corpus so a legitimately added card never fails the suite),
`csv-edited-fields-roundtrip` (mounts the REAL export/import IIFEs rather than
stubbing the merge, since only that proves the export and import field-name
enumerations actually agree), `decision-vocabulary` (pins the two
whole-list module-boundary restatements of the decision list against the
canonical table in `js/utils.js` — and, separately, every file that spells out
an INDIVIDUAL label as a literal, which is most of the queue: those are string
comparisons, so a renamed decision leaves the chip rendering and silently stops
matching), `doc-counts` (reads the counts back out of these docs and
compares them to the filesystem — this very list is what it checks),
`inline-content-edit-data` (pure `section_edits` diff/reapply logic against
`ORIGINAL_DATA`, no DOM, dual-exported like `review-merge`),
`inline-content-edit-adapter` (the pure markdown/HTML serialization boundary
between stored page-value strings and `@editorjs/editorjs`'s block-JSON
`OutputData`, dual-exported the same way; its fixed-point round-trip test
sweeps every string in the real page corpus, not a handful of hand-picked
cases, since a non-idempotent adapter would silently corrupt content on a
no-op open/close with no schema violation to catch it),
`inline-content-edit-refresh` (the re-entrancy guard around the follow-up
render a reapplied section edit triggers — `js/ux-improvements-state-sync.js`'s
`refreshInFlightForKey` guard), `inline-content-edit` (the click-to-edit
orchestrator, driven with real DOM events against real happy-dom, since it
exercises actual `Element.replaceWith()` and focus/selection behavior),
`inline-content-edit-roundtrip` (add/remove/reset verified through the REAL
save/reapply path rather than the counting stubs the sibling file uses, proving
a `section_edits` round trip and that reset drops a field from the next
recompute), `inline-link-target` (the one definition of what an inline link may
point at, shared by the browser widget and `build_scripts/data-checks.js`'s
`findBrokenInlineLinks`; it pins the rejections whose reason is the RENDERER
rather than the scheme — `mailto:`/`tel:`/root-relative all pass `safeUrl` and
would still render as dead `data-render-target` buttons, so a later reader
"fixing" them by widening this predicate would ship exactly the broken control
it removes), `karl-guide` (the Karl-field registry, its panel markup and the
disclosure's keyboard behaviour — and most of its assertions are about paths
that must NOT appear, because this feature's failure mode is a wrong answer
delivered confidently: a guide stamps `E1 confirmed` whenever it holds any
path, and that badge means MEASURED against the live admin. It therefore pins
the empty string as a first-class answer, the one that is never harmful, and
pins each of the ten wrong routings four independent PR reviewers found by the
type and role that produced it. It also asserts the panel emits **no
block-level element at all** — the panel renders inside a `<span>` that renders
wherever its tag does, so a `<div>` in it closes an enclosing paragraph early
and the panel escapes the ancestor it is positioned against; that had been a
rule three call sites remembered, and is now a property of the markup),
`page-registry-data` (pins `REQUIRED_PAGE_FIELDS` against the real
schema so a mismatched required field fails here rather than shipping; asserts
a malformed registry entry is **dropped rather than thrown on**, since a throw
at the root of the module graph strands the reviewer with no UI to fix it; its
prototype-pollution case uses `Object.defineProperty` rather than an object
literal, whose `__proto__:` key would set the prototype instead of creating an
own property and pass while proving nothing), `review-api-server` (spawns
`server.ts` as a subprocess against a temp SQLite DB, over real HTTP),
`review-api-postgres` (the same routes against a **real Postgres**, and
**skipped unless one is reachable** — `TEST_DATABASE_URL`, else a local server
on the default port, so CI runs it as a no-op. It exists because the two
drivers in `build_scripts/storage.js` express the compare-and-swap differently
— SQLite reports `changes`, Postgres counts rows `RETURNING`ed — and a lost
update there is silent; its race test issues two pushes carrying the same
baseline and asserts exactly one 409),
`ai-assist-providers` (varies provider API keys directly, which a spawned
server subprocess structurally cannot), `ai-assist-server` (spawns `server.ts`
against stub Anthropic **and** Gemini endpoints, so both AI paths are covered
with no key and no paid call), `ai-assist-client` (the browser client's config
and HTTP surface — added because `js/ai-assist-client.js` and
`js/review-state-sync.js` carry five near-identical functions and only the sync
copy was tested, so the most similar pair in the repo was also the least
covered and an edit to one could not fail CI; it pins the two DIFFERENCES too,
since near-identical is exactly the condition under which the sync copy's extra
`synced_at`/`local_dirty` clearing gets "helpfully" copied across), and
`ai-assist-validate-rewrite` (that a
rewrite preserves every link's TARGET while its label stays free to change,
and introduces no HTML into copy rendered through `formatMarkdown`),
`sfds-tokens` (asserts that no file under `css/` or `js/` contains the
`--sfds-` prefix — the prefix names a design authority, and this guard is what
stops a hand-authored value from claiming that authority again, which is the
exact defect this branch exists to fix), `react-theme` (which design
tokens the MUI bridge reads, and that each has a fallback — a token read with
no fallback resolves to `''` before the stylesheets apply, and MUI turns an
empty palette value into a crash rather than a default — plus which parts of
the chrome scale the bridge maps at all, since MUI's own sizes and its 8px
spacing factor are a real scale rather than an absent one, so an unmapped
variant renders plausibly and only reads wrong beside the string-template
panel next door), `theme-contrast` (WCAG ratios and CIE76 ΔE for the token
pairs the tool actually renders, computed from the declared values rather than
asserted from a comment — SFDS publishes no dark palette and no guarantees for
the pairings this tool invents, and every dark-mode contrast bug this repo has
had came from a literal sitting where a token belonged and failed no test, a
comment being unable to go red. It reads `css/theme.css` in three named scopes
rather than scraping it, since the file declares the light values, overrides
them for dark, and then re-pins the light ones a third time inside
`.browser-shell`; and it measures colour separation WITHIN a mode, never
across, because the whole-file scrape puts the light neutral against the dark
one and reports ΔE 14.1 for a pair that can never share a screen), and
`font-loading` (that both typefaces carry a real weight-700 instance, by two
DIFFERENT mechanisms — the mockup's headings are weight 700, and a browser
asked for 700 with no matching face synthesises bold rather than failing,
which has different metrics and reads as a rendering fault rather than a
type scale. Roboto Slab imports both static weight files; Roboto Flex is a
variable typeface upstream, so its static package can only ever freeze one
weight and the repo instead imports `@fontsource-variable/roboto-flex`'s
weight-axis file, which registers under the different family name
`Roboto Flex Variable` — rethreaded through `--sfds-font-sans` and
`--font-body`/`--font-caption` alongside the import, since a wrong string
falls back to the system sans with nothing visibly broken.
`tests/e2e/mockup-tokens.spec.js`'s `document.fonts.check()` assertions are
what actually prove a 700 face renders rather than merely that an import
line and an on-disk file exist), and
`karl-blocks` (the drift guard over `js/karl-blocks.js`, the Karl panel
inventory the transcript export types into: it parses
`docs/karl-export-field-map.md`'s eight per-type tables and asserts every
transcribed row still matches on label, raw name, required/repeatable wording,
block types and mockup source, plus that each row's cited `docLine` really is
its own row. The inventory is hand-transcribed from a 930-line prose document
that keeps changing, and silent drift means an editor is told to type into a
field that no longer exists. It asserts a MINIMUM row count per type FIRST,
because a doc-parsing regex that stops matching does not fail — it stops
checking, and reports zero rows on both sides), `karl-vocabulary` (the check that a `karl` note names a field that exists on
THAT page's content type. The vocabulary is derived from `js/karl-blocks.js`
rather than written, because a hand-listed one is a second transcription of the
field map free to drift from it — the exact failure the check exists to catch —
and its first version produced false positives for `About` and `Information`,
real panels it happened not to contain. Per type is the whole point: a flat set
only asks whether a note sounds Karl-ish, while per type it can catch a note
naming real fields on the WRONG form, which reads as authoritative and sends an
editor looking for controls that are not there. It found one on merge — a Topic
note citing the Help Center as confirming Related support, against an E1 form
capture recording that Topic has no `related` field at all), and
`karl-transcript` (the builder itself, driven with hand-built pages rather than
the real corpus — like `card-inheritance`, so a legitimately added page never
fails the suite. It pins overlay precedence including the cleared-to-empty
case, that a `title-only` card emits a page choice and never a description,
that an external entry in a `title-only` block has its description reported as
dead while the same entry in an inheriting subsection keeps it, that
`callout.title: false` is absence rather than a title, that bullets fold into
the paragraph value instead of becoming a block, that an inline
`[label](pageKey)` link surfaces separately with its Karl representation named,
and that the 120-character `cost` cap measures the OVERLAID value — a reviewer
can push a short authored value over the cap and pull a long one under it, so
measuring the original reports the wrong page in both directions.
Mutation-proven against two deliberate breakages: emitting a description for a
picker card, in each of the two places one could be emitted), and
`module-paths` (the gate that fails when a `js/<name>.js` path mentioned
anywhere in a tracked file names no file on disk. An import breaks the build
and a `require()` throws, but the same path sitting in a comment or a markdown
doc is read by people and checked by nothing, so a moved module leaves behind
a sentence that confidently points at nowhere — the same rot class as a stale
`docs/codebase/STRUCTURE.md`. The check is deliberately dumb, matching
path-shaped strings rather than parsing real references, which is why an
EXEMPT list carves out the handful of deliberately-fake paths and states each
one's reason; `docs/superpowers/` is SKIPped rather than fixed, since those are
dated records correct on the date they were written. Mutation-proven: a
deliberately fake path appended to the file fails the test, naming itself —
which only works once the file is tracked, since the scan reads `git
ls-files`. That is not incidental: the test's own header comment quotes a
now-deleted module as a worked example, so once this file joined the tracked
tree it had to add that quoted path to its own EXEMPT list rather than widen
SKIP or weaken the regex to make the self-reference disappear).
**That list is spelled out explicitly in `package.json`'s `test` script rather
than globbed**, so a newly added `tests/*.test.js` runs only once it is named
there; until then it passes locally when invoked by hand and covers nothing in
CI. `tests/helpers/browser-env.js`, preloaded via `bunfig.toml`, registers a
**happy-dom** global environment before the loader runs (the module graph does
real work at import time), restores Bun's native `fetch`/`Request`/`Response`
afterwards since happy-dom's HTTP client breaks `review-api-server`'s real
requests, and redefines `window`/`document`/`localStorage` as writable so
`review-state-sync`'s tests can still stub them.

`bun run test:e2e` drives Playwright over `tests/e2e/` — twenty-two spec files
all UI-driven: navigation, editor panel, review workflow, review
queue, review-queue undo, stored review data, import/export, keyboard
shortcuts, workspace panels, accessibility, AI assist, AI rewrite, mockup PNG
export, Overview insight cards, adding and deleting page mockups, mockup
SFDS tokens, the chrome type scale, the Karl transcript panel, and
workshop-form submission handling,
sharing plain helper functions in
`tests/e2e/helpers.js` (no fixture framework). A fourteenth file,
`review-import-export.spec.js`, was deleted rather than repaired: its
round-trip tests hand-rolled the merge inside `page.evaluate()` instead of
calling `importReviewStateBackup()`, so it stayed green against the wholesale
replace that once destroyed reviews, and its other two tests duplicated
existing coverage. `import-export.spec.js` is the real coverage.
**`gotoFresh()` waits on `window.reviewKeyboardShortcuts.ready`**, not just the
sticky bar — the bar mounts early, so waiting on it alone let a test press a
global shortcut before `js/keyboard-shortcuts.js` had attached its `keydown`
listener. Playwright's `webServer` block starts `bun run start` on `:8080`
itself. In a sandbox with a pre-installed Chromium, point Playwright at it
instead of downloading:

```bash
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/opt/pw-browsers/chromium bun run test:e2e
```

`bun run validate` (`build_scripts/validate.js`) is a **complementary, not
redundant** check: it loads every `pages/*.js` file plus `js/page-data.js`
into a Node VM context and Zod-validates required fields/shapes, plus several
hardcoded business invariants (see below). It always validates the full page
set — there's no way to validate a single page file in isolation. **Run
`bun run validate` and `bun run test` after editing anything under `pages/`
or `js/page-data.js`.**

### CI

`.github/workflows/ci.yml` runs on pushes to `main` and on every pull
request, in two deliberately separate jobs so a formatting or schema failure
reports in seconds without waiting on a Chromium download, and a flaky
browser run never masks a unit failure:

**Both jobs pin Bun from `.bun-version`, and that pin is load-bearing.** They
took `bun-version: latest` until 2026-08-15, so the runtime changed under the
repo with no commit. Bun 1.3.14 stopped letting CJS `require()` an ESM module;
`build_scripts/storage.js` was the only ESM file under `build_scripts/`, so
`server.ts` threw at boot and every suite spawning it reported "did not start
in time" — passing or failing per run depending on which Bun `latest` resolved
to. **Everything under `build_scripts/` is CommonJS now**; keep it that way,
since `server.ts` named-imports those modules from TypeScript, which is the
supported direction. Bumping `.bun-version` is fine, just deliberate.

- **checks** — `bun install --frozen-lockfile` → `format:check` → `validate`
  → `build:netlify` → `test`. `build:netlify` doubles as a deploy-integrity
  check: it fails if the committed workshop-form `dist` references assets
  that were never committed (the "form shell that never hydrates" regression).
  **It runs before `test` on purpose**, even though that delays a unit
  failure by a build: one test in `tests/review-api-server.test.js` asserts
  that a set-but-empty `STATIC_ROOT` still serves the real built app, and it
  can only tell a correct fallback from a broken one if `dist/` exists. It
  skips itself when there is no build — so with the fast order it passed by
  skipping and covered nothing.
- **e2e** — installs Playwright Chromium and runs `test:e2e`, uploading
  `playwright-report/` as an artifact on failure (traces are on-first-retry).

**A second workflow, `.github/workflows/link-check.yml`, runs weekly rather than
per-PR.** It checks the links in this repo's own DOCUMENTATION — never mockup
content, whose links are page keys `bun run validate` already resolves offline.
Of its 48 links, 32 are cross-file anchors between `AGENTS.md`, `CLAUDE.md` and
`.github/copilot-instructions.md`, and that local half is what earns the
schedule: markdownlint's MD051 validates a fragment against the file it sits IN,
so an anchor into another file is unchecked by everything else, and the first run
found `CLAUDE.md`'s `#local-persistence` dead because its heading had grown a
parenthetical while `AGENTS.md`'s had not. The 16 external links are
documentation hygiene rather than a shipping concern — the same run found three
dead SF.gov exemplars in `docs/sfgov-live-design-inspiration.md`. It is
deliberately NOT a gate: a third-party outage must not be a reason a merge cannot
happen. A failure opens (or comments on) an issue, because a scheduled workflow
nobody watches is the same defect as a gate that cannot fire. **One measured
coverage gap:** sf.gov reported a known-404 path as OK from a GitHub runner while
returning 404 locally, so an sf.gov citation is verified by running
`bun run check:links` locally, not by this schedule. The workflow's own header
records the evidence.

## Architecture

### Data-driven rendering, no framework

Each file in `pages/*.js` assigns a page object onto the global
`window.HHVC_PAGES['<pageKey>']`. `js/page-data.js` then builds
`window.HHVC_DATA = { pages, order }`, where `order` is the array of
`[pageKey, menuLabel]` pairs driving navigation/menu order.

**Load order lives in `js/main.js`, not `index.html`.** `index.html` has exactly
one script tag — `<script type="module" src="/js/main.js">` — and `js/main.js` is
the root of the module graph: CSS, then the three third-party libraries, then the
core modules, then the review/UX layers. The old model (~47 classic `<script>`
tags sharing one global lexical scope) and the committed `js/vendor/` IIFE
bundles are both gone; Fuse.js, defu and papaparse are npm imports now.

Order is enforced two ways. **Core modules enforce it themselves** — a module
that needs `escapeHtml` imports it, and `js/state.js` imports
`js/page-registry.js`, which imports `js/page-data.js` first, which imports all
27 `pages/*.js`, so `window.HHVC_DATA` is always populated before anything reads
it — and the reviewer's added/deleted pages are applied before `ORIGINAL_DATA` is
cloned. **The self-mounting IIFE subsystems still depend on
listed order** — `js/ux-improvements*.js`, `js/review-queue*.js`,
`js/dashboard-guidance.js` and
`js/keyboard-shortcuts.js` reach each other through `window.<Namespace>`
objects rather than imports, so their sequence in `js/main.js` is load-bearing
and hand-reviewed.

Note that "no imports" would be too strong, and used to be written that way:
only `js/review-queue*.js` takes none. The others do import — `js/utils.js`
helpers, and four imports in `js/dashboard-guidance.js` — so the module graph
already orders them against the _core_. What it cannot order is the part that
matters here: a `window.<Namespace>` a sibling IIFE assigns at mount time is
invisible to the graph, so that edge is still enforced only by this list.

A few functions are deliberately republished onto `window`, because callers
depend on the implicit globals the old shared scope provided: `window.renderPage`
(`js/ux-improvements.js` wraps it to refresh after navigation — the decorator
only forms if the original is on `window`; it is the last of three, the other
two having been the deleted `js/interactive-sitemap.js` and
`js/manager-review-export.js`, whose decorator went with the sidebar label it
refreshed), `window.toggleSidebar` (an inline
`onclick` in `index.html`), `window.showToast` and `window.updateSearchPreview`
(called optionally by the IIFE layers, which degrade to silence rather than
throw), and `window.ORIGINAL_DATA` (read by `js/review-state-sync.js`).

When adding a new page file: add `import '../pages/<file>.js'` to
`js/page-data.js` and a `[pageKey, menuLabel]` entry to its `order` array. A new
`js/*.js` module just needs an importer; if it is a self-mounting IIFE with no
importer, add it to `js/main.js` in the right position. Node-side scripts
(`build_scripts/`, `tests/`) hardcode no file lists — they discover `pages/*.js`
dynamically via `build_scripts/load-pages.js`. If you forget the page import,
`bun run validate` catches it: `build_scripts/page-import-checks.js` diffs
`pages/*.js` on disk against `js/page-data.js`'s imports. Vite already turns the
reverse case (an import naming a missing file) into a build error, but a page
nobody imports fails silently — it never registers onto `window.HHVC_PAGES`, so
the page just disappears. Import _order_ isn't checked; it's irrelevant, since
each page module only writes into `window.HHVC_PAGES` and navigation order comes
from the `order` array.

### React islands in the workspace

The review workspace renders through **React 19 + MUI**, mounted as islands inside `#reviewWorkspace`. Everything else — the sidebar, the toolbar, and above all `#mockPage` — is untouched plain JS and string templates, and **that boundary is the point**: Material styling on the mockup would misrepresent the page under review, so tool chrome is fair game and `.browser-shell` is not. The isolation is measured rather than assumed, and it holds because MUI emits scoped `.css-*` classes and **there is no `CssBaseline`** — that writes element-level rules on `html`/`body`/`*` and Emotion injects after the eleven stylesheets, so it would win ties inside the shell; use `ScopedCssBaseline` inside a panel if a reset is ever needed. `js/react/theme.js` is the only bridge to the design tokens, so retheming still means editing `css/theme.css` only. `.jsx` files live under `js/react/` and need `@vitejs/plugin-react`; Prettier still formats them, so `format:check` gates. Full rationale — the measurement, why the theme resolves tokens to literal values, why dark mode follows `prefers-color-scheme` only, and why each island needs its own child `<div>` — in the `hhvc-react-islands` skill.

### Card descriptions are inherited, not printed

A Karl Services/Resources subsection entry, a Related-panel entry, and a Resource Collection's Resource-section entry are all only page pickers, so their title always publishes as the **destination** page's own title. A card in `pages/*.js` carrying its own `text` was therefore showing reviewers copy that can never appear on SF.gov — which matters more here than in most codebases, because approving that copy is the entire point of the tool. `js/page-render.js` resolves **every** card description through one helper, `cardDescription(section, card)`, instead of printing `card.text`; an empty resolved description renders no element, not an empty one. **There are three buckets and they key on the section's `karl` note, NOT on `section.component`** — `inherits` renders the destination's title AND summary, `title-only` renders a title and a link and **nothing else**, `authored` writes its own words and is left untouched. Keying on `component` would corrupt Table and Title-and-text blocks, which is not hypothetical: it was the first version. **`js/card-inheritance.js` is dual-exported** exactly like `js/review-merge.js`, so the browser renderer and the Node audit cannot come to disagree about what inherits. Full rationale — the three buckets verified at DOM level, why `bun run audit-cards` is a report rather than a CI gate, and the sf.gov census that settled external-URL entries — in the `hhvc-card-inheritance` skill.

### Core module split (formerly one `app.js`)

The old monolithic `app.js` was split into focused modules — **do not
re-monolith them.**

- **`js/utils.js`** — 849 lines publishing 36 entries on `window.utils`, also
  exported as bare top-level functions. Loads first. Beyond the obvious
  (`escapeHtml`, `today`, `debounce`, CSV parse/serialize/download, DOM
  get/set) it owns **`safeUrl`/`urlProbe`** (the scheme guard described below),
  the **decision vocabulary** (`DECISIONS` and its derived maps — the canonical
  list nothing else may restate), and `buildReviewRecord`/
  `REVIEW_RECORD_FIELDS`. **Add new cross-cutting helpers here** rather than
  duplicating logic — though the module has drifted toward a grab-bag, and
  `isWorkspacePanelOpen`/`mountWorkspacePanelIfOpen` sit here as a layer
  inversion: the bottom-most module reaching up into the workspace DOM.
- **`js/karl-tag-meta.js`** — the shared `KARL_TAG_KINDS` table (`meta`,
  `body`, `placement`, `editor`) and legend markup used by `karlTag()` and the
  workspace legend. Loads after `js/utils.js` for `escapeHtml`.
- **`js/state.js`** — core state: `DATA`/`ORIGINAL_DATA` (a deep clone used
  for field-reset), `pageData`, `pageOrder`, `currentPageKey`.
- **`js/ui-controls.js`** — toasts, sidebar collapse/scroll persistence, the
  page-picker `<select>`, and the review checklist.
- **`js/editor-panel.js`** — SEO/editor panel: syncing input fields with the
  current page, dirty-state indicators, search-result preview, per-field reset.
- **`js/page-render.js`** — turns `pages/*.js` page objects into the `#mockPage`
  HTML, including `karlTag()` for Karl CMS placement annotations and the
  `unverifiedPill()` warning badge.
- **`js/page-registry-data.js`** — pure validation for a page a reviewer
  authored in the browser, plus `applyRegistryToData()`, the only function that
  mutates `order`/`pages` for the add/delete feature. Dual-exported and
  import-free; it is evaluated far earlier than the other dual-export modules
  (through `js/page-registry.js`, before `js/state.js`), so unlike
  `js/inline-content-edit-data.js` it must not resolve anything off `window` at
  module scope — `js/utils.js` is not guaranteed to have run yet.
- **`js/page-registry.js`** — applies that registry onto `window.HHVC_DATA` and
  publishes `window.pageRegistry`. Must run before `js/state.js`'s
  `ORIGINAL_DATA` clone; see the `hhvc-page-registry` skill for why.
- **`js/card-inheritance.js`** — the shared classifier deciding whether a
  section's cards publish the destination page's title and summary
  (`inherits`), its title alone (`title-only`), or their own authored words
  (`authored`). It imports nothing and reads no global, so it has no load-order
  dependency of its own — it must simply be evaluated before anything calls
  `window.cardInheritance`, which `js/page-render.js`'s own import of it
  enforces. Dual-exported (`window.cardInheritance` plus `module.exports`)
  exactly like `js/review-merge.js`, and for the same reason: see "Card
  descriptions are inherited, not printed" above — the browser renderer and the
  Node audit must share one classifier rather than two copies free to drift.
- **`js/app.js`** — bootstraps DOM event listeners (`init()`) and kicks off
  the first `renderPage('pestsTopic')`.
- **`js/manager-review-export.js`** — manager review CSV/JSON export
  snapshot, published on `window.ReviewExport` for the consolidated export
  control. It no longer wraps `renderPage`: that decorator existed only to
  refresh a sidebar label that has been cut.
- **`js/standards/reading-level.js`** — Flesch-Kincaid grade level for body copy, backed
  by `text-readability` (a runtime dependency, bundled: 40 kB raw / 17.9 kB
  gzip). **There used to be two implementations and now there is one.** This
  file carried a hand-rolled formula from the no-build-step era while
  `build_scripts/reading-level.js` wrapped the library for Node — and only the
  Node copy had tests, while only this one shipped. They disagreed by 1.14
  grades on average across the 29 pages, always in the direction of "easier
  than it is", so nine pages reported hitting a reading target they miss. The
  Node copy is deleted; `tests/reading-level.test.js` now imports this one.
- **`js/review-state-validation.js`** — browser-side validation of the
  `hhvcManagerReviewState:v1` blob, mirroring
  `build_scripts/review-state-schema.js`'s Zod rules without shipping Zod to
  the browser. Keep the two in step when the persisted shape changes.

### Review/UX layers are additive, on top of the core

`js/ux-improvements.js`, `js/review-queue.js`, `js/dashboard-guidance.js`,
and `js/keyboard-shortcuts.js` are self-contained
IIFEs that read `window.HHVC_DATA` and `localStorage`. Some write edited
title/summary/CTA/SEO fields back onto the **in-memory** `pageData` objects when
restoring saved edits — but **must never write back to the `pages/*.js` source
files or publish content.** They are review aids only, not publishing tools.

`js/ux-improvements.js` and `js/review-queue.js` are
thin orchestrators (event wiring + `init()` + public API) over sibling files that
do the work, each attaching functions to an internal `window.<Namespace>` object
(implementation detail — never referenced from `pages/*.js`):

- **`window.ReviewUx`** ← `js/review-state-store.js` (shared `window.reviewState`
  read/write/update), `js/ux-improvements-state-sync.js`,
  `js/ux-improvements-workspace.js`, `js/ux-improvements-export.js`.
  `js/review-merge.js` (`window.reviewMerge`) and `js/review-state-sync.js`
  (`window.reviewStateSync`) sit alongside these as their own small globals —
  not under `window.ReviewUx` — since `js/review-merge.js` is also imported
  directly by `server.ts` (no DOM dependency) and needs no browser-only
  namespace.
- **`window.ReviewQueueInternal`** ← `js/review-queue-state.js`,
  `js/review-queue-rows.js`, `js/review-queue-render.js`, and
  `js/review-queue-import.js` (CSV import — kept isolated as the
  highest-regression-risk area; see [Local persistence](#local-persistence)).
- **`window.ReviewInsights`** (`js/review-insights.js`) ←
  `js/review-insights-data.js`, which attaches `.data`. The Overview cards;
  `js/review-queue-render.js` calls `window.ReviewInsights.render()` at the end
  of its own render, optional-chained.
- **`window.ReviewOps`** (`js/review-ops.js`) ← `js/review-ops-data.js`, which
  attaches `.data`. The stored-review-data panel, a collapsed section in Help.
- **`window.MockupImageExport`** (`js/mockup-image-export.js`) — PNG export of
  the mockups, standing on its own.

- **Three lazily-mounted panels publish a mount hook rather than rendering at
  init:** `window.__mountAiAssistOnTabOpen`, `window.__mountReviewOpsOnTabOpen`
  and `window.__mountPageRegistryOnTabOpen`.
  All three are collapsed `<details>` at the end of the Help panel now rather
  than tabs of their own, so `setWorkspaceTab` calls **all three** when Help
  opens — a
  reviewer expanding one must never find an empty box. Each panel ALSO catches
  an already-open tab at its own `init()` via `mountWorkspacePanelIfOpen('help')`
  in `js/utils.js` — `js/ux-improvements.js` initializes earlier and restores a
  persisted `workspace_tab` before these hooks exist, so without the catch-up a
  reviewer who left Help open came back to an empty panel.

- **AI assist breaks that naming pattern — mind the case.** `window.AiAssist` is
  the **internal** namespace (`js/ai-assist-client.js` attaches `.client`, the
  browser half of the optional `/api/ai/*` routes and a no-op unless configured;
  `js/ai-assist-render.js` attaches `.render`). `js/ai-assist.js` consumes both,
  owns the request lifecycle and cancel, and publishes its public API on the
  separate lowercase **`window.aiAssist`** (`ensureRendered`,
  `refreshCapabilities`, `getCurrentPage`, `captureForm`). `window.AiAssist.ensureRendered`
  does not exist.

The workspace tab strip is `['overview', 'checks', 'help']`, numbered left to
right by the `1`–`3` shortcuts. It carried six until a UX review cut three:
**Sitemap** was removed outright (a fourth way to navigate 24 pages, drawing a
hierarchy one level deep), and **AI assist** and **Tool status** became
collapsed `<details>` at the end of Help — both depend on `server.ts`, which the
Netlify deploy has no runtime for, so on the build managers actually open they
were two permanently-empty panels holding two of six slots. Help stays last, so
it is the digit that moves whenever the strip changes; `WORKSPACE_TABS`
(`js/ux-improvements-workspace.js`), the tab markup in `index.html` and the
`1`–`3` cases in `js/keyboard-shortcuts.js` must change together. The two
surviving lazy panels **also catch an already-open Help tab at their own
`init()`** — `js/ux-improvements.js` initializes earlier and restores a
persisted `workspace_tab` before those hooks exist, so without the catch-up a
restored tab painted empty until the reviewer switched away and back.
Relatedly, `hhvc:shortcuts-ready` and
`window.reviewKeyboardShortcuts.ready` are set **from `init()`, after** the
`keydown` listener is attached; firing at module scope announced a capability
that did not exist yet.

### The workspace is docked, not stacked

`#reviewWorkspace` is a **third grid column in `.app`**, sticky to the viewport, not the last child of `.canvas` — a reviewer has to see the page and the instruments judging it at once, and stacked it began more than nine screenfuls down. Most of the redundancy this layout accumulated followed from that, so **resist re-adding a second printing of anything**: co-visibility is what makes one copy enough. `applyWorkspaceVisibility()` in `js/ux-improvements-workspace.js` is the single place that toggles both the panel's `hidden` attribute and `.app.workspace-docked` — do not set either one inline. **`.review-workspace[hidden] { display: none }` is load-bearing**, since the rule above it sets `display: flex` and a class selector outranks the UA stylesheet's `[hidden]` rule; without the pairing, "Hide workspace" and the `w` shortcut both appear to do nothing. **Below 1700px the panel stacks in `grid-column: 2`, deliberately not `1 / -1`.** **The 1700px breakpoint is measured — re-measured on 2026-08-15 after the SFDS type and spacing work moved `.browser-shell`'s min-content floor, and deliberately kept at 1700 rather than lowered onto the new 1650 crossing. Do not lower it without re-measuring both numbers**; the crossing is asserted from the live layout in `tests/e2e/workspace-panels.spec.js`. Full rationale — the y=9,413 measurement that motivated the dock, the Axe finding behind `grid-column: 2`, the arithmetic behind 1650 and 1700, and why a layout assertion should sweep a range of widths rather than pick one — in the `hhvc-workspace-layout` skill.

### What the UX review removed, and why not to re-add it

- **The Karl-tag legend above the mockup.** A toggle, a four-row `TAG COLORS`
  key, an explanatory sentence and a "What are Karl tags?" disclosure occupied
  ~495px — half a screen — between the toolbar and the SF.gov header, on every
  page and every load. The key decoded something that was never encoded in
  colour alone: each tag already reads `METADATA`, `BODY`, `PLACEMENT` or
  `EDITOR ONLY` in words. The switch moved into `.canvas-toolbar`; the legend
  renders once, in Help, via `renderKarlTagLegend()`. `mountKarlTagLegend()` is
  gone with both of its mount points — `#karlTagLegendCompact` had no element in
  `index.html` at all and had been a no-op for some time.
- **Three of four Overview KPI tiles.** "Visible" restated the "N of 19" printed
  directly above it. "Blocked" showed `stats.blocked`, which counts Blocked
  **plus** Revise and resubmit (`js/review-queue-rows.js`) — so it read 5 while
  the Blocked filter chip forty pixels away read 2. Both numbers were correct
  and the label was not, and a panel that visibly disagrees with itself in its
  first two rows spends the credibility the rest of it needs. The decision tally
  belongs to the filter chips, which count and filter with one control.
- **The open page's name, printed four times.** The sidebar picker, a "Current
  page:" label directly under it, a "Viewing: …" badge in the toolbar, and the
  sticky bar. The middle two are gone — and with the label went the only reason
  `js/manager-review-export.js` wrapped `renderPage` at all, so that decorator
  went with it.
- **The decision `<select>`.** It sat directly above five chips writing the same
  field: two controls, one value. `#reviewDecision` survives as an
  `<input type="hidden">` rather than being deleted, because it is the field
  every persistence path reads and writes through `getValue`/`setValue`, and its
  `change` event is what autosave, `isDecisionRound()` and the sticky bar all
  listen for. The chips carry the visible and accessible semantics. E2E specs
  set it through `setDecision()` in `tests/e2e/helpers.js`, not `selectOption`.
- **Six of nine export/import controls.** Five ways to get review data out, in
  two formats, split across the sidebar and the Overview panel, with nothing on
  screen distinguishing "Export current review JSON" from "Download backup
  (JSON)" from "Export saved local reviews CSV". There is now one **Export
  reviews** button with a scope `<select>` (`runExport()` dispatches on it) and
  one **Import reviews** button whose file input accepts either format
  (`importReviewFile()` routes by extension). The queue's separate "Import CSV"
  button is gone. Fewer doors into the merge path is a safety property here, not
  just tidiness — see "Local persistence" below for the regression that makes
  this the highest-consequence surface in the tool.

### Checks that cannot fail are not scored

`getRuleResultsFor()` marks **Page type**, **Audience** and **Reading target**
with `scored: false`. All three are required by `build_scripts/schema.js` and
enforced by `bun run validate` in CI, so no page that can ship will ever fail
them: scoring them handed every page three free passes, lifting every ratio by a
constant and burying the rules that do fail under a wall of permanent green.
(Note that **Reading target** only checks that a target is _declared_ — whether
the copy hits it is `Computed reading level`, which is scored and does fail.)

`window.reviewChecks.scoredRules()` is the filter, and both the Checks panel and
the queue's `checksPassed`/`checksTotal` go through it. The three still render,
under a "Page facts" subheading, and the scored list orders **failures first** —
it used to render in declaration order, so on a page passing all but one rule a
reviewer scanned a column of green to find the single item they could act on.

### Content-standards scoring

`js/standards/plain-language.js` scores page copy against written standards, not
preferences. Each check carries `severity` plus a `source`/`section` pair and
a ready-to-render `citation`:

- **`severity: 'error'`** are the standards manual's mandates. They join the
  scored rule list behind the Overview tab's "checks passed" ratio, and their
  citation renders on the Checks tab alongside the rule.
- **`severity: 'warning'`** are advisory, run to ~115 across the 29 pages, and
  render separately — folding them into the ratio would make every page look
  broken.
- A scored rule must always be **pushed**, passing or failing, never omitted
  when it can't be computed: dropping one shrinks the denominator and quietly
  flatters exactly the thinnest pages.
- `source` exists because not every rule comes from the manual. Two
  (`house-style`, `list-length`) cite the vendored `docs/source/sfgov-style/`
  snapshot, and `button-length` cites manual §6.3 (the Karl Button component),
  not §7.8. Requiring a bare §7.x number is what previously pushed all three
  into miscitations.

Like `js/review-merge.js` it is **dual-export** (`window.plainLanguage` plus
`module.exports`, no DOM dependency) so the AI output validator and the tests
run the same implementation the Checks panel does.

### URL schemes are validated, not just escaped

`escapeHtml` does not neutralize a scheme — `javascript:alert(1)` contains
none of the five characters it escapes — so every structured `href` in
`js/page-render.js` goes through `safeUrl()` from `js/utils.js`, **except
`formatMarkdown()`'s inline `[label](target)` links** (`js/page-render.js:51`),
which gate on a bare `/^https?:\/\//` instead. Not a hole today: `escapeHtml`
runs over the whole string first so the attribute cannot be broken out of, and
the regex admits only `http(s)`, which `safeUrl` allows anyway. `safeUrl`
allows
`http`/`https`/`mailto`/`tel` **and anything without a scheme at all** —
root-relative (`/forms/…`), document-relative (`help/foo`, `../help`), and bare
fragment or query targets (`#top`, `?q=1`) all pass through unchanged. It is a
_scheme_ guard, not a URL allowlist: what it rewrites to the inert `#` is a
recognized-but-unsafe scheme (`javascript:`, `data:`, `vbscript:`) and
protocol-relative `//host`, which reads as relative but leaves the origin. It
strips control characters before testing, since browsers resolve
`java\tscript:` as `javascript:`.

Two normalization details matter, because `findUnsafeUrls()` decides by
comparing `safeUrl(value)` against the original. Control characters are removed
only from the string being _tested_, so an accepted URL keeps them — but
leading and trailing whitespace is trimmed from the **returned** value. **A
whitespace-padded but otherwise safe URL is therefore reported as an "unsafe
URL scheme"**, which is a false positive rather than intended behaviour: the
check is about schemes, not whitespace hygiene. No page carries a padded URL
today, so nothing is currently broken. `findUnsafeUrls()` in `build_scripts/data-checks.js` enforces the
same rule at validation time — in `bun run validate` **and** in the AI output
validator — and imports `safeUrl` rather than restating it, so the renderer
and the validator cannot come to disagree about what is safe. That import
crosses the CJS/ESM boundary — CJS `require()`ing ESM, the direction Bun 1.3.14
dropped for `build_scripts/storage.js`. **This one is not the same case, and the
difference was measured** (2026-08-15, Bun 1.3.14): Bun rejects `require()` only
of an ASYNC module, and `js/utils.js` has no top-level await and imports
nothing, so the crossing works. The line is narrower than "no top-level await" —
`await Promise.resolve()` requires fine, `await new Promise((r) => setTimeout(r,
0))` and `await import('node:path')` both throw — so the hazard is one
_deferring_ await away, surfacing as `bun run validate` dying with a TypeError
that names neither validate nor the page data.
`tests/data-validation.test.js` guards it in a **subprocess**; two in-process
versions were written first and both passed against a deliberately broken
`js/utils.js`, since a sibling test that ESM-imports it leaves it cached.
**If that guard fails, remove the await — do not restructure `safeUrl`**: it is
the XSS scheme guard, and on the BROWSER side every dual-export module in
`js/` is read off `window` rather than named-imported (Node `require`s them
directly, which is the half that works), so extracting `safeUrl` would push
`js/page-render.js` onto window indirection for no gain. Separately,
**CI never exercises that crossing under Node** —
every path that loads `data-checks.js` runs under Bun (`bun run validate`, and
`build:netlify`, which invokes `bun build_scripts/validate.js`). CI _does_ run
Node, at the end of `build:netlify` (`node build_scripts/copy-workshop-form.js`),
but that script never touches `data-checks.js`, so the `require(esm)` path is
_not_ covered. (That path
needs `require(esm)` enabled — check `process.features.require_module` rather
than trusting a version number; it is opt-out by default on current Node 22 but
was flag-gated in early 22.x.) Anything
relying on Node-specific interop here would go unnoticed.

### Overview insight cards (`js/review-insights*.js`)

Two compact cards above the review queue table — review activity over time (a chart) and the pages whose automated checks are failing (a ranked list). They sit on the **Overview tab rather than a workspace tab of their own** on purpose: a tab is a scarce slot bound to a number key. There were three cards, and the two that were cut — Decision mix and a Checks-needing-attention bar chart — are worth not re-adding. `js/review-insights-data.js` is the pure data shaping, dual `window`/`module.exports` like `js/review-merge.js`; `js/review-insights.js` orchestrates; `js/review-insights-charts.js` is the only module that imports ECharts. **That import is dynamic, and that is load-bearing rather than tidiness** — ECharts is ~530 KB raw / ~180 KB gzip, more than the entire rest of the bundle, so it must stay its own chunk; and the headings and data tables are built **synchronously, before the import is requested**, so the numbers are in the DOM even if the chunk never loads. **Colour is never the only encoding**, and decision fills use `--viz-decision-*` rather than the `--status-*-border` chip tokens — if you change those, re-validate the contrast rather than eyeball it. Full rationale — why each cut card was cut, the re-parented chart host and its generation counter, and the ΔE measurements — in the `hhvc-review-insights` skill.

### Karl transcript export (`js/karl-blocks.js`, `js/karl-transcript.js`)

A paste-ready, per-page instruction listing what an editor types into Karl,
field by field, in the order Karl's own form presents. `bun run export:karl`
writes one markdown file per page into `review/karl-transcripts/` (gitignored,
regenerate rather than edit); a collapsed section at the end of the **Help** tab
renders the same transcript for the open page with this browser's edits applied.
**A human performs every keystroke** — no API writes, no credentials, no
publishing path — so the standing rule that a review layer never writes back to
`pages/*.js` and that an export is never publication approval survives intact.
A transcript changes what an export contains, not what it authorizes.

- **`js/karl-blocks.js` is transcribed from `docs/karl-export-field-map.md`, not
  parsed from it.** Half the mapping lives in prose footnotes under the tables —
  a Callout has no title field, the cost description caps at 120 characters,
  bullets fold into the Text block's rich text — and a parser reading only the
  tables loses exactly those and reports success. `tests/karl-blocks.test.js`
  parses the document instead, so drift goes red in CI without the runtime
  depending on the prose staying machine-readable. Every row of every per-type
  table is transcribed, including the rows with no mockup source: `primary_agency`
  is required on seven of the eight types and this tool has no field for it
  (`U6`), so the transcript has to say so rather than leave a hole the editor
  discovers when Karl refuses to save.
- **A panel's `source` is a tagged union, not a dotted path.** The field map's
  Mockup source column is a PREDICATE on six of the eight types (`section` with
  `component: 'supporting'`, `component: 'services'` sections, `section with
cards[]`) and a path only on Transaction's scalars, so a path resolver would
  cover one type and leave the rest silently empty.
- **Card inheritance decides TYPE versus CHOOSE**, through the one
  `js/card-inheritance.js` classifier, passed in rather than re-derived. An
  `inherits` or `title-only` card is a picker, so the transcript says _choose
  page X_ and never _type this description_ — emitting a description for a
  picker is the exact defect that classifier exists to prevent, and here it
  would become an instruction a human executes. A section the classifier returns
  `unknown` for is FLAG, never a guessed TYPE: guessing TYPE reintroduces that
  defect and guessing CHOOSE silently drops authored copy.
- **Two panels can match one section, and the transcript emits each half once.**
  Several panels carry two sources that overlap — Information's `related`
  matches both `component: 'related'` and any `title-only` card section, and a
  Related panel is usually both — so matches are unioned and DEDUPED BY SECTION
  INDEX per panel, first source winning. Where two DIFFERENT panels legitimately
  share a section, a `source.emit` scope splits it: a Resource Collection
  section carrying `paragraphs[]` and `cards[]` sends its prose to
  `introductory_text` and its links to `body`, because the first is a
  Title-and-text block with no chooser at all. Neither existing gate could see
  this — `consumed` is a Set, so a double emission is invisible to the unmapped
  sweep, and both ratchets are about UNDER-coverage — so
  `tests/data-validation.test.js` asserts the other half against the real
  corpus: no section is emitted twice into the same scope.
- **A plain Transaction body section reaching `custom_section` is an INFERRED
  mapping and prints as one.** Transaction has no generic body stream and
  `custom_section` is its only repeatable Title-and-text panel, but the field map
  claims that panel only for `supporting`/`flat` sections. Nineteen sections
  depend on it; the alternative was exporting a fifth of the heaviest type's
  body copy as "no Karl destination".
- **`findUnmappedSections` is a gate, not a report** — unlike `bun run
audit-cards`, because "there is nowhere in the CMS for this to go" is a
  structural fact about the content rather than a per-card content judgement.
  Its exemptions in `karl-blocks.js`'s `UNRESOLVED` table are SHAPE rules, never
  page keys or paths: an allowlist would let a newly authored section inherit an
  old exemption just by landing at the same index, which is the case the ratchet
  exists to catch. Closing a register entry upstream means deleting its rule, and
  every section it covered fails until it is mapped. It found three gaps nobody
  had recorded, now open as `U21`/`U22`/`U23`.
- **Approval is per page, not per field.** The review record carries `decision`
  and no field-level approval, so a not-Approved page is marked in the header
  AND on every panel rather than exported as though it were signed off.
- **The CLI reads no review state and says so.** That lives in the browser's
  `localStorage`, so every CLI transcript is headed _no review recorded_; the
  Help-tab panel is the path that carries a reviewer's edits.

### Queue undo (`js/review-queue-undo.js`)

One step of undo for row and bulk decision actions. `applyQueueAction` in
`js/review-queue-rows.js` is the single funnel every such action goes through,
so it is the only place a snapshot is recorded.

- **The undo is a new round, not a deletion.** `history[]` is append-only —
  `mergeReviewRecord` is the only thing that ever constructs an entry, and it
  only ever appends — so undoing writes the previous content back as another
  recorded round. The trail reads "set to Approved, then reverted", which is
  what happened. Removing the entry would let a reviewer quietly erase a
  decision from the record.
- **A page edited since the action is skipped, not rolled back.** Each snapshot
  entry stores the `updated_at` its own write produced; if the stored record no
  longer matches, something else has touched the page (sidebar, import, sync
  pull) and restoring the pre-action content would discard newer work. The
  toast reports the skipped count rather than claiming a clean undo.
- **One level deep, and consumed on use.** A stack would imply an undo history
  the review state cannot reconstruct, since every undo is itself a
  forward-only write. The button also leaves the bulk bar once pressed, so a
  second press cannot reverse a different set of pages than its label named.
- It lives in the bulk bar rather than in the action toast, because toasts
  self-dismiss after 4s — far too short to notice a wrong bulk action and
  reverse it. Keyboard shortcut `z`.

### Inline content editing (`js/inline-content-edit*.js`)

Click-to-edit directly on the rendered mockup — every visible text field except cards, persisting through the same `localStorage` review-state model as every other field. A review aid: `pages/*.js` is never touched. **The scope is one list, `EDITABLE_FIELD_SHAPES` in `js/inline-content-edit-data.js`**, declaring each editable path and the value shape (`string`, `textArray`, `stringArray`, `table`) its stored entry takes. **A path stamped `data-rewrite-field` by a renderer but missing from that list silently loses the reviewer's edit on the next load** — step text was in exactly that state and is the reason the list exists; add the path in both places or neither. **Cards deliberately carry no `data-rewrite-field`** — an inheriting card's description IS the destination page's `summary`, so an edit here would appear to work and then vanish; do not "complete" the feature by adding it. Full rationale in the `hhvc-inline-content-editing` skill.

### Adding and deleting pages (`js/page-registry*.js`)

A reviewer can create a page mockup and delete an existing one from the browser. Same posture as every other layer: `pages/*.js` is never written, no backend, works on the static build. `js/page-registry.js` MUST stay imported by `js/state.js` so it runs before the `ORIGINAL_DATA` clone. Full rationale — including the restore-snapshot hazard that silently drops inline edits — in the `hhvc-page-registry` skill.

### Stored review data (`js/review-ops*.js`)

A collapsed section at the end of the **Help** tab reporting what this browser is actually holding and how it is connected — previously only visible in devtools. `js/review-ops-data.js` is the pure diagnostics, dual `window`/`module.exports` so the tests need no browser; `js/review-ops.js` is the panel, lazily mounted when Help opens with the same `mountWorkspacePanelIfOpen()` catch-up the AI assist panel uses. Two invariants are safety-shaped and stay here. **An empty page-key set reports NO orphans, not all of them** — an empty set means page data has not loaded, and the other reading would put a "remove these" button in front of the reviewer's entire review history. And **pruning is the only path in the tool that deletes review data outright** (everything else merges), so it confirms with the count and the keys first and **re-derives the list at click time** rather than trusting what was rendered, since the panel can sit open while a sync pull or import changes state underneath it. Full rationale — why it lost its own tab, why orphaned records are a real class, and why `local_dirty`'s three states are reported separately — in the `hhvc-review-ops` skill.

### Page object shape and validation rules

The enforced Zod schema lives in `build_scripts/schema.js` (shared by
`build_scripts/validate.js` and `tests/data-validation.test.js`, so the schema
has coverage independent of current page content). A page has `slug`,
`type` (a free-form string, only `min(1)` checked — **eight** values are in use:
`Transaction` (14 pages), `Information` (6), `Resource Collection` (3),
`Campaign` (2), `Topic` (1), `Agency` (1), `About us` (1), and `Report` (1),
matching Karl content-type names. This list read six until 2026-08-15, omitting
`Topic` and `About us`; a census via `build_scripts/load-pages.js` is what
corrects it, so re-derive rather than trusting a restatement), `title`,
`summary`, `audience[]`,
`reading` (grade-level string), and `sections[]`. **For Karl editor field mapping
by content type, `docs/karl-export-field-map.md` is the current source** — one
map per type in use, giving live UI labels, navigation paths, block and raw
Wagtail field names, required-versus-optional, repeatable-versus-single, how an
internal page link differs from an external URL, and an explicit register of
what is still unresolved. It supersedes `docs/wagtail-content-mapping.md` and
`docs/source/hhvc-policy/karl-content-type-field-reference.md` on type coverage;
both remain useful for their per-type detail and both still carry claims the
newer doc lists as obsolete.
Sections carry a required `heading` and `karl`, plus optional `kind`, `component`
(enum: `body`, `services`, `resources`, `related`, `contact`, `spotlight`,
`what-to-do`, `supporting`, `intro`, `top-facts`), `open` (renders a Transaction
supporting accordion expanded), `flat` (renders a Supporting section as Karl's
plain Custom section — heading and text, no toggle — instead of an accordion;
orthogonal to `open`, which only has meaning for an accordion), `cards[]`,
`bullets[]`, `paragraphs[]`, `facts[]` (`{ label, text }` pairs behind a
`top-facts` section, kept separate from `bullets[]` because a plain bullet has
no title of its own and widening `bullets` would change its shape for every
other section type), `table[][]`,
`image`, a `callout` (`text` + optional `title`/`variant` of
`info`/`warning`/`note`), a `button`/`buttonUrl`/`buttonTarget`/`buttonStyle`,
and/or `steps[]`; steps carry `title`, `text[]`, `bullets[]`, `callout`, `karl`,
and `button`/`buttonTarget`/`buttonUrl`. Optional page-level fields: `seoTitle`,
`metaDescription`, `primaryCta`, `editorNote`, `topicTag`, `whatToKnow`,
`partnerAgencies` (an array of cards, same shape as a section's), `contact`,
`spotlight`, `reportDate`, `printVersionUrl`, and `editorStatus`
(`needs-review` | `blocked` | `placeholder`). Text-bearing arrays
(`paragraphs`, `bullets`, step `text`/`bullets`) accept either a plain string or
`{ text, unverified?, unverifiedReason? }` — `unverified: true` flags a claim
needing SME confirmation, rendered as an "Unverified" pill and counted in
`validate.js`'s summary line. Cards support the same two fields.

Beyond schema shape, `validate.js` enforces business invariants:

- The `pestsTopic` key must exist and be **first** in `order`. This is now the
  HHVC **Agency page** ("Healthy Housing and Vector Control") — the key name is
  retained from the Topic-page era for invariant/test/review-state stability.
- The bare `agency` key must **not** be present (nobody should "fix" the key name
  and break that stability).
- Every page key must appear in `order` (`findMissingOrderKeys`).
- Every `card.target` **and** every section/step `buttonTarget` must resolve to a
  real page key, and every inline markdown link `[label](pageKey)` in
  paragraphs/bullets/table cells/callouts/step text must resolve to a real page
  key, an `http(s)` URL, or the inert `#` sentinel.
- The Agency page's content must not contain banned out-of-scope terms
  (`plumbing`, `dbi`, `roof leak`, `sewer`, `permit issue`, `construction
defect`) — HHVC scope is Article 11 only.
- **Lists of three or more items must use `bullets[]`**, not `paragraphs[]` or
  step `text[]` (`findListFormatViolations`) — a hard validation failure.
- **No image may be loaded from another host** (`findExternalAssetUrls`) —
  absolute `http(s)` or protocol-relative `image.src`, on a section or on the
  spotlight, fails validation. The tool claims to work fully offline, and that
  was false for a long time because of one hotlinked `images.unsplash.com` URL
  on the Agency page; it hid well because on a connected machine it simply
  worked, and only an air-gapped review or that page's PNG export showed the
  problem. **`data:` is allowed here, deliberately the opposite of
  `findUnsafeUrls`'s rule** — there the value is navigated to, where a data URL
  is a phishing vector; here it is an `<img src>` that renders bytes, and being
  self-contained is the point. The Agency spotlight photo is an inline
  WebP data URI, and has to be one rather than a file under `public/` so it
  survives `vite build --mode singlefile`, where a relative path would 404.
  `findBannedTerms` skips `src` for a related reason: it substring-matches the
  serialized page, and the base64 photo contains the sequence `dbi`, which
  failed validation on a page whose copy never mentions DBI.
  It tests the browser-normalized string via the `urlProbe()` helper it shares
  with `safeUrl`: matching the raw value on `/^(https?:)?\/\//` misses
  `\\cdn.example.com/a.jpg`, `\/cdn…`, `/\cdn…` and `https:<TAB>//cdn…`, all of
  which still fetch off-origin (confirmed in Chromium, not inferred).

All of these live in `build_scripts/data-checks.js` as pure functions, testable
without the real page data.

**`karl` fields are first-class content, not comments.** Every card, step,
section, and callout can carry a `karl` string — a precise, CMS-technical
placement/rationale note mapping mockup content onto real Karl StreamField blocks,
surfaced to reviewers via `karlTag()`. They routinely embed open questions/flags
for the client team and cite governance docs by section number. Keep them accurate
when editing copy. Page copy itself is plain-language, ~Grade 6, tenant-facing,
empathetic civic writing.

### Local persistence

All reviewer state (decisions, notes, edited SEO fields, workspace UI prefs)
is saved client-side under the versioned `localStorage` key
`hhvcManagerReviewState:v1`. Bump the version suffix if the persisted shape
changes incompatibly. Workspace UI prefs (`workspace_open`, `workspace_tab`,
`last_page_key`, `show_karl_tags`) live under `state.ui` in the same blob.
This localStorage layer is the tool's synchronous, always-available core —
`window.reviewState.read()/write()/update()` — and stays that way regardless
of whether the optional sync backend below is ever configured.

Each page's review record also carries an append-only `history[]` array
(added alongside the sync backend): `{ timestamp, reviewer, decision, notes,
risks_or_blockers, updated_by }` entries recording each review "round." A
history entry is constructed in exactly one place — `mergeReviewRecord()` in
`js/review-merge.js` — and only at discrete round-boundary events: queue bulk
actions/keyboard shortcuts (`updateLocalReviewForPage` in
`js/review-queue-state.js`), CSV/JSON backup import (`importReviewStateBackup`
in `js/ux-improvements-export.js`), server sync (`server.ts`'s
`putReviewPage`), and a **decision change made from the sidebar** (the
`<select>` or a quick-action chip). The continuous per-keystroke/blur autosave
(`saveCurrentPageToLocalStorage` in `js/ux-improvements-state-sync.js`)
deliberately does **not** go through `mergeReviewRecord` and does **not**
append a history entry — it just keeps the working snapshot fresh, carrying
the existing `history` array forward untouched. Routing autosave through the
merge/history path would flood `history` with one entry per debounced
keystroke.

The sidebar decision is the one exception that shares the autosave path
(both persist through the same field listeners in `js/ux-improvements.js`),
so `saveCurrentPageToLocalStorage` singles it out via `isDecisionRound()`:
one entry when the decision actually _transitions_, never per keystroke.
A brand-new record only counts when the reviewer moved off the default
`Needs review`, or typing the first character of a note on an untouched
page would record a round for every page in the site. Queue actions append
their own entry before dispatching their sidebar-sync events, so by the
time autosave runs the decision already matches and nothing double-records.

**The CSV/JSON import path can destroy existing reviews** — a prior
regression there replaced the saved state wholesale instead of merging. The
round-trip logic lives in `js/review-queue-import.js` (CSV) and
`js/ux-improvements-export.js`'s `importReviewStateBackup` (JSON backup);
both merge through the same `mergeReviewRecord` per-page-key path the sync
backend uses, while `js/review-queue.js` wires the handlers and
`js/manager-review-export.js` exports current-page snapshots. **Any change to
any of these modules, or to `js/review-merge.js`, must be verified against the
round trip itself before being called done:** export a snapshot, re-import it,
and confirm existing decisions/notes are still present rather than wiped.

**Two e2e specs cover this, and the split between them is the interesting
part.** Both drive the real UI (export button clicks, file-input imports),
because `review-import-export.spec.js` — once described here as the API-level
half — was deleted for not doing so: it hand-rolled the merge inside
`page.evaluate` instead of calling `importReviewStateBackup()`, so it stayed
green against the wholesale replace that destroyed reviews once already.

- **`tests/e2e/import-export.spec.js`** — both directions end to end, asserting
  `history.at(-1).updated_by === 'import'`, which is what proves merge rather
  than wipe. Its merge tests seed state through `seedState()` (a direct
  `localStorage` write, so the export path never runs), and its round-trip test
  clears state before re-importing, so nothing is left for a wipe to destroy.
- **`tests/e2e/merge-verification.spec.js`** — the shape that misses, and the
  one the warning is actually about: re-importing an **older snapshot on top of
  live state that has moved on**. A page reviewed after the export is absent
  from the file, so a wholesale replace drops it. Everything routes through the
  sidebar fields and the real buttons; nothing touches review state directly.

Nothing can unit-test this path today: both modules are browser-only, with no
`module.exports` to import from Bun. **A green CI run is evidence for those two
scenarios and nothing else on this path** — anything a change puts at risk
outside them is still yours to verify by hand.

### Optional API access hardening

`server.ts`'s optional `/api/*` routes have one shared, server-side access
control layer. It protects the review-state and AI APIs without changing the
offline static tool.

- **Legacy compatibility and opt-in principals:** an unset
  `REVIEW_API_TOKEN` _and_ unset `REVIEW_API_PRINCIPALS` still yields 501 —
  the API is not accidentally open. Setting only `REVIEW_API_TOKEN` remains
  supported and creates one broad legacy principal with every role. For
  least-privilege deployments, set `REVIEW_API_PRINCIPALS` to a JSON array
  such as
  `[{"principal":"reviewer-a","token":"replace-with-a-secret","roles":["review:read"]}]`.
  Each entry has exactly `principal` (letters, digits, `.`, `_`, `-`),
  `token` (one non-whitespace bearer token), and nonempty `roles`; principal
  names and tokens must be unique. The allowed roles are `review:read`,
  `review:write`, and `ai:generate`.
- **No ambiguous fallback:** a present `REVIEW_API_PRINCIPALS` replaces the
  legacy token completely. Empty, malformed, oversized, duplicate, unknown,
  or invalid-role configuration fails closed with 503; it never falls back to
  `REVIEW_API_TOKEN`. Keep both token values out of source control and logs.
  `review:read` gates `GET /api/review-state`, `review:write` gates its PUT,
  and `ai:generate` gates all AI discovery/model/generation routes.
- **Origins:** no cross-origin browser origin is allowed by default and no API
  response sends `Access-Control-Allow-Origin: *`. Same-origin requests work
  normally. To authorize a separate trusted browser app, set
  `REVIEW_API_ALLOWED_ORIGINS` to a comma-separated list of exact serialized
  HTTP(S) origins, for example
  `https://review.example.gov,https://manager.example.gov`; no wildcards,
  paths, credentials, or `null` origins. Invalid origin configuration fails
  closed with 503. Allowed preflights do not authenticate or grant a role; the
  following request still does both.
- **Process-local rate limit:** authenticated requests use a fixed window per
  configured principal and role bucket. `REVIEW_API_RATE_LIMIT` defaults to
  120 requests and `REVIEW_API_RATE_WINDOW_MS` to 60000 (valid ranges are
  1–10000 and 1000–3600000 respectively); invalid numeric values warn and use
  those safe defaults. The in-memory map is bounded by the maximum configured
  principals and three roles, and 429 responses carry `Retry-After`.
- **Production boundary:** this limiter and bearer-token lookup are
  intentionally per-process. A public or multi-instance deployment **must**
  additionally enforce identity, origin policy, and shared rate limits at a
  reverse proxy or identity-aware edge; do not treat a process-local counter
  as coordinated abuse protection. API responses, including authorization,
  CORS, configuration, and rate-limit errors, retain the server's security
  headers and are `no-store`.

### What the RAG corpus contains (`build_scripts/knowledge-sources.js`)

`collectKnowledgeSources()` is the single definition of the corpus — not a glob — and every chunk carries a `category`: `hhvc-standards` (the HHVC Web Governance and Content Standards Manual), `hhvc-policy`, `sfgov-style`, `sfgov-live`, `karl` (the CMS as MEASURED), `karl-gitbook` (the CMS as DOCUMENTED — kept separate because the two have disagreed four times over, and the prompt says the measurement wins), `mockup-draft` and `sfds`. Category comes from the first path segment under `docs/source/`, so a new folder files itself with no code change; **`EXTERNAL_SOURCE_FILES` is the exception**, an explicit `{path, category}` list for documents living outside that tree — and **adding a file to it moves the measured counts**, so re-measure and re-ingest rather than editing the list alone. **`mockup-draft` is about a quarter of the corpus and is the dangerous one**: draft copy nobody approved, including the page being audited, so the system prompt forbids citing it as the authority a finding rests on, and the category is resolved from the matched row rather than the model, which cannot spoof it. **`bun run ingest` is yours to run and is billed** — nothing in CI or the build does it, so a corpus change is not live on a deployment until it runs. Full rationale — the per-category counts, why the compliance matrix is projected from CSV rather than committed, why a superseded document cannot carry its own warning, and the retrieval floor this corpus does not have — in the `hhvc-rag-knowledge-base` skill.

### Reviewer sign-in (`/api/session`)

The bundle is public so it can never carry a token; Railway made the app and the
API same-origin, so it can carry a sign-in form instead.

- **`POST /api/session`** takes `{password}`, compares it constant-time against
  `REVIEW_SESSION_PASSWORD`, and sets an `HttpOnly; Secure; SameSite=Strict`
  cookie. `GET` reports `{active, loginAvailable}` and is deliberately ungated —
  it is how a browser learns it can become a principal. `DELETE` signs out.
- **The cookie is a signed assertion, not stored state**:
  `<principal>.<expiry>.<HMAC>`, verified per request, key derived from the API
  tokens — so rotating `REVIEW_API_TOKEN` invalidates every session.
- **A session gets `review:read` + `review:write` only, never `ai:generate`** —
  a shared password that unlocked paid generation would make one leak an
  unbounded bill. Cookie-authenticated AI requests get 403.
- **Bearer beats cookie** when both are present, so a scoped token keeps its
  own roles.
- Sign-in is throttled globally (10/min); unset password → **501**, token-only.

### Review-state sync backend (optional)

**Sync runs automatically as of 2026-08-14** — `startAutoSync()` pulls once at
init, `scheduleAutoPush()` pushes a page on a 3s debounce **after** the autosave
has written localStorage (never instead of it), and `pushDirtyPages()` sends
work saved while the server was unreachable. No push may precede the first pull,
or it carries a `synced_at` baseline the browser never observed and earns a 409.
The client still never merges on the push path — the server does, with
`updatedBy: 'sync'` — so history stays bounded. The default endpoint is the
page's own origin now, not a baked-in hostname; the token still has no default.

`server.ts` optionally serves a small sync API alongside static files, backed by Postgres or SQLite depending on `DATABASE_URL` (see "Where review records live" above), with `js/review-state-sync.js` as its no-op-unless-configured client. Entirely additive, off by default, fails closed (501). Auth is the shared layer described under "Optional API access hardening" above. Full rationale — push/pull asymmetry, the never-compare-clocks rule, `local_dirty`'s tri-state, conflict binding — in the `hhvc-review-sync-backend` skill.

### AI assist backend (optional)

`server.ts` hosts an optional content-drafting API under `/api/ai/*`, backed by `build_scripts/ai/`. Additive, off by default, fails closed; two independent gates (API authorization, then a provider key); never writes anything. Full rationale — provider registry, usage normalization, input bounds, cancellation classification — in the `hhvc-ai-assist-backend` skill.

### RAG knowledge base (optional)

`compliance-audit` is a second `/api/ai/generate` task that grounds an audit in this repo's own `docs/source/` corpus. Same posture as the rest of the AI backend: additive, off unless configured, never writes. Full rationale in the `hhvc-rag-knowledge-base` skill.

### AI rewrite (optional)

A floating button offering an AI rewrite of the body copy a reviewer selects (`js/ai-rewrite.js`, `js/ai-rewrite-render.js`). Additive, invisible unless `/api/ai/*` is configured, never writes to `pages/*.js`. Full rationale in the `hhvc-ai-rewrite` skill — read it before touching those files or `data-rewrite-field` addressing.

### Build outputs

- **`vite build --mode singlefile`** (`bun run build:singlefile`) inlines
  every script and stylesheet into one self-contained
  `dist-singlefile/index.html`, via `vite-plugin-singlefile`. It replaced the
  hand-rolled `build_scripts/build-single-file.js`, which concatenated
  `index.html`'s tags in document order — an approach that only worked while
  there was no bundler. The output, plus `dist/` and
  `data/page_inventory.{json,csv}`, is a gitignored generated file —
  **never hand-edit it**; edit sources and re-run `bun run build`.
- **`build_scripts/extract-pages.js`** (first half of `bun run export`)
  regenerates `data/page_inventory.{json,csv}` from page data. `data/` is
  absent on a fresh clone (gitignored); this script creates it. Dev/serve
  never touches `data/` — only build/export does.
- **`build_scripts/sync-tracking-sheet.js`** (second half of `bun run export`,
  also `bun run sync-tracking`) regenerates the Google Sheets–ready tracking
  CSVs under `review/` from current page data.
  **`build_scripts/push-tracking-sheet.js`** (`bun run push-tracking`) does a
  three-way merge against the live Master Control workbook (IDs and tab gids
  in `build_scripts/sheet-config.json`) and optionally pushes via the Sheets
  API. It needs a Google service-account key, which is gitignored and must
  stay that way — never commit `*-service-account*.json` or `.env.local`.
- **`bun run build:netlify`** (driven by `netlify.toml`) runs `validate` →
  `build:app` (the real Vite production build into `dist/`) →
  `build_scripts/copy-workshop-form.js`. That last script is the surviving
  half of the old `build-netlify-dist.js`: everything it used to copy by hand
  (`index.html`, `css/`, `js/`, `pages/`, the `@sfgov/design-system` CSS) is
  now bundler output, but the workshop form still has to be copied to
  `dist/forms/mosquito-workshop-request`, since that Vite sub-app is built
  with `base: '/forms/mosquito-workshop-request/'`. **That copy does not run
  the sub-app's Vite build** — it copies whatever is checked into the
  committed `forms/mosquito-workshop-request/dist`, so after editing
  `forms/mosquito-workshop-request/src` you must run
  `bun run build:workshop-form` and commit the result, or the deploy ships
  stale form assets. The script parses the committed HTML's asset references
  and fails loudly when any are missing, because a deploy once shipped a form
  shell that loaded its CSS and never hydrated. Note the gitignore subtlety:
  the root bundle is ignored as `/dist/`, anchored on purpose so it doesn't
  also swallow that sub-app's committed `dist/`.
- `server.ts` mirrors the same security headers (`X-Content-Type-Options`,
  `X-Frame-Options`, etc.) that `netlify.toml` sets for the deployed site.

### Where review records live (`build_scripts/storage.js`)

One module decides the store and speaks its dialect; `server.ts` calls functions
and never sees a driver or a SQL string.

- **Postgres when `DATABASE_URL` is set** (Railway injects it from the managed
  Postgres service); **SQLite at `DATA_DB_PATH` otherwise** — local dev and
  every server test. The fallback is kept so
  `tests/review-api-server.test.js` can spawn the real server in CI with no
  service container.
- **Every function is async, including the SQLite ones** — `bun:sqlite` is sync
  and `Bun.SQL` is not, and two shapes would push the difference back into
  `server.ts`.
- **`updated_at` is TEXT in both drivers, never a timestamp type.** Every
  freshness check here is a string compare against ISO strings the server
  stamps; letting Postgres reformat them would silently change those
  comparisons, and the failure mode is a lost update.
- **The compare-and-swap is the load-bearing line** — SQLite reads `changes`,
  Postgres counts rows `RETURNING`ed. `tests/review-api-postgres.test.js` proves
  the Postgres half by racing two pushes off one baseline.
- **DDL runs at boot, not lazily**, so two replicas cannot race the same
  `CREATE TABLE`.
- **`knowledge_chunks` lives behind this seam too**, so `bun run ingest` writes
  wherever the deployment reads. Embeddings are raw Float32 bytes in both — a
  BLOB in SQLite, `bytea` in Postgres.
- Bun's Postgres client is built in (`Bun.SQL`), so this added no npm
  dependency.

### Deploying — Railway is the live host

**<https://web-production-9bb3b.up.railway.app>** is the deploy reviewers open.
Railway project `hhvc-manager-review`, service `web`, connected to `main`, so a
merge redeploys. Config lives in `railway.json`: build `bun run build:netlify`,
start `bun run serve`.

- **`bun run serve`, not `bun run start`** — `start` is `build:netlify && serve`,
  which would repeat the whole build at boot on a platform that already ran it.
- **`server.ts` must exit 0 on SIGTERM.** Railway retires a deployment by
  sending SIGTERM and reads the exit status that follows as its verdict. With no
  handler the process is simply killed, `bun run` reports 128 + 15 = 143, and
  Railway mails "Deploy Crashed!" about a container it stopped on purpose — on
  every deploy to `main`, with the only trace one line in the OUTGOING
  deployment's log: `error: script "serve" was terminated by signal SIGTERM`.
  The handler drains via `server.stop(false)` (`true` would sever in-flight
  responses) raced against a 10s timer, so a hung request cannot hold the
  process into SIGKILL and reach 143 the slow way.
  `tests/review-api-server.test.js` asserts `signalCode` is null as well as
  `exitCode` 0 — a signal-killed process reports `'SIGTERM'` there whatever the
  code says. The start command stays `bun run serve`: with the handler in place
  the script wrapper propagates the clean exit, so bypassing it buys nothing.
- **`HOST=0.0.0.0` is required, as a variable rather than a code change.**
  `server.ts` defaults to `127.0.0.1`, which is right locally and unreachable in
  a container: the first deploy built and started cleanly and still served 502,
  the only evidence being the log line
  `HHVC mockup server running at http://127.0.0.1:8080`. `PORT=8080` is set too,
  and the domain's target port must match it.
- **Railway runs `server.ts`, so the optional APIs finally have a runtime** —
  impossible on Netlify. They still fail closed: with neither
  `REVIEW_API_TOKEN` nor `REVIEW_API_PRINCIPALS` set, `/api/review-state` and
  `/api/ai/capabilities` answer **501**, the healthy resting state of an
  unconfigured deploy. 502 is the broken one.
- **On the live deploy those routes now answer 401, not 501** (verified
  2026-08-15). Authorization is configured there, so **a 501 now would mean the
  variables were lost.** A 503 has two causes only the response body
  separates: `API CORS configuration is invalid.` means
  `REVIEW_API_ALLOWED_ORIGINS` is malformed, while
  `API authorization configuration is invalid.` means `REVIEW_API_PRINCIPALS`
  is. The CORS check answers before the authorization gate runs, so a bare 503
  is not evidence about auth — read the body, and report authorization as
  **unknown** when CORS is the one that won. Presence was inferred from the
  status code, not read out of the service — never print a variable's value.
  **A 401 from `/api/ai/capabilities` says nothing about the provider keys**:
  authorization is the first of two gates, so an unauthenticated caller never
  reaches the capability report. Full procedure in the
  `verify-railway-backend` skill.
- **Netlify is retired but not deleted** — `netlify.toml` carries
  `build.ignore = "exit 0"` (skip every build). Delete that line to re-enable it.

### Other directories

- **`forms/mosquito-workshop-request/`** — an independent Vite app (own
  `package.json`, `vite.config.js`, `src/main.js`) for one embedded form. Not
  wired into the main Bun dev server; built separately via
  `bun run build:workshop-form` or the Netlify build.
- **`review/`** — reference/output for the manager review process
  (`manager_review_packet.md`, `manager_decision_log.csv`,
  `page_approval_checklist.csv`, `mockup_tracking_sheet.csv`), distinct from
  the in-browser `localStorage` review state.
- **`docs/`** — **`karl-export-field-map.md`** (the current per-content-type
  field map: live UI labels, navigation paths, block and raw Wagtail field
  names, required-versus-optional, repeatable-versus-single, internal versus
  external link shapes, and an explicit unresolved/obsolete register — start
  here for anything naming a Karl destination), `wagtail-content-mapping.md`
  (the older page-type → Karl mapping, superseded on type coverage but still
  the fuller record of per-type nested block detail and research history),
  `karl-mockup-cookbook.md` (the section-by-section build procedure for authors,
  and its dated capture record `karl-mockup-cookbook-plan-2026-08-14.md`), plus
  dated research/audit notes. **Those dated notes are records, not
  documentation** — a count or claim that was right on its date stays in the
  file; corrections go in the field map's obsolete register instead.
- **`docs/source/hhvc-policy/`** — source policy documents (PDFs and their
  markdown extracts) that page copy is based on; not code.
- **`docs/superpowers/plans/` and `docs/superpowers/specs/`** — planning and
  design docs from prior work sessions; useful background, not standing
  instructions.
- **`.playwright-mcp/`** — scratch console logs/snapshots from prior
  Playwright MCP sessions; not part of the source.

## Code style & idioms

### Formatting (a hard CI gate)

Prettier is the **formatting gate CI enforces** (`.prettierrc.json`), alongside
`lint:js` for oxlint's core rules, Knip for reachability (see `knip.jsonc`),
dependency-cruiser for the module graph (see `.dependency-cruiser.cjs`) and
`lint:docs` for the markdown (see `.markdownlint-cli2.jsonc`): **no
semicolons**, single quotes, 2-space indentation, `printWidth: 100`, ES5
trailing commas. Code must be ASI-safe and semicolon-free. Run
`bun run format` before committing; `bun run format:check` is the lint step
and CI fails on it. `.prettierignore` excludes `data/`, `node_modules/`,
`dist/`, `server.ts`, the vendored `tools/oxlint/anti-slop/`, the generated
single-file HTML exports, and the reference/planning dirs (`docs/source/`,
`docs/superpowers/`, `review/`, `.playwright-mcp/`).

**`bun run lint:anti-slop` is a second linter, and deliberately not a gate.**
It runs the vendored [anti-slop](https://github.com/dmmulroy/anti-slop) Oxlint
plugin (`tools/oxlint/anti-slop/`, MIT, see its `NOTICE.md`) over **`server.ts`
and `build_scripts/ai/` only** — the two places that decode external input,
where its rules about widening and unchecked assertions are about the code
rather than about a style this repo doesn't use. The narrow scope is not
timidity: pointed at the browser JS the same rules reported 280 findings, 254
of them `no-runtime-typeof` firing on the `typeof window === 'undefined'` guard
this repo's own code style mandates, which is a linter arguing with the
codebase rather than improving it. `.oxlintrc.json` pins the same scope in its
`overrides`, so an editor running bare `oxlint` sees it too. Nothing in
`.github/workflows/ci.yml` invokes it — it is a report to read, and adding it
to CI would be a decision to make on purpose, not a gap to close.

**`typos` was measured and REJECTED, on 2026-08-17 — do not re-propose it
without new evidence.** It was the obvious next docs tool, and the premise was
that its correction-list design keeps false positives low enough to gate without
a curated wordlist. Run over this repo's own source it produced 59 findings and
**not one was a real misspelling.** Two clusters account for most of it: `SME`
(Subject Matter Expert — the term behind the page schema's whole
`unverified`/`unverifiedReason` mechanism) and `IIF`, matched inside `IIFE` and
`IIFEs`, which is one of the two module patterns this repo's code style
mandates. A wordlist fixes those, and that is not the reason it was rejected.
The reason is the rest: `rodentsProbelm` in `tests/e2e/inline-content-edit.spec.js`
and `Transactoin` in `tests/data-validation.test.js` are **deliberately invalid
fixtures**, asserting that a broken link target and an unknown page type are
REJECTED. Correcting either silently guts its test, and blessing them in a
dictionary puts real misspellings into the dictionary, which weakens the tool
everywhere it would otherwise work. Same shape as anti-slop above — a linter
arguing with the codebase rather than improving it — and the same disposition:
run it by hand if you want the report, but it is not a gate here.

**oxlint itself DOES gate CI now, through a different config.** `lint:js` runs
`.oxlintrc.ci.json`, which loads no plugin at all and enables oxlint's own core
rules across `js/`, `pages/`, `build_scripts/` and `tests/` — those had never
run anywhere, since `.oxlintrc.json` sets `"rules": {}`. Two configs rather than
one because the two answer different questions: anti-slop is an opinion about
how to write TypeScript at an I/O boundary, and the core rules are correctness.
Two stylistic `unicorn` rules are off in the CI config for the same reason
anti-slop is not gated — `no-useless-fallback-in-spread` and
`prefer-string-starts-ends-with` cluster in `js/ux-improvements-export.js` and
`js/inline-content-edit.js`, and churning the import/export merge path for style
is the trade this repo already refused once.

### JavaScript

- **This is plain browser JS — not TypeScript — but it IS bundled, and
  `js/*.js` ARE ES modules.** Use `import`/`export` with explicit relative
  specifiers including the `.js` extension (`import { escapeHtml } from
'./utils.js'`). Vite builds it; `server.ts` is the one TypeScript file, and
  it's Prettier-excluded. (Older notes in this repo describing "no build step,
  no ES modules" predate the Vite migration.)
- **File naming:** lowercase — single words for the core modules (`app.js`,
  `state.js`, `utils.js`), hyphenated for multi-word ones
  (`review-queue-state.js`, `page-render.js`); never camelCase. Match sibling
  files.
- **Two deliberate module patterns:** (1) plain modules for the core files —
  bare `const`/`function` declarations plus an `export { … }` block at the
  bottom, and a `window.X = X` line for the handful other code reaches
  through `window` (see the load-order section); (2) **named IIFEs with a
  leading semicolon** —
  `;(function mountX(){…})()` — for newer stateful subsystems (the leading `;`
  is required because there are no statement-terminating semicolons). Expose
  via `window.<Namespace>` with the idempotent `window.X = window.X || {}`
  idiom.
- **Naming:** `camelCase` for JS identifiers, `UPPER_SNAKE_CASE` for module
  constants, `snake_case` for serialized/CSV data fields (`review_date`,
  `local_dirty`, `synced_at`). That camelCase-code / snake_case-data boundary
  is firm.
- **Defensive by default:** run every value that reaches `innerHTML` through
  `escapeHtml`; use optional chaining + `?? ''` coercion and guard-clause
  early returns; guard test/SSR contexts with a
  `typeof window === 'undefined'` early return; `csvEscape` includes
  spreadsheet formula-injection protection (`build_scripts/csv.js` preserves
  the same neutralization on the Node side). Prefer reusing `js/utils.js`
  helpers over inlining new logic.
- **State:** in-memory module singletons + versioned `localStorage` updated via
  functional updater callbacks (`updateLocalState((s) => { …; return s })`) +
  `HHVC_DATA`/`HHVC_PAGES` globals; `ORIGINAL_DATA` is a deep clone for reset.

### Comment & documentation voice — the most distinctive trait

Write **detailed, explanatory** comments and docs, not terse ones (the
author's stated preference: verbose, comment-heavy, explain the reasoning).
Every module opens with a header block stating its role **and its load-order
dependency**. Functions carry full JSDoc (`@param`/`@returns`). Comments
justify the _why_ — product rationale, trade-offs, and exact WCAG contrast
math in CSS — not restatements of the code. Prose docs use plain-English
framing with `**Bold label:**` bullets that state a non-obvious fact _and why
it matters_, and annotate config inline (e.g. the `"// script": "description"`
keys in `package.json`, and the explanatory comments throughout `.gitignore`
and `ci.yml`). Match this voice.

### CSS

Design-token-first: raw `--legacy-*` tokens (the hand-authored palette this
tool shipped before adopting SFDS, scheduled for migration) → a semantic
`--brand-*`/`--surface-*`/`--text-*` layer with baked-in `var(fallback)`
values, so reviewers retheme by touching tokens only.
Hand-authored, no preprocessor. Boxed section-banner comments; justify
color/accessibility choices in-comment with the contrast math. `!important` is
used liberally **only** in the self-aware override layer
(`css/ux-improvements.css`). Dark mode via
`@media (prefers-color-scheme: dark)` token overrides; responsive type via
`clamp()`.

**There are eleven repository-owned stylesheets, and two positions in their
order are load-bearing.** `css/sfds.css` MUST stay first of the eleven — it is
the raw-primitive layer everything downstream reads, keyed to SFDS's own
published token names. `css/theme.css` MUST stay last — it is the semantic
token layer, and its dark-mode block overrides the `--legacy-*` primitives
`css/styles.css` declares on `:root`.

Their order is the tail of `js/main.js`'s CSS imports, and each of the eleven
opens with a banner comment naming what it owns (several also state which sheet
they load after, and why). Read those two rather than a table here: eleven
one-line file descriptions restated in this file would be a second copy of
eleven header comments, checked by nothing and stale the first time one of them
is edited. **"First" means first of the eleven, not first in the file** — six
dependency sheets (`@fontsource-variable/roboto-flex`, two
`@fontsource/roboto-slab` weights, three `@sfgov/design-system` sheets) import
ahead of `css/sfds.css` and carry none of those banners. They load before all
eleven, so the repo's own sheets override them rather than the reverse.

Retheming should mean editing `css/theme.css` only. A component rule that needs
a colour, a size step or a radius takes a semantic token; it should not reach
for a raw `--legacy-*` value, and it must never hardcode a literal — every
dark-mode contrast bug this repo has had came from a literal sitting where a
token belonged.

**The mockup's type scale is SFDS's `title` ladder, and is no longer an
exception.** `h1`–`h3` in `css/styles.css` read `--sfds-text-title-*` like
everything else. The literals that stood here were justified as mirroring what
SF.gov actually renders; measured in a real browser on 2026-08-14, they did not
— live sf.gov renders `h1` at 46/56 w600, which sits on no SFDS step, and the
old `clamp()` topped out at 64px, which sits on neither. (The literal was
doubly moot for `h1`: every mockup page's title renders inside `.hero-inner`,
whose own more-specific `font-size: 2.5rem` always outranked the bare `h1`
rule, so the `clamp()` this paragraph used to defend was dead code no page
ever actually showed.) The tool follows SFDS on purpose, so the mockup
deliberately no longer matches sf.gov's current Drupal theme. See
`docs/superpowers/specs/2026-08-14-sfds-design-consistency-design.md`.

The ladder applies to the bare `h1`/`h2`/`h3` rules (and, off-ladder, `h4` —
see the bare `h4` rule's own comment for why it needs one at all); several
component-scoped headings elsewhere in `css/styles.css` keep their own,
smaller or larger, sizes as a deliberate different tier rather than being
forced onto it — `.card h3`, `.contact-section h3`, `.top-facts h2`,
`.callout-header h3`, `.what-to-know-subsection h3`, `.custom-section h3`,
`.sidebar h2`, `.what-to-know-heading`, `.accordion-heading`, and the
footer's `.footer-columns h4` among them. `.spotlight-section-inner h2` joins
that list too, matched to `.top-facts h2`'s exact size: both are a boxed
sub-widget's own heading, one tier below a real `.section h2`, and a
follow-up review found `.spotlight-section-inner h2` had never been given a
font-size of its own at all — it was silently rendering at full titleLg
(44px) inside a box meant to read as secondary, confirmed live on
`ipmEducation`. Every one of these now carries its own `line-height: 1.15`
and an in-file comment: that same follow-up review found the ladder
rewrite's split of the old shared `h1, h2, h3, h4` block had dropped every
one of their line-heights — for an `h1`-`h3`-level selector this cascades in
a mismatched ladder token from the bare per-level rule instead (silently
wrong, not silently absent, since only one rule ever sets `line-height` for
a given heading level and the split didn't remove that rule, just its
generality), and for `h4` outright, since no rule sets its line-height at
any specificity once the split moved it into the color-only `h3, h4` block.
`.region-title` is the one exception that moved the OTHER direction, from
off-ladder onto it: the same review found the size gap it maintained against
`.service-group h3` (its sibling heading, one tier down) had shrunk from 4px
to 1.6px once `.service-group h3` itself joined the ladder's titleXs step in
this same pass, so "Services"/"Resources" read as a peer of the group below
it rather than a label above it. It is now `--sfds-text-title-sm` (24px),
confirmed live against a real `.section h2` (44px) on the same page to not
compete with it — an eyebrow treatment was the fallback if it had. Tool
chrome has its own scale in `css/theme.css` (`--ds-text-panel`,
`--ds-text-card`, `--ds-text-label`, `--ds-text-micro`) and should use it.
Note those are named `--ds-text-*`, not `--*-size-*`; grepping for "size" or
"scale" misses them and makes the type scale look absent when it is not.

**A selector should be declared in exactly one file.** `.review-workspace`,
its tabs, the KPI tiles and `.status-chip` were each split across
`css/ux-improvements.css` and `css/dashboard.css`, with the later file
declaring only what it wanted to change — so what actually rendered was a merge
of the two and neither block described it. They now live wholly in
`css/dashboard.css`.

### Tests

Bun test: `import { describe, test, expect } from 'bun:test'`, importing the
modules under test directly. `tests/helpers/browser-env.js` — preloaded via
`bunfig.toml` — registers a happy-dom global environment before the loader runs,
restores Bun's native fetch, and clears localStorage after every test. The old
`tests/helpers/load-scripts.js` harness evaluated the classic `<script>` files
into a shared context, which ES modules made impossible. `describe` blocks are named after the unit under
test; `test` names are **behavioral verb sentences** ("escapes all five HTML
special characters"). Prefer exact-string assertions over loose matching. The
XSS/escaping surface (`page-render.test.js`) is exhaustively covered — one
assertion per render function. Use `test.todo` (with a reasoning comment) to
document a known-but-unfixed bug rather than asserting wrong behavior. Tests
that stub globals must restore them, or they pollute sibling test files.

## Editing rules (quick reference)

- Public page content → `pages/*.js`.
- Core render/state → `js/state.js`, `js/page-render.js`, `js/ui-controls.js`,
  `js/editor-panel.js`, `js/app.js`.
- Review/UX layers → `js/ux-improvements.js`, `js/review-queue.js`,
  `js/dashboard-guidance.js`, `js/keyboard-shortcuts.js`,
  `js/manager-review-export.js`, `css/ux-improvements.css`.
- Shared merge/history logic → `js/review-merge.js` (loaded both as a browser
  `<script>` and imported directly by `server.ts` — the only place a `history`
  entry should ever be constructed). Optional sync backend → `server.ts` (API
  routes) and `js/review-state-sync.js` (client pull/push + settings UI).
- Adding/deleting page mockups → `js/page-registry-data.js` (pure validation +
  the in-place `order`/`pages` mutation), `js/page-registry.js` (the bootstrap,
  which MUST stay imported by `js/state.js` so it runs before the `ORIGINAL_DATA`
  clone), `js/page-registry-ui.js`.
- RAG knowledge base → `build_scripts/knowledge-chunking.js`,
  `build_scripts/knowledge-search.js`, `build_scripts/knowledge-schema.js`,
  `build_scripts/ingest-knowledge.js`, `build_scripts/ai/knowledge-retrieval.js`,
  `build_scripts/ai/compliance-audit.js`, and
  `build_scripts/ai/validate-compliance-audit.js`.
- Karl guide panels → `js/karl-guide-registry.js` (the per-page-type field
  tables, the type-independent `META_FIELDS`, and `resolvePath`, which returns
  `''` rather than guessing — `guideForContext` stamps any non-empty path
  `evidence: 'E1'`/`status: 'confirmed'`, so a fallback path renders to the
  reviewer as a measurement), `js/karl-tag-meta.js` (panel markup),
  `js/karl-guide.js` (expand/collapse + clipboard), `css/karl-guide.css`. A
  call site in `js/page-render.js` must pass `context.role`: without one the
  tag KIND is used as the role, which names no Karl field. Note the panel is
  block-level, so a `karlTag()` may never be emitted inside a `<p>` — the
  parser closes the paragraph and the panel escapes the element it is
  positioned against.
- Karl transcript export → `js/karl-blocks.js` (the transcribed panel inventory
  and the `UNRESOLVED` shape rules), `js/karl-transcript.js` (the pure builder —
  every judgement about what an editor is told lives there and only there),
  `js/karl-transcript-panel.js`, `build_scripts/export-karl-transcript.js`.
  Re-run `bun run validate` after any of them: `findUnmappedSections` gates on it.
- Styles → `css/styles.css`; design tokens → `css/theme.css`.
- Docs linting and link checking → `build_scripts/lint-docs.js` (markdownlint,
  rules in `.markdownlint-cli2.jsonc`), `build_scripts/check-links.js` (lychee,
  scheduled by `.github/workflows/link-check.yml`), and
  `build_scripts/docs-file-set.js` — the SHARED derivation of "markdown this repo
  authors", taken from `git ls-files` rather than globbed. A third caller reuses
  it; it never re-globs. Both tools treat an empty file list as a broken
  derivation and fail, because each exits 0 when handed no inputs.
- Any new file under `pages/` needs an `import` in `js/page-data.js` (enforced
  by `build_scripts/page-import-checks.js`, so `bun run validate` fails without
  it) plus an `order` entry. A new `js/` module is imported by whoever needs it,
  or added to `js/main.js` if it is a self-mounting IIFE. **`index.html` has
  exactly one `<script>` tag** — do not add tags to it.
- After editing `pages/*.js` or `js/page-data.js`, run `bun run validate`
  **and** `bun run test`. After touching the import/export round-trip,
  manually verify it (export → re-import → decisions survive).

## Commits & pull requests

- **Imperative mood.** Prefer **Conventional-Commits prefixes** for code
  changes (`fix:`, `feat:`, `style:`, `content:`); keep the subject ≤ ~72
  chars.
- **Bodies scale with complexity:** a one-liner for CSV/doc refreshes; for
  behavior/layout changes, a problem statement + a dash-bulleted list of
  changes + an explicit **verification line** (e.g. "Verified headless at
  1600px and 850px…"). AI-assisted commits carry `Co-Authored-By` and
  `Claude-Session` trailers.
- **Keep dashboard-UX changes and policy-copy changes in separate PRs** —
  reduces merge conflicts and keeps review focused.
- **Never hand-edit generated files** (single-file HTML exports,
  `data/page_inventory.*`) — edit sources and rebuild.
- **Review exports** (`review/*.csv`, saved local-review CSV/JSON) are for
  manager decisions only — **never treat them as automatic publication
  approval.**

## Karl CMS

Login URL for the Karl (Wagtail-based) CMS admin:
`https://api.sf.gov/sso/login?next=/admin/`. Keep user-specific credentials
and private MCP config out of the repo (in `~/.codex/config.toml` or
equivalent).

## Agent skills

### Subsystem deep-dives (`hhvc-*`)

Eleven subsystems carry far more rationale than a session needs resident, and
every one of them matters only while editing a specific, narrow set of files.
Their full write-ups moved out of this file into `.claude/skills/hhvc-*/SKILL.md`,
leaving the summary and the load-bearing warning here and the reasoning one
`Skill` call away. The first six cut roughly 66,000 characters; a second round
on 2026-08-15 moved five more sections that were file-scoped, carried no safety
prohibition, and restate no count `tests/doc-counts.test.js` pins — the
React-islands write-up defers its stylesheet count to the guarded copy here
rather than carrying its own, which it had let go stale at ten — call
it 85,000 characters and about 21,000 tokens per session once the skill
descriptions, which stay resident, are netted off. (Deliberately rounded: an
exact byte count stated inside the file it measures changes that file's size,
so it is wrong the moment it is written.)

| Skill                         | Read it before editing                                                       |
| ----------------------------- | ---------------------------------------------------------------------------- |
| `hhvc-inline-content-editing` | `js/inline-content-edit*.js`                                                 |
| `hhvc-page-registry`          | `js/page-registry*.js`                                                       |
| `hhvc-review-sync-backend`    | `server.ts`'s review-state routes, `js/review-state-sync.js`                 |
| `hhvc-ai-assist-backend`      | `server.ts`'s AI routes, anything under `build_scripts/ai/`                  |
| `hhvc-rag-knowledge-base`     | `build_scripts/knowledge-*.js`, `build_scripts/ai/compliance-audit.js`       |
| `hhvc-ai-rewrite`             | `js/ai-rewrite*.js`, anything touching `data-rewrite-field` addressing       |
| `hhvc-card-inheritance`       | `js/card-inheritance.js`, `js/page-render.js`'s card rendering               |
| `hhvc-react-islands`          | anything under `js/react/`, or adding a React island                         |
| `hhvc-workspace-layout`       | the workspace grid in `css/dashboard.css`, `js/ux-improvements-workspace.js` |
| `hhvc-review-insights`        | `js/review-insights*.js`, `css/review-insights.css`                          |
| `hhvc-review-ops`             | `js/review-ops*.js`, `css/review-ops.css`                                    |

**These are extracts, not a second source of truth.** `AGENTS.md` still carries
every one of these sections in full — it is the canon, and it is read by tools
that have no skill mechanism. A correction goes into `AGENTS.md` and then into
the skill; the skill file says so in its own header comment.

**What deliberately did NOT move**: universal constraints, the invariants
`bun run validate` enforces, code style, the editing-rules quick reference, the
security-shaped prohibitions (the API access-hardening section, "never write
back to `pages/*.js`", "never treat exports as publication approval"), and the
test inventory `tests/doc-counts.test.js` asserts against. A safety rule in a
lazily-loaded skill is a safety rule that is absent exactly when it is needed.

### Issue tracker

GitHub Issues via the `gh` CLI (`origin` is
`github.com/ohdaveed/HHVC_manager_review_current_tool_package`). See
`docs/agents/issue-tracker.md`.

### Domain docs

Single-context — one `CONTEXT.md` + `docs/adr/` at the repo root (neither
exists yet; created lazily by `/domain-modeling`). See
`docs/agents/domain.md`.

## Session pitfalls to avoid

- **Establish the repo root before guessing paths.** Run `pwd` (or use the
  working directory Claude Code reports) rather than assuming one — the
  checkout path differs between the author's local machine and cloud/CI
  sandboxes. Automated review-style invocations have repeatedly wasted a turn
  on a failed `Read` against a guessed path before self-correcting via
  `Glob`/`pwd`.
- **`node_modules/` may be absent on a fresh clone or sandbox.** `bun install`
  is required before `dev`, `validate`, `test`, or `build:netlify` — the first
  three need `zod`/`fast-glob`/`papaparse`, and `index.html` links
  `@sfgov/design-system` CSS straight out of `node_modules`.
- **Land brainstorming/exploration sessions on a decision.** Open-ended
  design sessions (e.g. via `superpowers:brainstorming`) have previously
  ended mid-flow with only disposable prototypes left in
  `.superpowers/brainstorm/` and no spec, decision, or concluding direction.
  Before ending this kind of session, either commit to a documented
  decision/next step or explicitly say what's unresolved so it isn't
  mistaken for finished work.
- **Verify and close out delegated work yourself before calling it done.**
  When using subagent-driven-development or worktrees, a subagent reporting
  "done" is not sufficient — confirm and merge the result in the parent
  session. This matters especially near a session usage-limit boundary:
  don't let the session end assuming a subagent's self-report was the final
  verification.

## Cross-tool canon

`AGENTS.md` is the tool-agnostic source of truth. This file mirrors the same
facts plus the Claude Code–specific notes above; `.github/copilot-instructions.md`
is Copilot's mirror. Keep the three in sync, and if they ever disagree, reconcile
toward `AGENTS.md`.

**One deliberate asymmetry, added 2026-08-13 and widened 2026-08-15:** eleven
subsystem deep-dives that `AGENTS.md` still carries in full are summarized here
and extracted to `.claude/skills/hhvc-*/SKILL.md` (see "Subsystem deep-dives"
above). This file is loaded into every Claude Code session in its entirety,
which `AGENTS.md` is not, so length costs something here that it does not cost
there — and each of those sections is only useful while editing a handful of
files a skill can be loaded for. So "mirror" now means **the same facts, at the
same authority, with eleven of them one hop away** rather than byte-for-byte
parity. It does not license
dropping a fact from this file without putting it somewhere a session can still
reach: cutting for length alone is what produced the rotted pointer files the
next paragraph is about.

**The full mirror inventory lives in `AGENTS.md`'s own "Cross-tool canon"
section** — including the Cursor, Windsurf, Codex, and skill files, which are
deliberately **pointers** carrying no counts, no file inventories, and no
architecture summaries. Every one of them previously restated a summary and every
one of those summaries rotted into instructions that were actively wrong (see
that section for what they were still claiming). Do not "helpfully" re-expand
one; add the fact to `AGENTS.md` instead.

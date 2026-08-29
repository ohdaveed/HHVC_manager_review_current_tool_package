# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A static, no-framework mockup tool for **manager review** of a redesigned HHVC
(Healthy Housing and Vector Control) section of SF.gov. It is **bundled by Vite**
from a single ES-module entry point (`js/main.js`), and `server.ts` serves the
build output plus the optional sync API. **Bun** powers the CLI scripts
(validate/export/build) and the test runner. **The mockup has no UI framework** —
it renders through data-driven string templates, not components, and that is a
constraint rather than an accident: `#mockPage` has to look like the SF.gov page
under review. The **review workspace** is a different matter — it now hosts
React + MUI islands (see [React islands in the workspace](#react-islands-in-the-workspace)),
scoped to `#reviewWorkspace` and loaded on demand. Reviewer state lives in the browser's `localStorage` by
default, and the tool works fully offline with **no backend/database/external
service required.** `server.ts` also hosts an **optional** review-state sync
backend (Postgres when `DATABASE_URL` is set, SQLite otherwise — see
[Review-state sync backend](#review-state-sync-backend-optional))
that reviewers can opt into per-browser to sync decisions across
machines/reviewers — it's off unless deployed and configured, and every other
part of the tool works identically whether or not it's ever used.

A separate **Vite** sub-app lives at `forms/mosquito-workshop-request/` (a real
build step, built independently — see [Build outputs](#build-outputs)).

The repo currently holds **29 pages** under `pages/`. If `bun` is not found,
it installs to `~/.bun/bin`; run `export PATH="$HOME/.bun/bin:$PATH"`. Run
`bun install` before the first `dev` — `js/main.js` imports
`@sfgov/design-system` CSS and the third-party libraries for Vite to bundle.

## Definition of Done

Work is not complete until: the full test suite passes, changes are committed,
pushed to origin, a PR is opened (if on a branch), and CI is green. Never leave
commits sitting unpushed on a local branch. Before merging a PR, re-fetch and
confirm the remote head includes all local commits — a stale head has silently
dropped commits before.

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
  `build:railway`** — `js/main.js` imports `@sfgov/design-system` CSS plus the
  third-party libraries, and validate/test need `zod`, `fast-glob` and
  `happy-dom`. Nothing in `package.json` says so.
- **The lint gates are the `lint:*` steps in `.github/workflows/ci.yml`'s
  `format_validate_lint` job — read the job rather than a list here.** That sentence has been
  rewritten by every tool that joined it, each time as though it were the only
  addition, and an enumeration in three mirrored files is four copies of one
  fact. What is worth stating is the shape: there is no ESLint and **no type
  checking** in this repo — `typescript` is a devDependency, but nothing runs
  `tsc` and no gate type-checks anything; it is installed only so
  dependency-cruiser can parse `server.ts`, pinned `^6` because depcruise
  accepts `>=2.0.0 <7.0.0` and warns under v7. So Prettier covers formatting,
  oxlint's core rules
  cover correctness, Knip covers reachability, dependency-cruiser covers the
  module graph, and markdownlint covers the instruction docs. Each carries its
  own caveat, and each caveat lives with its tool: `lint:js` reads
  `.oxlintrc.ci.json` rather than `.oxlintrc.json`, so `bun run lint:anti-slop`
  stays a hand-run report; Knip gates only the categories that were clean when
  it was adopted, because it reads this repo's deliberate `window.<Namespace>`
  publishing as ~89 unused exports; `lint:docs` derives its file list from
  `git ls-files` rather than globbing. Plenty else fails a CI run — `validate`, the deploy bundle build,
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
wrong). `bun run test` runs 60 Bun unit-test files under `tests/`: `utils`,
`data-validation`, `page-render`, `page-render-hooks`, `csv`, `review-state-schema`, `reading-level`,
`plain-language`, `page-import-checks`, `mockup-image-export`,
`measure-window-graph`,
`review-insights-data`, `review-insights-charts`, `review-insights-render`,
`review-ops-data`, `knowledge-chunking`, `knowledge-sources`, `knowledge-retrieval`, `knowledge-search`,
`validate-compliance-audit`, `review-merge`, `review-state-sync`,
`check-revert`,
`ai-assist-schema`, `ai-assist-env`, `karl-tag-meta`, `karl-category`, `ci-workflow`, `esm-named-exports` — self-explanatory by name — plus a handful
whose non-obvious "why" is worth keeping:
`commit-msg-hook` (the trailer gate in `.githooks/commit-msg`, driven as REAL shell against real message files rather than reimplemented in JS — a second copy of the rule in the test would pass while the shipped rule was broken. Most of its assertions are about what must NOT be rejected, because the damaging failure is not a missed trailer, which amending fixes, but a hook that blocks ordinary human commits: the habit that produces is `--no-verify`, and a routinely bypassed hook enforces nothing. It also asserts the file's EXECUTABLE BIT, which is part of the contract rather than packaging — ggshield's `_dispatch` guards on `[ -x ]` and exits 0 without it, so a non-executable hook is an absent gate rather than a broken one, with no error to notice),
`mirror-consistency` (the gate over Cross-tool canon's central claim — that `AGENTS.md`, `CLAUDE.md` and `.github/copilot-instructions.md` state the same facts — which until now nothing enforced and hand-maintenance had already let slip: the Copilot mirror's security-review guidance drifted apart from the other two and was caught only because a reviewer read it. It does NOT compare the files, which are deliberately not identical — only one of the eleven headings the two full mirrors share is byte-identical, since `CLAUDE.md` extracts eleven subsystem write-ups to skills — so it checks shared FACTS instead, as a registry of commands and figures that must appear in all three however each words them, plus a short list of sections required to be byte-identical. The shared-fact searches — and only those — run over whitespace-collapsed text: written with a literal match one reported `2 tool calls` missing from a mirror that carries it across a line break, the same wrapped-prose blindness the refactor guidance warns about. The byte-identical check normalizes nothing, since a rewrap of one mirror and not the other is precisely the drift it exists to catch. Mutation-proven, and proven against the real drift — all seven of its security-review claims were absent from the Copilot mirror at `e01870f` and present in both full mirrors, so it would have failed on that tree; its three identifier claims were already present there and prove nothing about it, guarding instead against a mirror naming a wrong storage key or global shape — and there are only three because a file-wide claim on a REPEATED identifier cannot fail as it implies: `server.ts` appears 43 times in AGENTS.md, so its defining sentence could drift while forty-two other mentions kept the check green. Nine such claims were registered and then removed rather than kept as decoration, on the same reasoning that marks unfailable rules `scored: false`. It checks presence, not polarity: a mirror that keeps a token and reverses the sentence around it still passes, which is a limit stated in the file rather than papered over),
`skill-consistency` (the same gate one level down, over the eleven `.claude/skills/hhvc-*/SKILL.md` extracts and the `AGENTS.md` sections they were taken from. `CLAUDE.md` states the rule — the skills are extracts, not a second source of truth, and a correction goes into `AGENTS.md` and then into the skill — and until now only the first half was enforced. The second half failed three times in the eleven files, all found in one audit on 2026-08-22: `hhvc-review-sync-backend` still called the API SQLite-backed long after `build_scripts/storage.js` made it Postgres-when-`DATABASE_URL`, and both `hhvc-page-registry` and `hhvc-inline-content-editing` described `js/review/ux-improvements.js` as WRAPPING `window.renderPage`, which nothing has done since #194. Every one of those sat in the file a session is told to load BEFORE editing the subsystem the claim is about. Nothing else covered them: `module-paths` gates the `js/` paths in these files, `lint:docs` gates their markdown and `doc-claims` gates five counts, but a stale MECHANISM passes all three, because every path it names still exists. It carries a second registry the mirror gate has no equivalent of — RETIRED_MECHANISMS, the exact historical phrasings of things this repo has removed, which may not come back. A shared-fact claim catches a fact going MISSING; a retired-mechanism claim catches one that quietly stopped being true while both sides still read fluently, which is the failure that actually happened. Each retired entry must also be absent from all three mirrors, and that self-check is what keeps the list honest rather than a place to park opinions — which is also why a proximity rule (`wrap` within N characters of `renderPage`) was written first and rejected: it fires on the canon's own correct sentence, so it could not carry the check. Mutation-proven against the real drift — restoring the three skills to `17a09d3` fails nine of its assertions, naming each one. Same presence-not-polarity limit as the mirror gate, stated in the file. It carries one check that is not about the extracts at all: every `bun run <script>` cited by ANY tracked skill must exist in `package.json`. The other skills — `ship`, `verify`, `verify-railway-backend`, `karl-notes-drift-check` — are procedures rather than extracts, and a procedure names commands; `ship` alone cites eight gate scripts and pre-approves several in its `allowed-tools` front matter, all of which a rename breaks silently. `build:netlify` really was renamed to `build:railway`, and only a hand-sweep in the same commit kept a skill from being left pointing at it),
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
canonical table in `js/core/utils.js` — and, separately, every file that spells out
an INDIVIDUAL label as a literal, which is most of the queue: those are string
comparisons, so a renamed decision leaves the chip rendering and silently stops
matching), `doc-counts` (reads the counts back out of these docs and
compares them to the filesystem — this very list is what it checks),
`doc-claims` (the count-claim scanner's own unit tests — pins the
number-anchored capture against a `[\w-]+` false start, and the gap that
must admit digit-bearing words like `e2e` rather than letters-only, since a
letters-only gap would leave `.github/copilot-instructions.md`'s own e2e claim
unseen by this pattern — not, as an earlier version of this note claimed, what
let a wrong e2e spec count ship past CI once already; that was a file omitted
from the old hand-maintained `(file x claim)` matrix, not a regex gap, per
`build_scripts/doc-claims.js`'s own header comment),
`inline-content-edit-data` (pure `section_edits` diff/reapply logic against
`ORIGINAL_DATA`, no DOM, dual-exported like `review-merge`),
`inline-content-edit-adapter` (the pure markdown/HTML serialization boundary
between stored page-value strings and `@editorjs/editorjs`'s block-JSON
`OutputData`, dual-exported the same way; its fixed-point round-trip test
sweeps every string in the real page corpus, not a handful of hand-picked
cases, since a non-idempotent adapter would silently corrupt content on a
no-op open/close with no schema violation to catch it),
`inline-content-edit-refresh` (the re-entrancy guard around the follow-up
render a reapplied section edit triggers — `js/review/ux-improvements-state-sync.js`'s
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
rule three call sites remembered, and is now a property of the markup. It
also covers the panel's newer Field and Rules rows: the raw Wagtail field
name and its form rules are read straight from `js/karl/karl-blocks.js`
rather than restated in the panel code, so a wrong value has to be wrong in
that guarded inventory first — `tests/karl-blocks.test.js` is what would
catch it. For a Content-tab panel the Rules row is pinned to print the
inventory's literal `requiredDoc`/`repeatableDoc` strings, never the plain
booleans stored beside them, because `not recorded` is a real answer distinct
from `Optional` and substituting the boolean would claim a measurement that
was never taken. **The Promote tab is the one exception, and it is about
evidence rather than shape:** `PROMOTE_PANEL` carries no `*Doc` strings
because the field map fills in that table's Required column for every row —
`seo_title` and `search_description` are recorded `no` — so there the boolean
IS the measurement, and printing `not recorded` would conceal a fact the
field map states outright. Editorial rules live in a separate Guidance row
instead of folding into Rules, printed next to the measured schema value they
are judged against — the motivating case is `docs/karl-export-field-map.md`'s
obsolete-register entry `O14`, where the Help Center's 25-character cap for a
Button link is the rule an editor is held to (E3) while the live field
measured at `maxlength="255"` (E1) simply will not enforce it, a gap a merged
row would hide. And a guide whose reference names a panel missing
from that page type's inventory — Campaign, About us, or Report plus
`description` is the live case — renders no field block at all, so a
mockup-only guide never gets to look like a measured one),
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
and HTTP surface — added because `js/ai/ai-assist-client.js` and
`js/sync/review-state-sync.js` carry five near-identical functions and only the sync
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
no fallback resolves to '' before the stylesheets apply, and MUI turns an
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
`karl-blocks` (the drift guard over `js/karl/karl-blocks.js`, the Karl panel
inventory the transcript export types into: it parses
`docs/karl-export-field-map.md`'s eight per-type tables and asserts every
transcribed row still matches on label, raw name, required/repeatable wording,
block types and mockup source, plus that each row's cited `docLine` really is
its own row. The inventory is hand-transcribed from a 930-line prose document
that keeps changing, and silent drift means an editor is told to type into a
field that no longer exists. It asserts a MINIMUM row count per type FIRST,
because a doc-parsing regex that stops matching does not fail — it stops
checking, and reports zero rows on both sides), `karl-vocabulary` (the check that a `karl` note names a field that exists on
THAT page's content type. The vocabulary is derived from `js/karl/karl-blocks.js`
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
SKIP or weaken the regex to make the self-reference disappear), and
`page-render-hooks` (the `onAfterRender(fn)` post-render subscriber registry
in `js/mockup/page-render.js`, added to replace js/review/ux-improvements.js's
monkey-patch of `window.renderPage` — measurement found that patch responsible
for 24 of the edges binding this codebase's single 16-file dependency cycle,
nearly double the next contributor. A registry rather than a custom event,
deliberately: an event name is a string, so a typo unsubscribes silently and
nothing fails, and silent under-coverage is the failure this repo has now hit
four separate times. Asserts registration order, that a throwing hook does not
block its siblings, and that unsubscribe stops only the hook it was returned
for), and
`module-loadability` (the export contract of the four modules nothing else
imports — `build_scripts/ai/index.js`, `build_scripts/ai/compliance-audit.js`,
`build_scripts/docs-file-set.js` and `js/react/theme.js`. It looks like
ceremony and is not: **Bun's coverage reports only files a test actually
LOADED**, so an unimported module is absent from `coverage/lcov.info`
entirely rather than recorded at zero, and adding a module nobody imports
RAISES the reported percentage. These four are what remained after
`bunfig.toml`'s `coveragePathIgnorePatterns` declared the files that cannot be
instrumented without running them. The honest way to put them in the
denominator is a real import, never a synthesized zero-hit record: a
fabricated row has to guess which lines are executable, and would report
`js/react/theme.js` as untested when `tests/react-theme.test.js` covers it by
reading its source as TEXT — which is also why coverage here is a report
rather than a gate, since a tool that measures execution cannot see this
repo's text-level assertions at all. The assertions are export-surface
contracts rather than `toBeDefined()` filler, because `build_scripts/ai/` is
consumed by `server.ts` across the CJS boundary, where a dropped export
surfaces as `undefined is not a function` at request time).
**That list is spelled out explicitly in `package.json`'s `test` script rather
than globbed**, so a newly added `tests/*.test.js` runs only once it is named
there; until then it passes locally when invoked by hand and covers nothing in
CI. `tests/helpers/browser-env.js`, preloaded via `bunfig.toml`, registers a
**happy-dom** global environment before the loader runs (the module graph does
real work at import time), restores Bun's native `fetch`/`Request`/`Response`
afterwards since happy-dom's HTTP client breaks `review-api-server`'s real
requests, and redefines `window`/`document`/`localStorage` as writable so
`review-state-sync`'s tests can still stub them.

`bun run test:e2e` drives Playwright over `tests/e2e/` — twenty-six spec files
all UI-driven: navigation, editor panel, review workflow, review
queue, review-queue undo, stored review data, import/export, keyboard
shortcuts, workspace panels, accessibility, AI assist, AI rewrite, mockup PNG
export, Overview insight cards, adding and deleting page mockups, mockup
SFDS tokens, the chrome type scale, the Karl transcript panel, the Karl
guide panel's field rows on a real Transaction page, the Karl tag
categories rendering distinctly in both colour schemes, the
pre-navigation flush of in-progress sidebar edits, and
the workshop form as a design reference that submits nowhere, and the safeMarkdown sanitizer allowlist —
which can ONLY be asserted here for the `<strong>`/`<em>` positive assertions,
since happy-dom's DOMPurify strips both despite them being allow-listed, so a
unit assertion would either pin that artifact or pass vacuously
(`tests/utils.test.js` covers the rest of the safeMarkdown path in unit tests,
including image stripping, both link renderers, and script removal),
sharing plain helper functions in
`tests/e2e/helpers.js` (no fixture framework). One spec file,
`review-import-export.spec.js`, was deleted rather than repaired: its
round-trip tests hand-rolled the merge inside `page.evaluate()` instead of
calling `importReviewStateBackup()`, so it stayed green against the wholesale
replace that once destroyed reviews, and its other two tests duplicated
existing coverage. `import-export.spec.js` is the real coverage.
**`gotoFresh()` waits on `window.reviewKeyboardShortcuts.ready`**, not just the
sticky bar — the bar mounts early, so waiting on it alone let a test press a
global shortcut before `js/review/keyboard-shortcuts.js` had attached its `keydown`
listener. Playwright's `webServer` block starts `bun run start` on `:8080`
itself. In a sandbox with a pre-installed Chromium, point Playwright at it
instead of downloading:

```bash
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/opt/pw-browsers/chromium bun run test:e2e
```

`bun run validate` (`build_scripts/validate.js`) is a **complementary, not
redundant** check: it loads every `pages/*.js` file plus `js/core/page-data.js`
into a Node VM context and Zod-validates required fields/shapes, plus several
hardcoded business invariants (see below). It always validates the full page
set — there's no way to validate a single page file in isolation. **Run
`bun run validate` and `bun run test` after editing anything under `pages/`
or `js/core/page-data.js`.**

### CI

`.github/workflows/ci.yml` runs on pushes to `main`, on every pull request, and
on demand through `workflow_dispatch`, as a graph of nine jobs rather than one
long one, so a formatting or schema failure reports in seconds without waiting
on a Chromium download and a flaky browser run never masks a unit failure.

**The manual trigger exists because its absence was felt.** For four
consecutive commits Actions produced no runs for this repo at all — not failed
runs, no runs — and with only `push` and `pull_request` triggers there was no
way to ask for one, so `main` was merged to with a local test run as the only
evidence. `workflow_dispatch` takes no inputs on purpose: every job decides what
to run from the event name and the change filter, so a dispatch behaves exactly
like a push to `main` without anything having to be typed correctly into a form.

**Cancellation is scoped to pull requests, and that takes TWO settings rather
than one.** Superseding a PR run is free, since nobody needs the result for a
commit that is no longer the branch head. Superseding a `main` run destroys the
only record of whether that commit of `main` was green, and a cancelled run
reads as a failed one — and two merges landing inside one six-minute run is an
ordinary afternoon here.

`cancel-in-progress` governs only the RUNNING run. The concurrency GROUP
governs the pending one: GitHub permits a single pending run per group and
cancels the previous pending run when a newer one queues, regardless of
`cancel-in-progress`. Keying every `main` push on `github.ref` therefore left
the hole open at the other door — run A in progress, merge B pending, merge C
arrives and cancels B — so `main` pushes and dispatches key on `github.run_id`
instead, giving each its own group and serialising nothing. Changing one of
those two settings without the other reopens the case it was closed for.

**The Bun setup is one composite action, `.github/actions/setup-bun`.** Six jobs
carried a byte-identical `setup-bun` / `actions/cache` / `bun install` block,
which meant six copies of one cache key; a key that drifts in a single copy does
not fail anything, it just makes that job install from the network on every run,
staying green and getting slower. The checkout deliberately stays in each job:
a local composite action is read out of the workspace, so `uses: ./.github/...`
cannot resolve until `actions/checkout` has run in that same job, and the jobs
need different `fetch-depth` values anyway.

**Every job that USES Bun pins it from `.bun-version`, and that pin is
load-bearing.** They
took `bun-version: latest` until 2026-08-15, which meant the runtime changed
under the repo without a commit. Bun 1.3.14 stopped allowing CJS to `require()`
an ESM module; `build_scripts/storage.js` was the only ESM file under
`build_scripts/`, so `server.ts` threw at boot and every suite that spawns it
reported "did not start in time". Because `latest` resolved differently run to
run, the same commit passed and failed, and three rounds went into widening
timeouts before anyone captured the server's stderr. **Everything under
`build_scripts/` is CommonJS now** — keep it that way; `server.ts` named-imports
those modules from TypeScript, which is the supported direction. Bumping
`.bun-version` is a normal change, just a deliberate one.
`tests/ci-workflow.test.js` asserts the pin, though note its scope: it
splits the file on `uses: oven-sh/setup-bun` and checks each block it
finds, so it covers every job that sets Bun up and says nothing about a
job that does not. `changes` is the one that does not — it runs only
`dorny/paths-filter` and needs no runtime.

- **changes** — classifies the PR's touched paths into `docs` and `code`
  outputs. Everything below gates on those, so it is the only job that always
  runs.
- **docs_only_checks** — for a pull request touching docs and no code:
  `lint:docs`, `format:check`, **and the full unit suite**. That last one is
  not belt-and-braces. Docs are SOURCE DATA here — thirteen test files read
  them, including `doc-counts` and `doc-claims` (figures against the
  filesystem), `mirror-consistency` (the three instruction files against each
  other), `module-paths` (a `js/` path in a doc naming a real file) and
  `karl-blocks` (parsing `docs/karl-export-field-map.md` against the panel
  inventory). Linting alone would let a docs-only PR merge with a stale count
  or a mismatched field map, and only the push to `main` would find out. The
  whole suite runs rather than a curated list, because a named list is a second
  inventory of which tests read docs and free to drift from the tests.
- **format_validate_lint** — `format:check`, `check:revert`, `validate`,
  `lint:docs`, `lint:dead-code:ci`, `lint:architecture`, `lint:js`. The fast
  gates, so they report before anything builds.
- **build_railway** — `build:railway`, which doubles as a deploy-integrity
  check: it fails if the committed workshop-form `dist` references assets that
  were never committed (the "form shell that never hydrates" regression). It
  then **uploads `dist/` as an artifact**.
- **build_singlefile** — `build:singlefile`, in parallel with the above.
- **unit** — downloads that `dist/` artifact, then runs `test:coverage`, which
  is the same enumerated suite as `test` with an lcov profile added, and
  uploads that profile to Codecov. **The coverage half is a report, never a
  gate** — the upload cannot fail the job, and `codecov.yml` marks Codecov's
  own `codecov/project` and `codecov/patch` statuses informational, which is
  what keeps them non-gating. A ruleset CAN require those contexts —
  GitHub requires status contexts, not only job names — but they are not jobs
  in `ci.yml`, so `tests/ci-workflow.test.js` cannot enumerate them and the
  rule that every job be a required context does not reach them. **The download
  is what makes the ordering mean anything.** `needs:` only sequences jobs; a
  separate runner gets a fresh checkout, and `dist/` is gitignored, so without
  the artifact the job would test against a tree that has never been built. One
  test in `tests/review-api-server.test.js` asserts a set-but-empty
  `STATIC_ROOT` still serves the real built app, and it `skipIf`s itself when
  `dist/index.html` is absent — so it would pass by skipping and cover nothing,
  which is the exact gap the old in-job `build:railway` → `test` order existed
  to close.
- **e2e** — installs Playwright Chromium, downloads that same `dist/`, and runs
  `test:e2e` **sharded four ways** (`--shard=N/4`), uploading
  `playwright-report/` per shard on failure. It is the critical path — it ran
  338-380s while the other six finished inside 70s — which is what the shard
  is for. It downloads the build rather than making its own because four
  shards would otherwise each run `validate + vite build` to stand up their
  own Playwright `webServer`; `playwright.config.js` serves the artifact on CI
  and still builds locally, where no `dist/` can be assumed.
- **e2e_complete** — the aggregator, and the only reason the job above could be
  sharded. **A matrixed job's check contexts are suffixed** (`E2E shard (1)`…),
  so the required `Playwright end-to-end tests` context would be produced by
  nothing and sit permanently pending — the same failure the paragraph below
  describes. This job carries that name instead, so the protection settings
  needed no edit for the shard and need none for a future reshard. It passes on
  a matrix result of `success` or `skipped` (a docs-only or draft PR, matching
  what the unsharded job did) and fails on anything else — **but a skipped
  matrix is only a pass when nothing upstream failed**, and it checks EVERY
  upstream job rather than just the one it depends on for the artifact.
  `build_railway` alone was not enough: every job in that chain carries
  `!failure()`, so a `format_validate_lint` FAILURE makes `build_railway`
  SKIP rather than fail, and a skip read as benign printed a green
  `Playwright end-to-end tests` for a suite where no shard ran. `changes` is
  checked for the same reason one level further up. Only `failure` and
  `cancelled` are rejected — a skip has to stay acceptable, since
  `format_validate_lint` skips by design on the docs-only path and treating
  that as an error would make docs PRs unmergeable.
- **ci_ok** — the aggregation gate, and the only job with no condition but
  `always()`. It fails if any job above reported `failure` or `cancelled`, and
  separately if neither check path ran at all. See below.

**Measured 2026-08-28: this repo is gated by repository RULESETS, not by
classic branch protection.** `GET /repos/{owner}/{repo}/branches/main/protection`
answers `404 Branch not protected`, while `GET /repos/{owner}/{repo}/rulesets`
returns two active branch rulesets — `main-1` (21589341) and `main-2`
(21589342). The settings therefore live under **Settings → Rules → Rulesets**,
not Settings → Branches, and a ruleset does NOT appear in the `/protection`
payload — which is why the older wording below survived so long: every check of
the wrong endpoint came back empty and read as "nothing configured" rather than
as "looking in the wrong place". The two rulesets carry these rules, and nothing else:

| Ruleset             | Rules                                               |
| ------------------- | --------------------------------------------------- |
| `main-1` (21589341) | `deletion`, `non_fast_forward`                      |
| `main-2` (21589342) | `required_linear_history`, `required_status_checks` |

Two consequences follow, and the first corrects a claim this repo acted on for
days. **There is NO `pull_request` rule, so nothing requires review-thread
resolution and nothing requires an approving review.** The merge train's
"one remaining blocker" was diagnosed as `required_conversation_resolution`
holding every PR; no such rule exists. Measured on 2026-08-28, two PRs
(#235 and #213) each read `BLOCKED` with every context green, and each cleared
on its own once CI finished — the state was PENDING CHECKS, not an unresolved thread. If
you see `BLOCKED` here, wait for the checks before hunting for a thread.

**Second, `required_linear_history` is what makes squash the only real option.**
Merge commits are refused outright, so the choice on any PR is squash or
rebase-and-merge, and every recent commit on `main` is a squash.

**The required-context list further down was VERIFIED against `main-2`'s
`required_status_checks` on 2026-08-28, and the two now match exactly.** All
eight documented names are configured, in both directions: `ci.yml` defines
nine jobs, eight of them non-matrixed, and those eight are precisely the eight
required. `CI passed` was added to the ruleset once it landed, so the gate is
enforcing rather than advisory.

**`CI passed` is required ALONGSIDE the other seven, not instead of them.**
That is belt-and-braces and it works, but the section below argues the gate is
worth requiring on its own: it reads every other job's result directly, so the
seven are a hand-maintained transcript of a list that changes, which is the
failure this whole section is about. Dropping them is a safe simplification
whenever someone wants it — the gate already fails on anything they would have
caught. Nothing is wrong today; this is an option, not a defect. Every required context is a real job,
so none can sit permanently pending; and the one job that is deliberately NOT
required is `E2E shard`, for the reason the matrix note below gives: it is
sharded, so it only ever produces suffixed contexts (`E2E shard (1)`…) and the
bare name is produced by nothing. `Playwright end-to-end tests` is required in
its place, which is the whole reason that aggregator job exists.

**The rulesets' required status checks are job NAMES, not job ids, and they
have to be changed with this file.** Splitting the old `checks` job renamed the
context `Format, validate, unit tests` out of existence, and a context that no
job produces stays permanently pending however green the run — so a PR can go
fully green and still never satisfy the requirement.

**All six gating jobs have to be required, and the reason is counter-intuitive:
GitHub treats a conditionally SKIPPED job as a PASSING required check.** That
is what makes this graph's `if:` conditions dangerous to under-require:

- Require only the code-path jobs, and a docs-only PR satisfies every one of
  them by SKIPPING them, leaving `Docs-only checks` — which is where its real
  coverage lives — unrequired and therefore optional.
- Leave the builds unrequired, and a `build_singlefile` failure blocks nothing
  at all, while a `build_railway` failure SKIPS `unit`, and that skip then
  reads as a pass. A red build merges.

So the required set is **every job in the file that produces a context under
its own name**, `Detect changed files` included: `Format, validate, lint`,
`Unit tests (bun test)`, `Playwright end-to-end tests`, `Docs-only checks`,
`Build railway bundle`, `Build single-file export`, `Detect changed files` and
`CI passed`.

**That is eight of the nine jobs, and the omission is correct rather than an
oversight.** The ninth is the sharded E2E matrix, which only ever produces
suffixed contexts and whose bare name is therefore requirable by nothing — see
the matrix note above. Its aggregator, already listed, stands in for it.
Nothing else may be dropped from the list on similar reasoning without an
aggregator to replace it.

**Keep the paragraph above free of any other backticked job name.**
`tests/ci-workflow.test.js` locates it by its opening words, slices to the next
blank line, and treats every backticked string inside as a listed context — so
an explanatory mention of another job placed in that paragraph reads as an
extra requirement and fails the test. That is why this explanation is a
separate paragraph.

**`CI passed` is the aggregation gate, and it is the one context worth requiring
on its own.** Requiring all eight is the belt-and-braces reading of the rule
above, and it works; the trouble is that it makes the ruleset a hand-maintained
transcript of a job list that changes, which is the failure this whole section
is about. The gate collapses that to one name. It runs on every event, so it can
never be skipped into a pass, and it reads every other job's result directly:
anything reporting `failure` or `cancelled` fails it, including a job whose own
skip was caused by an upstream failure, because the upstream job is the one
reporting `failure`. It accepts `skipped` — that is what lets the two-shape
graph exist at all — and then closes the worst version of that loophole by
failing when NEITHER the docs path nor the code path ran, which is the state a
broken change filter produces and the one where a PR goes green having checked
nothing.

Until the ruleset is actually pointed at it, the gate is advisory, exactly as
the rule above says of any unlisted job. It is additive either way: adding it
breaks no existing required context, which is the opposite of renaming one.

The detector is the one people leave out, on the reasoning that it only
computes outputs and cannot itself be skipped — which is true and beside the
point. If it FAILS, every job downstream of it is skipped, each of those skips
reads as a pass, and the PR merges with nothing having been checked at all. An
action outage or a permissions regression is enough to get there. Requiring it
is what turns that silent green into a visible red.

Adding a job to this file means adding its name here and to protection, or it
is advisory.

**Half of that is now gated.** `tests/ci-workflow.test.js` asserts that the
enumeration above is exactly the set of job names `ci.yml` defines, in both
directions and in both full mirrors — so a job renamed in the workflow, or one
added and left off this list, fails CI at the moment of the edit rather than
months later when a PR sits permanently pending against a context no job
produces. It cannot read the rulesets itself (that needs a token and must
not be a test dependency), so the remaining half — copying this list into the
protection settings — is still yours. The test pins the list a human
transcribes; it cannot pin the transcription.

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
`window.HHVC_PAGES['<pageKey>']`. `js/core/page-data.js` then builds
`window.HHVC_DATA = { pages, order }`, where `order` is the array of
`[pageKey, menuLabel]` pairs driving navigation/menu order.

**Load order lives in `js/main.js`, not `index.html`.** `index.html` has exactly
one script tag — `<script type="module" src="/js/main.js">` — and `js/main.js` is
the root of the module graph: CSS, then the three third-party libraries, then the
core modules, then the review/UX layers. The old model (~47 classic `<script>`
tags sharing one global lexical scope) and the committed `js/vendor/` IIFE
bundles are both gone; Fuse.js, defu and papaparse are npm imports now.

Order is enforced two ways. **Core modules enforce it themselves** — a module
that needs `escapeHtml` imports it, and `js/core/state.js` imports
`js/core/page-registry.js`, which imports `js/core/page-data.js` first, which imports all of
`pages/*.js`, so `window.HHVC_DATA` is always populated before anything reads
it — and the reviewer's added/deleted pages are applied before `ORIGINAL_DATA` is
cloned. **The self-mounting IIFE subsystems still depend on
listed order** — `js/review/ux-improvements*.js`, `js/review/review-queue*.js`,
`js/review/dashboard-guidance.js` and
`js/review/keyboard-shortcuts.js` reach each other through `window.<Namespace>`
objects rather than imports, so their sequence in `js/main.js` is load-bearing
and hand-reviewed.

Note that "no imports" would be too strong, and used to be written that way:
only `js/review/review-queue*.js` takes none. The others do import — `js/core/utils.js`
helpers, and four imports in `js/review/dashboard-guidance.js` — so the module graph
already orders them against the _core_. What it cannot order is the part that
matters here: a `window.<Namespace>` a sibling IIFE assigns at mount time is
invisible to the graph, so that edge is still enforced only by this list.

A few functions are deliberately republished onto `window`, because callers
depend on the implicit globals the old shared scope provided: `window.renderPage`
(**nothing wraps it any more** — `js/review/ux-improvements.js` and
`js/editing/inline-content-edit.js` both register with `page-render.js`'s
`onBeforeRender`/`onAfterRender` registry now, which needs no `window`
reference at all, so `window.renderPage === renderPage` always and reassigning
it is not a supported extension point. What still needs the assignment is the
twenty-three `window.renderPage(key)` / `window.renderPage?.(key)` call sites
across the review/UX IIFEs, which reach it through `window` rather than
importing it. The other historical wrappers were the deleted
`js/interactive-sitemap.js`, and `js/review/manager-review-export.js`, whose
decorator went with the sidebar label that decorator refreshed),
`window.toggleSidebar` (an inline
`onclick` in `index.html`), `window.showToast` and `window.updateSearchPreview`
(called optionally by the IIFE layers, which degrade to silence rather than
throw), and `window.ORIGINAL_DATA` (read by `js/sync/review-state-sync.js`).

When adding a new page file: add `import '../pages/<file>.js'` to
`js/core/page-data.js` and a `[pageKey, menuLabel]` entry to its `order` array. A new
`js/*.js` module just needs an importer; if it is a self-mounting IIFE with no
importer, add it to `js/main.js` in the right position. Node-side scripts
(`build_scripts/`, `tests/`) hardcode no file lists — they discover `pages/*.js`
dynamically via `build_scripts/load-pages.js`. If you forget the page import,
`bun run validate` catches it: `build_scripts/page-import-checks.js` diffs
`pages/*.js` on disk against `js/core/page-data.js`'s imports. Vite already turns the
reverse case (an import naming a missing file) into a build error, but a page
nobody imports fails silently — it never registers onto `window.HHVC_PAGES`, so
the page just disappears. Import _order_ isn't checked; it's irrelevant, since
each page module only writes into `window.HHVC_PAGES` and navigation order comes
from the `order` array.

### React islands in the workspace

The review workspace renders through **React 19 + MUI**, mounted as islands inside `#reviewWorkspace`. Everything else — the sidebar, the toolbar, and above all `#mockPage` — is untouched plain JS and string templates, and **that boundary is the point**: Material styling on the mockup would misrepresent the page under review, so tool chrome is fair game and `.browser-shell` is not. The isolation is measured rather than assumed, and it holds because MUI emits scoped `.css-*` classes and **there is no `CssBaseline`** — that writes element-level rules on `html`/`body`/`*` and Emotion injects after the eleven stylesheets, so it would win ties inside the shell; use `ScopedCssBaseline` inside a panel if a reset is ever needed. `js/react/theme.js` is the only bridge to the design tokens, so retheming still means editing `css/theme.css` only. `.jsx` files live under `js/react/` and need `@vitejs/plugin-react`; Prettier still formats them, so `format:check` gates. Full rationale — the measurement, why the theme resolves tokens to literal values, why dark mode follows `prefers-color-scheme` only, and why each island needs its own child `<div>` — in the `hhvc-react-islands` skill.

### Card descriptions are inherited, not printed

A Karl Services/Resources subsection entry, a Related-panel entry, and a Resource Collection's Resource-section entry are all only page pickers, so their title always publishes as the **destination** page's own title. A card in `pages/*.js` carrying its own `text` was therefore showing reviewers copy that can never appear on SF.gov — which matters more here than in most codebases, because approving that copy is the entire point of the tool. `js/mockup/page-render.js` resolves **every** card description through one helper, `cardDescription(section, card)`, instead of printing `card.text`; an empty resolved description renders no element, not an empty one. **There are three buckets and they key on the section's `karl` note, NOT on `section.component`** — `inherits` renders the destination's title AND summary, `title-only` renders a title and a link and **nothing else**, `authored` writes its own words and is left untouched. Keying on `component` would corrupt Table and Title-and-text blocks, which is not hypothetical: it was the first version. **`js/core/card-inheritance.js` is dual-exported** exactly like `js/review/review-merge.js`, so the browser renderer and the Node audit cannot come to disagree about what inherits. Full rationale — the three buckets verified at DOM level, why `bun run audit-cards` is a report rather than a CI gate, and the sf.gov census that settled external-URL entries — in the `hhvc-card-inheritance` skill.

### Core module split (formerly one `app.js`)

The old monolithic `app.js` was split into focused modules — **do not re-monolith
them.** Those modules, plus every review/UX and optional-feature layer, now live
in nine feature folders under `js/` rather than one flat directory:

| Folder          | Owns                                                                                                                                                                                                                                                                                                                     |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `js/core/`      | Bootstrap, shared state and the cross-cutting vocabulary: `utils.js`, `state.js`, `app.js`, `page-data.js`, `page-registry*.js`, `card-inheritance.js`, `third-party-globals.js`                                                                                                                                         |
| `js/mockup/`    | Renders `#mockPage` from page data: `page-render.js`, `karl-tag-meta.js`, `karl-category.js`, `inline-link-target.js`, `mockup-image-export.js`                                                                                                                                                                          |
| `js/review/`    | The review/UX layers on top of the core: `review-queue*.js`, `review-insights*.js`, `review-ops*.js`, `ux-improvements*.js`, `dashboard-guidance.js`, `editor-panel.js`, `keyboard-shortcuts.js`, `manager-review-export.js`, `review-merge.js`, `review-state-store.js`, `review-state-validation.js`, `ui-controls.js` |
| `js/editing/`   | Click-to-edit inline content editing on the rendered mockup: `inline-content-edit*.js`                                                                                                                                                                                                                                   |
| `js/ai/`        | The optional AI assist and AI rewrite features, invisible unless `/api/ai/*` is configured: `ai-assist*.js`, `ai-rewrite*.js`                                                                                                                                                                                            |
| `js/sync/`      | The optional review-state sync client: `review-state-sync.js`                                                                                                                                                                                                                                                            |
| `js/karl/`      | Karl guide panels and the Karl transcript export: `karl-guide*.js`, `karl-blocks.js`, `karl-transcript*.js`                                                                                                                                                                                                              |
| `js/standards/` | Content-standards scoring: `reading-level.js`, `plain-language.js`                                                                                                                                                                                                                                                       |
| `js/react/`     | The React 19 + MUI islands mounted inside `#reviewWorkspace`: `mount.js`, `theme.js`, `checks-panel.jsx`                                                                                                                                                                                                                 |

`js/main.js` is the one file that stays directly under `js/` — it is the root of
the module graph, imported by nothing, so it has no folder of its own to belong
to.

- **`js/core/utils.js`** — 849 lines publishing 36 entries on `window.utils`, also
  exported as bare top-level functions. Loads first. Beyond the obvious
  (`escapeHtml`, `today`, `debounce`, CSV parse/serialize/download, DOM
  get/set) it owns three things worth knowing by name: **`safeUrl`/`urlProbe`**,
  the scheme guard the security section below is about; the **decision
  vocabulary** (`DECISIONS` and everything derived from it), which is the
  canonical list the rest of the tool must not restate; and
  `buildReviewRecord`/`REVIEW_RECORD_FIELDS`, the persisted record shape.
  **Add new cross-cutting helpers here rather than duplicating logic** — but
  note the module has drifted toward a grab-bag, and
  `isWorkspacePanelOpen`/`mountWorkspacePanelIfOpen` are a layer inversion
  living here: the bottom-most module reaching up into the workspace DOM.
- **`js/core/state.js`** — core state: `DATA`/`ORIGINAL_DATA` (a deep clone for
  field-reset), `pageData`, `pageOrder`, `currentPageKey`.
- **`js/review/ui-controls.js`** — toasts, sidebar collapse/scroll persistence, the
  page-picker `<select>`, review checklist.
- **`js/review/editor-panel.js`** — SEO/editor panel: input↔page sync, dirty-state
  indicators, search-result preview, per-field reset.
- **`js/mockup/page-render.js`** — turns `pages/*.js` objects into `#mockPage` HTML,
  including `karlTag()` for Karl CMS placement annotations.
- **A Karl tag carries two axes, and only one of them is safe to rename.**
  `kind` (`meta`/`body`/`placement`/`editor`) is what Karl field resolution
  reads: nearly half the `karlTag()` call sites in `js/mockup/page-render.js`
  pass a bare
  kind literal with no `context.role` at all, and `guideForContext()` falls back
  to the kind when no role is given — so for those call sites the kind IS the
  role, and renaming one silently changes which Karl field the guide panel
  claims to have measured. `data-category` — derived by
  `js/mockup/karl-category.js` from `kind`, `context.role`, `context.linkShape`
  and the inheritance fact — carries **colour only**. Nothing resolves a field
  through it, so a category may be renamed or re-coloured freely. Colour lives on
  `[data-category]` in `css/ux-improvements.css` and must never move back onto
  `[data-kind]`; the kind survives as the word printed inside `.karl-tag-kind`,
  which is what keeps colour from being the only encoding.
- **`js/core/page-registry-data.js`** — pure validation for a page a reviewer
  authored in the browser, plus `applyRegistryToData()`, the only function that
  mutates `order`/`pages` for the add/delete feature. Dual-exported and
  import-free; it is evaluated far earlier than the other dual-export modules
  (through `js/core/page-registry.js`, before `js/core/state.js`), so unlike
  `js/editing/inline-content-edit-data.js` it must not resolve anything off `window` at
  module scope — `js/core/utils.js` is not guaranteed to have run yet.
- **`js/core/page-registry.js`** — applies that registry onto `window.HHVC_DATA` and
  publishes `window.pageRegistry`. Must run before `js/core/state.js`'s
  `ORIGINAL_DATA` clone; see "Adding and deleting pages" below.
- **`js/core/card-inheritance.js`** — the shared classifier deciding whether a
  section's cards publish the destination page's title and summary, its title
  alone, or their own authored words. Imports nothing and reads no global, so it
  has no load-order dependency of its own. Dual-exported
  (`window.cardInheritance` plus `module.exports`) exactly like
  `js/review/review-merge.js`, and for the same reason — see "Card descriptions are
  inherited, not printed" above: the browser renderer and the Node audit must
  share one classifier rather than two copies that can silently drift apart.
- **`js/core/app.js`** — bootstraps DOM event listeners (`init()`) and renders the
  first page (`pestsTopic`).
- **`js/review/manager-review-export.js`** — manager review CSV/JSON snapshot,
  published on `window.ReviewExport` for the consolidated export control. It no
  longer wraps `renderPage`: that decorator existed only to refresh a sidebar
  label that has been cut.
- **`js/standards/reading-level.js`** — Flesch-Kincaid grade for body copy, behind
  `window.readingLevel`, backed by `text-readability` (a runtime dependency;
  40 kB raw / 17.9 kB gzip in the app chunk). **There used to be two
  implementations of this and now there is one.** This file carried a
  hand-rolled formula from the no-build-step era, and `build_scripts/reading-level.js`
  wrapped the library for Node — but only the Node copy had tests and only this
  one shipped, which is how they drifted 1.14 grades apart on average across
  the 29 pages without a red test anywhere. The drift ran toward "easier than
  it is" in aggregate, so nine pages reported hitting a reading target they
  miss — a check biased in exactly the direction that makes it useless. The
  Node copy is deleted and `tests/reading-level.test.js` imports this one. Do
  not reintroduce a second copy to avoid the dependency: the gap was
  rule-based syllable counting, which no regex approximates closely enough to
  matter.

### Review/UX layers are additive, on top of the core

`js/review/ux-improvements.js`, `js/review/review-queue.js`, `js/review/dashboard-guidance.js`,
and `js/review/keyboard-shortcuts.js` are self-contained
IIFEs that read `window.HHVC_DATA` and `localStorage`. Some write edited
title/summary/CTA/SEO fields back onto the **in-memory** `pageData` objects when
restoring saved edits — but **must never write back to the `pages/*.js` source
files or publish content.** They are review aids only, not publishing tools.

`js/review/ux-improvements.js` and `js/review/review-queue.js` are
thin orchestrators (event wiring + `init()` + public API) over sibling files that
do the work, each attaching functions to an internal `window.<Namespace>` object
(implementation detail — never referenced from `pages/*.js`):

- **`window.ReviewUx`** ← `js/review/review-state-store.js` (shared `window.reviewState`
  read/write/update), `js/review/ux-improvements-state-sync.js`,
  `js/review/ux-improvements-workspace.js`, `js/review/ux-improvements-export.js`.
  `js/review/review-merge.js` (`window.reviewMerge`) and `js/sync/review-state-sync.js`
  (`window.reviewStateSync`) sit alongside these as their own small globals —
  not under `window.ReviewUx` — since `js/review/review-merge.js` is also imported
  directly by `server.ts` (no DOM dependency) and needs no browser-only
  namespace.
- **`window.ReviewQueueInternal`** ← `js/review/review-queue-state.js`,
  `js/review/review-queue-rows.js`, `js/review/review-queue-render.js`, and
  `js/review/review-queue-import.js` (CSV import — kept isolated as the
  highest-regression-risk area; see [Local persistence](#local-persistence)).
- **`window.ReviewInsights`** (`js/review/review-insights.js`) ←
  `js/review/review-insights-data.js`, which attaches `.data`. The Overview cards;
  `js/review/review-queue-render.js` calls `window.ReviewInsights.render()` at the end
  of its own render, optional-chained.
- **`window.ReviewOps`** (`js/review/review-ops.js`) ← `js/review/review-ops-data.js`, which
  attaches `.data`. The stored-review-data panel, a collapsed section in Help.
- **`window.MockupImageExport`** (`js/mockup/mockup-image-export.js`) — PNG export of
  the mockups, standing on its own.

- **Three lazily-mounted panels publish a mount hook rather than rendering at
  init:** `window.__mountAiAssistOnTabOpen`, `window.__mountReviewOpsOnTabOpen`
  and `window.__mountPageRegistryOnTabOpen`.
  All three are collapsed `<details>` at the end of the Help panel now rather
  than tabs of their own, so `setWorkspaceTab` calls **all three** when Help
  opens — a
  reviewer expanding one must never find an empty box. Each panel ALSO catches
  an already-open tab at its own `init()` via `mountWorkspacePanelIfOpen('help')`
  in `js/core/utils.js` — `js/review/ux-improvements.js` initializes earlier and restores a
  persisted `workspace_tab` before these hooks exist, so without the catch-up a
  reviewer who left Help open came back to an empty panel.

- **AI assist breaks that naming pattern — mind the case.** `window.AiAssist` is
  the **internal** namespace (`js/ai/ai-assist-client.js` attaches `.client`, the
  browser half of the optional `/api/ai/*` routes and a no-op unless configured;
  `js/ai/ai-assist-render.js` attaches `.render`). `js/ai/ai-assist.js` consumes both,
  owns the request lifecycle and cancel, and publishes its public API on the
  separate lowercase **`window.aiAssist`** (`ensureRendered`,
  `refreshCapabilities`, `getCurrentPage`, `captureForm`). `window.AiAssist.ensureRendered`
  does not exist.

The workspace tab strip is `['overview', 'checks', 'help']`, numbered left to
right by the `1`–`3` shortcuts. It carried six until a UX review cut three:
**Sitemap** was removed outright (a fourth way to navigate the page set,
drawing a hierarchy one level deep), and **AI assist** and **Tool status** became
collapsed `<details>` at the end of Help — both depend on `server.ts`, which the
static Netlify deploy live at the time had no runtime for, so on the build
managers actually opened they were two permanently-empty panels holding two of
six slots. Railway runs `server.ts`, so they are no longer structurally empty —
but each still reports nothing until its own optional backend is configured,
which is why the cut stands. Help stays last, so
it is the digit that moves whenever the strip changes; `WORKSPACE_TABS`
(`js/review/ux-improvements-workspace.js`), the tab markup in `index.html` and the
`1`–`3` cases in `js/review/keyboard-shortcuts.js` must change together. The two
surviving lazy panels **also catch an already-open Help tab at their own
`init()`** — `js/review/ux-improvements.js` initializes earlier and restores a
persisted `workspace_tab` before those hooks exist, so without the catch-up a
restored tab painted empty until the reviewer switched away and back.
Relatedly, `hhvc:shortcuts-ready` and
`window.reviewKeyboardShortcuts.ready` are set **from `init()`, after** the
`keydown` listener is attached; firing at module scope announced a capability
that did not exist yet.

### The workspace is docked, not stacked

`#reviewWorkspace` is a **third grid column in `.app`**, sticky to the viewport, not the last child of `.canvas` — a reviewer has to see the page and the instruments judging it at once, and stacked it began more than nine screenfuls down. Most of the redundancy this layout accumulated followed from that, so **resist re-adding a second printing of anything**: co-visibility is what makes one copy enough. `applyWorkspaceVisibility()` in `js/review/ux-improvements-workspace.js` is the single place that toggles both the panel's `hidden` attribute and `.app.workspace-docked` — do not set either one inline. **`.review-workspace[hidden] { display: none }` is load-bearing**, since the rule above it sets `display: flex` and a class selector outranks the UA stylesheet's `[hidden]` rule; without the pairing, "Hide workspace" and the `w` shortcut both appear to do nothing. **Below 1700px the panel stacks in `grid-column: 2`, deliberately not `1 / -1`.** **The 1700px breakpoint is measured — re-measured on 2026-08-15 after the SFDS type and spacing work moved `.browser-shell`'s min-content floor, and deliberately kept at 1700 rather than lowered onto the new 1650 crossing. Do not lower it without re-measuring both numbers**; the crossing is asserted from the live layout in `tests/e2e/workspace-panels.spec.js`. Full rationale — the y=9,413 measurement that motivated the dock, the Axe finding behind `grid-column: 2`, the arithmetic behind 1650 and 1700, and why a layout assertion should sweep a range of widths rather than pick one — in the `hhvc-workspace-layout` skill.

### What the UX review removed, and why not to re-add it

- **The Karl-tag legend above the mockup.** A toggle, a four-row colour key, an
  explanatory sentence and a "What are Karl tags?" disclosure occupied ~495px —
  half a screen — between the toolbar and the SF.gov header, on every page and
  every load. The key decoded something that was never encoded in colour alone:
  each tag already reads `METADATA`, `BODY`, `PLACEMENT` or `EDITOR ONLY` in
  words. The switch moved to `.canvas-toolbar`; the legend renders once, in Help.
- **Three of four Overview KPI tiles.** "Visible" restated the "N of 19" printed
  directly above it. "Blocked" showed `stats.blocked`, which counts Blocked
  **plus** Revise and resubmit — so it read 5 while the Blocked filter chip forty
  pixels away read 2. Both numbers were right and the label was not, and a panel
  that visibly disagrees with itself in its first two rows spends the
  credibility the rest of it needs. The decision tally belongs to the chips,
  which count and filter with one control.
- **The page's name, printed four times.** The sidebar picker, a "Current page:"
  label under it, a "Viewing: …" badge in the toolbar, and the sticky bar. The
  middle two are gone — and with the label went the only reason
  `js/review/manager-review-export.js` wrapped `renderPage` at all, so that decorator
  went too.
- **The decision `<select>`.** It sat directly above five chips writing the same
  field. `#reviewDecision` survives as an `<input type="hidden">` because it is
  the field every persistence path reads through `getValue`/`setValue` and whose
  `change` event autosave, the history-round detection and the sticky bar all
  listen for; the chips carry the visible and accessible semantics.
- **Six of nine export/import controls.** Five ways to get review data out, in
  two formats, split across the sidebar and the Overview panel, with nothing on
  screen distinguishing "Export current review JSON" from "Download backup
  (JSON)" from "Export saved local reviews CSV". There is now one **Export
  reviews** button with a scope `<select>` (`runExport()` dispatches) and one
  **Import reviews** button whose file input takes either format
  (`importReviewFile()` routes by extension). Fewer doors into the merge path is
  a safety property here, not only tidiness — see [Local persistence](#local-persistence).

### Checks that cannot fail are not scored

`getRuleResultsFor()` marks **Page type**, **Audience** and **Reading target**
`scored: false`. All three are required by `build_scripts/schema.js` and
enforced by `bun run validate` in CI, so no page that can ship will ever fail
them: scoring them handed every page three free passes, lifting every ratio by a
constant and burying the rules that do fail under a wall of permanent green.
`window.reviewChecks.scoredRules()` is the filter, and both the Checks panel and
the queue's `checksPassed`/`checksTotal` go through it. They still render, under
a "Page facts" subheading, and the scored list orders **failures first**.

### Content-standards scoring

`js/standards/plain-language.js` encodes written standards, not preferences. Each check
carries `severity` plus a `source`/`section` pair and a ready-to-render
`citation`. `severity: 'error'` mandates join the scored rule list behind the
"checks passed" ratio and render their citation on the Checks tab;
`severity: 'warning'` findings are advisory, run to ~115 across the 29 pages,
and render separately so they cannot swamp the ratio. A scored rule must always
be pushed, pass or fail — dropping one shrinks the denominator and flatters the
thinnest pages. `source` exists because not every rule comes from the manual:
`house-style` and `list-length` cite the vendored `docs/source/sfgov-style/`
snapshot, and `button-length` cites manual §6.3 (Karl Button component), not
§7.8. Requiring a bare §7.x number is what previously forced all three into
miscitations. Like `js/review/review-merge.js` the module is dual-export
(`window.plainLanguage` + `module.exports`, no DOM dependency).

### URL schemes are validated, not just escaped

`escapeHtml` does not neutralize a scheme, so every structured `href` in
`js/mockup/page-render.js` runs through `safeUrl()` from `js/core/utils.js` — with one
exception worth knowing about: `formatMarkdown()` (`js/mockup/page-render.js:51`)
gates inline `[label](target)` links on a bare `/^https?:\/\//` test instead.
That is not a hole today, for two reasons that both have to hold: `escapeHtml`
runs over the whole string first, so the attribute cannot be broken out of,
and the regex admits only `http(s)`, which `safeUrl` would allow anyway. It is
still the one `href` that would not follow `safeUrl` if the scheme rules
changed. It is a
**scheme** guard, not a URL allowlist: `http`, `https`, `mailto`, `tel` and
**anything with no scheme at all** pass unchanged — root-relative
(`/forms/…`), document-relative (`help/foo`, `../help`), and bare fragment or
query targets (`#top`, `?q=1`). What it rewrites to the inert `#` is a
recognized-but-unsafe scheme (`javascript:`, `data:`, `vbscript:`) or
protocol-relative `//host`, which reads as relative but leaves the origin. It
strips control characters from the string it _tests_ (browsers resolve
`java\tscript:` as `javascript:`) but **trims whitespace from the value it
returns**. Since `findUnsafeUrls()` decides by comparing `safeUrl(value)`
against the original, a whitespace-padded but otherwise safe URL is reported as
an unsafe scheme — a false positive, not intended behaviour. No page carries
one today.
`findUnsafeUrls()` in `build_scripts/data-checks.js` enforces the same rule in
`bun run validate` and in the AI output validator, importing `safeUrl` rather
than restating it so renderer and validator cannot drift. That import crosses
the CJS/ESM boundary — CJS `require()`ing ESM, the direction Bun 1.3.14 dropped
for `build_scripts/storage.js`. **This one is not the same case, and the
difference was measured rather than assumed** (2026-08-15, Bun 1.3.14): Bun
rejects `require()` only of an ASYNC module, and `js/core/utils.js` has no top-level
await and imports nothing, so it stays synchronously evaluable and the crossing
works. The boundary is narrower still — `await Promise.resolve()` is already
settled and requires fine, while `await new Promise((r) => setTimeout(r, 0))`
and `await import('node:path')` both throw. So the hazard is one _deferring_
top-level await away, and it would surface as `bun run validate` dying with a
TypeError naming neither validate nor the page data.
`tests/data-validation.test.js` guards it in a **subprocess**, which is
load-bearing: two in-process versions were written first and both passed
against a deliberately broken `js/core/utils.js`, because a sibling test file that
ESM-imports it leaves it cached for any later `require()`. **The fix if that
guard fails is to remove the await, not to restructure `safeUrl`** — it is the
XSS scheme guard, and on the BROWSER side every dual-export module in `js/`
is read off `window` rather than named-imported (Node `require`s them
directly, which is the half that works), so extracting `safeUrl` would push
`js/mockup/page-render.js` onto window indirection to solve a problem that does not
exist.
Separately, **CI never exercises that crossing under Node**:
every path that loads `data-checks.js` runs under Bun (`bun run validate`, and
`build:railway`, which invokes `bun build_scripts/validate.js`). CI does run
Node — `build:railway` ends in `node build_scripts/copy-workshop-form.js` — but
that script never touches `data-checks.js`, so the `require(esm)` path is
uncovered. That path needs
`require(esm)` enabled — check `process.features.require_module` rather than a
version number; it is opt-out by default on current Node 22 but was flag-gated
in early 22.x.

### Overview insight cards (`js/review/review-insights*.js`)

Two compact cards above the review queue table — review activity over time (a chart) and the pages whose automated checks are failing (a ranked list). They sit on the **Overview tab rather than a workspace tab of their own** on purpose: a tab is a scarce slot bound to a number key. There were three cards, and the two that were cut — Decision mix and a Checks-needing-attention bar chart — are worth not re-adding. `js/review/review-insights-data.js` is the pure data shaping, dual `window`/`module.exports` like `js/review/review-merge.js`; `js/review/review-insights.js` orchestrates; `js/review/review-insights-charts.js` is the only module that imports ECharts. **That import is dynamic, and that is load-bearing rather than tidiness** — ECharts is ~530 KB raw / ~180 KB gzip, more than the entire rest of the bundle, so it must stay its own chunk; and the headings and data tables are built **synchronously, before the import is requested**, so the numbers are in the DOM even if the chunk never loads. **Colour is never the only encoding**, and decision fills use `--viz-decision-*` rather than the `--status-*-border` chip tokens — if you change those, re-validate the contrast rather than eyeball it. Full rationale — why each cut card was cut, the re-parented chart host and its generation counter, and the ΔE measurements — in the `hhvc-review-insights` skill.

### Karl transcript export (`js/karl/karl-blocks.js`, `js/karl/karl-transcript.js`)

A paste-ready, per-page instruction listing what an editor types into Karl,
field by field, in the order Karl's own form presents. `bun run export:karl`
writes one markdown file per page into `review/karl-transcripts/` (gitignored,
regenerate rather than edit); a collapsed section at the end of the **Help** tab
renders the same transcript for the open page with this browser's edits applied.
**A human performs every keystroke** — no API writes, no credentials, no
publishing path — so the standing rule that a review layer never writes back to
`pages/*.js` and that an export is never publication approval survives intact.
A transcript changes what an export contains, not what it authorizes.

- **`js/karl/karl-blocks.js` is transcribed from `docs/karl-export-field-map.md`, not
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
  `js/core/card-inheritance.js` classifier, passed in rather than re-derived. An
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

### Queue undo (`js/review/review-queue-undo.js`)

One step of undo for row and bulk decision actions. `applyQueueAction` in
`js/review/review-queue-rows.js` is the single funnel every such action goes through,
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

### Inline content editing (`js/editing/inline-content-edit*.js`)

Click-to-edit directly on the rendered mockup — every visible text field except cards, persisting through the same `localStorage` review-state model as every other field. A review aid: `pages/*.js` is never touched. **The scope is one list, `EDITABLE_FIELD_SHAPES` in `js/editing/inline-content-edit-data.js`**, declaring each editable path and the value shape (`string`, `textArray`, `factsArray`, `stringArray`, `table`) its stored entry takes — `factsArray` is the one that is not reused, requiring both halves of a `top-facts` `{label, text}` because the renderer prints the label unguarded. **A path stamped `data-rewrite-field` by a renderer but missing from that list silently loses the reviewer's edit on the next load** — step text was in exactly that state and is the reason the list exists; add the path in both places or neither. **Cards deliberately carry no `data-rewrite-field`** — an inheriting card's description IS the destination page's `summary`, so an edit here would appear to work and then vanish; do not "complete" the feature by adding it. Full rationale in the `hhvc-inline-content-editing` skill.

### Adding and deleting pages (`js/core/page-registry*.js`)

A reviewer can create a page mockup and delete an existing one from the browser. Same posture as every other layer: `pages/*.js` is never written, no backend, works on the static build. `js/core/page-registry.js` MUST stay imported by `js/core/state.js` so it runs before the `ORIGINAL_DATA` clone. Full rationale — including the restore-snapshot hazard that silently drops inline edits — in the `hhvc-page-registry` skill.

### Stored review data (`js/review/review-ops*.js`)

A collapsed section at the end of the **Help** tab reporting what this browser is actually holding and how it is connected — previously only visible in devtools. `js/review/review-ops-data.js` is the pure diagnostics, dual `window`/`module.exports` so the tests need no browser; `js/review/review-ops.js` is the panel, lazily mounted when Help opens with the same `mountWorkspacePanelIfOpen()` catch-up the AI assist panel uses. Two invariants are safety-shaped and stay here. **An empty page-key set reports NO orphans, not all of them** — an empty set means page data has not loaded, and the other reading would put a "remove these" button in front of the reviewer's entire review history. And **pruning is the only path in the tool that deletes review data outright** (everything else merges), so it confirms with the count and the keys first and **re-derives the list at click time** rather than trusting what was rendered, since the panel can sit open while a sync pull or import changes state underneath it. Full rationale — why it lost its own tab, why orphaned records are a real class, and why `local_dirty`'s three states are reported separately — in the `hhvc-review-ops` skill.

### Page object shape and validation rules

The enforced Zod schema lives in `build_scripts/schema.js` (shared by
`build_scripts/validate.js` and `tests/data-validation.test.js`, so the schema
has coverage independent of current page content). A page has `slug`,
`type` (a **closed enum** — `z.enum(PAGE_TYPES)`, not a bare string — whose
**eight** permitted values are all in use:
`Transaction` (14 pages), `Information` (6), `Resource Collection` (3),
`Campaign` (2), `Topic` (1), `Agency` (1), `About us` (1), and `Report` (1),
matching Karl content-type names. It is closed rather than open because
`js/karl/karl-blocks.js` keys its per-type panel inventory on this value, and an
unrecognised type selects no inventory. **The export is not silent about that** —
`buildTranscript()` emits a single `UNMAPPED` entry reading
`No Karl panel inventory for content type "X"` (`js/karl/karl-transcript.js:309`),
which names the problem clearly. What the closed enum buys is **when** that
failure arrives: unclosed, a typo'd type is caught at EXPORT time, on a page
already authored and reviewed; closed, `bun run validate` rejects it at
authoring time, before anyone builds on it. Adding a ninth type means capturing its form in
`docs/karl-export-field-map.md` and adding its panel inventory, in that order.
The list read six until 2026-08-15, omitting
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

All reviewer state (decisions, notes, edited SEO fields, workspace UI prefs) is
saved client-side under the versioned key `hhvcManagerReviewState:v1`. Bump the
version suffix if the persisted shape changes incompatibly. Workspace UI prefs
(`workspace_open`, `workspace_tab`, `last_page_key`, `show_karl_tags`) live under
`state.ui` in the same blob. This localStorage layer — synchronous
`window.reviewState.read()/write()/update()` — is the tool's always-available
core and is unaffected by whether the optional sync backend below is ever used.

Each page's review record also carries an append-only `history[]` array:
`{ timestamp, reviewer, decision, notes, risks_or_blockers, updated_by }`
entries recording each review round. **`mergeReviewRecord()` in
`js/review/review-merge.js` is the only place a history entry gets constructed**, and
only at discrete round-boundary events — queue actions/keyboard shortcuts
(`updateLocalReviewForPage`), CSV/JSON import (`importReviewStateBackup`),
server sync (`server.ts`'s `putReviewPage`), and a decision change made from
the sidebar. The continuous per-keystroke/blur autosave
(`saveCurrentPageToLocalStorage`) deliberately skips `mergeReviewRecord` — it
just refreshes the working snapshot, carrying `history` forward untouched —
otherwise every debounced keystroke would append an entry.

The sidebar decision (`<select>` or quick-action chip) is the one exception
that shares the autosave path, so `saveCurrentPageToLocalStorage` singles it
out via `isDecisionRound()`: one entry when the decision actually
_transitions_, never per keystroke, and on a brand-new record only when the
reviewer moved off the default `Needs review`. Queue actions append their own
entry before dispatching sidebar-sync events, so autosave sees a matching
decision and nothing double-records.

**The review import/export round-trip can destroy existing reviews** — a prior
regression replaced saved state wholesale instead of merging. The actual
round-trip logic lives in `js/review/review-queue-import.js` (CSV import) and
`js/review/ux-improvements-export.js` (saved-state JSON backup/restore), both merging
through the same `mergeReviewRecord` per-page-key path the sync backend uses;
`js/review/review-queue.js` wires the handlers and `js/review/manager-review-export.js`
exports current-page snapshots. **Any change to any of these review
import/export modules, or to `js/review/review-merge.js`, must be verified against
the round trip itself**: export a snapshot, re-import it, and confirm existing
decisions/notes survive rather than being wiped.

**Two e2e specs cover this, and the split between them is the interesting
part** — both drive the real UI (export button clicks, file-input imports),
because the file that used to be described here as the API-level half,
`review-import-export.spec.js`, was deleted precisely for not doing so: it
hand-rolled the merge inside `page.evaluate` instead of calling
`importReviewStateBackup()`, so it stayed green against the wholesale replace
that destroyed reviews once already.

- **`tests/e2e/import-export.spec.js`** — both directions end to end, asserting
  `history.at(-1).updated_by === 'import'`, which is what proves merge rather
  than wipe. Its merge tests seed state through `seedState()` (a direct
  `localStorage` write, so the export path never runs), and its round-trip test
  clears state before re-importing, so nothing is left for a wipe to destroy.
- **`tests/e2e/merge-verification.spec.js`** — the shape that misses, and the
  one the warning is actually about: re-importing an **older snapshot on top of
  live state that has moved on**. A page reviewed after the export is absent
  from the file, so a wholesale replace drops it. Everything goes through the
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

`collectKnowledgeSources()` is the single definition of the corpus — not a glob — and every chunk carries a `category`: `hhvc-standards` (the HHVC Web Governance and Content Standards Manual), `hhvc-policy`, `sfgov-style`, `sfgov-live`, `karl` (the CMS as MEASURED), `karl-gitbook` (the CMS as DOCUMENTED — kept separate because the two have disagreed four times over, and **since the 2026-08-23 reversal the prompt says the HELP CENTER wins** where both describe the same field, with `karl` still authoritative for raw field names, panel order and anything the guide does not discuss), `mockup-draft` and `sfds`. Category comes from the first path segment under `docs/source/`, so a new folder files itself with no code change; **`EXTERNAL_SOURCE_FILES` is the exception**, an explicit `{path, category}` list for documents living outside that tree — and **adding a file to it moves the measured counts**, so re-measure and re-ingest rather than editing the list alone. **`mockup-draft` is about a quarter of the corpus and is the dangerous one**: draft copy nobody approved, including the page being audited, so the system prompt forbids citing it as the authority a finding rests on, and the category is resolved from the matched row rather than the model, which cannot spoof it. **`bun run ingest` is yours to run and is billed** — nothing in CI or the build does it, so a corpus change is not live on a deployment until it runs. Full rationale — the per-category counts, why the compliance matrix is projected from CSV rather than committed, why a superseded document cannot carry its own warning, and the retrieval floor this corpus does not have — in the `hhvc-rag-knowledge-base` skill.

### Reviewer sign-in (`/api/session`)

The API is bearer-gated and the browser bundle is public, so a token can never
ship in it — which left every reviewer pasting one by hand, and is the reason
sync went unused for months. **Railway removed the constraint that forced
that**: `server.ts` serves the app and `/api/*` from one origin, so a cookie it
sets comes back automatically.

- **`POST /api/session`** takes `{password}`, compares it constant-time against
  `REVIEW_SESSION_PASSWORD`, and sets an `HttpOnly; Secure; SameSite=Strict`
  cookie. `GET` reports `{active, loginAvailable}` — deliberately ungated, since
  it is how a browser learns it _can_ become a principal, and gating it would be
  circular. `DELETE` signs out.
- **The cookie is a signed assertion, not a stored session**:
  `<principal>.<expiry>.<HMAC>`, verified per request. No session table, nothing
  to replicate between instances, nothing lost on restart. The key is derived
  from the configured API tokens, so **rotating `REVIEW_API_TOKEN` invalidates
  every outstanding session** — which is what you want from a rotation.
  `REVIEW_SESSION_SECRET` separates the two lifecycles if a deployment wants
  that.
- **A session gets `review:read` and `review:write` only — never
  `ai:generate`.** AI calls cost money per request, so a shared password that
  also unlocked generation would make one leaked password an unbounded bill. A
  cookie-authenticated AI request gets 403, not 401.
- **Bearer tokens still win when both are present.** A script running with a
  scoped token in a browser that also holds a session must get the token's
  roles, so the cookie is only consulted after the bearer loop finds nothing.
- **Sign-in attempts are throttled globally** (10 per minute), not per
  principal — a sign-in has no principal yet, and keying on client IP is not
  trustworthy behind a proxy this server does not control. Blunt on purpose.
- **CSRF control is `SameSite=Strict`**, plus the existing origin allowlist and
  the JSON content type the routes require; a cross-site form post cannot reach
  them.
- **`Secure` is dropped only on plain-HTTP localhost**, or `bun run dev:api`
  and local verification would silently stop receiving the cookie.
- Unset `REVIEW_SESSION_PASSWORD` → `POST` answers **501** and sync stays
  token-only. Fails closed like everything else here.

### Review-state sync backend (optional)

**Sync runs automatically as of 2026-08-14** — `startAutoSync()` pulls once at
init, `scheduleAutoPush()` pushes a page on a 3s debounce **after** the autosave
has written localStorage (never instead of it), and `pushDirtyPages()` sends
work saved while the server was unreachable. No push may precede the first pull,
or it carries a `synced_at` baseline the browser never observed and earns a 409.
The client still never merges on the push path — the server does, with
`updatedBy: sync` — so history stays bounded. The default endpoint is the
page's own origin now, not a baked-in hostname; the token still has no default.

`server.ts` optionally serves a small sync API alongside static files, backed by Postgres or SQLite depending on `DATABASE_URL` (see "Where review records live" below), with `js/sync/review-state-sync.js` as its no-op-unless-configured client. Entirely additive, off by default, fails closed (501). Auth is the shared layer described under "Optional API access hardening" above. Full rationale — push/pull asymmetry, the never-compare-clocks rule, `local_dirty`'s tri-state, conflict binding — in the `hhvc-review-sync-backend` skill.

### AI assist backend (optional)

`server.ts` hosts an optional content-drafting API under `/api/ai/*`, backed by `build_scripts/ai/`. Additive, off by default, fails closed; two independent gates (API authorization, then a provider key); never writes anything. Full rationale — provider registry, usage normalization, input bounds, cancellation classification — in the `hhvc-ai-assist-backend` skill.

### RAG knowledge base (optional)

`compliance-audit` is a second `/api/ai/generate` task that grounds an audit in this repo's own `docs/source/` corpus. Same posture as the rest of the AI backend: additive, off unless configured, never writes. Full rationale in the `hhvc-rag-knowledge-base` skill.

### AI rewrite (optional)

A floating button offering an AI rewrite of the body copy a reviewer selects (`js/ai/ai-rewrite.js`, `js/ai/ai-rewrite-render.js`). Additive, invisible unless `/api/ai/*` is configured, never writes to `pages/*.js`. Full rationale in the `hhvc-ai-rewrite` skill — read it before touching those files or `data-rewrite-field` addressing.

### Build outputs

- **`bun run build:singlefile`** (`vite build --mode singlefile`, via
  `vite-plugin-singlefile`) inlines every script and stylesheet into one portable
  `dist-singlefile/index.html`. It replaced the hand-rolled
  `build_scripts/build-single-file.js`. That output and `dist/` are
  **gitignored generated files; never hand-edit.** Edit sources, re-run `bun run build`.
- **`build_scripts/extract-pages.js`** (first half of `bun run export`)
  regenerates `data/page_inventory.{json,csv}`. `data/` is absent on a fresh
  clone (gitignored); this script creates it. Dev/serve never touches `data/`.
- **`build_scripts/sync-tracking-sheet.js`** (second half of `bun run export`,
  also `bun run sync-tracking`) regenerates the Google Sheets–ready tracking CSVs
  under `review/`. **`build_scripts/push-tracking-sheet.js`**
  (`bun run push-tracking`) three-way-merges against the live Master Control
  workbook (IDs/tab gids in `build_scripts/sheet-config.json`) and optionally
  pushes via the Sheets API. It needs a Google service-account key — gitignored,
  and it must stay that way (never commit `*-service-account*.json` or
  `.env.local`).
- **`bun run build:railway`** (what `railway.json` runs as its build command)
  runs `validate` →
  `build:app` (the real Vite production build) →
  `build_scripts/copy-workshop-form.js`. That copy step does **not** run the
  sub-app's Vite build — it copies whatever is checked into
  `forms/mosquito-workshop-request/dist`, so rebuild that form first
  (`bun run build:workshop-form`) after editing its `src` or the deploy ships
  stale assets. It fails loudly if the committed form HTML references assets that were
  never committed (the "form shell that never hydrates" regression).
- `server.ts` mirrors the same security headers (`X-Content-Type-Options`,
  `X-Frame-Options`, etc.) that `netlify.toml` declares for the retired static
  site, so the live Railway deploy and the archived Netlify config agree.

### Where review records live (`build_scripts/storage.js`)

One module decides the store and speaks its dialect; `server.ts` calls functions
and never sees a driver, a connection or a SQL string.

- **Postgres when `DATABASE_URL` is set** — Railway injects it from the managed
  Postgres service in `hhvc-manager-review`. **SQLite at `DATA_DB_PATH`
  otherwise**: local dev, `bun run dev:api`, and every server test.
- **SQLite is kept deliberately, not left behind.**
  `tests/review-api-server.test.js` spawns the real `server.ts` against a temp
  DB and asserts twenty-odd behaviours over real HTTP. Keeping the fallback is
  what lets that suite run with no service container in CI.
- **Every function is async, including the SQLite ones.** `bun:sqlite` is
  synchronous and `Bun.SQL` is not; giving them different shapes would push the
  difference back into `server.ts`, which is what the seam exists to prevent.
- **`updated_at` is TEXT in both drivers, never a timestamp type.** Every
  freshness check in this system is a string compare — the server's
  `existing.updated_at > patch.synced_at`, the client's
  `serverRecord.updated_at > localRecord.synced_at` — against ISO strings that
  only ever come from the server. Letting Postgres parse and reformat them would
  change those comparisons for values differing only in representation, and the
  failure mode is a silently lost update.
- **The `record` column is `JSONB` on Postgres and `TEXT` on SQLite, and it is
  passed to the driver as an OBJECT.** Not a schema detail: SQLite hands the
  column back as a string to parse while the Postgres driver returns an
  already-parsed object, which is why one helper normalizes both. The binding
  half is measured and counter-intuitive — interpolating
  `${JSON.stringify(record)}::jsonb` looks equivalent and stores a jsonb
  **string scalar** instead, where `jsonb_typeof` returns `"string"` and
  `record->>'decision'` stops resolving. Anything hand-writing a query or a
  migration against this column needs both facts.
- **The compare-and-swap is the load-bearing line.** SQLite gates the conflict
  branch with `WHERE review_pages.updated_at = ?` and reads `changes`; Postgres
  does the same and counts rows `RETURNING`ed. `RETURNING` rather than a
  driver-specific rows-affected field, because it is the portable way to tell a
  skipped conflict branch from a real write.
- **DDL runs at boot, not lazily on the first request.** Lazy was fine for a
  file only one process opens; two Postgres replicas racing the same
  `CREATE TABLE` on their first requests is not.
- **`knowledge_chunks` lives behind this seam too**, so `bun run ingest` writes
  wherever the deployment reads. Embeddings are raw little-endian Float32 bytes
  in both drivers — a BLOB in SQLite, `bytea` in Postgres.
- **The seam is verified on Postgres, not assumed**: the deployed database held
  **816 chunks across 78 documents** after a re-ingest on 2026-08-17, matching
  the on-disk measurement category for category. **That is a record of what one
  ingest wrote, not a standing guarantee** — the deployed count drifts behind
  the corpus the moment an ingested document is edited without a re-ingest, and
  it had twice: a reading of `chunkCount: 768` predated both
  `docs/karl-export-field-map.md` joining the `karl` category and the `sfds`
  category existing at all, and a later 812 was 4 short from edits to that
  file's own register. Read the live count from `/api/ai/capabilities` rather
  than from this line.
- **Ingesting against the deployed Postgres needs two services' variables**, and
  `railway run` supplies one service's at a time: `DATABASE_URL` belongs to the
  Postgres service and `GEMINI_API_KEY` to `web`. The deployed `DATABASE_URL`
  also names `postgres.railway.internal`, which does not resolve off-platform —
  rebuild it against `RAILWAY_TCP_PROXY_DOMAIN`/`RAILWAY_TCP_PROXY_PORT` rather
  than reusing the value the service itself sees.
- **Bun's Postgres client is built in** (`Bun.SQL`, Bun 1.3+), so this added no
  npm dependency — the same reason `bun:sqlite` was used in the first place.

### Deploying — Railway is the live host

**<https://web-production-9bb3b.up.railway.app>** is the deploy reviewers open.
Railway project `hhvc-manager-review`, service `web`, connected to this repo's
`main` branch, so a merge redeploys. Config lives in `railway.json`: build
`bun run build:railway`, start `bun run serve`.

- **`bun run serve`, not `bun run start`.** The `start` script is
  `build:railway && serve` — correct locally, wrong on a platform that already
  ran the build, where it would repeat the whole thing at boot. The bare `build`
  script is wronger still for a server: it also produces the single-file export
  and rebuilds the workshop form.
- **`server.ts` must exit 0 on SIGTERM, and that is a deploy concern rather
  than tidiness.** Railway retires a deployment by sending SIGTERM and reads the
  exit status that follows as the verdict on it. With no handler the default
  disposition kills the process, `bun run` reports it as terminated by a signal
  (128 + 15 = 143), and Railway mails "Deploy Crashed!" about a container it
  stopped on purpose — which it did on every deploy to `main`, on both services
  then deployed, with the only trace being one line in the OUTGOING
  deployment's log: `error: script "serve" was terminated by signal SIGTERM`.
  A crash alert that fires on every healthy deploy trains its reader to ignore
  the one that matters. The handler drains via `server.stop(false)` — `false`
  is load-bearing, since `true` severs in-flight responses — and races that
  against a 10s timer so a request that never completes cannot hold the process
  into Railway's SIGKILL and return the same 143 by a slower route.
  `tests/review-api-server.test.js` asserts `signalCode` is null as well as
  `exitCode` 0, because a signal-killed process reports `'SIGTERM'` there
  whatever the code says. **The `railway.json` start command stays
  `bun run serve`** — measured, not assumed: with the handler installed the
  script wrapper propagates the clean exit and stops printing the error line,
  so bypassing it buys nothing.
- **`HOST=0.0.0.0` is required and is a variable, not a code change.**
  `server.ts` defaults to `process.env.HOST ?? "127.0.0.1"`, which is right for
  local dev and unreachable inside a container — the first Railway deploy built
  and started cleanly and still served 502, with the only evidence being one log
  line: `HHVC mockup server running at http://127.0.0.1:8080`. The service also
  sets `PORT=8080`, and the generated domain's target port must match; a domain
  created before the port is known shows `Target port: -` and cannot route.
- **Railway runs `server.ts`, so the optional APIs finally have a runtime.**
  On Netlify they were structurally impossible. They still fail closed: with
  neither `REVIEW_API_TOKEN` nor `REVIEW_API_PRINCIPALS` set, `/api/review-state`
  and `/api/ai/capabilities` both answer **501**, which is the healthy resting
  state of an unconfigured deploy rather than a broken one. 502 is the broken
  one — see the `HOST=0.0.0.0` note above.
- **On the live deploy those routes now answer 401, not 501** (verified
  2026-08-15 against both). Authorization is configured there, so 501 has
  stopped being the expected reading for this host: **a 501 now would mean the
  variables were lost.** A 503 has two causes, and the response body is the
  only thing that separates them:
  `API CORS configuration is invalid.` means `REVIEW_API_ALLOWED_ORIGINS` is
  malformed, while `API authorization configuration is invalid.` means
  `REVIEW_API_PRINCIPALS` is. The CORS check runs first and answers before the
  authorization gate is reached, so a bare 503 is not evidence about auth at
  all — read the body, and report authorization as **unknown** when the CORS
  error is the one that won. Presence of the credentials was inferred from the
  status code rather than read out of the service — never print a variable's
  value.
  **A 401 from `/api/ai/capabilities` says nothing about whether the provider
  keys are set.** The two gates run in order — API authorization first,
  provider key second — so an unauthenticated caller is rejected before the
  capability report is ever reached, and `{anthropic: false, gemini: false}`
  is only observable from behind a valid token. The `verify-railway-backend`
  skill carries the full procedure, including the GitHub deployments-API
  fallback for sessions whose Railway MCP cannot list projects or deployments.
- **Netlify is retired but not deleted.** `netlify.toml` now carries
  `build.ignore = "exit 0"`, which tells Netlify to skip every build; the file
  itself is kept for its record of how the static bundle is assembled and of two
  plugin traps. Delete that one line to turn Netlify back on. The site's last
  deploy stopped at `38d152c` and was serving 503 when Railway took over.

- **A merge triggers the deploy; it does not prove one served.** The branch
  connection above cuts both ways: a push to a feature branch builds nothing,
  so a green branch push is not a shipped change — only the merge starts a
  deploy at all. And starting one is not finishing one: both halves of
  `railway.json` have completed successfully while the site answered 502 (see
  `HOST=0.0.0.0` above) or 503. **After any merge that changes site content or
  JS, verify the artifact rather than the pipeline**: load the live URL
  headlessly with Playwright, assert zero console errors, and confirm the
  deployed commit matches **the merged SHA read from a freshly fetched
  `origin/main`** — not local `HEAD`, which is a different commit after a
  squash merge and stale whenever someone else's work lands first, so checking
  it can pass against a revision that was never deployed. Build success and
  deploy success are different claims, and only the second one is the one being
  made.
- **Never deploy from a git worktree checkout.** `railway up` uploads the
  directory it is invoked in, so from a worktree it ships that tree's state
  rather than `main` — a deploy that succeeds and serves the wrong commit,
  which the hash check above is what catches. Switch to a normal clone of
  `main` first.

### Other directories

- **`forms/mosquito-workshop-request/`** — independent Vite app (own
  `package.json`, `vite.config.js`, `src/main.js`), built separately.
- **`review/`** — reference/output for the manager review process
  (`manager_review_packet.md`, `manager_decision_log.csv`, etc.), distinct from
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
- **`docs/source/hhvc-policy/`** — source policy documents (PDFs + markdown
  extracts) page copy is based on; not code.
- **`docs/superpowers/plans/` and `docs/superpowers/specs/`** — planning/design
  docs from prior sessions; useful background, not standing instructions.

## Code style & idioms

### Formatting (a hard CI gate)

Prettier is the **formatting gate CI enforces** (`.prettierrc.json`), alongside
`lint:js` for oxlint's core rules, Knip for reachability (see `knip.jsonc`),
dependency-cruiser for the module graph (see `.dependency-cruiser.cjs`) and
`lint:docs` for the markdown (see `.markdownlint-cli2.jsonc`): **no
semicolons**, single quotes, 2-space indentation, `printWidth: 100`, ES5 trailing
commas. Code must be ASI-safe and semicolon-free. Run `bun run format` before
committing; `bun run format:check` is the lint step. `.prettierignore` excludes
`data/`, `server.ts`, the vendored `tools/oxlint/anti-slop/`, the generated
single-file HTML exports, and reference/planning dirs.

**`bun run lint:anti-slop` is a second linter, and deliberately not a gate.** It
runs the vendored [anti-slop](https://github.com/dmmulroy/anti-slop) Oxlint
plugin (`tools/oxlint/anti-slop/`, MIT-licensed, provenance and upstream commit
in its `NOTICE.md`) over **`server.ts` and `build_scripts/ai/` only** — the two
places that decode external input, where its rules about widening and unchecked
assertions are about the code rather than about a style this repo doesn't use.
The narrow scope is not timidity: pointed at the browser JS the same rules
reported 280 findings, 254 of them `no-runtime-typeof` firing on the
`typeof window === 'undefined'` guard this repo's own code style mandates, which
is a linter arguing with the codebase rather than improving it. `.oxlintrc.json`
pins the same scope in its `overrides`, so an editor running bare `oxlint` sees
it too. Nothing in `.github/workflows/ci.yml` invokes it — it is a report to
read, and adding it to CI would be a decision to make on purpose, not a gap to
close.

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
one because they answer different questions: anti-slop is an opinion about how
to write TypeScript at an I/O boundary, and the core rules are correctness. Two
stylistic `unicorn` rules are off in the CI config for the same reason anti-slop
is not gated — `no-useless-fallback-in-spread` and
`prefer-string-starts-ends-with` cluster in `js/review/ux-improvements-export.js` and
`js/editing/inline-content-edit.js`, and churning the import/export merge path for style
is the trade this repo already refused once.

### JavaScript

- **This is plain browser JS — not TypeScript — but it IS bundled, and
  `js/*.js` ARE ES modules.** Use `import`/`export` with explicit relative
  specifiers including the `.js` extension (`import { escapeHtml } from
'./utils.js'`). Vite builds it; `server.ts` is the one TypeScript file.
  (Notes elsewhere describing "no build step, no ES modules" predate the Vite
  migration.)
- **File naming:** lowercase — single words for the core modules (`app.js`,
  `state.js`, `utils.js`), hyphenated for multi-word ones
  (`review-queue-state.js`, `page-render.js`); never camelCase. Match sibling
  files.
- **Two deliberate module patterns:** (1) plain modules for the core files —
  bare `const`/`function` declarations plus an `export { … }` block at the bottom,
  and a `window.X = X` line for the few things other code reaches through
  `window`; (2) **named IIFEs with a leading semicolon** — `;(function mountX(){…})()`
  — for newer stateful subsystems (the leading `;` is required because there are
  no statement-terminating semicolons). Expose via `window.<Namespace>` with the
  idempotent `window.X = window.X || {}` idiom.
- **Naming:** `camelCase` for JS identifiers, `UPPER_SNAKE_CASE` for module
  constants, `snake_case` for serialized/CSV data fields (`review_date`). That
  camelCase-code / snake_case-data boundary is firm.
- **Defensive by default:** run every value that reaches `innerHTML` through
  `escapeHtml`; use optional chaining + `?? ''` coercion and guard-clause early
  returns; guard test/SSR contexts with a `typeof window === 'undefined'` early
  return; `csvEscape` includes spreadsheet formula-injection protection. Prefer
  reusing `js/core/utils.js` helpers over inlining new logic.
- **State:** in-memory module singletons + versioned `localStorage` updated via
  functional updater callbacks (`updateLocalState((s) => { …; return s })`) +
  `HHVC_DATA`/`HHVC_PAGES` globals; `ORIGINAL_DATA` is a deep clone for reset.

### Comment & documentation voice — the most distinctive trait

Write **detailed, explanatory** comments and docs, not terse ones (the author's
stated preference: verbose, comment-heavy, explain the reasoning). Every module
opens with a header block stating its role **and its load-order dependency**.
Functions carry full JSDoc (`@param`/`@returns`). Comments justify the _why_ —
product rationale, trade-offs, and exact WCAG contrast math in CSS — not
restatements of the code. Prose docs use plain-English framing with
`**Bold label:**` bullets that state a non-obvious fact _and why it matters_, and
annotate config inline (e.g. the `"// script": "description"` keys in
`package.json`, and the explanatory comments throughout `.gitignore` and
`ci.yml`). Match this voice.

### CSS

Design-token-first: raw `--legacy-*` tokens (the hand-authored palette this tool
shipped before adopting SFDS, scheduled for migration) → a semantic
`--brand-*`/`--surface-*`/`--text-*` layer with baked-in `var(fallback)`
values, so reviewers retheme by touching tokens only. Hand-authored, no
preprocessor. Boxed section-banner comments; justify color/accessibility choices
in-comment with the contrast math. `!important` is used liberally **only** in the
self-aware override layer (`css/ux-improvements.css`). Dark mode via
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
`tests/helpers/load-scripts.js` vm harness is gone — it evaluated classic scripts
into a shared context, which ES modules made impossible. `describe` blocks are named after the unit under test;
`test` names are **behavioral verb sentences** ("escapes all five HTML special
characters"). Prefer exact-string assertions over loose matching. The XSS/escaping
surface (`page-render.test.js`) is exhaustively covered — one assertion per render
function. Use `test.todo` (with a reasoning comment) to document a
known-but-unfixed bug rather than asserting wrong behavior. Tests that stub
globals must restore them, or they pollute sibling test files.

### Test data invariants

Do not hardcode counts — page counts, doc counts, section counts — in tests or
assertions. Derive them from the source of truth instead; hardcoded counts have
broken CI after merges more than once. `tests/doc-counts.test.js` is the model:
it reads the counts back out of the docs and compares them to the filesystem,
rather than asserting a number that was true on the day it was typed.

## Editing rules (quick reference)

- Public page content → `pages/*.js`.
- Core render/state → `js/core/state.js`, `js/mockup/page-render.js`, `js/review/ui-controls.js`,
  `js/review/editor-panel.js`, `js/core/app.js`.
- Review/UX layers → `js/review/ux-improvements.js`, `js/review/review-queue.js`,
  `js/review/dashboard-guidance.js`, `js/review/keyboard-shortcuts.js`,
  `js/review/manager-review-export.js`, `css/ux-improvements.css`.
- Shared merge/history logic → `js/review/review-merge.js` (the only place a
  `history` entry should be constructed; loaded both as a browser `<script>`
  and imported directly by `server.ts`). Optional sync backend → `server.ts`
  (API routes) and `js/sync/review-state-sync.js` (client pull/push + settings UI).
- Adding/deleting page mockups → `js/core/page-registry-data.js` (pure validation +
  the in-place `order`/`pages` mutation), `js/core/page-registry.js` (the bootstrap,
  which MUST stay imported by `js/core/state.js` so it runs before the `ORIGINAL_DATA`
  clone), `js/core/page-registry-ui.js`.
- RAG knowledge base → `build_scripts/knowledge-chunking.js`,
  `build_scripts/knowledge-search.js`, `build_scripts/knowledge-schema.js`,
  `build_scripts/ingest-knowledge.js`, `build_scripts/ai/knowledge-retrieval.js`,
  `build_scripts/ai/compliance-audit.js`, and
  `build_scripts/ai/validate-compliance-audit.js`.
- Karl guide panels → `js/karl/karl-guide-registry.js` (the per-page-type field
  tables, the type-independent `META_FIELDS`, and `resolvePath`, which returns
  `''` rather than guessing — `guideForContext` stamps any non-empty path
  `evidence: 'E1'`/`status: 'confirmed'`, so a fallback path renders to the
  reviewer as a measurement), `js/mockup/karl-tag-meta.js` (panel markup),
  `js/karl/karl-guide.js` (expand/collapse + clipboard), `css/karl-guide.css`. A
  call site in `js/mockup/page-render.js` must pass `context.role`: without one the
  tag KIND is used as the role, which names no Karl field. Note the panel is
  block-level, so a `karlTag()` may never be emitted inside a `<p>` — the
  parser closes the paragraph and the panel escapes the element it is
  positioned against.
- Karl transcript export → `js/karl/karl-blocks.js` (the transcribed panel inventory
  and the `UNRESOLVED` shape rules), `js/karl/karl-transcript.js` (the pure builder —
  every judgement about what an editor is told lives there and only there),
  `js/karl/karl-transcript-panel.js`, `build_scripts/export-karl-transcript.js`.
  Re-run `bun run validate` after any of them: `findUnmappedSections` gates on it.
- Styles → `css/styles.css`; design tokens → `css/theme.css`.
- Docs linting and link checking → `build_scripts/lint-docs.js` (markdownlint,
  rules in `.markdownlint-cli2.jsonc`), `build_scripts/check-links.js` (lychee,
  scheduled by `.github/workflows/link-check.yml`), and
  `build_scripts/docs-file-set.js` — the SHARED derivation of "markdown this repo
  authors", taken from `git ls-files` rather than globbed. A third caller reuses
  it; it never re-globs. Both tools treat an empty file list as a broken
  derivation and fail, because each exits 0 when handed no inputs.
- After editing `pages/*.js` or `js/core/page-data.js`, run `bun run validate` **and**
  `bun run test`. After touching the import/export round-trip, manually verify it
  (export → re-import → decisions survive).

## Security Reviews

When asked for a security review of a diff or of changed files: do **not**
start by reading every file. Load the changed hunks in one call, with the
command that matches the subject — and always name the subject, because every
bare form quietly defaults to something else:

- **Uncommitted work:** `git diff HEAD`, paired with `git status --short`. Bare
  `git diff` compares the working tree to the INDEX, so a merely staged change
  is invisible to it — a staged secret yields an empty diff and a clean-looking
  review — and no diff form shows untracked files at all, so read anything new.
- **A named commit:** `git show --first-parent <sha>`. On a MERGE commit bare
  `git show` prints the combined `--cc` format, which names the changed file in
  its stat and then omits the patch, so a secret merged cleanly off a branch
  renders as a review that looks finished. Not `git diff <sha>^ <sha>`: it
  aborts wherever the parent does not resolve, including a root commit. In a
  shallow clone run `git fetch --deepen=1 origin` first (the repository, not
  the SHA — `git fetch` reads its first positional as the repository) — at the boundary Git
  treats the commit as a root and renders the whole snapshot as
  `new file mode`, which a reader cannot tell from code the commit added.
- **A pull request:** `gh pr diff <number>`. The bare form selects whatever PR
  belongs to the current branch, which is routinely not the one under review.

What those wrong forms share is that each prints something **reassuring**
rather than nothing. An empty result invites a second look; `secret.txt | 1 +`
with no patch under it does not.

Then summarize the attack surface those hunks expose in 3-5 bullets. That
summary is what decides where to look next; reading first and summarizing
afterwards inverts the order and spends the budget before the review has a
shape. Read only the specific files those bullets flag.

A **preliminary assessment** must land within the first 2 tool calls, and
"nothing confirmed yet — here is the surface and where I am looking next" is a
valid one. The deadline is on saying something, never on having found
something: a clean diff has no findings, and an instruction demanding one by
call two is an instruction to invent one. `git diff --stat` followed by
`git diff <paths>` is a legitimate way into a diff too large to read whole, but
it spends both calls before a word is written — so take the single-call route
unless the size forces the split. Report incrementally — emit findings per file
as you go rather than batching everything to the end. Only read a whole file
when a diff hunk is genuinely ambiguous, and say why.

## Commits & pull requests

- **Imperative mood.** Prefer **Conventional-Commits prefixes** for code changes
  (`fix:`, `feat:`, `style:`, `content:`); keep the subject ≤ ~72 chars.
- **Bodies scale with complexity:** a one-liner for CSV/doc refreshes; for
  behavior/layout changes, a problem statement + a dash-bulleted list of changes +
  an explicit **verification line** (e.g. "Verified headless at 1600px and
  850px…"). AI-assisted commits carry `Co-Authored-By` and `Claude-Session`
  trailers.
- **A `commit-msg` hook enforces that pairing**, and it is a PAIRING check
  rather than a blanket one: the trigger is a `Co-Authored-By` line naming
  Claude, so a human's own commit is untouched, and either trailer without the
  other fails. The rule lives in the TRACKED `.githooks/commit-msg`;
  `bun run hooks:install` symlinks `.git/hooks/commit-msg` at it, and that is
  required once per clone because hooks are never committed. **It deliberately
  does not set `core.hooksPath`** — that setting is already global here,
  pointing at ggshield, and a repo-local value overrides it outright and
  silently disables the pre-push secret scan. It is unnecessary anyway, since
  ggshield's `_dispatch` forwards each hook to
  `$(git rev-parse --git-dir)/hooks/<name>` whenever that file is executable
  (which is why the hook's mode bit is part of its contract, and asserted in
  `tests/commit-msg-hook.test.js` — a non-executable hook is not a broken gate
  but an absent one, with no error to notice). The known gap, worth stating:
  a commit carrying NEITHER trailer is invisible to it, because nothing in the
  message distinguishes that from a human commit. `--no-verify` bypasses it,
  as it bypasses every hook.
- **Keep dashboard-UX changes and policy-copy changes in separate PRs** — reduces
  merge conflicts and keeps review focused.
- **Never hand-edit generated files** (single-file HTML exports,
  `data/page_inventory.*`) — edit sources and rebuild.
- **Review exports** (`review/*.csv`, saved local-review CSV/JSON) are for manager
  decisions only — **never treat them as automatic publication approval.**

## Deployment

### Deploy & verify

**Railway is the host, not Netlify.** "Deploying — Railway is the live host"
under Architecture holds the URL, the project and service names, and the build
and start commands — read it there rather than looking for a second copy here.
Netlify is retired but not deleted: `netlify.toml` carries
`build.ignore = "exit 0"`, so it builds nothing.

What this section adds is the procedure. After any commit that changes site
content or JS:

- **Push, then merge — the merge is the deploy.** The service is connected to
  `main`, so a feature-branch push builds nothing. Do not read a green branch
  push as a shipped change.
- **Verify the artifact, not the pipeline.** Load the live URL headlessly with
  Playwright, assert zero console errors, and confirm the deployed commit
  matches the merged SHA — re-fetch `origin/main` and read it from there rather
  than trusting local `HEAD`, which is a different commit after a squash merge
  and stale whenever someone else's work lands first. A green build has shipped
  alongside a 502 more than once here.
- **Never deploy from a git worktree checkout.** `railway up` uploads the
  directory it runs in, so a worktree ships that tree rather than `main`.
  Switch to a normal clone of `main` first.

## Karl CMS

Login URL for the Karl (Wagtail-based) CMS admin:
`https://api.sf.gov/sso/login?next=/admin/`. Keep user-specific credentials and
private MCP config out of the repo (in `~/.codex/config.toml` or equivalent).

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

| Skill                         | Read it before editing                                                              |
| ----------------------------- | ----------------------------------------------------------------------------------- |
| `hhvc-inline-content-editing` | `js/editing/inline-content-edit*.js`                                                |
| `hhvc-page-registry`          | `js/core/page-registry*.js`                                                         |
| `hhvc-review-sync-backend`    | `server.ts`'s review-state routes, `js/sync/review-state-sync.js`                   |
| `hhvc-ai-assist-backend`      | `server.ts`'s AI routes, anything under `build_scripts/ai/`                         |
| `hhvc-rag-knowledge-base`     | `build_scripts/knowledge-*.js`, `build_scripts/ai/compliance-audit.js`              |
| `hhvc-ai-rewrite`             | `js/ai/ai-rewrite*.js`, anything touching `data-rewrite-field` addressing           |
| `hhvc-card-inheritance`       | `js/core/card-inheritance.js`, `js/mockup/page-render.js`'s card rendering          |
| `hhvc-react-islands`          | anything under `js/react/`, or adding a React island                                |
| `hhvc-workspace-layout`       | the workspace grid in `css/dashboard.css`, `js/review/ux-improvements-workspace.js` |
| `hhvc-review-insights`        | `js/review/review-insights*.js`, `css/review-insights.css`                          |
| `hhvc-review-ops`             | `js/review/review-ops*.js`, `css/review-ops.css`                                    |

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

### Triage labels

The five canonical roles, each label string equal to its name. Only `wontfix`
exists on the repo today — create the other four before the first `/triage`
run, since `gh issue edit --add-label` fails on a missing label rather than
creating it. See `docs/agents/triage-labels.md`.

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
  is required before `dev`, `validate`, `test`, or `build:railway` — the first
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

## Safety

### Concurrency safety

More than one agent session may be working in this repo at once. Before
editing, run `git status`; if the working tree has changed since you last read
a file, re-read it before editing. Never run a destructive shell one-liner
against a config file — a `jq` write to `~/.claude.json`, an `mv` over a
dotfile — without writing to a temp file first and verifying it is non-empty.

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

<!-- FABLIZE:BEGIN — run Opus like Fable (always-on router). Verified procedures only. Install/update: fablize setup.sh -->

## Operating mode (always on — auto-route by task signal)

Apply what the task signals; with no signal, baseline only. Read each pack only when needed. Routing: smallest matching discipline only, overlap only when genuinely multi-category, mimic observable behavior only.

- **[always]** Lead with the outcome · stay within the requested scope (no incidental refactors) · ground completion claims in this session's tool results · confirm before destructive or hard-to-reverse actions.
- **[2+ sequential stories]** Run `python3 /home/ohdaveed/.claude/plugins/cache/fablize/fablize/2.1.1/scripts/goals.py`: create → next → checkpoint (with evidence) → final verification gate (no completion without `--verify-cmd` and `--verify-evidence`). Run from the repo root; state in `./.fablize/` (resume with `status`). Skip for single-step tasks.
- **[debugging / test failure / unknown cause / review]** Follow `/home/ohdaveed/.claude/plugins/cache/fablize/fablize/2.1.1/packs/investigation-protocol.txt`: reproduce first → 3+ competing hypotheses → evidence per hypothesis → full causal chain → verify before/after → report rejected hypotheses.
- **[render/executable artifact: HTML, SVG, game, UI, chart]** Follow `/home/ohdaveed/.claude/plugins/cache/fablize/fablize/2.1.1/packs/verification-grounding-pack.txt` grounding loop: run it in the real renderer → observe the output → fix what you see → re-run. A static check is not observation.
- **[hard or ambiguous task]** Adaptive thinking scales with difficulty automatically. To go higher, recommend `/effort xhigh` to the user. Depth (capability) cannot be raised: if stuck 2+ times or out-of-spec discovery is needed, report the limit honestly and escalate.

<!-- FABLIZE:END -->

# Copilot instructions for this repository

**The canonical, complete guide is [`AGENTS.md`](../AGENTS.md).** Read it first —
it covers architecture, the page-object schema, validation invariants,
local-persistence hazards, JS/CSS idioms, comment voice, test conventions, and
commit/PR preferences. This file is a short orientation that defers to it; if the
two ever disagree, `AGENTS.md` wins.

## What this is

A static, no-framework mockup tool for manager review of a redesigned HHVC
(Healthy Housing and Vector Control) section of SF.gov. It IS
bundled: **Vite** builds it from a single ES-module entry point, `js/main.js`, and
`index.html` carries one `<script type="module">` tag. **Bun** powers the CLI
scripts and the test runner. This is **plain browser JavaScript, not TypeScript** —
but `js/*.js` are ES modules, so use `import`/`export` with explicit relative
specifiers including the `.js` extension.

**The tool needs no backend** — reviewer state lives in `localStorage` and it
works fully offline. But `server.ts` (Bun) exists and hosts **three optional,
additive APIs** that are off by default and fail closed with a 501 when
unconfigured: a **review-state sync backend** (Postgres when `DATABASE_URL` is
set, SQLite at `DATA_DB_PATH` otherwise, gated on the legacy `REVIEW_API_TOKEN`
or opt-in per-token role configuration), an
**AI assist backend** at `/api/ai/*` (the `ai:generate` role plus a provider key
— `ANTHROPIC_API_KEY` or `GEMINI_API_KEY`), and **reviewer sign-in** at
`/api/session` (`REVIEW_SESSION_PASSWORD`, which mints an
`HttpOnly; Secure; SameSite=Strict` cookie carrying `review:read` and
`review:write` only — never `ai:generate`, so one leaked password can never run
up an unbounded generation bill). Cross-origin browser callers are
denied unless explicitly allowlisted, and process-local limits are only a
supplement to reverse-proxy/identity-aware-edge controls in public,
multi-instance production. See `AGENTS.md`'s “Optional API access hardening”
for the exact environment format and failure behavior. Railway runs `server.ts`,
so the live deploy has a runtime for them; a static-only host has none of them at
all. Nothing else in the tool depends on any of them.

## Commands

```bash
bun install          # install deps (required before first `dev`)
bun run dev           # Vite dev server (HMR) at http://127.0.0.1:8080
bun run start         # production-like: assemble dist/ (build:railway), then serve it
bun run validate      # Zod-validate pages/*.js and js/core/page-data.js (schema + invariants)
bun run test          # Bun test runner over the 57 unit-test files in tests/
bun run hooks:install # Once per clone: installs the commit-msg trailer gate (.githooks/)
bun run test:e2e      # Playwright end-to-end tests
bun run export        # regenerate data/page_inventory.{json,csv} + local tracking sheet
bun run export:karl   # write one paste-ready Karl transcript per page into review/karl-transcripts/
bun run build         # validate -> export -> workshop form -> dist/ -> single-file HTML
bun run format        # prettier --write on everything
bun run format:check  # prettier --check — this is the lint step (no ESLint, no type checking)
```

**There is a real test suite.** `bun run test` runs **57** Bun unit-test
files, plus twenty-four Playwright e2e spec files. **The list in `package.json`'s `test`
script is explicit, not a glob** — a new `tests/*.test.js` that is not named
there never runs and reports nothing. A happy-dom environment is preloaded
via `bunfig.toml` so the ES modules can be imported directly. `bun run validate` is a
complementary check that Zod-validates the full `pages/*.js` set — you can't
validate one page in isolation. Run both after editing anything under `pages/` or
`js/core/page-data.js`.

## Architecture (essentials — full detail in `AGENTS.md`)

- **Data-driven; the mockup has no framework** (the review workspace does — see
  "React islands in the workspace" in `AGENTS.md`). Each `pages/*.js` file assigns onto
  `window.HHVC_PAGES['<pageKey>']`; `js/core/page-data.js` builds
  `window.HHVC_DATA = { pages, order }`. **The app is bundled by Vite from one
  ES-module entry point, `js/main.js`** — `index.html` has a single
  `<script type="module">` tag. Core modules import what they need; the
  self-mounting IIFE layers reach each other through `window.<Namespace>`
  objects rather than imports (most still import `js/core/utils.js` helpers), so
  they depend on their listed order in `js/main.js`. Add a new page by importing it in `js/core/page-data.js` (validated by
  `build_scripts/page-import-checks.js`) and adding an `order` entry.
- **Core is split into focused modules** (formerly one `app.js`): `js/core/utils.js`
  (shared helpers, loads first), `js/mockup/karl-tag-meta.js`, `js/core/state.js`,
  `js/review/ui-controls.js`, `js/review/editor-panel.js`, `js/mockup/page-render.js` (holds
  `karlTag()`), `js/core/app.js`, `js/review/manager-review-export.js`,
  `js/standards/reading-level.js`, `js/review/review-state-validation.js`. Don't re-monolith them.
- **Nine feature folders under `js/`, not one flat directory:** `js/core/`
  (bootstrap + shared state/vocabulary), `js/mockup/` (renders `#mockPage`),
  `js/review/` (the review/UX layers), `js/editing/` (inline content editing),
  `js/ai/` (optional AI assist + rewrite), `js/sync/` (optional review-state
  sync client), `js/karl/` (Karl guide panels + transcript export),
  `js/standards/` (reading-level + plain-language scoring), `js/react/` (React
  - MUI workspace islands). `js/main.js` alone stays directly under `js/`, as
    the module graph's root.
- **`js/core/utils.js` owns the shared vocabulary.** The review decision table
  (`DECISIONS` and its derived label/slug/chip/colour lookups), `escapeHtml`,
  `safeUrl`, and `mountWorkspacePanelIfOpen` all live there. Derive from them
  rather than restating them — these were each duplicated across files before,
  and the copies drifted.
- **Review/UX layers are additive** self-contained IIFEs on top of the core
  (`js/review/ux-improvements*.js`, `js/review/review-queue*.js`, `js/review/review-insights*.js`,
  `js/review/review-ops*.js`, `js/review/dashboard-guidance.js`,
  `js/ai/ai-assist*.js`, `js/standards/plain-language.js`, `js/mockup/mockup-image-export.js`,
  `js/review/keyboard-shortcuts.js`) that read `HHVC_DATA`
  and `localStorage`. They may edit the **in-memory** page data but must never
  write back to `pages/*.js` or publish content.
- **`karl` fields are first-class content**, not comments — placement/rationale
  notes mapping mockup content to Karl CMS StreamField blocks, surfaced via
  `karlTag()`. Keep them accurate when editing copy.
- **Local persistence** is browser-only under `localStorage` key
  `hhvcManagerReviewState:v1`. The CSV/JSON import path in `js/review/review-queue.js` has
  regressed before by overwriting instead of merging — manually verify any change
  to the import/export round-trip.

## Code style

Prettier is the formatting linter (`.prettierrc.json`), with `lint:js` running
oxlint's core rules, Knip gating reachability, dependency-cruiser gating the
module graph and `lint:docs` gating the markdown: no semicolons, single quotes,
2-space indent, 100-char width, ES5 trailing commas. `camelCase` JS identifiers,
`UPPER_SNAKE_CASE` constants, `snake_case` data fields. Write detailed,
explanatory comments that justify the _why_. Run `bun run format` before
committing. See `AGENTS.md` for the full idiom and commit/PR conventions.

**CSS is token-first.** Raw `--legacy-*` primitives feed a semantic layer in
`css/theme.css` (surfaces, a `--ds-text-*` type scale, spacing, status and
decision colours, dark mode). Component rules take semantic tokens; a hardcoded
colour literal is how every dark-mode contrast bug here has started. `css/theme.css`
must stay LAST in `js/main.js`'s import list, and a selector should be declared
in exactly one stylesheet.

## Workflow & verification

- **Security reviews start from the diff, naming the subject.** Every bare form
  defaults to something else, and each prints something reassuring rather than
  nothing. Uncommitted work: `git diff HEAD` plus `git status --short` — bare
  `git diff` diffs against the index, so a staged change is invisible, and no
  diff shows untracked files. A named commit: `git show --first-parent <sha>` —
  bare `git show` omits the patch on a merge commit, `<sha>^ <sha>` aborts when
  the parent does not resolve, and a shallow clone needs
  `git fetch --deepen=1 origin` first (the repository, not the SHA) or the
  boundary commit reads as an all-new
  snapshot. A pull request: `gh pr diff <number>` — the bare form picks the
  current branch's PR. Summarize the attack surface in 3-5 bullets before
  opening anything else; those bullets decide what gets read. Do not read files
  one at a time first. A preliminary **assessment** lands within the first 2
  tool calls, and "nothing confirmed yet, here is the surface" is a valid one:
  the deadline is on saying something, never on having found something, since a
  clean diff has no findings. Report findings per file as you go rather than
  batching them; open a full file only when a hunk is genuinely ambiguous.
- **Definition of done:** tests pass, changes committed, pushed to origin, PR
  opened if on a branch, CI green. Never leave commits unpushed on a local
  branch, and re-fetch before merging to confirm the remote head has them all.
- **Railway is the live host, not Netlify** (`netlify.toml` carries
  `build.ignore = "exit 0"`). The service is connected to `main`, so a merge is
  the deploy and a branch push ships nothing. After a merge that changes content
  or JS, verify the live URL headlessly with zero console errors and confirm the
  deployed commit matches the merged SHA — a green build has served a 502 here.
  Never deploy from a git worktree checkout. See `AGENTS.md` for the URL and
  service names.
- **Never hardcode counts** — of pages, docs, or sections — in tests or
  assertions; derive them from the source of truth. Hardcoded counts have broken
  CI after a merge more than once.
- **Assume another agent session may be working in this tree.** Run
  `git status` before editing, and re-read a file that has changed since you
  last read it. Never run a destructive shell one-liner against a config or
  dotfile without writing to a temp file first and checking it is non-empty.

## Pull request scope

Keep dashboard-UX changes (layout, queue, workspace, review helpers) and
policy-copy changes (page text, `docs/source/` ingestion) in **separate PRs** when
possible.

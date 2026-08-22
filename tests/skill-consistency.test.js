// Guards the property "Subsystem deep-dives" asserts and nothing enforced:
// that each `.claude/skills/hhvc-*/SKILL.md` still agrees with the AGENTS.md
// section it was extracted from.
//
// WHY THIS EXISTS. CLAUDE.md states the rule plainly — the skills "are
// extracts, not a second source of truth", and "a correction goes into
// `AGENTS.md` and then into the skill". Until now the second half of that
// sentence was maintained entirely by hand, and it failed three times in the
// eleven files, all found in one audit on 2026-08-22:
//
//   - `hhvc-review-sync-backend` still said the API was "backed by SQLite
//     (`bun:sqlite`, no extra dependency)" — its own `description:` said
//     "SQLite-backed" too — long after `build_scripts/storage.js` made it
//     Postgres-when-`DATABASE_URL` and SQLite otherwise.
//   - `hhvc-page-registry` and `hhvc-inline-content-editing` both described
//     `js/review/ux-improvements.js` as WRAPPING `window.renderPage`, which
//     nothing has done since #194 replaced the wrapper with
//     `onBeforeRender`/`onAfterRender` subscribers.
//
// Each of those sat in the file a session is told to load BEFORE editing the
// subsystem the claim is about, which is the worst place for a wrong fact: it
// is read as preparation rather than checked as documentation. Nothing else
// covered them. `tests/module-paths.test.js` gates the `js/` paths in these
// files, `lint:docs` gates their markdown, and `build_scripts/doc-claims.js`
// gates five counts — a stale MECHANISM passes all three, because every path
// it names still exists.
//
// WHAT THIS DOES NOT CATCH. The same limit `tests/mirror-consistency.test.js`
// states about itself: presence, not polarity. A skill that keeps a registered
// needle and reverses the sentence around it still passes. And RETIRED_
// MECHANISMS below matches the exact historical phrasings, so a stale
// mechanism reintroduced in NEW words is invisible to it — the list is a
// ratchet against a specific wrong sentence coming back, not a detector of
// wrongness in general. A proximity rule (`wrap` within N characters of
// `renderPage`) was written first and rejected: it fires on the canon's own
// correct sentence, "`window.renderPage` (**nothing wraps it any more**", so
// it cannot carry the retired-from-the-canon-too check below that is what
// keeps this list honest rather than a place to park opinions.
//
// MUTATION-PROVEN, and against the real drift rather than a synthetic one.
// Restoring the three skills to their state at `17a09d3` — the commit before
// the audit — fails nine assertions here, naming each: two shared-fact claims
// on `hhvc-review-sync-backend`, the exactly-once check on those same two, and
// all five retired-mechanism entries. So
// this file would have failed on that tree, which is the whole argument for
// it. The shared-fact claims that pass on both trees prove nothing about that
// drift; they guard the different failure stated where they are declared.
//
// WHY NOT DIFF THE FILES. Measured across all eleven on 2026-08-22, the skill
// and its section differ in wording everywhere except `hhvc-ai-assist-backend`,
// which is byte-identical. The others are legitimate rewrites in both
// directions — the skill carries detail the canon tightened away, the canon
// carries detail the skill condenses. So the general property is checked as
// shared FACTS, the same design decision mirror-consistency reached for the
// same reason.

import { describe, test, expect } from 'bun:test'
import { readFileSync, existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'

const ROOT = join(import.meta.dir, '..')

/**
 * Every extracted subsystem skill, mapped to the `### ` heading in AGENTS.md
 * that carries the canonical copy of its content.
 *
 * The mapping is registered rather than derived, because a skill's directory
 * name and its section heading are deliberately different — `hhvc-review-ops`
 * documents "Stored review data", `hhvc-page-registry` documents "Adding and
 * deleting pages". A heuristic that guessed would either miss a rename or
 * invent one.
 *
 * The registry is checked against the filesystem in both directions below, so
 * adding a twelfth skill without registering it FAILS rather than silently
 * going ungated. That direction is the one that matters: an unregistered skill
 * is exactly the state all eleven of these were in when the drift happened.
 */
const SKILL_SECTIONS = {
  'hhvc-ai-assist-backend': 'AI assist backend (optional)',
  'hhvc-ai-rewrite': 'AI rewrite (optional)',
  'hhvc-card-inheritance': 'Card descriptions are inherited, not printed',
  'hhvc-inline-content-editing': 'Inline content editing (`js/editing/inline-content-edit*.js`)',
  'hhvc-page-registry': 'Adding and deleting pages (`js/core/page-registry*.js`)',
  'hhvc-rag-knowledge-base': 'RAG knowledge base (optional)',
  'hhvc-react-islands': 'React islands in the workspace',
  'hhvc-review-insights': 'Overview insight cards (`js/review/review-insights*.js`)',
  'hhvc-review-ops': 'Stored review data (`js/review/review-ops*.js`)',
  'hhvc-review-sync-backend': 'Review-state sync backend (optional)',
  'hhvc-workspace-layout': 'The workspace is docked, not stacked',
}

/**
 * Facts that must appear in BOTH a skill and its AGENTS.md section, however
 * each one words the prose around them.
 *
 * WHAT EARNS A PLACE HERE, so the list does not become a matter of taste — the
 * same two filters `tests/mirror-consistency.test.js` applies. First, the
 * needle must ALREADY appear on both sides: the gate preserves an agreement
 * that exists rather than imposing one, which is what keeps it mechanical.
 * Second, it must appear exactly ONCE in the section, so that presence is
 * genuinely the fact. A needle repeated through a section cannot fail the way
 * it implies — the defining mention could drift while a dozen incidental ones
 * kept this green, which is the reasoning behind `scored: false` in
 * `getRuleResultsFor()` applied to a test instead of a rule.
 *
 * They are identifiers, paths and env vars rather than sentences, because a
 * sentence is the part an editor legitimately rewrites and an identifier is
 * the part they must not. A skill naming a wrong module, storage key or
 * environment variable is not stale but WRONG, and a reader who follows it
 * edits the wrong file.
 */
const SHARED_CLAIMS = [
  { skill: 'hhvc-ai-assist-backend', needle: '`REVIEW_API_PRINCIPALS`' },
  { skill: 'hhvc-ai-assist-backend', needle: '`normalizeUsage()`' },
  { skill: 'hhvc-ai-assist-backend', needle: '`ai:generate`' },

  { skill: 'hhvc-ai-rewrite', needle: '`data-rewrite-field`' },
  { skill: 'hhvc-ai-rewrite', needle: '`__sectionIndex`' },
  { skill: 'hhvc-ai-rewrite', needle: '`window.AiAssist.client`' },

  { skill: 'hhvc-card-inheritance', needle: '`cardDescription(section, card)`' },
  { skill: 'hhvc-card-inheritance', needle: '`window.cardInheritance`' },
  { skill: 'hhvc-card-inheritance', needle: '`bun run audit-cards`' },

  { skill: 'hhvc-inline-content-editing', needle: '`computeSectionEdits`' },
  { skill: 'hhvc-inline-content-editing', needle: '`factsArray`' },
  { skill: 'hhvc-inline-content-editing', needle: '`tests/inline-content-edit-data.test.js`' },

  { skill: 'hhvc-page-registry', needle: '`window.pageRegistry`' },
  { skill: 'hhvc-page-registry', needle: '`state.globals.page_registry`' },
  { skill: 'hhvc-page-registry', needle: '`window.ORIGINAL_DATA.pages[key]`' },

  { skill: 'hhvc-rag-knowledge-base', needle: '`gemini-embedding-001`' },
  { skill: 'hhvc-rag-knowledge-base', needle: '`DRAFT-NOT-FOR-PUBLICATION`' },
  { skill: 'hhvc-rag-knowledge-base', needle: '`build_scripts/ai/knowledge-retrieval.js`' },

  { skill: 'hhvc-react-islands', needle: '`ScopedCssBaseline`' },
  { skill: 'hhvc-react-islands', needle: '`js/react/theme.js`' },

  { skill: 'hhvc-review-insights', needle: '`insightsSignature()` gates redraws' },
  { skill: 'hhvc-review-insights', needle: 'Decision fills use `--viz-decision-*`' },
  { skill: 'hhvc-review-insights', needle: 'beside an `.hhvc-sr-only`' },

  { skill: 'hhvc-review-ops', needle: '`findOrphanedRecords`' },
  { skill: 'hhvc-review-ops', needle: '`mountWorkspacePanelIfOpen()`' },

  // The one this whole file exists for. The needle is the whole phrase and
  // not bare `DATABASE_URL`, which appears three times in the section and so
  // fails the appears-exactly-once filter above — the defining sentence could
  // drift back to "backed by SQLite" while two incidental mentions kept a
  // bare-identifier claim green. This phrase IS the sentence that says
  // Postgres-or-SQLite rather than SQLite, which is exactly the drift the
  // 2026-08-22 audit found, and it would fail here now.
  { skill: 'hhvc-review-sync-backend', needle: 'Postgres when `DATABASE_URL`' },
  { skill: 'hhvc-review-sync-backend', needle: '`local_dirty === true`' },
  { skill: 'hhvc-review-sync-backend', needle: '`MAX_REVIEW_BODY_BYTES`' },
  { skill: 'hhvc-review-sync-backend', needle: '`PUT /api/review-state/pages/:pageKey`' },

  { skill: 'hhvc-workspace-layout', needle: '`.review-workspace[hidden] { display: none }`' },
  { skill: 'hhvc-workspace-layout', needle: '`grid-column: 2`' },
  { skill: 'hhvc-workspace-layout', needle: '`applyWorkspaceVisibility()`' },
]

/**
 * Phrasings for mechanisms this repo has RETIRED, which may not come back into
 * any skill.
 *
 * A shared-fact claim catches a fact going missing. It cannot catch the
 * opposite failure, which is what actually happened twice in 2026-08: a fact
 * that was true when the skill was written and quietly stopped being true, so
 * both sides still read fluently and only the code disagreed. This list is the
 * ratchet for those — one entry per mechanism removed, added by whoever removes
 * it.
 *
 * **Each entry must also be absent from the canon**, asserted below, and that
 * self-check is what keeps the list honest. A needle that still appears in
 * `AGENTS.md` describes something the repo has NOT retired, and registering it
 * here would be a private opinion enforced as a gate. It is also why the
 * needles are the historical phrasings verbatim rather than something shorter:
 * bare `` `bun:sqlite` `` is still correct prose in "Where review records
 * live", where it names the synchronous driver behind the storage seam.
 */
const RETIRED_MECHANISMS = [
  {
    id: 'sqlite-only-sync-backend',
    needle: 'backed by SQLite (`bun:sqlite`',
    reason:
      'the sync API has been Postgres-when-DATABASE_URL and SQLite otherwise since build_scripts/storage.js landed',
  },
  {
    id: 'sqlite-backed-description',
    needle: 'SQLite-backed review-state sync',
    reason: 'same; this spelling was in the skill front-matter description, where nothing read it',
  },
  {
    id: 'renderpage-wrapper-navigation',
    needle: 'the **wrapped** `window.renderPage`',
    reason:
      'nothing has wrapped window.renderPage since #194 — js/review/ux-improvements.js registers onBeforeRender/onAfterRender subscribers, and window.renderPage === renderPage always',
  },
  {
    id: 'renderpage-wrapper-flush',
    needle: "wrapper's own pre-navigation flush",
    reason: 'same wrapper; the flush is an onBeforeRender() subscriber now',
  },
  {
    id: 'renderpage-wrapper-reentry',
    needle: 'wrapper by the time `applySavedPageState`',
    reason:
      'same wrapper; a follow-up render dispatches the onAfterRender hook, it re-enters nothing',
  },
]

/** The three instruction mirrors, for the retired-from-the-canon-too check. */
const CANON = ['AGENTS.md', 'CLAUDE.md', '.github/copilot-instructions.md']

/** Collapse every run of whitespace, so a line break cannot hide a match. */
function normalize(text) {
  return text.replace(/\s+/g, ' ')
}

/** @returns {string} file contents, or throws naming the missing path. */
function read(relativePath) {
  const full = join(ROOT, relativePath)
  if (!existsSync(full)) throw new Error(`missing from the repo: ${relativePath}`)
  return readFileSync(full, 'utf8')
}

/**
 * A skill's PROSE, with the YAML front matter removed.
 *
 * The `description:` field is a summary index — it is what the harness lists
 * when deciding whether to load the skill — so it legitimately repeats the
 * identifiers the body defines. Counting it would make the exactly-once rule
 * below unsatisfiable for four claims whose only second occurrence is there,
 * and the obvious workaround (lengthen the needle until it is unique again)
 * would push the registry toward sentence fragments, which is the thing it
 * deliberately avoids: a sentence is the part an editor rewrites.
 *
 * A skill with no front matter is returned whole rather than treated as an
 * error — the check is about drift, not file shape.
 *
 * @param {string} skill Directory name under `.claude/skills/`.
 * @returns {string} the body, whitespace-collapsed.
 */
function skillBody(skill) {
  const raw = read(`.claude/skills/${skill}/SKILL.md`)
  const match = raw.match(/^---\n[\s\S]*?\n---\n/)
  return normalize(match ? raw.slice(match[0].length) : raw)
}

/**
 * The body of one `### ` section of AGENTS.md.
 *
 * Stops at the next heading of level 2 OR 3, so a section cannot absorb its
 * successor and satisfy a claim that belongs to a neighbour.
 *
 * @param {string} heading Exact heading text, without the `### `.
 * @returns {string|null} the raw body, or null when no such heading exists.
 */
function agentsSection(heading) {
  const lines = read('AGENTS.md').split('\n')
  const start = lines.findIndex((line) => line.trim() === `### ${heading}`)
  if (start < 0) return null
  let end = start + 1
  while (end < lines.length && !/^#{2,3} /.test(lines[end])) end += 1
  return lines.slice(start + 1, end).join('\n')
}

/**
 * Skill directories present on disk, from `git ls-files` rather than a glob —
 * matching `build_scripts/docs-file-set.js`. An untracked skill is invisible,
 * which is correct: it is covered the moment it is committed.
 *
 * @returns {string[]} directory names, e.g. `hhvc-review-ops`
 */
function trackedSkillDirs() {
  return execFileSync('git', ['ls-files', '.claude/skills/hhvc-*/SKILL.md'], {
    cwd: ROOT,
    encoding: 'utf8',
  })
    .split('\n')
    .filter(Boolean)
    .map((path) => path.split('/')[2])
    .sort()
}

describe('the skill registry covers what is on disk', () => {
  test('every tracked hhvc-* skill is registered against an AGENTS.md section', () => {
    expect(trackedSkillDirs()).toEqual(Object.keys(SKILL_SECTIONS).sort())
  })

  test.each(Object.entries(SKILL_SECTIONS))(
    '%s maps to a section AGENTS.md actually has',
    (_skill, heading) => {
      expect(agentsSection(heading)).not.toBeNull()
    }
  )
})

describe('facts shared between a skill and its AGENTS.md section', () => {
  test.each(SHARED_CLAIMS)('$skill still states $needle', ({ skill, needle }) => {
    const section = normalize(agentsSection(SKILL_SECTIONS[skill]) ?? '')

    // Both directions, in one assertion each, so the failure message says
    // which side lost the fact rather than only that they disagree.
    expect(section).toContain(needle)
    expect(skillBody(skill)).toContain(needle)
  })

  // The exactly-once rule runs on BOTH sides, and the skill side is the half
  // that is easy to leave out — this file did, until a PR review caught it.
  // The asymmetry made no sense on its own terms: the argument for the rule is
  // that a repeated needle cannot fail as it implies, because the DEFINING
  // occurrence can drift while an incidental one keeps the check green, and
  // that is as true of a skill as of a section. Three claims were lengthened
  // to their defining phrase rather than dropped when this was applied
  // (`insightsSignature()` gates redraws, Decision fills use
  // `--viz-decision-*`, beside an `.hhvc-sr-only`), each of which really did
  // appear twice in its skill's prose.
  test.each(SHARED_CLAIMS)(
    '$needle appears exactly once on each side for $skill, so presence is the fact',
    ({ skill, needle }) => {
      const section = normalize(agentsSection(SKILL_SECTIONS[skill]) ?? '')
      expect(section.split(needle).length - 1).toBe(1)
      expect(skillBody(skill).split(needle).length - 1).toBe(1)
    }
  )
})

/* Commands a skill tells a human to run.

   WHY THIS EXISTS. `skill-consistency` above covers the eleven extracts, whose
   drift risk is disagreeing with AGENTS.md. The OTHER tracked skills — `ship`,
   `verify`, `verify-railway-backend`, `karl-notes-drift-check` — carry a
   different one: they are procedures, and a procedure names commands. `ship`
   alone cites eight `lint:*`/`validate`/`test` scripts and pre-approves several
   in its `allowed-tools` front matter. Renaming a package script breaks every
   one of those silently, because a skill is prose to every reader and
   configuration to nobody — the same argument `tests/ci-workflow.test.js`
   opens with, applied one level out.

   Not hypothetical in this repo: `build:netlify` was renamed to
   `build:railway` in 7432f54, and the only reason no skill was left pointing
   at the old name is that the same commit swept the docs by hand.

   Scoped to `bun run <script>`, deliberately. A skill also names shell
   commands, `gh` subcommands and file paths; `git ls-files`-derived path
   coverage already exists in `tests/module-paths.test.js`, and asserting that
   an arbitrary shell command is valid is not something a test can do. A
   package script is the one citation with a machine-readable answer. */
describe('commands named in a skill exist', () => {
  const SCRIPTS = new Set(Object.keys(JSON.parse(read('package.json')).scripts))

  /**
   * Every `bun run <script>` cited anywhere under `.claude/skills/`, with the
   * file that cites it. Tracked files only, matching `docs-file-set.js`: an
   * untracked skill is covered the moment it is committed.
   */
  /**
   * Tracked markdown under `.claude/skills/`, matching `docs-file-set.js`.
   *
   * The `.md` filter also excludes the vendored skills, and that is deliberate
   * rather than incidental: those are SYMLINKS into `.agents/skills/`, which
   * `git ls-files` reports as the link path with no `/SKILL.md` suffix. That
   * tree comes from `mattpocock/skills` (see `skills-lock.json`) and its
   * contents are not ours to keep current — the same reason
   * `tests/module-paths.test.js` carries `.agents` in its SKIP set. Gating on
   * it would let an upstream sync redden this repo's CI over a command it does
   * not own. Measured: those eleven files cite `bun run` zero times today, so
   * the exclusion costs no coverage either.
   */
  function skillFiles() {
    return execFileSync('git', ['ls-files', '.claude/skills'], {
      cwd: ROOT,
      encoding: 'utf8',
    })
      .split('\n')
      .filter((path) => path.endsWith('.md'))
  }

  // The script-name class is deliberately wider than the corpus needs — a
  // leading digit, underscore, `@` or `+`, and an embedded `/`, `=`, `~` or
  // `*` — because `bun run` takes any package key and all of those are legal
  // in one. Measured at each widening: the corpus yields the same 23 citations
  // throughout, so the extra reach costs nothing today and cannot silently
  // skip a future citation the narrower class would not have recognized as
  // one.
  //
  // It is a CLASS and not `[^\s`]+` for a measured reason. A whole-token
  // capture also finds 23, but eight of them are prose: `test)`,
  // `format:check)` and friends, where a citation ends a parenthetical. The
  // class is what stops at sentence punctuation, which is why `?` and `!` stay
  // out of it even though a package key may legally contain them. The trade is
  // deliberate and asymmetric: a false positive fails CI against correct docs,
  // while a miss leaves one exotic citation unchecked among twenty-three.
  //
  // Whitespace-collapsed before matching, and the regex admits a run of it —
  // the same wrapped-prose blindness `mirror-consistency` documents, and the
  // repo really does carry one: `hhvc-rag-knowledge-base` wraps a citation
  // between `run` and `ingest`. A same-line-only scan silently omitted it, and
  // because that file carries other citations the coverage property below
  // still passed, so a stale wrapped command could have sat there unchecked.
  const citations = skillFiles().flatMap((path) =>
    [...normalize(read(path)).matchAll(/bun run\s+([\w@+][\w:.@/+=~*-]*)/g)].map((match) => ({
      path,
      script: match[1],
    }))
  )

  test('every skill mentioning `bun run` yields at least one citation', () => {
    // Non-vacuity, derived from the corpus rather than asserted as a
    // threshold. A hardcoded floor would go red on a legitimate consolidation
    // that left fewer citations standing, and this repo's own rule is to
    // derive counts from the source of truth. The property here is exact: a
    // file whose raw text contains the phrase must contribute a citation, so a
    // regex that stops matching fails instead of quietly reporting nothing
    // wrong.
    const mentioning = skillFiles().filter((path) => normalize(read(path)).includes('bun run'))
    const scanned = new Set(citations.map(({ path }) => path))
    expect(mentioning.filter((path) => !scanned.has(path))).toEqual([])
    expect(mentioning.length).toBeGreaterThan(0)
  })

  test('every cited script is defined in package.json', () => {
    const broken = citations
      .filter(({ script }) => !SCRIPTS.has(script))
      .map(({ path, script }) => `${path}: bun run ${script}`)
    expect(broken).toEqual([])
  })
})

describe('retired mechanisms do not come back', () => {
  test.each(RETIRED_MECHANISMS)('no skill describes $id', ({ needle, reason }) => {
    for (const skill of Object.keys(SKILL_SECTIONS)) {
      // The WHOLE file here, front matter included: one of the two SQLite
      // phrasings this list retired lived in the `description:` field, where
      // nothing but the harness ever read it.
      const whole = normalize(read(`.claude/skills/${skill}/SKILL.md`))
      expect(`${skill}: ${whole.includes(needle)}`).toBe(`${skill}: false`)
      expect(reason.length).toBeGreaterThan(0)
    }
  })

  test.each(RETIRED_MECHANISMS)(
    '$id is retired from the canon too, which is what makes it registrable',
    ({ needle }) => {
      for (const path of CANON) {
        expect(`${path}: ${normalize(read(path)).includes(needle)}`).toBe(`${path}: false`)
      }
    }
  )
})

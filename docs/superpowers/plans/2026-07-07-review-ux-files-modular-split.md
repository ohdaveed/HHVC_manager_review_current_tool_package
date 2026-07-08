# Split ux-improvements.js, review-queue.js, interactive-sitemap.js Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split `js/ux-improvements.js`, `js/review-queue.js`, and `js/interactive-sitemap.js` (1067/1067/1033 lines) into focused files of ~150-350 lines each, with zero behavior change.

**Architecture:** Each module keeps its original filename as a thin orchestrator (loads last, does init()/event wiring) on top of new sibling files that attach their functions to an internal `window.<Namespace>` object — the same pattern already used for `window.utils` and `window.reviewState`. Cross-file reference rule: a **backward** reference — calling into a namespace populated by a file that already loaded earlier (per the guard-clause chain) — may be destructured into a top-of-file const; this is safe because script tags execute synchronously in document order and namespace objects are mutated in place, never reassigned. A **forward** reference — calling into a namespace populated by a file that loads *later* — must be fully-qualified inline (`window.Namespace.sub.fn(...)`) at the call site, evaluated lazily when the call actually happens (a user action or later init), never destructured at top-of-file where it would resolve before the dependency exists. The plan has exactly one forward reference: review-queue's `rows.js` (loads before `render.js`) calling `window.ReviewQueueInternal.render.renderReviewQueue()`.

**Tech Stack:** Plain ES5/ES6 script-tag JS (no bundler, no modules), Bun test runner, Prettier, Zod (in build_scripts only).

## Global Constraints

- No behavior change: identical `localStorage` schema (`hhvcManagerReviewState:v1`), identical CSV/JSON export shapes, identical rendered DOM output.
- Existing **public** cross-file contracts must keep their exact shape: `window.reviewState`, `window.reviewChecks`, `window.reviewWorkspace`, `window.reviewDecisions`, `window.reviewQueue`, `window.__mountInteractiveSitemapOnTabOpen`, `window.__mountInteractiveSitemapTeardown`. Only the physical file each function lives in changes.
- New internal wiring namespaces (`window.ReviewUx`, `window.ReviewQueueInternal`, `window.InteractiveSitemap`) are implementation detail, not public API — never referenced from `pages/*.js` or from outside their own module's files.
- Every new file follows the existing early-return guard convention (see `js/review-queue.js:5`, `js/ux-improvements.js:5`) — bail out silently if `window.HHVC_DATA` or an earlier-loaded dependency namespace isn't ready.
- Each new file gets exactly one `<script>` tag in `index.html`, in the dependency order given in each task.
- Run `bun run format` after every task (Prettier: no semicolons, single quotes, 2-space indent, 100-char width, ES5 trailing commas — see `.prettierrc.json`).
- Rollout order: `interactive-sitemap.js` first (lowest risk — CSS extraction), then `ux-improvements.js`, then `review-queue.js` (highest risk — CSV import history).

---

### Task 1: Generalize the index.html script-tag drift check to cover `js/*.js`

**Files:**
- Modify: `build_scripts/index-html-checks.js`
- Modify: `build_scripts/load-pages.js`
- Modify: `build_scripts/validate.js`
- Test: `tests/index-html-checks.test.js`

**Interfaces:**
- Produces: `findJsScriptTags(html): string[]` and `getJsScriptPaths(): string[]`, used by every later task's verification step (`bun run validate`) to confirm no new file is missing its `<script>` tag.

This runs first, before any file is split, so every subsequent task's new `<script>` tag is checked by this from the moment it's added.

- [ ] **Step 1: Write the failing test for `findJsScriptTags`**

Add to `tests/index-html-checks.test.js` (after the existing `findPageScriptTags` describe block):

```js
describe('findJsScriptTags', () => {
  test('extracts js/*.js script src paths, excluding nested paths like js/vendor/*.js', () => {
    const html = `
      <script src="js/utils.js"></script>
      <script src="js/vendor/fuse.js"></script>
      <script src="pages/foo.js"></script>
      <script src="js/state.js"></script>
    `
    expect(findJsScriptTags(html)).toEqual(['js/utils.js', 'js/state.js'])
  })

  test('returns an empty array when there are no js/*.js script tags', () => {
    expect(findJsScriptTags('<script src="pages/foo.js"></script>')).toEqual([])
  })
})
```

Update the require at the top of the file:

```js
const { findPageScriptTags, findJsScriptTags, findScriptTagDrift } = require('../build_scripts/index-html-checks')
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun test tests/index-html-checks.test.js`
Expected: FAIL — `findJsScriptTags is not defined` / `TypeError: findJsScriptTags is not a function`

- [ ] **Step 3: Implement `findJsScriptTags` and generalize the regex helper**

Replace the full contents of `build_scripts/index-html-checks.js`:

```js
// Compare pages/*.js and js/*.js on disk against the <script> tags in
// index.html. Page modules are independent (each only writes into
// window.HHVC_PAGES), so tag *order* doesn't matter for pages/*.js — only
// that every page file has a tag and every tag points at a real file. The
// same membership-only check applies to js/*.js: script *order* matters for
// correctness at runtime (see CLAUDE.md's script load order section), but
// that ordering is reviewed by hand same as it always has been — this check
// only catches a missing or stale <script> tag. js/vendor/*.js files are
// naturally excluded: the regex only matches a single path segment after
// the prefix, so a nested path like js/vendor/fuse.js never matches.
// Split out as pure functions so they're testable without touching the real
// index.html (see tests/index-html-checks.test.js).

function findScriptTagsWithPrefix(html, prefix) {
  const tags = []
  const re = new RegExp(`<script src="(${prefix}[\\w-]+\\.js)"></script>`, 'g')
  let match
  while ((match = re.exec(html))) {
    tags.push(match[1])
  }
  return tags
}

/**
 * Extract `pages/*.js` script src paths referenced by an index.html string.
 * @param {string} html
 * @returns {string[]}
 */
function findPageScriptTags(html) {
  return findScriptTagsWithPrefix(html, 'pages/')
}

/**
 * Extract `js/*.js` script src paths referenced by an index.html string
 * (excluding nested paths such as js/vendor/*.js).
 * @param {string} html
 * @returns {string[]}
 */
function findJsScriptTags(html) {
  return findScriptTagsWithPrefix(html, 'js/')
}

/**
 * @param {string[]} filesOnDisk repo-relative paths, e.g. 'pages/foo.js'
 * @param {string[]} scriptTagsInHtml repo-relative paths parsed from index.html
 * @returns {{missingFromHtml: string[], missingFromDisk: string[]}}
 */
function findScriptTagDrift(filesOnDisk, scriptTagsInHtml) {
  const inHtml = new Set(scriptTagsInHtml)
  const onDisk = new Set(filesOnDisk)
  return {
    missingFromHtml: filesOnDisk.filter((file) => !inHtml.has(file)),
    missingFromDisk: scriptTagsInHtml.filter((file) => !onDisk.has(file)),
  }
}

module.exports = { findPageScriptTags, findJsScriptTags, findScriptTagDrift }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun test tests/index-html-checks.test.js`
Expected: PASS (all tests, including the pre-existing `findPageScriptTags`/`findScriptTagDrift` ones)

- [ ] **Step 5: Add `getJsScriptPaths` to `build_scripts/load-pages.js`**

In `build_scripts/load-pages.js`, add this function after `getPageScriptPaths`:

```js
/**
 * Return repo-relative paths for all js/*.js modules (excluding
 * js/vendor/*.js third-party files, which fast-glob's single-star pattern
 * naturally skips since it doesn't recurse into subdirectories).
 * @returns {string[]}
 */
function getJsScriptPaths() {
  return fg.sync('js/*.js', { cwd: root, onlyFiles: true }).sort((a, b) => a.localeCompare(b))
}
```

Update the `module.exports` at the bottom of the file to include it:

```js
module.exports = {
  root,
  getPageScriptPaths,
  getJsScriptPaths,
  createPageContext,
  runPageScripts,
  loadPageData,
}
```

- [ ] **Step 6: Wire the new js/*.js drift check into `build_scripts/validate.js`**

In `build_scripts/validate.js`, change the two top requires:

```js
const { loadPageData, getPageScriptPaths, getJsScriptPaths, root } = require('./load-pages')
```

```js
const { findPageScriptTags, findJsScriptTags, findScriptTagDrift } = require('./index-html-checks')
```

Immediately after the existing pages/*.js drift check block (the one that throws on `scriptDrift.missingFromHtml`/`missingFromDisk`), add:

```js
const jsFilesOnDisk = getJsScriptPaths()
const jsScriptDrift = findScriptTagDrift(jsFilesOnDisk, findJsScriptTags(indexHtml))
if (jsScriptDrift.missingFromHtml.length) {
  throw new Error(
    'js/*.js file(s) missing a <script> tag in index.html: ' + jsScriptDrift.missingFromHtml.join(', ')
  )
}
if (jsScriptDrift.missingFromDisk.length) {
  throw new Error(
    'index.html references js/*.js file(s) that no longer exist: ' +
      jsScriptDrift.missingFromDisk.join(', ')
  )
}
```

- [ ] **Step 7: Run the full validate script to confirm no drift on the current, unmodified tree**

Run: `bun run validate`
Expected: PASS — at this point every `js/*.js` file already has a matching `<script>` tag, so this only proves the new check doesn't false-positive before any files are split.

- [ ] **Step 8: Format and commit**

```bash
bun run format
git add build_scripts/index-html-checks.js build_scripts/load-pages.js build_scripts/validate.js tests/index-html-checks.test.js
git commit -m "$(cat <<'EOF'
Extend index.html script-tag drift check to cover js/*.js

Mirrors the existing pages/*.js membership check so the upcoming
ux-improvements/review-queue/interactive-sitemap file splits can't
silently leave a new js/*.js file without a <script> tag.
EOF
)"
```

---

### Task 2: Extract interactive-sitemap.js's injected CSS into a real stylesheet

**Files:**
- Create: `css/interactive-sitemap.css`
- Modify: `index.html`
- Modify: `js/interactive-sitemap.js:9` (remove `STYLE_ID` const), `js/interactive-sitemap.js:183-611` (remove `injectStyles` function), `js/interactive-sitemap.js:852` (remove `injectStyles()` call in `rerender`), `js/interactive-sitemap.js:1004` (remove `injectStyles()` call in `ensureSitemapRendered`)

**Interfaces:**
- Produces: nothing new for other files to consume — this is a pure extraction with no behavior change, verified visually.

- [ ] **Step 1: Create `css/interactive-sitemap.css`**

Content is the CSS that was inside the `injectStyles()` template string (`js/interactive-sitemap.js:189-607`), dedented from the template literal's 6-space indent to normal 2-space top-level CSS, with a header comment:

```css
/* Interactive HHVC sitemap diagram styles.
   Previously injected via js/interactive-sitemap.js's injectStyles(); moved
   to a real stylesheet loaded via <link> in index.html. */

.interactive-sitemap-panel {
  border-top: 1px solid var(--sfds-border);
  padding: 1rem;
  background: var(--sfds-white);
}

.interactive-sitemap-header {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: flex-start;
  margin-bottom: 0.8rem;
  flex-wrap: wrap;
}

.interactive-sitemap-header h3 {
  margin: 0 0 0.25rem;
  font-size: 1rem;
}

.interactive-sitemap-header p {
  margin: 0;
  color: var(--sfds-slate-3);
  font-size: 0.8rem;
  line-height: 1.35;
  max-width: 56rem;
}

.sitemap-toolbar {
  display: grid;
  gap: 0.65rem;
  margin-bottom: 0.85rem;
}

.sitemap-search-bar {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  flex-wrap: wrap;
}

.sitemap-search-input {
  min-height: 2.1rem;
  padding: 0.35rem 0.6rem;
  border: 1px solid var(--sfds-border);
  border-radius: var(--radius);
  font: inherit;
  color: var(--sfds-slate-1);
  background: var(--sfds-white);
  width: 18rem;
}

.sitemap-search-input:focus {
  outline: 2px solid var(--sfds-action-blue);
  outline-offset: 1px;
}

.sitemap-reset-button,
.sitemap-toggle {
  min-height: 2.1rem;
  padding: 0.35rem 0.8rem;
  border: 1px solid var(--sfds-border);
  border-radius: var(--radius);
  background: var(--sfds-white);
  color: var(--sfds-action-blue);
  cursor: pointer;
  font: inherit;
  font-weight: 700;
}

.sitemap-reset-button:hover,
.sitemap-reset-button:focus-visible,
.sitemap-toggle:hover,
.sitemap-toggle:focus-visible {
  border-color: var(--sfds-action-blue);
  background: var(--sfds-blue-soft-bg);
}

.sitemap-toggle[aria-pressed='true'] {
  background: var(--sfds-blue-soft-bg);
  border-color: var(--sfds-action-blue);
}

.sitemap-filter-bar,
.sitemap-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  align-items: center;
}

.sitemap-legend {
  list-style: none;
  margin: 0;
  padding: 0;
}

.sitemap-filter-button,
.sitemap-diagram-node {
  border: 1px solid var(--sfds-border);
  border-radius: var(--radius);
  background: var(--sfds-white);
  color: var(--sfds-action-blue);
  cursor: pointer;
  font: inherit;
}

.sitemap-filter-button {
  min-height: 2rem;
  padding: 0.35rem 0.65rem;
  font-size: 0.78rem;
  font-weight: 800;
}

.sitemap-filter-button.active,
.sitemap-filter-button:hover,
.sitemap-diagram-node:hover,
.sitemap-diagram-node.active {
  border-color: var(--sfds-action-blue);
  background: var(--sfds-blue-soft-bg);
  color: var(--sfds-action-blue-hover);
}

.sitemap-legend-item {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.72rem;
  color: var(--sfds-slate-2);
  font-weight: 700;
}

.sitemap-legend-swatch {
  width: 0.75rem;
  height: 0.75rem;
  border-radius: 2px;
  border: 1px solid var(--sfds-border);
  flex: none;
}

.interactive-sitemap-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.55fr) minmax(16rem, 0.75fr);
  gap: 1rem;
  align-items: start;
}

.sitemap-diagram {
  border: 1px solid var(--sfds-border);
  border-radius: var(--radius);
  background: var(--sfds-slate-6, #f8fafc);
  padding: 0.9rem;
  overflow-x: auto;
}

.sitemap-diagram-root-wrap {
  display: grid;
  justify-items: center;
  margin-bottom: 0.55rem;
}

.sitemap-diagram-connector {
  display: grid;
  justify-items: center;
  margin: 0.15rem 0 0.55rem;
  color: var(--sfds-slate-3);
  font-size: 0.9rem;
  font-weight: 900;
  user-select: none;
}

.sitemap-diagram-columns {
  display: grid;
  grid-template-columns: repeat(4, minmax(10.5rem, 1fr));
  gap: 0.65rem;
  min-width: 44rem;
}

.sitemap-diagram-column {
  display: grid;
  gap: 0.45rem;
  align-content: start;
}

.sitemap-diagram-column-header {
  margin: 0;
  font-size: 0.68rem;
  font-weight: 900;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--sfds-slate-3);
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.sitemap-diagram-column-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.15rem;
  height: 1.15rem;
  padding: 0 0.25rem;
  border-radius: 999px;
  background: var(--sfds-slate-5);
  color: var(--sfds-slate-2);
  font-size: 0.62rem;
}

.sitemap-diagram-node {
  width: 100%;
  min-height: 2.35rem;
  padding: 0.4rem 0.5rem;
  text-align: left;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 0.4rem;
  align-items: start;
}

.sitemap-diagram-node:focus-visible {
  outline: 2px solid var(--sfds-action-blue);
  outline-offset: 1px;
}

.sitemap-diagram-node.dimmed {
  opacity: 0.28;
  pointer-events: none;
}

.sitemap-diagram-node.linked {
  box-shadow: 0 0 0 2px var(--sfds-action-blue);
}

.sitemap-diagram-order {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.25rem;
  height: 1.25rem;
  border-radius: 999px;
  background: var(--sfds-slate-5);
  color: var(--sfds-slate-2);
  font-size: 0.6rem;
  font-weight: 900;
  flex: none;
}

.sitemap-diagram-node-body {
  display: grid;
  gap: 0.08rem;
  min-width: 0;
}

.sitemap-diagram-title {
  color: var(--sfds-slate-1);
  font-size: 0.74rem;
  font-weight: 800;
  line-height: 1.25;
}

.sitemap-diagram-meta {
  color: var(--sfds-slate-3);
  font-size: 0.62rem;
  line-height: 1.2;
}

.sitemap-diagram-node[data-page-type='Topic'] {
  border-left: 4px solid var(--sfds-action-blue);
  max-width: 18rem;
}

.sitemap-diagram-node[data-page-type='Resource Collection'] {
  border-left: 4px solid #7c3aed;
}

.sitemap-diagram-node[data-page-type='Transaction'] {
  border-left: 4px solid var(--sfds-green);
}

.sitemap-diagram-node[data-page-type='Information'] {
  border-left: 4px solid var(--sfds-warning-border);
}

.sitemap-diagram-node[data-page-type='Campaign'] {
  border-left: 4px solid #0891b2;
}

.sitemap-diagram-children {
  display: grid;
  gap: 0.35rem;
}

.sitemap-diagram-crosscut {
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px dashed var(--sfds-border);
}

.sitemap-diagram-crosscut-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(9.5rem, 1fr));
  gap: 0.35rem;
}

.sitemap-diagram-footnote {
  margin: 0.65rem 0 0;
  color: var(--sfds-slate-3);
  font-size: 0.72rem;
  line-height: 1.35;
}

.sitemap-detail-card {
  border: 1px solid var(--sfds-border);
  border-radius: var(--radius);
  background: var(--sfds-white);
  padding: 0.9rem;
  position: sticky;
  top: 0.5rem;
}

.sitemap-detail-card h4 {
  margin: 0 0 0.35rem;
  font-size: 1rem;
}

.sitemap-detail-card p {
  margin: 0 0 0.65rem;
  color: var(--sfds-slate-2);
  font-size: 0.86rem;
  line-height: 1.4;
}

.sitemap-detail-list {
  display: grid;
  gap: 0.45rem;
  margin: 0 0 0.8rem;
  padding: 0;
  list-style: none;
}

.sitemap-detail-list li {
  border-top: 1px solid var(--sfds-border);
  margin: 0;
  padding-top: 0.45rem;
  color: var(--sfds-slate-2);
  font-size: 0.78rem;
  line-height: 1.35;
}

.sitemap-detail-list strong {
  color: var(--sfds-slate-1);
}

.sitemap-link-section {
  border-top: 1px solid var(--sfds-border);
  padding-top: 0.6rem;
}

.sitemap-link-section h5 {
  margin: 0 0 0.4rem;
  font-size: 0.78rem;
  color: var(--sfds-slate-2);
}

.sitemap-link-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.sitemap-link-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0.5rem;
  border: 1px solid var(--sfds-border);
  border-radius: 999px;
  background: var(--sfds-white);
  color: var(--sfds-action-blue);
  font-size: 0.72rem;
  font-weight: 700;
  cursor: pointer;
  text-decoration: none;
}

.sitemap-link-chip:hover,
.sitemap-link-chip:focus-visible {
  background: var(--sfds-blue-soft-bg);
  border-color: var(--sfds-action-blue);
}

.sitemap-empty-note {
  color: var(--sfds-slate-3);
  font-size: 0.76rem;
  margin: 0;
  padding: 0.35rem 0;
}

@media (max-width: 980px) {
  .interactive-sitemap-layout {
    grid-template-columns: 1fr;
  }

  .sitemap-diagram-columns {
    grid-template-columns: repeat(2, minmax(10rem, 1fr));
    min-width: 0;
  }
}

@media (max-width: 640px) {
  .sitemap-diagram-columns {
    grid-template-columns: 1fr;
  }

  .sitemap-search-input {
    width: 100%;
  }
}
```

- [ ] **Step 2: Link the new stylesheet in `index.html`**

Find this line (around `index.html:12`):

```html
    <link rel="stylesheet" href="css/ux-improvements.css" />
```

Add immediately after it:

```html
    <link rel="stylesheet" href="css/interactive-sitemap.css" />
```

- [ ] **Step 3: Remove `injectStyles()` and its call sites from `js/interactive-sitemap.js`**

Delete the `STYLE_ID` constant (`js/interactive-sitemap.js:9`):

```js
  const STYLE_ID = 'interactiveSitemapStyles'
```

Delete the entire `injectStyles` function (`js/interactive-sitemap.js:183-612`, from `function injectStyles() {` through its closing `}` right before `function renderLegend() {`).

In `rerender()`, remove the `injectStyles()` call:

```js
  function rerender() {
    state.selectedKey = getCurrentKey()
    state._linkGraph = null
    renderPanel()
  }
```

In `ensureSitemapRendered()`, remove the `injectStyles()` call:

```js
  function ensureSitemapRendered() {
    if (sitemapMounted) {
      rerender()
      return
    }
    sitemapMounted = true
    rerender()
  }
```

- [ ] **Step 4: Verify with the test suite and format/validate**

Run: `bun run format && bun run validate && bun run test`
Expected: all PASS.

- [ ] **Step 5: Manual visual check**

Run: `bun run dev`, open `http://127.0.0.1:8080`, open the Sitemap workspace tab, and confirm the diagram renders with identical styling (legend colors, node borders, hover states, responsive layout at narrow width) to before the change. Check the browser console is clean (no errors about a missing `injectStyles`).

- [ ] **Step 6: Commit**

```bash
git add css/interactive-sitemap.css index.html js/interactive-sitemap.js
git commit -m "$(cat <<'EOF'
Extract interactive sitemap CSS from injectStyles() into a real stylesheet

Moves ~430 lines of CSS-in-JS into css/interactive-sitemap.css, linked via
index.html, removing the style-injection mechanism entirely.
EOF
)"
```

---

### Task 3: Extract interactive-sitemap.js's data/graph layer into js/interactive-sitemap-data.js

**Files:**
- Create: `js/interactive-sitemap-data.js`
- Modify: `index.html`
- Modify: `js/interactive-sitemap.js` (remove the moved declarations)

**Interfaces:**
- Produces: `window.InteractiveSitemap.state` (shared mutable object: `filter`, `search`, `selectedKey`, `showLinksFromSelected`, `_linkGraph`) and `window.InteractiveSitemap.data = { getCurrentKey, normalizeType, getOutgoingTargets, getPlacementTargets, buildLinkGraph, getLinkGraph, getPageRows, getHubKeys, buildDiagramGroups, getFilteredRows, getFilteredKeySet, getSelectedRow }`.
- Consumes: `window.HHVC_DATA`, `window.utils.{getCurrentKey, buildPageRows}`.

- [ ] **Step 1: Create `js/interactive-sitemap-data.js`**

```js
/* Interactive HHVC sitemap: graph-building and page-row query layer.
   Loads before js/interactive-sitemap-render.js and js/interactive-sitemap.js,
   which read window.InteractiveSitemap.state and window.InteractiveSitemap.data. */
;(function mountInteractiveSitemapData() {
  const DATA = window.HHVC_DATA
  if (!hasValidPageData(DATA)) return

  const TOPIC_KEY = 'pestsTopic'

  const state = {
    filter: 'All',
    search: '',
    selectedKey: document.getElementById('pageSelect')?.value || TOPIC_KEY,
    showLinksFromSelected: false,
  }

  const { getCurrentKey: getCurrentKeyShared, buildPageRows } = window.utils

  function getCurrentKey() {
    return getCurrentKeyShared(state.selectedKey)
  }

  function normalizeType(type) {
    const normalized = String(type || '').toLowerCase()
    if (normalized.includes('topic')) return 'Topic'
    if (normalized.includes('resource collection')) return 'Resource Collection'
    if (normalized.includes('transaction')) return 'Transaction'
    if (normalized.includes('campaign')) return 'Campaign'
    return 'Information'
  }

  function getOutgoingTargets(page) {
    const targets = new Set()
    for (const section of page.sections || []) {
      for (const card of section.cards || []) {
        if (card.target) targets.add(card.target)
      }
      if (section.buttonTarget) targets.add(section.buttonTarget)
      for (const step of section.steps || []) {
        if (step.buttonTarget) targets.add(step.buttonTarget)
      }
    }
    return Array.from(targets)
  }

  function getPlacementTargets(page) {
    const targets = new Set()
    for (const section of page.sections || []) {
      if (section.kind !== 'placement') continue
      if (
        String(section.heading || '')
          .toLowerCase()
          .includes('related')
      )
        continue
      for (const card of section.cards || []) {
        if (card.target) targets.add(card.target)
      }
    }
    return Array.from(targets)
  }

  function buildLinkGraph() {
    const graph = {}
    for (const [key] of DATA.order) {
      graph[key] = { incoming: new Set(), outgoing: new Set() }
    }
    for (const [key, page] of Object.entries(DATA.pages || {})) {
      const targets = getOutgoingTargets(page)
      for (const target of targets) {
        if (graph[target]) {
          graph[target].incoming.add(key)
          graph[key].outgoing.add(target)
        }
      }
    }
    return graph
  }

  function getLinkGraph() {
    if (!state._linkGraph) state._linkGraph = buildLinkGraph()
    return state._linkGraph
  }

  function getPageRows() {
    const graph = getLinkGraph()
    return buildPageRows(DATA, (key, label, page) => ({
      key,
      label,
      page,
      type: normalizeType(page.type || label),
      incomingCount: graph[key]?.incoming?.size || 0,
      outgoingCount: graph[key]?.outgoing?.size || 0,
    })).map((row, orderIndex) => ({ ...row, orderIndex }))
  }

  function getHubKeys() {
    return getPageRows()
      .filter((row) => row.type === 'Resource Collection')
      .map((row) => row.key)
  }

  function buildDiagramGroups() {
    const rows = getPageRows()
    const rowByKey = Object.fromEntries(rows.map((row) => [row.key, row]))
    const hubKeys = getHubKeys()
    const assigned = new Set([TOPIC_KEY, ...hubKeys])
    const groups = hubKeys.map((hubKey) => ({
      hubKey,
      hub: rowByKey[hubKey],
      children: [],
    }))
    const groupByHub = Object.fromEntries(groups.map((group) => [group.hubKey, group]))

    for (const hubKey of hubKeys) {
      const hubPage = DATA.pages[hubKey]
      if (!hubPage) continue
      for (const target of getPlacementTargets(hubPage)) {
        if (assigned.has(target) || !rowByKey[target]) continue
        assigned.add(target)
        groupByHub[hubKey].children.push(rowByKey[target])
      }
    }

    for (const group of groups) {
      group.children.sort((a, b) => a.orderIndex - b.orderIndex)
    }

    const crossCutting = rows
      .filter((row) => !assigned.has(row.key))
      .sort((a, b) => a.orderIndex - b.orderIndex)

    return {
      root: rowByKey[TOPIC_KEY] || rows[0],
      groups,
      crossCutting,
    }
  }

  function getFilteredRows() {
    const q = String(state.search || '')
      .trim()
      .toLowerCase()
    return getPageRows().filter((row) => {
      const matchesType = state.filter === 'All' || row.type === state.filter
      if (!matchesType) return false
      if (!q) return true
      const haystack =
        `${row.key} ${row.label} ${row.page.title || ''} ${row.page.summary || ''} ${row.page.slug || ''}`.toLowerCase()
      return haystack.includes(q)
    })
  }

  function getFilteredKeySet() {
    return new Set(getFilteredRows().map((row) => row.key))
  }

  function getSelectedRow() {
    const key = getCurrentKey()
    return getPageRows().find((row) => row.key === key) || getPageRows()[0]
  }

  window.InteractiveSitemap = window.InteractiveSitemap || {}
  window.InteractiveSitemap.state = state
  window.InteractiveSitemap.data = {
    getCurrentKey,
    normalizeType,
    getOutgoingTargets,
    getPlacementTargets,
    buildLinkGraph,
    getLinkGraph,
    getPageRows,
    getHubKeys,
    buildDiagramGroups,
    getFilteredRows,
    getFilteredKeySet,
    getSelectedRow,
  }
})()
```

- [ ] **Step 2: Add the `<script>` tag in `index.html`**

Find (around `index.html:356`):

```html
    <script src="js/interactive-sitemap.js"></script>
```

Replace with:

```html
    <script src="js/interactive-sitemap-data.js"></script>
    <script src="js/interactive-sitemap.js"></script>
```

(`js/interactive-sitemap-render.js` is inserted between these two in Task 4.)

- [ ] **Step 3: Remove the moved declarations from `js/interactive-sitemap.js`**

Delete the `TOPIC_KEY` constant and `state` object declaration (`js/interactive-sitemap.js:10-16`):

```js
  const TOPIC_KEY = 'pestsTopic'
  const state = {
    filter: 'All',
    search: '',
    selectedKey: document.getElementById('pageSelect')?.value || TOPIC_KEY,
    showLinksFromSelected: false,
  }
```

Delete `getCurrentKeyShared` and `buildPageRows` from the top-level destructure (`js/interactive-sitemap.js:20-27`), leaving only what the remaining code in this file still needs:

```js
  const { escapeHtml, getPrimaryCta, countRelatedLinks, debounce } = window.utils
```

Delete the functions `getCurrentKey`, `normalizeType`, `getOutgoingTargets`, `getPlacementTargets`, `buildLinkGraph`, `getLinkGraph`, `getPageRows`, `getHubKeys`, `buildDiagramGroups`, `getFilteredRows`, `getFilteredKeySet`, `getSelectedRow` in their entirety (originally spanning `js/interactive-sitemap.js:33-176`, before `shortTitle`).

Every remaining reference to `state`, `getCurrentKey()`, `getPageRows()`, `getFilteredRows()`, `getFilteredKeySet()`, `getLinkGraph()`, `getOutgoingTargets()`, `buildDiagramGroups()` inside the functions that stay in this file (rendering, interaction, lifecycle — moved out fully in Task 4/5) must become `window.InteractiveSitemap.state`, `window.InteractiveSitemap.data.getCurrentKey()`, etc. This rewiring is completed across Tasks 4 and 5 as those functions move to their own files or stay in the orchestrator — no intermediate broken state is committed; Steps 2-3 of this task are combined with Task 4 in the same working session before running verification, since `js/interactive-sitemap.js` alone won't parse correctly with dangling references until Task 4 also lands. (See Task 4 Step 4 for the combined verification.)

- [ ] **Step 4: Combined verification happens at the end of Task 4** — do not run `bun run test`/`bun run validate` yet if you stopped here; the file is mid-edit. Continue directly into Task 4 before verifying.

---

### Task 4: Extract interactive-sitemap.js's rendering layer into js/interactive-sitemap-render.js

**Files:**
- Create: `js/interactive-sitemap-render.js`
- Modify: `index.html`
- Modify: `js/interactive-sitemap.js` (remove the moved functions; this completes the rewiring started in Task 3)

**Interfaces:**
- Consumes: `window.InteractiveSitemap.state`, `window.InteractiveSitemap.data.*` (from Task 3), `window.utils.{escapeHtml, getPrimaryCta, countRelatedLinks}`.
- Produces: `window.InteractiveSitemap.render = { renderLegend, renderSearchAndFilters, renderDiagramNode, renderDiagram, renderLinkChips, renderDetail, mountPanel, renderPanel, rerender }`.

- [ ] **Step 1: Create `js/interactive-sitemap-render.js`**

```js
/* Interactive HHVC sitemap: rendering layer.
   Loads after js/interactive-sitemap-data.js and before js/interactive-sitemap.js. */
;(function mountInteractiveSitemapRender() {
  const DATA = window.HHVC_DATA
  if (!hasValidPageData(DATA) || !window.InteractiveSitemap?.data) return

  const PANEL_ID = 'interactiveSitemapPanel'
  const state = window.InteractiveSitemap.state
  const {
    getCurrentKey,
    getPageRows,
    getFilteredRows,
    getFilteredKeySet,
    getLinkGraph,
    buildDiagramGroups,
    getOutgoingTargets,
  } = window.InteractiveSitemap.data

  const { escapeHtml, getPrimaryCta, countRelatedLinks } = window.utils

  function getWorkspaceSitemapPanel() {
    return document.getElementById('reviewWorkspaceSitemap')
  }

  function shortTitle(title, max = 34) {
    const text = String(title || '').trim()
    if (text.length <= max) return text
    return `${text.slice(0, max - 1).trimEnd()}…`
  }

  function renderLegend() {
    const types = [
      ['Topic', 'var(--sfds-action-blue)'],
      ['Resource Collection', '#7c3aed'],
      ['Transaction', 'var(--sfds-green)'],
      ['Information', 'var(--sfds-warning-border)'],
      ['Campaign', '#0891b2'],
    ]
    return `
      <ul class="sitemap-legend" aria-label="Page type legend">
        ${types
          .map(
            ([label, color]) => `
          <li class="sitemap-legend-item">
            <span class="sitemap-legend-swatch" style="background:${color}"></span>
            ${escapeHtml(label)}
          </li>
        `
          )
          .join('')}
      </ul>
    `
  }

  function renderSearchAndFilters() {
    const filters = [
      'All',
      'Topic',
      'Resource Collection',
      'Transaction',
      'Information',
      'Campaign',
    ]
    const clearLabel = state.search ? '✕ Clear search' : ''
    const filteredCount = getFilteredRows().length
    const totalCount = getPageRows().length
    const isEmpty = state.search.trim().length > 0 && filteredCount === 0
    return `
      <div class="sitemap-search-bar">
        <input type="search" class="sitemap-search-input" value="${escapeHtml(state.search)}" placeholder="Search pages by title, slug, or keyword..." aria-label="Search sitemap pages" autocomplete="off" />
        <button type="button" class="sitemap-reset-button" data-sitemap-action="clear-search" ${clearLabel ? '' : 'hidden'}>${escapeHtml(clearLabel || '')}</button>
        <button type="button" class="sitemap-reset-button" data-sitemap-action="go-to-current">Go to current page</button>
        <button type="button" class="sitemap-toggle" data-sitemap-action="toggle-links" aria-pressed="${state.showLinksFromSelected ? 'true' : 'false'}">
          ${state.showLinksFromSelected ? 'Hide link highlights' : 'Highlight links'}
        </button>
      </div>
      <div class="sitemap-filter-bar" aria-label="Sitemap page type filters">
        ${filters
          .map(
            (filter) => `
          <button type="button" class="sitemap-filter-button ${state.filter === filter ? 'active' : ''}" data-sitemap-filter="${filter}" aria-pressed="${state.filter === filter ? 'true' : 'false'}">
            ${escapeHtml(filter)} ${filter !== 'All' ? `(${getPageRows().filter((r) => r.type === filter).length})` : `(${totalCount})`}
          </button>
        `
          )
          .join('')}
      </div>
      ${renderLegend()}
      <p class="sitemap-diagram-footnote" style="margin:0;">Showing ${filteredCount} of ${totalCount} pages in <code>js/page-data.js</code> order.</p>
      ${isEmpty ? '<p class="sitemap-empty-note">No pages match your search or filter. Try adjusting your terms.</p>' : ''}
    `
  }

  function renderDiagramNode(row, options = {}) {
    const { hub = false, dimmed = false, linked = false } = options
    const active = row.key === getCurrentKey()
    const title = row.page.title || row.label
    return `
      <button
        type="button"
        class="sitemap-diagram-node ${active ? 'active' : ''} ${dimmed ? 'dimmed' : ''} ${linked ? 'linked' : ''}"
        data-sitemap-key="${escapeHtml(row.key)}"
        data-page-type="${escapeHtml(row.type)}"
        title="${escapeHtml(title)}"
        ${active ? 'aria-current="page"' : ''}
      >
        <span class="sitemap-diagram-order" aria-hidden="true">${row.orderIndex + 1}</span>
        <span class="sitemap-diagram-node-body">
          <span class="sitemap-diagram-title">${escapeHtml(hub ? title : shortTitle(title))}</span>
          <span class="sitemap-diagram-meta">${escapeHtml(row.type)}${hub ? '' : ` · ${escapeHtml(row.key)}`}</span>
        </span>
      </button>
    `
  }

  function renderDiagram() {
    const { root, groups, crossCutting } = buildDiagramGroups()
    const visibleKeys = getFilteredKeySet()
    const selectedKey = getCurrentKey()
    const graph = getLinkGraph()
    const outgoing = graph[selectedKey]?.outgoing || new Set()

    function nodeOptions(row) {
      const visible = visibleKeys.has(row.key)
      const linked = state.showLinksFromSelected && outgoing.has(row.key)
      return {
        hub: row.type === 'Resource Collection',
        dimmed: !visible,
        linked,
      }
    }

    const columns = groups
      .map((group) => {
        const visibleChildren = group.children.filter((child) => visibleKeys.has(child.key))
        const childMarkup = group.children.length
          ? group.children.map((child) => renderDiagramNode(child, nodeOptions(child))).join('')
          : '<p class="sitemap-empty-note">No child pages assigned.</p>'
        const hubVisible = visibleKeys.has(group.hubKey)
        return `
          <section class="sitemap-diagram-column" aria-label="${escapeHtml(group.hub?.page.title || group.hubKey)}">
            <h4 class="sitemap-diagram-column-header">
              Hub
              <span class="sitemap-diagram-column-count">${visibleChildren.length}/${group.children.length}</span>
            </h4>
            ${group.hub ? renderDiagramNode(group.hub, { ...nodeOptions(group.hub), hub: true }) : ''}
            <div class="sitemap-diagram-children" role="list" aria-hidden="${hubVisible && visibleChildren.length === 0 ? 'true' : 'false'}">
              ${childMarkup}
            </div>
          </section>
        `
      })
      .join('')

    const crossCuttingMarkup = crossCutting.length
      ? `
        <section class="sitemap-diagram-crosscut" aria-label="Topic-linked and cross-cutting pages">
          <h4 class="sitemap-diagram-column-header">
            Topic-linked pages
            <span class="sitemap-diagram-column-count">${crossCutting.filter((row) => visibleKeys.has(row.key)).length}/${crossCutting.length}</span>
          </h4>
          <div class="sitemap-diagram-crosscut-grid" role="list">
            ${crossCutting.map((row) => renderDiagramNode(row, nodeOptions(row))).join('')}
          </div>
        </section>
      `
      : ''

    return `
      <figure class="sitemap-diagram" role="group" aria-label="HHVC page inventory diagram">
        <div class="sitemap-diagram-root-wrap">
          ${root ? renderDiagramNode(root, { ...nodeOptions(root), hub: true }) : ''}
        </div>
        <div class="sitemap-diagram-connector" aria-hidden="true">↓</div>
        <div class="sitemap-diagram-columns">${columns}</div>
        ${crossCuttingMarkup}
        <p class="sitemap-diagram-footnote">Columns group child pages under each resource-collection hub using placement card targets. Inventory order is shown on every node.</p>
      </figure>
    `
  }

  function renderLinkChips(title, targets) {
    if (!targets || !targets.length) return ''
    const graph = getLinkGraph()
    return `
      <section class="sitemap-link-section">
        <h5>${escapeHtml(title)}</h5>
        <div class="sitemap-link-chips">
          ${targets
            .map((target) => {
              const page = DATA.pages[target]
              const label = page ? escapeHtml(page.title || target) : escapeHtml(target)
              const incoming = graph[target]?.incoming?.size || 0
              const outgoing = graph[target]?.outgoing?.size || 0
              return `<button type="button" class="sitemap-link-chip" data-sitemap-key="${escapeHtml(target)}" data-sitemap-action="open-link">${label} <span aria-hidden="true">→${outgoing} ←${incoming}</span></button>`
            })
            .join('')}
        </div>
      </section>
    `
  }

  function renderDetail() {
    const row = window.InteractiveSitemap.data.getSelectedRow()
    if (!row) return ''

    const page = row.page
    const primaryCta = getPrimaryCta(page) || 'None set'
    const audienceCount = Array.isArray(page.audience) ? page.audience.length : 0
    const relatedCount = countRelatedLinks(page)
    const graph = getLinkGraph()
    const outgoingTargets = getOutgoingTargets(page)
    const incomingTargets = Array.from(graph[row.key]?.incoming || [])

    return `
      <aside class="sitemap-detail-card" aria-label="Selected sitemap page details">
        <h4>${escapeHtml(page.title || row.label)}</h4>
        <p>${escapeHtml(page.summary || 'No summary available.')}</p>
        <ul class="sitemap-detail-list">
          <li><strong>Inventory #:</strong> ${row.orderIndex + 1} of ${getPageRows().length}</li>
          <li><strong>Page type:</strong> ${escapeHtml(row.type)}</li>
          <li><strong>Reading target:</strong> ${escapeHtml(page.reading || 'Not set')}</li>
          <li><strong>Primary CTA:</strong> ${escapeHtml(primaryCta)}</li>
          <li><strong>Audience entries:</strong> ${audienceCount}</li>
          <li><strong>Linked items:</strong> ${relatedCount}</li>
          <li><strong>URL slug:</strong> ${escapeHtml(page.slug || 'Not set')}</li>
          <li><strong>Links to:</strong> ${outgoingTargets.length} page(s)</li>
          <li><strong>Linked from:</strong> ${incomingTargets.length} page(s)</li>
        </ul>
        ${renderLinkChips('Outgoing links', outgoingTargets)}
        ${renderLinkChips('Incoming links', incomingTargets)}
      </aside>
    `
  }

  function mountPanel() {
    if (document.getElementById(PANEL_ID)) return document.getElementById(PANEL_ID)

    const host = getWorkspaceSitemapPanel()
    if (!host) return null

    const panel = document.createElement('section')
    panel.id = PANEL_ID
    panel.className = 'interactive-sitemap-panel'
    panel.setAttribute('aria-label', 'Interactive sitemap diagram')
    host.appendChild(panel)
    return panel
  }

  function renderPanel() {
    const panel = mountPanel()
    if (!panel) return

    panel.innerHTML = `
      <div class="interactive-sitemap-header">
        <div>
          <h3>Page inventory diagram</h3>
          <p>One diagram from <code>js/page-data.js</code>: topic page at top, four resource-collection hubs below, child pages grouped by hub placement links. Click any node to open that mockup.</p>
        </div>
      </div>
      <div class="sitemap-toolbar">${renderSearchAndFilters()}</div>
      <div class="interactive-sitemap-layout">
        ${renderDiagram()}
        ${renderDetail()}
      </div>
    `
  }

  function rerender() {
    state.selectedKey = getCurrentKey()
    state._linkGraph = null
    renderPanel()
  }

  window.InteractiveSitemap.render = {
    renderLegend,
    renderSearchAndFilters,
    renderDiagramNode,
    renderDiagram,
    renderLinkChips,
    renderDetail,
    mountPanel,
    renderPanel,
    rerender,
  }
})()
```

Note: `state.selectedKey = getCurrentKey()` inside `rerender` reassigns `selectedKey` using the *old* value of `state.selectedKey` (via `getCurrentKeyShared`) — this is copied verbatim from the original and is unchanged behavior, just now operating on the shared `window.InteractiveSitemap.state` object instead of a local closure variable.

- [ ] **Step 2: Add the `<script>` tag in `index.html`**

Find:

```html
    <script src="js/interactive-sitemap-data.js"></script>
    <script src="js/interactive-sitemap.js"></script>
```

Replace with:

```html
    <script src="js/interactive-sitemap-data.js"></script>
    <script src="js/interactive-sitemap-render.js"></script>
    <script src="js/interactive-sitemap.js"></script>
```

- [ ] **Step 3: Finish trimming `js/interactive-sitemap.js`**

After Task 3's Step 3 and this task, `js/interactive-sitemap.js` should contain only: the top guard, `PANEL_ID`... — no, `PANEL_ID` moved to render file. Remove `PANEL_ID` from this file too if it's still there from Task 3 (it was originally declared at `js/interactive-sitemap.js:8`, alongside `STYLE_ID` which Task 2 already removed). Delete:

```js
  const PANEL_ID = 'interactiveSitemapPanel'
```

Delete `shortTitle`, `renderLegend`, `renderSearchAndFilters`, `renderDiagramNode`, `renderDiagram`, `renderLinkChips`, `renderDetail`, `mountPanel`, `renderPanel`, `rerender`, and `getWorkspaceSitemapPanel` in their entirety from `js/interactive-sitemap.js` (originally `js/interactive-sitemap.js:29-32` for `getWorkspaceSitemapPanel`, and `177-857` — post-CSS-removal line numbers will have shifted; locate by function name, not the stale line numbers from before Tasks 2-3 edited the file).

The remaining `js/interactive-sitemap.js` (verify it now looks like this in full) should be:

```js
/* Interactive HHVC sitemap diagram.
   Orchestrator: interaction handlers and lifecycle wiring on top of
   window.InteractiveSitemap.state/.data (js/interactive-sitemap-data.js) and
   window.InteractiveSitemap.render (js/interactive-sitemap-render.js). */
;(function mountInteractiveSitemap() {
  const DATA = window.HHVC_DATA
  if (!hasValidPageData(DATA) || !window.InteractiveSitemap?.render) return

  let sitemapMounted = false

  const { debounce } = window.utils
  const state = window.InteractiveSitemap.state
  const { getCurrentKey } = window.InteractiveSitemap.data
  const { rerender } = window.InteractiveSitemap.render

  function openPageByKey(key) {
    if (!key || !DATA.pages[key]) return
    state.selectedKey = key
    window.renderPage?.(key)
    window.setTimeout(rerender, 0)
    window.setTimeout(() => {
      const node = document.querySelector(`[data-sitemap-key="${CSS.escape(key)}"]`)
      if (node) node.focus()
    }, 50)
  }

  function handleClick(event) {
    const actionButton = event.target.closest('[data-sitemap-action]')
    if (actionButton) {
      const action = actionButton.getAttribute('data-sitemap-action')
      if (action === 'clear-search') {
        state.search = ''
        rerender()
        return
      }
      if (action === 'go-to-current') {
        openPageByKey(getCurrentKey())
        return
      }
      if (action === 'toggle-links') {
        state.showLinksFromSelected = !state.showLinksFromSelected
        rerender()
        return
      }
      if (action === 'open-link') {
        const chip = event.target.closest('[data-sitemap-key]')
        const key = chip?.getAttribute('data-sitemap-key')
        openPageByKey(key)
        return
      }
    }

    const filterButton = event.target.closest('[data-sitemap-filter]')
    if (filterButton) {
      state.filter = filterButton.getAttribute('data-sitemap-filter') || 'All'
      state.showLinksFromSelected = false
      rerender()
      return
    }

    const nodeButton = event.target.closest('[data-sitemap-key]')
    if (nodeButton) {
      const key = nodeButton.getAttribute('data-sitemap-key')
      openPageByKey(key)
      return
    }
  }

  function handleKeydown(event) {
    const searchInput = event.target.closest('.sitemap-search-input')
    if (searchInput) {
      if (event.key === 'Escape') {
        state.search = ''
        searchInput.value = ''
        rerender()
        searchInput.focus()
        return
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        const firstNode = document.querySelector('.sitemap-diagram-node:not(.dimmed)')
        if (firstNode) firstNode.focus()
        return
      }
    }

    if (event.key === 'Escape') {
      state.showLinksFromSelected = false
      state.filter = 'All'
      rerender()
      return
    }

    const focusedNode = document.activeElement?.closest('.sitemap-diagram-node')
    if (!focusedNode || focusedNode.classList.contains('dimmed')) return

    const nodes = Array.from(document.querySelectorAll('.sitemap-diagram-node:not(.dimmed)'))
    const index = nodes.indexOf(focusedNode)

    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault()
      nodes[index + 1]?.focus()
      return
    }

    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault()
      nodes[index - 1]?.focus()
      return
    }

    if (event.key === 'Home') {
      event.preventDefault()
      nodes[0]?.focus()
      return
    }

    if (event.key === 'End') {
      event.preventDefault()
      nodes[nodes.length - 1]?.focus()
      return
    }
  }

  const handleSearchInput = debounce((event) => {
    if (!event.target.closest('.sitemap-search-input')) return
    state.search = event.target.value
    state.showLinksFromSelected = false
    rerender()
    const input = document.querySelector('.sitemap-search-input')
    if (input) {
      input.focus()
      const end = input.value.length
      input.setSelectionRange(end, end)
    }
  }, 180)

  function wrapRenderPageForSitemap() {
    if (typeof window.renderPage !== 'function' || window.renderPage.__sitemapWrapped) return
    const originalRenderPage = window.renderPage
    window.renderPage = function renderPageWithSitemapRefresh(key) {
      const result = originalRenderPage.call(this, key)
      // Under View Transitions, renderPage returns a promise that resolves
      // once #pageSelect reflects the new page; rerendering earlier would
      // highlight the previous page as current.
      if (result && typeof result.then === 'function')
        result.then(() => {
          if (sitemapMounted) rerender()
        })
      else if (sitemapMounted) rerender()
      return result
    }
    window.renderPage.__sitemapWrapped = true
  }

  function ensureSitemapRendered() {
    if (sitemapMounted) {
      rerender()
      return
    }
    sitemapMounted = true
    rerender()
  }

  function init() {
    document.addEventListener('click', handleClick)
    document.addEventListener('keydown', handleKeydown)
    document.addEventListener('input', handleSearchInput)
    document.addEventListener('hhvc:review-data-changed', () => {
      if (sitemapMounted) rerender()
    })
    wrapRenderPageForSitemap()

    window.__mountInteractiveSitemapOnTabOpen = ensureSitemapRendered
  }

  function teardown() {
    sitemapMounted = false
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init)
  } else {
    init()
  }

  if (typeof window !== 'undefined') {
    window.__mountInteractiveSitemapTeardown = teardown
  }
})()
```

- [ ] **Step 4: Verify**

Run: `bun run format && bun run validate && bun run test`
Expected: all PASS.

Run: `bun run dev`, open the app, open the Sitemap tab, and manually confirm: search filters nodes, clicking a filter button works, clicking a diagram node navigates and opens that page, arrow-key navigation between nodes works, Escape resets filters, "Highlight links" toggle works, "Go to current page" works. Check console is clean.

- [ ] **Step 5: Commit**

```bash
git add index.html js/interactive-sitemap.js js/interactive-sitemap-data.js js/interactive-sitemap-render.js
git commit -m "$(cat <<'EOF'
Split interactive-sitemap.js into data/render/orchestrator files

js/interactive-sitemap.js drops from ~1033 to ~250 lines, now just
interaction handlers and lifecycle wiring on top of the new
window.InteractiveSitemap.state/.data/.render namespaces.
EOF
)"
```

---

### Task 5: Full regression pass for the interactive-sitemap.js split

**Files:** none (verification-only task)

- [ ] **Step 1: Run the complete verification suite**

```bash
bun run format:check
bun run validate
bun run test
bun run test:e2e
```

Expected: all PASS.

- [ ] **Step 2: Confirm line counts moved as expected**

```bash
wc -l js/interactive-sitemap.js js/interactive-sitemap-data.js js/interactive-sitemap-render.js css/interactive-sitemap.css
```

Expected: `js/interactive-sitemap.js` ~230-260 lines, `js/interactive-sitemap-data.js` ~150-180 lines, `js/interactive-sitemap-render.js` ~260-300 lines, `css/interactive-sitemap.css` ~400-430 lines.

- [ ] **Step 3: No commit needed** — this task is a checkpoint before moving on to `ux-improvements.js`. If any check fails, fix forward with a new commit before proceeding to Task 6.

---

### Task 6: Extract the shared review-state store into js/review-state-store.js

**Files:**
- Create: `js/review-state-store.js`
- Modify: `index.html`
- Modify: `js/ux-improvements.js:12-13` (delete `STORAGE_KEY`/`STORAGE_VERSION`), `js/ux-improvements.js:142-222` (delete `getEmptyState`/`readLocalState`/`writeLocalState`/`updateLocalState`/the `window.reviewState` assignment)

**Interfaces:**
- Produces: `window.reviewState = { STORAGE_KEY, STORAGE_VERSION, read, write, update, getEmptyState }` — this is an **existing public contract** (already consumed by `js/review-queue.js`); its shape does not change, only its file location.

- [ ] **Step 1: Create `js/review-state-store.js`**

```js
/* Shared review-state localStorage store.
   Extracted from js/ux-improvements.js so js/ux-improvements-state-sync.js,
   js/ux-improvements-workspace.js, js/ux-improvements-export.js, and
   js/review-queue*.js (all load after this file) can read/write the same
   hhvcManagerReviewState:v1 blob via window.reviewState. */
;(function mountReviewStateStore() {
  const DATA = window.HHVC_DATA
  if (!hasValidPageData(DATA)) return

  const STORAGE_KEY = 'hhvcManagerReviewState:v1'
  const STORAGE_VERSION = 1

  function getEmptyState() {
    return {
      version: STORAGE_VERSION,
      updated_at: null,
      ui: {},
      globals: {},
      pages: {},
    }
  }

  function readLocalState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return getEmptyState()
      const parsed = JSON.parse(raw)
      const validator = window.reviewStateValidation?.validateReviewState
      if (typeof validator === 'function') {
        const result = validator(parsed)
        if (!result.ok) return getEmptyState()
        return {
          ...getEmptyState(),
          ...result.data,
          ui: result.data.ui || {},
          globals: result.data.globals || {},
          pages: result.data.pages || {},
        }
      }
      if (!parsed || parsed.version !== STORAGE_VERSION) return getEmptyState()

      return {
        ...getEmptyState(),
        ...parsed,
        ui: parsed.ui || {},
        globals: parsed.globals || {},
        pages: parsed.pages || {},
      }
    } catch {
      return getEmptyState()
    }
  }

  function writeLocalState(state) {
    const nextState = {
      ...getEmptyState(),
      ...state,
      version: STORAGE_VERSION,
      updated_at: new Date().toISOString(),
      ui: state.ui || {},
      globals: state.globals || {},
      pages: state.pages || {},
    }

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState))
    } catch (err) {
      // Storage can throw (quota exceeded, private browsing, disabled storage).
      // Surface it to the reviewer instead of failing silently mid-review.
      console.error('Failed to save review state locally:', err)
      window.utils?.showErrorBanner?.(
        'Your last change was not saved locally. Local storage may be full or disabled in this browser.'
      )
    }
    return nextState
  }

  function updateLocalState(updater) {
    const state = readLocalState()
    const updated = updater(state) || state
    return writeLocalState(updated)
  }

  window.reviewState = {
    STORAGE_KEY,
    STORAGE_VERSION,
    read: readLocalState,
    write: writeLocalState,
    update: updateLocalState,
    getEmptyState,
  }
})()
```

- [ ] **Step 2: Add the `<script>` tag in `index.html`**

Find (around `index.html:350-352`):

```html
    <script src="js/review-state-validation.js"></script>
    <script src="js/reading-level.js"></script>
    <script src="js/ux-improvements.js"></script>
```

Replace with:

```html
    <script src="js/review-state-validation.js"></script>
    <script src="js/reading-level.js"></script>
    <script src="js/review-state-store.js"></script>
    <script src="js/ux-improvements.js"></script>
```

- [ ] **Step 3: Delete the moved constants and functions from `js/ux-improvements.js`**

Delete lines 12-13:

```js
  const STORAGE_KEY = 'hhvcManagerReviewState:v1'
  const STORAGE_VERSION = 1
```

Delete lines 142-222 in their entirety — from `function getEmptyState() {` through the closing `}` of the `window.reviewState = {...}` assignment (this is the comment `// Explicit dependency for other modules...` plus `getEmptyState`, `readLocalState`, `writeLocalState`, `updateLocalState`, and the `window.reviewState = {...}` block).

- [ ] **Step 4: Rewire the remaining bare references in `js/ux-improvements.js` to the public `window.reviewState` API**

Run:

```bash
sed -i \
  -e 's/\breadLocalState(/window.reviewState.read(/g' \
  -e 's/\bwriteLocalState(/window.reviewState.write(/g' \
  -e 's/\bupdateLocalState(/window.reviewState.update(/g' \
  -e 's/\bgetEmptyState(/window.reviewState.getEmptyState(/g' \
  -e 's/\bSTORAGE_KEY\b/window.reviewState.STORAGE_KEY/g' \
  -e 's/\bSTORAGE_VERSION\b/window.reviewState.STORAGE_VERSION/g' \
  js/ux-improvements.js
```

This is safe as a whole-file rename: after Step 3's deletion, none of these six identifiers exist as declarations anywhere else in the file, only as call sites/reads (in `applySavedPageState`, `applySavedUiPreferences`, `updateLocalStorageStatus`, `saveCurrentPageToLocalStorage`, `setWorkspaceTab`, `setWorkspaceOpen`, `toggleWorkspace`, `maybeShowWorkspaceOnboarding`, `initWorkspaceTabs`, `exportReviewStateBackup`, `importReviewStateBackup`, `clearSavedLocalReviews`, `wrapRenderPage`, `restoreInitialPage`, and the `tagToggle` change listener inside `attachRefreshListeners`).

- [ ] **Step 5: Verify**

Run: `bun run format && bun run validate && bun run test`
Expected: all PASS — `js/ux-improvements.js` still has all its other functions intact, just reading/writing through `window.reviewState.*` instead of local closures.

Run: `bun run dev`, open the app, edit a review field (e.g. reviewer name), reload the page, confirm the value persisted. Check console is clean.

- [ ] **Step 6: Commit**

```bash
git add index.html js/ux-improvements.js js/review-state-store.js
git commit -m "$(cat <<'EOF'
Extract shared review-state store into js/review-state-store.js

window.reviewState keeps its exact existing public shape; only its file
location changes, from inside js/ux-improvements.js to its own file.
EOF
)"
```

---

### Task 7: Extract the page-state-sync layer into js/ux-improvements-state-sync.js

**Files:**
- Create: `js/ux-improvements-state-sync.js`
- Modify: `index.html`
- Modify: `js/ux-improvements.js` (remove the moved functions/constants; rewire remaining call sites)

**Interfaces:**
- Consumes: `window.reviewState`, `window.utils.{escapeHtml, getPrimaryCta, setPrimaryCta, today, getValue, setValue, setText, buildReviewRecord, getCurrentKey, countRelatedLinks, defaultSeoTitle, defaultMetaDescription}`, `window.readingLevel?.analyzeReadingLevel`.
- Produces: `window.reviewChecks = { getRuleResultsFor }` (existing public contract, unchanged shape) and `window.ReviewUx.stateSync = { getCurrentPage, getSeoTitle, getMetaDescription, getRuleResultsFor, getRuleResults, renderPageChecksPanel, collectCurrentPageReviewState, saveCurrentPageToLocalStorage, clearReviewFieldsForNewPage, updateMockupTextFromSavedState, applySavedPageState, applySavedUiPreferences, updateLocalStorageStatus, SEO_TITLE_LIMIT, META_DESCRIPTION_LIMIT }`.

- [ ] **Step 1: Create `js/ux-improvements-state-sync.js`**

```js
/* Manager review: page state sync between the SEO/editor sidebar and
   window.reviewState. Loads after js/review-state-store.js. */
;(function mountUxImprovementsStateSync() {
  const DATA = window.HHVC_DATA
  if (!hasValidPageData(DATA) || !window.reviewState) return

  const SEO_TITLE_LIMIT = 60
  const META_DESCRIPTION_LIMIT = 110
  const CHECKS_PANEL_ID = 'reviewChecksPanel'

  let isRestoringState = false

  const {
    escapeHtml,
    getPrimaryCta,
    setPrimaryCta,
    today,
    getValue,
    setValue,
    setText,
    buildReviewRecord,
    getCurrentKey,
    countRelatedLinks,
    defaultSeoTitle,
    defaultMetaDescription,
  } = window.utils

  function getCurrentPage() {
    return DATA.pages[getCurrentKey()] || {}
  }

  function getSeoTitle(page) {
    return getValue('seoTitleInput') || defaultSeoTitle(page)
  }

  function getMetaDescription(page) {
    return getValue('metaDescriptionInput') || defaultMetaDescription(page)
  }

  // useEditor: true reads live SEO sidebar values (current page only);
  // false evaluates raw page data so any page can be scored for the portfolio view.
  function getRuleResultsFor(page, { useEditor = false } = {}) {
    const title = page.title || ''
    const summary = page.summary || ''
    const seoTitle = useEditor ? getSeoTitle(page) : defaultSeoTitle(page)
    const metaDescription = useEditor ? getMetaDescription(page) : defaultMetaDescription(page)
    const primaryCta = getPrimaryCta(page)
    const relatedLinks = countRelatedLinks(page)
    const normalizedType = String(page.type || '')
      .trim()
      .toLowerCase()
    const isTransaction = normalizedType === 'transaction' || normalizedType === 'transaction page'

    const rules = [
      {
        label: 'Page type',
        pass: Boolean(page.type),
        detail: page.type || 'Missing page type',
      },
      {
        label: 'Title',
        pass: Boolean(title) && title.length <= 80,
        detail: title ? `${title.length} characters` : 'Missing title',
      },
      {
        label: 'Summary',
        pass: Boolean(summary) && summary.length <= 180,
        detail: summary ? `${summary.length} characters` : 'Missing summary',
      },
      {
        label: 'Audience',
        pass: Array.isArray(page.audience) && page.audience.length > 0,
        detail: Array.isArray(page.audience)
          ? `${page.audience.length} audience entries`
          : 'Missing audience section',
      },
      {
        label: 'Primary CTA',
        pass: !isTransaction || Boolean(primaryCta),
        detail: primaryCta || 'Manual check: not required for this page type',
      },
      {
        label: 'Related links',
        pass: relatedLinks >= 3,
        detail: `${relatedLinks} linked cards or action links`,
      },
      {
        label: 'SEO title',
        pass: seoTitle.length <= SEO_TITLE_LIMIT,
        detail: `${seoTitle.length}/${SEO_TITLE_LIMIT} characters`,
      },
      {
        label: 'Meta description',
        pass: metaDescription.length <= META_DESCRIPTION_LIMIT,
        detail: `${metaDescription.length}/${META_DESCRIPTION_LIMIT} characters`,
      },
      {
        label: 'Reading target',
        pass: Boolean(page.reading),
        detail: page.reading || 'Missing reading target',
      },
    ]

    const readingAnalysis = window.readingLevel?.analyzeReadingLevel?.(page)
    if (readingAnalysis && readingAnalysis.computed != null) {
      rules.push({
        label: 'Computed reading level',
        pass: readingAnalysis.withinTarget !== false,
        detail: readingAnalysis.detail,
      })
    }

    return rules
  }

  function getRuleResults(page) {
    return getRuleResultsFor(page, { useEditor: true })
  }

  // Exposed for js/review-queue.js's Overview tab, which needs to compute a
  // checks passed/total count for every page, not just the one currently
  // open in the editor.
  window.reviewChecks = { getRuleResultsFor }

  function collectCurrentPageReviewState() {
    const page = getCurrentPage()
    const pageKey = getCurrentKey()

    return buildReviewRecord(page, pageKey, {
      page_title: page.title || '',
      url_slug: getValue('urlInput') || page.slug || '',
      edited_title: page.title || '',
      edited_summary: page.summary || '',
      primary_cta: getPrimaryCta(page) || '',
      seo_title: getSeoTitle(page),
      meta_description: getMetaDescription(page),
      reviewer: getValue('reviewerInput'),
      review_date: getValue('reviewDateInput') || today(),
      decision: getValue('reviewDecision') || 'Needs review',
      notes: getValue('reviewNotes'),
      risks_or_blockers: getValue('reviewRisks'),
      follow_up_owner: getValue('reviewOwner'),
      reading_target: page.reading || '',
      updated_at: new Date().toISOString(),
    })
  }

  function saveCurrentPageToLocalStorage() {
    if (isRestoringState) return

    const snapshot = collectCurrentPageReviewState()
    window.reviewState.update((state) => {
      state.ui.last_page_key = snapshot.page_key
      state.ui.show_karl_tags = document.getElementById('tagToggle')?.checked !== false
      state.globals.reviewer = snapshot.reviewer
      state.globals.owner = snapshot.follow_up_owner
      state.pages[snapshot.page_key] = snapshot
      return state
    })

    updateLocalStorageStatus()
  }

  function clearReviewFieldsForNewPage(state) {
    setValue('reviewDateInput', today())
    setValue('reviewDecision', 'Needs review')
    setValue('reviewNotes', '')
    setValue('reviewRisks', '')
    setValue('reviewOwner', state?.globals?.owner || 'David')
  }

  function updateMockupTextFromSavedState(page, saved) {
    if (saved.edited_title) {
      page.title = saved.edited_title
      const h1 = document.querySelector('#mockPage .hero h1')
      if (h1) h1.textContent = saved.edited_title
    }

    if (saved.edited_summary) {
      page.summary = saved.edited_summary
      const summary = document.querySelector('#mockPage .hero .summary')
      if (summary) summary.textContent = saved.edited_summary
    }

    if (saved.primary_cta) {
      setPrimaryCta(page, saved.primary_cta)
    }

    if (saved.seo_title) {
      page.seoTitle = saved.seo_title
      page.seoTitleEdited = true
      setValue('seoTitleInput', saved.seo_title)
    }

    if (saved.meta_description) {
      page.metaDescription = saved.meta_description
      page.metaDescriptionEdited = true
      setValue('metaDescriptionInput', saved.meta_description)
    }

    if (saved.url_slug) {
      setValue('urlInput', saved.url_slug)
      setText('browserUrl', `https://${saved.url_slug}`)
    }

    if (typeof window.updateSearchPreview === 'function') window.updateSearchPreview()
  }

  function applySavedPageState(pageKey) {
    const state = window.reviewState.read()
    const page = DATA.pages[pageKey]
    if (!page) return

    isRestoringState = true
    const saved = state.pages[pageKey]

    setValue(
      'reviewerInput',
      state.globals.reviewer || saved?.reviewer || getValue('reviewerInput')
    )

    if (saved) {
      setValue('reviewDateInput', saved.review_date || today())
      setValue('reviewDecision', saved.decision || 'Needs review')
      setValue('reviewNotes', saved.notes || '')
      setValue('reviewRisks', saved.risks_or_blockers || '')
      setValue('reviewOwner', saved.follow_up_owner || state.globals.owner || 'David')
      updateMockupTextFromSavedState(page, saved)
    } else {
      clearReviewFieldsForNewPage(state)
    }

    isRestoringState = false
    updateLocalStorageStatus()
  }

  function applySavedUiPreferences() {
    const state = window.reviewState.read()
    const tagToggle = document.getElementById('tagToggle')
    if (tagToggle && typeof state.ui.show_karl_tags === 'boolean') {
      tagToggle.checked = state.ui.show_karl_tags
      document.body.classList.toggle('hide-karl-tags', !tagToggle.checked)
    }
  }

  function updateLocalStorageStatus() {
    const status = document.getElementById('localStorageStatus')
    if (!status) return

    const state = window.reviewState.read()
    const savedCount = Object.keys(state.pages || {}).length
    const updatedAt = state.updated_at ? new Date(state.updated_at) : null
    const updatedLabel = updatedAt
      ? updatedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
      : 'not saved yet'

    status.textContent = `${savedCount} page review${savedCount === 1 ? '' : 's'} saved locally. Last save: ${updatedLabel}.`
  }

  function renderPageChecksPanel() {
    const panel = document.getElementById(CHECKS_PANEL_ID)
    if (!panel) return

    const page = getCurrentPage()
    const rules = getRuleResults(page)

    panel.innerHTML = `
      <section class="compliance-panel">
        <h3>Current page checks</h3>
        <p class="review-decision-note">
          Scores only the page open in the mockup (${escapeHtml(getCurrentKey())}). For all pages at
          once, use the <strong>Overview</strong> tab. Search metadata values update as you edit
          them in the sidebar.
        </p>
        <ul class="compliance-list">
          ${rules
            .map(
              (rule) => `
            <li class="compliance-item ${rule.pass ? 'pass' : 'warn'}">
              <span>
                <span class="compliance-rule">${escapeHtml(rule.label)}</span>
                <span class="compliance-detail">${escapeHtml(rule.detail)}</span>
              </span>
            </li>
          `
            )
            .join('')}
        </ul>
      </section>
    `
  }

  window.ReviewUx = window.ReviewUx || {}
  window.ReviewUx.stateSync = {
    getCurrentPage,
    getSeoTitle,
    getMetaDescription,
    getRuleResultsFor,
    getRuleResults,
    renderPageChecksPanel,
    collectCurrentPageReviewState,
    saveCurrentPageToLocalStorage,
    clearReviewFieldsForNewPage,
    updateMockupTextFromSavedState,
    applySavedPageState,
    applySavedUiPreferences,
    updateLocalStorageStatus,
    SEO_TITLE_LIMIT,
    META_DESCRIPTION_LIMIT,
  }
})()
```

- [ ] **Step 2: Add the `<script>` tag in `index.html`**

Find:

```html
    <script src="js/review-state-store.js"></script>
    <script src="js/ux-improvements.js"></script>
```

Replace with:

```html
    <script src="js/review-state-store.js"></script>
    <script src="js/ux-improvements-state-sync.js"></script>
    <script src="js/ux-improvements.js"></script>
```

- [ ] **Step 3: Delete the moved constants and functions from `js/ux-improvements.js`**

Delete the constants `SEO_TITLE_LIMIT`, `META_DESCRIPTION_LIMIT`, `CHECKS_PANEL_ID` and the `let isRestoringState = false` declaration (these all moved into the new file).

Delete the functions in their entirety: `getCurrentPage`, `getSeoTitle`, `getMetaDescription`, `getRuleResultsFor`, `getRuleResults`, the `window.reviewChecks = { getRuleResultsFor }` line, `collectCurrentPageReviewState`, `saveCurrentPageToLocalStorage`, `clearReviewFieldsForNewPage`, `updateMockupTextFromSavedState`, `applySavedPageState`, `applySavedUiPreferences`, `updateLocalStorageStatus`, `renderPageChecksPanel`.

From the top-of-file destructure of `window.utils`, remove `escapeHtml, getPrimaryCta, setPrimaryCta, today, getValue, setValue, setText, buildReviewRecord, countRelatedLinks, defaultSeoTitle, defaultMetaDescription` if the remaining code in `js/ux-improvements.js` no longer uses them directly (some, like `getValue` and `escapeHtml`, are still used by functions that move out in Tasks 8-9 — leave the destructure as-is for now and let Task 10's final cleanup trim it once the true remaining set is known).

- [ ] **Step 4: Rewire remaining bare references**

Run:

```bash
sed -i \
  -e 's/\bgetCurrentPage(/window.ReviewUx.stateSync.getCurrentPage(/g' \
  -e 's/\bgetSeoTitle(/window.ReviewUx.stateSync.getSeoTitle(/g' \
  -e 's/\bgetMetaDescription(/window.ReviewUx.stateSync.getMetaDescription(/g' \
  -e 's/\bgetRuleResultsFor(/window.ReviewUx.stateSync.getRuleResultsFor(/g' \
  -e 's/\bgetRuleResults(/window.ReviewUx.stateSync.getRuleResults(/g' \
  -e 's/\brenderPageChecksPanel(/window.ReviewUx.stateSync.renderPageChecksPanel(/g' \
  -e 's/\bcollectCurrentPageReviewState(/window.ReviewUx.stateSync.collectCurrentPageReviewState(/g' \
  -e 's/\bsaveCurrentPageToLocalStorage(/window.ReviewUx.stateSync.saveCurrentPageToLocalStorage(/g' \
  -e 's/\bclearReviewFieldsForNewPage(/window.ReviewUx.stateSync.clearReviewFieldsForNewPage(/g' \
  -e 's/\bupdateMockupTextFromSavedState(/window.ReviewUx.stateSync.updateMockupTextFromSavedState(/g' \
  -e 's/\bapplySavedPageState(/window.ReviewUx.stateSync.applySavedPageState(/g' \
  -e 's/\bapplySavedUiPreferences(/window.ReviewUx.stateSync.applySavedUiPreferences(/g' \
  -e 's/\bupdateLocalStorageStatus(/window.ReviewUx.stateSync.updateLocalStorageStatus(/g' \
  -e 's/\bSEO_TITLE_LIMIT\b/window.ReviewUx.stateSync.SEO_TITLE_LIMIT/g' \
  -e 's/\bMETA_DESCRIPTION_LIMIT\b/window.ReviewUx.stateSync.META_DESCRIPTION_LIMIT/g' \
  js/ux-improvements.js
```

This affects the remaining `renderStickyBar` (needs `getCurrentPage`) and `getCurrentReviewSummaryLines` (needs `getCurrentPage`, `getSeoTitle`, `getMetaDescription`, `getRuleResults`, both `*_LIMIT` constants) call sites, which still live in `js/ux-improvements.js` at this point (they move out in Tasks 8-9).

- [ ] **Step 5: Also add the guard dependency check**

`js/ux-improvements.js`'s top guard (`if (!hasValidPageData(DATA)) return`) should now also check the new namespace it depends on, matching the defensive-check convention already used in `js/review-queue.js:5`. Change:

```js
  if (!hasValidPageData(DATA)) return
```

to:

```js
  if (!hasValidPageData(DATA) || !window.ReviewUx?.stateSync) return
```

- [ ] **Step 6: Verify**

Run: `bun run format && bun run validate && bun run test`
Expected: all PASS.

Run: `bun run dev`, confirm the sticky bar still shows the current page title/decision and the Checks tab still renders the nine compliance rules.

- [ ] **Step 7: Commit**

```bash
git add index.html js/ux-improvements.js js/ux-improvements-state-sync.js
git commit -m "$(cat <<'EOF'
Extract page-state-sync layer into js/ux-improvements-state-sync.js

Moves the SEO/editor sidebar <-> window.reviewState sync logic and the
compliance-rule engine into their own file, exposed via
window.ReviewUx.stateSync and the existing window.reviewChecks contract.
EOF
)"
```

---

### Task 8: Extract the workspace/sticky-bar layer into js/ux-improvements-workspace.js

**Files:**
- Create: `js/ux-improvements-workspace.js`
- Modify: `index.html`
- Modify: `js/ux-improvements.js` (remove the moved functions/constants; rewire remaining call sites)

**Interfaces:**
- Consumes: `window.ReviewUx.stateSync.getCurrentPage`, `window.reviewState`, `window.reviewQueue` (existing public API, may be `undefined` until `js/review-queue.js` loads — already guarded with `?.` in the original code), `window.utils.{getValue, getStatusChipClass, escapeHtml}`.
- Produces: `window.reviewWorkspace = { setTab, setOpen, toggle, WORKSPACE_TABS }` and `window.reviewDecisions = { set: applyDecisionToCurrentPage }` (both **existing public contracts**, unchanged shape — consumed by `js/keyboard-shortcuts.js`), plus internal `window.ReviewUx.workspace = { renderStickyBar, setWorkspaceTab, setWorkspaceOpen, toggleWorkspace, maybeShowWorkspaceOnboarding, handleStickyBarClick, initWorkspaceTabs, updateDecisionQuickActions, initDecisionQuickActions, applyDecisionToCurrentPage }`.

- [ ] **Step 1: Create `js/ux-improvements-workspace.js`**

```js
/* Manager review: sticky bar, workspace tabs, and decision quick actions.
   Loads after js/ux-improvements-state-sync.js. */
;(function mountUxImprovementsWorkspace() {
  const DATA = window.HHVC_DATA
  if (!hasValidPageData(DATA) || !window.reviewState || !window.ReviewUx?.stateSync) return

  const STICKY_BAR_ID = 'reviewStickyBar'
  const WORKSPACE_ID = 'reviewWorkspace'
  const WORKSPACE_TABS = ['overview', 'checks', 'sitemap', 'help']

  const { getValue, getStatusChipClass, escapeHtml } = window.utils

  function renderStickyBar() {
    const bar = document.getElementById(STICKY_BAR_ID)
    if (!bar) return

    const page = window.ReviewUx.stateSync.getCurrentPage()
    const decision = getValue('reviewDecision') || 'Needs review'
    const chipClass = getStatusChipClass(decision)
    const stats = window.reviewQueue?.getQueueStats?.() || {
      reviewed: 0,
      total: DATA.order.length,
    }
    const filter = window.reviewQueue?.getFilter?.() || 'All'
    const filterLabel = filter !== 'All' ? filter : ''
    const prevKey = window.reviewQueue?.getAdjacentKey?.(-1, filter)
    const nextKey = window.reviewQueue?.getAdjacentKey?.(1, filter)
    const state = window.reviewState.read()
    const workspaceOpen = Boolean(state.ui.workspace_open)
    const prevNavLabel = filterLabel ? `Previous page (${filterLabel} filter)` : 'Previous page'
    const nextNavLabel = filterLabel ? `Next page (${filterLabel} filter)` : 'Next page'
    const currentKey = window.utils.getCurrentKey()

    bar.innerHTML = `
      <div class="review-sticky-bar-main">
        <span class="status-chip ${chipClass}">${escapeHtml(decision)}</span>
        <p class="review-sticky-bar-title">${escapeHtml(page.title || currentKey)}</p>
        ${filterLabel ? `<span class="review-sticky-bar-filter">Filter: ${escapeHtml(filterLabel)}</span>` : ''}
      </div>
      <nav class="review-sticky-bar-actions">
        <span class="review-sticky-bar-progress">${stats.reviewed}/${stats.total} reviewed</span>
        <button type="button" class="review-sticky-btn" data-sticky-action="prev"${prevKey ? '' : ' disabled'} aria-label="${escapeHtml(prevNavLabel)}">Previous</button>
        <button type="button" class="review-sticky-btn" data-sticky-action="next"${nextKey ? '' : ' disabled'} aria-label="${escapeHtml(nextNavLabel)}">Next</button>
        <button type="button" class="review-sticky-btn primary" data-sticky-action="toggle-workspace" aria-expanded="${workspaceOpen ? 'true' : 'false'}">
          ${workspaceOpen ? 'Hide workspace' : 'Show workspace'}
        </button>
      </nav>
    `
  }

  function setWorkspaceTab(tabId) {
    if (!WORKSPACE_TABS.includes(tabId)) tabId = 'overview'

    const tabs = document.querySelectorAll('[data-workspace-tab]')
    const panels = document.querySelectorAll('[data-workspace-panel]')

    tabs.forEach((tab) => {
      const isSelected = tab.getAttribute('data-workspace-tab') === tabId
      tab.setAttribute('aria-selected', isSelected ? 'true' : 'false')
      // Roving tabindex: Tab lands on the active tab, arrows move between tabs.
      tab.tabIndex = isSelected ? 0 : -1
    })

    panels.forEach((panel) => {
      const isActive = panel.getAttribute('data-workspace-panel') === tabId
      panel.hidden = !isActive
    })

    if (tabId === 'sitemap' && typeof window.__mountInteractiveSitemapOnTabOpen === 'function') {
      window.__mountInteractiveSitemapOnTabOpen()
    }

    if (tabId === 'help') {
      window.refreshDashboardGuidance?.()
    }

    window.reviewState.update((state) => {
      state.ui.workspace_tab = tabId
      return state
    })
  }

  function setWorkspaceOpen(isOpen) {
    const workspace = document.getElementById(WORKSPACE_ID)
    if (!workspace) return

    workspace.hidden = !isOpen

    const toggleButton = document.querySelector('[data-sticky-action="toggle-workspace"]')
    if (toggleButton) {
      toggleButton.setAttribute('aria-expanded', isOpen ? 'true' : 'false')
      toggleButton.textContent = isOpen ? 'Hide workspace' : 'Show workspace'
    }

    window.reviewState.update((state) => {
      state.ui.workspace_open = isOpen
      if (isOpen && !state.ui.workspace_tab) state.ui.workspace_tab = 'overview'
      return state
    })

    if (isOpen) {
      const state = window.reviewState.read()
      setWorkspaceTab(state.ui.workspace_tab || 'overview')
      setTimeout(() => {
        workspace.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 50)
    }
  }

  function toggleWorkspace() {
    const state = window.reviewState.read()
    setWorkspaceOpen(!state.ui.workspace_open)
  }

  function maybeShowWorkspaceOnboarding() {
    const state = window.reviewState.read()
    if (state.ui.workspace_onboarding_seen) return

    const hasExistingUsage =
      Object.keys(state.pages || {}).length > 0 || Boolean(state.ui.workspace_tab)

    if (hasExistingUsage) {
      window.reviewState.update((nextState) => {
        nextState.ui.workspace_onboarding_seen = true
        return nextState
      })
      return
    }

    window.reviewState.update((nextState) => {
      nextState.ui.workspace_onboarding_seen = true
      nextState.ui.workspace_open = true
      nextState.ui.workspace_tab = 'overview'
      return nextState
    })

    const workspace = document.getElementById(WORKSPACE_ID)
    if (workspace) workspace.hidden = false

    const toggleButton = document.querySelector('[data-sticky-action="toggle-workspace"]')
    if (toggleButton) {
      toggleButton.setAttribute('aria-expanded', 'true')
      toggleButton.textContent = 'Hide workspace'
    }

    setWorkspaceTab('overview')
    if (typeof window.showToast === 'function') {
      window.showToast(
        'Review workspace opened — use Overview for site-wide triage or Page checks for the open page.',
        'info'
      )
    }
  }

  window.reviewWorkspace = {
    setTab: setWorkspaceTab,
    setOpen: setWorkspaceOpen,
    toggle: toggleWorkspace,
    WORKSPACE_TABS,
  }

  function handleStickyBarClick(event) {
    const button = event.target.closest('[data-sticky-action]')
    if (!button || button.disabled) return

    const action = button.getAttribute('data-sticky-action')
    const filter = window.reviewQueue?.getFilter?.() || 'All'

    if (action === 'prev') {
      const key = window.reviewQueue?.getAdjacentKey?.(-1, filter)
      if (key) window.renderPage?.(key)
      return
    }

    if (action === 'next') {
      const key = window.reviewQueue?.getAdjacentKey?.(1, filter)
      if (key) window.renderPage?.(key)
      return
    }

    if (action === 'toggle-workspace') {
      toggleWorkspace()
    }
  }

  function initWorkspaceTabs() {
    const tablist = document.getElementById('reviewWorkspaceTabs')
    if (!tablist || tablist.dataset.bound === 'true') return
    tablist.dataset.bound = 'true'

    tablist.addEventListener('click', (event) => {
      const tab = event.target.closest('[data-workspace-tab]')
      if (!tab) return
      setWorkspaceTab(tab.getAttribute('data-workspace-tab') || 'overview')
    })

    tablist.addEventListener('keydown', (event) => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
      const tabs = Array.from(tablist.querySelectorAll('[data-workspace-tab]'))
      const currentIndex = tabs.indexOf(document.activeElement)
      if (currentIndex === -1) return

      event.preventDefault()
      let nextIndex = currentIndex
      if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + tabs.length) % tabs.length
      if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % tabs.length
      if (event.key === 'Home') nextIndex = 0
      if (event.key === 'End') nextIndex = tabs.length - 1

      const nextTab = tabs[nextIndex]
      nextTab.focus()
      setWorkspaceTab(nextTab.getAttribute('data-workspace-tab') || 'overview')
    })

    const stickyBar = document.getElementById(STICKY_BAR_ID)
    stickyBar?.addEventListener('click', handleStickyBarClick)

    const state = window.reviewState.read()
    setWorkspaceOpen(Boolean(state.ui.workspace_open))
    if (state.ui.workspace_open) {
      setWorkspaceTab(state.ui.workspace_tab || 'overview')
    }
  }

  function updateDecisionQuickActions() {
    const current = getValue('reviewDecision') || 'Needs review'
    document.querySelectorAll('#decisionQuickActions [data-decision]').forEach((button) => {
      const isActive = button.getAttribute('data-decision') === current
      button.setAttribute('aria-pressed', isActive ? 'true' : 'false')
    })
  }

  function initDecisionQuickActions() {
    const group = document.getElementById('decisionQuickActions')
    if (!group || group.dataset.bound === 'true') return
    group.dataset.bound = 'true'

    group.addEventListener('click', (event) => {
      const button = event.target.closest('[data-decision]')
      if (!button) return
      applyDecisionToCurrentPage(button.getAttribute('data-decision'))
    })

    updateDecisionQuickActions()
  }

  function applyDecisionToCurrentPage(decision) {
    const select = document.getElementById('reviewDecision')
    if (!select || !decision) return
    if (select.value === decision) return

    select.value = decision
    // Reuse the existing persistence path bound to the select's change event.
    select.dispatchEvent(new Event('change', { bubbles: true }))
    if (typeof window.showToast === 'function') {
      const tone = decision === 'Blocked' || decision === 'Revise and resubmit' ? 'warn' : 'success'
      const nextKey = window.reviewQueue?.getNextNeedsReviewKey?.()
      let toastAction = null
      if (nextKey && typeof window.renderPage === 'function') {
        toastAction = {
          label: 'Next Actionable Page',
          callback: () => window.renderPage(nextKey),
        }
      }
      window.showToast(`Decision set: ${decision}`, tone, toastAction)
    }
  }

  window.reviewDecisions = { set: applyDecisionToCurrentPage }

  window.ReviewUx = window.ReviewUx || {}
  window.ReviewUx.workspace = {
    renderStickyBar,
    setWorkspaceTab,
    setWorkspaceOpen,
    toggleWorkspace,
    maybeShowWorkspaceOnboarding,
    handleStickyBarClick,
    initWorkspaceTabs,
    updateDecisionQuickActions,
    initDecisionQuickActions,
    applyDecisionToCurrentPage,
  }
})()
```

Note: `renderStickyBar` originally used the file-level destructured `getCurrentKey()` (bare) for the `page.title || getCurrentKey()` fallback; here it's `window.utils.getCurrentKey()` since this file doesn't otherwise need a standalone `getCurrentKey` destructure — this is the one behavior-preserving adaptation needed because the original bare `getCurrentKey` came from `ux-improvements.js`'s single shared `window.utils` destructure block, which this new file doesn't inherit.

- [ ] **Step 2: Add the `<script>` tag in `index.html`**

Find:

```html
    <script src="js/ux-improvements-state-sync.js"></script>
    <script src="js/ux-improvements.js"></script>
```

Replace with:

```html
    <script src="js/ux-improvements-state-sync.js"></script>
    <script src="js/ux-improvements-workspace.js"></script>
    <script src="js/ux-improvements.js"></script>
```

- [ ] **Step 3: Delete the moved constants and functions from `js/ux-improvements.js`**

Delete the constants `STICKY_BAR_ID`, `WORKSPACE_ID`, `WORKSPACE_TABS`.

Delete the functions in their entirety: `renderStickyBar`, `setWorkspaceTab`, `setWorkspaceOpen`, `toggleWorkspace`, `maybeShowWorkspaceOnboarding`, the `window.reviewWorkspace = {...}` block, `handleStickyBarClick`, `initWorkspaceTabs`, `updateDecisionQuickActions`, `initDecisionQuickActions`, `applyDecisionToCurrentPage`, the `window.reviewDecisions = {...}` line.

- [ ] **Step 4: Rewire remaining bare references**

Run:

```bash
sed -i \
  -e 's/\brenderStickyBar(/window.ReviewUx.workspace.renderStickyBar(/g' \
  -e 's/\bupdateDecisionQuickActions(/window.ReviewUx.workspace.updateDecisionQuickActions(/g' \
  -e 's/\binitWorkspaceTabs(/window.ReviewUx.workspace.initWorkspaceTabs(/g' \
  -e 's/\binitDecisionQuickActions(/window.ReviewUx.workspace.initDecisionQuickActions(/g' \
  -e 's/\bmaybeShowWorkspaceOnboarding(/window.ReviewUx.workspace.maybeShowWorkspaceOnboarding(/g' \
  js/ux-improvements.js
```

These five are the only workspace-file functions still called from the remaining `js/ux-improvements.js` (inside `refreshUx` and `init`).

- [ ] **Step 5: Update the top guard**

```js
  if (!hasValidPageData(DATA) || !window.ReviewUx?.stateSync) return
```

becomes:

```js
  if (!hasValidPageData(DATA) || !window.ReviewUx?.stateSync || !window.ReviewUx?.workspace) return
```

- [ ] **Step 6: Verify**

Run: `bun run format && bun run validate && bun run test`
Expected: all PASS.

Run: `bun run dev`, confirm: the workspace toggle button opens/closes the workspace, tab switching (Overview/Checks/Sitemap/Help) works with arrow-key navigation, decision quick-action buttons update the decision select. Test `js/keyboard-shortcuts.js`'s shortcuts that touch `window.reviewWorkspace`/`window.reviewDecisions` (e.g. press a decision-shortcut key) still work.

- [ ] **Step 7: Commit**

```bash
git add index.html js/ux-improvements.js js/ux-improvements-workspace.js
git commit -m "$(cat <<'EOF'
Extract workspace/sticky-bar layer into js/ux-improvements-workspace.js

window.reviewWorkspace and window.reviewDecisions keep their exact existing
public shapes; only their file location changes.
EOF
)"
```

---

### Task 9: Extract the summary/export/backup layer into js/ux-improvements-export.js

**Files:**
- Create: `js/ux-improvements-export.js`
- Modify: `index.html`
- Modify: `js/ux-improvements.js` (remove the moved functions/constants; rewire remaining call sites)

**Interfaces:**
- Consumes: `window.ReviewUx.stateSync.{getCurrentPage, getSeoTitle, getMetaDescription, getRuleResults, SEO_TITLE_LIMIT, META_DESCRIPTION_LIMIT, saveCurrentPageToLocalStorage, applySavedPageState, clearReviewFieldsForNewPage, updateLocalStorageStatus}`, `window.reviewState`, `window.ReviewUx.refreshUx` (set by the orchestrator in Task 10 — referenced lazily at call time, safe regardless of load order since it's only invoked from click/file-read callbacks, never at file-parse time), `window.utils.{getValue, getPrimaryCta, getCurrentKey, today, toCsv, downloadFile, setText, defaultSeoTitle, defaultMetaDescription}`.
- Produces: `window.ReviewUx.exportImport = { getCurrentReviewSummaryLines, buildReviewSummary, copyText, mountCopySummaryButton, exportSavedLocalReviewsCsv, exportReviewStateBackup, importReviewStateBackup, mountBackupControls, clearSavedLocalReviews, mountLocalStorageControls }`.

- [ ] **Step 1: Create `js/ux-improvements-export.js`**

```js
/* Manager review: review summary, CSV export, and JSON backup/restore.
   Loads after js/ux-improvements-state-sync.js. */
;(function mountUxImprovementsExport() {
  const DATA = window.HHVC_DATA
  if (!hasValidPageData(DATA) || !window.reviewState || !window.ReviewUx?.stateSync) return

  const { getValue, getPrimaryCta, getCurrentKey, today, toCsv, downloadFile, setText, defaultSeoTitle, defaultMetaDescription } =
    window.utils

  function getCurrentReviewSummaryLines() {
    const page = window.ReviewUx.stateSync.getCurrentPage()
    const seoTitle = window.ReviewUx.stateSync.getSeoTitle(page)
    const metaDescription = window.ReviewUx.stateSync.getMetaDescription(page)
    const rules = window.ReviewUx.stateSync.getRuleResults(page)
    const passed = rules.filter((rule) => rule.pass).length
    const seoLimit = window.ReviewUx.stateSync.SEO_TITLE_LIMIT
    const metaLimit = window.ReviewUx.stateSync.META_DESCRIPTION_LIMIT

    return [
      'HHVC manager review summary',
      `Page: ${page.title || ''}`,
      `Page key: ${getCurrentKey()}`,
      `Type: ${page.type || ''}`,
      `URL: https://${getValue('urlInput') || page.slug || ''}`,
      `Decision: ${getValue('reviewDecision') || 'Needs review'}`,
      `Checks: ${passed}/${rules.length}`,
      `SEO title: ${seoTitle} (${seoTitle.length}/${seoLimit})`,
      `Meta description: ${metaDescription} (${metaDescription.length}/${metaLimit})`,
      `Reading target: ${page.reading || ''}`,
      `Primary CTA: ${getPrimaryCta(page) || ''}`,
      `Reviewer: ${getValue('reviewerInput')}`,
      `Review date: ${getValue('reviewDateInput')}`,
      `Notes: ${getValue('reviewNotes')}`,
      `Risks or blockers: ${getValue('reviewRisks')}`,
      `Follow-up owner: ${getValue('reviewOwner')}`,
    ]
  }

  function buildReviewSummary() {
    return getCurrentReviewSummaryLines().join('\n')
  }

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text)
    }

    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.setAttribute('readonly', '')
    textarea.style.position = 'fixed'
    textarea.style.left = '-9999px'
    document.body.appendChild(textarea)
    try {
      textarea.select()
      const copied = document.execCommand('copy')
      if (!copied) {
        return Promise.reject(
          new Error('Failed to copy text to clipboard. Browser clipboard access may be blocked.')
        )
      }
      return Promise.resolve()
    } catch (error) {
      return Promise.reject(error)
    } finally {
      textarea.remove()
    }
  }

  function exportSavedLocalReviewsCsv() {
    window.ReviewUx.stateSync.saveCurrentPageToLocalStorage()

    const state = window.reviewState.read()
    const headers = [
      'review_date',
      'reviewer',
      'page_key',
      'page_title',
      'page_type',
      'url_slug',
      'decision',
      'notes',
      'risks_or_blockers',
      'follow_up_owner',
      'seo_title',
      'meta_description',
      'primary_cta',
      'reading_target',
      'updated_at',
    ]

    const rows = [headers]
    for (const [pageKey] of DATA.order) {
      const page = DATA.pages[pageKey] || {}
      const saved = state.pages[pageKey]
      if (!saved) continue

      rows.push([
        saved.review_date || '',
        saved.reviewer || state.globals.reviewer || '',
        pageKey,
        saved.page_title || page.title || '',
        saved.page_type || page.type || '',
        saved.url_slug || page.slug || '',
        saved.decision || 'Needs review',
        saved.notes || '',
        saved.risks_or_blockers || '',
        saved.follow_up_owner || '',
        saved.seo_title || defaultSeoTitle(page),
        saved.meta_description || defaultMetaDescription(page),
        saved.primary_cta || getPrimaryCta(page),
        saved.reading_target || page.reading || '',
        saved.updated_at || '',
      ])
    }

    downloadFile('hhvc-saved-local-manager-reviews.csv', toCsv(rows), 'text/csv;charset=utf-8')
    setText('reviewExportStatus', 'Exported saved local reviews CSV.')
    if (typeof window.showToast === 'function')
      window.showToast('Saved local reviews exported', 'success')
  }

  function exportReviewStateBackup() {
    window.ReviewUx.stateSync.saveCurrentPageToLocalStorage()
    const state = window.reviewState.read()
    downloadFile(
      `hhvc-review-state-backup-${today()}.json`,
      JSON.stringify(state, null, 2),
      'application/json;charset=utf-8'
    )
    setText('reviewExportStatus', 'Downloaded review state backup JSON.')
    if (typeof window.showToast === 'function')
      window.showToast('Review state backup downloaded', 'success')
  }

  function importReviewStateBackup(file) {
    const fail = (message) => {
      setText('reviewExportStatus', message)
      if (typeof window.showToast === 'function') window.showToast(message, 'warn')
    }

    file
      .text()
      .then((text) => {
        let parsed
        try {
          parsed = JSON.parse(text)
        } catch {
          fail('Import failed: the file is not valid JSON.')
          return
        }

        if (
          !parsed ||
          parsed.version !== window.reviewState.STORAGE_VERSION ||
          typeof parsed.pages !== 'object' ||
          !parsed.pages
        ) {
          fail('Import failed: not a valid HHVC review state backup.')
          return
        }

        const validator = window.reviewStateValidation?.validateReviewState
        const validated =
          typeof validator === 'function' ? validator(parsed) : { ok: true, data: parsed }
        if (!validated.ok) {
          fail(`Import failed: ${validated.error}`)
          return
        }

        const entries = Object.entries(validated.data.pages).filter(
          ([key, value]) => DATA.pages[key] && value && typeof value === 'object'
        )
        if (!entries.length) {
          fail('Import finished: the backup has no reviews matching the current page list.')
          return
        }

        const merge = typeof window.defu === 'function' ? window.defu : null
        window.reviewState.update((state) => {
          const nextPages = { ...state.pages }
          for (const [key, saved] of entries) {
            nextPages[key] = { ...(state.pages[key] || {}), ...saved, page_key: key }
          }
          return {
            ...state,
            ui: merge
              ? merge({}, state.ui, validated.data.ui || {})
              : { ...state.ui, ...(validated.data.ui || {}) },
            globals: {
              ...state.globals,
              ...(validated.data.globals?.reviewer && !state.globals.reviewer
                ? { reviewer: validated.data.globals.reviewer }
                : {}),
              ...(validated.data.globals?.owner && !state.globals.owner
                ? { owner: validated.data.globals.owner }
                : {}),
            },
            pages: nextPages,
          }
        })

        window.ReviewUx.stateSync.applySavedPageState(getCurrentKey())
        window.ReviewUx.refreshUx()
        setText('reviewExportStatus', `Imported ${entries.length} saved page reviews from backup.`)
        if (typeof window.showToast === 'function')
          window.showToast(`Imported ${entries.length} page reviews`, 'success')
      })
      .catch(() => fail('Import failed: could not read the selected file.'))
  }

  function mountBackupControls() {
    const actions = document.querySelector('.review-actions')
    if (!actions || document.getElementById('exportReviewStateBackup')) return

    const backupButton = document.createElement('button')
    backupButton.type = 'button'
    backupButton.className = 'tool-btn secondary-tool'
    backupButton.id = 'exportReviewStateBackup'
    backupButton.textContent = 'Download backup (JSON)'
    actions.appendChild(backupButton)
    backupButton.addEventListener('click', exportReviewStateBackup)

    const importInput = document.createElement('input')
    importInput.type = 'file'
    importInput.accept = 'application/json,.json'
    importInput.id = 'importReviewStateFile'
    importInput.hidden = true
    importInput.addEventListener('change', () => {
      const file = importInput.files?.[0]
      if (file) importReviewStateBackup(file)
      importInput.value = ''
    })

    const importButton = document.createElement('button')
    importButton.type = 'button'
    importButton.className = 'tool-btn secondary-tool'
    importButton.id = 'importReviewStateBackup'
    importButton.textContent = 'Import backup (JSON)'
    actions.appendChild(importButton)
    actions.appendChild(importInput)
    importButton.addEventListener('click', () => importInput.click())
  }

  function clearSavedLocalReviews() {
    const confirmed = window.confirm(
      'Clear all locally saved HHVC review data in this browser? This does not change source files or exported CSVs.'
    )
    if (!confirmed) return

    localStorage.removeItem(window.reviewState.STORAGE_KEY)
    window.ReviewUx.stateSync.clearReviewFieldsForNewPage()
    window.utils.setValue('reviewerInput', '')
    window.ReviewUx.stateSync.updateLocalStorageStatus()
    window.ReviewUx.refreshUx()
    setText('reviewExportStatus', 'Cleared locally saved review data in this browser.')
    if (typeof window.showToast === 'function')
      window.showToast('Local review data cleared', 'info')
  }

  function mountLocalStorageControls() {
    const actions = document.querySelector('.review-actions')
    if (!actions || document.getElementById('exportSavedLocalReviewsCsv')) return

    const exportButton = document.createElement('button')
    exportButton.type = 'button'
    exportButton.className = 'tool-btn secondary-tool'
    exportButton.id = 'exportSavedLocalReviewsCsv'
    exportButton.textContent = 'Export saved local reviews CSV'
    actions.appendChild(exportButton)
    exportButton.addEventListener('click', exportSavedLocalReviewsCsv)

    const clearButton = document.createElement('button')
    clearButton.type = 'button'
    clearButton.className = 'tool-btn danger-tool'
    clearButton.id = 'clearSavedLocalReviews'
    clearButton.textContent = 'Clear local saved reviews'
    actions.appendChild(clearButton)
    clearButton.addEventListener('click', clearSavedLocalReviews)

    const status = document.createElement('p')
    status.id = 'localStorageStatus'
    status.className = 'field-help local-storage-status'
    status.textContent = 'No local review data saved yet.'
    actions.insertAdjacentElement('afterend', status)
  }

  function mountCopySummaryButton() {
    const actions = document.querySelector('.review-actions')
    if (!actions || document.getElementById('copyReviewSummary')) return

    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'tool-btn copy-summary'
    button.id = 'copyReviewSummary'
    button.textContent = 'Copy review summary'
    actions.appendChild(button)

    button.addEventListener('click', () => {
      window.ReviewUx.stateSync.saveCurrentPageToLocalStorage()
      copyText(buildReviewSummary())
        .then(() => {
          const status = document.getElementById('reviewExportStatus')
          if (status) status.textContent = 'Copied review summary to clipboard.'
          if (typeof window.showToast === 'function') {
            window.showToast('Review summary copied', 'success')
          }
        })
        .catch(() => {
          const status = document.getElementById('reviewExportStatus')
          if (status) status.textContent = 'Copy failed. Copy manually instead.'
          if (typeof window.showToast === 'function') {
            window.showToast('Copy failed. Copy manually instead.', 'warn')
          }
        })
    })
  }

  window.ReviewUx = window.ReviewUx || {}
  window.ReviewUx.exportImport = {
    getCurrentReviewSummaryLines,
    buildReviewSummary,
    copyText,
    mountCopySummaryButton,
    exportSavedLocalReviewsCsv,
    exportReviewStateBackup,
    importReviewStateBackup,
    mountBackupControls,
    clearSavedLocalReviews,
    mountLocalStorageControls,
  }
})()
```

- [ ] **Step 2: Add the `<script>` tag in `index.html`**

Find:

```html
    <script src="js/ux-improvements-workspace.js"></script>
    <script src="js/ux-improvements.js"></script>
```

Replace with:

```html
    <script src="js/ux-improvements-workspace.js"></script>
    <script src="js/ux-improvements-export.js"></script>
    <script src="js/ux-improvements.js"></script>
```

- [ ] **Step 3: Delete the moved functions from `js/ux-improvements.js`**

Delete in their entirety: `getCurrentReviewSummaryLines`, `buildReviewSummary`, `copyText`, `exportSavedLocalReviewsCsv`, `exportReviewStateBackup`, `importReviewStateBackup`, `mountBackupControls`, `clearSavedLocalReviews`, `mountLocalStorageControls`, `mountCopySummaryButton`.

- [ ] **Step 4: Rewire remaining bare references and update `init()`**

The only remaining `js/ux-improvements.js` callers of these are inside `init()` (`mountCopySummaryButton()`, `mountBackupControls()`, `mountLocalStorageControls()`). Run:

```bash
sed -i \
  -e 's/\bmountCopySummaryButton(/window.ReviewUx.exportImport.mountCopySummaryButton(/g' \
  -e 's/\bmountBackupControls(/window.ReviewUx.exportImport.mountBackupControls(/g' \
  -e 's/\bmountLocalStorageControls(/window.ReviewUx.exportImport.mountLocalStorageControls(/g' \
  js/ux-improvements.js
```

- [ ] **Step 5: Update the top guard**

```js
  if (!hasValidPageData(DATA) || !window.ReviewUx?.stateSync || !window.ReviewUx?.workspace) return
```

becomes:

```js
  if (
    !hasValidPageData(DATA) ||
    !window.ReviewUx?.stateSync ||
    !window.ReviewUx?.workspace ||
    !window.ReviewUx?.exportImport
  )
    return
```

- [ ] **Step 6: Verify**

Run: `bun run format && bun run validate && bun run test`
Expected: all PASS.

Run: `bun run dev`, confirm: "Copy review summary" copies to clipboard, "Export saved local reviews CSV" downloads a CSV, "Download backup (JSON)" downloads JSON, "Clear local saved reviews" clears storage and refreshes the UI.

- [ ] **Step 7: Commit**

```bash
git add index.html js/ux-improvements.js js/ux-improvements-export.js
git commit -m "$(cat <<'EOF'
Extract summary/export/backup layer into js/ux-improvements-export.js

Moves the review-summary clipboard copy, CSV export, and JSON backup/restore
functions into their own file, exposed via window.ReviewUx.exportImport.
EOF
)"
```

---

### Task 10: Finish the js/ux-improvements.js orchestrator and full regression pass

**Files:**
- Modify: `js/ux-improvements.js` (final trim + `window.ReviewUx.refreshUx` export)

**Interfaces:**
- Produces: `window.ReviewUx.refreshUx` (a plain function reference, consumed by `js/ux-improvements-export.js`'s `importReviewStateBackup` and `clearSavedLocalReviews`, which is why it must be assigned before `init()` runs — but since both consumers only call it from event-handler callbacks, not at parse time, assigning it anywhere in this file's top-level execution is safe).

- [ ] **Step 1: Replace the full contents of `js/ux-improvements.js`**

At this point the file should contain only `refreshUx`, `persistAndRefresh`, `attachRefreshListeners`, `wrapRenderPage`, `restoreInitialPage`, `init`, and the DOMContentLoaded wiring. Verify it now reads exactly as follows (adjust only if your accumulated edits from Tasks 6-9 left it in a different but equivalent state — this is the target, not a diff):

```js
/* Manager review UX/UI enhancements: orchestrator.
   Runs after js/app.js and does not change source page content or review
   export schemas. Composes window.ReviewUx.stateSync/.workspace/.exportImport
   (each in their own file, loaded before this one) into init()/refresh
   wiring. */
;(function improveManagerReviewUx() {
  const DATA = window.HHVC_DATA
  if (
    !hasValidPageData(DATA) ||
    !window.ReviewUx?.stateSync ||
    !window.ReviewUx?.workspace ||
    !window.ReviewUx?.exportImport
  )
    return

  const { debounce, getCurrentKey } = window.utils
  // Rebuilding the dashboard grid/scorecard and page-search list on every
  // keystroke is wasted work while the reviewer is still typing. Debounce the
  // 'input' path; 'change' (fires on blur) still refreshes immediately so the
  // dashboard is never stale once the reviewer moves on.
  const REFRESH_DEBOUNCE_MS = 300

  function refreshUx() {
    window.ReviewUx.workspace.renderStickyBar()
    window.ReviewUx.stateSync.renderPageChecksPanel()
    window.ReviewUx.stateSync.updateLocalStorageStatus()
    window.ReviewUx.workspace.updateDecisionQuickActions()
    document.dispatchEvent(new CustomEvent('hhvc:review-data-changed'))
  }

  function persistAndRefresh() {
    window.ReviewUx.stateSync.saveCurrentPageToLocalStorage()
    refreshUx()
  }

  function attachRefreshListeners() {
    const persistedFields = [
      'urlInput',
      'seoTitleInput',
      'metaDescriptionInput',
      'reviewDecision',
      'reviewerInput',
      'reviewDateInput',
      'reviewNotes',
      'reviewRisks',
      'reviewOwner',
    ]

    const debouncedPersistAndRefresh = debounce(persistAndRefresh, REFRESH_DEBOUNCE_MS)

    for (const id of persistedFields) {
      const el = document.getElementById(id)
      if (!el) continue
      el.addEventListener('input', debouncedPersistAndRefresh)
      el.addEventListener('change', persistAndRefresh)
    }

    document.getElementById('tagToggle')?.addEventListener('change', () => {
      window.reviewState.update((state) => {
        state.ui.show_karl_tags = document.getElementById('tagToggle')?.checked !== false
        state.ui.last_page_key = getCurrentKey()
        return state
      })
      refreshUx()
    })

    // Flush keystrokes still sitting in the debounce window when the tab is
    // reloaded, closed, or backgrounded — otherwise they never reach
    // localStorage ('change' only fires on blur).
    window.addEventListener('pagehide', window.ReviewUx.stateSync.saveCurrentPageToLocalStorage)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden')
        window.ReviewUx.stateSync.saveCurrentPageToLocalStorage()
    })
  }

  function wrapRenderPage() {
    if (typeof window.renderPage !== 'function' || window.renderPage.__uxWrapped) return
    const originalRenderPage = window.renderPage
    window.renderPage = function renderPageWithUxRefresh(key) {
      const result = originalRenderPage.call(this, key)
      window.reviewState.update((state) => {
        state.ui.last_page_key = key
        state.ui.show_karl_tags = document.getElementById('tagToggle')?.checked !== false
        return state
      })
      const applyAndRefresh = () => {
        window.ReviewUx.stateSync.applySavedPageState(key)
        refreshUx()
      }
      // Under View Transitions, renderPage returns a promise that resolves
      // once the new page content is in the DOM; patching earlier would hit
      // the outgoing page's elements.
      if (result && typeof result.then === 'function') result.then(applyAndRefresh)
      else window.setTimeout(applyAndRefresh, 0)
      return result
    }
    window.renderPage.__uxWrapped = true
  }

  function restoreInitialPage() {
    const state = window.reviewState.read()
    const savedKey = state.ui.last_page_key

    if (savedKey && DATA.pages[savedKey] && typeof window.renderPage === 'function') {
      window.renderPage(savedKey)
      return
    }

    window.ReviewUx.stateSync.applySavedPageState(getCurrentKey())
    refreshUx()
  }

  function init() {
    window.ReviewUx.workspace.initWorkspaceTabs()
    window.ReviewUx.workspace.initDecisionQuickActions()
    window.ReviewUx.exportImport.mountCopySummaryButton()
    window.ReviewUx.exportImport.mountBackupControls()
    window.ReviewUx.exportImport.mountLocalStorageControls()
    attachRefreshListeners()
    wrapRenderPage()
    window.ReviewUx.stateSync.applySavedUiPreferences()
    restoreInitialPage()
    refreshUx()
    window.ReviewUx.workspace.maybeShowWorkspaceOnboarding()
    // Defer one refresh so review-queue.js (loaded next) is ready for sticky bar stats.
    window.setTimeout(refreshUx, 0)
  }

  window.ReviewUx.refreshUx = refreshUx

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init)
  } else {
    init()
  }
})()
```

- [ ] **Step 2: Full verification**

```bash
bun run format:check
bun run validate
bun run test
bun run test:e2e
```

Expected: all PASS.

- [ ] **Step 3: Confirm line counts**

```bash
wc -l js/ux-improvements.js js/ux-improvements-state-sync.js js/ux-improvements-workspace.js js/ux-improvements-export.js js/review-state-store.js
```

Expected: `js/ux-improvements.js` ~110-140 lines, `js/ux-improvements-state-sync.js` ~280-310 lines, `js/ux-improvements-workspace.js` ~230-260 lines, `js/ux-improvements-export.js` ~300-330 lines, `js/review-state-store.js` ~90-110 lines.

- [ ] **Step 4: Manual full-flow check**

Run: `bun run dev`, and walk the entire review flow end to end: open a page, edit SEO fields, set a decision, open the workspace, switch tabs, copy the summary, export CSV, export/import JSON backup, clear local reviews, reload and confirm the last-viewed page and its saved fields restore correctly. Console must stay clean throughout.

- [ ] **Step 5: Commit**

```bash
git add js/ux-improvements.js
git commit -m "$(cat <<'EOF'
Finish js/ux-improvements.js orchestrator after the module split

js/ux-improvements.js drops from 1067 to ~120 lines: init()/refresh wiring
only, composing window.ReviewUx.stateSync/.workspace/.exportImport.
EOF
)"
```

---

### Task 11: Extract review-queue.js's shared state and helpers into js/review-queue-state.js

**Files:**
- Create: `js/review-queue-state.js`
- Modify: `index.html`
- Modify: `js/review-queue.js` (remove the moved declarations)

**Interfaces:**
- Consumes: `window.HHVC_DATA`, `window.reviewState`, `window.utils.{getCurrentKey, today, setValue, buildReviewRecord}`.
- Produces: `window.ReviewQueueInternal.state` (shared mutable `{filter, query, sort, selected}` object — every other review-queue file and the orchestrator read/write this same reference) and `window.ReviewQueueInternal.helpers = { QUEUE_PANEL_ID, STALE_DAYS, DEFAULT_STATE, VALID_DECISIONS, toast, actionLabel, actionToastTone, buildActionPatch, getSidebarReviewerName, getSidebarReviewDate, updateLocalReviewForPage, syncSidebarForKey, dispatchReviewFieldChange, writeQueueUiState, restoreQueueUiState, getDecisionForKey, normalize, parseIsoDate, getAgeInDays }`.

This is `window.ReviewQueueInternal` — deliberately capital-`Q` and distinct from the existing public, lowercase-`q` `window.reviewQueue` (assembled by the orchestrator in Task 15) to avoid any case-only naming collision.

- [ ] **Step 1: Create `js/review-queue-state.js`**

```js
/* Cross-page review queue: shared mutable state, action helpers, sidebar
   sync, and queue UI persistence. Loads first among the review-queue-*.js
   files, right where js/review-queue.js used to sit in index.html. */
;(function mountReviewQueueState() {
  const DATA = window.HHVC_DATA
  if (!DATA || !DATA.pages || !DATA.order || !window.reviewState) return

  const QUEUE_PANEL_ID = 'reviewWorkspaceOverview'
  const STALE_DAYS = 3
  const DEFAULT_STATE = {
    filter: 'All',
    query: '',
    sort: 'priority',
  }

  const { getCurrentKey } = window.utils
  const readLocalState = window.reviewState.read
  const updateLocalState = window.reviewState.update

  const VALID_DECISIONS = new Set([
    'Approved',
    'Approved with edits',
    'Revise and resubmit',
    'Blocked',
    'Needs review',
  ])

  const ACTION_LABELS = {
    'assign-me': 'Assign to me',
    'needs-review': 'Needs review',
    revise: 'Revise and resubmit',
    blocked: 'Blocked',
    approved: 'Approved',
    'approved-with-edits': 'Approved with edits',
  }

  function toast(message, tone = 'success') {
    if (typeof window.showToast === 'function') {
      window.showToast(message, tone)
    }
  }

  function actionLabel(action) {
    return ACTION_LABELS[action] || action
  }

  function actionToastTone(action) {
    if (action === 'blocked' || action === 'revise') return 'warn'
    if (action === 'needs-review') return 'info'
    return 'success'
  }

  function buildActionPatch(action, suggestedOwner, reviewDate, currentSaved) {
    if (action === 'assign-me') {
      if (currentSaved.follow_up_owner === suggestedOwner) return null
      return { follow_up_owner: suggestedOwner, review_date: reviewDate }
    }

    const decision = ACTION_LABELS[action]
    if (!decision || !VALID_DECISIONS.has(decision)) return null

    if (currentSaved.decision === decision) return null

    return {
      decision,
      follow_up_owner: currentSaved.follow_up_owner || suggestedOwner,
      review_date: reviewDate,
    }
  }

  function getSidebarReviewerName() {
    const v = document.getElementById('reviewerInput')?.value
    const trimmed = String(v || '').trim()
    return trimmed || 'Me'
  }

  function getSidebarReviewDate() {
    const v = document.getElementById('reviewDateInput')?.value
    const trimmed = String(v || '').trim()
    return trimmed || window.utils.today()
  }

  function updateLocalReviewForPage(pageKey, patch) {
    const page = DATA.pages[pageKey] || {}
    let nextSaved

    window.reviewState.update((localState) => {
      const existing = localState.pages[pageKey] || {}
      const defaults = window.utils.buildReviewRecord(page, pageKey, {
        review_date: getSidebarReviewDate(),
        reviewer: document.getElementById('reviewerInput')?.value || '',
      })
      nextSaved = {
        ...defaults,
        ...existing,
        ...patch,
        updated_at: new Date().toISOString(),
      }
      localState.pages[pageKey] = nextSaved
      return localState
    })

    return nextSaved
  }

  function syncSidebarForKey(pageKey, saved) {
    if (pageKey !== getCurrentKey()) return
    window.utils.setValue('reviewDecision', saved.decision || 'Needs review')
    window.utils.setValue('reviewOwner', saved.follow_up_owner || '')
    window.utils.setValue('reviewNotes', saved.notes || '')
    window.utils.setValue('reviewRisks', saved.risks_or_blockers || '')
    window.utils.setValue('reviewDateInput', saved.review_date || getSidebarReviewDate())
    if (!String(document.getElementById('reviewerInput')?.value || '').trim())
      window.utils.setValue('reviewerInput', saved.reviewer || '')
  }

  function dispatchReviewFieldChange(id) {
    const el = document.getElementById(id)
    if (!el) return
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
  }

  const state = {
    ...DEFAULT_STATE,
    selected: new Set(),
  }

  function writeQueueUiState() {
    try {
      const raw = localStorage.getItem(window.reviewState.STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (!parsed || parsed.version !== window.reviewState.STORAGE_VERSION) return
      }
    } catch {
      return
    }

    updateLocalState((localState) => {
      localState.ui.overview = {
        filter: state.filter,
        query: state.query,
        sort: state.sort,
      }
      return localState
    })
  }

  function restoreQueueUiState() {
    const overviewUi = readLocalState().ui?.overview || {}
    state.filter = overviewUi.filter || DEFAULT_STATE.filter
    state.query = overviewUi.query || DEFAULT_STATE.query
    state.sort = overviewUi.sort || DEFAULT_STATE.sort
  }

  function getDecisionForKey(pageKey, savedPages) {
    const saved = savedPages[pageKey]
    if (!saved) return 'Needs review'
    return saved.decision || 'Needs review'
  }

  function normalize(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
  }

  function parseIsoDate(value) {
    if (!value) return null
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? null : date
  }

  function getAgeInDays(value) {
    const date = parseIsoDate(value)
    if (!date) return null
    const ms = Date.now() - date.getTime()
    return ms < 0 ? 0 : Math.floor(ms / 86400000)
  }

  window.ReviewQueueInternal = window.ReviewQueueInternal || {}
  window.ReviewQueueInternal.state = state
  window.ReviewQueueInternal.helpers = {
    QUEUE_PANEL_ID,
    STALE_DAYS,
    DEFAULT_STATE,
    VALID_DECISIONS,
    toast,
    actionLabel,
    actionToastTone,
    buildActionPatch,
    getSidebarReviewerName,
    getSidebarReviewDate,
    updateLocalReviewForPage,
    syncSidebarForKey,
    dispatchReviewFieldChange,
    writeQueueUiState,
    restoreQueueUiState,
    getDecisionForKey,
    normalize,
    parseIsoDate,
    getAgeInDays,
  }
})()
```

- [ ] **Step 2: Replace the old single `<script>` tag in `index.html`**

Find:

```html
    <script src="js/vendor/fuse.js"></script>
    <script src="js/review-queue.js"></script>
    <script src="js/dashboard-guidance.js"></script>
```

Replace with:

```html
    <script src="js/vendor/fuse.js"></script>
    <script src="js/review-queue-state.js"></script>
    <script src="js/review-queue.js"></script>
    <script src="js/dashboard-guidance.js"></script>
```

(`js/review-queue-rows.js`, `js/review-queue-render.js`, `js/review-queue-import.js` are inserted between `js/review-queue-state.js` and `js/review-queue.js` in Tasks 12-14.)

- [ ] **Step 3: Delete the moved declarations from `js/review-queue.js`**

Delete: the `QUEUE_PANEL_ID`, `STALE_DAYS`, `DEFAULT_STATE` constants; the `window.utils` destructure line's `parseCsv` remains needed later (Task 14) but `getCurrentKey` and the rest move — leave the destructure alone for now, Task 15 does the final cleanup; the `readLocalState`/`updateLocalState` local aliases; `VALID_DECISIONS`, `ACTION_LABELS`; the functions `toast`, `actionLabel`, `actionToastTone`, `buildActionPatch`, `getSidebarReviewerName`, `getSidebarReviewDate`, `updateLocalReviewForPage`, `syncSidebarForKey`, `dispatchReviewFieldChange`; the `state` object declaration; `writeQueueUiState`, `restoreQueueUiState`, `getDecisionForKey`, `normalize`, `parseIsoDate`, `getAgeInDays`.

At this intermediate point, `js/review-queue.js` will have dangling references to all of these from its remaining functions (`getQueueRows`, `getPriorityRank`, etc. — all moving in Task 12). Do not attempt to fix those references yet or run verification yet; continue directly into Task 12, which removes those functions from this file entirely (they move to `js/review-queue-rows.js`, already written against the `window.ReviewQueueInternal.helpers` namespace).

---

### Task 12: Extract review-queue.js's row/filter/action logic into js/review-queue-rows.js

**Files:**
- Create: `js/review-queue-rows.js`
- Modify: `index.html`
- Modify: `js/review-queue.js` (remove the moved functions — completes Task 11's cleanup)

**Interfaces:**
- Consumes: `window.ReviewQueueInternal.state`, `window.ReviewQueueInternal.helpers.*` (Task 11), `window.reviewChecks.getRuleResultsFor` (existing public contract from `js/ux-improvements-state-sync.js`), `window.reviewState.read`, `window.utils.getCurrentKey`, global `Fuse` (from `js/vendor/fuse.js`).
- Produces: `window.ReviewQueueInternal.rows = { getPriorityRank, isUnassigned, getQueueRows, isFailingChecks, getQueueStats, matchesFilter, compareRows, getVisibleRows, getFilteredKeys, getSelectedKeys, pruneSelection, toggleSelected, selectAllVisible, clearSelection, applyQueueAction, getActionTargets, getNextNeedsReviewKey, getAdjacentKey }`.
- **Intentional circular reference:** `applyQueueAction` calls `window.ReviewQueueInternal.render.renderReviewQueue()`, which doesn't exist yet when this file loads (`js/review-queue-render.js` loads after it, in Task 13). This is safe because the reference is inside a function body, evaluated only when a user actually triggers a queue action — by which time `js/review-queue-render.js` has already loaded and populated `.render`. Never destructure this reference into a top-of-file const; always call it fully-qualified at the call site.

- [ ] **Step 1: Create `js/review-queue-rows.js`**

```js
/* Cross-page review queue: row computation, filtering/sorting, selection,
   and bulk/single queue actions. Loads after js/review-queue-state.js. */
;(function mountReviewQueueRows() {
  const DATA = window.HHVC_DATA
  if (!DATA || !DATA.pages || !DATA.order || !window.ReviewQueueInternal?.helpers) return

  const state = window.ReviewQueueInternal.state
  const {
    STALE_DAYS,
    getSidebarReviewerName,
    getSidebarReviewDate,
    updateLocalReviewForPage,
    syncSidebarForKey,
    dispatchReviewFieldChange,
    getDecisionForKey,
    normalize,
    parseIsoDate,
    getAgeInDays,
    toast,
    actionLabel,
    actionToastTone,
    buildActionPatch,
  } = window.ReviewQueueInternal.helpers

  const { getCurrentKey } = window.utils
  const readLocalState = window.reviewState.read

  function getPriorityRank(row) {
    if (row.decision === 'Blocked') return 5
    if (row.decision === 'Revise and resubmit') return 4
    if (row.decision === 'Needs review' && isUnassigned(row)) return 3
    if (row.isStale) return 2
    if (row.decision === 'Needs review') return 1
    return 0
  }

  function isUnassigned(row) {
    return (
      row.decision !== 'Approved' &&
      row.decision !== 'Approved with edits' &&
      !normalize(row.followUpOwner)
    )
  }

  function getQueueRows() {
    const savedPages = readLocalState().pages
    return DATA.order.map(([key]) => {
      const page = DATA.pages[key] || {}
      const saved = savedPages[key]
      const decision = getDecisionForKey(key, savedPages)
      const updatedAt = saved?.updated_at || null
      const ageDays = getAgeInDays(updatedAt)
      const notes = saved?.notes || ''
      const blockers = saved?.risks_or_blockers || ''
      const followUpOwner = saved?.follow_up_owner || ''
      const reviewer = saved?.reviewer || ''
      const isCurrentPage = key === getCurrentKey()
      const rules =
        window.reviewChecks?.getRuleResultsFor?.(page, { useEditor: isCurrentPage }) || []
      const checksPassed = rules.filter((rule) => rule.pass).length
      const checksTotal = rules.length
      const searchText = normalize(
        [
          key,
          page.title || '',
          page.type || '',
          page.summary || '',
          decision,
          followUpOwner,
          reviewer,
          notes,
          blockers,
        ].join(' ')
      )

      return {
        key,
        title: page.title || key,
        type: page.type || '',
        summary: page.summary || '',
        decision,
        updatedAt,
        reviewDate: saved?.review_date || '',
        followUpOwner,
        reviewer,
        notes,
        blockers,
        ageDays,
        isStale: ageDays !== null && ageDays >= STALE_DAYS,
        checksPassed,
        checksTotal,
        isCurrentPage,
        searchText,
      }
    })
  }

  function isFailingChecks(row) {
    return row.checksTotal > 0 && row.checksPassed < row.checksTotal
  }

  function getQueueStats() {
    const rows = getQueueRows()
    const total = rows.length
    const byDecision = {
      'Needs review': 0,
      Approved: 0,
      'Approved with edits': 0,
      'Revise and resubmit': 0,
      Blocked: 0,
    }

    for (const row of rows) {
      byDecision[row.decision] = (byDecision[row.decision] || 0) + 1
    }

    const reviewed = rows.filter((row) => row.decision !== 'Needs review').length
    const stale = rows.filter((row) => row.isStale).length
    const unassigned = rows.filter(isUnassigned).length
    const blocked = rows.filter(
      (row) => row.decision === 'Blocked' || row.decision === 'Revise and resubmit'
    ).length
    const failingChecks = rows.filter(isFailingChecks).length

    return { total, reviewed, stale, unassigned, blocked, failingChecks, byDecision }
  }

  function matchesFilter(row) {
    if (state.filter === 'All') return true
    if (state.filter === 'Needs review') return row.decision === 'Needs review'
    if (state.filter === 'Approved') {
      return row.decision === 'Approved' || row.decision === 'Approved with edits'
    }
    if (state.filter === 'Blocked') {
      return row.decision === 'Blocked' || row.decision === 'Revise and resubmit'
    }
    if (state.filter === 'Unassigned') return isUnassigned(row)
    if (state.filter === 'Stale') return row.isStale
    if (state.filter === 'Failing checks') return isFailingChecks(row)
    return true
  }

  function compareRows(a, b) {
    if (state.sort === 'updated') {
      const left = parseIsoDate(a.updatedAt)?.getTime() || 0
      const right = parseIsoDate(b.updatedAt)?.getTime() || 0
      return right - left || a.title.localeCompare(b.title)
    }

    if (state.sort === 'title') return a.title.localeCompare(b.title)

    if (state.sort === 'type') {
      return a.type.localeCompare(b.type) || a.title.localeCompare(b.title)
    }

    if (state.sort === 'checks') {
      const failingA = a.checksTotal - a.checksPassed
      const failingB = b.checksTotal - b.checksPassed
      return failingB - failingA || a.title.localeCompare(b.title)
    }

    const priorityDiff = getPriorityRank(b) - getPriorityRank(a)
    if (priorityDiff !== 0) return priorityDiff

    const ageDiff = (b.ageDays || -1) - (a.ageDays || -1)
    if (ageDiff !== 0) return ageDiff

    return a.title.localeCompare(b.title)
  }

  function getVisibleRows() {
    const filtered = getQueueRows().filter(matchesFilter)
    const query = state.query.trim()
    if (!query) return filtered.sort(compareRows)
    if (typeof Fuse === 'undefined') {
      const normalized = normalize(query)
      return filtered.filter((row) => row.searchText.includes(normalized)).sort(compareRows)
    }
    const fuse = new Fuse(filtered, {
      keys: [
        'key',
        'title',
        'type',
        'summary',
        'decision',
        'followUpOwner',
        'reviewer',
        'notes',
        'blockers',
      ],
      threshold: 0.4,
      ignoreLocation: true,
    })
    return fuse
      .search(query)
      .map((result) => result.item)
      .sort(compareRows)
  }

  function getFilteredKeys() {
    return getVisibleRows().map((row) => row.key)
  }

  function getSelectedKeys() {
    return [...state.selected].filter((key) => DATA.pages[key])
  }

  function pruneSelection(visibleKeys) {
    for (const key of [...state.selected]) {
      if (!DATA.pages[key]) state.selected.delete(key)
    }
  }

  function toggleSelected(key) {
    if (!DATA.pages[key]) return
    if (state.selected.has(key)) state.selected.delete(key)
    else state.selected.add(key)
  }

  function selectAllVisible() {
    for (const key of getFilteredKeys()) state.selected.add(key)
  }

  function clearSelection() {
    state.selected.clear()
  }

  function applyQueueAction(keys, action, options = {}) {
    const keyList = (Array.isArray(keys) ? keys : [keys]).filter((key) => DATA.pages[key])
    if (!keyList.length) return 0

    const suggestedOwner = getSidebarReviewerName()
    const reviewDate = getSidebarReviewDate()
    const fullState = readLocalState()
    let currentKeySaved = null
    let updatedCount = 0

    for (const key of keyList) {
      const currentSaved = fullState.pages[key] || {}
      const patch = buildActionPatch(action, suggestedOwner, reviewDate, currentSaved)
      if (!patch) continue
      const saved = updateLocalReviewForPage(key, patch)
      if (!saved || saved.updated_at === currentSaved.updated_at) continue
      updatedCount += 1
      if (key === getCurrentKey()) currentKeySaved = saved
    }

    if (currentKeySaved) {
      syncSidebarForKey(getCurrentKey(), currentKeySaved)
      if (!options.skipSidebarEvents) {
        dispatchReviewFieldChange('reviewDecision')
        dispatchReviewFieldChange('reviewOwner')
      }
    }

    document.dispatchEvent(new CustomEvent('hhvc:review-data-changed'))
    // Intentional circular reference: js/review-queue-render.js loads after
    // this file but defines .render before any user interaction can reach
    // this call — see the "Intentional circular reference" note in Task 12.
    window.ReviewQueueInternal.render.renderReviewQueue()

    if (!options.silent && updatedCount) {
      const label = actionLabel(action)
      toast(
        updatedCount === 1 ? `${label}` : `${label} · ${updatedCount} pages`,
        actionToastTone(action)
      )
    }

    return updatedCount
  }

  function getActionTargets(preferredKey) {
    const selected = getSelectedKeys()
    if (selected.length) return selected
    if (preferredKey && DATA.pages[preferredKey]) return [preferredKey]
    const current = getCurrentKey()
    return DATA.pages[current] ? [current] : []
  }

  function getNextNeedsReviewKey() {
    const rows = getQueueRows().sort(compareRows)
    const currentIndex = rows.findIndex((row) => row.key === getCurrentKey())
    const afterCurrent = rows.slice(currentIndex + 1).find((row) => row.decision === 'Needs review')
    if (afterCurrent) return afterCurrent.key
    return rows.find((row) => row.decision === 'Needs review')?.key || null
  }

  function getAdjacentKey(direction, filter) {
    const originalFilter = state.filter
    const keys =
      filter && filter !== 'All'
        ? (() => {
            state.filter = filter
            const nextKeys = getFilteredKeys()
            state.filter = originalFilter
            return nextKeys
          })()
        : getFilteredKeys()
    const currentKey = getCurrentKey()
    const index = keys.indexOf(currentKey)

    if (index === -1) {
      return direction > 0 ? keys[0] : keys[keys.length - 1]
    }

    const nextIndex = index + direction
    if (nextIndex < 0 || nextIndex >= keys.length) return null
    return keys[nextIndex]
  }

  window.ReviewQueueInternal.rows = {
    getPriorityRank,
    isUnassigned,
    getQueueRows,
    isFailingChecks,
    getQueueStats,
    matchesFilter,
    compareRows,
    getVisibleRows,
    getFilteredKeys,
    getSelectedKeys,
    pruneSelection,
    toggleSelected,
    selectAllVisible,
    clearSelection,
    applyQueueAction,
    getActionTargets,
    getNextNeedsReviewKey,
    getAdjacentKey,
  }
})()
```

- [ ] **Step 2: Add the `<script>` tag in `index.html`**

Find:

```html
    <script src="js/review-queue-state.js"></script>
    <script src="js/review-queue.js"></script>
```

Replace with:

```html
    <script src="js/review-queue-state.js"></script>
    <script src="js/review-queue-rows.js"></script>
    <script src="js/review-queue.js"></script>
```

- [ ] **Step 3: Delete the moved functions from `js/review-queue.js`**

Delete in their entirety: `getPriorityRank`, `isUnassigned`, `getQueueRows`, `isFailingChecks`, `getQueueStats`, `matchesFilter`, `compareRows`, `getVisibleRows`, `getFilteredKeys`, `getSelectedKeys`, `pruneSelection`, `toggleSelected`, `selectAllVisible`, `clearSelection`, `applyQueueAction`, `getActionTargets`, `getNextNeedsReviewKey`, `getAdjacentKey`.

This completes Task 11's deferred cleanup — `js/review-queue.js` no longer has any dangling references to `window.ReviewQueueInternal.helpers` members, since every function that used them has now moved out. Do not run verification yet; `renderReviewQueue`, `importReviewsFromCsvText`, and the event handlers still reference functions that haven't moved yet (Tasks 13-14) or need namespace-qualifying (Task 15).

---

### Task 13: Extract review-queue.js's rendering into js/review-queue-render.js

**Files:**
- Create: `js/review-queue-render.js`
- Modify: `index.html`
- Modify: `js/review-queue.js` (remove the moved functions)

**Interfaces:**
- Consumes: `window.ReviewQueueInternal.state`, `window.ReviewQueueInternal.helpers.{QUEUE_PANEL_ID, STALE_DAYS, getSidebarReviewerName, normalize}`, `window.ReviewQueueInternal.rows.{getQueueStats, getVisibleRows, getSelectedKeys, pruneSelection}`, `window.utils.{escapeHtml, getStatusChipClass, getCurrentKey}`.
- Produces: `window.ReviewQueueInternal.render = { formatAgeLabel, renderQueueStats, renderBulkBar, captureSearchFocus, restoreSearchFocus, syncSelectionUi, renderReviewQueue }`.

- [ ] **Step 1: Create `js/review-queue-render.js`**

```js
/* Cross-page review queue: rendering. Loads after js/review-queue-rows.js. */
;(function mountReviewQueueRender() {
  const DATA = window.HHVC_DATA
  if (!DATA || !DATA.pages || !DATA.order || !window.ReviewQueueInternal?.rows) return

  const { escapeHtml, getStatusChipClass, getCurrentKey } = window.utils
  const state = window.ReviewQueueInternal.state
  const { QUEUE_PANEL_ID, STALE_DAYS, getSidebarReviewerName, normalize } =
    window.ReviewQueueInternal.helpers
  const { getQueueStats, getVisibleRows, getSelectedKeys, pruneSelection } =
    window.ReviewQueueInternal.rows

  function formatAgeLabel(row) {
    if (row.ageDays === null) return 'Not reviewed yet'
    if (row.ageDays === 0) return 'Updated today'
    if (row.ageDays === 1) return 'Updated 1 day ago'
    return `Updated ${row.ageDays} days ago`
  }

  function renderQueueStats(stats, visibleCount) {
    return `
      <section class="review-queue-overview">
        <div class="review-queue-kpis" aria-label="Queue metrics">
          <div class="review-queue-kpi">
            <span class="review-queue-kpi-label">Visible</span>
            <strong class="review-queue-kpi-value">${visibleCount}</strong>
          </div>
          <div class="review-queue-kpi">
            <span class="review-queue-kpi-label">Blocked</span>
            <strong class="review-queue-kpi-value">${stats.blocked}</strong>
          </div>
          <div class="review-queue-kpi">
            <span class="review-queue-kpi-label">Unassigned</span>
            <strong class="review-queue-kpi-value">${stats.unassigned}</strong>
          </div>
          <div class="review-queue-kpi">
            <span class="review-queue-kpi-label">Stale ${STALE_DAYS}+d</span>
            <strong class="review-queue-kpi-value">${stats.stale}</strong>
          </div>
        </div>
      </section>
    `
  }

  function renderBulkBar(selectedCount, visibleCount) {
    const allVisibleSelected = visibleCount > 0 && selectedCount === visibleCount
    return `
      <section class="review-queue-bulk" aria-label="Bulk queue actions">
        <div class="review-queue-bulk-main">
          <label class="review-queue-select-all">
            <input
              type="checkbox"
              id="reviewQueueSelectAll"
              ${allVisibleSelected ? 'checked' : ''}
              ${visibleCount ? '' : 'disabled'}
            />
            <span>Select all visible</span>
          </label>
          <span class="review-queue-bulk-count">${selectedCount} selected</span>
          <button type="button" class="review-queue-action" data-queue-select="clear"${selectedCount ? '' : ' disabled'}>Clear</button>
        </div>
        <div class="review-queue-bulk-actions" role="group" aria-label="Apply to selected pages">
          <button type="button" class="review-queue-action" data-queue-bulk-action="assign-me"${selectedCount ? '' : ' disabled'}>Assign to me</button>
          <button type="button" class="review-queue-action" data-queue-bulk-action="needs-review"${selectedCount ? '' : ' disabled'}>Needs review</button>
          <button type="button" class="review-queue-action" data-queue-bulk-action="revise"${selectedCount ? '' : ' disabled'}>Revise</button>
          <button type="button" class="review-queue-action" data-queue-bulk-action="blocked"${selectedCount ? '' : ' disabled'}>Blocked</button>
          <button type="button" class="review-queue-action" data-queue-bulk-action="approved"${selectedCount ? '' : ' disabled'}>Approve</button>
          <button type="button" class="review-queue-action" data-queue-bulk-action="approved-with-edits"${selectedCount ? '' : ' disabled'}>Approve w/ edits</button>
        </div>
        <div class="review-queue-import">
          <button type="button" class="review-queue-action" data-queue-import="csv">Import CSV</button>
        </div>
      </section>
    `
  }

  function captureSearchFocus() {
    const active = document.activeElement
    if (!active || active.id !== 'reviewQueueSearch') return null
    return {
      selectionStart: active.selectionStart,
      selectionEnd: active.selectionEnd,
    }
  }

  function restoreSearchFocus(snapshot) {
    if (!snapshot) return
    const input = document.getElementById('reviewQueueSearch')
    if (!input) return
    input.focus()
    try {
      input.setSelectionRange(snapshot.selectionStart, snapshot.selectionEnd)
    } catch {
      // Some browsers disallow setSelectionRange on search inputs; focus alone is fine.
    }
  }

  function syncSelectionUi() {
    const selectedCount = getSelectedKeys().length
    const visibleRows = getVisibleRows()
    const visibleKeys = visibleRows.map((row) => row.key)
    const allVisibleSelected =
      visibleKeys.length > 0 && visibleKeys.every((key) => state.selected.has(key))

    const selectAllCheckbox = document.getElementById('reviewQueueSelectAll')
    if (selectAllCheckbox) {
      selectAllCheckbox.checked = allVisibleSelected
      if (visibleKeys.length > 0) {
        selectAllCheckbox.removeAttribute('disabled')
      } else {
        selectAllCheckbox.setAttribute('disabled', '')
      }
    }

    const bulkCountSpan = document.querySelector('.review-queue-bulk-count')
    if (bulkCountSpan) {
      bulkCountSpan.textContent = `${selectedCount} selected`
    }

    const buttons = document.querySelectorAll(
      '[data-queue-select="clear"], [data-queue-bulk-action]'
    )
    buttons.forEach((btn) => {
      if (selectedCount === 0) {
        btn.setAttribute('disabled', '')
      } else {
        btn.removeAttribute('disabled')
      }
    })

    const rows = document.querySelectorAll('.review-queue-table-row[data-page-key]')
    rows.forEach((row) => {
      const key = row.getAttribute('data-page-key')
      const isSelected = state.selected.has(key)
      row.classList.toggle('is-selected', isSelected)

      const checkbox = row.querySelector('[data-queue-select-key]')
      if (checkbox) {
        checkbox.checked = isSelected
      }
    })
  }

  function renderReviewQueue() {
    const panel = document.getElementById(QUEUE_PANEL_ID)
    if (!panel) return

    const searchFocus = captureSearchFocus()
    const stats = getQueueStats()
    const rows = getVisibleRows()
    const visibleKeys = rows.map((row) => row.key)
    pruneSelection(visibleKeys)
    const selectedCount = getSelectedKeys().length
    const currentKey = getCurrentKey()
    const progressPct = stats.total ? Math.round((stats.reviewed / stats.total) * 100) : 0

    const filterButtons = [
      { id: 'All', label: `All (${stats.total})` },
      { id: 'Needs review', label: `Needs review (${stats.byDecision['Needs review'] || 0})` },
      {
        id: 'Approved',
        label: `Approved (${(stats.byDecision.Approved || 0) + (stats.byDecision['Approved with edits'] || 0)})`,
      },
      { id: 'Blocked', label: `Blocked (${stats.blocked})` },
      { id: 'Unassigned', label: `Unassigned (${stats.unassigned})` },
      { id: 'Stale', label: `Stale (${stats.stale})` },
      { id: 'Failing checks', label: `Failing checks (${stats.failingChecks})` },
    ]

    panel.innerHTML = `
      <section class="review-queue">
        <header class="review-queue-header">
          <div>
            <h3>Overview</h3>
            <p class="review-queue-subtitle">Triage every page by decision, checks, ownership, and staleness. Use <strong>Open</strong> to switch pages (rows no longer navigate on click). Press <kbd>1</kbd> for this tab or <kbd>?</kbd> for all shortcuts.</p>
          </div>
          <div class="review-queue-progress" aria-label="Review progress">
            <div class="review-queue-progress-bar">
              <span class="review-queue-progress-fill" style="width: ${progressPct}%"></span>
            </div>
            <span class="review-queue-progress-label">${stats.reviewed}/${stats.total} reviewed</span>
          </div>
        </header>
        <div class="review-queue-stats" aria-label="Decision breakdown">
          <span class="status-chip warn">Needs review ${stats.byDecision['Needs review'] || 0}</span>
          <span class="status-chip pass">Approved ${stats.byDecision.Approved || 0}</span>
          <span class="status-chip warn">Edits ${stats.byDecision['Approved with edits'] || 0}</span>
          <span class="status-chip fail">Revise ${stats.byDecision['Revise and resubmit'] || 0}</span>
          <span class="status-chip fail">Blocked ${stats.byDecision.Blocked || 0}</span>
          <button type="button" class="review-queue-action" data-queue-next-needs-review="true">Next needs review</button>
        </div>
        ${renderQueueStats(stats, rows.length)}
        <div class="review-queue-toolbar" aria-label="Queue controls">
          <label class="review-queue-search">
            <span class="review-queue-control-label">Search queue</span>
            <input
              id="reviewQueueSearch"
              type="search"
              placeholder="Search title, type, owner, notes, blockers, or page key"
              value="${escapeHtml(state.query)}"
            />
          </label>
          <label class="review-queue-sort">
            <span class="review-queue-control-label">Sort by</span>
            <select id="reviewQueueSort">
              <option value="priority"${state.sort === 'priority' ? ' selected' : ''}>Risk priority</option>
              <option value="checks"${state.sort === 'checks' ? ' selected' : ''}>Checks (failing first)</option>
              <option value="updated"${state.sort === 'updated' ? ' selected' : ''}>Last updated</option>
              <option value="title"${state.sort === 'title' ? ' selected' : ''}>Title</option>
              <option value="type"${state.sort === 'type' ? ' selected' : ''}>Page type</option>
            </select>
          </label>
        </div>
        <div class="review-queue-filters" role="group" aria-label="Filter review queue">
          ${filterButtons
            .map(
              (button) => `
            <button
              type="button"
              class="review-queue-filter"
              data-queue-filter="${escapeHtml(button.id)}"
              aria-pressed="${state.filter === button.id ? 'true' : 'false'}"
            >${escapeHtml(button.label)}</button>
          `
            )
            .join('')}
        </div>
        ${renderBulkBar(selectedCount, rows.length)}
        ${
          rows.length
            ? `
          <div class="review-queue-table-wrap">
            <table class="review-queue-table" aria-label="Pages in review overview">
              <thead>
                <tr>
                  <th scope="col"></th>
                  <th scope="col">Page</th>
                  <th scope="col">Checks</th>
                  <th scope="col">Decision</th>
                  <th scope="col">Owner</th>
                  <th scope="col">Updated</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                ${rows
                  .map((row) => {
                    const chipClass = getStatusChipClass(row.decision)
                    const ownerLabel = row.followUpOwner || 'No owner'
                    const notesLabel = row.notes ? 'Notes saved' : 'No notes'
                    const ageChipClass = row.isStale
                      ? 'fail'
                      : row.ageDays === null
                        ? 'warn'
                        : 'pass'
                    const checksChipClass = row.checksPassed === row.checksTotal ? 'pass' : 'warn'
                    const checksLabel = row.isCurrentPage
                      ? `${row.checksPassed}/${row.checksTotal} live`
                      : `${row.checksPassed}/${row.checksTotal}`
                    const suggestedOwner = getSidebarReviewerName()
                    const isOwnerAssigned =
                      normalize(row.followUpOwner) === normalize(suggestedOwner) &&
                      !!row.followUpOwner
                    const isSelected = state.selected.has(row.key)

                    return `
                  <tr
                    class="review-queue-table-row${row.key === currentKey ? ' is-current' : ''}${isSelected ? ' is-selected' : ''}"
                    data-page-key="${escapeHtml(row.key)}"
                  >
                    <td class="review-queue-table-select">
                      <label class="review-queue-checkbox" aria-label="Select ${escapeHtml(row.title)}">
                        <input
                          type="checkbox"
                          data-queue-select-key="${escapeHtml(row.key)}"
                          ${isSelected ? 'checked' : ''}
                        />
                      </label>
                    </td>
                    <td class="review-queue-table-page">
                      <span class="review-queue-row-title">${escapeHtml(row.title)}</span>
                      <span class="review-queue-row-meta">${escapeHtml(row.type || 'Page')} · ${escapeHtml(row.key)}</span>
                      <span class="review-queue-row-detail">
                        <span>${escapeHtml(row.reviewer || 'No reviewer')}</span>
                      </span>
                      <span class="review-queue-row-tags">
                        ${row.notes ? `<span class="status-chip">${escapeHtml(notesLabel)}</span>` : ''}
                        ${row.blockers ? '<span class="status-chip fail">Blockers logged</span>' : ''}
                      </span>
                    </td>
                    <td class="review-queue-table-checks">
                      <span class="status-chip ${checksChipClass}">${escapeHtml(checksLabel)}</span>
                    </td>
                    <td class="review-queue-table-decision">
                      <span class="status-chip ${chipClass}">${escapeHtml(row.decision)}</span>
                      ${row.followUpOwner ? '' : '<span class="status-chip warn">Needs owner</span>'}
                    </td>
                    <td class="review-queue-table-owner">${escapeHtml(ownerLabel)}</td>
                    <td class="review-queue-table-updated">
                      <span class="status-chip ${ageChipClass}">${escapeHtml(formatAgeLabel(row))}</span>
                    </td>
                    <td class="review-queue-table-actions">
                      <span class="review-queue-actions" aria-label="Queue actions">
                        <button type="button" class="review-queue-action" data-queue-action="assign-me"${isOwnerAssigned ? ' disabled' : ''}>Assign to me</button>
                        <button type="button" class="review-queue-action" data-queue-action="needs-review"${row.decision === 'Needs review' ? ' disabled' : ''}>Needs review</button>
                        <button type="button" class="review-queue-action" data-queue-action="revise"${row.decision === 'Revise and resubmit' ? ' disabled' : ''}>Revise</button>
                        <button type="button" class="review-queue-action" data-queue-action="blocked"${row.decision === 'Blocked' ? ' disabled' : ''}>Blocked</button>
                        <button type="button" class="review-queue-action" data-queue-action="approved"${row.decision === 'Approved' ? ' disabled' : ''}>Approve</button>
                        <button type="button" class="review-queue-action" data-queue-action="approved-with-edits"${row.decision === 'Approved with edits' ? ' disabled' : ''}>Approve w/ edits</button>
                        <button type="button" class="review-queue-action" data-queue-action="open">Open</button>
                      </span>
                    </td>
                  </tr>
                `
                  })
                  .join('')}
              </tbody>
            </table>
          </div>
        `
            : `
          <aside class="review-queue-empty">
            <p>No pages match the current filter and search.</p>
            <button type="button" class="review-queue-filter" data-queue-reset="true">Clear queue filters</button>
          </aside>
        `
        }
      </section>
    `

    restoreSearchFocus(searchFocus)
  }

  window.ReviewQueueInternal.render = {
    formatAgeLabel,
    renderQueueStats,
    renderBulkBar,
    captureSearchFocus,
    restoreSearchFocus,
    syncSelectionUi,
    renderReviewQueue,
  }
})()
```

- [ ] **Step 2: Add the `<script>` tag in `index.html`**

Find:

```html
    <script src="js/review-queue-state.js"></script>
    <script src="js/review-queue-rows.js"></script>
    <script src="js/review-queue.js"></script>
```

Replace with:

```html
    <script src="js/review-queue-state.js"></script>
    <script src="js/review-queue-rows.js"></script>
    <script src="js/review-queue-render.js"></script>
    <script src="js/review-queue.js"></script>
```

- [ ] **Step 3: Delete the moved functions from `js/review-queue.js`**

Delete in their entirety: `formatAgeLabel`, `renderQueueStats`, `renderBulkBar`, `captureSearchFocus`, `restoreSearchFocus`, `syncSelectionUi`, `renderReviewQueue`.

Do not run verification yet — `importReviewsFromCsvText`/`importReviewsFromCsvFile` (Task 14) and the event handlers (Task 15) still need to move/rewire.

---

### Task 14: Extract review-queue.js's CSV import into js/review-queue-import.js

**Files:**
- Create: `js/review-queue-import.js`
- Modify: `index.html`
- Modify: `js/review-queue.js` (remove the moved functions)

**Interfaces:**
- Consumes: `window.ReviewQueueInternal.helpers.{VALID_DECISIONS, normalize, toast, updateLocalReviewForPage}`, `window.ReviewQueueInternal.render.renderReviewQueue`, `window.reviewState.read`, `window.utils.{parseCsv, getCurrentKey}`.
- Produces: `window.ReviewQueueInternal.importCsv = { importReviewsFromCsvText, importReviewsFromCsvFile }`.

This is the file CLAUDE.md specifically flags as regression-prone (a prior bug here replaced saved review state wholesale instead of merging). Keeping it isolated as its own ~110-line file, unchanged in logic from the original, is the point of this task — no logic changes, pure relocation.

- [ ] **Step 1: Create `js/review-queue-import.js`**

```js
/* Cross-page review queue: CSV import.
   Kept in its own file since this is the highest-regression-risk area (a
   prior bug here replaced saved review state wholesale instead of merging —
   see CLAUDE.md's "Local persistence" section). Loads after
   js/review-queue-render.js. */
;(function mountReviewQueueImport() {
  const DATA = window.HHVC_DATA
  if (!DATA || !DATA.pages || !DATA.order || !window.ReviewQueueInternal?.render) return

  const { parseCsv, getCurrentKey } = window.utils
  const { VALID_DECISIONS, normalize, toast, updateLocalReviewForPage } =
    window.ReviewQueueInternal.helpers
  const readLocalState = window.reviewState.read

  function importReviewsFromCsvText(text) {
    const rows = parseCsv(text)
    if (rows.length < 2) {
      toast('Import failed: CSV has no data rows.', 'warn')
      return 0
    }

    const headers = rows[0].map((header) => normalize(header).replaceAll(' ', '_'))
    const indexOf = (name) => headers.indexOf(name)
    const pageKeyIndex = indexOf('page_key')
    if (pageKeyIndex === -1) {
      toast('Import failed: CSV needs a page_key column.', 'warn')
      return 0
    }

    let imported = 0
    let skipped = 0

    for (const cells of rows.slice(1)) {
      const pageKey = String(cells[pageKeyIndex] || '').trim()
      if (!pageKey || !DATA.pages[pageKey]) {
        skipped += 1
        continue
      }

      const get = (name) => {
        const index = indexOf(name)
        return index === -1 ? '' : String(cells[index] ?? '').trim()
      }

      const csvDecision = get('decision')
      if (csvDecision !== '' && !VALID_DECISIONS.has(csvDecision)) {
        skipped += 1
        continue
      }

      const patch = {}
      const fields = [
        'page_title',
        'page_type',
        'url_slug',
        'decision',
        'notes',
        'risks_or_blockers',
        'follow_up_owner',
        'reviewer',
        'review_date',
        'seo_title',
        'meta_description',
        'primary_cta',
        'reading_target',
      ]

      let hasField = false
      for (const field of fields) {
        const val = get(field)
        if (val !== '') {
          patch[field] = val
          hasField = true
        }
      }

      if (!hasField) {
        skipped += 1
        continue
      }

      const existing = readLocalState().pages[pageKey] || {}
      const saved = updateLocalReviewForPage(pageKey, patch)
      if (saved && saved.updated_at !== existing.updated_at) {
        imported += 1
      } else {
        skipped += 1
      }
    }

    if (!imported) {
      toast(
        skipped
          ? 'Import finished: no matching pages were updated.'
          : 'Import failed: no valid review rows found.',
        'warn'
      )
      return 0
    }

    const currentKey = getCurrentKey()
    if (typeof window.renderPage === 'function') {
      window.renderPage(currentKey)
    }

    document.dispatchEvent(new CustomEvent('hhvc:review-data-changed'))
    window.ReviewQueueInternal.render.renderReviewQueue()
    toast(
      skipped
        ? `Imported ${imported} reviews (${skipped} skipped).`
        : `Imported ${imported} reviews.`,
      'success'
    )
    return imported
  }

  function importReviewsFromCsvFile(file) {
    file
      .text()
      .then((text) => importReviewsFromCsvText(text))
      .catch(() => toast('Import failed: could not read the CSV file.', 'warn'))
  }

  window.ReviewQueueInternal.importCsv = {
    importReviewsFromCsvText,
    importReviewsFromCsvFile,
  }
})()
```

- [ ] **Step 2: Add the `<script>` tag in `index.html`**

Find:

```html
    <script src="js/review-queue-render.js"></script>
    <script src="js/review-queue.js"></script>
```

Replace with:

```html
    <script src="js/review-queue-render.js"></script>
    <script src="js/review-queue-import.js"></script>
    <script src="js/review-queue.js"></script>
```

- [ ] **Step 3: Delete the moved functions from `js/review-queue.js`**

Delete in their entirety: `importReviewsFromCsvText`, `importReviewsFromCsvFile`.

Do not run verification yet — the event handlers and `window.reviewQueue` assembly (Task 15) still reference functions that have moved. Continue directly into Task 15.

---

### Task 15: Finish the js/review-queue.js orchestrator, verify, and manually re-check the CSV import round-trip

**Files:**
- Modify: `js/review-queue.js` (final trim + event handlers + public `window.reviewQueue` assembly)

**Interfaces:**
- Produces: `window.reviewQueue = { getQueueRows, getQueueStats, getNextNeedsReviewKey, getAdjacentKey, getFilter, getSelectedKeys, selectAllVisible, clearSelection, toggleSelected, syncSelectionUi, applyQueueAction, getActionTargets, focusQueueSearch, importReviewsFromCsvText, renderReviewQueue }` — this is the **existing public contract** (consumed by `js/ux-improvements-workspace.js` and `js/keyboard-shortcuts.js`); its shape is unchanged, only assembled from the new namespaces instead of local closures.

- [ ] **Step 1: Replace the full contents of `js/review-queue.js`**

```js
/* Cross-page review queue for manager approval workflow: orchestrator.
   Reads HHVC_DATA and hhvcManagerReviewState:v1; does not mutate page source
   data. Composes window.ReviewQueueInternal.state/.helpers/.rows/.render/.importCsv
   (each in their own file, loaded before this one) into event wiring, init(),
   and the public window.reviewQueue API. */
;(function mountReviewQueue() {
  const DATA = window.HHVC_DATA
  if (
    !DATA ||
    !DATA.pages ||
    !DATA.order ||
    !window.reviewState ||
    !window.ReviewQueueInternal?.rows ||
    !window.ReviewQueueInternal?.render ||
    !window.ReviewQueueInternal?.importCsv
  )
    return

  const state = window.ReviewQueueInternal.state
  const { DEFAULT_STATE, writeQueueUiState, restoreQueueUiState, toast, QUEUE_PANEL_ID } =
    window.ReviewQueueInternal.helpers
  const {
    getSelectedKeys,
    clearSelection,
    selectAllVisible,
    applyQueueAction,
    getNextNeedsReviewKey,
    getAdjacentKey,
    toggleSelected,
    getActionTargets,
    getQueueRows,
    getQueueStats,
  } = window.ReviewQueueInternal.rows
  const { renderReviewQueue, syncSelectionUi } = window.ReviewQueueInternal.render
  const { importReviewsFromCsvText, importReviewsFromCsvFile } =
    window.ReviewQueueInternal.importCsv

  function handleQueueClick(event) {
    const filterButton = event.target.closest('[data-queue-filter]')
    if (filterButton) {
      state.filter = filterButton.getAttribute('data-queue-filter') || 'All'
      writeQueueUiState()
      renderReviewQueue()
      return
    }

    const resetButton = event.target.closest('[data-queue-reset]')
    if (resetButton) {
      Object.assign(state, { ...DEFAULT_STATE })
      writeQueueUiState()
      renderReviewQueue()
      return
    }

    // Selection checkboxes update on `change` so label clicks do not double-toggle.
    if (
      event.target.closest('#reviewQueueSelectAll, [data-queue-select-key], .review-queue-checkbox')
    ) {
      return
    }

    const selectControl = event.target.closest('[data-queue-select]')
    if (selectControl) {
      if (selectControl.getAttribute('data-queue-select') === 'clear') {
        clearSelection()
        syncSelectionUi()
      }
      return
    }

    const importButton = event.target.closest('[data-queue-import="csv"]')
    if (importButton) {
      document.getElementById('reviewQueueCsvInput')?.click()
      return
    }

    const bulkActionButton = event.target.closest('[data-queue-bulk-action]')
    if (bulkActionButton) {
      const action = bulkActionButton.getAttribute('data-queue-bulk-action')
      const keys = getSelectedKeys()
      if (!action || !keys.length) return
      applyQueueAction(keys, action)
      return
    }

    const actionButton = event.target.closest('[data-queue-action]')
    if (actionButton) {
      const row = actionButton.closest('[data-page-key]')
      if (!row) return
      const key = row.getAttribute('data-page-key')
      const action = actionButton.getAttribute('data-queue-action')
      if (!key || !action) return
      if (action === 'open') {
        window.renderPage?.(key)
        return
      }
      applyQueueAction([key], action)
      return
    }

    const nextNeedsReviewButton = event.target.closest('[data-queue-next-needs-review]')
    if (nextNeedsReviewButton) {
      const key = getNextNeedsReviewKey()
      if (key) window.renderPage?.(key)
      else toast('No pages left that need review', 'success')
      return
    }

    if (event.target.closest('.review-queue-checkbox')) return
    if (event.target.closest('.review-queue-table-row')) return
  }

  function handleQueueInput(event) {
    if (event.target.id === 'reviewQueueSearch') {
      state.query = event.target.value || ''
      writeQueueUiState()
      renderReviewQueue()
      return
    }

    if (event.target.id === 'reviewQueueSort') {
      state.sort = event.target.value || 'priority'
      writeQueueUiState()
      renderReviewQueue()
    }
  }

  function handleQueueChange(event) {
    if (event.target.id === 'reviewQueueSelectAll') {
      if (event.target.checked) selectAllVisible()
      else clearSelection()
      syncSelectionUi()
      return
    }

    if (event.target.matches('[data-queue-select-key]')) {
      const key = event.target.getAttribute('data-queue-select-key')
      if (!key) return
      if (event.target.checked) state.selected.add(key)
      else state.selected.delete(key)
      syncSelectionUi()
      return
    }

    handleQueueInput(event)
  }

  function focusQueueSearch() {
    const workspace = document.getElementById('reviewWorkspace')
    if (workspace?.hidden) {
      document.querySelector('[data-sticky-action="toggle-workspace"]')?.click()
    }
    const overviewTab = document.querySelector('[data-workspace-tab="overview"]')
    if (overviewTab?.getAttribute('aria-selected') !== 'true') overviewTab?.click()
    const input = document.getElementById('reviewQueueSearch')
    if (!input) return
    input.focus()
    if (typeof input.select === 'function') input.select()
  }

  function init() {
    const panel = document.getElementById(QUEUE_PANEL_ID)
    if (!panel) return

    restoreQueueUiState()

    let fileInput = document.getElementById('reviewQueueCsvInput')
    if (!fileInput) {
      fileInput = document.createElement('input')
      fileInput.id = 'reviewQueueCsvInput'
      fileInput.type = 'file'
      fileInput.accept = '.csv,text/csv'
      fileInput.hidden = true
      document.body.appendChild(fileInput)
    }

    fileInput.addEventListener('change', (event) => {
      const file = event.target.files?.[0]
      if (file) importReviewsFromCsvFile(file)
      event.target.value = ''
    })

    panel.addEventListener('click', handleQueueClick)
    panel.addEventListener('input', handleQueueInput)
    panel.addEventListener('change', handleQueueChange)
    document.addEventListener('hhvc:review-data-changed', renderReviewQueue)
    renderReviewQueue()
  }

  window.reviewQueue = {
    getQueueRows,
    getQueueStats,
    getNextNeedsReviewKey,
    getAdjacentKey,
    getFilter: () => state.filter,
    getSelectedKeys,
    selectAllVisible,
    clearSelection,
    toggleSelected,
    syncSelectionUi,
    applyQueueAction,
    getActionTargets,
    focusQueueSearch,
    importReviewsFromCsvText,
    renderReviewQueue,
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init)
  } else {
    init()
  }
})()
```

- [ ] **Step 2: Verify**

Run: `bun run format && bun run validate && bun run test`
Expected: all PASS.

- [ ] **Step 3: Manual CSV import round-trip check (required by CLAUDE.md)**

Run: `bun run dev`, open the app, open the Overview workspace tab:
1. Set a decision and notes on 2-3 pages via the queue UI.
2. Click "Export saved local reviews CSV" — confirm it downloads with those pages' data.
3. Edit one row's `decision` column in the downloaded CSV (e.g. change to "Blocked").
4. Click "Import CSV" and select the edited file — confirm a success toast appears and the queue table updates to reflect the changed decision.
5. Reload the page and confirm all previously-saved decisions/notes/owners (both the untouched ones and the just-imported one) are still present — nothing was wiped.
6. Also test "Download backup (JSON)" → "Import backup (JSON)" round-trip the same way (export, reload, re-import, confirm nothing lost).

- [ ] **Step 4: Manual full-flow check for the rest of the queue**

Confirm: filter buttons, search, sort dropdown, select-all/individual checkboxes, bulk actions (assign/approve/block/etc.), single-row actions, "Next needs review" button, and `js/keyboard-shortcuts.js`'s queue-related shortcuts (bulk-select, assign-to-me, next-needs-review) all still work. Console stays clean throughout.

- [ ] **Step 5: Commit**

```bash
git add js/review-queue.js
git commit -m "$(cat <<'EOF'
Finish js/review-queue.js orchestrator after the module split

js/review-queue.js drops from 1067 to ~150 lines: event handlers, init(),
and the public window.reviewQueue API assembly only, composing
window.ReviewQueueInternal.state/.helpers/.rows/.render/.importCsv.
EOF
)"
```

---

### Task 16: Final full regression pass across all three modules

**Files:** none (verification-only task)

- [ ] **Step 1: Run the complete verification suite**

```bash
bun run format:check
bun run validate
bun run test
bun run test:e2e
```

Expected: all PASS.

- [ ] **Step 2: Confirm final line counts across every touched file**

```bash
wc -l js/ux-improvements.js js/ux-improvements-state-sync.js js/ux-improvements-workspace.js \
  js/ux-improvements-export.js js/review-state-store.js \
  js/review-queue.js js/review-queue-state.js js/review-queue-rows.js js/review-queue-render.js js/review-queue-import.js \
  js/interactive-sitemap.js js/interactive-sitemap-data.js js/interactive-sitemap-render.js
```

Expected: every file lands well under 400 lines (see the "File breakdown" table in `docs/superpowers/specs/2026-07-07-review-ux-files-modular-split-design.md` for the per-file target ranges).

- [ ] **Step 3: Full manual walkthrough**

Run: `bun run dev`, and exercise every feature touched across all 16 tasks in one continuous session: page navigation, SEO/editor sidebar edits, sticky bar, workspace tabs (Overview/Checks/Sitemap/Help), decision quick actions, review summary copy, CSV export, JSON backup export/import, CSV import, queue filtering/search/sort/selection/bulk actions, interactive sitemap search/filter/navigation, and keyboard shortcuts. Confirm the browser console stays clean throughout and `localStorage`'s `hhvcManagerReviewState:v1` key round-trips correctly across a page reload.

- [ ] **Step 4: Update `CLAUDE.md`'s "Core module split" section**

`CLAUDE.md`'s "Core module split (formerly one `app.js`)" section and "Script load order in `index.html` matters" code block describe the pre-split file layout. Update both to reflect the new files: add `js/review-state-store.js`, `js/ux-improvements-state-sync.js`, `js/ux-improvements-workspace.js`, `js/ux-improvements-export.js`, `js/review-queue-state.js`, `js/review-queue-rows.js`, `js/review-queue-render.js`, `js/review-queue-import.js`, `js/interactive-sitemap-data.js`, `js/interactive-sitemap-render.js`, and `css/interactive-sitemap.css` to the relevant lists, and note that `js/ux-improvements.js`, `js/review-queue.js`, and `js/interactive-sitemap.js` are now thin orchestrators over `window.ReviewUx`/`window.ReviewQueueInternal`/`window.InteractiveSitemap` respectively (mirroring the existing `window.utils`/`window.reviewState` pattern already documented there).

- [ ] **Step 5: Commit the CLAUDE.md update**

```bash
git add CLAUDE.md
git commit -m "$(cat <<'EOF'
Document the ux-improvements/review-queue/interactive-sitemap file split in CLAUDE.md

Updates the script load order and core module split sections to reflect
the new window.ReviewUx/window.ReviewQueueInternal/window.InteractiveSitemap
internal namespaces introduced across this refactor.
EOF
)"
```

# Reviewer Dashboard Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate the reviewer UI (sidebar, sticky review bar, and the four-tab
workspace panel) so each panel has exactly one job, per
`docs/superpowers/specs/2026-07-06-dashboard-redesign-design.md`.

**Architecture:** Same three zones (sidebar / sticky bar / workspace panel). Sidebar
drops from 7 to 5 sections (static reference content moves to Help). The sticky bar
drops to a single row (decision + progress + nav only). The four workspace tabs become
Overview (new, merges the old Queue tab + Checks tab's portfolio grid into one dense
table), Checks (now per-page only), Sitemap (unchanged), Help (gains the moved
reference content).

**Tech Stack:** Plain `<script>` tags sharing one global scope (no bundler, no
framework, no TypeScript). No unit-test suite exists — `bun run validate` (Zod schema +
business-invariant checks over `pages/*.js`) is the only automated check, and it is
unaffected by this UI-only work since no page content changes. Verification per task is
therefore: (a) `bun run validate` passes, (b) specific manual browser checks listed in
each task, (c) regenerate the single-file exports once, in the final task.

## Global Constraints

- No new dependencies, no build step changes (see spec's Non-goals).
- No changes to page content (`pages/*.js`), Karl tag rendering, or the CSV/JSON
  export-import round-trip logic.
- No changes to CSS design tokens or visual style — only structural reuse of existing
  classes/tokens already in `css/ux-improvements.css` and `css/theme.css`.
- **The localStorage key stays `hhvcManagerReviewState:v1` — never bump it.** Every task
  in this plan must preserve `state.pages` and `state.globals.reviewer` exactly as they
  persist today. If any task's manual verification shows a previously-saved review going
  missing after the change, that is a regression — stop and fix it before continuing.
- Prettier formatting rules apply (`.prettierrc.json`): no semicolons, single quotes,
  2-space indentation, 100-char print width, ES5 trailing commas. Run `bun run format`
  if a step's exact whitespace drifts from this.
- `manager-review-single-file.html` and `single-file-export-current-source.html` are
  gitignored, generated files — never hand-edit them. They are regenerated once, in
  Task 8, after all markup changes land.

---

## Task 1: Move static reference content out of the sidebar into the Help tab

**Files:**
- Modify: `index.html:154-171` (delete "Applied rules" `<details>` block)
- Modify: `index.html:263-276` (delete "Reading targets" `<details>` block)
- Modify: `js/dashboard-guidance.js`

**Interfaces:**
- Consumes: `initChecklist()` and `applyChecklistState(key)` — both plain top-level
  functions declared in `js/ui-controls.js` (not wrapped in an IIFE, so visible to
  `js/dashboard-guidance.js`'s scope since all `<script>` tags in `index.html` share one
  global lexical environment). `getCurrentKey()` — plain top-level function from
  `js/utils.js`, same sharing mechanism.
- Produces: no new exports. The Help tab panel (`#reviewWorkspaceHelp`) gains a second
  static section (`#dashboardReferencePanel`) alongside the existing guidance grid
  (`#dashboardGuidancePanel`).

This is the first task because it's fully self-contained: it doesn't touch any other
workspace tab, the sticky bar, or the Queue/Overview rename, so it can land and be
verified independently of everything else in this plan.

- [ ] **Step 1: Note the current (pre-change) behavior to protect**

The "Applied rules" checklist in the sidebar (`<ul class="checklist">` in
`index.html:157-169`) is interactive: `js/ui-controls.js`'s `initChecklist()` binds a
click handler to each `.checklist .check` item that toggles a `.check.unchecked` class
and saves the toggle to `sessionStorage` per page (`check_<pageKey>_<i>`).
`js/page-render.js:100` calls `applyChecklistState(key)` on every `renderPage(key)` to
restore that page's toggle state. Confirm this by running `bun run dev`, opening the
tool, toggling one of the 9 "Applied rules" items off, switching to a different page and
back — the item should still show unchecked. This interactive behavior must still work
after the checklist markup moves into the Help tab (it renders once, in one place,
regardless of which tab you're viewing — `initChecklist()`/`applyChecklistState()` query
`.checklist .check` globally, not scoped to the sidebar).

- [ ] **Step 2: Delete the "Applied rules" block from `index.html`**

Remove this entire block (currently `index.html:154-171`, immediately before the
"Manager review" `<details>`):

```html
        <details class="control-group">
          <summary class="eyebrow">Applied rules</summary>
          <div class="details-body">
            <ul class="checklist">
              <li class="check">SF.gov system typography and SFDS-style spacing</li>
              <li class="check">Action Blue for links and primary action</li>
              <li class="check">Topic page uses scannable link clusters</li>
              <li class="check">Article 11 / HHVC scope only</li>
              <li class="check">72-hour tenant notice where applicable</li>
              <li class="check">No standard photo requirement</li>
              <li class="check">Report, prevent, scope, and tenant-help clusters</li>
              <li class="check">
                Enforcement pathway included without overloading Transaction pages
              </li>
              <li class="check">Tenant rights and anti-retaliation reassurance included</li>
            </ul>
          </div>
        </details>

```

Leave the surrounding "Karl CMS tags" and "Manager review" `<details>` blocks untouched.

- [ ] **Step 3: Delete the "Reading targets" block from `index.html`**

Remove this entire block (currently `index.html:263-276`, the last child of `<aside
class="sidebar">` before `</aside>`):

```html
        <details class="control-group">
          <summary class="eyebrow">Reading targets</summary>
          <div class="details-body">
            <p>
              <strong>Transaction:</strong> Grade 5–6<br /><strong>Prevention:</strong> Grade 6<br /><strong
                >Inspection/process:</strong
              >
              Grade 6–7<br /><strong>Enforcement/NOV:</strong> Grade 7–8
            </p>
            <p class="field-help" id="readingCurrent" style="margin-top: 0.65rem; font-weight: 600">
              Current page target: <span id="readingTargetValue">—</span>
            </p>
          </div>
        </details>
```

`<aside class="sidebar">` now ends with the "Manager review" block, followed directly by
`</aside>`.

- [ ] **Step 4: Add the moved content and the checklist re-bind fix to `js/dashboard-guidance.js`**

Add a new `REFERENCE_ID` constant near the existing `GUIDANCE_ID`/`STYLE_ID` constants
(`js/dashboard-guidance.js:5`):

```js
  const GUIDANCE_ID = 'dashboardGuidancePanel'
  const REFERENCE_ID = 'dashboardReferencePanel'
  const STYLE_ID = 'dashboardGuidanceStyles'
```

Add a new function `buildReferencePanel()` right after `buildGuidancePanel()`
(`js/dashboard-guidance.js:106-127`):

```js
  // Static reference content moved out of the sidebar (see
  // docs/superpowers/specs/2026-07-06-dashboard-redesign-design.md): it never changes
  // per page, so it belongs with the other Help tab guidance, not among live edit
  // fields. Mounted once, same as buildGuidancePanel().
  function buildReferencePanel() {
    const panel = document.createElement('section')
    panel.id = REFERENCE_ID
    panel.className = 'dashboard-guidance-panel'
    panel.setAttribute('aria-label', 'Applied rules and reading targets')
    panel.innerHTML = `
      <h3>Applied rules</h3>
      <ul class="checklist">
        <li class="check">SF.gov system typography and SFDS-style spacing</li>
        <li class="check">Action Blue for links and primary action</li>
        <li class="check">Topic page uses scannable link clusters</li>
        <li class="check">Article 11 / HHVC scope only</li>
        <li class="check">72-hour tenant notice where applicable</li>
        <li class="check">No standard photo requirement</li>
        <li class="check">Report, prevent, scope, and tenant-help clusters</li>
        <li class="check">
          Enforcement pathway included without overloading Transaction pages
        </li>
        <li class="check">Tenant rights and anti-retaliation reassurance included</li>
      </ul>
      <h3>Reading targets</h3>
      <p>
        <strong>Transaction:</strong> Grade 5–6<br /><strong>Prevention:</strong> Grade 6<br /><strong
          >Inspection/process:</strong
        >
        Grade 6–7<br /><strong>Enforcement/NOV:</strong> Grade 7–8
      </p>
      <p class="field-help" id="readingCurrent" style="margin-top: 0.65rem; font-weight: 600">
        Current page target: <span id="readingTargetValue">—</span>
      </p>
    `
    return panel
  }
```

Add `mountReferencePanel()` right after `mountGuidancePanel()`
(`js/dashboard-guidance.js:129-134`):

```js
  function mountReferencePanel() {
    const helpPanel = document.getElementById('reviewWorkspaceHelp')
    if (!helpPanel || document.getElementById(REFERENCE_ID)) return

    helpPanel.appendChild(buildReferencePanel())
    // The checklist markup used to be static in index.html, so ui-controls.js's
    // initChecklist() (bound once at bootstrap, before this script runs) found it
    // immediately. Mounted dynamically here instead, it needs an explicit (re-)bind
    // and a state sync for whichever page happens to be open right now.
    if (typeof initChecklist === 'function') initChecklist()
    if (typeof applyChecklistState === 'function') applyChecklistState(getCurrentKey())
  }
```

Call it from `refresh()` (`js/dashboard-guidance.js:154-158`):

```js
  function refresh() {
    injectStyles()
    mountGuidancePanel()
    mountReferencePanel()
    compactSidebarCopy()
  }
```

- [ ] **Step 5: Remove the now-dead sidebar-copy selector**

In `compactSidebarCopy()`'s `selectors` array (`js/dashboard-guidance.js:137-145`),
remove this line:

```js
      '.control-group:last-of-type .details-body > p:first-child',
```

This selector targeted the Reading targets block's intro paragraph when it was the last
`.control-group` in the sidebar. After Step 3 deletes that block, `.control-group
:last-of-type` would instead match the "Manager review" section's own intro paragraph
(`.manager-review` carries the `.control-group` class too) — leaving this selector in
place would incorrectly hide review-workflow guidance that reviewers still need. The
other six selectors are unaffected: they target the Live content editor, Search
metadata, and Karl CMS tags sections by `:nth-of-type`/class, none of which shift
position from removing items 5 and 7 (Applied rules and Reading targets, at either end
of that ordering).

- [ ] **Step 6: Run `bun run validate`**

Run: `bun run validate`
Expected: passes with no errors (this task doesn't touch `pages/*.js` or
`js/page-data.js`, so the schema/business-invariant checks are unaffected).

- [ ] **Step 7: Manual browser verification**

Run: `bun run dev`, open `http://127.0.0.1:8080` in a browser.

- Confirm the sidebar now shows exactly 5 `<details class="control-group">` sections:
  Page mockup, Live content editor, Search metadata, Karl CMS tags, Manager review.
- Open the Help tab (via the sticky bar's "Show workspace" button, then the Help tab).
  Confirm it shows the existing 7 guidance cards, followed by "Applied rules" (9-item
  checklist) and "Reading targets" (the grade-level table) below them.
- In the Help tab, click one of the 9 Applied-rules checklist items to toggle it off.
  Switch to a different page via the sidebar dropdown, then switch back to the original
  page. Confirm the toggle state persisted (this is the regression check from Step 1).
- Confirm no leftover "Applied rules" or "Reading targets" section remains in the
  sidebar.

- [ ] **Step 8: Commit**

```bash
git add index.html js/dashboard-guidance.js
git commit -m "$(cat <<'EOF'
Move static reference content from sidebar into Help tab

Applied rules and Reading targets never change per page, so they don't
belong among the sidebar's live edit fields. Moves both into the Help
tab next to the other reviewer guidance, and re-binds the Applied-rules
checklist's per-page toggle state now that it mounts dynamically
instead of loading as static index.html markup.
EOF
)"
```

---

## Task 2: Owner auto-fill defaults to "David"

**Files:**
- Modify: `js/ux-improvements.js:218-231` (`saveCurrentPageToLocalStorage`)
- Modify: `js/ux-improvements.js:280-306` (`applySavedPageState`)
- Modify: `js/ux-improvements.js:233-239` (`clearReviewFieldsForNewPage`)

**Interfaces:**
- Consumes: `state.globals` (existing bucket in the persisted state shape; already
  holds `reviewer`).
- Produces: `state.globals.owner` — new persisted field, read by no other task in this
  plan (Task 7's Overview table reads `follow_up_owner` per-page, same as today; the
  *default* for a never-reviewed page now resolves to `"David"` instead of empty string).

This task is self-contained: it only touches the review-field persistence functions in
`js/ux-improvements.js`, none of which are touched by any other task in this plan.

- [ ] **Step 1: Add the owner default alongside the existing reviewer auto-fill in `saveCurrentPageToLocalStorage`**

Current code (`js/ux-improvements.js:218-231`):

```js
  function saveCurrentPageToLocalStorage() {
    if (isRestoringState) return

    const snapshot = collectCurrentPageReviewState()
    updateLocalState((state) => {
      state.ui.last_page_key = snapshot.page_key
      state.ui.show_karl_tags = document.getElementById('tagToggle')?.checked !== false
      state.globals.reviewer = snapshot.reviewer
      state.pages[snapshot.page_key] = snapshot
      return state
    })

    updateLocalStorageStatus()
  }
```

Replace with:

```js
  function saveCurrentPageToLocalStorage() {
    if (isRestoringState) return

    const snapshot = collectCurrentPageReviewState()
    updateLocalState((state) => {
      state.ui.last_page_key = snapshot.page_key
      state.ui.show_karl_tags = document.getElementById('tagToggle')?.checked !== false
      state.globals.reviewer = snapshot.reviewer
      state.globals.owner = snapshot.follow_up_owner
      state.pages[snapshot.page_key] = snapshot
      return state
    })

    updateLocalStorageStatus()
  }
```

(`snapshot.follow_up_owner` already exists — `collectCurrentPageReviewState()` sets it
from `getValue('reviewOwner')` via `buildReviewRecord`, unchanged by this task.)

- [ ] **Step 2: Default the owner field to "David" in `applySavedPageState`**

Current code (`js/ux-improvements.js:280-306`):

```js
  function applySavedPageState(pageKey) {
    const state = readLocalState()
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
      setValue('reviewOwner', saved.follow_up_owner || '')
      updateMockupTextFromSavedState(page, saved)
    } else {
      clearReviewFieldsForNewPage()
    }

    isRestoringState = false
    updateLocalStorageStatus()
  }
```

Replace with:

```js
  function applySavedPageState(pageKey) {
    const state = readLocalState()
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
```

Note `saved.follow_up_owner` is still checked first — a page that already has an
explicit owner saved (including one a reviewer previously overrode away from "David")
keeps that value. Only a genuinely never-reviewed page falls through to the "David"
default.

- [ ] **Step 3: Thread the default into `clearReviewFieldsForNewPage`**

Current code (`js/ux-improvements.js:233-239`):

```js
  function clearReviewFieldsForNewPage() {
    setValue('reviewDateInput', today())
    setValue('reviewDecision', 'Needs review')
    setValue('reviewNotes', '')
    setValue('reviewRisks', '')
    setValue('reviewOwner', '')
  }
```

Replace with:

```js
  function clearReviewFieldsForNewPage(state) {
    setValue('reviewDateInput', today())
    setValue('reviewDecision', 'Needs review')
    setValue('reviewNotes', '')
    setValue('reviewRisks', '')
    setValue('reviewOwner', state?.globals?.owner || 'David')
  }
```

This function has one other call site — `clearSavedLocalReviews()`
(`js/ux-improvements.js:962-976`), which calls `clearReviewFieldsForNewPage()` with no
arguments right after wiping all local storage. Leave that call site as-is (no
argument): `state` will be `undefined`, so `state?.globals?.owner` short-circuits to
`undefined`, and the `|| 'David'` fallback still applies — the owner field still
correctly resets to "David" after a full local-data clear.

- [ ] **Step 4: Run `bun run validate`**

Run: `bun run validate`
Expected: passes (no schema/page-data changes).

- [ ] **Step 5: Manual browser verification**

Run: `bun run dev`, open the tool in a browser with a clean localStorage (use a private/
incognito window, or run `localStorage.clear()` in devtools first).

- Confirm the "Follow-up owner" field in the Manager review sidebar section shows
  "David" on first load, for a page that has never been reviewed.
- Type a different owner name into that field, switch to another page and back — the
  overridden value must persist (not get reset back to "David").
- Click "Clear local saved reviews" (with confirmation) and confirm the owner field
  resets to "David" again afterward.

- [ ] **Step 6: Commit**

```bash
git add js/ux-improvements.js
git commit -m "$(cat <<'EOF'
Default review owner to David across all pages

The follow-up owner field previously started blank on every page,
requiring the reviewer to type the same name in repeatedly. It now
auto-fills "David" the same way the reviewer name field already
auto-fills across pages, while still being fully overridable per page.
EOF
)"
```

---

## Task 3: Remove the sidebar quick-search page filter

**Files:**
- Modify: `js/ux-improvements.js` (remove `pageSearchItems`, `renderPageQuickList`,
  `mountPageSearch`, and their call sites)
- Modify: `css/ux-improvements.css` (remove now-dead selectors)

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing new. `#pageFilterInput`/`#pageQuickList` no longer exist in the DOM;
  `js/keyboard-shortcuts.js`'s `focusPageSearch()` (`js/keyboard-shortcuts.js:124-130`)
  already falls back to `document.getElementById('pageSelect')` when
  `pageFilterInput` is absent, so the `/` shortcut degrades gracefully to focusing the
  page dropdown — no change needed there.

This task is self-contained: quick-search is a standalone feature bolted onto the
sidebar with no dependents elsewhere in the codebase.

- [ ] **Step 1: Remove the quick-search functions from `js/ux-improvements.js`**

Delete `pageSearchItems` (`js/ux-improvements.js:693-705`):

```js
  function pageSearchItems(query) {
    const normalizedQuery = query.trim().toLowerCase()
    if (!normalizedQuery) return DATA.order.slice(0, 5)

    return DATA.order
      .filter(([key, label]) => {
        const page = DATA.pages[key] || {}
        const haystack =
          `${key} ${label} ${page.title || ''} ${page.type || ''} ${page.summary || ''}`.toLowerCase()
        return haystack.includes(normalizedQuery)
      })
      .slice(0, 6)
  }
```

Delete `renderPageQuickList` (`js/ux-improvements.js:707-725`):

```js
  function renderPageQuickList() {
    const input = document.getElementById('pageFilterInput')
    const list = document.getElementById('pageQuickList')
    if (!input || !list) return

    const items = pageSearchItems(input.value)
    list.innerHTML = items
      .map(([key, label]) => {
        const page = DATA.pages[key] || {}
        const type = page.type || label.split(':')[0] || 'Page'
        return `
        <button type="button" class="page-quick-button" data-page-key="${escapeHtml(key)}">
          ${escapeHtml(page.title || label)}
          <span class="page-quick-type">${escapeHtml(type)} · ${escapeHtml(key)}</span>
        </button>
      `
      })
      .join('')
  }
```

Delete `mountPageSearch` (`js/ux-improvements.js:727-749`):

```js
  function mountPageSearch() {
    const select = document.getElementById('pageSelect')
    const selectLabel = document.querySelector('label[for="pageSelect"]')
    if (!select || !selectLabel || document.getElementById('pageFilterInput')) return

    const control = document.createElement('div')
    control.className = 'page-filter-control'
    control.innerHTML = `
      <label for="pageFilterInput">Find a page fast</label>
      <input id="pageFilterInput" type="search" aria-label="Search page mockups" placeholder="Search by page title, type, summary, or page key">
      <div id="pageQuickList" class="page-quick-list" aria-label="Quick page results"></div>
    `
    selectLabel.parentNode.insertBefore(control, selectLabel)

    document.getElementById('pageFilterInput')?.addEventListener('input', renderPageQuickList)
    document.getElementById('pageQuickList')?.addEventListener('click', (event) => {
      const button = event.target.closest('[data-page-key]')
      if (!button) return
      window.renderPage?.(button.getAttribute('data-page-key'))
      refreshUx()
    })
    renderPageQuickList()
  }
```

- [ ] **Step 2: Remove the two remaining call sites**

Current `refreshUx()` (`js/ux-improvements.js:1036-1043`):

```js
  function refreshUx() {
    renderStickyBar()
    renderReviewDashboard()
    renderPageQuickList()
    updateLocalStorageStatus()
    updateDecisionQuickActions()
    document.dispatchEvent(new CustomEvent('hhvc:review-data-changed'))
  }
```

Replace with (removes the `renderPageQuickList()` line):

```js
  function refreshUx() {
    renderStickyBar()
    renderReviewDashboard()
    updateLocalStorageStatus()
    updateDecisionQuickActions()
    document.dispatchEvent(new CustomEvent('hhvc:review-data-changed'))
  }
```

Current `init()` (`js/ux-improvements.js:1138-1153`):

```js
  function init() {
    initWorkspaceTabs()
    initDecisionQuickActions()
    initDashboardListeners()
    mountPageSearch()
    mountCopySummaryButton()
    mountBackupControls()
    mountLocalStorageControls()
    attachRefreshListeners()
    wrapRenderPage()
    applySavedUiPreferences()
    restoreInitialPage()
    refreshUx()
    // Defer one refresh so review-queue.js (loaded next) is ready for sticky bar stats.
    window.setTimeout(refreshUx, 0)
  }
```

Replace with (removes the `mountPageSearch()` call; `initDashboardListeners()` is left
in place here — Task 5 removes it separately):

```js
  function init() {
    initWorkspaceTabs()
    initDecisionQuickActions()
    initDashboardListeners()
    mountCopySummaryButton()
    mountBackupControls()
    mountLocalStorageControls()
    attachRefreshListeners()
    wrapRenderPage()
    applySavedUiPreferences()
    restoreInitialPage()
    refreshUx()
    // Defer one refresh so review-queue.js (loaded next) is ready for sticky bar stats.
    window.setTimeout(refreshUx, 0)
  }
```

- [ ] **Step 3: Remove the now-dead CSS**

In `css/ux-improvements.css`, delete the `.page-filter-control` rule
(lines 676-678):

```css
.page-filter-control {
  margin: 0.25rem 0 0.8rem;
}
```

Delete the `.page-quick-list` rule (lines 697-701):

```css
.page-quick-list {
  display: grid;
  gap: 0.4rem;
  margin: 0.5rem 0 0.9rem;
}
```

Delete the `.page-quick-button` rule and its hover state (lines 703-724):

```css
.page-quick-button {
  width: 100%;
  border: 1px solid var(--sfds-border);
  border-radius: var(--radius);
  background: var(--sfds-white);
  color: var(--sfds-action-blue);
  cursor: pointer;
  font: inherit;
  font-size: 0.86rem;
  font-weight: 700;
  line-height: 1.25;
  min-height: 2.4rem;
  padding: 0.55rem 0.65rem;
  text-align: left;
}

.page-quick-button:hover,
.page-quick-button:focus-visible {
  border-color: var(--sfds-action-blue);
  background: var(--sfds-blue-soft-bg);
  color: var(--sfds-action-blue-hover);
}
```

Delete the `.page-quick-type` rule (lines 726-732):

```css
.page-quick-type {
  display: block;
  margin-top: 0.12rem;
  color: var(--sfds-slate-3);
  font-size: 0.72rem;
  font-weight: 600;
}
```

In the combined selector rules (lines 680-695), remove just the `.page-filter-control`
half, keeping the `.review-queue` half (still used by the Overview tab's search box in
Task 7):

Current:

```css
.page-filter-control input[type='search'],
.review-queue input[type='search'] {
  width: 100%;
  border: 1px solid var(--sfds-border);
  border-radius: var(--radius);
  padding: 0.85rem 0.9rem;
  font: inherit;
  color: var(--sfds-slate-1);
  background: var(--sfds-white);
}

.page-filter-control input[type='search']:focus,
.review-queue input[type='search']:focus {
  outline: 3px solid rgba(42, 96, 175, 0.25);
  outline-offset: 2px;
}
```

Replace with:

```css
.review-queue input[type='search'] {
  width: 100%;
  border: 1px solid var(--sfds-border);
  border-radius: var(--radius);
  padding: 0.85rem 0.9rem;
  font: inherit;
  color: var(--sfds-slate-1);
  background: var(--sfds-white);
}

.review-queue input[type='search']:focus {
  outline: 3px solid rgba(42, 96, 175, 0.25);
  outline-offset: 2px;
}
```

- [ ] **Step 4: Run `bun run validate`**

Run: `bun run validate`
Expected: passes.

- [ ] **Step 5: Manual browser verification**

Run: `bun run dev`, open the tool.

- Confirm the "Page mockup" sidebar section shows only the "Choose a page mockup"
  dropdown and the URL slug input — no "Find a page fast" search box above the
  dropdown.
- Confirm the page dropdown still works (selecting a page still navigates to it).
- Press `/` — confirm focus lands on the page dropdown (the graceful fallback in
  `focusPageSearch()`).
- Open devtools console, confirm no errors reference `pageFilterInput` or
  `pageQuickList`.

- [ ] **Step 6: Commit**

```bash
git add js/ux-improvements.js css/ux-improvements.css
git commit -m "$(cat <<'EOF'
Remove sidebar quick-search page filter

Drops one of five overlapping ways to navigate between pages. The
page dropdown, sticky-bar Prev/Next, and the Sitemap tab remain.
EOF
)"
```

---

## Task 4: Simplify the sticky review bar to a single row

**Files:**
- Modify: `js/ux-improvements.js:475-600` (`renderStickyBar`, `handleStickyBarClick`)

**Interfaces:**
- Consumes: `window.reviewQueue.getQueueStats()`, `getAdjacentKey()` — unchanged
  signatures, still called the same way.
- Produces: no new exports. `renderStickyBar()`'s output HTML changes (fewer chips,
  fewer buttons), but the container id (`reviewStickyBar`) and the click-delegation
  attribute (`data-sticky-action`) are unchanged, so nothing outside this function
  needs updating.

No CSS changes are needed for this task — `.review-sticky-bar` already lays out its
children with `justify-content: space-between`, which is exactly the "grouped
left/right, single row" layout being kept; removing child elements doesn't require new
rules.

- [ ] **Step 1: Rewrite `renderStickyBar`**

Current code (`js/ux-improvements.js:475-513`):

```js
  function renderStickyBar() {
    const bar = document.getElementById(STICKY_BAR_ID)
    if (!bar) return

    const page = getCurrentPage()
    const decision = getValue('reviewDecision') || 'Needs review'
    const rules = getRuleResults(page)
    const passed = rules.filter((rule) => rule.pass).length
    const reviewReady = decision === 'Approved' && passed === rules.length
    const chipClass = reviewReady ? 'pass' : getStatusChipClass(decision)
    const stats = window.reviewQueue?.getQueueStats?.() || {
      touched: 0,
      decided: 0,
      reviewed: 0,
      total: DATA.order.length,
    }
    const filter = window.reviewQueue?.getFilter?.() || 'All'
    const prevKey = window.reviewQueue?.getAdjacentKey?.(-1, filter)
    const nextKey = window.reviewQueue?.getAdjacentKey?.(1, filter)
    const state = readLocalState()
    const workspaceOpen = Boolean(state.ui.workspace_open)

    bar.innerHTML = `
      <div class="review-sticky-bar-main">
        <p class="review-sticky-bar-title">${escapeHtml(page.title || getCurrentKey())}</p>
        <span class="status-chip ${chipClass}">${escapeHtml(decision)}</span>
        <span class="status-chip ${passed === rules.length ? 'pass' : 'warn'}">${passed}/${rules.length} checks</span>
        <span class="status-chip ${stats.touched > 0 ? 'pass' : 'warn'}">${stats.touched}/${stats.total} touched</span>
      </div>
      <nav class="review-sticky-bar-actions">
        <button type="button" class="review-sticky-btn" data-sticky-action="prev"${prevKey ? '' : ' disabled'}>Previous</button>
        <button type="button" class="review-sticky-btn" data-sticky-action="next"${nextKey ? '' : ' disabled'}>Next</button>
        <button type="button" class="review-sticky-btn" data-sticky-action="next-needs-review">Next needs review</button>
        <button type="button" class="review-sticky-btn primary" data-sticky-action="toggle-workspace" aria-expanded="${workspaceOpen ? 'true' : 'false'}">
          ${workspaceOpen ? 'Hide workspace' : 'Show workspace'}
        </button>
      </nav>
    `
  }
```

Replace with (drops the checks-passed chip and the "touched" wording in favor of
"reviewed" to match the Overview tab's own stats language, and drops the "Next needs
review" button — that action moves into the Overview tab in Task 7):

```js
  function renderStickyBar() {
    const bar = document.getElementById(STICKY_BAR_ID)
    if (!bar) return

    const page = getCurrentPage()
    const decision = getValue('reviewDecision') || 'Needs review'
    const chipClass = getStatusChipClass(decision)
    const stats = window.reviewQueue?.getQueueStats?.() || {
      reviewed: 0,
      total: DATA.order.length,
    }
    const filter = window.reviewQueue?.getFilter?.() || 'All'
    const prevKey = window.reviewQueue?.getAdjacentKey?.(-1, filter)
    const nextKey = window.reviewQueue?.getAdjacentKey?.(1, filter)
    const state = readLocalState()
    const workspaceOpen = Boolean(state.ui.workspace_open)

    bar.innerHTML = `
      <div class="review-sticky-bar-main">
        <span class="status-chip ${chipClass}">${escapeHtml(decision)}</span>
        <p class="review-sticky-bar-title">${escapeHtml(page.title || getCurrentKey())}</p>
      </div>
      <nav class="review-sticky-bar-actions">
        <span class="review-sticky-bar-progress">${stats.reviewed}/${stats.total} reviewed</span>
        <button type="button" class="review-sticky-btn" data-sticky-action="prev"${prevKey ? '' : ' disabled'}>Previous</button>
        <button type="button" class="review-sticky-btn" data-sticky-action="next"${nextKey ? '' : ' disabled'}>Next</button>
        <button type="button" class="review-sticky-btn primary" data-sticky-action="toggle-workspace" aria-expanded="${workspaceOpen ? 'true' : 'false'}">
          ${workspaceOpen ? 'Hide workspace' : 'Show workspace'}
        </button>
      </nav>
    `
  }
```

Add a small inline-safe style for the new `.review-sticky-bar-progress` span to
`css/ux-improvements.css`, right after the `.review-sticky-bar-title` rule
(lines 43-53):

```css
.review-sticky-bar-progress {
  color: var(--sfds-slate-3);
  font-size: 0.78rem;
  font-weight: 700;
  white-space: nowrap;
}
```

- [ ] **Step 2: Remove the "next-needs-review" case from `handleStickyBarClick`**

Current code (`js/ux-improvements.js:572-600`):

```js
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

    if (action === 'next-needs-review') {
      const key = window.reviewQueue?.getNextNeedsReviewKey?.()
      if (key) window.renderPage?.(key)
      return
    }

    if (action === 'toggle-workspace') {
      toggleWorkspace()
    }
  }
```

Replace with:

```js
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
```

The keyboard shortcut `n` (`js/keyboard-shortcuts.js`'s `goToNextNeedsReview`) is
untouched by this task — it calls `window.reviewQueue.getNextNeedsReviewKey()`
directly, not through the sticky bar's click handler, so removing the button here
doesn't affect it.

- [ ] **Step 3: Run `bun run validate`**

Run: `bun run validate`
Expected: passes.

- [ ] **Step 4: Manual browser verification**

Run: `bun run dev`, open the tool.

- Confirm the sticky bar shows, in one row: a decision badge, the page title, the
  "N/M reviewed" progress text, Previous/Next buttons, and the workspace toggle button —
  and nothing else (no separate checks-passed chip, no "Next needs review" button).
- Click Previous/Next — confirm page navigation still works.
- Click "Show workspace" / "Hide workspace" — confirm the toggle still works and the
  label still flips correctly.
- Press `n` — confirm the keyboard shortcut still jumps to the next page needing review
  (this exercises the code path the removed button used to trigger).

- [ ] **Step 5: Commit**

```bash
git add js/ux-improvements.js css/ux-improvements.css
git commit -m "$(cat <<'EOF'
Simplify sticky review bar to a single row

Drops the checks-passed chip (one click away in the Checks tab) and
the "Next needs review" button (moving to the Overview tab) so the
sticky bar only shows what's needed without opening anything: decision
status, site progress, and page navigation.
EOF
)"
```

---

## Task 5: Merge the Checks tab into one compact per-page checklist

**Files:**
- Modify: `js/ux-improvements.js` (rewrite `renderReviewDashboard`; remove
  `getPortfolioRows`, `renderPortfolioOverview`, `handleDashboardClick`,
  `handleDashboardChange`, `renderMetric`, `isLong`, `initDashboardListeners`; add
  `window.reviewChecks` export)
- Modify: `css/ux-improvements.css` (remove dead metric-card/grid rules)

**Interfaces:**
- Consumes: `getRuleResultsFor(page, { useEditor })` — existing function
  (`js/ux-improvements.js:60-119`), unchanged, still used internally.
- Produces: **`window.reviewChecks = { getRuleResultsFor }`** — new export. Task 7's
  Overview table calls this to compute a "checks passed/total" column for every page
  (not just the currently open one). `js/ux-improvements.js` loads before
  `js/review-queue.js` in `index.html`'s script order, so `window.reviewChecks` is
  guaranteed to exist by the time Task 7's code runs — no timing workaround needed.

- [ ] **Step 1: Export `getRuleResultsFor` for Task 7 to consume later**

Right after the `getRuleResults` function (`js/ux-improvements.js:121-123`), add:

```js
  function getRuleResults(page) {
    return getRuleResultsFor(page, { useEditor: true })
  }

  // Exposed for js/review-queue.js's Overview tab (loads after this file), which
  // needs to compute a checks passed/total count for every page, not just the one
  // currently open in the editor.
  window.reviewChecks = { getRuleResultsFor }
```

- [ ] **Step 2: Rewrite `renderReviewDashboard` into one merged checklist**

Current code (`js/ux-improvements.js:432-473`):

```js
  function renderReviewDashboard() {
    const dashboard = document.getElementById(DASHBOARD_CORE_ID)
    if (!dashboard) return

    const page = getCurrentPage()
    const seoTitle = getSeoTitle(page)
    const metaDescription = getMetaDescription(page)
    const rules = getRuleResults(page)
    const primaryCta = getValue('ctaInput') || getPrimaryCta(page) || 'None set'

    dashboard.innerHTML = `
      <div class="review-dashboard-grid">
        ${renderMetric('Page type', page.type || 'Missing', 'Karl placement')}
        ${renderMetric('Reading target', page.reading || 'Missing', 'Plain-language target')}
        ${renderMetric('Primary CTA', primaryCta, isLong(primaryCta) ? 'Review label length' : 'Next-step clarity')}
        ${renderMetric('SEO title', `${seoTitle.length}/${SEO_TITLE_LIMIT}`, seoTitle.length <= SEO_TITLE_LIMIT ? 'Ready' : 'Too long')}
        ${renderMetric('Meta description', `${metaDescription.length}/${META_DESCRIPTION_LIMIT}`, metaDescription.length <= META_DESCRIPTION_LIMIT ? 'Ready' : 'Too long')}
        ${renderMetric('Related links', String(countRelatedLinks(page)), 'Dead-end prevention')}
        ${renderMetric('Audience entries', String(Array.isArray(page.audience) ? page.audience.length : 0), 'This page can help if...')}
        ${renderMetric('Page key', getCurrentKey(), 'Workbook sync field')}
      </div>
      <section class="compliance-panel">
        <h3>Karl compliance scorecard</h3>
        <p class="review-decision-note">Live checks update as you edit title, summary, CTA, and search metadata in the sidebar.</p>
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
      ${renderPortfolioOverview()}
    `
  }
```

Replace with:

```js
  function renderReviewDashboard() {
    const dashboard = document.getElementById(DASHBOARD_CORE_ID)
    if (!dashboard) return

    const page = getCurrentPage()
    const rules = getRuleResults(page)

    dashboard.innerHTML = `
      <section class="compliance-panel">
        <h3>Karl compliance checklist</h3>
        <p class="review-decision-note">
          Page key: ${escapeHtml(getCurrentKey())}. Live checks update as you edit title,
          summary, CTA, and search metadata in the sidebar.
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
```

This drops the 8-card metric grid (page type/reading target/CTA/SEO/meta/related
links/audience entries were each already restated inside the 9-rule list's `detail`
text, per `getRuleResultsFor`) and the portfolio grid (moving to the Overview tab in
Task 7). "Page key" — the one metric with no corresponding pass/fail rule — is kept as
a plain line in the intro paragraph rather than dropped, per the spec.

- [ ] **Step 3: Delete the now-unused functions**

Delete `getPortfolioRows` (`js/ux-improvements.js:331-345`):

```js
  function getPortfolioRows(savedPages = {}) {
    return buildPageRows(DATA, (key, label, page) => {
      const rules = getRuleResultsFor(page)
      const failing = rules.filter((rule) => !rule.pass)
      return {
        key,
        title: page.title || label,
        type: page.type || 'Page',
        passed: rules.length - failing.length,
        total: rules.length,
        failingLabels: failing.map((rule) => rule.label),
        decision: savedPages[key]?.decision || 'Needs review',
      }
    })
  }
```

Delete `renderPortfolioOverview` (`js/ux-improvements.js:347-412`) — the full function
that builds the `<section class="portfolio-panel">` markup block.

Delete `handleDashboardClick` (`js/ux-improvements.js:414-420`):

```js
  function handleDashboardClick(event) {
    const rowButton = event.target.closest('[data-portfolio-key]')
    if (!rowButton) return
    const key = rowButton.getAttribute('data-portfolio-key')
    if (!key || !DATA.pages[key]) return
    window.renderPage?.(key)
  }
```

Delete `handleDashboardChange` (`js/ux-improvements.js:422-430`):

```js
  function handleDashboardChange(event) {
    if (event.target.id !== 'portfolioFailingOnly') return
    const checked = event.target.checked
    updateLocalState((state) => {
      state.ui.checks_failing_only = checked
      return state
    })
    renderReviewDashboard()
  }
```

Delete `renderMetric` (`js/ux-improvements.js:679-687`):

```js
  function renderMetric(label, value, help) {
    return `
      <article class="metric-card">
        <span class="metric-label">${escapeHtml(label)}</span>
        <span class="metric-value">${escapeHtml(value)}</span>
        <span class="metric-help">${escapeHtml(help)}</span>
      </article>
    `
  }
```

Delete `isLong` (`js/ux-improvements.js:689-691`):

```js
  function isLong(value) {
    return String(value || '').length > 36
  }
```

Delete `initDashboardListeners` (`js/ux-improvements.js:1130-1136`):

```js
  function initDashboardListeners() {
    const dashboard = document.getElementById(DASHBOARD_CORE_ID)
    if (!dashboard || dashboard.dataset.bound === 'true') return
    dashboard.dataset.bound = 'true'
    dashboard.addEventListener('click', handleDashboardClick)
    dashboard.addEventListener('change', handleDashboardChange)
  }
```

And remove its call from `init()`. Current state at this point (Task 3 already removed
`mountPageSearch()`; `js/ux-improvements.js:1138-1152`):

```js
  function init() {
    initWorkspaceTabs()
    initDecisionQuickActions()
    initDashboardListeners()
    mountCopySummaryButton()
    mountBackupControls()
    mountLocalStorageControls()
    attachRefreshListeners()
    wrapRenderPage()
    applySavedUiPreferences()
    restoreInitialPage()
    refreshUx()
    // Defer one refresh so review-queue.js (loaded next) is ready for sticky bar stats.
    window.setTimeout(refreshUx, 0)
  }
```

Replace with (removes the `initDashboardListeners()` call):

```js
  function init() {
    initWorkspaceTabs()
    initDecisionQuickActions()
    mountCopySummaryButton()
    mountBackupControls()
    mountLocalStorageControls()
    attachRefreshListeners()
    wrapRenderPage()
    applySavedUiPreferences()
    restoreInitialPage()
    refreshUx()
    // Defer one refresh so review-queue.js (loaded next) is ready for sticky bar stats.
    window.setTimeout(refreshUx, 0)
  }
```

(If executing Task 5 out of order, before Task 3, `init()` will still contain
`mountPageSearch()` too — leave that call alone here; it is Task 3's responsibility.)

The Checks tab no longer has any interactive elements needing click/change delegation
(no portfolio rows, no filter checkbox) — it's a pure live-updating readout now.

`getPortfolioRows` was the only caller of `buildPageRows` in this file (it's still used
by `js/interactive-sitemap.js`, a separate module — that usage is untouched). Remove the
now-unused destructured import at the top of the file
(`js/ux-improvements.js:21-39`):

```js
  const {
    escapeHtml,
    getPrimaryCta,
    setPrimaryCta,
    today,
    debounce,
    toCsv,
    downloadFile,
    getStatusChipClass,
    defaultSeoTitle,
    defaultMetaDescription,
    getValue,
    setValue,
    setText,
    buildReviewRecord,
    getCurrentKey,
    countRelatedLinks,
    buildPageRows,
  } = window.utils
```

Replace with:

```js
  const {
    escapeHtml,
    getPrimaryCta,
    setPrimaryCta,
    today,
    debounce,
    toCsv,
    downloadFile,
    getStatusChipClass,
    defaultSeoTitle,
    defaultMetaDescription,
    getValue,
    setValue,
    setText,
    buildReviewRecord,
    getCurrentKey,
    countRelatedLinks,
  } = window.utils
```

- [ ] **Step 4: Remove the dead CSS**

Delete `.review-dashboard-grid` and the `.metric-card*` rules
(`css/ux-improvements.css:570-611`):

```css
.review-dashboard-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0;
}

.metric-card {
  padding: 0.9rem 1rem;
  border-right: 1px solid var(--sfds-border);
  border-bottom: 1px solid var(--sfds-border);
  cursor: help;
}

.metric-card:nth-child(4n) {
  border-right: 0;
}

.metric-label {
  display: block;
  margin-bottom: 0.22rem;
  color: var(--sfds-slate-3);
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.metric-value {
  display: block;
  color: var(--sfds-slate-1);
  font-size: 0.95rem;
  font-weight: 800;
  line-height: 1.25;
}

.metric-help {
  display: block;
  margin-top: 0.22rem;
  color: var(--sfds-slate-3);
  font-size: 0.78rem;
  line-height: 1.3;
}
```

In the `@media (max-width: 1180px)` block (`css/ux-improvements.css:1038-1046`), delete
the whole block — it contains only now-dead rules:

```css
@media (max-width: 1180px) {
  .review-dashboard-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .metric-card:nth-child(2n) {
    border-right: 0;
  }
}
```

In the `@media (max-width: 720px)` block, remove `.review-dashboard-grid,` from the
combined selector (around line 1072-1076):

Current:

```css
  .review-dashboard-grid,
  .review-queue-kpis,
  .compliance-list {
    grid-template-columns: 1fr;
  }
```

Replace with:

```css
  .review-queue-kpis,
  .compliance-list {
    grid-template-columns: 1fr;
  }
```

And delete the `.metric-card { border-right: 0; }` rule (around lines 1082-1084):

```css
  .metric-card {
    border-right: 0;
  }
```

- [ ] **Step 5: Run `bun run validate`**

Run: `bun run validate`
Expected: passes.

- [ ] **Step 6: Manual browser verification**

Run: `bun run dev`, open the tool, open the workspace, click the Checks tab.

- Confirm the Checks tab shows one list of 9 compliance items (Page type, Title,
  Summary, Audience, Primary CTA, Related links, SEO title, Meta description, Reading
  target), each with a pass/fail indicator and its live value — no separate grid of
  metric cards above it, no all-pages portfolio list below it.
- Confirm the intro text above the list shows the current page key.
- Edit the page title in the sidebar (make it too long, over 80 characters) — confirm
  the "Title" item in the Checks list flips to failing live, without needing to click
  anything.
- Switch to a different page — confirm the checklist updates to that page's own values.
- Open devtools console — confirm no errors reference `renderMetric`, `isLong`,
  `getPortfolioRows`, `handleDashboardClick`, or `handleDashboardChange`.

- [ ] **Step 7: Commit**

```bash
git add js/ux-improvements.js css/ux-improvements.css
git commit -m "$(cat <<'EOF'
Merge Checks tab into one compact per-page checklist

Replaces the 8-card metric grid and the separate 9-rule pass/fail list
with a single checklist showing each rule's live value and status
inline. The all-pages portfolio grid that lived here moves to the new
Overview tab (next task); getRuleResultsFor is exposed on
window.reviewChecks so that tab can reuse it.
EOF
)"
```

---

## Task 6: Rename the "Queue" workspace tab to "Overview"

**Files:**
- Modify: `index.html:301-371` (workspace tab markup)
- Modify: `js/ux-improvements.js` (`WORKSPACE_TABS`, three `'queue'` fallback literals)
- Modify: `js/review-queue.js` (`QUEUE_PANEL_ID`, `focusQueueSearch`'s tab selector)
- Modify: `js/keyboard-shortcuts.js` (`selectAllVisible`'s tab selector)

**Interfaces:**
- Consumes: nothing new.
- Produces: no new exports. This is a pure rename — every function signature and every
  module's public API (`window.reviewQueue`, `window.reviewDecisions`,
  `window.reviewChecks`) stays exactly as-is.

**This task must be committed as a single atomic change across all four files.** The
tab id `"queue"` is referenced independently in each file; landing the rename in only
some of them leaves the workspace tabs broken (e.g. `index.html` sends `"overview"` but
`js/ux-improvements.js` still expects `"queue"` as its default, so the tab never
activates correctly). Do not split this task's steps across separate commits.

- [ ] **Step 1: Rename the tab markup in `index.html`**

Current code (`index.html:301-349`):

```html
        <section id="reviewWorkspace" class="review-workspace" hidden aria-label="Review workspace">
          <nav class="review-workspace-tabs" id="reviewWorkspaceTabs" role="tablist">
            <button
              type="button"
              class="review-workspace-tab"
              role="tab"
              data-workspace-tab="queue"
              aria-selected="true"
              aria-controls="reviewWorkspaceQueue"
            >
              Queue
            </button>
            <button
              type="button"
              class="review-workspace-tab"
              role="tab"
              data-workspace-tab="checks"
              aria-selected="false"
              aria-controls="reviewDashboardCore"
            >
              Checks
            </button>
            <button
              type="button"
              class="review-workspace-tab"
              role="tab"
              data-workspace-tab="sitemap"
              aria-selected="false"
              aria-controls="reviewWorkspaceSitemap"
            >
              Sitemap
            </button>
            <button
              type="button"
              class="review-workspace-tab"
              role="tab"
              data-workspace-tab="help"
              aria-selected="false"
              aria-controls="reviewWorkspaceHelp"
            >
              Help
            </button>
          </nav>
          <div
            id="reviewWorkspaceQueue"
            class="review-workspace-panel"
            role="tabpanel"
            data-workspace-panel="queue"
          ></div>
```

Replace with:

```html
        <section id="reviewWorkspace" class="review-workspace" hidden aria-label="Review workspace">
          <nav class="review-workspace-tabs" id="reviewWorkspaceTabs" role="tablist">
            <button
              type="button"
              class="review-workspace-tab"
              role="tab"
              data-workspace-tab="overview"
              aria-selected="true"
              aria-controls="reviewWorkspaceOverview"
            >
              Overview
            </button>
            <button
              type="button"
              class="review-workspace-tab"
              role="tab"
              data-workspace-tab="checks"
              aria-selected="false"
              aria-controls="reviewDashboardCore"
            >
              Checks
            </button>
            <button
              type="button"
              class="review-workspace-tab"
              role="tab"
              data-workspace-tab="sitemap"
              aria-selected="false"
              aria-controls="reviewWorkspaceSitemap"
            >
              Sitemap
            </button>
            <button
              type="button"
              class="review-workspace-tab"
              role="tab"
              data-workspace-tab="help"
              aria-selected="false"
              aria-controls="reviewWorkspaceHelp"
            >
              Help
            </button>
          </nav>
          <div
            id="reviewWorkspaceOverview"
            class="review-workspace-panel"
            role="tabpanel"
            data-workspace-panel="overview"
          ></div>
```

The `checks`/`sitemap`/`help` tabs and their panel ids (`reviewDashboardCore`,
`reviewWorkspaceSitemap`, `reviewWorkspaceHelp`) are unchanged.

- [ ] **Step 2: Rename the fallback literals in `js/ux-improvements.js`**

Change the `WORKSPACE_TABS` constant (`js/ux-improvements.js:15`):

```js
  const WORKSPACE_TABS = ['queue', 'checks', 'sitemap', 'help']
```

to:

```js
  const WORKSPACE_TABS = ['overview', 'checks', 'sitemap', 'help']
```

In `setWorkspaceTab` (`js/ux-improvements.js:515-516`):

```js
  function setWorkspaceTab(tabId) {
    if (!WORKSPACE_TABS.includes(tabId)) tabId = 'queue'
```

to:

```js
  function setWorkspaceTab(tabId) {
    if (!WORKSPACE_TABS.includes(tabId)) tabId = 'overview'
```

In `setWorkspaceOpen` (`js/ux-improvements.js:555-564`):

```js
    updateLocalState((state) => {
      state.ui.workspace_open = isOpen
      if (isOpen && !state.ui.workspace_tab) state.ui.workspace_tab = 'queue'
      return state
    })

    if (isOpen) {
      const state = readLocalState()
      setWorkspaceTab(state.ui.workspace_tab || 'queue')
    }
```

to:

```js
    updateLocalState((state) => {
      state.ui.workspace_open = isOpen
      if (isOpen && !state.ui.workspace_tab) state.ui.workspace_tab = 'overview'
      return state
    })

    if (isOpen) {
      const state = readLocalState()
      setWorkspaceTab(state.ui.workspace_tab || 'overview')
    }
```

In `initWorkspaceTabs` (`js/ux-improvements.js:634-638`):

```js
    const state = readLocalState()
    setWorkspaceOpen(Boolean(state.ui.workspace_open))
    if (state.ui.workspace_open) {
      setWorkspaceTab(state.ui.workspace_tab || 'queue')
    }
```

to:

```js
    const state = readLocalState()
    setWorkspaceOpen(Boolean(state.ui.workspace_open))
    if (state.ui.workspace_open) {
      setWorkspaceTab(state.ui.workspace_tab || 'overview')
    }
```

Also in `setWorkspaceTab`, the sitemap-mount check is unaffected (still compares against
`'sitemap'`, not `'queue'`), so no change needed there.

- [ ] **Step 3: Rename in `js/review-queue.js`**

Change `QUEUE_PANEL_ID` (`js/review-queue.js:7`):

```js
  const QUEUE_PANEL_ID = 'reviewWorkspaceQueue'
```

to:

```js
  const QUEUE_PANEL_ID = 'reviewWorkspaceOverview'
```

In `focusQueueSearch` (`js/review-queue.js:949-960`):

```js
  function focusQueueSearch() {
    const workspace = document.getElementById('reviewWorkspace')
    if (workspace?.hidden) {
      document.querySelector('[data-sticky-action="toggle-workspace"]')?.click()
    }
    const queueTab = document.querySelector('[data-workspace-tab="queue"]')
    if (queueTab?.getAttribute('aria-selected') !== 'true') queueTab?.click()
    const input = document.getElementById('reviewQueueSearch')
    if (!input) return
    input.focus()
    if (typeof input.select === 'function') input.select()
  }
```

to:

```js
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
```

- [ ] **Step 4: Rename in `js/keyboard-shortcuts.js`**

In `selectAllVisible` (`js/keyboard-shortcuts.js:97-113`):

```js
  function selectAllVisible() {
    const workspace = document.getElementById('reviewWorkspace')
    const queueTab = document.querySelector('[data-workspace-tab="queue"]')
    const isQueueVisible =
      workspace &&
      !workspace.hidden &&
      queueTab &&
      queueTab.getAttribute('aria-selected') === 'true'
    if (!isQueueVisible) return

    window.reviewQueue?.selectAllVisible?.()
    window.reviewQueue?.syncSelectionUi?.()
    const count = window.reviewQueue?.getSelectedKeys?.().length || 0
    if (typeof window.showToast === 'function') {
      window.showToast(count ? `Selected ${count} pages` : 'No visible pages to select', 'info')
    }
  }
```

to:

```js
  function selectAllVisible() {
    const workspace = document.getElementById('reviewWorkspace')
    const overviewTab = document.querySelector('[data-workspace-tab="overview"]')
    const isOverviewVisible =
      workspace &&
      !workspace.hidden &&
      overviewTab &&
      overviewTab.getAttribute('aria-selected') === 'true'
    if (!isOverviewVisible) return

    window.reviewQueue?.selectAllVisible?.()
    window.reviewQueue?.syncSelectionUi?.()
    const count = window.reviewQueue?.getSelectedKeys?.().length || 0
    if (typeof window.showToast === 'function') {
      window.showToast(count ? `Selected ${count} pages` : 'No visible pages to select', 'info')
    }
  }
```

- [ ] **Step 5: Run `bun run validate`**

Run: `bun run validate`
Expected: passes.

- [ ] **Step 6: Manual browser verification**

Run: `bun run dev`, open the tool, open the workspace.

- Confirm the first workspace tab is now labeled "Overview" (not "Queue") and is
  selected by default.
- Click through all four tabs (Overview, Checks, Sitemap, Help) — confirm each panel
  still shows its content and the tab underline highlight follows correctly.
- Reload the page — confirm the workspace remembers it was open and which tab was last
  active (this exercises `state.ui.workspace_tab` persistence with the renamed value).
- With an existing saved review from before this change still in localStorage (if you
  have one from Task 1-5 testing), reload and confirm the workspace still opens
  correctly rather than defaulting unexpectedly — this is the specific regression check
  for an old `"queue"` value being coerced to `"overview"` by the `WORKSPACE_TABS`
  fallback guard.
- Press `s` while the Overview tab is open — confirm "select all visible" still works
  (exercises the renamed selector in `js/keyboard-shortcuts.js`).
- Press `q` — confirm it still switches to the Overview tab and focuses its search box
  (exercises the renamed selector in `js/review-queue.js`).

- [ ] **Step 7: Commit**

```bash
git add index.html js/ux-improvements.js js/review-queue.js js/keyboard-shortcuts.js
git commit -m "$(cat <<'EOF'
Rename Queue workspace tab to Overview

Pure rename across the tab markup, its panel id, and every internal
tab-id reference that used the string "queue" as a workspace-tab
identifier. Sets up the next task, which rebuilds this tab's content
into a merged site-wide table.
EOF
)"
```

---

## Task 7: Rebuild the Overview tab as one merged table

**Files:**
- Modify: `js/review-queue.js` (row data, sort/filter, and render logic)
- Modify: `css/ux-improvements.css` (new table styles; remove superseded card/portfolio
  styles)

**Interfaces:**
- Consumes: `window.reviewChecks.getRuleResultsFor(page)` (from Task 5).
- Produces: no new exports — `window.reviewQueue`'s public shape is unchanged (same
  function names: `getQueueRows`, `getQueueStats`, `getNextNeedsReviewKey`,
  `getAdjacentKey`, `getFilter`, etc.), since Task 6 already handled every rename this
  redesign needs at the tab-id level. Only the *content* of `getQueueRows`,
  `getQueueStats`, `matchesFilter`, `compareRows`, `renderReviewQueue`, and
  `handleQueueClick` changes.

This is the largest task in the plan — it's the one place where the old Queue tab and
the old Checks-tab portfolio grid actually merge. Per the spec, this keeps the Queue
tab's existing stats bar, search box, sort dropdown, filter buttons, and bulk-action
bar; it adds a "Checks" column (merged in from the portfolio grid) and reformats rows
from cards into a table.

**Design decision, stated explicitly so it isn't left to guesswork:** rows change from
`<article role="button" tabindex="0">` (the whole card clickable, keyboard-focusable) to
plain `<tr>` elements in a real `<table>`. Mouse users keep "click anywhere on the row to
open that page" (the existing delegated click-to-open behavior in `handleQueueClick` is
kept, just retargeted at `<tr>`). Keyboard users get a dedicated "Open" button per row
instead of relying on a focusable row — `<tr role="button">` doesn't carry table
semantics well, and a real button is a clearer affordance anyway. This means
`handleQueueKeyDown` (which only existed to handle Enter/Space on a focused row) is
removed entirely, since there's no more focusable row to handle that for.

- [ ] **Step 1: Add a "Checks" count to every row in `getQueueRows`**

Current code (`js/review-queue.js:198-241`):

```js
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
        searchText,
      }
    })
  }
```

Replace with:

```js
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
      const rules = window.reviewChecks?.getRuleResultsFor?.(page) || []
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
        searchText,
      }
    })
  }
```

- [ ] **Step 2: Add a "Failing checks" count to `getQueueStats`**

Current code (`js/review-queue.js:243-266`):

```js
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

    return { total, reviewed, stale, unassigned, blocked, byDecision }
  }
```

Replace with:

```js
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
```

- [ ] **Step 3: Add the "Failing checks" filter to `matchesFilter`**

Current code (`js/review-queue.js:268-280`):

```js
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
    return true
  }
```

Replace with:

```js
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
```

- [ ] **Step 4: Add the "checks" sort option to `compareRows`**

Current code (`js/review-queue.js:288-308`):

```js
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

    const priorityDiff = getPriorityRank(b) - getPriorityRank(a)
    if (priorityDiff !== 0) return priorityDiff

    const ageDiff = (b.ageDays || -1) - (a.ageDays || -1)
    if (ageDiff !== 0) return ageDiff

    return a.title.localeCompare(b.title)
  }
```

Replace with:

```js
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
```

- [ ] **Step 5: Rename the persisted UI state bucket from `review_queue` to `overview`**

Current `writeQueueUiState` and `restoreQueueUiState` (`js/review-queue.js:128-154`):

```js
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
      localState.ui.review_queue = {
        filter: state.filter,
        query: state.query,
        sort: state.sort,
      }
      return localState
    })
  }

  function restoreQueueUiState() {
    const queueUi = readLocalState().ui?.review_queue || {}
    state.filter = queueUi.filter || DEFAULT_STATE.filter
    state.query = queueUi.query || DEFAULT_STATE.query
    state.sort = queueUi.sort || DEFAULT_STATE.sort
  }
```

Replace with:

```js
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
```

An old persisted `ui.review_queue` bucket (and the `ui.checks_failing_only` boolean
Task 5 stopped writing) are simply never read by this new code — per the spec's storage
section, no migration is needed; they're just unused entries left in the JSON blob.

- [ ] **Step 6: Rewrite `renderReviewQueue`'s markup as a table**

Current code (`js/review-queue.js:561-717`):

```js
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
    ]

    panel.innerHTML = `
      <section class="review-queue">
        <header class="review-queue-header">
          <div>
            <h3>Review queue</h3>
            <p class="review-queue-subtitle">Triage pages by decision, ownership, staleness, and saved notes. Use checkboxes for bulk updates, or press <kbd>?</kbd> for shortcuts.</p>
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
          <ul class="review-queue-list" aria-label="Pages in review queue">
            ${rows
              .map((row) => {
                const chipClass = getStatusChipClass(row.decision)
                const ownerLabel = row.followUpOwner || 'No owner'
                const notesLabel = row.notes ? 'Notes saved' : 'No notes'
                const ageChipClass = row.isStale ? 'fail' : row.ageDays === null ? 'warn' : 'pass'
                const suggestedOwner = getSidebarReviewerName()
                const isOwnerAssigned =
                  normalize(row.followUpOwner) === normalize(suggestedOwner) && !!row.followUpOwner
                const isSelected = state.selected.has(row.key)

                return `
              <li>
                <article
                  class="review-queue-row${row.key === currentKey ? ' is-current' : ''}${isSelected ? ' is-selected' : ''}"
                  role="button"
                  tabindex="0"
                  data-page-key="${escapeHtml(row.key)}"
                >
                  <label class="review-queue-checkbox" aria-label="Select ${escapeHtml(row.title)}">
                    <input
                      type="checkbox"
                      data-queue-select-key="${escapeHtml(row.key)}"
                      ${isSelected ? 'checked' : ''}
                    />
                  </label>
                  <span class="review-queue-row-body">
                    <span class="review-queue-row-title">${escapeHtml(row.title)}</span>
                    <span class="review-queue-row-meta">${escapeHtml(row.type || 'Page')} · ${escapeHtml(row.key)}</span>
                    <span class="review-queue-row-detail">
                      <span>${escapeHtml(ownerLabel)}</span>
                      <span>${escapeHtml(row.reviewer || 'No reviewer')}</span>
                      <span>${escapeHtml(formatUpdatedAt(row.updatedAt))}</span>
                    </span>
                    <span class="review-queue-actions" aria-label="Queue actions">
                      <button type="button" class="review-queue-action" data-queue-action="assign-me"${isOwnerAssigned ? ' disabled' : ''}>Assign to me</button>
                      <button type="button" class="review-queue-action" data-queue-action="needs-review"${row.decision === 'Needs review' ? ' disabled' : ''}>Needs review</button>
                      <button type="button" class="review-queue-action" data-queue-action="revise"${row.decision === 'Revise and resubmit' ? ' disabled' : ''}>Revise</button>
                      <button type="button" class="review-queue-action" data-queue-action="blocked"${row.decision === 'Blocked' ? ' disabled' : ''}>Blocked</button>
                      <button type="button" class="review-queue-action" data-queue-action="approved"${row.decision === 'Approved' ? ' disabled' : ''}>Approve</button>
                      <button type="button" class="review-queue-action" data-queue-action="approved-with-edits"${row.decision === 'Approved with edits' ? ' disabled' : ''}>Approve w/ edits</button>
                    </span>
                    <span class="review-queue-row-tags">
                      ${row.notes ? `<span class="status-chip">${escapeHtml(notesLabel)}</span>` : ''}
                      ${row.blockers ? '<span class="status-chip fail">Blockers logged</span>' : ''}
                    </span>
                  </span>
                  <span class="review-queue-row-status">
                    <span class="status-chip ${chipClass}">${escapeHtml(row.decision)}</span>
                    <span class="status-chip ${ageChipClass}">${escapeHtml(formatAgeLabel(row))}</span>
                    ${row.followUpOwner ? '' : '<span class="status-chip warn">Needs owner</span>'}
                  </span>
                </article>
              </li>
            `
              })
              .join('')}
          </ul>
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
```

Replace with:

```js
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
            <p class="review-queue-subtitle">Triage pages by decision, checks, ownership, staleness, and saved notes. Use checkboxes for bulk updates, or press <kbd>?</kbd> for shortcuts.</p>
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
                    const ageChipClass = row.isStale ? 'fail' : row.ageDays === null ? 'warn' : 'pass'
                    const checksChipClass = row.checksPassed === row.checksTotal ? 'pass' : 'warn'
                    const suggestedOwner = getSidebarReviewerName()
                    const isOwnerAssigned =
                      normalize(row.followUpOwner) === normalize(suggestedOwner) && !!row.followUpOwner
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
                      <span class="status-chip ${checksChipClass}">${row.checksPassed}/${row.checksTotal}</span>
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
```

- [ ] **Step 7: Update `handleQueueClick` for the "Open" action and the "Next needs review" button**

Current code (`js/review-queue.js:828-894`), focusing on the parts that change. The
`filterButton`, `resetButton`, checkbox-guard, `selectControl`, and `importButton`
blocks at the top are unchanged. The `bulkActionButton` block is unchanged. Only the
`actionButton` block and the trailing generic row-click block change, plus one new
block is inserted for the "Next needs review" button:

Current `actionButton` block (`js/review-queue.js:876-885`):

```js
    const actionButton = event.target.closest('[data-queue-action]')
    if (actionButton) {
      const row = actionButton.closest('[data-page-key]')
      if (!row) return
      const key = row.getAttribute('data-page-key')
      const action = actionButton.getAttribute('data-queue-action')
      if (!key || !action) return
      applyQueueAction([key], action)
      return
    }

    if (event.target.closest('.review-queue-checkbox')) return

    const rowButton = event.target.closest('[data-page-key]')
    if (!rowButton) return
    const key = rowButton.getAttribute('data-page-key')
    if (!key || !DATA.pages[key]) return
    window.renderPage?.(key)
  }
```

Replace with:

```js
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

    const rowButton = event.target.closest('[data-page-key]')
    if (!rowButton) return
    const key = rowButton.getAttribute('data-page-key')
    if (!key || !DATA.pages[key]) return
    window.renderPage?.(key)
  }
```

(`getNextNeedsReviewKey` is already defined earlier in this same file
(`js/review-queue.js:392-398`) and already exported on `window.reviewQueue`, so it's
directly callable here without a `window.` prefix, same as every other in-file helper
this function already calls.)

- [ ] **Step 8: Remove `handleQueueKeyDown` and its listener**

Delete the function (`js/review-queue.js:896-912`):

```js
  function handleQueueKeyDown(event) {
    if (event.key !== 'Enter' && event.key !== ' ') return
    if (
      event.target.closest(
        '[data-queue-action], [data-queue-bulk-action], .review-queue-checkbox, input, select, button'
      )
    ) {
      return
    }
    const row = event.target.closest('[data-page-key]')
    if (!row) return

    event.preventDefault()
    const key = row.getAttribute('data-page-key')
    if (!key || !DATA.pages[key]) return
    window.renderPage?.(key)
  }
```

And remove its registration in `init()` (`js/review-queue.js:962-990`):

```js
    panel.addEventListener('click', handleQueueClick)
    panel.addEventListener('keydown', handleQueueKeyDown)
    panel.addEventListener('input', handleQueueInput)
    panel.addEventListener('change', handleQueueChange)
```

to:

```js
    panel.addEventListener('click', handleQueueClick)
    panel.addEventListener('input', handleQueueInput)
    panel.addEventListener('change', handleQueueChange)
```

- [ ] **Step 9: Rewrite the CSS — remove the old card/portfolio rules, add table rules**

Delete `.review-queue-list` (`css/ux-improvements.css:305-311`):

```css
.review-queue-list {
  display: grid;
  gap: 0.4rem;
  margin: 0;
  padding: 0;
  list-style: none;
}
```

Delete `.review-queue-row`, its hover/focus state, `.is-current`, and `.is-selected`
(`css/ux-improvements.css:347-377`):

```css
.review-queue-row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 0.55rem;
  align-items: start;
  width: 100%;
  border: 1px solid var(--sfds-border);
  border-radius: var(--radius);
  background: var(--sfds-white);
  color: inherit;
  cursor: pointer;
  font: inherit;
  padding: 0.65rem 0.75rem;
  text-align: left;
}

.review-queue-row:hover,
.review-queue-row:focus-visible {
  border-color: var(--sfds-action-blue);
  background: var(--sfds-blue-soft-bg);
}

.review-queue-row.is-current {
  border-color: var(--sfds-action-blue);
  box-shadow: inset 3px 0 0 var(--sfds-action-blue);
}

.review-queue-row.is-selected {
  border-color: var(--sfds-action-blue);
  background: var(--sfds-blue-soft-bg);
}
```

Keep `.review-queue-checkbox` and `.review-queue-checkbox input` (still used inside the
table's select column) — do not delete those.

Delete `.review-queue-row-body` (`css/ux-improvements.css:392-394`):

```css
.review-queue-row-body {
  min-width: 0;
}
```

Keep `.review-queue-row-title`, `.review-queue-row-meta`, `.review-queue-row-detail`,
and `.review-queue-row-tags` — all four are still used inside the new table's page
cell, unchanged.

Keep `.review-queue-actions` and `.review-queue-action*` — still used inside the new
table's actions cell, unchanged.

Delete `.review-queue-row-status` and `.review-queue-row-updated`
(`css/ux-improvements.css:477-490`):

```css
.review-queue-row-status {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.35rem;
  align-items: flex-start;
}

.review-queue-row-updated {
  display: block;
  margin-top: 0.1rem;
  color: var(--sfds-slate-4);
  font-size: 0.68rem;
}
```

Delete the entire `.portfolio-panel` block, through `.portfolio-empty p`
(`css/ux-improvements.css:800-914`) — all of it is superseded by the merged table:

```css
.portfolio-panel {
  padding: 0.9rem 1rem 1rem;
  border-top: 1px solid var(--sfds-border);
}

.portfolio-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.portfolio-panel h3 {
  margin: 0;
  font-size: 1rem;
}

.portfolio-filter-toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  color: var(--sfds-slate-2);
  cursor: pointer;
  font-size: 0.78rem;
  font-weight: 700;
}

.portfolio-filter-toggle input {
  accent-color: var(--sfds-action-blue);
  cursor: pointer;
  width: 1rem;
  height: 1rem;
}

.portfolio-list {
  display: grid;
  gap: 0.4rem;
  margin: 0.65rem 0 0;
  padding: 0;
  list-style: none;
}

.portfolio-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 0.5rem;
  align-items: center;
  width: 100%;
  border: 1px solid var(--sfds-border);
  border-radius: var(--radius);
  background: var(--sfds-white);
  color: inherit;
  cursor: pointer;
  font: inherit;
  padding: 0.55rem 0.7rem;
  text-align: left;
}

.portfolio-row:hover,
.portfolio-row:focus-visible {
  border-color: var(--sfds-action-blue);
  background: var(--sfds-blue-soft-bg);
}

.portfolio-row.is-current {
  border-color: var(--sfds-action-blue);
  box-shadow: inset 3px 0 0 var(--sfds-action-blue);
}

.portfolio-row-title {
  display: block;
  color: var(--sfds-slate-1);
  font-size: 0.86rem;
  font-weight: 800;
  line-height: 1.25;
}

.portfolio-row-meta {
  display: block;
  margin-top: 0.1rem;
  color: var(--sfds-slate-3);
  font-size: 0.72rem;
  font-weight: 600;
}

.portfolio-row-failing {
  display: block;
  margin-top: 0.18rem;
  color: var(--sfds-warning-text);
  font-size: 0.74rem;
  font-weight: 600;
  line-height: 1.3;
}

.portfolio-row-status {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.35rem;
}

.portfolio-empty {
  margin-top: 0.65rem;
  padding: 1rem;
  border: 1px dashed var(--sfds-success-border);
  border-radius: var(--radius);
  background: var(--sfds-success-bg);
}

.portfolio-empty p {
  margin: 0;
  color: var(--sfds-success-text);
  font-weight: 600;
}
```

Add the new table styles in their place (same location, right after
`.review-queue-empty p`, before `.shortcuts-hint-button`):

```css
.review-queue-table-wrap {
  overflow-x: auto;
}

.review-queue-table {
  width: 100%;
  border-collapse: collapse;
}

.review-queue-table th {
  padding: 0.5rem 0.6rem;
  border-bottom: 2px solid var(--sfds-border);
  color: var(--sfds-slate-3);
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.04em;
  text-align: left;
  text-transform: uppercase;
  white-space: nowrap;
}

.review-queue-table td {
  padding: 0.55rem 0.6rem;
  vertical-align: top;
}

.review-queue-table-row {
  border-bottom: 1px solid var(--sfds-border);
}

.review-queue-table-row:hover {
  background: var(--sfds-blue-soft-bg);
}

.review-queue-table-row.is-current {
  box-shadow: inset 3px 0 0 var(--sfds-action-blue);
}

.review-queue-table-row.is-selected {
  background: var(--sfds-blue-soft-bg);
}

.review-queue-table-select {
  width: 2rem;
}

.review-queue-table-checks,
.review-queue-table-decision,
.review-queue-table-owner,
.review-queue-table-updated {
  white-space: nowrap;
}
```

Finally, in the `@media (max-width: 720px)` block, remove the now-dead `.portfolio-row`
overrides (`css/ux-improvements.css:1086-1092`):

```css
  .portfolio-row {
    grid-template-columns: 1fr;
  }

  .portfolio-row-status {
    justify-content: flex-start;
  }
```

No replacement rule is needed for narrow screens — `.review-queue-table-wrap {
overflow-x: auto }` already makes the table scroll horizontally on any viewport too
narrow for it, which is the standard responsive pattern for data tables (as opposed to
reflowing columns, which the old card layout did).

- [ ] **Step 10: Run `bun run validate`**

Run: `bun run validate`
Expected: passes.

- [ ] **Step 11: Manual browser verification**

Run: `bun run dev`, open the tool, open the workspace, click the Overview tab.

- Confirm the Overview tab shows one table with columns: (blank/checkbox), Page,
  Checks, Decision, Owner, Updated, Actions — for every page in the site.
- Confirm the stats bar, search box, sort dropdown (now including "Checks (failing
  first)"), decision filter buttons (now including "Failing checks (N)"), and the
  bulk-select/bulk-action bar above the table all still work exactly as before.
- Click "Failing checks" filter — confirm only pages with at least one failing
  compliance rule show.
- Change sort to "Checks (failing first)" — confirm rows reorder with the
  most-failing-checks pages first.
- Click a row's "Open" button — confirm it navigates to that page in the mockup canvas.
- Click elsewhere on a row (not on a button or checkbox) — confirm it also navigates to
  that page (the preserved mouse click-to-open behavior).
- Click a row's inline "Approve" button — confirm the decision updates without
  navigating away from the Overview tab, and the row's Decision cell updates
  immediately.
- Click "Next needs review" — confirm it jumps to the next page still needing review
  (or shows the "No pages left" toast if none remain).
- Select two rows via their checkboxes, click a bulk action (e.g. "Blocked") — confirm
  both rows update.
- Confirm the Checks tab (from Task 5) still shows only the currently open page's own
  compliance checklist — no portfolio grid duplicated there anymore.

- [ ] **Step 12: Commit**

```bash
git add js/review-queue.js css/ux-improvements.css
git commit -m "$(cat <<'EOF'
Rebuild Overview tab as one merged site-wide table

Merges the old Queue tab's page list with the old Checks tab's
portfolio grid into a single dense table, adding a Checks column and
a "Checks (failing first)" sort / "Failing checks" filter. Keeps the
existing stats bar, search, sort, decision filters, and bulk-action
bar. Rows change from clickable cards to table rows with an explicit
Open button for keyboard navigation; the existing click-anywhere-to-
open behavior is preserved for mouse users.
EOF
)"
```

---

## Task 8: Final verification pass and single-file export regeneration

**Files:**
- No source changes expected in this task (verification only), except regenerating the
  two gitignored single-file exports.

**Interfaces:**
- Consumes: the complete redesigned tool from Tasks 1-7.
- Produces: refreshed `manager-review-single-file.html` and
  `single-file-export-current-source.html` (gitignored, not committed).

- [ ] **Step 1: Run the full validate + build pipeline**

Run: `bun run validate`
Expected: passes.

Run: `node build_scripts/build-single-file.js`
Expected: completes without error, refreshing both single-file HTML exports with the
new markup from Tasks 1-7.

- [ ] **Step 2: Format check**

Run: `bun run format:check`
Expected: passes. If it reports drift on any file touched by Tasks 1-7, run
`bun run format` and re-check.

- [ ] **Step 3: Regression walkthrough against the spec's Testing/verification section**

With `bun run dev` running, work through every item in
`docs/superpowers/specs/2026-07-06-dashboard-redesign-design.md`'s
"Testing / verification" section in one pass:

- With an existing saved review already in localStorage from a pre-redesign session (if
  none exists, first make one, then reload the page to simulate "existing user"), load
  the redesigned tool and confirm that review's decision/notes still appear. This is the
  regression check for keeping the storage key at `v1`.
- Export a review snapshot (sidebar's "Export current review JSON" or "Download backup
  (JSON)"), reload the page, re-import it, and confirm decisions/notes are still present
  afterward (not wiped).
- Confirm the sidebar shows only the 5 sections: Page mockup, Live content editor,
  Search metadata, Karl CMS tags, Manager review.
- Confirm the Help tab shows the 7 guidance cards plus the moved Applied rules and
  Reading targets content.
- Confirm the sticky bar is a single row: decision badge + title on the left,
  progress + Prev/Next + workspace toggle on the right — no checks chip, no "Next needs
  review" button there.
- Confirm the Overview tab is one merged table (not two separate lists anywhere else in
  the tool).
- Confirm the Checks tab shows only the current page's compact checklist.
- Confirm the sidebar's quick-search input is gone; the dropdown, Prev/Next, and Sitemap
  tab all still navigate between pages correctly.
- Open the keyboard shortcuts dialog (`?`) and spot-check 3-4 shortcuts (arrow
  navigation, `n`, `a`/`e`/`r`/`b`/`u` decisions, `s`/`Escape` selection) still work.
- Open devtools console throughout this walkthrough — confirm zero uncaught errors.

- [ ] **Step 4: Commit (only if Step 2 required a format fix; otherwise skip — Task 7 is
already the final source commit)**

```bash
git add -A
git commit -m "$(cat <<'EOF'
Format fixes after dashboard redesign

EOF
)"
```

If `bun run format:check` passed cleanly with no changes needed, there is nothing to
commit in this task — Task 7's commit is the last one, and this task is verification
only. Do not commit the regenerated single-file HTML exports or `data/` — both are
gitignored and must stay that way.

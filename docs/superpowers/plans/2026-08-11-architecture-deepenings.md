# Architecture Deepenings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deepen six shallow modules surfaced by the 2026-08-11 architecture review (`/tmp/architecture-review-20260811-192059.html`), each behavior-preserving unless the task explicitly says otherwise.

**Architecture:** Each task is an independent refactor — no task depends on another completing first, except Task 1 (LinkCommitBridge) is a light prerequisite read by Task 2's EditorSession (Task 2's `commit()` calls `window.InlineEdit.LinkCommitBridge.take()`, which only exists after Task 1 lands). Do Task 1 before Task 2; the other four are order-independent.

**Tech Stack:** Plain browser ES modules (`js/*.js`), Bun test (`tests/*.test.js`), TypeScript for `server.ts` only, CommonJS for `build_scripts/`.

## Global Constraints

- No semicolons, single quotes, 2-space indent, ES5 trailing commas, `printWidth: 100` (Prettier is the only linter) — run `bun run format` before every commit.
- This repo's comment style is **verbose and explanatory**, the opposite of a terse default: every function carries full JSDoc, every non-obvious decision gets a comment stating the WHY. Match the surrounding file's existing voice — do not strip comments down.
- `camelCase` for JS identifiers, `snake_case` only for serialized/CSV data fields (none of these tasks touch serialized fields).
- Every structured `href` goes through `safeUrl()` from `js/utils.js` — none of these tasks add a new href, but if a step touches one, keep it gated.
- Run `bun run test` after every task and confirm the full suite is green before committing. No task in this plan adds a new `tests/*.test.js` file, so `package.json`'s explicit test list and the doc-counts.test.js file-count assertions are untouched — do not add a new test file without also updating `package.json`'s `test` script and the count/name mentions in `CLAUDE.md`/`AGENTS.md` (see `tests/doc-counts.test.js`).
- Conventional-commit prefixes (`fix:`, `feat:`, `refactor:`, `test:`), subject ≤ ~72 chars. Commit after each task, not after each step.
- Do not push. Do not touch `pages/*.js` or `js/page-data.js` — none of these tasks need to.

---

## File Structure

No new files. Every task modifies existing files only:

| File | Task | Role |
|---|---|---|
| `js/inline-content-edit-link-tool.js` | 1 | Owns `LinkCommitBridge`, the link-commit dataset hand-off |
| `js/inline-content-edit.js` | 1, 2 | Reads the bridge in `commit()`; hosts the new `EditorSession` class |
| `tests/inline-content-edit.test.js` | 1, 2 | New `LinkCommitBridge` tests; existing suite re-run as the EditorSession regression proof |
| `js/ux-improvements-state-sync.js` | 3 | Gets the live-object identity assertion in `applySavedPageState` |
| `tests/inline-content-edit-refresh.test.js` | 3 | New test proving the assertion fires on a simulated clone-before-mutate regression |
| `js/page-render.js` | 4 | New `cardActionAndDescription()` helper; `renderCards`/`renderCardList` call it |
| `tests/page-render.test.js` | 4 | New equivalence test pinning identical output before/after |
| `build_scripts/ai/provider-anthropic.js` | 5 | New `classifyAbort()`, mirroring `provider-gemini.js`'s |
| `server.ts` | 5 | `aiErrorResponse()` drops its Anthropic-specific `constructor.name` checks |
| `tests/ai-assist-providers.test.js` | 5 | New tests for `anthropic.classifyAbort()` |
| `js/page-registry-data.js` | 6 | `applyRegistryToData()` stops mutating its `canonicalOrder` parameter, returns it instead |
| `js/page-registry.js` | 6 | `canonicalOrder` becomes `let`, reassigned from the return value |
| `tests/page-registry-data.test.js` | 6 | Two existing tests updated to the new return-value contract |

---

## Task 1: Own the link-commit hand-off with `LinkCommitBridge`

**Files:**
- Modify: `js/inline-content-edit-link-tool.js:31-64` (add the bridge), `:214-220` (use it in `commitLink()`)
- Modify: `js/inline-content-edit.js:698-702` (use it in `commit()`)
- Test: `tests/inline-content-edit.test.js` (append a new `describe` block at the end of the file)

**Interfaces:**
- Produces: `window.InlineEdit.LinkCommitBridge` — `{ stash(holderEl, html): void, take(holderEl): string|undefined }`. `stash` is a no-op if `holderEl` is falsy. `take` returns `undefined` and is a no-op if nothing was stashed for that element, and always clears any stash it finds (idempotent — a second `take()` on the same element always returns `undefined`).

- [ ] **Step 1: Read the current failing shape (no test framework needed — a manual check)**

Run:
```bash
grep -n "hhvcPendingLinkHtml" /home/ohdaveed/HHVC_manager_review_current_tool_package/js/inline-content-edit-link-tool.js /home/ohdaveed/HHVC_manager_review_current_tool_package/js/inline-content-edit.js
```
Expected: two independent occurrences of the literal string `hhvcPendingLinkHtml`, one in each file, with no shared symbol between them. This is the friction the task removes.

- [ ] **Step 2: Add `LinkCommitBridge` to `js/inline-content-edit-link-tool.js`**

Open `js/inline-content-edit-link-tool.js`. Immediately after this existing block (top of the IIFE):

```js
;(function mountInlineContentEditLinkTool() {
  if (typeof window === 'undefined') return
  window.InlineEdit = window.InlineEdit || {}

  const { safeUrl } = window.utils
```

insert the bridge, before the `class InlineEditLinkTool {` line:

```js

  /**
   * Owns the one hand-off point between this file and js/inline-content-
   * edit.js's commit() — the dataset key both sides used to independently
   * spell out as a bare string literal (`holderEl.dataset.hhvcPendingLinkHtml`
   * in both places, agreeing only by convention). See commitLink()'s own
   * comment below for WHY the hand-off exists (an Editor.js blur-cleanup bug
   * that strips a just-inserted anchor before commit() can read it); this
   * object exists so the two files agree on HOW without either retyping the
   * key, and a third caller (or a future rename) has one place to look.
   */
  const PENDING_LINK_ATTR = 'hhvcPendingLinkHtml'
  const LinkCommitBridge = {
    /**
     * @param {HTMLElement|null|undefined} holderEl
     * @param {string} html
     * @returns {void}
     */
    stash(holderEl, html) {
      if (!holderEl) return
      holderEl.dataset[PENDING_LINK_ATTR] = html
    },
    /**
     * @param {HTMLElement|null|undefined} holderEl
     * @returns {string|undefined} the stashed HTML, or undefined if none was
     *   stashed for this element. Always clears the stash it finds, so a
     *   second call on the same element returns undefined.
     */
    take(holderEl) {
      if (!holderEl) return undefined
      const html = holderEl.dataset[PENDING_LINK_ATTR]
      delete holderEl.dataset[PENDING_LINK_ATTR]
      return html
    },
  }
  window.InlineEdit.LinkCommitBridge = LinkCommitBridge
```

- [ ] **Step 3: Point `commitLink()` at the bridge**

In the same file, find:

```js
      const container = range.commonAncestorContainer
      const startEl = container.nodeType === Node.ELEMENT_NODE ? container : container.parentElement
      const editableEl = startEl?.closest('.ce-paragraph')
      const holderEl = editableEl?.closest('[data-inline-edit-editorjs-holder]')
      if (holderEl && editableEl) {
        holderEl.dataset.hhvcPendingLinkHtml = editableEl.innerHTML
      }
```

Replace the last three lines with:

```js
      const holderEl = editableEl?.closest('[data-inline-edit-editorjs-holder]')
      if (holderEl && editableEl) {
        LinkCommitBridge.stash(holderEl, editableEl.innerHTML)
      }
```

(only the body of the `if` changes — `LinkCommitBridge` is in scope via closure, no `window.` prefix needed inside this file).

- [ ] **Step 4: Point the orchestrator's `commit()` at the bridge**

In `js/inline-content-edit.js`, find:

```js
      const pendingLinkHtml = holder.dataset.hhvcPendingLinkHtml
      if (pendingLinkHtml !== undefined) {
        delete holder.dataset.hhvcPendingLinkHtml
        outputValue = { blocks: [{ type: 'paragraph', data: { text: pendingLinkHtml } }] }
      }
```

Replace with:

```js
      const pendingLinkHtml = window.InlineEdit.LinkCommitBridge.take(holder)
      if (pendingLinkHtml !== undefined) {
        outputValue = { blocks: [{ type: 'paragraph', data: { text: pendingLinkHtml } }] }
      }
```

- [ ] **Step 5: Write the new tests**

Open `tests/inline-content-edit.test.js`. At the very end of the file (after the final `})` that closes the `'inline content edit: decoration controls are excluded from PNG export'` describe block), append:

```js

describe('InlineEdit.LinkCommitBridge', () => {
  // window.InlineEdit.LinkCommitBridge is populated once, at file-load time,
  // by the top-of-file `require('../js/inline-content-edit-link-tool.js')`
  // side effect — it is not per-test state and needs no cache-busting import
  // the way the orchestrator itself does.
  test('take() returns the HTML stash()ed for the same holder element', () => {
    const holder = document.createElement('div')
    window.InlineEdit.LinkCommitBridge.stash(holder, '<a data-render-target="foo">bar</a>')
    expect(window.InlineEdit.LinkCommitBridge.take(holder)).toBe(
      '<a data-render-target="foo">bar</a>'
    )
  })

  test('take() clears the stash, so a second call on the same element returns undefined', () => {
    const holder = document.createElement('div')
    window.InlineEdit.LinkCommitBridge.stash(holder, 'x')
    window.InlineEdit.LinkCommitBridge.take(holder)
    expect(window.InlineEdit.LinkCommitBridge.take(holder)).toBeUndefined()
  })

  test('take() on a holder nothing was stashed for returns undefined without throwing', () => {
    const holder = document.createElement('div')
    expect(() => window.InlineEdit.LinkCommitBridge.take(holder)).not.toThrow()
    expect(window.InlineEdit.LinkCommitBridge.take(holder)).toBeUndefined()
  })

  test('stash() on a null holder is a no-op, not a throw', () => {
    expect(() => window.InlineEdit.LinkCommitBridge.stash(null, 'x')).not.toThrow()
  })

  test('two different holders keep independent stashes', () => {
    const a = document.createElement('div')
    const b = document.createElement('div')
    window.InlineEdit.LinkCommitBridge.stash(a, 'A')
    window.InlineEdit.LinkCommitBridge.stash(b, 'B')
    expect(window.InlineEdit.LinkCommitBridge.take(a)).toBe('A')
    expect(window.InlineEdit.LinkCommitBridge.take(b)).toBe('B')
  })
})
```

- [ ] **Step 6: Run the new tests and the full file**

Run: `bun test tests/inline-content-edit.test.js`
Expected: all tests pass, including the 5 new ones under `InlineEdit.LinkCommitBridge` — this file mounts a real Editor.js instance for its other describe blocks, so this run is slower than a typical unit file (this is expected, not a regression).

- [ ] **Step 7: Run the full suite and format check**

Run: `bun run format && bun run test`
Expected: `format` reports no changes needed (or applies trivial whitespace fixes — re-run `bun run test` if it touched anything); `test` passes all 1,383+ tests (5 more than the pre-task baseline).

- [ ] **Step 8: Commit**

```bash
git add js/inline-content-edit-link-tool.js js/inline-content-edit.js tests/inline-content-edit.test.js
git commit -m "refactor: own the link-commit hand-off with LinkCommitBridge

The dataset key linking LinkTool's commitLink() to the orchestrator's
commit() was two independently-typed string literals agreeing only by
convention. LinkCommitBridge gives the hand-off one owned interface."
```

---

## Task 2: Extract `EditorSession` from `openEditorJsEditor`

**Depends on:** Task 1 (this task's `commit()` calls `window.InlineEdit.LinkCommitBridge.take()`).

**Files:**
- Modify: `js/inline-content-edit.js:554-781`
- Test: none new — the existing `tests/inline-content-edit.test.js` suite (40+ tests already exercising open/commit/cancel/stale-edit paths through real DOM + a real `@editorjs/editorjs` instance) is the regression proof. This is a behavior-preserving refactor, not new behavior, so a characterization-test approach (baseline green → refactor → still green, plus one deliberate-breakage check) fits better than inventing new assertions for logic the suite already covers end-to-end.

**Interfaces:**
- Produces: an internal `EditorSession` class (not exported — same visibility as `openEditorJsEditor` today, reachable only through it). `openEditorJsEditor(target)` keeps its exact existing signature and behavior; it now just constructs a session and delegates.

- [ ] **Step 1: Record the baseline**

Run: `bun test tests/inline-content-edit.test.js 2>&1 | tail -5`
Expected: note the exact pass count (should be the full file, 0 failures). This is what Step 3 must still show.

- [ ] **Step 2: Replace `openEditorJsEditor` with `EditorSession` + a thin wrapper**

In `js/inline-content-edit.js`, find the entire block from (inclusive):

```js
  let editorJsHolderCounter = 0

  /**
   * Open a scalar field's editor using @editorjs/editorjs.
```

through the closing `}` of `openEditorJsEditor` (the line right before `/**\n   * Delegated click handler on #mockPage.`). Replace that whole block with:

```js
  let editorJsHolderCounter = 0

  /**
   * Owns one open Editor.js instance's full lifecycle: the re-entrancy guard
   * against Editor.js's undeclared single-block invariant, the stale-edit
   * checks planted after each async boundary (dynamic import, isReady,
   * save()), and the commit/cancel paths — everything openEditorJsEditor()
   * used to hold as closures over one 200-line function body. Pulling these
   * into named methods is what lets isStale() in particular be read (and
   * reasoned about) on its own, rather than requiring a reader to hold the
   * whole function in their head at once.
   *
   * One instance per open field. `editingPath` (module-scope, see its own
   * declaration above) is still the cross-session "is anything open right
   * now" flag — this class only owns what is specific to ONE session; two
   * sessions never coexist because openEditorJsEditor() below refuses to
   * start a second one while editingPath is already set.
   */
  class EditorSession {
    /**
     * @param {object} deps
     * @param {string} deps.path data-rewrite-field path being edited
     * @param {string} deps.key the page key open at the moment editing started
     * @param {object} deps.page the live page object (window.HHVC_DATA.pages[key])
     * @param {string} deps.value the field's current value, read before editing
     */
    constructor({ path, key, page, value }) {
      this.path = path
      this.key = key
      this.page = page
      this.value = value
      this.adapter = window.inlineEditAdapter
      this.fieldType = editorFieldTypeFor(path)
      this.holder = null
      this.editor = null
      this.blockGuardActive = false
      this.settled = false
    }

    /**
     * Whether a different edit has since taken over (a second click, a
     * navigation, a page delete) or this session's holder has been detached
     * from the live #mockPage. Checked after every async boundary — see
     * open()'s two call sites below.
     * @returns {boolean}
     */
    isStale() {
      return editingPath !== this.path || !this.holder || !document.body.contains(this.holder)
    }

    /**
     * Mount the Editor.js instance and wire its commit/cancel listeners.
     * @param {HTMLElement} target the element carrying data-rewrite-field
     * @returns {Promise<void>}
     */
    async open(target) {
      const outputData = this.adapter.pageValueToEditorData(this.fieldType, this.value)

      const holderId = `inline-edit-editorjs-${++editorJsHolderCounter}`
      const widgetHtml = render.editorJsHolderHtml({ path: this.path, id: holderId })
      const wrapper = document.createElement('span')
      wrapper.innerHTML = widgetHtml
      this.holder = wrapper.firstElementChild
      target.replaceWith(this.holder)

      const EditorJS = await loadEditorJs()
      // The click that opened this editor may have been followed by a second
      // click, a navigation, or a page delete while the import above was in
      // flight — isStale() catches all three. Continuing past this point
      // would mount a live Editor.js instance into stale DOM.
      if (this.isStale()) return

      this.editor = new EditorJS({
        holder: holderId,
        data: outputData,
        autofocus: true,
        // Only paragraph/bullet items get bold/link formatting — title,
        // summary, primaryCta, and heading render through a bare escapeHtml()
        // with no formatMarkdown() call (js/page-render.js:216,219,560,631),
        // so offering Bold or Link there would visibly format text while
        // editing and then silently revert to plain on commit (js/inline-
        // content-edit-adapter.js's editingHtmlToPlainText strips both,
        // correctly, since the renderer could never show them anyway) —
        // confusing rather than useful. The explicit ['bold', 'hhvcLink']
        // array (rather than Editor.js's boolean `true`, which would also
        // enable its own built-in 'link' — a block-level preview card, not an
        // inline anchor) is what keeps js/inline-content-edit-link-tool.js's
        // custom tool the only link affordance offered; registering it in
        // `tools` below with `inlineToolbar: false` for scalar fields is
        // harmless, since a tool never referenced in the toolbar array is
        // never shown regardless of being registered.
        inlineToolbar: this.adapter.isItemFieldType(this.fieldType) ? ['bold', 'hhvcLink'] : false,
        minHeight: 0,
        tools: { hhvcLink: window.InlineEdit.LinkTool },
        onChange: (api) => {
          // Enforce the single-block constraint every field this feature
          // edits requires (see the integration plan's "Instance
          // granularity" design: a plain string/tagged-object has no home
          // for a second block). Editor.js has no built-in cap on block
          // count, so a paste or an Enter keypress is trimmed back down here.
          // Re-entrancy guarded, since deleting a block itself fires
          // onChange again.
          if (this.blockGuardActive) return
          const count = api.blocks.getBlocksCount()
          if (count <= 1) return
          this.blockGuardActive = true
          for (let i = count - 1; i >= 1; i--) api.blocks.delete(i)
          this.blockGuardActive = false
        },
      })

      // e2e-only hook: exposes the live instance on its own holder (never a
      // shared/global slot, so nothing to go stale across separate open
      // editors) so tests can trigger Editor.js's OWN inline-toolbar open path
      // (editor.inlineToolbar.open()) directly. Editor.js only populates the
      // toolbar's tool buttons after its own mousedown-driven
      // BlockManager.setCurrentBlockByChildNode has run (UI.documentTouched) —
      // a synthetic Playwright selection with no real mousedown on the
      // redactor leaves that unset, so the toolbar element appears with zero
      // buttons. No production code path reads this property.
      this.holder.__inlineEditEditor = this.editor

      try {
        await this.editor.isReady
      } catch (err) {
        // A real failure mode per Editor.js's own isReady contract, not
        // hypothetical — fall back to cancelling this edit rather than
        // leaving the reviewer looking at a dead holder with nothing to type
        // into.
        editingPath = null
        rerender()
        return
      }
      if (this.isStale()) {
        this.editor.destroy()
        return
      }

      this.holder.addEventListener('focusout', (event) => {
        // Editor.js's inline-formatting toolbar and any tool popover render as
        // a DESCENDANT of this holder — Editor.js nests its own .codex-editor
        // wrapper INSIDE the element it's given as `holder`, with the toolbar
        // and any tool popover nested further inside that — not as a sibling
        // outside holder's subtree. A plain blur/focusout with no containment
        // check would commit the instant a reviewer clicked a toolbar tool
        // (Bold, or js/inline-content-edit-link-tool.js's Link), since that
        // click moves focus off the contenteditable block and onto the tool's
        // own button/input, still within the same holder.
        //
        // holder.contains(nextFocus) is the correct check for that. An earlier
        // version instead walked UP from holder via .closest('.codex-editor')
        // — which can never match, since .codex-editor is a DESCENDANT of
        // holder, never an ancestor, so ownRoot was always null and the check
        // unconditionally committed on every focusout. Measured live with real
        // (non-synthetic) Playwright clicks: clicking the Link tool's button
        // destroyed the whole field before its target-entry input ever
        // appeared, every time — a real Phase 4 bug, not a test-harness
        // artifact, and one Bold had already been carrying silently with zero
        // e2e coverage of any toolbar-tool click.
        const nextFocus = event.relatedTarget
        if (nextFocus instanceof Element && this.holder.contains(nextFocus)) return
        this.commit()
      })
      this.holder.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
          event.preventDefault()
          this.cancel()
        }
      })
    }

    /**
     * Save whatever Editor.js currently holds and write it back onto the
     * page object, or no-op if this session has already settled or been
     * superseded.
     * @returns {Promise<void>}
     */
    async commit() {
      if (this.settled) return
      this.settled = true
      if (editingPath !== this.path) {
        this.editor.destroy()
        return
      }
      let outputValue
      try {
        outputValue = await this.editor.save()
      } catch (err) {
        editingPath = null
        this.editor.destroy()
        rerender()
        return
      }
      // Editor.js's own blur-triggered internal cleanup on the
      // contenteditable runs BEFORE this async commit() ever starts (it
      // fires as part of the same native blur that triggers the holder's
      // 'focusout' listener above, in the target phase, ahead of any
      // ancestor-level bubble-phase listener) — and it strips a link
      // js/inline-content-edit-link-tool.js just inserted, using a
      // narrower rule set than editor.save()'s own sanitizer: measured live
      // via Playwright, calling editor.save() directly immediately after
      // insertion preserves the anchor perfectly (proving this feature's
      // sanitize() config is correct), while the SAME save() call made
      // after a real blur has already occurred returns it silently
      // stripped to plain text — no thrown error, no sanitizer-config
      // fix available on this side of the library. commitLink() therefore
      // captures the block's HTML itself at insertion time, before that
      // blur can run, and stashes it via LinkCommitBridge; prefer that
      // snapshot here over whatever editor.save() returned. Known gap:
      // further edits made after a link commit but before the field is
      // blurred aren't reflected in this stash — acceptable for now given
      // the primary add-link-then-leave-the-field flow this exists for.
      const pendingLinkHtml = window.InlineEdit.LinkCommitBridge.take(this.holder)
      if (pendingLinkHtml !== undefined) {
        outputValue = { blocks: [{ type: 'paragraph', data: { text: pendingLinkHtml } }] }
      }
      // Re-check after the async save — the reviewer may have navigated to
      // a different page while save() was pending, the same race
      // removeListItem's undo callback already guards against above.
      const stillCurrentPage = window.utils.getCurrentKey() === this.key
      const newValue = this.adapter.editorDataToPageValue(this.fieldType, outputValue)
      editingPath = null
      this.editor.destroy()
      if (!stillCurrentPage) return

      const newText = this.adapter.isItemFieldType(this.fieldType) ? newValue.text : newValue
      if (newText === this.value) {
        // Nothing actually changed — compare the adapter's serialized text
        // against the value captured at open, not the raw OutputData,
        // since Editor.js's own block metadata can differ block-for-block
        // even on a true no-op open/close.
        rerender()
        return
      }
      const isPageLevelScalar =
        this.path === 'title' || this.path === 'summary' || this.path === 'primaryCta'
      if (isPageLevelScalar && newText.trim() === '') {
        window.showToast?.(
          "Title, summary, and the primary CTA can't be cleared to blank — edit the text instead of deleting it.",
          'warn'
        )
        rerender()
        return
      }
      if (this.adapter.isItemFieldType(this.fieldType)) {
        setByPath(this.page, this.path, newValue)
      } else {
        writeScalarValue(this.page, this.path, newValue)
      }
      persist()
      rerender()
    }

    /**
     * Discard whatever Editor.js currently holds and re-render the original
     * value, or no-op if this session has already settled or been
     * superseded.
     * @returns {void}
     */
    cancel() {
      if (this.settled) return
      this.settled = true
      if (editingPath !== this.path) {
        this.editor.destroy()
        return
      }
      editingPath = null
      this.editor.destroy()
      rerender()
    }
  }

  /**
   * Open a scalar field's editor using @editorjs/editorjs.
   * js/inline-content-edit-adapter.js is the serialization boundary
   * EditorSession is built around: Editor.js's block-JSON output never
   * becomes the storage format, only a transient editing representation, so
   * every value it ends up writing is exactly the shape writeScalarValue
   * already writes for the plain-widget path.
   * @param {HTMLElement} target the element carrying data-rewrite-field
   * @returns {Promise<void>}
   */
  async function openEditorJsEditor(target) {
    const path = target.getAttribute('data-rewrite-field')
    if (!path || editingPath) return
    const key = window.utils.getCurrentKey()
    const page = window.HHVC_DATA.pages[key]
    if (!page) return

    editingPath = path
    const value = readScalarValue(page, path)
    await new EditorSession({ path, key, page, value }).open(target)
  }
```

- [ ] **Step 3: Run the full file, confirm it still passes**

Run: `bun test tests/inline-content-edit.test.js 2>&1 | tail -5`
Expected: identical pass count to Step 1's baseline, 0 failures. If anything fails, compare the failing test's assertion against the corresponding original closure logic above — the refactor is meant to be a pure reorganization, so a failure means a copy error (a dropped `this.`, a wrong field name), not a design problem.

- [ ] **Step 4: Prove the guard is real — deliberately break `isStale()` and confirm a test catches it**

This mirrors the repo's existing mutation-proof pattern (see `build_scripts/audit-card-inheritance.js`'s header and the AI-rewrite field-addressing test, both described in `CLAUDE.md`).

Temporarily change `isStale()`'s body to:
```js
    isStale() {
      return false
    }
```
Run: `bun test tests/inline-content-edit.test.js 2>&1 | tail -20`
Expected: at least one failure — the suite's own "editingPath is set synchronously by the FIRST click, before Editor.js's own async mount even starts" test (or a sibling stale-edit test) should now fail, proving the guard is load-bearing and actually exercised.

Revert `isStale()` back to its real body:
```js
    isStale() {
      return editingPath !== this.path || !this.holder || !document.body.contains(this.holder)
    }
```
Run: `bun test tests/inline-content-edit.test.js 2>&1 | tail -5`
Expected: back to the Step 1 baseline pass count, 0 failures.

- [ ] **Step 5: Run the full suite and format check**

Run: `bun run format && bun run test`
Expected: no unexpected formatting diffs; full suite green.

- [ ] **Step 6: Commit**

```bash
git add js/inline-content-edit.js
git commit -m "refactor: extract EditorSession from openEditorJsEditor

The 215-line function held four previously-shipped bugs' worth of
fixes as anonymous closures over its own body. EditorSession pulls
the guard, the stale-edit checks, and commit/cancel into named
methods on one instance per open field — same behavior, navigable
shape. Mutation-proven: isStale() hardcoded to false was confirmed
to fail the existing suite before being reverted."
```

---

## Task 3: Assert the live-object invariant `refreshInFlightForKey` depends on

**Files:**
- Modify: `js/ux-improvements-state-sync.js:569` (one line added before the existing `applyContentEditsToPageData` call)
- Test: `tests/inline-content-edit-refresh.test.js` (append one new test)

**Interfaces:**
- No public interface change. `applySavedPageState`'s signature and behavior are unchanged in every normal case; a future regression that reads a clone instead of the live `DATA.pages[pageKey]` object now fails loudly via `console.assert` instead of silently suppressing renders.

- [ ] **Step 1: Write the failing test**

Open `tests/inline-content-edit-refresh.test.js`. This file already exports a `mountStateSyncWithRealReapply()` helper (used by the last existing test) that mounts the module against a `HHVC_DATA.pages` object holding a real page. This test needs a variant where `HHVC_DATA.pages` is a `Proxy` that returns a *different* object on a *second* property access for the same key — simulating a future change where something between the initial `const page = DATA.pages[pageKey]` read and the reapply call re-reads a clone instead of the same live object.

Append this new `describe` block at the end of the file, after the closing `})` of `'applySavedPageState section_edits follow-up render'`:

```js

describe('applySavedPageState asserts page identity before reapplying', () => {
  test('does not fire the identity assertion in normal operation', async () => {
    const assertSpy = spyOn(console, 'assert')
    const { applySavedPageState } = await mountStateSyncWithRealReapply()

    applySavedPageState('pestsTopic')

    // console.assert only logs when its first argument is falsy — so in
    // normal operation (page === DATA.pages[pageKey], which is always true
    // today, since applySavedPageState never reassigns DATA.pages[pageKey]
    // between reading it into `page` and calling
    // applyContentEditsToPageData(page, saved)), it must never have been
    // called with a falsy condition.
    const falsyCalls = assertSpy.mock.calls.filter(([condition]) => !condition)
    expect(falsyCalls).toEqual([])
    assertSpy.mockRestore()
  })

  test('fires the identity assertion when DATA.pages[pageKey] no longer matches the object read at the top of the call', async () => {
    // Simulates the regression this guard exists to catch: a future change
    // that reads DATA.pages[pageKey] a second time (instead of reusing the
    // `page` local) and gets back a clone rather than the live object —
    // which would silently break refreshInFlightForKey's safety argument
    // (see that variable's own comment in js/ux-improvements-state-sync.js).
    // A Proxy simulates this without editing the module under test: the
    // FIRST access to `pestsTopic` (the `const page = DATA.pages[pageKey]`
    // read) returns the real object; a SECOND access (the assertion this
    // task adds, immediately before the reapply call) returns a shallow
    // clone with the same shape but a different identity.
    const realPage = { title: 'T', sections: [{ heading: 'Original', paragraphs: [] }] }
    let accessCount = 0
    const pagesProxy = new Proxy(
      { pestsTopic: realPage },
      {
        get(target, prop) {
          if (prop === 'pestsTopic') {
            accessCount += 1
            return accessCount === 1 ? target.pestsTopic : { ...target.pestsTopic }
          }
          return target[prop]
        },
      }
    )

    let state = {
      version: 1,
      updated_at: '',
      ui: {},
      globals: {},
      pages: { pestsTopic: { section_edits: { 'sections.0.heading': 'Edited' } } },
    }

    global.window = {
      HHVC_DATA: { pages: pagesProxy, order: [['pestsTopic', 'Test']] },
      ORIGINAL_DATA: {
        pages: { pestsTopic: { title: 'T', sections: [{ heading: 'Original', paragraphs: [] }] } },
      },
      reviewState: {
        read: () => state,
        update: (updater) => {
          state = updater(state)
          return state
        },
      },
      reviewMerge: {
        mergeReviewRecord: (existing) => existing,
        combineHistory: (a) => a,
        reviewContentEquals: () => true,
      },
      utils: realUtils,
      inlineEditData: realInlineEditData,
      renderPage: () => {},
    }

    const modUrl = `${MODULE_PATH}?t=${Date.now()}-${Math.random()}`
    await import(modUrl)

    const assertSpy = spyOn(console, 'assert')
    global.window.ReviewUx.stateSync.applySavedPageState('pestsTopic')

    const falsyCalls = assertSpy.mock.calls.filter(([condition]) => !condition)
    expect(falsyCalls.length).toBeGreaterThanOrEqual(1)
    expect(falsyCalls[0][1]).toContain('identity')
    assertSpy.mockRestore()
  })
})
```

Add `spyOn` to the existing top-of-file import (currently `const { describe, test, expect, beforeEach, afterEach } = require('bun:test')`):

```js
const { describe, test, expect, beforeEach, afterEach, spyOn } = require('bun:test')
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `bun test tests/inline-content-edit-refresh.test.js 2>&1 | tail -30`
Expected: the new `'fires the identity assertion when...'` test FAILS (`falsyCalls.length` is 0 — no assertion exists yet to fire). The `'does not fire...'` test passes trivially (no assertion exists to fire falsely either).

- [ ] **Step 3: Add the assertion**

In `js/ux-improvements-state-sync.js`, find:

```js
      const appliedSectionEdits = window.inlineEditData?.applyContentEditsToPageData(page, saved)
```

Replace with:

```js
      // refreshInFlightForKey's whole safety argument (see its own comment
      // above) rests on `page` staying reference-equal to DATA.pages[pageKey]
      // from the read at the top of this function through this exact call —
      // a future change that reads a clone here instead would silently start
      // suppressing renders it shouldn't, with no thrown error to catch it.
      // This turns that invariant loud instead of silent.
      console.assert(
        page === DATA.pages[pageKey],
        'applySavedPageState: page identity drifted from DATA.pages[pageKey] before ' +
          'applyContentEditsToPageData — refreshInFlightForKey depends on in-place mutation ' +
          "of the live object (see the comment above refreshInFlightForKey's declaration)."
      )
      const appliedSectionEdits = window.inlineEditData?.applyContentEditsToPageData(page, saved)
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `bun test tests/inline-content-edit-refresh.test.js 2>&1 | tail -10`
Expected: all tests pass, including both new ones.

- [ ] **Step 5: Run the full suite and format check**

Run: `bun run format && bun run test`
Expected: full suite green.

- [ ] **Step 6: Commit**

```bash
git add js/ux-improvements-state-sync.js tests/inline-content-edit-refresh.test.js
git commit -m "fix: assert the live-object invariant refreshInFlightForKey depends on

The guard's correctness rested entirely on a 45-line comment stating
page must stay reference-equal to DATA.pages[pageKey] — nothing
caught a future clone-before-mutate change. A console.assert makes
that invariant loud instead of silent."
```

---

## Task 4: Collapse `renderCards` / `renderCardList`'s duplicated assembly

**Files:**
- Modify: `js/page-render.js:314-362`
- Test: `tests/page-render.test.js` (append one new equivalence test)

**Interfaces:**
- Produces: an internal `cardActionAndDescription(section, card, opts)` helper (not exported — same visibility as `cardTitle`/`cardDescription` today). `opts` is `{ relNoreferrer?: boolean, externalMarkClass?: string }`, both optional. Returns `{ action: string, desc: string }` where `desc` is already HTML-escaped with the unverified pill appended if applicable (matching what both callers previously built inline).
- `renderCards(cards, section)` and `renderCardList(cards, section)` keep their exact existing signatures and output — this task changes no public behavior.

- [ ] **Step 1: Write the failing regression test**

This is a refactor with two functions ALREADY exhaustively tested by name (`renderCards` directly; `renderCardList` indirectly through `renderResourcesList`, since it is not itself exported). The test to add first is an **equivalence pin**: capture the exact current output for a representative set of cards (url card, target card, inert card, card with `unverified`, card with `fileType`) so the refactor cannot silently change output.

Open `tests/page-render.test.js`. Find the end of the `describe('card title inheritance', ...)` block (search for its closing `})`) and append a new describe block right after it:

```js

describe('renderCards / renderCardList: shared assembly does not change output', () => {
  // Both already have coverage elsewhere (renderCards directly by name;
  // renderCardList indirectly through renderResourcesList, since it is not
  // itself exported). This block pins the exact current output for cases
  // that differ between the two callers — url vs target vs inert, unverified,
  // and fileType — so extracting their shared logic into
  // cardActionAndDescription() cannot silently change what either renders.
  const CARDS = [
    { title: 'External', url: 'https://example.gov/page', text: 'An external link.' },
    { title: 'Internal', target: 'pestsTopic', text: 'An internal link.' },
    { title: 'Inert', text: 'No target or url at all.' },
    {
      title: 'Unverified',
      target: 'pestsTopic',
      text: 'Needs confirming.',
      unverified: true,
      unverifiedReason: 'Pending SME review',
    },
    { title: 'With file badge', url: 'https://example.gov/doc.pdf', fileType: 'PDF' },
  ]

  test('renderCards output for a representative card set', () => {
    expect(ctx.renderCards(CARDS)).toMatchSnapshot()
  })

  test('renderResourcesList (wraps renderCardList) output for the same card set', () => {
    expect(ctx.renderResourcesList(CARDS)).toMatchSnapshot()
  })

  test('renderCards external link uses rel="noopener" (not noreferrer)', () => {
    const html = ctx.renderCards([CARDS[0]])
    expect(html).toContain('rel="noopener"')
    expect(html).not.toContain('noreferrer')
  })

  test('renderResourcesList external link uses rel="noopener noreferrer"', () => {
    const html = ctx.renderResourcesList([CARDS[0]])
    expect(html).toContain('rel="noopener noreferrer"')
  })

  test('renderCards external-link mark carries no class', () => {
    const html = ctx.renderCards([CARDS[0]])
    expect(html).toContain('<span aria-hidden="true">↗</span>')
  })

  test('renderResourcesList external-link mark carries the external-mark class', () => {
    const html = ctx.renderResourcesList([CARDS[0]])
    expect(html).toContain('<span class="external-mark" aria-hidden="true">↗</span>')
  })

  test('renderResourcesList renders a file-type badge; renderCards does not', () => {
    const fileCard = [CARDS[4]]
    expect(ctx.renderResourcesList(fileCard)).toContain('<span class="file-badge">PDF</span>')
    expect(ctx.renderCards(fileCard)).not.toContain('file-badge')
  })
})
```

- [ ] **Step 2: Run it and record the snapshot baseline (pre-refactor)**

Run: `bun test tests/page-render.test.js 2>&1 | tail -40`
Expected: all tests pass, including the two `toMatchSnapshot()` tests (Bun's test runner creates the snapshot file on first run — this captures the CURRENT, pre-refactor output as the baseline). The four explicit `rel=`/mark-class/`file-badge` assertions must also pass against the current code, unchanged.

- [ ] **Step 3: Extract the shared helper**

In `js/page-render.js`, find:

```js
function renderCards(cards = [], section = null) {
  return `<div class="cards">${cards
    .map((c) => {
      const title = cardTitle(section, c)
      const attr = c.url
        ? ' target="_blank" rel="noopener"'
        : c.target
          ? ` data-render-target="${escapeHtml(c.target)}"`
          : ' data-render-inert=""'
      const externalMark = c.url ? ' <span aria-hidden="true">↗</span>' : ''
      const action = c.url
        ? `<a href="${escapeHtml(safeUrl(c.url))}"${attr}>${escapeHtml(title)}${externalMark}</a>`
        : `<button type="button" class="inline-link"${attr}>${escapeHtml(title)}</button>`
      const desc = cardDescription(section, c)
      return `<article class="card">${karlTag(c.karl || 'Linked page item: title + description + link. Use Related section, body link, Resource Collection item, or Agency page link section as appropriate.', 'placement')}<h3>${action}</h3>${desc ? `<p>${escapeHtml(desc)}${c.unverified ? unverifiedPill(c.unverifiedReason) : ''}</p>` : ''}</article>`
    })
    .join('')}</div>`
}
```

through the end of `renderCardList`:

```js
function renderCardList(cards = [], section = null) {
  return `<ul>${cards
    .map((c) => {
      const title = cardTitle(section, c)
      const attr = c.url
        ? ' target="_blank" rel="noopener noreferrer"'
        : c.target
          ? ` data-render-target="${escapeHtml(c.target)}"`
          : ' data-render-inert=""'
      const externalMark = c.url ? ' <span class="external-mark" aria-hidden="true">↗</span>' : ''
      const fileBadge = c.fileType
        ? `<span class="file-badge">${escapeHtml(c.fileType)}</span>`
        : ''
      const action = c.url
        ? `<a href="${escapeHtml(safeUrl(c.url))}"${attr}>${escapeHtml(title)}${externalMark}</a>`
        : `<button type="button" class="inline-link"${attr}>${escapeHtml(title)}</button>`
      const desc = cardDescription(section, c)
      const text = desc
        ? `<p>${escapeHtml(desc)}${c.unverified ? unverifiedPill(c.unverifiedReason) : ''}</p>`
        : ''
      return `<li>${karlTag(c.karl || 'Linked page item: title + description + link', 'placement')}${action}${fileBadge}${text}</li>`
    })
    .join('')}</ul>`
}
```

Replace both functions with:

```js
/**
 * Shared card action + description assembly for renderCards() and
 * renderCardList() — the two callers differ only in wrapper markup (article
 * vs li), the external-link rel value, the external-link mark's class, and
 * whether a file-type badge renders; every other card field resolves
 * identically, and had already drifted apart once when duplicated by hand.
 * @param {{karl?: string}|null|undefined} section Same contract as cardDescription().
 * @param {{title: string, target?: string, url?: string, unverified?: boolean, unverifiedReason?: string}} card
 * @param {{relNoreferrer?: boolean, externalMarkClass?: string}} [opts]
 * @returns {{action: string, desc: string}} desc is '' when there is nothing
 *   to show — callers decide whether an empty desc means no <p> at all.
 */
function cardActionAndDescription(section, card, opts = {}) {
  const { relNoreferrer = false, externalMarkClass = '' } = opts
  const title = cardTitle(section, card)
  const rel = relNoreferrer ? 'noopener noreferrer' : 'noopener'
  const attr = card.url
    ? ` target="_blank" rel="${rel}"`
    : card.target
      ? ` data-render-target="${escapeHtml(card.target)}"`
      : ' data-render-inert=""'
  const markClass = externalMarkClass ? ` class="${externalMarkClass}"` : ''
  const externalMark = card.url ? ` <span${markClass} aria-hidden="true">↗</span>` : ''
  const action = card.url
    ? `<a href="${escapeHtml(safeUrl(card.url))}"${attr}>${escapeHtml(title)}${externalMark}</a>`
    : `<button type="button" class="inline-link"${attr}>${escapeHtml(title)}</button>`
  const descText = cardDescription(section, card)
  const desc = descText
    ? `${escapeHtml(descText)}${card.unverified ? unverifiedPill(card.unverifiedReason) : ''}`
    : ''
  return { action, desc }
}
function renderCards(cards = [], section = null) {
  return `<div class="cards">${cards
    .map((c) => {
      const { action, desc } = cardActionAndDescription(section, c)
      return `<article class="card">${karlTag(c.karl || 'Linked page item: title + description + link. Use Related section, body link, Resource Collection item, or Agency page link section as appropriate.', 'placement')}<h3>${action}</h3>${desc ? `<p>${desc}</p>` : ''}</article>`
    })
    .join('')}</div>`
}
// Shared by renderResourcesList() and (via renderServiceTiles' delegation)
// every Services subsection, plus renderRelatedList() (Task 2) — one <li>
// shape for every plain, divided list of linked-page items. Real sf.gov never
// boxes this content (confirmed against 7 live reference pages spanning
// Agency/Transaction/Information/Resource-Collection shapes — see the design
// spec) — renderCards()/.card above is kept only for the one case that isn't
// a full section of links: a Step List's own inline cards (renderSteps()).
function renderCardList(cards = [], section = null) {
  return `<ul>${cards
    .map((c) => {
      const { action, desc } = cardActionAndDescription(section, c, {
        relNoreferrer: true,
        externalMarkClass: 'external-mark',
      })
      const fileBadge = c.fileType
        ? `<span class="file-badge">${escapeHtml(c.fileType)}</span>`
        : ''
      const text = desc ? `<p>${desc}</p>` : ''
      return `<li>${karlTag(c.karl || 'Linked page item: title + description + link', 'placement')}${action}${fileBadge}${text}</li>`
    })
    .join('')}</ul>`
}
```

(the `// Shared by renderResourcesList()...` comment that used to sit directly above `function renderCardList` is preserved in place, unchanged — only the code below it changes.)

- [ ] **Step 4: Run the tests and confirm the snapshots still match**

Run: `bun test tests/page-render.test.js 2>&1 | tail -40`
Expected: all tests pass, INCLUDING the two `toMatchSnapshot()` tests against the baseline recorded in Step 2 — a snapshot mismatch here means the refactor changed real output and must be fixed before continuing, not accepted by re-recording the snapshot.

- [ ] **Step 5: Run the full suite and format check**

Run: `bun run format && bun run test`
Expected: full suite green (the pre-existing `renderCards`/card-inheritance/card-title describe blocks elsewhere in this same file must still pass unchanged, since `cardActionAndDescription` preserves every branch they exercise).

- [ ] **Step 6: Commit**

```bash
git add js/page-render.js tests/page-render.test.js
git commit -m "refactor: collapse renderCards/renderCardList's duplicated assembly

Both functions reimplemented the same title/action/description
resolution, and had already drifted (renderCardList's rel value and
external-mark class differed from renderCards' with no comment
explaining why). cardActionAndDescription() is the one place that
logic now lives; each caller supplies only its own wrapper markup."
```

---

## Task 5: Normalize Anthropic's own-timeout error at the provider boundary

**Files:**
- Modify: `build_scripts/ai/provider-anthropic.js:1-20` (import), `:146-176` (wrap the SDK call), export block
- Modify: `server.ts:35-41` (comment), `:899-916` (drop the Anthropic-specific `constructor.name` checks)
- Test: `tests/ai-assist-providers.test.js` (append a new describe block, mirroring the existing `'gemini timeout normalization'` block)

**Interfaces:**
- Produces: `anthropic.classifyAbort(error, signal)` — same shape as `provider-gemini.js`'s existing `classifyAbort`: throws `ProviderTimeoutError('claude')` when `error.constructor.name === 'APIConnectionTimeoutError'` and the caller's `signal` was NOT the one that aborted; otherwise rethrows `error` untouched.
- `server.ts`'s `aiErrorResponse()` keeps its exact existing status-code mapping for every case (499/504/422/400/501/500) — this task removes the SDK-specific fallback branch conditions, not the branches themselves, since the generic `errorName === "AbortError"` / `errorName === "TimeoutError"` DOMException checks stay as a provider-agnostic backstop.

- [ ] **Step 1: Write the failing test**

Open `tests/ai-assist-providers.test.js`. Directly after the existing `describe('gemini timeout normalization', ...)` block (before `describe('request schema provider enum', ...)`), insert:

```js

describe('anthropic timeout normalization', () => {
  // Mirrors the gemini block above. Anthropic's SDK, unlike Gemini's, throws
  // a DISTINCTLY-named error for its own per-call deadline
  // (APIConnectionTimeoutError) rather than reusing a generic AbortError — so
  // classifyAbort here matches on constructor.name instead of a bare `name`
  // check, and the caller's signal is consulted only as the same
  // defense-in-depth check gemini's version uses, not as the sole
  // disambiguator.
  class FakeAPIConnectionTimeoutError extends Error {}
  class FakeAPIUserAbortError extends Error {}

  test('raises ProviderTimeoutError when the caller never aborted', () => {
    const error = new FakeAPIConnectionTimeoutError('timed out')
    const signal = new AbortController().signal // never aborted
    expect(() => anthropic.classifyAbort(error, signal)).toThrow(ProviderTimeoutError)
  })

  test('passes the error through untouched when the caller did abort', () => {
    const error = new FakeAPIConnectionTimeoutError('timed out')
    const controller = new AbortController()
    controller.abort()
    expect(() => anthropic.classifyAbort(error, controller.signal)).toThrow(error)
  })

  test('passes a non-timeout error through untouched', () => {
    const error = new FakeAPIUserAbortError('user aborted')
    expect(() => anthropic.classifyAbort(error, new AbortController().signal)).toThrow(error)
  })

  test('passes a plain Error through untouched', () => {
    const error = new Error('upstream exploded')
    expect(() => anthropic.classifyAbort(error, new AbortController().signal)).toThrow(error)
  })

  test('ProviderTimeoutError names claude as the provider that ran out of time', () => {
    const error = new FakeAPIConnectionTimeoutError('timed out')
    const signal = new AbortController().signal
    try {
      anthropic.classifyAbort(error, signal)
    } catch (thrown) {
      expect(thrown).toBeInstanceOf(ProviderTimeoutError)
      expect(thrown.provider).toBe('claude')
    }
  })
})
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `bun test tests/ai-assist-providers.test.js 2>&1 | tail -30`
Expected: `TypeError: anthropic.classifyAbort is not a function` (or similar) — the function does not exist yet.

- [ ] **Step 3: Add `classifyAbort` to `provider-anthropic.js`**

Find the import line:

```js
const { RefusalError } = require('./errors')
```

Replace with:

```js
const { RefusalError, ProviderTimeoutError } = require('./errors')
```

Find:

```js
/**
 * Ask Claude for a JSON object matching `jsonSchema`.
 *
 * @param {object} options
 * @param {string} options.system Byte-stable system prompt (see prompts.js).
 * @param {string} options.userPrompt The request turn.
 * @param {object} options.jsonSchema Structured-output schema.
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<{object: object, model: string, usage: object, rawUsage: object,
 *   stopReason: string}>}
 */
async function generateObject({ system, userPrompt, jsonSchema, signal }) {
  const client = createClient()

  const response = await client.beta.messages.create(
    {
```

Replace with:

```js
/**
 * Normalize the SDK's own per-call deadline into ProviderTimeoutError — the
 * error-classification half of the provider contract provider-gemini.js's
 * classifyAbort also implements, so server.ts needs to know neither SDK's
 * class names to answer 504 rather than a generic 500.
 *
 * Unlike Gemini's SDK, Anthropic's throws a distinctly-named
 * `APIConnectionTimeoutError` for its own deadline (and a separate
 * `APIUserAbortError` when the CALLER's signal aborted it) — so the class
 * name itself already carries the distinction Gemini's classifyAbort has to
 * infer from `signal` alone. `signal` is still consulted here as the same
 * defense-in-depth check, consistent with the SDK's own classification
 * rather than the sole source of truth.
 * @param {unknown} error The error the SDK threw.
 * @param {AbortSignal} [signal] The caller's signal, if any.
 * @throws {ProviderTimeoutError} when the SDK's own deadline aborted the call.
 * @throws {unknown} the original error in every other case.
 * @returns {never}
 */
function classifyAbort(error, signal) {
  const isOwnTimeout = error?.constructor?.name === 'APIConnectionTimeoutError'
  if (isOwnTimeout && !signal?.aborted) throw new ProviderTimeoutError(NAME)
  throw error
}

/**
 * Ask Claude for a JSON object matching `jsonSchema`.
 *
 * @param {object} options
 * @param {string} options.system Byte-stable system prompt (see prompts.js).
 * @param {string} options.userPrompt The request turn.
 * @param {object} options.jsonSchema Structured-output schema.
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<{object: object, model: string, usage: object, rawUsage: object,
 *   stopReason: string}>}
 */
async function generateObject({ system, userPrompt, jsonSchema, signal }) {
  const client = createClient()

  let response
  try {
    response = await client.beta.messages.create(
    {
```

Then find the closing of that same call (further down):

```js
      messages: [{ role: 'user', content: userPrompt }],
    },
    signal ? { signal } : undefined
  )

  // Check stop_reason BEFORE touching content. On a refusal `content` is empty
```

Replace with:

```js
      messages: [{ role: 'user', content: userPrompt }],
    },
      signal ? { signal } : undefined
    )
  } catch (error) {
    classifyAbort(error, signal)
  }

  // Check stop_reason BEFORE touching content. On a refusal `content` is empty
```

Finally, find the export block:

```js
module.exports = {
  name: NAME,
  label: LABEL,
  generateObject,
```

Replace with:

```js
module.exports = {
  name: NAME,
  label: LABEL,
  generateObject,
  classifyAbort,
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `bun test tests/ai-assist-providers.test.js 2>&1 | tail -30`
Expected: all 5 new tests pass, and every pre-existing test in this file still passes (the provider registry contract, RefusalError, Gemini's own classifyAbort tests, and the schema-enum tests are all unaffected).

- [ ] **Step 5: Simplify `aiErrorResponse` in `server.ts`**

Find:

```js
  // `name` stays "Error" on both SDK classes (which is what defeated the
  // original check), so the DOM names are tested separately — those are for a
  // real DOMException raised outside the SDK.
  const errorName = (error as { name?: string })?.name
  const constructorName = (error as { constructor?: { name?: string } })?.constructor?.name
  if (constructorName === "APIUserAbortError" || errorName === "AbortError") {
    return jsonResponse({ error: "Generation was cancelled." }, 499, context.corsHeaders)
  }
  if (constructorName === "APIConnectionTimeoutError" || errorName === "TimeoutError") {
    // Same split as the signal branches above, and for the same reason: the
    // upstream ran out of time while the client sat there waiting. Folding it
    // in with the cancellation codes claims the reviewer walked away, which
    // hides a genuinely slow provider behind a status that reads as "nobody was
    // listening anyway".
    return jsonResponse({ error: "Generation timed out." }, 504, context.corsHeaders)
  }
```

Replace with:

```js
  // Anthropic's own per-call deadline (APIConnectionTimeoutError) and its
  // caller-abort error (APIUserAbortError) are both normalized at the
  // provider boundary now — see provider-anthropic.js's classifyAbort, which
  // mirrors provider-gemini.js's — so this function no longer needs to know
  // either SDK's class names. What's left is a provider-agnostic backstop:
  // a real DOMException named "AbortError"/"TimeoutError" raised somewhere
  // outside a provider's own normalization (e.g. AbortSignal.timeout()
  // firing directly), which every provider's own classifyAbort already
  // rethrows untouched when it doesn't recognize the shape.
  const errorName = (error as { name?: string })?.name
  if (errorName === "AbortError") {
    return jsonResponse({ error: "Generation was cancelled." }, 499, context.corsHeaders)
  }
  if (errorName === "TimeoutError") {
    return jsonResponse({ error: "Generation timed out." }, 504, context.corsHeaders)
  }
```

Also update the historical comment near the top of the file. Find:

```js
// Deliberately NOT importing @anthropic-ai/sdk here. It was imported for its
// error classes alone, as the fallback arm of aiErrorResponse's cancellation
// mapping — but the SDK ships separate require/import builds, so importing it
// here while build_scripts/ai/provider-anthropic.js requires it produced two
// unrelated copies of every class and made those `instanceof` checks
// permanently false. That fallback now matches on `constructor.name`, which
// needs no import and does not care which build threw.
```

Replace with:

```js
// Deliberately NOT importing @anthropic-ai/sdk here. It used to be imported
// for its error classes alone, as the fallback arm of aiErrorResponse's
// cancellation mapping — but the SDK ships separate require/import builds, so
// importing it here while build_scripts/ai/provider-anthropic.js requires it
// produced two unrelated copies of every class and made those `instanceof`
// checks permanently false. That whole fallback has since moved into
// provider-anthropic.js's own classifyAbort (constructor.name matching against
// the SDK copy IT requires, the same copy that threw), mirroring
// provider-gemini.js's classifyAbort — so this file needs no SDK import and no
// SDK-specific knowledge at all anymore.
```

- [ ] **Step 6: Run the existing e2e-level server test for this exact scenario**

Run: `bun test tests/ai-assist-server.test.js -t "answers 504 when the SDK times out before the request budget"`
Expected: PASS. This is `tests/ai-assist-server.test.js`'s `'AI assist API upstream (SDK) timeout'` describe block — it spawns `server.ts` for real, points `ANTHROPIC_TIMEOUT_MS` and `ANTHROPIC_MAX_RETRIES=0` at a deliberately slow stub so the SDK's own deadline fires first, and asserts the response is `504` with `"Generation timed out."`. Before this task, that 504 came from `server.ts`'s `constructor.name` fallback; after, it comes from `provider-anthropic.js`'s `classifyAbort` throwing `ProviderTimeoutError`, caught by the `ProviderTimeoutError` branch in `aiErrorResponse` (unchanged by this task). Identical response, different code path — this test is the regression proof that the move didn't change behavior.

- [ ] **Step 7: Run the full suite and format check**

Run: `bun run format && bun run test`
Expected: full suite green, including the rest of `tests/ai-assist-server.test.js` (in particular the `'AI assist API request timeout'` describe block, which exercises the route-level `AI_REQUEST_TIMEOUT_MS` path and is untouched by this task).

- [ ] **Step 8: Commit**

```bash
git add build_scripts/ai/provider-anthropic.js server.ts tests/ai-assist-providers.test.js
git commit -m "refactor: normalize Anthropic's own timeout error at the provider boundary

aiErrorResponse reverse-engineered Anthropic's SDK class names via a
constructor.name fallback undocumented in the provider contract —
Gemini already normalizes its own timeout into ProviderTimeoutError
at the provider; Anthropic now does the same via classifyAbort,
mirroring provider-gemini.js. A third provider can satisfy the
contract without server.ts learning a new SDK's class names."
```

---

## Task 6: Stop passing `canonicalOrder` as a mutable out-parameter

**Files:**
- Modify: `js/page-registry-data.js:456-529` (`applyRegistryToData`'s doc comment, return shape, and canonical-order accumulation)
- Modify: `js/page-registry.js:78` (`const` → `let`), `:231` (reassign from the return value)
- Test: `tests/page-registry-data.test.js:659-682` (update two existing tests to the new return-value contract; the "tolerates a missing canonical array" test is unaffected)

**Interfaces:**
- `applyRegistryToData(data, registry, stash, canonicalOrder)` keeps its exact same 4 parameters (so `canonicalOrder` is still an accepted READ input, for continuity across calls), but no longer mutates the `canonicalOrder` array argument. Its return value gains a `canonicalOrder` field: `{ added: string[], hidden: string[], dropped: string[], collided: string[], canonicalOrder: string[] }` — the caller is responsible for keeping this returned value and passing it back in on the next call.

- [ ] **Step 1: Update the two existing tests to the new contract (this is the "write the failing test" step for this refactor — the tests fail against current code because they assert on the WRONG thing, not because behavior is missing)**

Open `tests/page-registry-data.test.js`. Find:

```js
describe('applyRegistryToData: canonical order tracking', () => {
  test('records the full site order before hiding anything', () => {
    const data = liveData()
    const canonicalOrder = []
    applyRegistryToData(data, { hidden: { ownerHub: { hidden_at: 'x' } } }, {}, canonicalOrder)
    // ownerHub is in the canonical list even though it was just removed from
    // `order` — that is what lets restore position it again.
    expect(canonicalOrder).toEqual(['pestsTopic', 'ownerHub', 'tenantRights'])
  })

  test('extends the canonical list with a page added later, without rebuilding it', () => {
    const data = liveData()
    const canonicalOrder = []
    applyRegistryToData(data, { hidden: { ownerHub: { hidden_at: 'x' } } }, {}, canonicalOrder)
    // A mid-session add: the same array is reused, so the earlier hidden key
    // must survive rather than being recomputed from the shortened order.
    applyRegistryToData(data, { added: { noiseComplaints: addedEntry() } }, {}, canonicalOrder)
    expect(canonicalOrder).toEqual(['pestsTopic', 'ownerHub', 'tenantRights', 'noiseComplaints'])
  })

  test('tolerates a missing canonical array', () => {
    const data = liveData()
    expect(() => applyRegistryToData(data, { hidden: { ownerHub: {} } }, {})).not.toThrow()
  })
})
```

Replace with:

```js
describe('applyRegistryToData: canonical order tracking', () => {
  // The contract changed from "mutates the passed-in array in place" to
  // "returns the updated order; the caller keeps it and passes it back in
  // next time" — a passed-in array the function never touches is what makes
  // it safe for a second, careless call site to pass a fresh [] without
  // silently corrupting restore ordering (see js/page-registry-data.js's
  // doc comment on applyRegistryToData for the worked example this
  // prevents).
  test('records the full site order before hiding anything', () => {
    const data = liveData()
    const result = applyRegistryToData(data, { hidden: { ownerHub: { hidden_at: 'x' } } }, {}, [])
    // ownerHub is in the canonical list even though it was just removed from
    // `order` — that is what lets restore position it again.
    expect(result.canonicalOrder).toEqual(['pestsTopic', 'ownerHub', 'tenantRights'])
  })

  test('extends the canonical list with a page added later, without rebuilding it', () => {
    const data = liveData()
    const first = applyRegistryToData(
      data,
      { hidden: { ownerHub: { hidden_at: 'x' } } },
      {},
      []
    )
    // A mid-session add: the caller passes the PREVIOUS return value back in,
    // so the earlier hidden key must survive rather than being recomputed
    // from the shortened order.
    const second = applyRegistryToData(
      data,
      { added: { noiseComplaints: addedEntry() } },
      {},
      first.canonicalOrder
    )
    expect(second.canonicalOrder).toEqual([
      'pestsTopic',
      'ownerHub',
      'tenantRights',
      'noiseComplaints',
    ])
    // The array passed IN as the 4th argument is never mutated — this is the
    // whole point of the contract change.
    expect(first.canonicalOrder).toEqual(['pestsTopic', 'ownerHub', 'tenantRights'])
  })

  test('tolerates a missing canonical array', () => {
    const data = liveData()
    expect(() => applyRegistryToData(data, { hidden: { ownerHub: {} } }, {})).not.toThrow()
  })

  test('does not mutate the array passed in as canonicalOrder', () => {
    const data = liveData()
    const input = []
    applyRegistryToData(data, { hidden: { ownerHub: { hidden_at: 'x' } } }, {}, input)
    expect(input).toEqual([])
  })
})
```

- [ ] **Step 2: Run the tests and confirm they fail against current code**

Run: `bun test tests/page-registry-data.test.js -t "canonical order tracking" 2>&1 | tail -30`
Expected: FAIL — `result.canonicalOrder` is `undefined` (the function does not return this field yet), and the new "does not mutate" test also fails (current code mutates `input` in place).

- [ ] **Step 3: Change `applyRegistryToData`'s implementation**

In `js/page-registry-data.js`, find the doc comment and signature:

```js
 * @param {{pages: object, order: Array<[string, string]>}} data usually window.HHVC_DATA
 * @param {{added?: object, hidden?: object}} registry
 * @param {object} [stash] filled with `{index, entry, page}` per hidden key so
 *   restore can put the original tuple back
 * @param {string[]} [canonicalOrder] extended in place with every key present
 *   after the add pass, in order. This is the reference sequence
 *   `restoreOrderIndex()` restores against; see its own comment for why a
 *   remembered numeric index is not enough.
 * @returns {{added: string[], hidden: string[], dropped: string[]}} what actually happened
 */
function applyRegistryToData(data, registry, stash, canonicalOrder) {
  const result = { added: [], hidden: [], dropped: [], collided: [] }
  if (!isPlainObject(data) || !isPlainObject(data.pages) || !Array.isArray(data.order)) {
    return result
  }
```

Replace with:

```js
 * @param {{pages: object, order: Array<[string, string]>}} data usually window.HHVC_DATA
 * @param {{added?: object, hidden?: object}} registry
 * @param {object} [stash] filled with `{index, entry, page}` per hidden key so
 *   restore can put the original tuple back
 * @param {string[]} [canonicalOrder] the caller's PREVIOUS return value's
 *   `canonicalOrder` (or `[]` on the first call). Read only — never mutated.
 *   The reference sequence `restoreOrderIndex()` restores against; see its
 *   own comment for why a remembered numeric index is not enough.
 * @returns {{added: string[], hidden: string[], dropped: string[], collided: string[],
 *   canonicalOrder: string[]}} what actually happened, plus the updated
 *   canonical order — the caller keeps THIS value and passes it back in on
 *   the next call, rather than reusing the same array instance across calls.
 *   Returning it (instead of mutating the 4th argument) is what makes a
 *   second call site safe to pass a fresh `[]`: it gets back a correct,
 *   independent order rather than silently sharing state with the first
 *   call site's array.
 */
function applyRegistryToData(data, registry, stash, canonicalOrder) {
  const result = {
    added: [],
    hidden: [],
    dropped: [],
    collided: [],
    canonicalOrder: Array.isArray(canonicalOrder) ? canonicalOrder.slice() : [],
  }
  if (!isPlainObject(data) || !isPlainObject(data.pages) || !Array.isArray(data.order)) {
    return result
  }
```

Then find:

```js
  /* Learn the canonical sequence BETWEEN the two passes: after adds (so a
     reviewer-created page takes its place in it) and before hides (so it still
     describes the full site rather than whatever is left). The caller keeps the
     same array across calls, so a mid-session hide extends it rather than
     rebuilding it from an already-shortened order. */
  if (Array.isArray(canonicalOrder)) {
    for (const [key] of data.order) {
      if (!canonicalOrder.includes(key)) canonicalOrder.push(key)
    }
  }
```

Replace with:

```js
  /* Learn the canonical sequence BETWEEN the two passes: after adds (so a
     reviewer-created page takes its place in it) and before hides (so it still
     describes the full site rather than whatever is left). result.canonicalOrder
     starts as a COPY of the input above, so a mid-session hide extends the
     caller's previous order rather than rebuilding it from an
     already-shortened one — without ever mutating the array the caller
     passed in. */
  for (const [key] of data.order) {
    if (!result.canonicalOrder.includes(key)) result.canonicalOrder.push(key)
  }
```

- [ ] **Step 4: Update `js/page-registry.js`'s call site**

Find:

```js
  const canonicalOrder = []
```

Replace with:

```js
  let canonicalOrder = []
```

Find:

```js
      const result = applyRegistryToData(DATA, currentRegistry(), hiddenStash, canonicalOrder)
      if (result.dropped.length) {
```

Replace with:

```js
      const result = applyRegistryToData(DATA, currentRegistry(), hiddenStash, canonicalOrder)
      canonicalOrder = result.canonicalOrder
      if (result.dropped.length) {
```

(`restoreOrderIndex(canonicalOrder, ...)` at the other call site, line ~369, needs no change — it reads the module-scope `canonicalOrder` binding, and `let` means that binding always reflects the latest reassignment by the time `restorePage()` runs.)

- [ ] **Step 5: Run the tests and confirm they pass**

Run: `bun test tests/page-registry-data.test.js 2>&1 | tail -20`
Expected: all tests pass, including the 4 in `'applyRegistryToData: canonical order tracking'`.

- [ ] **Step 6: Run the full suite and format check**

Run: `bun run format && bun run test`
Expected: full suite green — in particular `tests/page-registry-data.test.js`'s other describe blocks (add/hide/collision/restore-order-index) are unaffected, since only `canonicalOrder`'s mutation contract changed, not any other field or branch.

- [ ] **Step 7: Manual smoke check of the add/hide/restore flow**

Run: `bun run dev` (if not already running), then in the browser: add a page mockup via the sidebar, hide a different existing page, restore it, and confirm it reappears at its original position in the sidebar order (not appended to the end). This exercises the exact `applySavedRegistry` → `restorePage` → `restoreOrderIndex` chain this task changed the plumbing of, end to end, in the one place no automated test in this repo currently reaches (`js/page-registry.js` itself has no unit-test file — only `js/page-registry-data.js`'s pure functions do).

- [ ] **Step 8: Commit**

```bash
git add js/page-registry-data.js js/page-registry.js tests/page-registry-data.test.js
git commit -m "refactor: return canonicalOrder from applyRegistryToData instead of mutating it

The function's own comment stated a persistent-instance requirement
its signature didn't express — a second call site passing a fresh []
would have silently corrupted restore ordering. It now returns the
updated order; the caller reassigns rather than relying on shared
mutable state."
```

---

## Self-Review

**Spec coverage** — all 6 candidates from the architecture review have a task:
1. LinkCommitBridge — Task 1.
2. EditorSession — Task 2.
3. refreshInFlightForKey assertion — Task 3.
4. renderCards/renderCardList collapse — Task 4.
5. AI provider error classification — Task 5.
6. canonicalOrder out-parameter — Task 6.

**Placeholder scan** — every step shows the actual before/after code or the actual test code; no "add appropriate handling," no "similar to Task N" without repeating the code, no bare TODOs.

**Type/name consistency** — checked across tasks:
- Task 1's `LinkCommitBridge.take()` return type (`string|undefined`) matches Task 2's `commit()` usage (`const pendingLinkHtml = window.InlineEdit.LinkCommitBridge.take(this.holder); if (pendingLinkHtml !== undefined) ...`).
- Task 2's `EditorSession` constructor field names (`path`, `key`, `page`, `value`) match every `this.*` reference inside its own methods.
- Task 5's `classifyAbort(error, signal)` signature and `ProviderTimeoutError(NAME)` construction match `provider-gemini.js`'s existing `classifyAbort` exactly in shape, differing only in the class-name match (`APIConnectionTimeoutError` vs `error?.name === 'AbortError'`) as the task's own rationale explains.
- Task 6's `applyRegistryToData` return shape (`canonicalOrder` field added) matches both call sites updated in `js/page-registry.js` (`canonicalOrder = result.canonicalOrder`) and both rewritten assertions in `tests/page-registry-data.test.js` (`result.canonicalOrder`, not the old mutated-argument form).

No task adds a new `tests/*.test.js` file, so `package.json`'s `test` script and the file-count assertions in `tests/doc-counts.test.js` need no update — verified against `tests/doc-counts.test.js`'s actual checks (file-count equality, not per-file content) before committing to that design choice for every task.

---
name: verify
description: Runtime verification recipe for this repo — how to launch the app, drive the review UI, and observe inline content editing and render behavior in a real browser. Use when verifying that a change actually works in the running app rather than in tests.
---

# Verifying a change in the running app

This tool is a static, data-driven mockup app. Its surface is pixels: the
reviewer clicks the mockup itself, so verification means driving Chromium
against a dev server, not importing modules and calling them.

## Launch

```bash
bun install                 # only needed if node_modules/ is absent
bun run dev                 # Vite dev server on http://127.0.0.1:8080
curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8080/
```

`start-dev.sh` clears a stale listener on the port first, so a second `dev`
run is safe. To compare behavior against an earlier commit, add a worktree and
run a second server on another port:

```bash
git worktree add /tmp/<scratch>/pre-fix <commit>
ln -s "$PWD/node_modules" /tmp/<scratch>/pre-fix/node_modules
cd /tmp/<scratch>/pre-fix && PORT=8099 bun run dev
```

The symlinked `node_modules` makes Vite serve `@fontsource` files from outside
the worktree root, which it refuses with a 403 — two font requests fail in the
console. That is an artifact of the comparison setup, not a product defect.

## Preconditions that decide whether the changed code runs at all

Most of the review layer short-circuits on empty state. A fresh browser
profile therefore exercises none of it. Before driving anything that depends
on saved reviewer state — inline content editing, `applySavedPageState`,
review-queue behavior — seed the state first:

- **A saved section edit is the precondition for the reapply path.**
  `applyContentEditsToPageData` returns `false` immediately when a page's
  record has no `section_edits`, so a page nobody has edited never reaches
  the reapply/repaint logic. Seed it by inline-editing a heading or paragraph
  and blurring, then confirm the value landed:

  ```js
  JSON.parse(localStorage.getItem('hhvcManagerReviewState:v1')).pages.<pageKey>.section_edits
  ```

  `window.reviewState.read()` / `.write(state)` is the supported way to seed
  or inspect it from the console.

- **`pestsTopic` (the default landing page) has no bullet sections.** Use
  `scopeInfo` for anything involving list add/remove; its first five sections
  each carry a bullets array. This matches what
  `tests/e2e/inline-content-edit.spec.js` does and why.

## Driving the inline editors

- Clicking a `[data-rewrite-field]` element opens an Editor.js instance inside
  `.inline-edit-editorjs-holder`; the editable node is
  `.ce-paragraph[contenteditable="true"]`. Blur (click elsewhere, or
  `element.blur()`) is what commits — `EditorSession` commits on `focusout`.
- **Do selection and typing inside a single browser-side evaluation.** Editor.js
  reacts to `selectionchange` asynchronously, so a selection made in one
  Playwright round trip is frequently stale by the time the next one runs; the
  editor can close between calls and the text is lost. `document.execCommand('insertText', …)`
  after `focus()` in one evaluation is the reliable way to type.
- The add/remove controls (`[data-inline-edit-add]`, `[data-inline-edit-remove]`)
  are added by a decoration pass that runs _after_ a render, not by the
  renderer. See the caveat below about when they are missing.

## Observing renders

Everything renders through `window.renderPage` — `js/app.js`'s navigation, the
inline-edit module's own `rerender()`, and `applySavedPageState`'s follow-up —
so one wrapper captures every caller:

```js
window.__renderLog = []
const orig = window.renderPage
window.renderPage = function (...args) {
  window.__renderLog.push(new Error().stack.split('\n').slice(1, 6).join(' | '))
  return orig.apply(this, args)
}
```

Prove the instrument fires before trusting its silence: navigate with the page
picker and confirm a `navigateTo` entry appears. Renders route through
`document.startViewTransition`, so the DOM mutation and the decoration pass
land asynchronously — poll for a few hundred milliseconds rather than reading
the DOM immediately after a render call.

## Known environment caveats

- **A deep-link load (`/?page=<key>`) leaves the mockup undecorated.** No
  `+ Add`, no `×` remove, no Edited badge, indefinitely — the decoration pass
  misses the initial render on that path. Loading `/` and letting the app
  restore the last page decorates normally, as does any later navigation. This
  reproduces on older commits too, so it is a pre-existing condition rather
  than something a change under verification introduced; work around it by
  navigating through the page picker before driving list controls.
- Adding a bullet and typing immediately can still lose the text (issue #118 is
  open). The failing sequence is `addListItem`'s render followed directly by
  `EditorSession.commit` with no repaint between them. Losing text occasionally
  here is the documented residual, not a new regression.
- Playwright MCP uses a persistent browser profile, so reviewer state from an
  earlier session is still in `localStorage`. Inspect it before clearing, and
  clear the state you seeded when finished.

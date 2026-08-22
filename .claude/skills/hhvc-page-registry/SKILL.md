---
name: hhvc-page-registry
description: "HHVC repo: the browser-side add/delete page feature — why page-registry.js must run before state.js's ORIGINAL_DATA clone, why delete means hide, the ORIGINAL_DATA snapshot hazard on restore, prototype-safe page keys, and the import/sync limitations. Load before editing js/core/page-registry*.js."
---

<!-- Extracted from CLAUDE.md/AGENTS.md on 2026-08-13. AGENTS.md remains the
     canonical copy of this content; see "Cross-tool canon" there. -->

# Adding and deleting pages (`js/core/page-registry*.js`)

A reviewer can create a page mockup and delete an existing one from the browser.
Same posture as every other layer here: `pages/*.js` is never written, no backend
is involved, and it works on a purely static build. Three files, mirroring the
inline-content-edit split — `js/core/page-registry-data.js` (pure validation and the
in-place mutation, dual-exported like `js/review/review-merge.js`),
`js/core/page-registry.js` (the bootstrap plus the runtime add/delete/restore API on
`window.pageRegistry`), and `js/core/page-registry-ui.js` (the sidebar controls and
the Help list). No new stylesheet: the sidebar chrome lives in
`css/ux-improvements.css` and the Help list in `css/dashboard.css`, split by
surface so each selector is still declared in exactly one file.

- **`js/core/page-registry.js` runs BEFORE `js/core/state.js`, and that is the load-order
  fact the whole feature rests on.** `js/core/state.js` imports it in place of
  `js/core/page-data.js` (which it imports first itself), so the module graph enforces
  the order rather than `js/main.js` doing it by convention. `ORIGINAL_DATA` is a
  one-time deep clone taken in `js/core/state.js`, and `computeSectionEdits()` returns
  `{}` when a page has no entry in it — so a page added after that clone would
  accept an inline paragraph edit, autosave it, and silently lose it on the next
  load. Applying the registry first puts added pages inside the clone for free;
  a page added mid-session gets `window.ORIGINAL_DATA.pages[key]` seeded
  explicitly, from a **deep clone**, because an alias would make every later
  diff come back clean. Running early also means `js/core/app.js`'s import-time
  `init()` resolves a `?page=` deep link to an added page instead of toasting
  "not a page in this mockup".
- **Storage is `state.globals.page_registry`, as keyed objects rather than
  arrays.** `globals` is the one slot both review-state validators copy through
  untouched (a shallow spread in `js/review/review-state-validation.js`,
  `.passthrough()` in `build_scripts/review-state-schema.js`), so the feature
  needs no validator change and **no storage-version bump** — a bump makes
  `readLocalState()` discard every reviewer's local state. Not `state.pages[key]`:
  `sanitizeReviewRecord` drops anything outside its closed field whitelist, so a
  page object stored there would vanish on the next read. Keyed maps rather than
  arrays because merging two of them is a spread that unions keys, where two
  arrays would concatenate and duplicate every entry on the first import.
- **The corollary is that nothing upstream validates the blob**, so
  `applyRegistryToData()` re-validates every entry itself and **drops what fails
  rather than throwing**. This is not defensive habit: the function runs at the
  root of the module graph, so a throw takes every later module with it and
  leaves the reviewer looking at `index.html`'s static "Loading…" placeholder —
  with no UI left to remove the entry that broke it. Recovery is the sidebar's
  **Clear saved reviews** button, which is why that button now clears the
  registry and reloads (see below).
- **Delete means hide, and it is reversible.** Uniform across both kinds of page:
  an added page keeps its object in `registry.added`, an authored one comes back
  from its own source module on the next load. The review record is never
  touched, which is what makes Restore worth having. `pestsTopic` is refused
  outright — `bun run validate` requires it to exist and be first, and it is the
  fallback key in `resolvePageKey`, `getCurrentKey`, `js/core/state.js`, `js/core/app.js`
  and the hardcoded parent link on every other page. Emptying `order` is refused
  too.
- **A hidden page leaves `order` AND `HHVC_PAGES`.** Leaving it in `pages` is the
  subtler bug: with no `<option>` in the picker, `getCurrentKey()` falls back to
  `'pestsTopic'`, so every later review write for that page is filed under the
  wrong key. Removing it also makes the queue's selection paths self-heal, since
  `getSelectedKeys`/`pruneSelection`/`toggleSelected`/`getActionTargets` all
  already gate on `DATA.pages[key]`. Restore splices the stashed `[key, label]`
  tuple back at its **original index** — `order` is the reviewer's reading order
  and drives `j`/`k` navigation, the queue, the picker and batch PNG export, so
  appending would silently permute the site.
- **Deleting the page on screen needs an explicit sequence, and the failure it
  avoids is review-data loss.** `reviewFormPageKey` (`js/review/ux-improvements.js`)
  stays pinned to the deleted key until the follow-up navigation settles, so an
  autosave landing in that window calls `collectCurrentPageReviewState(key)`
  where `DATA.pages[key] || {}` makes `page_title`, `edited_title`,
  `edited_summary` and `section_edits` all resolve empty — rewriting the record
  with exactly the content Restore exists to bring back, blanked. So
  `deletePage()` flushes first (via the newly published
  `window.ReviewUx.flushPendingPersist`), then mutates, then rebuilds the picker,
  then navigates through `window.renderPage`. Flushing rather
  than discarding: those keystrokes are real edits to the page being deleted, and
  at flush time that page still exists, so the save is well formed — and it
  leaves `pendingPersist` false, making the before-render hook's own
  pre-navigation flush a no-op instead of a second write.
- **It also consumes the queue's one-step undo.** `undoLastAction` is the only
  queue path that does NOT filter on `DATA.pages`, so a snapshot taken before a
  delete would still offer "Undo Approved · N pages" and then write a record for
  a page that is gone, with a count that is a lie.
- **The delete confirmation counts inbound links, because the consequence is
  otherwise invisible.** Once `pageData[card.target]` stops resolving,
  `cardDescription()` falls through to `return card.text ?? ''` — so every
  inheriting card pointing at the deleted page starts printing the authored text
  that the whole card-inheritance change exists to prove can never publish.
  Nothing errors; a plausible paragraph simply appears on a page the reviewer was
  not looking at. `cardTitle()` reverts to the stale authored title the same way,
  and clicking such a card raises a red "Unknown page key" banner that reads as
  corruption for a state the reviewer created on purpose. `countInboundLinks()`
  counts `card.target` and section/step `buttonTarget` references and the dialog
  names them.
- **`js/review/review-ops.js`'s `siteKeys()` counts a deleted page as still known.** Its
  record is not orphaned — it is what Restore returns — so listing it under
  "Records for pages that no longer exist" would put a delete button in front of
  a review one click from recovery. The widening is skipped when the key set is
  empty, because empty means page data has not loaded and
  `findOrphanedRecords()` reads that as "report nothing"; adding keys to an empty
  set would defeat that guard.
- **The import path applies the registry BEFORE its `entries` filter.** That
  filter requires `DATA.pages[key]`, so otherwise every imported review record
  belonging to an added page is dropped silently and the reviewer is told
  "imported N reviews" with no pages to show. The apply persists through its own
  `reviewState.update`, which is what keeps the existing `reviewer`/`owner`
  `globals` allowlist safe to leave alone: `updateLocalState` re-reads state, so
  the `...state.globals` spread carries the merged registry forward. Local wins
  on a key collision. The "no reviews matching the current page list" early
  return is also relaxed, since a backup can legitimately carry pages and no
  matching reviews.
- **Clear saved reviews now reloads.** It removes the storage key, and
  `js/core/page-registry.js` has already mutated `window.HHVC_DATA` from that key —
  so without a reload the added pages stay in `order` and the picker while the
  registry explaining them is gone, leaving the Help list empty and Restore
  impossible, and the added pages vanishing silently on the next load. The reload
  is what un-mutates `HHVC_DATA`, and it is also what makes this button the
  recovery path for an unusable registry.
- **No undo toast, deliberately.** `showToast` self-dismisses after 4s and its own
  docblock argues that anything needing longer belongs in a persistent control —
  which is why the queue's undo sits in the bulk bar. The Help list's Restore
  **is** that control, and a second printing of the same affordance is what the
  UX-review notes above say to resist.
- **The new-page form asks only for the six fields the schema requires**, plus
  the key and an optional slug. Everything else is filled in afterwards with the
  click-to-edit inline editing that already exists; duplicating that here would
  be a second, worse editor. The starter section carries a non-empty `karl` note
  saying no Karl block has been chosen — required on every section by
  `build_scripts/schema.js`, and the one section field that is optional on cards,
  callouts and images, so it is exactly the one a generated section forgets. It
  also carries `open: true`, because a Transaction page renders its body sections
  as accordions and a brand-new page whose only content is collapsed reads as an
  empty page.
- **`type` is constrained to the five the picker groups by**, which is
  deliberately narrower than `build_scripts/schema.js` (bare `min(1)`). Authored
  pages legitimately use `Agency` and `Report` and land in the Information
  optgroup; a reviewer choosing from a `<select>` should not be able to create
  that mismatch by accident.
- **A page key is constrained to `/^[A-Za-z][A-Za-z0-9]*$/` and rejects
  `__proto__`/`prototype`/`constructor`.** The key becomes an object property on
  `window.HHVC_PAGES`, an `<option>` value and a `?page=` parameter.
  `js/review/ui-controls.js:128` also now escapes it — that was the one place in the
  codebase interpolating a page key into `innerHTML` raw, safe only while every
  key was hardcoded in a source file.
- **Uniqueness is checked against `HHVC_DELETED_PAGE_ALIASES` too.** An added key
  shadowing a retired one is harmless to `resolvePageKey` (it checks `pageData`
  first), but it silently redirects a legacy shared link to content its author
  never wrote — worse than the consolidation redirect it replaced.
- **A deleted page KEEPS its `ORIGINAL_DATA` snapshot, and restore never
  re-seeds one that exists.** This is the sharpest edge in the feature and it was
  wrong first time round. Restore used to re-seed the pristine snapshot from the
  stashed page object — which for a mid-session delete is the _already edited_
  live object. That makes "original" equal "edited", so `computeSectionEdits()`
  finds no difference, the next autosave recomputes `section_edits` as empty, and
  every heading, paragraph and bullet edit the reviewer made is dropped from
  storage. "Reset to original" resets to the edit. Nothing errors at any point.
  So `deletePage()` leaves the snapshot alone (a snapshot for a temporarily
  absent page costs nothing) and `seedOriginalDataIfMissing()` only ever fills a
  gap — the gap being a page hidden in an _earlier_ session, whose stashed copy
  is pristine because no edits had been applied when the boot-time hide captured
  it. Only `removeAddedPage()` drops a snapshot, because only there is the page
  gone for good. Mutation-proven by
  `tests/e2e/page-registry.spec.js`'s "an inline edit survives delete and restore
  of the same page", which was confirmed to fail against the overwrite.
- **Restore positions against a canonical key sequence, not a remembered
  index.** The index recorded at hide time is measured against an order that
  earlier hides have already shortened, so two hides can record the _same_
  number: delete B then C from `[A,B,C,D]` and both stash index 1. Restoring them
  yields `[A,C,B,D]` — the reviewer's reading order silently permuted, which is
  what drives `j`/`k`, the queue, the picker and batch PNG export.
  `restoreOrderIndex()` instead inserts before the first canonical successor
  currently present, which is order-independent; `applyRegistryToData()` learns
  that sequence between its add and hide passes so it describes the whole site
  rather than what is left of it.
- **The JSON import admits a key the registry knows, not just one in
  `DATA.pages`.** `applyImportedRegistry()` runs first and removes the backup's
  deleted pages, so a presence-only filter drops exactly the reviews a reviewer
  deleted a page _without_ losing — and restoring it afterwards hands back the
  mockup with no review attached. `window.pageRegistry.knownKeys()` is what
  widens the filter.
- **An import that deletes the open page has to navigate, not just repaint the
  picker.** Otherwise `#mockPage` still shows the deleted page while
  `#pageSelect` has moved on, and the import's own
  `applySavedPageState(getCurrentKey())` patches that stale DOM and files later
  edits under the replacement key — the same mismatch `deletePage()` guards,
  reached through import instead of a button.
- **`restorePage()` clears the persisted `hidden` flag last.** Clearing it first
  means a restore that cannot materialise the page returns an error having
  already recorded the page as not hidden: the row disappears from the Help
  list while the page is still absent from the mockup, leaving the reviewer no
  control for it at all. The one exception is the no-stash branch, which must
  clear the flag before `applySavedRegistry()` because that reads the persisted
  registry — and it puts the flag back if the page still fails to appear.
- **A page key may not be any name inherited from `Object.prototype`, and
  presence checks use `hasOwn`.** `toString`, `valueOf` and `hasOwnProperty` all
  satisfy the key pattern and are invisible to `Object.keys()`, so the collision
  check called them free — and then `data.pages.toString` resolved to the
  inherited _function_, which is truthy, so the "already present, skip" branch
  fired, the page was never inserted, and `addPage()` reported success and asked
  `renderPage()` to display a function. Measured, not theorised. The unsafe-key
  set is derived from `Object.getOwnPropertyNames(Object.prototype)` rather than
  written out so it cannot fall behind the runtime.
- **Restore leaves the picker on the page actually being shown.** Selecting the
  restored key without rendering it is `deletePage()`'s mismatch pointing the
  other way: `getCurrentKey()` returns the restored key while `#mockPage` still
  shows the previous page, so the next note is filed under the restored page —
  and the reviewer cannot navigate to it, because the picker already claims it is
  current. Restoring from a panel in Help should not yank the mockup either.
- **`exportSavedLocalReviewsCsv()` iterates `order` PLUS the registry's known
  keys.** A deleted page keeps its review — that is what Restore hands back — but
  it leaves `order`, so iterating `order` alone silently dropped those reviews
  from the CSV. Its page metadata falls back to the record's own
  `page_title`/`page_type`/`url_slug` rather than `{}`, which would have made
  `defaultSeoTitle()` emit the literal "undefined | San Francisco".
- **An added key that is really an authored page is refused, not adopted.** An old
  backup can carry `added.foo` for a key that has since shipped in `pages/*.js`.
  `applyRegistryToData()` reports it in `collided` rather than passing over it,
  because the same "a page already occupies this key" condition also covers a
  harmless idempotent re-apply — only the caller can tell them apart, which is why
  `js/core/page-registry.js` captures the authored-key set from `DATA.pages` BEFORE the
  registry has ever run. Without that distinction the Help panel presents an
  authored page as reviewer-created and Remove deletes it from the live mockup, so
  `listAdded()` filters authored keys out and `removeAddedPage()` refuses them.
- **`updateRegistry()` verifies the write by re-reading it.** `reviewState.update()`
  cannot fail loudly: `writeLocalState()` catches the `setItem` exception itself
  (storage disabled or quota exhausted), shows the global error banner, and
  returns normally. A caller trusting it would mutate live page data, report
  success and toast "Added" for a page that is gone on the next reload — so
  `addPage()`/`deletePage()` abort before touching anything when the write did not
  land.
- **`isValidPageObject()` checks the optional structure too, not just the required
  six.** `sections: {}` satisfied every required-field rule, and
  `partitionSections()` does `(page.sections || []).entries()` — a plain object is
  truthy, so the `|| []` never fires and `.entries` is undefined. That is a
  TypeError at render time, reachable at startup from a saved `last_page_key` or a
  `?page=` deep link, which is precisely the fatal-throw-on-the-boot-path the
  drop-don't-throw posture exists to avoid. The added checks match
  `build_scripts/schema.js` exactly (a section requires `heading` and `karl`
  there), so they cannot reject a page CI would accept.
- **The delete confirmation counts INLINE markdown links too, not just cards and
  buttons.** `formatMarkdown()` turns `[label](pageKey)` into a real
  `data-render-target` navigation control, so a page can be linked to entirely
  through prose — and counting only structured targets reported "nothing links
  here" for exactly those pages, which is the dialog failing at the one job it
  has. `countInboundLinks()` scans paragraphs, bullets, table cells, callouts and
  step text, in both the bare-string and `{text}` forms.
- **`restorePage()` rolls the live restore back when the persist fails.**
  Reporting success while the stored registry still says "hidden" is the worst
  available outcome: the page is in the mockup now and gone again after a reload,
  with the reviewer told it was restored. Leaving it deleted is at least the state
  that survives, so a failed write undoes the `order`/`pages` mutation, puts the
  stash entry back, and returns the storage-failure message.
- **`isValidPageObject()` validates the ARRAY-typed section fields too.** The
  section guard originally stopped at `heading`/`karl`, so `paragraphs: {}` still
  passed and `paragraphList()` mapped over it — the same render-time throw a
  non-array `sections` caused, one level deeper. `SECTION_ARRAY_FIELDS` names the
  five (`paragraphs`, `bullets`, `cards`, `table`, `steps`); all five are arrays
  in `build_scripts/schema.js`, so requiring it rejects nothing CI accepts.
- **Limitations, documented rather than fixed.** An added page travels in the
  **JSON backup only**; CSV has no column for a page object, mirroring the
  existing `section_edits` limitation. Sync is subtler: `pushAllPages` iterates
  `Object.keys(state.pages)` unfiltered, so an added or deleted page's review
  **record does get pushed**, but `pullFromServer` skips keys with no live page
  and `server.ts` always returns `globals: {}` — so the **registry itself never
  syncs**, and the receiving browser gets a record with no page to attach it to.
  `bun run validate` never sees any of this; the browser-side check stands in
  for it. Not in v1: emitting a committable `pages/<key>.js` source module (the
  AI-assist panel's `buildPageModuleSource()` is the thing to model it on), and
  reordering `order` from the UI.

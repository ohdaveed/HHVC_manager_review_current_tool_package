# SF.gov Visual Fidelity De-boxing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the mockup's Services/Resources/Related/Steps/Contact/eyebrow/breadcrumb/footer match the plain, unboxed visual language confirmed against 7 live sf.gov reference screenshots, per `docs/superpowers/specs/2026-08-09-sfgov-visual-fidelity-deboxing-design.md`.

**Architecture:** All boxed-card rendering (Services, Related, and the generic cards fallback) converges on one shared plain-list renderer instead of three near-duplicate boxed/unboxed implementations. Steps and Contact us lose their box via CSS only — no markup changes. The breadcrumb is replaced by a new pure, testable `renderParentLink()` function. The eyebrow and what-to-know changes are small, targeted edits to existing render functions.

**Tech Stack:** Vanilla JS (ES modules), Bun test, Playwright e2e, hand-authored CSS with design tokens in `css/theme.css`.

## Global Constraints

- No semicolons, single quotes, 2-space indent, ES5 trailing commas — run `bun run format` before every commit (Prettier is the lint gate: `bun run format:check`).
- `js/*.js` are ES modules — `import`/`export` with explicit `.js` extensions.
- Every value reaching `innerHTML` must go through `escapeHtml`; every href through `safeUrl`.
- No new npm dependencies. Task 9's footer icons are self-hosted inline SVG, not an icon font or CDN asset.
- Run `bun run test` after every task in this plan (it touches shared render/CSS used by all 22 pages). Run `bun run validate` once at the end (no schema changes are made, but it's cheap insurance). Run the specific affected `bun run test:e2e` spec(s) named in each task, and the full e2e suite once at the end (Task 10).
- Commit after each task with a Conventional Commits prefix (`fix:`/`refactor:`/`style:`), per this repo's commit convention.

---

### Task 1: Merge Services rendering into a shared plain-list renderer

Real sf.gov never boxes Services subsection links — `.service-tile` (`css/styles.css:986`, a 2px solid blue border) has no equivalent in any of the 7 reference screenshots. `renderResourcesList()` already renders the correct plain, divided-list shape. This task extracts the per-item `<li>` markup both functions need into one shared helper, rewrites `renderResourcesList()` to use it, and makes `renderServiceTiles()` delegate to `renderResourcesList()` — keeping `renderServiceTiles`'s name and 2-arg signature intact (existing tests call it directly) while changing what it produces.

**Files:**
- Modify: `js/page-render.js:320-390` (`renderCards`, `renderServiceTiles`, `renderResourcesList`), `js/page-render.js:573-577` (`renderSectionInner`'s cards branch)
- Modify: `css/styles.css:976-1011` (`.section--services .cards`/`.service-tiles`/`.service-tile*`), `css/styles.css:1139-1141` (media query)
- Modify: `tests/page-render.test.js:126-136` (unverified-pill assertions), `tests/page-render.test.js:594`, `:682` (signature call sites), `tests/page-render.test.js:598-603` (empty-description test)
- Modify: `tests/e2e/accessibility.spec.js:63` (selector)

**Interfaces:**
- Produces: `renderCardList(cards, section)` — internal helper, not exported, returns a `<ul>...</ul>` string.
- Produces: `renderResourcesList(cards = [], section = null)` — **signature change**: the `heading` parameter is removed (it duplicated the `<h2>` `renderSection()` already prints — see step 1 comment). Later tasks (Task 2) reuse `renderCardList`.
- Consumes: existing `cardTitle`, `cardDescription`, `escapeHtml`, `safeUrl`, `karlTag`, `unverifiedPill` (all already defined earlier in `js/page-render.js`, unchanged).

- [ ] **Step 1: Update the two call sites that break under the new `renderResourcesList` signature, and the two tests exercising it directly, first — so this task can be verified failing before the implementation change**

Edit `tests/page-render.test.js:594`:
```js
    expect(ctx.renderResourcesList([card], inheritsSection)).toContain(expected)
```
(was `ctx.renderResourcesList([card], 'Resources', inheritsSection)`)

Edit `tests/page-render.test.js:682`:
```js
    expect(ctx.renderResourcesList([card], inheritsSection)).toContain(scopeInfoTitle)
```
(was `ctx.renderResourcesList([card], 'Resources', inheritsSection)`)

Edit `tests/page-render.test.js:126-136` (the two `renderServiceTiles` unverified-pill tests — new expected markup matches what `renderResourcesList` already produces at line 140):
```js
  test('renderServiceTiles appends an unverified pill when card.unverified is true (button branch, no url)', () => {
    const html = ctx.renderServiceTiles([{ title: 'Tile', text: 'Claim', unverified: true }])
    expect(html).toContain('<p>Claim<span class="unverified-pill">')
  })

  test('renderServiceTiles appends an unverified pill when card.unverified is true (anchor branch, with url)', () => {
    const html = ctx.renderServiceTiles([
      { title: 'Tile', text: 'Claim', url: 'https://example.com', unverified: true },
    ])
    expect(html).toContain('<p>Claim<span class="unverified-pill">')
  })
```

Edit `tests/page-render.test.js:598-603` (rename to describe the new invariant — an empty description renders no `<p>` at all, matching `renderResourcesList`'s own existing behavior):
```js
  test('renders no description paragraph when the description resolves empty', () => {
    const html = ctx.renderServiceTiles(
      [{ title: 'Inspection scope', target: 'scopeInfo', text: 'Card copy.' }],
      titleOnlySection
    )
    expect(html).not.toContain('<p>')
  })
```

- [ ] **Step 2: Run the full suite to confirm these edits fail against the current implementation**

Run: `bun run test 2>&1 | grep -A3 "renderServiceTiles\|renderResourcesList"`
Expected: FAIL — `renderServiceTiles` still emits `class="service-tile-text"` not `<p>`, and `renderResourcesList([card], inheritsSection)` still misinterprets `inheritsSection` as the `heading` argument (a `[object Object]` string) since the signature hasn't changed yet.

- [ ] **Step 3: Extract the shared list-item helper and rewrite the three functions**

Replace `js/page-render.js:320-390` (from `function renderCards(` through the end of `function renderResourcesList(...) { ... }`) with:

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
// heading is no longer a parameter: the caller (renderSection(), via
// renderSectionInner()) already prints section.heading as an <h2> before this
// ever runs, so a second, internal <h3 class="resources-list-heading"> was a
// duplicate heading on every Resources subsection — visible in a live
// screenshot of the mockup's own insectsReport Transaction page as "While you
// wait: tips to help with the problem" printed twice in a row.
function renderResourcesList(cards = [], section = null) {
  if (!cards.length) return ''
  return `<div class="resources-list">${karlTag('Body: Resources links', 'placement')}${renderCardList(cards, section)}</div>`
}
// Services subsections render identically to Resources subsections on real
// sf.gov (a plain divided list, not the boxed 2px-blue-border .service-tile
// grid this used to render) — kept as its own named function, rather than
// calling renderResourcesList directly from renderSectionInner, because
// tests/page-render.test.js and tests/e2e/accessibility.spec.js call it by
// name.
function renderServiceTiles(cards = [], section = null) {
  return renderResourcesList(cards, section)
}
```

- [ ] **Step 4: Simplify `renderSectionInner`'s cards branch — all three prior cases now produce identical output**

In `js/page-render.js`, find (around line 573):
```js
  // The section travels with its cards so cardDescription() can ask its `karl`
  // note whether each description is inherited from the destination page.
  if (section.cards && section.component === 'services')
    inner += renderServiceTiles(section.cards, section)
  else if (section.cards && (section.component === 'resources' || section.cards.some((c) => c.url)))
    inner += renderResourcesList(section.cards, section.heading, section)
  else if (section.cards) inner += renderCards(section.cards, section)
  return inner
```

Replace with:
```js
  // The section travels with its cards so cardDescription() can ask its `karl`
  // note whether each description is inherited from the destination page.
  // Services, Resources, and every other card-bearing section now render
  // through the same plain-list path — renderCards()/.card is reserved for
  // a Step List's own inline cards (renderSteps(), a different, smaller
  // case with no section of its own to duplicate a heading against).
  if (section.cards) inner += renderResourcesList(section.cards, section)
  return inner
```

- [ ] **Step 5: Remove the now-dead `.service-tile*` CSS**

In `css/styles.css`, replace lines 976-1011:
```css
.section--services .cards,
.section--services .service-tiles {
  margin-top: 0.5rem;
}
.service-tiles {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.75rem;
  margin-top: 0.75rem;
}
.service-tile {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  padding: 0.85rem;
  border: 2px solid var(--sfds-action-blue);
  border-radius: var(--radius);
  background: var(--sfds-white);
  color: inherit;
  text-decoration: none;
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.service-tile:hover {
  background: var(--sfds-info-light);
}
.service-tile-title {
  font-weight: 700;
  font-size: 0.95rem;
  color: var(--sfds-action-blue);
}
.service-tile-text {
  font-size: 0.85rem;
  color: var(--sfds-slate-2);
}
```
with:
```css
.section--services .resources-list {
  margin-top: 0.5rem;
}
```

In `css/styles.css`, remove the now-dead rule inside the `@media (max-width: 900px)` block (around line 1139-1141):
```css
  .service-tiles {
    grid-template-columns: 1fr;
  }
```
(delete these 3 lines; leave the surrounding `.related-rail { position: static; }` and `.spotlight-inner { grid-template-columns: 1fr; }` rules untouched — those belong to Task 5 and are unrelated here)

- [ ] **Step 6: Fix the one e2e selector that targeted the removed class**

In `tests/e2e/accessibility.spec.js:63`, replace:
```js
    await expect(page.locator('.service-tile').first()).not.toHaveAccessibleName(/Karl:/)
```
with:
```js
    await expect(page.locator('.services-region a, .services-region button').first()).not.toHaveAccessibleName(/Karl:/)
```

- [ ] **Step 7: Run the unit suite and confirm it passes**

Run: `bun run test`
Expected: PASS (757+ tests, no failures)

- [ ] **Step 8: Format and run the affected e2e spec**

Run: `bun run format`
Run: `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/opt/pw-browsers/chromium bun run test:e2e -- accessibility.spec.js` (drop the env var if no pre-installed Chromium path applies in this environment)
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add js/page-render.js css/styles.css tests/page-render.test.js tests/e2e/accessibility.spec.js
git commit -m "$(cat <<'EOF'
fix: render Services subsections as a plain list, matching real sf.gov

.service-tile boxed every Services link in a 2px blue border; none of the
7 live sf.gov reference pages audited for this pass box that content.
Extracts the shared <li> markup renderResourcesList() already had into
renderCardList(), and makes renderServiceTiles() delegate to it. Also
drops renderResourcesList()'s own internal <h3> heading, which duplicated
the <h2> renderSection() already prints for the same section — visible
live as a repeated "While you wait: tips to help with the problem"
heading on the insectsReport Transaction page.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01K1MJJapTwDj9LUbHUUuzMw
EOF
)"
```

---

### Task 2: De-box Related sections

`renderRelatedList()` (`js/page-render.js:387-390`) wraps its cards in `renderCards()` — the same boxed `.card` treatment Task 1 removed from Services. This is the function behind the boxed "Related pages" grid confirmed live on both the Information (`tenantRights`) and Resource Collection (`ownerHub`) mockup pages. This task depends on Task 1 (`renderCardList` must exist).

**Files:**
- Modify: `js/page-render.js:387-390` (`renderRelatedList`)
- Modify: `css/styles.css:902-908` (`.section--related`)
- Modify: `tests/page-render.test.js:150-160` (`renderRelatedList uses the cards grid layout`)

**Interfaces:**
- Consumes: `renderCardList(cards, section)` from Task 1.
- Produces: `renderRelatedList(cards, heading, section)` — same signature, new internal markup.

- [ ] **Step 1: Update the existing test to assert the new plain-list shape first**

Replace `tests/page-render.test.js:150-160`:
```js
  test('renderRelatedList uses the cards grid layout', () => {
    const html = ctx.renderRelatedList(
      [{ title: 'Report mold', target: 'moldReport' }],
      'Related pages'
    )
    expect(html).toContain('class="section section--related"')
    expect(html).toContain('class="cards"')
    expect(html).toContain('class="card"')
    expect(html).toContain('data-render-target="moldReport"')
    expect(html).not.toContain('class="related-list"')
  })
```
with:
```js
  test('renderRelatedList uses the same plain divided-list layout as Resources', () => {
    const html = ctx.renderRelatedList(
      [{ title: 'Report mold', target: 'moldReport' }],
      'Related pages'
    )
    expect(html).toContain('class="section section--related"')
    expect(html).toContain('class="resources-list"')
    expect(html).toContain('data-render-target="moldReport"')
    expect(html).not.toContain('class="cards"')
    expect(html).not.toContain('class="card"')
  })
```

- [ ] **Step 2: Run to confirm it fails**

Run: `bun run test 2>&1 | grep -A5 "renderRelatedList uses"`
Expected: FAIL — current output still contains `class="cards"`/`class="card"`, not `class="resources-list"`.

- [ ] **Step 3: Rewrite `renderRelatedList`**

Replace `js/page-render.js:387-390`:
```js
function renderRelatedList(cards = [], heading = 'Related', section = null) {
  if (!cards.length) return ''
  return `<section class="section section--related">${karlTag('Related section: linked pages', 'placement')}<h2>${escapeHtml(heading)}</h2>${renderCards(cards, section)}</section>`
}
```
with:
```js
function renderRelatedList(cards = [], heading = 'Related', section = null) {
  if (!cards.length) return ''
  return `<section class="section section--related">${karlTag('Related section: linked pages', 'placement')}<h2>${escapeHtml(heading)}</h2><div class="resources-list">${renderCardList(cards, section)}</div></section>`
}
```

- [ ] **Step 4: Trim the now-dead `.cards` margin rule**

In `css/styles.css`, replace lines 902-908:
```css
.section--related {
  border-top: 1px solid var(--sfds-border);
  padding-top: 1rem;
}
.section--related .cards {
  margin-top: 0.75rem;
}
```
with:
```css
.section--related {
  border-top: 1px solid var(--sfds-border);
  padding-top: 1rem;
}
.section--related .resources-list {
  margin-top: 0.75rem;
}
```

- [ ] **Step 5: Run the unit suite and confirm it passes**

Run: `bun run test`
Expected: PASS

- [ ] **Step 6: Format and commit**

```bash
bun run format
git add js/page-render.js css/styles.css tests/page-render.test.js
git commit -m "$(cat <<'EOF'
fix: render Related sections as a plain list, matching real sf.gov

renderRelatedList() wrapped its cards in the boxed .card grid Task 1 just
removed from Services — the same mismatch, confirmed live on both the
Information (tenantRights) and Resource Collection (ownerHub) pages.
Reuses renderCardList() from the previous commit instead of a second
implementation.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01K1MJJapTwDj9LUbHUUuzMw
EOF
)"
```

---

### Task 3: De-box numbered "what to do" steps (CSS only)

`.step` (`css/styles.css:600-621`) renders each Transaction step in a bordered box with a filled blue circular number badge. Both Transaction reference screenshots (`report-mold-in-my-home`, `report-a-health-nuisance-or-hazards`) render "1. Check if your issue is..." as a plain numbered heading — no border, no badge. The number is pure CSS (`counter-increment`/`content: counter(...)` on `::before`), so this is CSS-only — no JS or test changes.

**Files:**
- Modify: `css/styles.css:592-621` (`.step-list`, `.step`, `.step::before`)

- [ ] **Step 1: Rewrite the step CSS to a plain, unboxed numbered flow**

Replace `css/styles.css:592-621`:
```css
.step-list {
  counter-reset: steps;
  display: grid;
  gap: 2.5rem;
  margin: 0;
  padding: 0;
  list-style: none;
}
.step {
  counter-increment: steps;
  display: grid;
  grid-template-columns: 2.5rem minmax(0, 1fr);
  gap: 1rem;
  padding: 1.15rem;
  border: 1px solid var(--sfds-border);
  border-radius: var(--radius);
  background: var(--sfds-white);
}
.step::before {
  content: counter(steps);
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 50%;
  background: var(--sfds-action-blue);
  color: var(--sfds-white);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
}
```
with:
```css
.step-list {
  counter-reset: steps;
  display: grid;
  gap: 1.75rem;
  margin: 0;
  padding: 0;
  list-style: none;
}
.step {
  counter-increment: steps;
}
/* Real sf.gov renders "1. Check if your issue is..." as a plain numbered
   heading — no border, no filled circular badge (confirmed against
   report-mold-in-my-home and report-a-health-nuisance-or-hazards). The
   number stays a CSS counter rather than moving into renderSteps()'s HTML:
   it's presentation, and keeping it in CSS means this step needed no JS or
   test changes. */
.step h3::before {
  content: counter(steps) '. ';
}
```

- [ ] **Step 2: Verify the unit suite still passes (no test should reference `.step`'s box/badge styling)**

Run: `bun run test`
Expected: PASS — `renderSteps escapes step title, text, bullets, and callout text` and the `data-rewrite-field` step tests assert on escaping and path attributes, not on `.step`'s CSS.

- [ ] **Step 3: Verify live in the browser**

Run: `bun run dev` (skip if already running), then in a browser or via Playwright, navigate to `http://127.0.0.1:8080/?page=insectsReport` and confirm the "What to do" steps render as plain numbered headings with no border or circle.

- [ ] **Step 4: Format and commit**

```bash
bun run format
git add css/styles.css
git commit -m "$(cat <<'EOF'
style: de-box numbered Transaction steps, matching real sf.gov

.step boxed every "what to do" step with a border and a filled blue
circular number badge. Both Transaction reference screenshots
(report-mold-in-my-home, report-a-health-nuisance-or-hazards) render the
numbered heading plain, in normal flow. CSS-only: the number was always a
counter() pseudo-element, never part of renderSteps()'s HTML.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01K1MJJapTwDj9LUbHUUuzMw
EOF
)"
```

---

### Task 4: De-box Contact us (CSS only)

`.contact-section` (`css/styles.css:1041-1048`) renders a gray-background bordered box. Both Transaction references render "Contact us" plain, no background. CSS-only — `renderContactSection()`'s HTML doesn't change.

**Files:**
- Modify: `css/styles.css:1041-1048`

- [ ] **Step 1: Rewrite the contact-section CSS**

Replace `css/styles.css:1041-1048`:
```css
.contact-section {
  max-width: var(--content-max);
  margin: 2rem auto 0;
  padding: 1.25rem;
  border: 1px solid var(--sfds-border);
  border-radius: var(--radius);
  background: var(--sfds-slate-5);
}
```
with:
```css
/* Both Transaction reference screenshots (report-mold-in-my-home,
   report-a-health-nuisance-or-hazards) render "Contact us" plain — no
   background, no border. */
.contact-section {
  max-width: var(--content-max);
  margin: 2rem auto 0;
  padding-top: 1rem;
  border-top: 1px solid var(--sfds-border);
}
```

- [ ] **Step 2: Run the unit suite**

Run: `bun run test`
Expected: PASS (no test references `.contact-section`'s box styling)

- [ ] **Step 3: Verify live in the browser**

Navigate to `http://127.0.0.1:8080/?page=insectsReport` and `http://127.0.0.1:8080/?page=tenantRights`; confirm "Contact us" renders with a plain top rule, no gray box.

- [ ] **Step 4: Format and commit**

```bash
bun run format
git add css/styles.css
git commit -m "$(cat <<'EOF'
style: de-box Contact us, matching real sf.gov

.contact-section rendered a gray-background bordered box on every
Transaction and Information page; both Transaction references render it
plain, with no background. CSS-only.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01K1MJJapTwDj9LUbHUUuzMw
EOF
)"
```

---

### Task 5: Move the Related rail into single-column flow

Every reference screenshot is single-column, full-width. `page-layout--transaction` (`js/page-render.js:684-698`, `css/styles.css:861-870`) currently puts Related links in a sticky right-side `<aside>` (`renderRelatedRail()`) beside a two-column grid. This task retires `renderRelatedRail()` and routes Transaction's Related content through `renderRelatedList()` (now plain-list, from Task 2) at the bottom of the page — the same pattern Information/Topic/Agency/Resource-Collection pages already use. Depends on Task 2.

**Files:**
- Modify: `js/page-render.js:391-418` (delete `renderRelatedRail`), `js/page-render.js:682-699` (`renderPageMain`'s transaction branch), `js/page-render.js:939-956` (exports)
- Modify: `css/styles.css:861-901` (`.page-layout--transaction`, `.page-layout-main`, `.related-rail*`), `css/styles.css:1133-1138` (media query)
- Modify: `tests/page-render.test.js:143-148` (delete standalone `renderRelatedRail` test), `tests/page-render.test.js:588-596`, `:679-683` (trim the combined inheritance tests)

**Interfaces:**
- Consumes: `renderRelatedList(cards, heading, section)` (Task 2's plain-list version).
- Removes: `renderRelatedRail(sections)` — deleted from both the module and its exports. No other file calls it (verified: `grep -rn renderRelatedRail js/ tests/` before this task showed only `js/page-render.js` and `tests/page-render.test.js`).

- [ ] **Step 1: Delete the standalone `renderRelatedRail` test and trim the two combined inheritance tests, so this task can be verified failing (missing function) once the deletion lands**

Delete `tests/page-render.test.js:143-148` entirely:
```js
  test('renderRelatedRail appends an unverified pill when card.unverified is true', () => {
    const html = ctx.renderRelatedRail([
      { cards: [{ title: 'Related', text: 'Claim', unverified: true }] },
    ])
    expect(html).toContain('<p>Claim<span class="unverified-pill">')
  })

```
(remove the whole block, including the blank line that follows it, so `renderRelatedList uses the same plain divided-list layout as Resources` — the test right after it — is unaffected)

Replace `tests/page-render.test.js:588-596`:
```js
  test('inherits through renderServiceTiles, renderResourcesList and renderRelatedRail', () => {
    const card = { title: 'Inspection scope', target: 'scopeInfo', text: 'Card copy.' }
    // Live fixture value, same reasoning as the test above: a copy edit to
    // scopeInfo should not fail this test while inheritance still works.
    const expected = escapeHtml(pageData.scopeInfo.summary)
    expect(ctx.renderServiceTiles([card], inheritsSection)).toContain(expected)
    expect(ctx.renderResourcesList([card], 'Resources', inheritsSection)).toContain(expected)
    expect(ctx.renderRelatedRail([{ ...inheritsSection, cards: [card] }])).toContain(expected)
  })
```
with:
```js
  test('inherits through renderServiceTiles and renderResourcesList', () => {
    const card = { title: 'Inspection scope', target: 'scopeInfo', text: 'Card copy.' }
    // Live fixture value, same reasoning as the test above: a copy edit to
    // scopeInfo should not fail this test while inheritance still works.
    const expected = escapeHtml(pageData.scopeInfo.summary)
    expect(ctx.renderServiceTiles([card], inheritsSection)).toContain(expected)
    expect(ctx.renderResourcesList([card], inheritsSection)).toContain(expected)
  })
```
(note the `renderResourcesList` call also drops the `'Resources'` heading arg here, matching Task 1's Step 1 edit at line 594 — this is a distinct occurrence, not a duplicate of that earlier edit)

Replace `tests/page-render.test.js:679-683`:
```js
  test('resolves through renderServiceTiles, renderResourcesList and renderRelatedRail too', () => {
    const card = { title: 'Inspection scope', target: 'scopeInfo', text: 'Card copy.' }
    expect(ctx.renderServiceTiles([card], inheritsSection)).toContain(scopeInfoTitle)
    expect(ctx.renderResourcesList([card], 'Resources', inheritsSection)).toContain(scopeInfoTitle)
    expect(ctx.renderRelatedRail([{ ...inheritsSection, cards: [card] }])).toContain(scopeInfoTitle)
  })
```
with:
```js
  test('resolves through renderServiceTiles and renderResourcesList too', () => {
    const card = { title: 'Inspection scope', target: 'scopeInfo', text: 'Card copy.' }
    expect(ctx.renderServiceTiles([card], inheritsSection)).toContain(scopeInfoTitle)
    expect(ctx.renderResourcesList([card], inheritsSection)).toContain(scopeInfoTitle)
  })
```

Add a new test after the (now-renamed) `renderRelatedList` test block, verifying the Transaction layout change end-to-end via `renderPageMain`. Insert into `describe('page-render.js escaping', ...)` or a new small describe block near the top of the file (after the existing `describe('page-render.js escaping', ...)` block closes, i.e. after line 231):
```js
describe('Transaction page layout', () => {
  test('renders Related as a plain bottom section, not a sidebar rail', () => {
    const page = {
      type: 'Transaction',
      title: 'Report a thing',
      summary: 'Summary.',
      audience: ['Someone'],
      reading: 'Grade 6',
      sections: [
        {
          heading: 'Related',
          karl: 'Related panel: linked pages',
          component: 'related',
          cards: [{ title: 'Other page', target: 'scopeInfo' }],
        },
      ],
    }
    const html = ctx.renderPageMain(page)
    expect(html).toContain('class="section section--related"')
    expect(html).not.toContain('related-rail')
    expect(html).not.toContain('page-layout--transaction')
  })
})
```

- [ ] **Step 2: Run to confirm the new/edited tests fail (function still exists, layout still two-column)**

Run: `bun run test 2>&1 | grep -A5 "Transaction page layout\|renderRelatedRail"`
Expected: FAIL — `renderPageMain` still emits `page-layout--transaction` and `related-rail`; `ctx.renderRelatedRail` calls in the edited tests above no longer exist in the test file, so this step is really confirming the NEW `'Transaction page layout'` test fails.

- [ ] **Step 3: Delete `renderRelatedRail` and its export**

Delete `js/page-render.js:391-418` entirely:
```js
function renderRelatedRail(sections = []) {
  // Kept as (section, card) pairs rather than flattened to cards alone: the
  // description each entry renders depends on the `karl` note of the section it
  // came from, so flattening would throw away the only thing that can answer
  // the question. The rail's own heading is fixed, so the sections are
  // otherwise interchangeable here — which is exactly why the association was
  // easy to drop.
  const entries = sections.flatMap((s) => (s.cards || []).map((c) => ({ section: s, card: c })))
  if (!entries.length) return ''
  return `<aside class="related-rail" aria-label="Related pages">${karlTag('Related section: right-panel linked pages', 'placement')}<h2 class="related-rail-title">Related</h2><ul class="related-rail-list">${entries
    .map(({ section, card: c }) => {
      const title = cardTitle(section, c)
      const attr = c.url
        ? ' target="_blank" rel="noopener noreferrer"'
        : c.target
          ? ` data-render-target="${escapeHtml(c.target)}"`
          : ' data-render-inert=""'
      const action = c.url
        ? `<a href="${escapeHtml(safeUrl(c.url))}"${attr}>${escapeHtml(title)}</a>`
        : `<button type="button" class="inline-link"${attr}>${escapeHtml(title)}</button>`
      const desc = cardDescription(section, c)
      const text = desc
        ? `<p>${escapeHtml(desc)}${c.unverified ? unverifiedPill(c.unverifiedReason) : ''}</p>`
        : ''
      return `<li>${action}${text}</li>`
    })
    .join('')}</ul></aside>`
}
```

In `js/page-render.js`'s `export { ... }` block (around line 939-956), delete the `renderRelatedRail,` line.

- [ ] **Step 4: Change the Transaction branch of `renderPageMain` to render Related inline, matching the Information/Topic/Agency/Resource-Collection pattern**

Find (around `js/page-render.js:682-699`):
```js
  if (pageType === 'transaction') {
    html += renderWhatToKnow(page.whatToKnow, page)
    html += `<div class="page-layout page-layout--transaction"><div class="page-layout-main">`
    whatToDo.forEach((s) => {
      html += renderSection(s, pageType)
    })
    if (supporting.length) {
      html += `<div class="supporting-info">${karlTag('Supporting information: Accordions and custom sections', 'body')}<h2 class="visually-hidden">Supporting information</h2>`
      supporting.forEach((s) => {
        html += renderAccordionSection(s, pageType)
      })
      html += `</div>`
    }
    body.forEach((s) => {
      html += renderSection(s, pageType)
    })
    html += `</div>${renderRelatedRail(related)}</div>`
    html += renderContactSection(page.contact, page)
  } else if (pageType === 'information' || pageType === 'report') {
```

Replace with:
```js
  if (pageType === 'transaction') {
    html += renderWhatToKnow(page.whatToKnow, page)
    whatToDo.forEach((s) => {
      html += renderSection(s, pageType)
    })
    if (supporting.length) {
      html += `<div class="supporting-info">${karlTag('Supporting information: Accordions and custom sections', 'body')}<h2 class="visually-hidden">Supporting information</h2>`
      supporting.forEach((s) => {
        html += renderAccordionSection(s, pageType)
      })
      html += `</div>`
    }
    body.forEach((s) => {
      html += renderSection(s, pageType)
    })
    related.forEach((s) => {
      html += renderRelatedList(s.cards || [], s.heading || 'Related', s)
    })
    html += renderContactSection(page.contact, page)
  } else if (pageType === 'information' || pageType === 'report') {
```

- [ ] **Step 5: Remove the two-column grid and rail CSS**

Delete `css/styles.css:861-901` entirely (`.page-layout--transaction` through `.related-rail-list p`):
```css
.page-layout--transaction {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(220px, 280px);
  gap: 1.5rem;
  align-items: start;
  max-width: calc(var(--content-max) + 300px);
  margin: 0 auto;
}
.page-layout-main {
  min-width: 0;
}
.related-rail {
  position: sticky;
  top: 1rem;
  padding: 1rem;
  border: 1px solid var(--sfds-border);
  border-radius: var(--radius);
  background: var(--sfds-white);
}
.related-rail-title {
  font-size: 1rem;
  margin: 0 0 0.75rem;
}
.related-rail-list {
  list-style: none;
  margin: 0;
  padding: 0;
}
.related-rail-list li {
  margin: 0 0 0.85rem;
}
.related-rail-list a {
  font-weight: 700;
  color: var(--sfds-action-blue);
  text-decoration: none;
}
.related-rail-list p {
  margin: 0.2rem 0 0;
  font-size: 0.88rem;
  color: var(--sfds-slate-2);
}
```

In the `@media (max-width: 900px)` block, delete the now-dead rules (around `css/styles.css:1133-1138`):
```css
  .page-layout--transaction {
    grid-template-columns: 1fr;
  }
  .related-rail {
    position: static;
  }
```
(leave `.hero--transaction .hero-inner { max-width: ... }` and `.spotlight-inner { grid-template-columns: 1fr; }` in that same media block untouched)

- [ ] **Step 6: Run the unit suite**

Run: `bun run test`
Expected: PASS

- [ ] **Step 7: Verify live in the browser**

Navigate to `http://127.0.0.1:8080/?page=insectsReport`; confirm the page is single-column full-width, "Related" appears as a plain section above "Contact us" near the bottom (not a sidebar), and resize the window down to ~800px to confirm nothing breaks (the sidebar-specific mobile CSS you just deleted is gone, but the page should still be single-column since it always was below 900px).

- [ ] **Step 8: Format and commit**

```bash
bun run format
git add js/page-render.js css/styles.css tests/page-render.test.js
git commit -m "$(cat <<'EOF'
fix: move Transaction Related links into single-column flow

Every one of the 7 sf.gov reference screenshots is single-column,
full-width — none has an equivalent to the sticky right-rail
renderRelatedRail() rendered on Transaction pages. Retires that function
and routes Transaction's Related content through the same
related.forEach(renderRelatedList(...)) pattern Information/Topic/Agency/
Resource-Collection pages already use, placed after the main content and
before Contact us.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01K1MJJapTwDj9LUbHUUuzMw
EOF
)"
```

---

### Task 6: Replace the breadcrumb with a derived parent-program link

Every reference page shows one link back to its owning program (e.g. "Environmental Health"), never a breadcrumb trail. The current breadcrumb (`js/page-render.js:804`, inside `applyPageContent`) is static markup with no per-page data behind it. Rather than adding a new schema field, this derives the link: every page except `pestsTopic` (the Agency page) shows "Healthy Housing and Vector Control" linking to `pestsTopic`; the Agency page itself shows no parent link.

**Files:**
- Modify: `js/page-render.js` (add `renderParentLink`, wire it into `applyPageContent`, add to exports)
- Modify: `css/styles.css:1906-1959` (replace `.page-breadcrumbs*`/`.back-link*` with `.page-parent-link`)
- Modify: `tests/page-render.test.js` (new test)

**Interfaces:**
- Produces: `renderParentLink(page, key)` — pure function, returns an HTML string (or `''` for the Agency page), exported for direct testing.

- [ ] **Step 1: Write the failing test**

Add to `tests/page-render.test.js`, inside the `describe('Transaction page layout', ...)` block added in Task 5 (rename that block, or add a new one right after it — either is fine; shown here as a sibling block for clarity):
```js
describe('renderParentLink', () => {
  test('links every non-Agency page back to the Agency page', () => {
    const page = { title: 'Some Transaction page' }
    const html = ctx.renderParentLink(page, 'insectsReport')
    expect(html).toContain(`>${escapeHtml(pageData.pestsTopic.title)}<`)
    expect(html).toContain('data-render-target="pestsTopic"')
  })

  test('renders nothing on the Agency page itself', () => {
    const page = { title: pageData.pestsTopic.title }
    expect(ctx.renderParentLink(page, 'pestsTopic')).toBe('')
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `bun run test 2>&1 | grep -A5 "renderParentLink"`
Expected: FAIL — `ctx.renderParentLink is not a function`

- [ ] **Step 3: Implement `renderParentLink` and wire it in**

Add this function to `js/page-render.js`, directly above `function renderPrintVersion(url) {` (around line 657):
```js
// Every one of the 7 sf.gov reference pages audited for this pass shows one
// link back to its owning program (e.g. "Environmental Health"), never a
// breadcrumb trail. Rather than a new per-page schema field authored across
// 22 files for a link that reads the same on 21 of them, this derives it:
// every page except the Agency page is a child of HHVC in this site's actual
// structure, so it always links there. Reads the Agency page's live title
// from pageData rather than a literal, so an inline title edit to pestsTopic
// stays in sync with this link's label without a second place to update it.
function renderParentLink(page, key) {
  if (key === 'pestsTopic') return ''
  const label = pageData.pestsTopic?.title || 'Healthy Housing and Vector Control'
  return `<nav class="page-parent-link" aria-label="Parent program"><a href="#" data-render-target="pestsTopic">${escapeHtml(label)}</a></nav>`
}
```

In `js/page-render.js`'s `applyPageContent(key)`, find (around line 804):
```js
        <nav class="page-breadcrumbs" aria-label="Breadcrumbs"><div class="page-breadcrumbs-inner"><a href="#" class="back-link">Back</a><ol><li><a href="#">Home</a></li><li><a href="#">Services</a></li><li><span aria-current="page">${escapeHtml(page.title)}</span></li></ol></div></nav>
```
Replace with:
```js
        ${renderParentLink(page, key)}
```

Add `renderParentLink,` to the `export { ... }` block (alphabetical position: after `renderPageMain,` and before `paragraphList,` would break the existing alphabetical-ish ordering — just add it after `renderPage,` for minimal diff):
```js
export {
  bulletList,
  button,
  karlTag,
  renderPageMain,
  paragraphList,
  renderAudience,
  renderCards,
  renderPage,
  renderParentLink,
  renderRelatedList,
  renderResourcesList,
  renderSection,
  renderServiceTiles,
  renderSteps,
  renderTable,
  renderTextItems,
}
```
(note `renderRelatedRail,` is already gone from this list per Task 5, Step 3)

- [ ] **Step 4: Replace the breadcrumb CSS with a plain link style**

Replace `css/styles.css:1906-1959` (`.page-breadcrumbs` through `.page-breadcrumbs span`) with:
```css
.page-parent-link {
  background: var(--sfds-white);
  padding: 0.85rem 2rem;
  border-bottom: 1px solid var(--sfds-border);
}
.page-parent-link a {
  max-width: var(--page-max);
  margin: 0 auto;
  display: block;
  color: var(--sfds-action-blue);
  text-decoration: none;
  font-weight: 700;
  font-size: 0.9rem;
}
.page-parent-link a:hover {
  text-decoration: underline;
}
```

- [ ] **Step 5: Run the unit suite and confirm it passes**

Run: `bun run test`
Expected: PASS

- [ ] **Step 6: Verify live in the browser**

Navigate to `http://127.0.0.1:8080/?page=insectsReport`; confirm a single "Healthy Housing and Vector Control" link appears where the breadcrumb was, and clicking it navigates to the Agency page. Navigate to `http://127.0.0.1:8080/?page=pestsTopic` and confirm no parent link renders there.

- [ ] **Step 7: Format and commit**

```bash
bun run format
git add js/page-render.js css/styles.css tests/page-render.test.js
git commit -m "$(cat <<'EOF'
fix: replace breadcrumb with a derived parent-program link

Every one of the 7 sf.gov reference pages shows one link back to its
owning program, never a breadcrumb trail. Rather than a new per-page
field authored across 22 files, renderParentLink() derives it: every
page except the Agency page links to pestsTopic under its live title.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01K1MJJapTwDj9LUbHUUuzMw
EOF
)"
```

---

### Task 7: Eyebrow — real orange color, Agency-only

Every page currently prints `page.type` in a muted gray eyebrow. The reference `healthy-housing-conditions` page's "TOPIC" eyebrow is a burnt orange (`#A84B00`, sampled directly from the reference screenshot's pixel data), and none of the Transaction/Information/Campaign reference pages show an eyebrow at all. This task colors the eyebrow only on the Agency-type page and removes it everywhere else.

**Files:**
- Modify: `js/page-render.js` (`renderHero`)
- Modify: `css/theme.css` (new `--eyebrow-agency` token, light + dark)
- Modify: `css/styles.css:211-223` (`.eyebrow`)
- Modify: `tests/page-render.test.js` (new test)

- [ ] **Step 1: Write the failing test**

Add to `tests/page-render.test.js`, in a new `describe` block:
```js
describe('hero eyebrow', () => {
  const base = {
    title: 'A page',
    summary: 'Summary.',
    audience: ['Someone'],
    reading: 'Grade 6',
    sections: [],
  }

  test('shows an orange eyebrow on the Agency page', () => {
    const html = ctx.renderPageMain({ ...base, type: 'Agency' })
    expect(html).toContain('class="eyebrow eyebrow--agency"')
    expect(html).toContain('>Agency<')
  })

  test('shows no eyebrow on a Transaction page', () => {
    const html = ctx.renderPageMain({ ...base, type: 'Transaction' })
    expect(html).not.toContain('class="eyebrow')
  })

  test('shows no eyebrow on an Information page', () => {
    const html = ctx.renderPageMain({ ...base, type: 'Information' })
    expect(html).not.toContain('class="eyebrow')
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `bun run test 2>&1 | grep -A5 "hero eyebrow"`
Expected: FAIL — every page type currently renders `class="eyebrow"` (no `--agency` variant, and Transaction/Information still show it)

- [ ] **Step 3: Update `renderHero`**

Find (around `js/page-render.js:648-656`):
```js
function renderHero(page, heroCta) {
  const ctaAttr = heroCta ? ' data-rewrite-field="primaryCta"' : ''
  const ctaHtml = heroCta
    ? `<div class="hero-cta"${ctaAttr}>${button(heroCta.label, 'primary', heroCta.target, heroCta.url)}</div>`
    : ''
  const heroClass =
    normalizePageType(page.type) === 'transaction' ? 'hero hero--transaction' : 'hero'
  return `<section class="${heroClass}"><div class="hero-inner">${karlTag('Metadata: Karl page type', 'meta')}<div class="eyebrow">${escapeHtml(page.type)}</div>${karlTag('Page title field', 'meta')}<h1 tabindex="-1" data-rewrite-field="title">${escapeHtml(page.title)}</h1>${karlTag('Short summary / Description field', 'meta')}<p class="summary" data-rewrite-field="summary">${escapeHtml(page.summary)}</p>${ctaHtml}</div></section>`
}
```
Replace with:
```js
function renderHero(page, heroCta) {
  const ctaAttr = heroCta ? ' data-rewrite-field="primaryCta"' : ''
  const ctaHtml = heroCta
    ? `<div class="hero-cta"${ctaAttr}>${button(heroCta.label, 'primary', heroCta.target, heroCta.url)}</div>`
    : ''
  const heroClass =
    normalizePageType(page.type) === 'transaction' ? 'hero hero--transaction' : 'hero'
  // Only the Agency/Topic-shaped reference page (healthy-housing-conditions)
  // showed a "TOPIC" eyebrow at all — the Transaction and Information
  // references show none. Rather than one gray label on every page type,
  // this now matches per-type: colored and present on Agency, absent
  // elsewhere.
  const eyebrowHtml =
    normalizePageType(page.type) === 'agency'
      ? `${karlTag('Metadata: Karl page type', 'meta')}<div class="eyebrow eyebrow--agency">${escapeHtml(page.type)}</div>`
      : ''
  return `<section class="${heroClass}"><div class="hero-inner">${eyebrowHtml}${karlTag('Page title field', 'meta')}<h1 tabindex="-1" data-rewrite-field="title">${escapeHtml(page.title)}</h1>${karlTag('Short summary / Description field', 'meta')}<p class="summary" data-rewrite-field="summary">${escapeHtml(page.summary)}</p>${ctaHtml}</div></section>`
}
```

- [ ] **Step 4: Add the color token**

In `css/theme.css`, inside `:root` (near `--text-primary` at line 153), add:
```css
  /* Sampled directly from the healthy-housing-conditions reference
     screenshot's "TOPIC" eyebrow pixel data (darkest/most-saturated pixel
     in its bounding box): #A84B00. WCAG AA text floor is 4.5:1 against
     --surface-panel; verify with the accessibility.spec.js axe scan below
     and adjust if flagged. */
  --eyebrow-agency: #a84b00;
```

In the `@media (prefers-color-scheme: dark)` block (starting line 315), add a lightened variant sized for the dark panel surface — placed near the other dark-mode text-color overrides:
```css
  /* Lightened from the light-mode #a84b00 for contrast against the dark
     panel surface — verify with the accessibility.spec.js axe scan (dark
     mode) and adjust if flagged; this is a starting value, not a measured
     final one. */
  --eyebrow-agency: #d97d3d;
```

- [ ] **Step 5: Update `.eyebrow` CSS**

Replace `css/styles.css:211-223`:
```css
.eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  font-size: 0.78rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  /* WCAG AA: --sfds-slate-2 (#383939) on white is ~11.4:1.
     Previous --sfds-slate-3 (#6e7070) was ~4.2:1 and sat under the 4.5:1 floor. */
  color: var(--sfds-slate-2);
  margin-bottom: 0.75rem;
}
```
with:
```css
.eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  font-size: 0.78rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-bottom: 0.75rem;
}
.eyebrow--agency {
  color: var(--eyebrow-agency);
}
```
(the old default gray color is dropped along with the base `.eyebrow` rule's only use — `.eyebrow` without a variant no longer renders on any page after Step 3, so no other page type needs a fallback color; if a future page type ever needs an eyebrow again, it should get its own `.eyebrow--<type>` variant rather than reviving an unqualified default)

- [ ] **Step 6: Run the unit suite**

Run: `bun run test`
Expected: PASS

- [ ] **Step 7: Verify contrast and appearance live**

Run: `bun run dev` (if not already running). Navigate to `http://127.0.0.1:8080/?page=pestsTopic`, confirm the orange eyebrow. Navigate to `http://127.0.0.1:8080/?page=insectsReport`, confirm no eyebrow. Toggle OS/browser dark mode and re-check both. Then run:
`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/opt/pw-browsers/chromium bun run test:e2e -- accessibility.spec.js`
Expected: PASS with no new color-contrast violations. If the axe scan flags `--eyebrow-agency` in either theme, darken (light mode) or lighten (dark mode) the hex in `css/theme.css` and re-run until clean.

- [ ] **Step 8: Format and commit**

```bash
bun run format
git add js/page-render.js css/theme.css css/styles.css tests/page-render.test.js
git commit -m "$(cat <<'EOF'
fix: recolor the eyebrow orange on Agency pages, remove it elsewhere

The reference healthy-housing-conditions page's "TOPIC" eyebrow is a
burnt orange (#a84b00, sampled directly from the screenshot), not the
mockup's muted gray — and it's the only one of the 7 reference pages that
shows an eyebrow at all. Transaction/Information/Campaign/Report/
Resource-Collection reference pages show none.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01K1MJJapTwDj9LUbHUUuzMw
EOF
)"
```

---

### Task 8: Drop the "Things to know" wrapper heading

`renderWhatToKnow()` currently wraps its items in `<div class="what-to-know-things"><strong>Things to know</strong>...`. Real "What to know" boxes go straight from the box title to specific bold labels ("Cost", "Who fixes it") with no generic wrapper heading in between.

**Files:**
- Modify: `js/page-render.js` (`renderWhatToKnow`, around line 510)
- Modify: `tests/page-render.test.js` (new test)

- [ ] **Step 1: Write the failing test**

Add to `tests/page-render.test.js`:
```js
describe('renderWhatToKnow', () => {
  test('does not print a generic "Things to know" wrapper heading', () => {
    const page = {
      type: 'Transaction',
      title: 'Report a thing',
      summary: 'Summary.',
      audience: ['A tenant'],
      reading: 'Grade 6',
      whatToKnow: { cost: 'Free', thingsToKnow: ['Call 311 for help.'] },
      sections: [],
    }
    const html = ctx.renderPageMain(page)
    expect(html).not.toContain('Things to know')
    expect(html).toContain('Call 311 for help.')
    expect(html).toContain('<strong>Cost:</strong> Free')
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `bun run test 2>&1 | grep -A5 "renderWhatToKnow"`
Expected: FAIL — output still contains the literal text "Things to know"

- [ ] **Step 3: Remove the wrapper heading**

Find (around `js/page-render.js:510`):
```js
  return `<section class="what-to-know">${karlTag('What to know before you start: Who this is for, Cost, and Things to know', 'body')}<h2 class="visually-hidden">What to know before you start</h2>${cost ? `<p class="what-to-know-cost"><strong>Cost:</strong> ${escapeHtml(cost)}</p>` : ''}${thingItems.length || audienceHtml ? `<div class="what-to-know-things"><strong>Things to know</strong>${audienceHtml}${renderTextItems(thingItems)}</div>` : ''}</section>`
```
Replace with:
```js
  return `<section class="what-to-know">${karlTag('What to know before you start: Who this is for, Cost, and Things to know', 'body')}<h2 class="visually-hidden">What to know before you start</h2>${cost ? `<p class="what-to-know-cost"><strong>Cost:</strong> ${escapeHtml(cost)}</p>` : ''}${thingItems.length || audienceHtml ? `<div class="what-to-know-things">${audienceHtml}${renderTextItems(thingItems)}</div>` : ''}</section>`
```
(only the literal `<strong>Things to know</strong>` is removed; the `what-to-know-things` wrapper div and its CSS stay, since it's still needed for spacing between "Who this is for" and the rest of the list)

- [ ] **Step 4: Run the unit suite**

Run: `bun run test`
Expected: PASS

- [ ] **Step 5: Verify live in the browser**

Navigate to `http://127.0.0.1:8080/?page=insectsReport`; confirm "What to know" no longer prints a "Things to know" sub-heading before the bulleted list.

- [ ] **Step 6: Format and commit**

```bash
bun run format
git add js/page-render.js tests/page-render.test.js
git commit -m "$(cat <<'EOF'
fix: drop the generic "Things to know" wrapper heading

Real "What to know" boxes go straight from the box title to specific
bold labels ("Cost", "Who fixes it") — no generic sub-heading in between.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01K1MJJapTwDj9LUbHUUuzMw
EOF
)"
```

---

### Task 9: Footer social icons

Every reference footer shows five social icons (Facebook, Instagram, Threads, X, Bluesky); ours shows none. Self-hosted inline SVG, no CDN/icon font. `applyPageContent`'s footer template has no unit-test coverage today (confirmed: `grep -n footer tests/page-render.test.js` returns nothing) and is DOM-construction code, not a pure render function — this task is verified live/manually, consistent with the rest of that template.

**Files:**
- Modify: `js/page-render.js` (`applyPageContent`'s footer template, around line 809-814)
- Modify: `css/styles.css:1172-1180` (`.footer-brand`, `.footer-brand-row`)

- [ ] **Step 1: Add the social icon markup**

In `js/page-render.js`'s `applyPageContent(key)`, find (around line 809-814):
```js
            <div class="footer-brand">
               <div class="footer-brand-row">
                 <span class="footer-brand-mark" aria-hidden="true"></span>
                 <strong class="footer-brand-name">City and County of<br>SAN FRANCISCO</strong>
               </div>
            </div>
```
Replace with:
```js
            <div class="footer-brand">
               <div class="footer-brand-row">
                 <span class="footer-brand-mark" aria-hidden="true"></span>
                 <strong class="footer-brand-name">City and County of<br>SAN FRANCISCO</strong>
               </div>
               <ul class="footer-social">
                 <li><a href="#" aria-label="Facebook"><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="currentColor"><path d="M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.4h-1.3c-1.2 0-1.6.8-1.6 1.6V12h2.8l-.4 2.9h-2.4v7A10 10 0 0 0 22 12Z"/></svg></a></li>
                 <li><a href="#" aria-label="Instagram"><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4.2"/><circle cx="17.4" cy="6.6" r="0.9" fill="currentColor" stroke="none"/></svg></a></li>
                 <li><a href="#" aria-label="Threads"><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12.2 6.6c3.4 0 5.4 2.1 5.6 5.6.1 1.9-.2 4.7-3.3 5.9-1 .4-2.1.5-3.1.2-1.9-.5-2.9-1.8-2.9-3.1 0-1.8 1.8-2.9 4.3-2.9 1.6 0 2.9.3 3.9.9"/></svg></a></li>
                 <li><a href="#" aria-label="X"><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="currentColor"><path d="M13.9 10.9 21 3h-2.2l-6.1 6.9L7.8 3H3l7.4 10.6L3 21h2.2l6.5-7.3L17.2 21H22l-8.1-10.1Z"/></svg></a></li>
                 <li><a href="#" aria-label="Bluesky"><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="currentColor"><path d="M12 10.8C10.3 7.4 6.9 4.6 4.4 4c-1.1-.3-1.7.4-1.4 1.5.4 1.7 1.7 6.1 3.3 7.9 1.2 1.4 2.6 1.7 4.1.9-1 1.7-1.8 3.4-.4 4.6 1.3 1.1 2.6-.1 3.1-1.8.1-.4.2-.4.3 0 .5 1.7 1.8 2.9 3.1 1.8 1.4-1.2.6-2.9-.4-4.6 1.5.8 2.9.5 4.1-.9 1.6-1.8 2.9-6.2 3.3-7.9.3-1.1-.3-1.8-1.4-1.5-2.5.6-5.9 3.4-7.6 6.8Z"/></svg></a></li>
               </ul>
            </div>
```

- [ ] **Step 2: Style the icon list**

In `css/styles.css`, after the `.footer-brand-row` rule (around line 1175-1180), add:
```css
.footer-social {
  display: flex;
  gap: 0.75rem;
  list-style: none;
  margin: 0;
  padding: 0;
}
.footer-social a {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 1px solid var(--sfds-white);
  color: var(--sfds-white);
}
```

- [ ] **Step 3: Run the unit suite (should be unaffected — no test covers this template)**

Run: `bun run test`
Expected: PASS

- [ ] **Step 4: Verify live in the browser**

Navigate to any page, scroll to the footer, confirm five icon circles render below "SAN FRANCISCO" and above/beside the three link columns, matching the reference footers' general position and spacing. Check both light and dark mode for contrast (white circles/icons on the dark `--sfds-footer-bg` should already pass, since `--sfds-white` is reused verbatim from the existing brand mark).

- [ ] **Step 5: Format and commit**

```bash
bun run format
git add js/page-render.js css/styles.css
git commit -m "$(cat <<'EOF'
style: add footer social icons, matching real sf.gov

Every reference footer shows five social icons (Facebook, Instagram,
Threads, X, Bluesky); the mockup showed none. Self-hosted inline SVG —
no CDN icon font, consistent with this tool's offline-first requirement.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01K1MJJapTwDj9LUbHUUuzMw
EOF
)"
```

---

### Task 10: Full regression pass

All nine prior tasks ran the unit suite after each change; this task is the one full-scope pass the design spec's Testing section calls for — the layout-breakpoint sweep, accessibility, and the full e2e suite together, plus a side-by-side manual check against the original reference screenshots.

**Files:** none (verification only)

- [ ] **Step 1: Full unit suite**

Run: `bun run validate && bun run test`
Expected: PASS (validate should be a no-op here — no schema or `pages/*.js` changes were made in this plan — but it's the documented post-`pages/`/`page-data` check and costs nothing to confirm)

- [ ] **Step 2: Full e2e suite**

Run: `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/opt/pw-browsers/chromium bun run test:e2e`
Expected: PASS (138 specs). Pay particular attention to:
- `accessibility.spec.js` — color contrast in both themes, especially the new `--eyebrow-agency` token
- `workspace-panels.spec.js` — its 1280→1920px docking sweep must still pass now that `page-layout--transaction`'s two-column grid is gone; re-verify rather than assume, per this repo's own documented history of that exact class of bug
- `navigation.spec.js` — anything that clicked through the old breadcrumb or related-rail

- [ ] **Step 3: Manual side-by-side against the original references**

For each of the four representative pages used throughout this plan's design/audit — `pestsTopic` (Agency), `insectsReport` (Transaction), `tenantRights` (Information), `ipmEducation` (Campaign) — screenshot the mockup at both `#mockPage` scope and full page, in both light and dark mode, and compare against the corresponding reference screenshot(s) named in the design spec's Context section. Confirm: no boxed cards/tiles/steps/contact-section anywhere, single-column layout on `insectsReport`, orange eyebrow only on `pestsTopic`, parent link (not breadcrumb) everywhere except `pestsTopic`, no "Things to know" sub-heading, footer icons present.

- [ ] **Step 4: Confirm formatting is clean**

Run: `bun run format:check`
Expected: PASS (no diff)

- [ ] **Step 5: Final review commit (if Step 3 turned up anything)**

If manual verification finds a discrepancy, fix it, re-run `bun run test`, and commit as a follow-up `fix:` — otherwise this task produces no commit of its own.

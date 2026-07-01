# Sidebar Accordion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the `.sidebar` review panel in `index.html` from seven always-visible stacked sections into seven collapsible `<details>`/`<summary>` sections, so reviewers can scan without scrolling past sections they aren't using.

**Architecture:** Pure markup + CSS change. Each existing `control-group` div becomes a `<details class="control-group">` with a `<summary class="eyebrow">` header (reusing the existing `.eyebrow` label style) and a `<div class="details-body">` wrapping the group's existing form fields/content unchanged. No JavaScript changes — `<details>` gives independent open/close state natively, and `js/app.js` only ever queries elements by `id`, none of which change.

**Tech Stack:** Vanilla HTML/CSS/JS, no build tooling beyond the existing `build_scripts/*.js` regeneration scripts.

## Global Constraints

- No changes to `js/app.js` — verified no code there queries by `aria-label` or assumes `.control-group` is a `<div>` (see spec "Scope / non-goals").
- No changes to element `id` attributes — `js/app.js` binds to these directly.
- `.eyebrow` is reused as the `<summary>` class per the spec ("reusing the existing `.eyebrow` label style").
- Two sections open by default on load: **Page mockup** and **Manager review** (spec-mandated).
- All other five sections start collapsed: Live content editor, Search metadata, Karl CMS tags, Applied rules, Reading targets.
- `manager-review-single-file.html` and `single-file-export-current-source.html` are generated files — never hand-edit them; regenerate via `build_scripts/build-single-file.js`.

---

### Task 1: Restructure sidebar markup into `<details>` accordion

**Files:**
- Modify: `index.html:21-57`

**Interfaces:**
- Consumes: nothing (pure markup restructure of existing sidebar HTML).
- Produces: seven `<details class="control-group">` elements inside `<aside class="sidebar">`, each containing exactly one `<summary class="eyebrow">` and one `<div class="details-body">`. All existing element `id`s (`pageSelect`, `urlInput`, `titleInput`, `descriptionInput`, `ctaInput`, `seoTitleInput`, `metaDescriptionInput`, `seoTitleCount`, `seoTitleStatus`, `metaDescriptionCount`, `metaDescriptionStatus`, `seoPreviewTitle`, `seoPreviewUrl`, `seoPreviewDescription`, `tagToggle`, `reviewPageLabel`, `reviewerInput`, `reviewDateInput`, `reviewDecision`, `reviewNotes`, `reviewRisks`, `reviewOwner`, `exportReviewCsv`, `exportReviewJson`, `exportAllTemplateCsv`, `reviewExportStatus`) are preserved unchanged — Task 3's verification depends on every one of these still resolving.

- [ ] **Step 1: Replace lines 21-57 of `index.html`**

Current content (`index.html:21-57`) is seven sibling blocks: two bare `control-group` divs (page select, URL slug), five labeled `control-group` divs, and one `control-group manager-review` div. Replace that entire span with:

```html
      <details class="control-group" open>
        <summary class="eyebrow">Page mockup</summary>
        <div class="details-body">
          <label for="pageSelect">Choose a page mockup</label>
          <select id="pageSelect"></select>
          <label for="urlInput">Preview URL slug</label>
          <input id="urlInput" type="text" value="sf.gov/topic-pests-and-housing-problems" aria-label="Preview URL slug">
        </div>
      </details>
      <details class="control-group">
        <summary class="eyebrow">Live content editor</summary>
        <div class="details-body">
          <label for="titleInput">Page title</label>
          <input id="titleInput" type="text" aria-label="Page title">
          <label for="descriptionInput">Short summary / description</label>
          <textarea id="descriptionInput" aria-label="Short summary or description"></textarea>
          <label for="ctaInput">Primary CTA label</label>
          <input id="ctaInput" type="text" aria-label="Primary CTA label">
          <p class="field-help">Use this to test page title, short summary, and primary CTA wording without editing the source data.</p>
        </div>
      </details>
      <details class="control-group">
        <summary class="eyebrow">Search metadata</summary>
        <div class="details-body">
          <label for="seoTitleInput">SEO Page Title</label>
          <input id="seoTitleInput" type="text" aria-label="SEO Page Title">
          <div class="char-count"><span id="seoTitleCount">0 characters</span><span id="seoTitleStatus">Target: 60 or fewer</span></div>
          <label for="metaDescriptionInput">Meta Description</label>
          <textarea id="metaDescriptionInput" aria-label="Meta Description"></textarea>
          <div class="char-count"><span id="metaDescriptionCount">0 characters</span><span id="metaDescriptionStatus">Target: 110 or fewer</span></div>
          <div class="search-preview" aria-label="Search result preview">
            <div id="seoPreviewTitle" class="search-preview-title">Search title preview</div>
            <div id="seoPreviewUrl" class="search-preview-url">https://sf.gov/topic-pests-and-housing-problems</div>
            <div id="seoPreviewDescription" class="search-preview-desc">Search description preview</div>
          </div>
          <p class="field-help">SEO fields support the content model fields: SEO Title and SEO Description. Keep the meta description short enough for SF.gov review.</p>
        </div>
      </details>
      <details class="control-group">
        <summary class="eyebrow">Karl CMS tags</summary>
        <div class="details-body">
          <div class="karl-tag-toggle"><span>Show placement tags</span><label class="karl-switch" aria-label="Show Karl CMS placement tags"><input id="tagToggle" type="checkbox" checked><span class="karl-slider"></span></label></div>
          <div class="cms-help">Tags identify where each text block should be entered in Karl CMS: metadata fields, body sections, primary actions, body links, Related section links, Agency page link sections, Resource Collection items, or editor-only notes.</div>
          <div class="cms-help"><strong>Note:</strong> Visual boxes are mockup previews. Karl placement is determined by the tag text, not by the visual box shape.</div>
        </div>
      </details>
      <details class="control-group">
        <summary class="eyebrow">Applied rules</summary>
        <div class="details-body">
          <div class="checklist">
            <div class="check">Roboto/Roboto Slab typography and SFDS-style spacing</div>
            <div class="check">Action Blue for links and primary action</div>
            <div class="check">Topic page uses scannable link clusters</div>
            <div class="check">Article 11 / HHVC scope only</div>
            <div class="check">72-hour tenant notice where applicable</div>
            <div class="check">No standard photo requirement</div>
            <div class="check">Report, prevent, scope, and tenant-help clusters</div>
            <div class="check">Enforcement pathway included without overloading Transaction pages</div>
            <div class="check">Tenant rights and anti-retaliation reassurance included</div>
          </div>
        </div>
      </details>

      <details class="control-group manager-review" open>
        <summary class="eyebrow">Manager review</summary>
        <div class="details-body">
          <p class="field-help">Use these fields during review. Exports download to your browser only; they do not change source files or publish pages.</p>
          <div class="review-page-label" id="reviewPageLabel">Current page: Pests and housing problems</div>
          <label for="reviewerInput">Reviewer name</label>
          <input id="reviewerInput" type="text" aria-label="Reviewer name" placeholder="Name or initials">
          <label for="reviewDateInput">Review date</label>
          <input id="reviewDateInput" type="text" aria-label="Review date">
          <label for="reviewDecision">Decision</label>
          <select id="reviewDecision" aria-label="Review decision">
            <option value="Needs review">Needs review</option>
            <option value="Approved">Approved</option>
            <option value="Approved with edits">Approved with edits</option>
            <option value="Revise and resubmit">Revise and resubmit</option>
            <option value="Blocked">Blocked</option>
          </select>
          <label for="reviewNotes">Decision notes</label>
          <textarea id="reviewNotes" aria-label="Decision notes" placeholder="What needs to change before approval?"></textarea>
          <label for="reviewRisks">Risks or blockers</label>
          <textarea id="reviewRisks" aria-label="Risks or blockers" placeholder="Legal/source review, policy issue, broken link, unclear scope, etc."></textarea>
          <label for="reviewOwner">Follow-up owner</label>
          <input id="reviewOwner" type="text" aria-label="Follow-up owner" placeholder="Name, role, or team">
          <div class="review-actions" aria-label="Review export actions">
            <button type="button" class="tool-btn" id="exportReviewCsv">Export current review CSV</button>
            <button type="button" class="tool-btn secondary-tool" id="exportReviewJson">Export current review JSON</button>
            <button type="button" class="tool-btn secondary-tool" id="exportAllTemplateCsv">Export all-page decision template</button>
          </div>
          <p class="field-help" id="reviewExportStatus">No review exported yet.</p>
        </div>
      </details>
      <details class="control-group">
        <summary class="eyebrow">Reading targets</summary>
        <div class="details-body">
          <p><strong>Transaction:</strong> Grade 5–6<br><strong>Prevention:</strong> Grade 6<br><strong>Inspection/process:</strong> Grade 6–7<br><strong>Enforcement/NOV:</strong> Grade 7–8</p>
        </div>
      </details>
```

- [ ] **Step 2: Confirm every original `id` still exists exactly once**

Run:
```bash
for id in pageSelect urlInput titleInput descriptionInput ctaInput seoTitleInput metaDescriptionInput seoTitleCount seoTitleStatus metaDescriptionCount metaDescriptionStatus seoPreviewTitle seoPreviewUrl seoPreviewDescription tagToggle reviewPageLabel reviewerInput reviewDateInput reviewDecision reviewNotes reviewRisks reviewOwner exportReviewCsv exportReviewJson exportAllTemplateCsv reviewExportStatus; do
  n=$(grep -o "id=\"$id\"" index.html | wc -l)
  echo "$id: $n"
done
```
Expected: every line prints `<id>: 1`. Investigate and fix any `0` (dropped) or `2` (duplicated) before continuing.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: restructure review sidebar into collapsible accordion sections"
```

---

### Task 2: Style the accordion and fix the leftover pre-audit focus-outline color

**Files:**
- Modify: `css/styles.css:38` (existing `.control-group` rule — add accordion-specific rules after it)
- Modify: `css/styles.css:42` (leftover legacy focus-outline color)

**Interfaces:**
- Consumes: `details.control-group`, `summary.eyebrow`, `.details-body` classes produced by Task 1.
- Produces: visual styling only — no new classes/ids that later tasks depend on.

**Context:** while auditing this file's design tokens earlier in this session, `--sfds-action-blue` was corrected from `#495ED4` to `#2A60AF` (Karl's documented Primary Base) everywhere except one leftover: the shared focus-outline rule at line 42 still hardcodes the old blue as `rgba(73, 94, 212, 0.25)`. Fix it to `rgba(42, 96, 175, 0.25)` (the rgb equivalent of `#2A60AF`) while touching this file for the accordion work.

- [ ] **Step 1: Fix the leftover focus-outline color**

In `css/styles.css`, find:
```css
    select:focus, input[type="text"]:focus, textarea:focus, button:focus, a:focus { outline: 3px solid rgba(73, 94, 212, 0.25); outline-offset: 2px; }
```
Replace with:
```css
    select:focus, input[type="text"]:focus, textarea:focus, button:focus, a:focus { outline: 3px solid rgba(42, 96, 175, 0.25); outline-offset: 2px; }
```

- [ ] **Step 2: Add accordion styles immediately after the existing `.control-group` rule**

In `css/styles.css`, find:
```css
    .control-group { margin-top: 1.25rem; padding-top: 1.25rem; border-top: 1px solid var(--sfds-border); }
```
Add these rules directly after it:
```css
    details.control-group > summary { display: flex; align-items: center; justify-content: space-between; width: 100%; list-style: none; cursor: pointer; }
    details.control-group > summary::-webkit-details-marker { display: none; }
    details.control-group > summary::after { content: "▾"; margin-left: .5rem; color: var(--sfds-slate-3); flex: 0 0 auto; transition: transform .15s ease; }
    details.control-group[open] > summary::after { transform: rotate(180deg); }
    details.control-group > summary:hover { color: var(--sfds-action-blue); }
    details.control-group > summary:focus-visible { outline: 3px solid rgba(42, 96, 175, 0.25); outline-offset: 2px; border-radius: 4px; }
    details.control-group .details-body { margin-top: .5rem; }
```

- [ ] **Step 3: Visual verification in browser**

The dev server should already be running at `http://localhost:8000/` (started earlier this session via `python3 -m http.server 8000`). If not:
```bash
python3 -m http.server 8000 &
```
Then, using the Playwright browser tools already loaded in this session:
1. Navigate to `http://localhost:8000/`.
2. Take a snapshot and confirm: "Page mockup" and "Manager review" sections show their content (open); "Live content editor", "Search metadata", "Karl CMS tags", "Applied rules", "Reading targets" are collapsed (only their `<summary>` header row visible).
3. Click the "Live content editor" summary — confirm it expands and shows the title/summary/CTA fields, and that "Page mockup" and "Manager review" remain open (multi-open behavior, not exclusive).
4. Tab to a collapsed summary (e.g. "Search metadata") and press `Enter` — confirm it toggles open via keyboard.

Expected: all four checks pass with no console errors beyond the pre-existing `favicon.ico` 404.

- [ ] **Step 4: Commit**

```bash
git add css/styles.css
git commit -m "style: add accordion chevron/hover/focus states, fix leftover focus-outline color"
```

---

### Task 3: Regenerate build artifacts and validate

**Files:**
- Modify (generated, via script — do not hand-edit): `manager-review-single-file.html`
- Modify (generated, via script — do not hand-edit): `single-file-export-current-source.html`

**Interfaces:**
- Consumes: the updated `index.html` and `css/styles.css` from Tasks 1-2.
- Produces: nothing consumed by later tasks — this is the final task in the plan.

- [ ] **Step 1: Regenerate the single-file exports**

Run:
```bash
node build_scripts/build-single-file.js
```
Expected output:
```
wrote manager-review-single-file.html (<byte count>)
wrote single-file-export-current-source.html (<byte count>)
```

- [ ] **Step 2: Validate page data integrity**

Run:
```bash
node build_scripts/validate.js
```
Expected output: `validated 17 pages` (no errors — this task didn't touch `pages/*.js`, so page count/content must be unchanged).

- [ ] **Step 3: Confirm the regenerated exports contain the new accordion markup**

Run:
```bash
grep -c "details class=\"control-group\"" manager-review-single-file.html single-file-export-current-source.html
```
Expected: both files report `7` (one `<details class="control-group"...` per accordion section — the "Manager review" one is `details class="control-group manager-review"`, which also matches this grep since it's a substring match).

- [ ] **Step 4: Commit**

```bash
git add manager-review-single-file.html single-file-export-current-source.html
git commit -m "chore: regenerate single-file exports with sidebar accordion"
```

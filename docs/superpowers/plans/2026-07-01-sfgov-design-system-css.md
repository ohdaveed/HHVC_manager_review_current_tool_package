# Adopt @sfgov/design-system CSS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace hand-copied SFDS color/typography guesses with the real `@sfgov/design-system` npm package's CSS (base, typography, components), so the mockup tool's buttons and tokens match the live SF.gov design system, while keeping the existing rendering logic and markup untouched.

**Architecture:** Add `@sfgov/design-system` as a devDependency (no bundler). Reference its `base.css`, `typography.css`, and `components.css` directly from `node_modules` via `<link>` tags in `index.html`, ordered after the existing `css/styles.css` so `components.css`'s `.btn` wins the cascade. Generalize `build_scripts/build-single-file.js` to inline every local stylesheet `<link>` (not just the one hardcoded `css/styles.css` path) so the new links flow into the single-file exports automatically.

**Tech Stack:** Vanilla HTML/CSS/JS, Node.js (build script only, no runtime framework), npm.

## Global Constraints

- `@sfgov/design-system` version pinned to `0.0.1` (only published stable version).
- Do not pull in `fonts.css` (duplicates existing Google Fonts `<link>` in `index.html`) or `utilities.css` (401KB, unused).
- `components.css` must load after `css/styles.css` in both `index.html` and the generated single-file exports, so the real SFDS `.btn` style wins the cascade tie-break.
- No bundler introduced; `node_modules` stays servable as static files (no build step beyond the existing `build-single-file.js`).
- `js/app.js` and `pages/*.js` are not modified — this is a CSS-only change.

---

### Task 1: Add npm dependency

**Files:**
- Create: `package.json`
- Modify: `.gitignore`
- Create (via `npm install`): `package-lock.json`, `node_modules/` (gitignored)

**Interfaces:**
- Produces: `node_modules/@sfgov/design-system/dist/css/base.css`, `.../typography.css`, `.../components.css` — file paths consumed by Task 2.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "hhvc-manager-review-mockup-tool",
  "private": true,
  "devDependencies": {
    "@sfgov/design-system": "0.0.1"
  }
}
```

- [ ] **Step 2: Add `node_modules/` to `.gitignore`**

Append to `.gitignore` (current content is just the Zone.Identifier rule):

```gitignore

# npm
node_modules/
```

- [ ] **Step 3: Install the dependency**

Run: `npm install`

Expected: creates `package-lock.json` and `node_modules/@sfgov/design-system/`, exits 0.

- [ ] **Step 4: Verify the CSS files exist**

Run:
```bash
ls node_modules/@sfgov/design-system/dist/css/base.css \
   node_modules/@sfgov/design-system/dist/css/typography.css \
   node_modules/@sfgov/design-system/dist/css/components.css
```

Expected: all three paths printed, no "No such file" errors.

- [ ] **Step 5: Verify git ignores node_modules**

Run: `git status --short`

Expected: `node_modules/` does NOT appear in the output. `package.json`, `.gitignore`, and `package-lock.json` appear as new/modified files.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json .gitignore
git commit -m "chore: add @sfgov/design-system as a devDependency"
```

---

### Task 2: Wire up SFDS stylesheet links in index.html

**Files:**
- Modify: `index.html:9-10` (the existing `css/styles.css` link)

**Interfaces:**
- Consumes: file paths produced by Task 1 (`node_modules/@sfgov/design-system/dist/css/*.css`).
- Produces: three new `<link>` tags in `index.html`, consumed by Task 3's inlining logic.

- [ ] **Step 1: Add the three stylesheet links after the existing `css/styles.css` link**

Current (`index.html:9-10`):
```html
  <link href="https://fonts.googleapis.com/css2?family=Rubik:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="css/styles.css" />
```

New:
```html
  <link href="https://fonts.googleapis.com/css2?family=Rubik:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="css/styles.css" />
  <link rel="stylesheet" href="node_modules/@sfgov/design-system/dist/css/base.css" />
  <link rel="stylesheet" href="node_modules/@sfgov/design-system/dist/css/typography.css" />
  <link rel="stylesheet" href="node_modules/@sfgov/design-system/dist/css/components.css" />
```

- [ ] **Step 2: Verify order is correct**

Run: `grep -n "stylesheet" index.html`

Expected output order: Google Fonts link, then `css/styles.css`, then `base.css`, then `typography.css`, then `components.css` — in that exact order (order determines cascade winner for `.btn`).

- [ ] **Step 3: Serve locally and visually check the button style**

Run: `python3 -m http.server 8791 &` (background), then open `http://localhost:8791/` in a browser (or via Playwright `browser_navigate` + `browser_take_screenshot`).

Expected: page loads with no console errors (check via `browser_console_messages` — no 404s for the three new stylesheet paths). Primary CTA button now shows the real SFDS button style (rounded, `#495ed4` background, `border-radius: 8px`, no visible border — distinct from the old `2px solid` bordered button).

Run: `pkill -f "http.server 8791"` to stop the server when done.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat: load @sfgov/design-system base/typography/component CSS"
```

---

### Task 3: Generalize build-single-file.js to inline all local stylesheets

**Files:**
- Modify: `build_scripts/build-single-file.js:12-17`

**Interfaces:**
- Consumes: `<link rel="stylesheet" href="...">` tags in `index.html` (Task 2's output).
- Produces: `manager-review-single-file.html`, `single-file-export-current-source.html` with all local stylesheets inlined as `<style>` blocks, in document order.

- [ ] **Step 1: Replace the single hardcoded stylesheet inline with a generic loop**

Current (`build_scripts/build-single-file.js:12-17`):
```js
// Inline the stylesheet.
const css = read('css/styles.css');
html = html.replace(
  /[ \t]*<link rel="stylesheet" href="css\/styles\.css"[^>]*>\s*/,
  `  <style>\n${css}\n  </style>\n`
);
```

New:
```js
// Inline every local stylesheet link, preserving order. Absolute
// http(s) links (e.g. Google Fonts) are left as external links.
html = html.replace(
  /[ \t]*<link rel="stylesheet" href="([^"]+)"[^>]*>\s*/g,
  (match, href) => {
    if (/^https?:\/\//.test(href)) return match;
    return `  <style>\n${read(href)}\n  </style>\n`;
  }
);
```

- [ ] **Step 2: Regenerate the single-file exports**

Run: `node build_scripts/build-single-file.js`

Expected output:
```
wrote manager-review-single-file.html (<byte count>)
wrote single-file-export-current-source.html (<byte count>)
```
(byte count should be noticeably larger than before, since ~4KB of SFDS CSS is now inlined).

- [ ] **Step 3: Verify all four stylesheets got inlined and the Google Fonts link stayed external**

Run:
```bash
grep -c "<style>" manager-review-single-file.html
grep -c "fonts.googleapis.com" manager-review-single-file.html
grep -c "node_modules" manager-review-single-file.html
```

Expected: `<style>` count is 4 (styles.css, base.css, typography.css, components.css); `fonts.googleapis.com` count is 1 (still an external `<link>`, not inlined); `node_modules` count is 0 (the `<link>` tags themselves were replaced, not left dangling).

- [ ] **Step 4: Open the regenerated single-file export in a browser and confirm it matches index.html**

Open `manager-review-single-file.html` directly (via `file://` or the same local server). Confirm the button renders with the same SFDS style seen in Task 2 Step 3, with no console errors and no broken `node_modules` references.

- [ ] **Step 5: Commit**

```bash
git add build_scripts/build-single-file.js manager-review-single-file.html single-file-export-current-source.html
git commit -m "feat: inline all local stylesheets in single-file exports, not just styles.css"
```

---

### Task 4: Update README.md

**Files:**
- Modify: `README.md` (file structure list and "Open" section)

**Interfaces:**
- None (documentation only).

- [ ] **Step 1: Add the npm install step to the "Open" section**

Current:
```markdown
## Open

Open `index.html` in a browser. If browser security blocks local scripts, run:
```

New:
```markdown
## Open

Run `npm install` once to fetch `@sfgov/design-system` (used for base/typography/component CSS). Then open `index.html` in a browser. If browser security blocks local scripts, run:
```

- [ ] **Step 2: Add `package.json` to the documented file structure**

Current file structure block starts with:
```text
HHVC_manager_review_current_tool_package/
├─ index.html
├─ css/styles.css
```

New:
```text
HHVC_manager_review_current_tool_package/
├─ package.json
├─ index.html
├─ css/styles.css
```

- [ ] **Step 3: Verify the edits render correctly**

Run: `grep -n "npm install\|package.json" README.md`

Expected: both lines present, in the "Open" section and file structure block respectively.

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: document npm install step for @sfgov/design-system"
```

---

### Task 5: End-to-end verification

**Files:**
- None modified — verification only.

**Interfaces:**
- None.

- [ ] **Step 1: Fresh-clone sanity check for the install step**

Run:
```bash
rm -rf node_modules
npm install
```

Expected: exits 0, `node_modules/@sfgov/design-system/dist/css/` populated again (confirms `package-lock.json` alone is sufficient — no hidden manual steps).

- [ ] **Step 2: Regenerate exports one final time from a clean install**

Run: `node build_scripts/build-single-file.js`

Expected: same "wrote ..." output as Task 3 Step 2, no errors.

- [ ] **Step 3: Full browser walkthrough**

Serve locally (`python3 -m http.server 8791 &`), then using Playwright:
- Navigate to `http://localhost:8791/`
- Take a screenshot of the default page (Pests and housing problems topic page)
- Check `browser_console_messages` — expect no errors (existing known favicon 404 is pre-existing and acceptable)
- Click through to at least one Transaction-type page (e.g. "Report rats or mice") via the page selector and confirm its primary CTA button also renders with the SFDS style
- Stop the server: `pkill -f "http.server 8791"`

Expected: no new console errors introduced by the stylesheet changes; buttons consistently show the SFDS style across pages.

- [ ] **Step 4: Final git status check**

Run: `git status --short`

Expected: clean working tree (everything committed in Tasks 1-4), `node_modules/` not listed.

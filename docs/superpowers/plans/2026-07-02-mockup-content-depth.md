# Mockup Page Content Depth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add safe, generic, on-scope depth to all 17 `pages/*.js` content modules of the HHVC Manager Review Mockup Tool without changing structure, rendering, navigation, or introducing unverifiable specifics.

**Architecture:** Content-only, additive edits to `pages/*.js`. Each page assigns a `window.HHVC_PAGES['<key>']` object rendered by `js/page-render.js`. Depth is added only through renderer-supported shapes (`paragraphs`, `bullets`, `table`, `callout`, `steps`, `cards` with existing `target`s). No `js/`, `css/`, `index.html`, slug, `target`, `order`, or SEO-field changes.

**Tech Stack:** Vanilla JS data modules, Bun (dev server + scripts), Zod validation (`build_scripts/validate.js`), Prettier.

---

## Conventions (apply to every task)

- **Prettier style:** no semicolons, single quotes, 2-space indent, 100 print width, ES5 trailing commas. Use the right single quote `’` inside strings (never a straight `'` mid-sentence) to avoid escaping, matching existing content.
- **Every new section/step/callout gets a `karl` note** ending with `(added for depth)` so reviewers can see what changed.
- **Do not remove or reword existing user-facing content.** Only add.
- **Report pages: keep the 311 CTA (`button: 'Report through 311'`) as the first step.** Add new sections after "What to do", never before it.
- **No invented specifics:** no fee amounts, dollar values, dates, deadlines, phone numbers, or legal citations that are not already in that file.
- **Standard verification after each page edit:**
  - Run: `export PATH="$HOME/.bun/bin:$PATH" && bun run validate`
  - Expected: `validated 17 pages` (no error output).
  - Then: `bun run format` (Prettier rewrites in place; expect the edited file listed or `unchanged`).
  - Commit the single page file.

### Reusable snippet A — "Get help making your report" (report pages)

Insert as a new section object immediately AFTER the `What to do` section (the one containing the 311 button) and BEFORE the next section, in these files: `report-rats-or-mice.js`, `report-cockroaches.js`, `report-bed-bugs.js`, `report-mosquitoes.js`, `report-vegetation-garbage.js`, `report-mold-humidity-condensation.js`.

```js
    {
      heading: 'Get help making your report',
      karl: 'Body: Help and access section (added for depth) — third-party reporting, language access, privacy.',
      kind: 'body',
      paragraphs: [
        'You can make a report even if you are not the tenant. A friend, family member, advocate, or helper can report for someone else.',
      ],
      bullets: [
        'You can ask 311 for help in your language.',
        'You do not have to give your name to make a report.',
        'HHVC does not share the reporter’s identity with the property owner or manager.',
        'You can ask 311 for a service request number so you can follow up later.',
      ],
    },
```

---

## Task 1: Topic page (`pestsTopic`)

**Files:**

- Modify: `pages/agency-service-grouping.js`

**Guardrail:** This page is checked for banned terms (`plumbing`, `dbi`, `roof leak`, `sewer`, `permit issue`, `construction defect`). None of the additions below use those terms — keep it that way. Keep the four clusters and existing cards intact.

- [ ] **Step 1: Add a language-access sentence to "About this topic".** In the `About this topic` section, append this string to the existing `paragraphs` array:

```js
        'You can ask 311 for help in your language when you report a problem.',
```

- [ ] **Step 2: Add a "How to use this page" body section.** Insert this new section object immediately after the `About this topic` section and before the `Report a problem` section:

```js
    {
      heading: 'How to use this page',
      karl: 'Topic page body: How to use this page (added for depth). Keep the four clusters intact.',
      kind: 'body',
      bullets: [
        'Report a problem if you are dealing with pests, mold, garbage, clutter, or other housing health problems.',
        'Prevent problems with step-by-step guidance for tenants, owners, and building staff.',
        'Know what HHVC can inspect if you are not sure where to start.',
        'Get tenant help if you are worried about reporting a housing condition.',
      ],
    },
```

- [ ] **Step 3: Validate, format, commit.**

Run: `export PATH="$HOME/.bun/bin:$PATH" && bun run validate && bun run format`
Expected: `validated 17 pages`; Prettier reports the file (or `unchanged`).

```bash
git add pages/agency-service-grouping.js
git commit -m "Add depth to Topic page: how-to-use section and language access"
```

---

## Task 2: `report-rats-or-mice.js`

**Files:**

- Modify: `pages/report-rats-or-mice.js`

- [ ] **Step 1: Insert reusable snippet A** ("Get help making your report") after the `What to do` section (after its closing `},`, before the `What happens next` section).
- [ ] **Step 2: Validate, format, commit.**

Run: `export PATH="$HOME/.bun/bin:$PATH" && bun run validate && bun run format`
Expected: `validated 17 pages`.

```bash
git add pages/report-rats-or-mice.js
git commit -m "Add help/access section to report rats or mice page"
```

---

## Task 3: `report-cockroaches.js`

**Files:**

- Modify: `pages/report-cockroaches.js`

- [ ] **Step 1: Insert reusable snippet A** after the `What to do` section, before `What happens next`.
- [ ] **Step 2: Validate, format, commit.**

```bash
git add pages/report-cockroaches.js
git commit -m "Add help/access section to report cockroaches page"
```

---

## Task 4: `report-bed-bugs.js`

**Files:**

- Modify: `pages/report-bed-bugs.js`

- [ ] **Step 1: Insert reusable snippet A** after the `What to do` section, before `What happens next`.
- [ ] **Step 2: Validate, format, commit.**

```bash
git add pages/report-bed-bugs.js
git commit -m "Add help/access section to report bed bugs page"
```

---

## Task 5: `report-mosquitoes.js`

**Files:**

- Modify: `pages/report-mosquitoes.js`

- [ ] **Step 1: Insert reusable snippet A** after the `What to do` section, before `What may happen next`.
- [ ] **Step 2: Add weekday-routing parity paragraph.** In the `What may happen next` section, append this string to its `paragraphs` array (after the existing "may check for standing water" paragraph, keeping order sensible — place it as the 2nd item is fine, but appending is acceptable):

```js
        'It can take a few days for 311 to route the complaint to Environmental Health and for HHVC to assign it to an inspector. Complaints are processed on weekdays.',
```

- [ ] **Step 3: Validate, format, commit.**

```bash
git add pages/report-mosquitoes.js
git commit -m "Add help/access section and weekday-routing note to report mosquitoes page"
```

---

## Task 6: `report-vegetation-garbage.js`

**Files:**

- Modify: `pages/report-vegetation-garbage.js`

This page is missing a "What happens next" section that its sibling report pages have — this is the biggest gap.

- [ ] **Step 1: Insert reusable snippet A** after the `What to do` section.
- [ ] **Step 2: Add a "What happens next" section** immediately after snippet A and before `Related pages`:

```js
    {
      heading: 'What happens next',
      karl: 'Body: After-report expectations, weekday processing note, and concise enforcement statement (added for depth to match sibling report pages).',
      kind: 'body',
      paragraphs: [
        'Environmental Health may review the report. If you gave contact information, an inspector may contact you to ask questions or schedule a visit.',
        'It can take a few days for 311 to route the complaint to Environmental Health and for HHVC to assign it to an inspector. Complaints are processed on weekdays.',
        'If you did not give contact information, an inspection may still happen without notice, for example if the report describes an urgent health or safety risk.',
        'If HHVC finds a violation, the City may require the property owner or responsible party to correct it.',
      ],
      callout: {
        karl: 'Body note: Tenant rights / anti-retaliation reassurance',
        text: 'Tenants have rights to safe and habitable housing. A property owner or manager cannot retaliate because a tenant reports housing conditions to the City.',
      },
    },
```

- [ ] **Step 3: Validate, format, commit.**

```bash
git add pages/report-vegetation-garbage.js
git commit -m "Add help/access and what-happens-next sections to report vegetation/garbage page"
```

---

## Task 7: `report-mold-humidity-condensation.js`

**Files:**

- Modify: `pages/report-mold-humidity-condensation.js`

- [ ] **Step 1: Insert reusable snippet A** after the `What to do` section, before `When HHVC may review mold`.
- [ ] **Step 2: Validate, format, commit.**

```bash
git add pages/report-mold-humidity-condensation.js
git commit -m "Add help/access section to report mold page"
```

---

## Task 8: `keep-rats-and-mice-out.js`

**Files:**

- Modify: `pages/keep-rats-and-mice-out.js`

Already very rich. Light-touch: add one safety callout to the cleanup section.

- [ ] **Step 1: Add a safety callout** to the `5. Safe cleanup and disinfection` section. Add this `callout` key to that section object (it currently has `paragraphs` and `bullets` but no `callout`):

```js
      callout: {
        karl: 'Body note: Cleanup safety (added for depth)',
        text: 'If you are pregnant, have a health condition, or are unsure about cleanup, ask for help. Do not disturb large amounts of droppings or nests yourself.',
      },
```

- [ ] **Step 2: Validate, format, commit.**

```bash
git add pages/keep-rats-and-mice-out.js
git commit -m "Add cleanup safety note to keep rats and mice out page"
```

---

## Task 9: `prevent-cockroaches.js`

**Files:**

- Modify: `pages/prevent-cockroaches.js`

- [ ] **Step 1: Add a "Know the signs of cockroaches" body section** as the FIRST section (before `Starve them of food and water`):

```js
    {
      heading: 'Know the signs of cockroaches',
      karl: 'Body: Signs of cockroaches (added for depth). Helps residents confirm a problem early.',
      kind: 'body',
      paragraphs: [
        'Finding cockroaches early makes them easier to control. Look for these common signs.',
      ],
      bullets: [
        'Droppings that look like ground pepper, coffee grounds, or small dark smears.',
        'A musty or oily smell in areas with heavy activity.',
        'Egg cases, which are small brown capsules, near cracks and hidden corners.',
        'Seeing cockroaches during the day, which can mean a large infestation.',
      ],
    },
```

- [ ] **Step 2: Validate, format, commit.**

```bash
git add pages/prevent-cockroaches.js
git commit -m "Add signs-of-cockroaches section to prevent cockroaches page"
```

---

## Task 10: `prevent-mosquitoes.js`

**Files:**

- Modify: `pages/prevent-mosquitoes.js`

Already rich (includes existing phone numbers — do not add new ones). Light-touch: add a "check after rain" body section.

- [ ] **Step 1: Add a "Check your property after rain" body section** immediately after the `Eliminate standing water` section and before `Follow West Nile virus precautions`:

```js
    {
      heading: 'Check your property after rain',
      karl: 'Body: Post-rain checklist (added for depth). Reinforces standing-water removal.',
      kind: 'body',
      paragraphs: [
        'Standing water can collect quickly after rain. Walk your property and empty water from these common spots each week.',
      ],
      bullets: [
        'Buckets, cans, jars, and other open containers',
        'Plant saucers, pots, and wheelbarrows',
        'Clogged gutters and downspouts',
        'Tarps, trash and recycling bins, and their lids',
        'Old tires and play equipment',
      ],
    },
```

- [ ] **Step 2: Validate, format, commit.**

```bash
git add pages/prevent-mosquitoes.js
git commit -m "Add post-rain standing-water checklist to prevent mosquitoes page"
```

---

## Task 11: `bed-bug-rules-prevention.js`

**Files:**

- Modify: `pages/bed-bug-rules-prevention.js`

Very rich. Light-touch: add a "How to spot bed bugs" body section early.

- [ ] **Step 1: Add a "How to spot bed bugs" body section** immediately after the `Use the official bed bug rules` section and before `Owner and manager responsibilities`:

```js
    {
      heading: 'How to spot bed bugs',
      karl: 'Body: Signs of bed bugs (added for depth). Helps tenants and staff detect early.',
      kind: 'body',
      paragraphs: [
        'Bed bugs are small and hide well. Knowing what to look for helps you find a problem before it spreads.',
      ],
      bullets: [
        'Small reddish-brown insects about the size of an apple seed.',
        'Itchy bites, often in a line or small cluster.',
        'Small blood spots or dark specks on sheets, mattress seams, and box springs.',
        'Shed skins or tiny eggs near seams, cracks, and headboards.',
      ],
    },
```

- [ ] **Step 2: Validate, format, commit.**

```bash
git add pages/bed-bug-rules-prevention.js
git commit -m "Add how-to-spot-bed-bugs section to bed bug rules and prevention page"
```

---

## Task 12: `reduce-indoor-moisture.js`

**Files:**

- Modify: `pages/reduce-indoor-moisture.js`

Very rich. Light-touch: add a "Signs of a moisture problem" body section near the top.

- [ ] **Step 1: Add a "Signs of a moisture problem" body section** immediately after the `Why moisture control matters` section and before `Keep indoor humidity in a safer range`:

```js
    {
      heading: 'Signs of a moisture problem',
      karl: 'Body: Signs of excess moisture (added for depth). Helps residents act before mold grows.',
      kind: 'body',
      paragraphs: ['Catching moisture early helps you prevent mold. Watch for these signs.'],
      bullets: [
        'Condensation or fog on windows, walls, or pipes',
        'A musty or damp smell that does not go away',
        'Peeling paint, bubbling, or warped materials',
        'Dark spots or stains on walls or ceilings',
        'Damp carpet, cabinets, or flooring',
      ],
    },
```

- [ ] **Step 2: Validate, format, commit.**

```bash
git add pages/reduce-indoor-moisture.js
git commit -m "Add signs-of-moisture-problem section to reduce indoor moisture page"
```

---

## Task 13: `integrated-pest-management-property-managers.js`

**Files:**

- Modify: `pages/integrated-pest-management-property-managers.js`

Very rich (Grade 6–7). Light-touch: add a "Common building conditions that attract pests" body section after the intro.

- [ ] **Step 1: Add a body section** immediately after the `Use IPM to prevent pests` section and before `1. Follow San Francisco owner responsibilities`:

```js
    {
      heading: 'Common building conditions that attract pests',
      karl: 'Information page body: Attractant conditions (added for depth). Frames the prevention steps that follow.',
      kind: 'body',
      paragraphs: [
        'Most pest problems in buildings start with a few common conditions. Fixing them early prevents infestations.',
      ],
      bullets: [
        'Unsealed gaps, cracks, and utility openings that let pests enter',
        'Overflowing, uncovered, or poorly serviced garbage areas',
        'Standing water, leaks, and damp spaces',
        'Clutter, cardboard storage, and unused materials that offer shelter',
        'Overgrown landscaping and debris close to walls and foundations',
      ],
    },
```

- [ ] **Step 2: Validate, format, commit.**

```bash
git add pages/integrated-pest-management-property-managers.js
git commit -m "Add attractant-conditions section to IPM for property managers page"
```

---

## Task 14: `hhvc-inspection-scope.js`

**Files:**

- Modify: `pages/hhvc-inspection-scope.js`

Moderate. Add an "If your problem is not listed" body section. Stay on-scope: do NOT name specific non-HHVC departments or route users to non-HHVC paths beyond "311 can help send it to the right place."

- [ ] **Step 1: Add a body section** immediately after the `How to choose the right page` (table) section and before `Related pages`:

```js
    {
      heading: 'If your problem is not listed',
      karl: 'Body: Out-of-scope guidance (added for depth). Stay within HHVC scope; do not route to specific non-HHVC paths.',
      kind: 'body',
      paragraphs: [
        'Some housing problems are handled by other City programs. If your problem is not on this list, you can still start with 311, which can help send your report to the right place.',
        'If you are not sure whether HHVC can review your problem, it is still okay to report it. HHVC will review whether it may involve a housing or pest-related public health concern.',
      ],
    },
```

- [ ] **Step 2: Validate, format, commit.**

```bash
git add pages/hhvc-inspection-scope.js
git commit -m "Add out-of-scope guidance section to HHVC inspection scope page"
```

---

## Task 15: `what-happens-after-report.js`

**Files:**

- Modify: `pages/what-happens-after-report.js`

Rich, and contains EXISTING specifics (fines, deadlines) — do not touch those. Add a "How to follow up on your report" body section.

- [ ] **Step 1: Add a body section** immediately after the `How a report moves through the City` section and before `Tenant rights and retaliation`:

```js
    {
      heading: 'How to follow up on your report',
      karl: 'Body: Follow-up guidance (added for depth). Generic, safe steps only.',
      kind: 'body',
      paragraphs: ['You can check on a report you already made. It helps to keep a few details handy.'],
      bullets: [
        'Keep your 311 service request number if you have one.',
        'Note the date you made the report.',
        'Contact 311 to ask about the status of your request.',
        'Tell 311 if the problem gets worse or becomes urgent.',
      ],
    },
```

- [ ] **Step 2: Validate, format, commit.**

```bash
git add pages/what-happens-after-report.js
git commit -m "Add follow-up guidance section to what-happens-after-report page"
```

---

## Task 16: `tenant-rights-reporting.js`

**Files:**

- Modify: `pages/tenant-rights-reporting.js`

Thinnest page — biggest depth opportunity. Add two body sections. Keep the existing "not legal advice" callout intact.

- [ ] **Step 1: Add "What retaliation can look like" and "What you can do" body sections** immediately after the `You can ask the City for help` section and before `Where to get tenant help`:

```js
    {
      heading: 'What retaliation can look like',
      karl: 'Body: Retaliation examples (added for depth). General information, not legal advice.',
      kind: 'body',
      paragraphs: ['Retaliation is when a property owner or manager punishes you for reporting a condition. It can take different forms.'],
      bullets: [
        'Trying to evict you or threatening eviction',
        'Raising your rent after you report a problem',
        'Reducing or removing services you normally have',
        'Refusing to make repairs because you reported a condition',
        'Threats, harassment, or pressure to drop a complaint',
      ],
    },
    {
      heading: 'What you can do',
      karl: 'Body: Tenant action steps (added for depth). General information, not legal advice.',
      kind: 'body',
      paragraphs: ['These steps can help protect you if you are worried about reporting a housing condition.'],
      bullets: [
        'Keep copies of repair requests, messages, and any reports you make.',
        'Report unsafe conditions to 311 so there is a record.',
        'Contact the Rent Board or a tenant support organization for help with your situation.',
        'You can ask 311 for help in your language.',
        'Ask for help if a disability or medical need makes it hard to report or prepare for an inspection.',
      ],
    },
```

- [ ] **Step 2: Validate, format, commit.**

```bash
git add pages/tenant-rights-reporting.js
git commit -m "Add retaliation-examples and what-you-can-do sections to tenant rights page"
```

---

## Task 17: `pay-healthy-housing-fee.js`

**Files:**

- Modify: `pages/pay-healthy-housing-fee.js`

**BLOCKED constraint:** existing `karl` notes say exact fee amounts, due dates, account requirements, and payment instructions are NOT confirmed. Do NOT add any amounts, dates, penalties, or payment URLs. Add only safe preparation/process depth. Preserve all existing BLOCKED `karl` notes.

- [ ] **Step 1: Add a "what to have ready" bullet list to "Before you pay".** Add this `bullets` key to the `Before you pay` section (it currently has only `paragraphs`):

```js
      bullets: [
        'Your notice or account information, if you received one',
        'The property address',
        'The name and contact information for the billing contact',
        'The payment method allowed on your notice',
      ],
```

- [ ] **Step 2: Add a "Questions about your fee" body section** immediately after the `If you need help` section and before `Related pages`:

```js
    {
      heading: 'Questions about your fee',
      karl: 'Body: Fee questions (added for depth). BLOCKED — do not add fee amounts, due dates, penalties, or payment links. Generic guidance only.',
      kind: 'body',
      paragraphs: [
        'If you are not sure whether the fee applies to your building, use the contact or help route listed on your notice or the final SF.gov fee page.',
        'Keep any notice or account information in case you need to ask a question or confirm a payment.',
      ],
    },
```

- [ ] **Step 3: Validate, format, commit.**

```bash
git add pages/pay-healthy-housing-fee.js
git commit -m "Add safe preparation and questions depth to pay Healthy Housing fee page"
```

---

## Task 18: Full verification, build, and browser check

**Files:** none (verification only)

- [ ] **Step 1: Run validation.**

Run: `export PATH="$HOME/.bun/bin:$PATH" && bun run validate`
Expected: `validated 17 pages`

- [ ] **Step 2: Run format check (lint).**

Run: `export PATH="$HOME/.bun/bin:$PATH" && bun run format:check`
Expected: `All matched files use Prettier code style!`

- [ ] **Step 3: Run build.**

Run: `export PATH="$HOME/.bun/bin:$PATH" && mkdir -p data && bun run build`
Expected: `validated 17 pages`, `wrote data/page_inventory.csv`, and the two single-file HTML exports written. (Generated files are gitignored.)

- [ ] **Step 4: Browser spot-check.** Start `bun run dev` (port 8080) and open the app. Load and read: the Topic page, `report-vegetation-garbage` (new "What happens next"), `tenant-rights-reporting` (two new sections), `prevent-cockroaches` (signs section), and `pay-healthy-housing-fee` (prep bullets). Confirm new content renders, reads cleanly at the page's grade level, and shows correct `Karl:` tags. Capture before/after screenshots and a short demo video.

- [ ] **Step 5: Push and update the PR.**

```bash
git push -u origin cursor/setup-dev-environment-e422
```

---

## Self-Review

**Spec coverage:**

- Depth on all 17 pages → Tasks 1–17 (one per page). ✔
- Renderer-supported shapes only → all additions use `paragraphs`, `bullets`, `callout`, `steps`/section objects, no new fields. ✔
- No invented specifics → snippets avoid numbers/dates/phones/citations; fee page explicitly blocked. ✔
- Reading level preserved → short sentences, plain words; no change to `reading`. ✔
- Preserve `karl`/slug/target/order/SEO → additions only add `karl`; no target/slug/order/SEO edits. ✔
- Topic banned terms → Task 1 additions avoid all six banned terms. ✔
- Verification (validate/format/build/browser) → Task 18. ✔

**Placeholder scan:** No "TBD"/"TODO"/"handle edge cases" — every step has concrete strings. ✔ (Note: the word "BLOCKED" appears only inside preserved/added `karl` review notes for the fee page, matching existing convention — not a plan placeholder.)

**Type consistency:** All additions are plain section/callout objects matching `sectionSchema` (`heading`, `karl`, `kind`, `paragraphs`, `bullets`, `callout`). `callout` uses `{ karl, text }`. Reusable snippet A is identical across the six report pages. ✔

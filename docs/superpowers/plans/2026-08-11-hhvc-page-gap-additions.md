# HHVC Page Gap Additions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 5 new HHVC mockup pages that fill genuine content gaps identified against the current 22-page structure, and wire them into navigation and cross-links, without reversing the prior 40→19 page consolidation.

**Architecture:** Each new page is a standalone `pages/*.js` module following the existing data-driven page-object pattern (`window.HHVC_PAGES['<key>'] = {...}`), registered via an `import` in `js/page-data.js` plus an `order` array entry. No new JS modules, no renderer changes — the existing schema and render pipeline already support everything these pages need (`Transaction` type, `steps[]`, `bullets[]`, `cards[]`, `callout`, unverified pills).

**Tech Stack:** Plain browser JS page-data modules (no framework), Bun for `bun run validate`/`bun run test`, Zod schema in `build_scripts/schema.js`.

## Global Constraints

- Prettier formatting is a hard CI gate: no semicolons, single quotes, 2-space indent, ES5 trailing commas. Write every new file in this style from the start.
- Every new page: `type: 'Transaction'`, `editorStatus: 'placeholder'`.
- Any specific procedural claim with no source doc gets `{ text, unverified: true, unverifiedReason }` instead of a bare string, per `docs/superpowers/specs/2026-08-11-hhvc-page-gap-additions-design.md`'s sourcing caveat. Generic claims (e.g. "keep photos and receipts") reused verbatim from an already-published, un-pilled sentence on an existing page do NOT need a pill — reuse the existing wording exactly rather than re-deriving it as new (and therefore unverified) content.
- Any `paragraphs[]` or `steps[].text[]` array must stay under 3 items (3+ is a hard validation failure — `bullets[]` has no such limit). Every `sections[]` entry needs both `heading` and `karl`.
- Inline internal links (`[label](pageKey)`) use the destination page's exact `title` string as the label, matching the convention used everywhere else in `pages/*.js`.
- `Related pages` / hub-listing cards for these pages carry `title` + `target` only, no `text` — matches the existing `title-only` card-inheritance bucket these sections fall into (see CLAUDE.md's "Card descriptions are inherited, not printed").
- No banned terms (`plumbing`, `dbi`, `roof leak`, `sewer`, `permit issue`, `construction defect`) anywhere in new content.
- No copy changes to existing pages beyond the specific additive cross-links listed in Task 6 — do not touch anything else in `pestsTopic`, `scopeInfo`, `findHotelRecords`, `recordsHub`, `afterReport`, or `noticeOfViolation`.
- Run `bun run validate && bun run test` after every task that touches `pages/*.js` or `js/page-data.js`.

---

## Task 1: `sroHotelReport` page

**Files:**
- Create: `pages/report-sro-hotel-problem.js`
- Modify: `js/page-data.js` (add import + `order` entry)
- Test: `bun run validate && bun run test` (no dedicated unit test file — `build_scripts/validate.js`'s Zod schema plus business-invariant checks, and the full Bun suite, are this repo's coverage for new page content)

**Interfaces:**
- Consumes: nothing (first task)
- Produces: page key `sroHotelReport`, `title: 'Report a problem in an SRO or hotel'` — referenced by Task 6's cross-links into `pestsTopic`, `scopeInfo`, and `findHotelRecords`

- [ ] **Step 1: Create `pages/report-sro-hotel-problem.js`**

```js
window.HHVC_PAGES = window.HHVC_PAGES || {}
window.HHVC_PAGES['sroHotelReport'] = {
  slug: 'sf.gov/report-problem-sro-hotel',
  type: 'Transaction',
  title: 'Report a problem in an SRO or hotel',
  summary:
    'Report a pest, garbage, or housing health problem in a single room occupancy (SRO) hotel or residential hotel.',
  audience: [
    'A resident of an SRO or residential hotel',
    'A shelter resident or advocate',
    'A property owner or operator of a residential hotel or shelter',
    'A tenant representative helping someone understand their next steps',
  ],
  reading: 'Grade 6',
  editorStatus: 'placeholder',
  editorNote:
    'New page filling a gap identified in docs/superpowers/specs/2026-08-11-hhvc-page-gap-additions-design.md: findHotelRecords only looks up existing records for SROs, residential hotels, and shelters ("a separate dataset from the general complaints and inspection lookup") — nothing let a reviewer see the report-side transaction for that same setting. Modeled on rodentsReport/filthReport/insectsReport\'s shape. Whether SRO/hotel reports genuinely route through a separate 311 intake path, or only the records-lookup side is separate, is unconfirmed — flagged unverified below pending SME confirmation, the same open question findHotelRecords itself still carries.',
  whatToKnow: {
    cost: 'Free',
    thingsToKnow: [
      'You can report anonymously — 311 does not require your name, and HHVC does not share your identity with the property owner or operator.',
      'This report covers pest, garbage, and housing health conditions. Records and inspection history for SROs, residential hotels, and shelters use a separate lookup tool.',
    ],
  },
  sections: [
    {
      heading: 'What this covers',
      karl: 'Best real-schema fit: a things_to_know entry (Title = this heading, Text = the paragraph below). Scope explainer mirrors findHotelRecords\' framing of a separate program dataset for this housing type.',
      kind: 'body',
      paragraphs: [
        {
          text: 'Environmental Health reviews pest, garbage, and housing health reports for residential hotels, SROs, and shelters, including shared kitchens, bathrooms, and garbage areas.',
          unverified: true,
          unverifiedReason:
            'Whether this report routes through the same 311 intake as rodentsReport/filthReport/insectsReport, or a separate SRO/hotel-specific intake, has no tier-1 source. Confirm with HHVC before publication.',
        },
      ],
    },
    {
      heading: 'What to do',
      karl: 'what_to_do StreamField. Each step below = one Section block (section_title + section_specifics), mirroring insectsReport\'s "Start your report" / "Tell us where the problem is" shape.',
      kind: 'body',
      steps: [
        {
          title: 'Start your report',
          text: [
            'Use 311 to report an active problem to the City.',
            'If the problem is urgent, report now.',
          ],
          button: 'Report through 311',
          karl: 'what_to_do -> Section. Section title: "Start your report". Section specifics: Text block (these 2 sentences) + Button link block ("Report through 311"), matching the primary-311-action-first pattern used on rodentsReport/filthReport/insectsReport.',
        },
        {
          title: 'Tell us where the problem is',
          text: ['Only share the details that apply to your situation:'],
          bullets: [
            '**What you saw:** Pests, garbage, or a housing health condition, and which unit or shared area it affects.',
            '**Where it is:** The building address, and whether the problem is in a unit, a shared kitchen or bathroom, or another common area.',
            '**When it started:** How long this has been happening.',
            '**Your contact info:** Leave your name and phone number or email if you want an inspector to reach out to you.',
          ],
          karl: 'what_to_do -> Section. Section title: "Tell us where the problem is". Section specifics: Text block (intro sentence) + bulleted checklist, mirroring insectsReport\'s equivalent step.',
        },
      ],
    },
    {
      heading: 'Related pages',
      karl: 'Maps to the Related field: a generic unrestricted "Page" chooser, repeatable.',
      kind: 'placement',
      cards: [
        {
          title: 'Find residential hotel and shelter records',
          target: 'findHotelRecords',
        },
        {
          title: 'Learn what Healthy Housing and Vector Control can inspect',
          target: 'scopeInfo',
        },
        {
          title: 'What happens after you report a housing or pest problem',
          target: 'afterReport',
        },
        {
          title: 'Tenant rights when reporting housing conditions',
          target: 'tenantRights',
        },
      ],
    },
  ],
  seoTitle: 'Report a problem in an SRO or hotel | SF.gov',
  metaDescription:
    'Report a pest, garbage, or housing health problem in a San Francisco SRO, residential hotel, or shelter.',
}
```

- [ ] **Step 2: Register the import in `js/page-data.js`**

Modify `js/page-data.js`. Old:

```js
import '../pages/report-cockroaches-mosquitoes-insects.js'
import '../pages/lookup-building-records.js'
```

New:

```js
import '../pages/report-cockroaches-mosquitoes-insects.js'
import '../pages/report-sro-hotel-problem.js'
import '../pages/lookup-building-records.js'
```

- [ ] **Step 3: Add the `order` entry in `js/page-data.js`**

Old:

```js
    ['insectsReport', 'Transaction: Report cockroaches, mosquitoes, and other insects'],
    ['recordsHub', 'Resource collection: Look up building records'],
```

New:

```js
    ['insectsReport', 'Transaction: Report cockroaches, mosquitoes, and other insects'],
    ['sroHotelReport', 'Transaction: Report a problem in an SRO or hotel'],
    ['recordsHub', 'Resource collection: Look up building records'],
```

- [ ] **Step 4: Validate and test**

Run: `bun run validate && bun run test`
Expected: both succeed — `validate` reports 23 pages with `sroHotelReport`'s Related-page targets (`findHotelRecords`, `scopeInfo`, `afterReport`, `tenantRights`) all resolving since they already exist; `test` stays at the current pass count (no test file references page count directly except `tests/doc-counts.test.js`, which checks docs against the filesystem, not against this page — see Task 7 if that test fails).

- [ ] **Step 5: Commit**

```bash
git add pages/report-sro-hotel-problem.js js/page-data.js
git commit -m "content: add sroHotelReport page for SRO/hotel problem reports"
```

---

## Task 2: `inspectorLookup` page

**Files:**
- Create: `pages/find-inspector-by-neighborhood.js`
- Modify: `js/page-data.js` (add import + `order` entry)
- Test: `bun run validate && bun run test`

**Interfaces:**
- Consumes: nothing (independent of Task 1's page, only depends on the `js/page-data.js` state Task 1 already committed)
- Produces: page key `inspectorLookup`, `title: 'Find your Healthy Housing inspector by neighborhood'` — referenced by Task 6's cross-link into `recordsHub`

- [ ] **Step 1: Create `pages/find-inspector-by-neighborhood.js`**

```js
window.HHVC_PAGES = window.HHVC_PAGES || {}
window.HHVC_PAGES['inspectorLookup'] = {
  slug: 'sf.gov/find-healthy-housing-inspector-by-neighborhood',
  type: 'Transaction',
  title: 'Find your Healthy Housing inspector by neighborhood',
  summary: 'Look up which Healthy Housing and Vector Control inspector covers your neighborhood.',
  audience: [
    'A tenant checking who their assigned inspector is',
    'A property owner or manager coordinating with an assigned inspector',
    'A tenant representative or advocate following up on a case',
    'A resident of an SRO, residential hotel, or shelter',
  ],
  reading: 'Grade 7',
  editorStatus: 'placeholder',
  editorNote:
    'New page reinstating content dropped in the 40->19 page consolidation (previously the retired findInspector key, aliased to scopeInfo — see js/page-data.js\'s HHVC_DELETED_PAGE_ALIASES). Confirmed during design (docs/superpowers/specs/2026-08-11-hhvc-page-gap-additions-design.md) that scopeInfo holds no inspector-lookup content; the alias exists only so an old shared link resolves to something. Modeled on findHotelRecords\' explainer-plus-lookup-button shape. The lookup tool\'s actual entry point (URL or internal tool) is unconfirmed — the button below targets the inert "#" placeholder until HHVC confirms a real destination; do not invent a URL.',
  whatToKnow: {
    cost: 'Free',
    thingsToKnow: [
      'This lookup is organized by neighborhood, not by building address.',
      'The exact lookup tool and destination have not been confirmed yet.',
    ],
  },
  sections: [
    {
      heading: 'What this tool covers',
      karl: 'Best real-schema fit: a things_to_know entry (Title = this heading, Text = the paragraph below).',
      kind: 'body',
      paragraphs: [
        {
          text: 'Healthy Housing and Vector Control assigns inspectors by neighborhood. Use this page to find contact information for the inspector who covers your area.',
          unverified: true,
          unverifiedReason:
            'Whether HHVC organizes inspector assignments strictly by neighborhood, or by some other territory division, has no tier-1 source. Confirm with HHVC before publication.',
        },
      ],
    },
    {
      heading: 'Open the lookup tool',
      karl: 'what_to_do -> Section. Section title: "Open the lookup tool". Section specifics: Text block (this paragraph) + Button link block. Target is the inert "#" placeholder — see editorNote — rather than an invented URL.',
      kind: 'body',
      paragraphs: [
        'Select your neighborhood to see the assigned inspector and their contact information.',
      ],
      button: 'Find your inspector',
      buttonUrl: '#',
      callout: {
        title: 'Lookup destination not yet confirmed',
        text: 'This button is a placeholder until HHVC confirms the real lookup tool and entry point.',
        variant: 'note',
      },
    },
    {
      heading: 'Related pages',
      karl: 'Maps to the Related field: a generic unrestricted "Page" chooser, repeatable.',
      kind: 'placement',
      cards: [
        {
          title: 'Look up building records',
          target: 'recordsHub',
        },
        {
          title: 'Find complaints and inspection records',
          target: 'findRecords',
        },
        {
          title: 'Look up residential health code violations',
          target: 'findViolations',
        },
        {
          title: 'Healthy Housing and Vector Control',
          target: 'pestsTopic',
        },
      ],
    },
  ],
  seoTitle: 'Find your Healthy Housing inspector by neighborhood | SF.gov',
  metaDescription:
    'Look up which Healthy Housing and Vector Control inspector covers your San Francisco neighborhood.',
}
```

- [ ] **Step 2: Register the import in `js/page-data.js`**

Old:

```js
import '../pages/lookup-residential-hotel-records.js'
import '../pages/public-records-request.js'
```

New:

```js
import '../pages/lookup-residential-hotel-records.js'
import '../pages/find-inspector-by-neighborhood.js'
import '../pages/public-records-request.js'
```

- [ ] **Step 3: Add the `order` entry in `js/page-data.js`**

Old:

```js
    ['findHotelRecords', 'Transaction: Find residential hotel and shelter records'],
    ['publicRecords', 'Transaction: Make a public records request'],
```

New:

```js
    ['findHotelRecords', 'Transaction: Find residential hotel and shelter records'],
    ['inspectorLookup', 'Transaction: Find your Healthy Housing inspector by neighborhood'],
    ['publicRecords', 'Transaction: Make a public records request'],
```

- [ ] **Step 4: Validate and test**

Run: `bun run validate && bun run test`
Expected: both succeed — 24 pages, `inspectorLookup`'s Related-page targets (`recordsHub`, `findRecords`, `findViolations`, `pestsTopic`) all resolve, and the `buttonUrl: '#'` passes `findUnsafeUrls` (the inert sentinel is explicitly allowed).

- [ ] **Step 5: Commit**

```bash
git add pages/find-inspector-by-neighborhood.js js/page-data.js
git commit -m "content: add inspectorLookup page, reinstating the retired findInspector gap"
```

---

## Task 3: `tenantNoticeSteps` page

**Files:**
- Create: `pages/tenant-steps-after-notice-of-violation.js`
- Modify: `js/page-data.js` (add import + `order` entry)
- Test: `bun run validate && bun run test`

**Interfaces:**
- Consumes: nothing new
- Produces: page key `tenantNoticeSteps`, `title: 'What tenants need to do after a Notice of Violation'` — referenced by Task 4's `order` insertion point and Task 6's cross-link into `noticeOfViolation`

- [ ] **Step 1: Create `pages/tenant-steps-after-notice-of-violation.js`**

```js
window.HHVC_PAGES = window.HHVC_PAGES || {}
window.HHVC_PAGES['tenantNoticeSteps'] = {
  slug: 'sf.gov/step-by-step--tenant-steps-after-notice-of-violation',
  type: 'Transaction',
  title: 'What tenants need to do after a Notice of Violation',
  summary:
    'Learn what to do if a Notice of Violation lists corrective actions for your unit or building.',
  audience: [
    'A tenant with corrective actions listed on a Notice of Violation',
    'A tenant representative helping someone understand their next steps',
  ],
  reading: 'Grade 6',
  editorStatus: 'placeholder',
  editorNote:
    'New page expanding the tenant half of noticeOfViolation\'s shared "Make a plan to correct the conditions" step into dedicated depth, per docs/superpowers/specs/2026-08-11-hhvc-page-gap-additions-design.md. Reuses noticeOfViolation\'s already-verified statements (the notice does not change tenant habitability rights; contact the investigator named on the notice) rather than restating unsourced enforcement-timeline figures, which stay on afterReport. Unit-prep and access-notice specifics below are unconfirmed and flagged unverified.',
  whatToKnow: {
    cost: 'Free',
    thingsToKnow: [
      'Your Notice of Violation lists which actions apply to your unit.',
      'A property owner or manager cannot retaliate against you for reporting a condition or for actions listed on a notice.',
    ],
  },
  sections: [
    {
      heading: 'Prepare your unit',
      karl: 'Transaction -> Steps -> Step, mirroring noticeOfViolation\'s numbered-step shape.',
      kind: 'body',
      steps: [
        {
          title: 'Check what applies to you',
          text: [
            'Read your Notice of Violation to see which corrective actions are listed for your unit or a shared area.',
          ],
          karl: 'Transaction -> Steps -> Step. Step type: number. Title: "Check what applies to you".',
        },
        {
          title: 'Get your unit ready',
          bullets: [
            {
              text: 'Clear the area that needs treatment or repair so the work can be completed.',
              unverified: true,
              unverifiedReason:
                'What "ready" specifically requires (e.g. removing furniture, bagging belongings) has no tier-1 source. Confirm with HHVC before publication.',
            },
            {
              text: 'Follow any preparation instructions from your property owner, manager, or HHVC.',
              unverified: true,
              unverifiedReason:
                'No tier-1 source confirms who is responsible for issuing unit-prep instructions in every case. Confirm with HHVC before publication.',
            },
          ],
          karl: 'Transaction -> Steps -> Step. Step type: number. Title: "Get your unit ready".',
        },
        {
          title: 'Allow access for treatment or inspection',
          text: [
            {
              text: 'Allow properly noticed access to your unit for scheduled treatment, repair work, or a follow-up inspection.',
              unverified: true,
              unverifiedReason:
                "The specific notice period a property owner must give a tenant before entry has no tier-1 source in this design pass. Confirm with HHVC before publication.",
            },
          ],
          karl: 'Transaction -> Steps -> Step. Step type: number. Title: "Allow access for treatment or inspection".',
        },
      ],
    },
    {
      heading: 'Know your rights during this process',
      karl: 'Maps to an "Information section" -> Title and text block. Reuses noticeOfViolation\'s already-verified habitability statement rather than restating it as new unverified content.',
      kind: 'body',
      paragraphs: [
        'A Notice of Violation does not change your right to safe and habitable housing.',
      ],
      bullets: ['[Tenant rights and reporting](tenantRights)'],
    },
    {
      heading: 'If nothing happens by the deadline',
      karl: 'Maps to a Title and text block. Links forward to afterReport\'s enforcement chain instead of restating its unverified fee/hearing figures, per the design spec\'s explicit link-forward instruction.',
      kind: 'body',
      paragraphs: [
        'Contact the investigator named on your notice if the property owner or manager has not started the corrective work.',
      ],
      bullets: [
        '[What happens after you report a housing or pest problem](afterReport)',
        '[Fix your Healthy Housing and Vector Control violation](noticeOfViolation)',
      ],
    },
    {
      heading: 'Related pages',
      karl: 'Maps to the Related field: a generic unrestricted "Page" chooser, repeatable.',
      kind: 'placement',
      cards: [
        {
          title: 'Fix your Healthy Housing and Vector Control violation',
          target: 'noticeOfViolation',
        },
        {
          title: 'Tenant rights when reporting housing conditions',
          target: 'tenantRights',
        },
        {
          title: 'What happens after you report a housing or pest problem',
          target: 'afterReport',
        },
      ],
    },
  ],
  seoTitle: 'What tenants need to do after a Notice of Violation | SF.gov',
  metaDescription:
    'Learn what to do as a tenant after a Healthy Housing and Vector Control Notice of Violation.',
}
```

- [ ] **Step 2: Register the import in `js/page-data.js`**

Old:

```js
import '../pages/respond-to-notice-of-violation.js'
import '../pages/hhvc-inspection-scope.js'
```

New:

```js
import '../pages/respond-to-notice-of-violation.js'
import '../pages/tenant-steps-after-notice-of-violation.js'
import '../pages/hhvc-inspection-scope.js'
```

- [ ] **Step 3: Add the `order` entry in `js/page-data.js`**

Old:

```js
    ['noticeOfViolation', 'Transaction: Fix your Healthy Housing and Vector Control violation'],
    ['payFee', 'Transaction: Pay your Healthy Housing fee'],
```

New:

```js
    ['noticeOfViolation', 'Transaction: Fix your Healthy Housing and Vector Control violation'],
    ['tenantNoticeSteps', 'Transaction: What tenants need to do after a Notice of Violation'],
    ['payFee', 'Transaction: Pay your Healthy Housing fee'],
```

- [ ] **Step 4: Validate and test**

Run: `bun run validate && bun run test`
Expected: both succeed — 25 pages, `tenantNoticeSteps`'s targets (`tenantRights`, `afterReport`, `noticeOfViolation`) all resolve.

- [ ] **Step 5: Commit**

```bash
git add pages/tenant-steps-after-notice-of-violation.js js/page-data.js
git commit -m "content: add tenantNoticeSteps page for tenant-specific NOV depth"
```

---

## Task 4: `inspectionPrepFollowup` page

**Files:**
- Create: `pages/get-ready-for-followup-inspection.js`
- Modify: `js/page-data.js` (add import + `order` entry)
- Test: `bun run validate && bun run test`

**Interfaces:**
- Consumes: `js/page-data.js`'s post-Task-3 state (anchors on the `tenantNoticeSteps` lines Task 3 just added)
- Produces: page key `inspectionPrepFollowup`, `title: 'Get ready for a follow-up inspection'` — referenced by Task 6's cross-link into `noticeOfViolation`

- [ ] **Step 1: Create `pages/get-ready-for-followup-inspection.js`**

```js
window.HHVC_PAGES = window.HHVC_PAGES || {}
window.HHVC_PAGES['inspectionPrepFollowup'] = {
  slug: 'sf.gov/step-by-step--get-ready-for-a-follow-up-inspection',
  type: 'Transaction',
  title: 'Get ready for a follow-up inspection',
  summary:
    'Prepare for a Healthy Housing and Vector Control follow-up inspection after a Notice of Violation.',
  audience: [
    'A property owner or manager who received a Notice of Violation',
    'A tenant with corrective actions listed on a Notice of Violation',
    'A building operator coordinating repairs, pest treatment, or cleanup',
    'A tenant representative helping someone understand their next steps',
  ],
  reading: 'Grade 6',
  editorStatus: 'placeholder',
  editorNote:
    'New page expanding noticeOfViolation\'s existing "Prepare for follow-up inspection" step (currently two sentences) into a full checklist, per docs/superpowers/specs/2026-08-11-hhvc-page-gap-additions-design.md. Reuses noticeOfViolation\'s already-verified record-keeping language; links forward to afterReport\'s enforcement chain rather than restating its unverified fee/hearing figures.',
  whatToKnow: {
    cost: 'Free',
    thingsToKnow: [
      'A follow-up inspection checks whether the conditions on your Notice of Violation were corrected.',
      'If the reinspection finds the conditions were not corrected, HHVC may take further enforcement action.',
    ],
  },
  sections: [
    {
      heading: 'Document your work',
      karl: 'Transaction -> Steps -> Step, mirroring noticeOfViolation\'s numbered-step shape.',
      kind: 'body',
      steps: [
        {
          title: 'Keep records of what you completed',
          text: [
            'Keep records of the work you complete, such as photos, receipts, or pest treatment reports.',
          ],
          karl: 'Transaction -> Steps -> Step. Step type: number. Title: "Keep records of what you completed". Reuses noticeOfViolation\'s existing, already-verified record-keeping sentence.',
        },
        {
          title: 'Make sure the cited conditions are fully corrected',
          text: [
            {
              text: 'Confirm every condition listed on the notice has been addressed, not only the ones that were easiest to fix.',
              unverified: true,
              unverifiedReason:
                'No tier-1 source confirms whether a partial correction can close part of a multi-condition notice. Confirm with HHVC before publication.',
            },
          ],
          karl: 'Transaction -> Steps -> Step. Step type: number. Title: "Make sure the cited conditions are fully corrected".',
        },
      ],
    },
    {
      heading: 'What to expect at the follow-up visit',
      karl: 'Transaction -> Steps -> Step, mirroring afterReport\'s inspection-narrative shape.',
      kind: 'body',
      steps: [
        {
          title: 'An inspector checks the cited conditions',
          text: [
            {
              text: 'An inspector reviews the specific conditions listed on your Notice of Violation to confirm whether they were corrected.',
              unverified: true,
              unverifiedReason:
                "What exactly a follow-up inspection checks beyond the notice's cited conditions has no tier-1 source. Confirm with HHVC before publication.",
            },
          ],
          karl: 'Transaction -> Steps -> Step. Step type: number. Title: "An inspector checks the cited conditions".',
        },
        {
          title: 'If something is still not fixed',
          text: ['HHVC may take further enforcement action, which can include a reinspection fee.'],
          bullets: ['[What happens after you report a housing or pest problem](afterReport)'],
          karl: 'Transaction -> Steps -> Step. Step type: number. Title: "If something is still not fixed". Links forward to afterReport\'s enforcement chain rather than restating its unverified fee/hearing figures — matches the sentence already published, unpilled, in noticeOfViolation\'s own whatToKnow.thingsToKnow.',
        },
      ],
    },
    {
      heading: 'Related pages',
      karl: 'Maps to the Related field: a generic unrestricted "Page" chooser, repeatable.',
      kind: 'placement',
      cards: [
        {
          title: 'Fix your Healthy Housing and Vector Control violation',
          target: 'noticeOfViolation',
        },
        {
          title: 'What happens after you report a housing or pest problem',
          target: 'afterReport',
        },
        {
          title: 'Tenant rights when reporting housing conditions',
          target: 'tenantRights',
        },
      ],
    },
  ],
  seoTitle: 'Get ready for a follow-up inspection | SF.gov',
  metaDescription:
    'Prepare for a Healthy Housing and Vector Control follow-up inspection after a Notice of Violation.',
}
```

- [ ] **Step 2: Register the import in `js/page-data.js`**

Old:

```js
import '../pages/tenant-steps-after-notice-of-violation.js'
import '../pages/hhvc-inspection-scope.js'
```

New:

```js
import '../pages/tenant-steps-after-notice-of-violation.js'
import '../pages/get-ready-for-followup-inspection.js'
import '../pages/hhvc-inspection-scope.js'
```

- [ ] **Step 3: Add the `order` entry in `js/page-data.js`**

Old:

```js
    ['tenantNoticeSteps', 'Transaction: What tenants need to do after a Notice of Violation'],
    ['payFee', 'Transaction: Pay your Healthy Housing fee'],
```

New:

```js
    ['tenantNoticeSteps', 'Transaction: What tenants need to do after a Notice of Violation'],
    ['inspectionPrepFollowup', 'Transaction: Get ready for a follow-up inspection'],
    ['payFee', 'Transaction: Pay your Healthy Housing fee'],
```

- [ ] **Step 4: Validate and test**

Run: `bun run validate && bun run test`
Expected: both succeed — 26 pages, `inspectionPrepFollowup`'s targets (`noticeOfViolation`, `afterReport`, `tenantRights`) all resolve.

- [ ] **Step 5: Commit**

```bash
git add pages/get-ready-for-followup-inspection.js js/page-data.js
git commit -m "content: add inspectionPrepFollowup page expanding NOV reinspection prep"
```

---

## Task 5: `inspectionPrepInitial` page

**Files:**
- Create: `pages/get-ready-for-first-inspection.js`
- Modify: `js/page-data.js` (add import + `order` entry)
- Test: `bun run validate && bun run test`

**Interfaces:**
- Consumes: nothing new
- Produces: page key `inspectionPrepInitial`, `title: 'Get ready for a housing inspection after you report'` — referenced by Task 6's cross-link into `afterReport`

- [ ] **Step 1: Create `pages/get-ready-for-first-inspection.js`**

```js
window.HHVC_PAGES = window.HHVC_PAGES || {}
window.HHVC_PAGES['inspectionPrepInitial'] = {
  slug: 'sf.gov/step-by-step--get-ready-for-a-housing-inspection',
  type: 'Transaction',
  title: 'Get ready for a housing inspection after you report',
  summary:
    'Prepare for a Healthy Housing and Vector Control inspection after you file a 311 report.',
  audience: [
    'A person who filed a 311 report',
    'A tenant or tenant representative waiting for follow-up',
    'An employee who reported a pest or vector concern',
    'A property owner or manager responding to a reported condition',
  ],
  reading: 'Grade 6',
  editorStatus: 'placeholder',
  editorNote:
    'New page giving reviewers the actionable checklist afterReport gestures at but does not contain ("An inspector may contact you" / "An inspection may happen") without turning afterReport itself into a how-to page, per docs/superpowers/specs/2026-08-11-hhvc-page-gap-additions-design.md. Reuses afterReport\'s already-verified no-advance-notice sentence rather than restating it as new unverified content.',
  whatToKnow: {
    cost: 'Free',
    thingsToKnow: [
      'If you gave contact information, an inspector may contact you to ask questions or schedule a visit.',
      'An inspection may happen without advance notice when the reported problem can be seen from an accessible area.',
    ],
  },
  sections: [
    {
      heading: 'Before the inspector arrives',
      karl: 'Transaction -> Steps -> Step, mirroring noticeOfViolation\'s numbered-step shape.',
      kind: 'body',
      steps: [
        {
          title: 'Clear access to the reported area',
          text: [
            {
              text: 'Clear a path to the area you reported so an inspector can see the condition.',
              unverified: true,
              unverifiedReason:
                'What specifically an inspector needs access to has no tier-1 source. Confirm with HHVC before publication.',
            },
          ],
          karl: 'Transaction -> Steps -> Step. Step type: number. Title: "Clear access to the reported area".',
        },
        {
          title: 'Be ready to answer questions or provide access',
          text: [
            'If you gave contact information, an inspector may contact you to ask questions or schedule a visit.',
          ],
          karl: 'Transaction -> Steps -> Step. Step type: number. Title: "Be ready to answer questions or provide access". Reuses afterReport\'s already-verified sentence.',
        },
        {
          title: 'Gather anything relevant',
          bullets: [
            {
              text: 'Photos of the condition, dated if possible.',
              unverified: true,
              unverifiedReason:
                'Whether photos help an inspection, and any specific format HHVC prefers, has no tier-1 source. Confirm with HHVC before publication.',
            },
            {
              text: 'Any prior communication with a property owner or manager about the problem.',
              unverified: true,
              unverifiedReason:
                'Whether HHVC uses prior tenant-to-owner communication during an inspection has no tier-1 source. Confirm with HHVC before publication.',
            },
          ],
          karl: 'Transaction -> Steps -> Step. Step type: number. Title: "Gather anything relevant".',
        },
      ],
    },
    {
      heading: 'What to expect during the visit',
      karl: 'Transaction -> Steps -> Step, mirroring afterReport\'s inspection-narrative shape.',
      kind: 'body',
      steps: [
        {
          title: 'An inspector may check the reported area and nearby spaces',
          text: [
            {
              text: 'An inspector may look at the specific condition you reported as well as nearby areas that could be related.',
              unverified: true,
              unverifiedReason:
                'The scope of what an inspector checks beyond the reported condition has no tier-1 source. Confirm with HHVC before publication.',
            },
          ],
          karl: 'Transaction -> Steps -> Step. Step type: number. Title: "An inspector may check the reported area and nearby spaces".',
        },
        {
          title: 'You may not get advance notice for every visit',
          text: [
            'If you did not give contact information, an inspection may still happen without notice when areas can be accessed, for example if the report describes an urgent health or safety risk.',
          ],
          karl: 'Transaction -> Steps -> Step. Step type: number. Title: "You may not get advance notice for every visit". Reuses afterReport\'s already-verified sentence.',
        },
      ],
    },
    {
      heading: 'Related pages',
      karl: 'Maps to the Related field: a generic unrestricted "Page" chooser, repeatable.',
      kind: 'placement',
      cards: [
        {
          title: 'What happens after you report a housing or pest problem',
          target: 'afterReport',
        },
        {
          title: 'Learn what Healthy Housing and Vector Control can inspect',
          target: 'scopeInfo',
        },
        {
          title: 'Tenant rights when reporting housing conditions',
          target: 'tenantRights',
        },
      ],
    },
  ],
  seoTitle: 'Get ready for a housing inspection after you report | SF.gov',
  metaDescription:
    'Prepare for a Healthy Housing and Vector Control inspection after you file a 311 report.',
}
```

- [ ] **Step 2: Register the import in `js/page-data.js`**

Old:

```js
import '../pages/what-happens-after-report.js'
import '../pages/tenant-rights-reporting.js'
```

New:

```js
import '../pages/what-happens-after-report.js'
import '../pages/get-ready-for-first-inspection.js'
import '../pages/tenant-rights-reporting.js'
```

- [ ] **Step 3: Add the `order` entry in `js/page-data.js`**

Old:

```js
    ['afterReport', 'Information: What happens after you report'],
    ['tenantRights', 'Information: Tenant rights and reporting'],
```

New:

```js
    ['afterReport', 'Information: What happens after you report'],
    ['inspectionPrepInitial', 'Transaction: Get ready for a housing inspection after you report'],
    ['tenantRights', 'Information: Tenant rights and reporting'],
```

- [ ] **Step 4: Validate and test**

Run: `bun run validate && bun run test`
Expected: both succeed — 27 pages (all 5 new pages now present), `inspectionPrepInitial`'s targets (`afterReport`, `scopeInfo`, `tenantRights`) all resolve.

- [ ] **Step 5: Commit**

```bash
git add pages/get-ready-for-first-inspection.js js/page-data.js
git commit -m "content: add inspectionPrepInitial page for post-report inspection prep"
```

---

## Task 6: Wire cross-links into existing pages

**Files:**
- Modify: `pages/agency-service-grouping.js` (`pestsTopic`)
- Modify: `pages/hhvc-inspection-scope.js` (`scopeInfo`)
- Modify: `pages/lookup-residential-hotel-records.js` (`findHotelRecords`)
- Modify: `pages/lookup-building-records.js` (`recordsHub`)
- Modify: `pages/what-happens-after-report.js` (`afterReport`)
- Modify: `pages/respond-to-notice-of-violation.js` (`noticeOfViolation`) — two separate edits
- Test: `bun run validate && bun run test`

**Interfaces:**
- Consumes: all 5 page keys/titles produced by Tasks 1–5 (`sroHotelReport`, `inspectorLookup`, `tenantNoticeSteps`, `inspectionPrepFollowup`, `inspectionPrepInitial`)
- Produces: nothing further downstream — this is the last content task

- [ ] **Step 1: Add `sroHotelReport` card to `pestsTopic`'s "Get help with pests, mold, or trash" section**

Modify `pages/agency-service-grouping.js`. Old:

```js
        {
          title: 'Report garbage, filth, and overgrown vegetation',
          target: 'filthReport',
          karl: 'Services subsection entry -> SF.gov page link to the consolidated filth-report Transaction. This is the focused report route for the current live topic’s mold and trash scope; the description is a copy of the destination page Description, which is what Karl renders here.',
        },
        {
          title: 'Healthy housing and pest resources',
          target: 'verminResources',
```

New:

```js
        {
          title: 'Report garbage, filth, and overgrown vegetation',
          target: 'filthReport',
          karl: 'Services subsection entry -> SF.gov page link to the consolidated filth-report Transaction. This is the focused report route for the current live topic’s mold and trash scope; the description is a copy of the destination page Description, which is what Karl renders here.',
        },
        {
          title: 'Report a problem in an SRO or hotel',
          target: 'sroHotelReport',
          karl: 'Services subsection entry -> SF.gov page link to the SRO/hotel-report Transaction, added 2026-08-11 to fill the gap findHotelRecords\' lookup-only scope left. The description is a copy of the destination page Description, which is what Karl renders here; see the page-level note.',
        },
        {
          title: 'Healthy housing and pest resources',
          target: 'verminResources',
```

- [ ] **Step 2: Add an SRO/hotel line to `scopeInfo`'s "How to choose the right page" bullets**

Modify `pages/hhvc-inspection-scope.js`. Old:

```js
      bullets: [
        '**Rats, mice, raccoons, or other four-legged pests:** [Report rats, mice, and other four-legged problems](rodentsReport)',
        '**Cockroaches, bed bugs, mosquitoes, flies, wasps, or mites:** [Report cockroaches, mosquitoes, and other insects](insectsReport)',
        '**Garbage, clutter, animal waste, pigeon droppings or roosting, overgrown plants, or mold from humidity:** [Report garbage, filth, and overgrown vegetation](filthReport)',
        '**Dead birds:** [Report a dead bird to the State West Nile virus program](https://westnile.ca.gov/report)',
        '**Health Code Article 11:** [Read Article 11 in plain language](article11Guide)',
      ],
```

New:

```js
      bullets: [
        '**Rats, mice, raccoons, or other four-legged pests:** [Report rats, mice, and other four-legged problems](rodentsReport)',
        '**Cockroaches, bed bugs, mosquitoes, flies, wasps, or mites:** [Report cockroaches, mosquitoes, and other insects](insectsReport)',
        '**Garbage, clutter, animal waste, pigeon droppings or roosting, overgrown plants, or mold from humidity:** [Report garbage, filth, and overgrown vegetation](filthReport)',
        '**A problem in an SRO or residential hotel:** [Report a problem in an SRO or hotel](sroHotelReport)',
        '**Dead birds:** [Report a dead bird to the State West Nile virus program](https://westnile.ca.gov/report)',
        '**Health Code Article 11:** [Read Article 11 in plain language](article11Guide)',
      ],
```

- [ ] **Step 3: Add `sroHotelReport` card to `findHotelRecords`'s "Related pages"**

Modify `pages/lookup-residential-hotel-records.js`. Old:

```js
      cards: [
        {
          title: 'Find complaints and inspection records',
          target: 'findRecords',
          karl: 'related panel entry — page chooser only; this description text is not supported in the real schema (see section-level karl note above).',
        },
```

New:

```js
      cards: [
        {
          title: 'Report a problem in an SRO or hotel',
          target: 'sroHotelReport',
          karl: 'related panel entry — page chooser only; this description text is not supported in the real schema (see section-level karl note above).',
        },
        {
          title: 'Find complaints and inspection records',
          target: 'findRecords',
          karl: 'related panel entry — page chooser only; this description text is not supported in the real schema (see section-level karl note above).',
        },
```

- [ ] **Step 4: Add `inspectorLookup` card to `recordsHub`'s "Building lookups" section**

Modify `pages/lookup-building-records.js`. Old:

```js
        {
          title: 'Find residential hotel and shelter records',
          target: 'findHotelRecords',
          karl: "SF.gov page link block, links to an existing Transaction page (an SF.gov landing page that itself CTAs out to an external hotel-program lookup). This block is just an unrestricted page reference — it has no custom title/text field, so this card's `text` description has no home in Karl; flag for Digital Services if the description must survive.",
        },
      ],
    },
    {
      heading: 'Formal requests and payments',
```

New:

```js
        {
          title: 'Find residential hotel and shelter records',
          target: 'findHotelRecords',
          karl: "SF.gov page link block, links to an existing Transaction page (an SF.gov landing page that itself CTAs out to an external hotel-program lookup). This block is just an unrestricted page reference — it has no custom title/text field, so this card's `text` description has no home in Karl; flag for Digital Services if the description must survive.",
        },
        {
          title: 'Find your Healthy Housing inspector by neighborhood',
          target: 'inspectorLookup',
          karl: "SF.gov page link block, links to the inspector-lookup Transaction added 2026-08-11. This block is just an unrestricted page reference — it has no custom title/text field, so this card's `text` description has no home in Karl.",
        },
      ],
    },
    {
      heading: 'Formal requests and payments',
```

- [ ] **Step 5: Link `afterReport`'s "An inspection may happen" step to `inspectionPrepInitial`**

Modify `pages/what-happens-after-report.js`. Old:

```js
        {
          title: 'An inspection may happen',
          text: [
            'If you did not give contact information, an inspection may still happen without notice when areas can be accessed, for example if the report describes an urgent health or safety risk.',
          ],
          karl: 'Maps to a fourth Title and text block: Title = this step title, Text = the paragraph below.',
        },
```

New:

```js
        {
          title: 'An inspection may happen',
          text: [
            'If you did not give contact information, an inspection may still happen without notice when areas can be accessed, for example if the report describes an urgent health or safety risk.',
          ],
          bullets: ['[Get ready for a housing inspection after you report](inspectionPrepInitial)'],
          karl: 'Maps to a fourth Title and text block: Title = this step title, Text = the paragraph below, plus a rich-text link (added 2026-08-11) to the new inspection-prep checklist this step previously had nowhere to point to.',
        },
```

- [ ] **Step 6: Link `noticeOfViolation`'s "Contact the investigator" step to `tenantNoticeSteps`**

Modify `pages/respond-to-notice-of-violation.js`. Old:

```js
          bullets: [
            'A Notice of Violation does not change a tenant’s right to safe and habitable housing.',
            '[Tenant rights and reporting](tenantRights)',
            '[Property owner responsibilities](ownerHub)',
            '[Integrated pest management for property owners and managers](ownerGuidance)',
          ],
          karl: 'Transaction -> Steps -> Step. Step type: number. Title: "Contact the investigator if you need help". Step description: the two paragraphs plus the four bullets, including rich-text links to the three related HHVC pages. Optional, Cost, Time, and Transaction link: blank. The contact direction is supported by the HHVC Vegetation Overgrowth Notice; the language avoids promising an extension.',
```

New:

```js
          bullets: [
            'A Notice of Violation does not change a tenant’s right to safe and habitable housing.',
            '[What tenants need to do after a Notice of Violation](tenantNoticeSteps)',
            '[Tenant rights and reporting](tenantRights)',
            '[Property owner responsibilities](ownerHub)',
            '[Integrated pest management for property owners and managers](ownerGuidance)',
          ],
          karl: 'Transaction -> Steps -> Step. Step type: number. Title: "Contact the investigator if you need help". Step description: the two paragraphs plus the five bullets, including rich-text links to the four related HHVC pages (a tenantNoticeSteps link added 2026-08-11). Optional, Cost, Time, and Transaction link: blank. The contact direction is supported by the HHVC Vegetation Overgrowth Notice; the language avoids promising an extension.',
```

- [ ] **Step 7: Link `noticeOfViolation`'s "Prepare for follow-up inspection" step to `inspectionPrepFollowup`**

Modify `pages/respond-to-notice-of-violation.js`. Old:

```js
        {
          title: 'Prepare for follow-up inspection',
          text: [
            'Keep records of the work you complete, such as photos, receipts, or pest treatment reports.',
            'Be ready for HHVC to check whether the cited conditions were corrected. Follow-up inspection may be needed before the case can close.',
          ],
          karl: 'Transaction -> Steps -> Step. Step type: number. Title: "Prepare for follow-up inspection". Step description: the two paragraphs. Optional, Cost, Time, and Transaction link: blank. The Article 11 workflow explicitly includes follow-up inspection after the compliance period; this does not promise a particular inspection date.',
        },
```

New:

```js
        {
          title: 'Prepare for follow-up inspection',
          text: [
            'Keep records of the work you complete, such as photos, receipts, or pest treatment reports.',
            'Be ready for HHVC to check whether the cited conditions were corrected. Follow-up inspection may be needed before the case can close.',
          ],
          bullets: ['[Get ready for a follow-up inspection](inspectionPrepFollowup)'],
          karl: 'Transaction -> Steps -> Step. Step type: number. Title: "Prepare for follow-up inspection". Step description: the two paragraphs, plus a rich-text link (added 2026-08-11) to the new follow-up-inspection checklist. Optional, Cost, Time, and Transaction link: blank. The Article 11 workflow explicitly includes follow-up inspection after the compliance period; this does not promise a particular inspection date.',
        },
```

- [ ] **Step 8: Validate and test**

Run: `bun run validate && bun run test`
Expected: both succeed. `validate` confirms every new link target resolves and nothing is orphaned; `test` count stays the same (no test file asserts a fixed page count or fixed card count on these six files — confirmed by the absence of any such page-specific assertion in `tests/page-registry-data.test.js`, `tests/data-validation.test.js`, or `tests/page-render.test.js`, which all operate generically over whatever `pages/*.js` contains).

- [ ] **Step 9: Commit**

```bash
git add pages/agency-service-grouping.js pages/hhvc-inspection-scope.js pages/lookup-residential-hotel-records.js pages/lookup-building-records.js pages/what-happens-after-report.js pages/respond-to-notice-of-violation.js
git commit -m "content: cross-link the 5 new HHVC pages into their nearest existing pages"
```

---

## Task 7: Final verification gate

**Files:** none (verification only)

**Interfaces:**
- Consumes: the complete state after Tasks 1–6
- Produces: nothing — this is the terminal task

- [ ] **Step 1: Run the formatting gate**

Run: `bun run format:check`
Expected: PASS. If it reports violations (e.g. a stray semicolon or double quote slipped into one of the new files), run `bun run format` to auto-fix, then re-run `bun run format:check` to confirm PASS.

- [ ] **Step 2: Run validate one more time against the final state**

Run: `bun run validate`
Expected: PASS, reporting 27 pages total (22 original + 5 new), with `pestsTopic` still first in `order`, no missing-order-key or unresolved-target errors, and no banned-term or unsafe-URL findings on the 5 new pages.

- [ ] **Step 3: Run the full test suite**

Run: `bun run test`
Expected: PASS. If `tests/doc-counts.test.js` fails, it means that test pins the "22 pages" figure from CLAUDE.md's own prose — open `tests/doc-counts.test.js`, confirm whether it reads the count from `CLAUDE.md`/`AGENTS.md` text or computes it independently, and if it's a hardcoded expectation tied to the page count, update the doc prose it's checking (CLAUDE.md's "The repo currently holds **22 pages** under `pages/`" line and any equivalent line in `AGENTS.md`) to say 27, matching this plan's `Global Constraints` scope note that doc/test drift here is expected and must be fixed together, not worked around.

- [ ] **Step 4: If Step 3 required a doc update, commit it separately**

```bash
git add CLAUDE.md AGENTS.md
git commit -m "docs: update page count from 22 to 27 after HHVC page gap additions"
```

(Skip this step if Step 3 passed with no doc changes needed.)

- [ ] **Step 5: Confirm the final commit sequence**

Run: `git log --oneline -8`
Expected: 6 or 7 commits (Tasks 1–6, plus Task 7's doc-count commit if it was needed), each with a `content:` or `docs:` prefix, in the order they were made.

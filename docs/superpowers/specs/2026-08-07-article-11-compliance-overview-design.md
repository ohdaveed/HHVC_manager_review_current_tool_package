# Article 11 compliance overview page — design

## Problem

The tool has one page about Health Code Article 11 today —
`pages/health-code-article-11.js` (`article11Guide`) — but it is a ~500-line
Report-type legal/plain-language table mapping all ~30 nuisance provisions
section by section. It's the right shape for someone who wants the full
mapping, but it is not a landing page: there's no single place that tells a
property owner, in the shape SF.gov already uses for compliance pages (see
`https://www.sf.gov/information--minimum-wage-ordinance`), "here's what
you're required to do, here's the fee, here's who to call."

## Goal

Add a new, short `Information`-type page that plays the role the minimum
wage ordinance page plays for employers: a compliance-first front door.
`article11Guide` is unchanged and stays the deep-dive destination this page
links out to.

## Non-goals

- Not replacing or trimming `article11Guide`.
- Not duplicating the full owner-responsibility table from `article11Guide`
  or the full fee schedule from `payFee` — this page condenses and links
  rather than restates.

## Page metadata

- Page key: `article11Compliance`
- File: `pages/article-11-compliance-for-property-owners.js`
- `type`: `Information`
- `slug`: `sf.gov/information--article-11-compliance-for-property-owners`
- Primary audience: property owners and managers (compliance-focused,
  mirroring the wage page's employer framing). Secondary: tenants/advocates
  wanting the short version.
- Reading level: Grade 6-7, matching sibling `Information` pages.
- Order placement: insert into `js/page-data.js`'s `order` array next to the
  `article11Guide` / `ownerHub` / `scopeInfo` cluster.

## Structure (Approach B — checklist-first)

Mirrors the wage-ordinance page's shape: compliance statement immediately
followed by a front-loaded actionable checklist (the equivalent of the wage
page's prominent dollar figure), then supporting sections, then contact.

1. **What Article 11 requires** — opening compliance statement (owners/
   managers must keep buildings free of public health nuisances — pests,
   garbage, mold, rodents — under Health Code Article 11), immediately
   followed by a **"Quick compliance checklist" callout**:
   - Pay your annual Healthy Housing fee if your building has 3+ rental
     units
   - Investigate tenant pest reports within 72 hours
   - Hire a licensed pest control operator (PCO) for treatment — not
     unlicensed staff
   - Keep records of complaints, inspections, and treatments for at least 2
     years
   - Notify tenants in writing before pesticide application
   - Complete pest-management training if you have repeat violations
2. **Key facts** (`whatToKnow`) — annual Healthy Housing fee applies to
   buildings with 3+ rental units; current certified rates $103–$808+ by
   unit count (reuse the same figures/citation as `payFee`); link to the
   full fee schedule.
3. **If you get a report or notice** — the 72-hour investigation window,
   what a Notice of Violation means, links to `noticeOfViolation` and
   `afterReport`.
4. **What you're required to do** — condensed recordkeeping/licensing/
   pesticide-notification/training requirements, sourced from
   `article11Guide`'s existing owner-responsibility and PCO-requirement
   tables but not restated in full — link out for the complete table.
5. **Legal authority** — Health Code Article 11 Sec. 581 (nuisance
   definition) and Sec. 596/600 (enforcement/penalties), link to municode
   and to `article11Guide` for the section-by-section mapping.
6. **Resources** — links to `ownerHub`, `ownerGuidance` (IPM), `scopeInfo`,
   `payFee`.
7. **Contact** — reuse the standard HHVC contact block already used by
   `agency-service-grouping.js` / `integrated-pest-management-property-managers.js`:
   phone `311 (call or text)` / `415-252-3805`, email `ehb@sfdph.org`.

## Data/content sourcing

All facts (fee tiers, 72-hour window, recordkeeping duration, PCO
requirements, legal citations) are pulled from existing verified content in
`article11Guide` and `payFee` rather than re-derived — this page is a
condensation/front-door, not new research. Where a fact only exists in one
source page, the `karl` note on that section will point back to it so a
reviewer can cross-check.

## Validation impact

New page must:
- Get an `import` in `js/page-data.js` plus an `order` entry
  (`build_scripts/page-import-checks.js` / `findMissingOrderKeys` enforce
  this).
- Pass `findListFormatViolations` (checklist and any 3+ item lists use
  `bullets`, not `paragraphs`).
- Pass `findBrokenCardTargets`/`findBrokenButtonTargets`/
  `findBrokenInlineLinks` (all internal links must resolve to real page
  keys — `noticeOfViolation`, `afterReport`, `ownerHub`, `ownerGuidance`,
  `scopeInfo`, `payFee`, `article11Guide` all already exist).
- Run `bun run validate` and `bun run test` after adding.

## Open questions for reviewer (carried as `karl` notes on the page, not
blocking this design)

- Exact SF.gov URL slug convention for a new page (using the wage-ordinance
  page's `information--<slug>` pattern as the model).
- Whether Karl's Information content type has a distinct "checklist"
  block or whether the callout + bullets combination below is the closest
  real-schema fit (same kind of open question `article11Guide` already
  flags elsewhere in this tool).

# HHVC page gap additions

**Date:** 2026-08-11
**Status:** Approved design, not yet implemented

## Context

The user supplied a ~60-page "HHVC Program Page Inventory" brainstorm document,
organized into 5 topic hubs (Report / Fix / Prevent / Learn / Find), and asked
whether any of it should be added to the tool.

The tool currently holds 22 pages in a flat structure. That structure is
itself the result of a deliberate prior consolidation from ~40 pages down to
19 (see `js/page-data.js`'s `HHVC_DELETED_PAGE_ALIASES` map, referencing PRs
#60 and #62), later grown back to 22. Comparing the inventory against the
current page set plus that alias map showed that **most of the ~60 inventory
items already exist**, absorbed into a smaller number of consolidated pages
during that merge — e.g. every per-pest report and per-pest prevention page
in the inventory's "Report" and "Prevent" hubs rolls into
`rodentsReport`/`filthReport`/`insectsReport`/`mosquitoControl`, and the
"tenant/owner responsibilities" items roll into `tenantRights`/`ownerHub`.
Re-adding those would reverse that consolidation decision, not extend it.

The user confirmed the intent is **selective additions only**: keep the
current 22-page consolidated structure, and add only inventory items that
have no current equivalent.

## Gap analysis

Walking the inventory against the current 22 pages and the alias map
surfaced 9 candidate gaps — inventory items with no real current-page
equivalent, as opposed to items that already exist under a merged page.
Of those 9, the user selected 5 to build. The other 4
(reinspection-fees info, consequences-if-not-fixed info, Director's-Hearing
prep, dead-bird WNV report) are explicitly **out of scope** for this design;
the dead-bird item in particular was an explicit prior consolidation
decision (aliased to `insectsReport`) and reinstating it was declined.

## Decision: 5 new pages

All five are `type: 'Transaction'`. This tool maps Karl's "Step by step"
content type onto `type: 'Transaction'` with a `steps[]` section — see
`noticeOfViolation` and `afterReport`'s inspection-narrative section, both of
which use this pattern already. There is no separate "Step by step" `type`
string in use anywhere in `pages/*.js`.

### 1. `sroHotelReport` — "Report a problem in an SRO or hotel"

`findHotelRecords` already exists, but it only *looks up* existing records
("This lookup covers residential hotels, SROs, and shelters — a separate
dataset from the general complaints and inspection lookup"). Nothing lets a
reviewer see what *reporting* a new problem in that setting looks like. This
page is the report-side sibling to `rodentsReport`/`filthReport`/
`insectsReport`, using the same Transaction shape.

- **Audience:** SRO/hotel resident, shelter resident, tenant representative,
  property owner/operator of a residential hotel or shelter (mirrors
  `findHotelRecords`'s audience list).
- **Section shape:** a short "What this covers" explainer (this dataset vs.
  the general one, matching `findHotelRecords`'s existing framing), then a
  report-submission section modeled on `rodentsReport`/`filthReport`/
  `insectsReport`'s existing shape (not read in this pass, but the shape
  is uniform across the three since they were all part of the same 40→19
  consolidation — verify against `insectsReport.js` while drafting), plus a
  Related-pages section.
- **editorStatus:** `placeholder`. No policy doc confirms whether SRO/hotel
  reports genuinely route through a separate intake, or whether that's only
  true for the *records lookup* side; this needs the same SME confirmation
  `findHotelRecords` itself is still waiting on (`editorStatus: 'placeholder'`
  there already, with an explicit "confirm the final xnet lookup entry point"
  note).

### 2. `inspectionPrepInitial` — "Get ready for a housing inspection after you report"

`afterReport` narrates *what happens* after a report ("An inspector may
contact you" / "An inspection may happen") but gives the reviewer nothing
actionable to prepare with. This page is the checklist `afterReport`
gestures at but doesn't contain.

- **Audience:** reuse `afterReport`'s audience list — same reader, one step
  later in the same flow.
- **Section shape:** a "Before the inspector arrives" steps section (clear
  access to the affected area, be present or arrange access, gather anything
  relevant like photos or receipts — matching the kind of evidence
  `noticeOfViolation`'s "Prepare for follow-up inspection" step already
  asks for), a "What to expect during the visit" section, Related pages.
- **editorStatus:** `placeholder` — no source doc lists what an HHVC
  inspector specifically checks for or requires on-site; every specific claim
  needs an `unverified: true` pill until sourced, same treatment
  `afterReport`'s own enforcement-timeline bullets already carry.

### 3. `inspectionPrepFollowup` — "Get ready for a follow-up inspection"

`noticeOfViolation`'s "Prepare for follow-up inspection" step is currently
two sentences ("Keep records... Be ready for HHVC to check..."). This page
expands that into the full checklist the existing step only gestures at,
without bloating the Transaction page's step list.

- **Audience:** reuse `noticeOfViolation`'s audience list.
- **Section shape:** a steps section on documenting completed work
  (photos/receipts/pest-treatment reports — already named in
  `noticeOfViolation`), what happens if the reinspection still finds the
  condition (link forward, don't restate `afterReport`'s enforcement-chain
  content), Related pages.
- **editorStatus:** `placeholder`, same reasoning as #2.

### 4. `tenantNoticeSteps` — "What tenants need to do after a Notice of Violation"

`noticeOfViolation`'s "Make a plan to correct the conditions" step already
bullets tenant duties alongside owner duties in one shared list. That's
sufficient for the shared Transaction page's scope, but it's a bare bullet
list with no depth on tenant-specific mechanics: what unit-prep for
treatment actually involves, what access rights/notice requirements apply,
what retaliation protections exist (`afterReport` mentions retaliation in
one paragraph and links to `tenantRights`, but neither page connects that
protection back to the NOV process specifically), and what a tenant does if
the responsible party doesn't act by the deadline.

- **Audience:** the tenant-specific subset of `noticeOfViolation`'s audience
  list ("A tenant with corrective actions listed on a Notice of Violation",
  "A tenant representative helping someone understand their next steps").
- **Section shape:** steps on unit preparation for treatment/repair access,
  a section on tenant rights during the process (linking `tenantRights`
  rather than restating it), a section on what to do if nothing happens by
  the deadline, Related pages back to `noticeOfViolation` and `tenantRights`.
- **editorStatus:** `placeholder` — tenant-specific procedural claims (notice
  periods for access, what "reasonable" unit prep means) have no current
  source doc and need the same unverified-pill treatment.

### 5. `inspectorLookup` — "Find your Healthy Housing inspector by neighborhood"

This existed before the 40→19 consolidation as `findInspector`, retired with
an alias pointing at `scopeInfo`. Reading `scopeInfo.js` in full during this
design pass confirmed it holds no inspector-lookup content at all — the
alias exists only so an old shared link resolves to *something* rather than
a dead page, not because the content was folded in. This is a genuine gap,
not a duplicate.

- **Note on the key:** cannot reuse the literal string `findInspector` —
  `js/page-registry-data.js` explicitly checks new-page uniqueness against
  `HHVC_DELETED_PAGE_ALIASES` as well as live keys (see CLAUDE.md's page-registry
  section), so reusing a retired key would silently hijack old shared links
  that currently correctly redirect to `scopeInfo`. Using `inspectorLookup`
  avoids that collision entirely.
- **Audience:** reuse `findRecords`/`findViolations`' audience shape (this is
  a sibling lookup tool in the same `recordsHub` cluster).
- **Section shape:** matches `findHotelRecords`'s shape (explainer + external
  or internal lookup button + Related pages), since both are "route to an
  external/xnet tool by criteria" transactions.
- **editorStatus:** `placeholder` — the actual lookup entry point (URL or
  internal tool) is unconfirmed, same caveat `findHotelRecords` already
  carries for its own lookup button.

## Order placement

Inserted into `js/page-data.js`'s `order` array (22 → 27 pages):

```
pestsTopic → rodentsReport → filthReport → insectsReport → sroHotelReport(NEW)
→ recordsHub → findRecords → findViolations → findHotelRecords → inspectorLookup(NEW)
→ publicRecords → ownerHub → noticeOfViolation → tenantNoticeSteps(NEW) → inspectionPrepFollowup(NEW)
→ payFee → scopeInfo → article11Compliance → article11Guide → ownerGuidance → verminResources
→ afterReport → inspectionPrepInitial(NEW) → tenantRights → mosquitoControl → mosquitoWorkshop → ipmEducation
```

Each new page sits immediately after the existing page it most extends, so
the reading order stays a coherent walk through the site rather than
grouping all five new pages at the end.

## Cross-links into existing pages

No copy on existing pages changes except to add these links/cards. Each is a
small, additive edit to a `sections[]` entry already present on that page:

| Existing page | Section | Change |
|---|---|---|
| `pestsTopic` | its report-cards section | add a `sroHotelReport` card |
| `scopeInfo` | "How to choose the right page" | add an SRO/hotel bullet line pointing at `sroHotelReport` |
| `findHotelRecords` | "Related pages" | add `sroHotelReport` card |
| `recordsHub` | its resource-cards section | add `inspectorLookup` card |
| `afterReport` | "How a report moves through the City" step "An inspection may happen" | add `[Get ready for the inspection](inspectionPrepInitial)` link |
| `noticeOfViolation` | step "Prepare for follow-up inspection" | add `[Get ready for your follow-up inspection](inspectionPrepFollowup)` link |
| `noticeOfViolation` | step "Make a plan to correct the conditions", tenant bullet | add `[What tenants need to do](tenantNoticeSteps)` link |

## Content sourcing caveat

None of the five new pages have a backing policy doc in
`docs/source/hhvc-policy/` the way `afterReport`'s fee figures are checked
against the FY26-27 EHB fee schedule. All five ship `editorStatus:
'placeholder'`, and any specific procedural claim (what an inspector
requires on-site, tenant access-notice periods, the SRO/hotel intake path)
carries `unverified: true` with an `unverifiedReason` citing the absence of a
tier-1 source — the same discipline `findHotelRecords` and `afterReport`
already apply to their own unconfirmed claims. Generic, uncontroversial
content (e.g. "keep photos and receipts") does not need the pill; anything
that asserts a specific process, timeline, or right does.

## Out of scope

- The other 4 candidate gaps surfaced during analysis (reinspection-fees
  info, consequences-if-not-fixed info, Director's-Hearing prep, dead-bird
  WNV report) — not selected by the user.
- The ~50 inventory items that already exist under consolidated pages —
  re-adding them would reverse the prior 40→19 consolidation, which was out
  of scope per the user's "selective additions" answer.
- Any change to `pages/*.js` content on existing pages beyond the additive
  cross-links listed above.
- `bun run validate`/`bun run test` runs and actual page-object authoring —
  this document is the design; implementation (writing the 6 changed/new
  `pages/*.js` files, the `js/page-data.js` import + order edits, and running
  validate/test) is the next step, via the writing-plans skill.

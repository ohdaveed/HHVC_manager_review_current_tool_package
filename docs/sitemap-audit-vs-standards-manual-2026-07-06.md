# Site map audit vs. `notebooklm/hhvc-standards-manual.md` (2026-07-06)

Source of truth for this audit: `notebooklm/hhvc-standards-manual.md`
("HHVC Web Governance and Content Standards Manual," Version 2.1, dated
2026-07-06 — the most recently updated manual, consolidating the individual
`hhvc_chapter_drafts/*.md` chapters). Audited against the live mockup's
`js/page-data.js` order array (39 pages) and `pages/*.js` types/links.

Scope: Chapter 1.5/1.6 (jurisdictional boundaries), Chapter 3 (sitemap
inventory + cross-linking), Chapter 4 (content-type taxonomy). Not audited
in this pass: Chapter 2's plain-language/reading-level rules, Chapters
5–8's per-page-template field requirements.

## Findings

### 1. Fixed — Chapter 4.2's content-type list omitted `Information`

Chapter 4.2 declared "exactly 14" approved Karl content types and listed
them by name (Topic, Transaction, Step-by-step, Location / Campaign, News,
Event / Agency, About, Data story, Meeting, Profile, Report, Resource
Collection). **`Information` was not among the 14**, despite:

- Chapter 4.3's own Selection Matrix using "Information" as a type in
  multiple rows in the same document.
- `Information` being the single most-used type in the mockup (19 of 39
  pages).
- `docs/wagtail-content-mapping.md` already live-admin-confirming
  `Information` (and `Step by step`, `Form`, `Document Collection Search`)
  as real, selectable page types in Karl's own "Create a page" chooser
  (2026-07-05 verification) — 17 platform-wide types total, not 14.

This was a genuine internal contradiction in the manual (not a mockup
defect — the mockup's use of `Information` is correct and live-verified).
**Fixed**: `notebooklm/hhvc-standards-manual.md` §4.2 now lists 15 HHVC
content types (the 17 platform-wide types minus `Form` and `Document
Collection Search`, which have no HHVC application), with `Information`
added to Category A as type #5 and all subsequent entries renumbered.

### 2. Downgraded to non-issues — illustrative examples, not prescriptions

Three items from the initial pass looked like contradictions but don't
hold up once the matrix's own framing is taken into account: Chapter
4.3's table is explicitly headed **"HHVC Program Example"** (illustrative,
not a page requirement), and Chapter 3.2 explicitly says **"33 priority
pages"** (a named subset, not an exhaustive inventory). Re-reading the
original findings against that framing:

- **Scale ("39 pages built vs. 33 prescribed")**: not a defect — "priority
  pages" reads as a curated subset by design. The mockup's larger scope is
  expected, not a violation. (Real page count remains 39; see
  `js/page-data.js` if anyone wants the full inventory documented
  elsewhere later, but no manual or mockup change is warranted here.)
- **"What happens after you report" named as the Step-by-step example**:
  a name collision between an illustrative example row and an
  independently-typed real page, not a contradiction. The mockup's
  `Information` typing for `pages/what-happens-after-report.js` stands;
  no retype needed (retyping would also require reworking
  `js/page-render.js`'s type-specific rendering, which has no
  `Step-by-step` branch today — out of scope for a documentation fix).
- **"Get ready for an SRO inspection" doesn't exist**: an example name in
  the matrix, not a required page. No page needs to be built to satisfy
  it.

No manual or mockup edits were made for these three — they were withdrawn
as findings, not fixed.

### Checked and found compliant

- **Wildlife routing (Chapter 1.5)**: `pages/raccoon-information.js`
  correctly states HHVC does not trap or remove wildlife and routes
  injured/trapped animals to Animal Care & Control, staying in HHVC's
  sanitation-only lane.
- **Bidirectional Report↔Prevention cross-linking (Chapter 3.1.1)**: all
  6 pest pairs link both directions. `garbageInfo`, `vegetationInfo`,
  `reduceMoisture`, and `bedBugsInfo` link back via a Related-panel card
  (`target:`); `ratsPrevent`, `cockroachesPrevent`, and `mosquitoesPrevent`
  link back via a body-section CTA button (`buttonTarget:`) instead. Both
  mechanisms satisfy the rule — this is a link-_implementation_
  inconsistency (card vs. button), not a missing-link violation. Not
  urgent, but worth normalizing to one pattern if these pages get
  revisited for other reasons.

## Resolution summary

- **Manual fixed**: `notebooklm/hhvc-standards-manual.md` §4.2's content-type
  list (14 → 15 types, `Information` added, all citations/URLs preserved).
- **No mockup changes**: every mockup page's `type`, slug, and content
  stands as correct; nothing in `pages/*.js` or `js/page-data.js` needed
  changing.
- **Three findings withdrawn**: the 39-vs-33 scale note, the
  Step-by-step-example naming collision, and the nonexistent
  "Get ready for an SRO inspection" example were all illustrative-example
  artifacts, not real contradictions — see Finding 2 above.
- **Cross-linking check (3.1.1) had no real violations**: the original
  audit's finding here was itself a false positive (a grep that missed
  `buttonTarget`-based links) and was corrected in the same session before
  anything was changed.

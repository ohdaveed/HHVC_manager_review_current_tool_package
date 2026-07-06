# Karl Editor Help Center research — 2026-07-06

Raw findings from a Karl MCP research pass (`searchDocumentation` /
`getPage` against `sfdigitalservices.gitbook.io/karl-sf.gov-editor-help-center`)
run against the 11 open items in `docs/wagtail-content-mapping.md`'s "Open
items for the next Karl verification session" checklist.

**Source tier:** public Help Center documentation only — UI labels and
editor-facing behavior, not the live logged-in admin form and not raw
Wagtail field names. Same tier as the existing "2026-07-06 pass" already
noted in that doc. Treat anything below as doc-confirmed at best, not a
substitute for a live admin session.

This file is the full research log; `wagtail-content-mapping.md`'s
checklist carries the condensed, action-relevant version of each finding
(with checkboxes flipped where a finding was strong enough to resolve an
item). Come here for the original quotes/sources; go there for current
status.

---

**1. Related field's 4 content-type restriction (no Resource Collection)**
Found and directly confirmed. The **Related** component page
(`.../using-karl-the-cms/components/related`) states verbatim: *"Only a
few content types can be tagged as Related pages: Transaction,
Information, Campaign, Topic."* The Transaction content-type page repeats
the identical list. Resource Collection is never listed. **Doc-confirmed**
— resolvable. Note: a 2022 release note ("Campaigns, data stories,
resource collections can now be added in the related resource section...")
contradicts this and is superseded/stale — flag as historical, not
current behavior.

**2. Table block on Information pages**
No table block anywhere in the 3-block "Information section" chooser
(`Title and text`/`Image`/`Callout`), and no rich-text-editor table
mention generally. Direct corroboration found: **How a Report page
works** states *"You can add a table to Reports. It is the only content
type that supports tables."* This is stronger than the doc's earlier
"corroborates but never mentions tables" framing — it's an affirmative
exclusivity claim. **Doc-confirmed**: Information (and every other type)
has no table block.

**3. Topic's Services/Resources intro-paragraph field**
The Topic content-type page says only: *"You can organize things in the
services and resources sections by subheading, as in Agency pages. You
can also move services and resources within subsections by dragging into
the order you want."* No intro-text field is mentioned for these blocks,
but the page is prose, not a field-by-field list (unlike the
Information/Transaction/Campaign "How a ___ page works" pages).
**Partially addressed, still needs live admin** — consistent with the
doc's existing framing; no new resolution.

**4. Campaign's Related field: single-item and content-type restrictions**
No dedicated "Related on a Campaign page" subpage exists. "How a Campaign
page works" lists "Related" as one section name only, with no elaboration
on repeatability or its own restriction list. The Campaign overview page
only describes Campaign as a *target* of Related (from Info/Transaction
pages), not its own outbound field's mechanics. Found no doc evidence for
the "distinct Page block with its own Link text" claim already in the
file (likely from the 2026-07-05 live-admin session, not docs). **Not
resolvable from docs — still needs live admin.**

**5. Transaction's "Redirect this page to" raw field name**
Found a dedicated **Redirect this page to** component page, but it
states: *"This component has been disabled in the CMS. Contact Digital
Services for help redirecting pages."* This is new information (the
component may be currently disabled) but gives no raw Wagtail field
name — only the UI label, and 2023 release notes reference the same UI
label "Redirect this page to:" as a rename of a "redirecting department
pages field." **No raw field name found — still needs live admin/API**,
though worth noting to reviewers that the component may be disabled
entirely now.

**6. Information page raw field names**
"How an Information page works" gives only UI labels: *Title,
Description, Primary Agency, Part of, Information section, Partner
agencies, Topics, Related.* No snake_case/Wagtail internal names appear
anywhere (no code samples, no CSV/API docs). CSV export docs (2022
release notes) only list exported column labels (title, content type,
department, author, status, modification state, updated), not field
internals. **Not resolvable from docs — still needs live admin form.**

**7. Resource Collection / Campaign / Topic raw field names**
Same result as #6: "How a Resource Collection page works," "How a
Campaign page works," and the Topic page all give UI labels only (e.g.,
Resource Collection: Title, Description, Primary Agency, Data dashboard,
Introductory text, Body, Documents, Resources, Data stories, Custom
section, Topics, Partner agencies). No raw field names anywhere. **Not
resolvable from docs — still needs live admin.**

**8. Address snippet's repeatable "Hours and days open"**
The **Address** component page lists it as one line item in the field
list (*"Hours and days open"*), same as all the other single fields
(Line 1, City, State, Zip, etc.) — no language distinguishing it as
repeatable/multi-entry, no separate sub-fields per day shown. One "known
issue" 2025 release note is suggestive but unrelated to schema: *"Agency
pages are showing 7 days a week of open hours, regardless of how many
days the department is open."* That implies the front end does render
day-by-day hours, but doesn't confirm the back-end field's repeatability.
**Not resolvable from docs — still needs live admin** (the doc's original
framing stands).

**9. Transaction rich text "/" slash-menu nested Blocks/Actions groups**
Searched extensively (rich text editor, Draftail, split block, formatting
bar) — the only generic rich-text doc page (**Body, Main body, Text and
title**) describes the toolbar (bold, lists, blockquote, link/unlink) but
never mentions a "/" slash-command menu or nested "Blocks"/"Actions"
groups at all, for any content type. This detail (confirmed for
Information) appears to be a live-admin-only UI observation not
documented publicly anywhere. **Not resolvable from docs — still needs
live admin**, and note that the underlying "Information" confirmation
itself came from the 2026-07-05 live session, not from these public docs.

**10. Transaction rich text Link tool's 4 types (Internal/External/Email/Phone)**
Same search area as #9. The public generic Link docs (**Body, Main body,
Text and title**; **Edit a component**) only describe **2** link types in
the rich text Link tool — *"Choose Internal link if the page you are
linking to is on SF.gov / Choose External link if you're linking to a
page on another website"* — no mention of Email or Phone links inside the
rich-text Link tool anywhere (Email/Phone appear only as separate
standalone components, e.g. in Transaction's "What to do"
section-specifics menu: *Address, Callout, Document, Email, Button link,
Phone number, Text*). This is actually a mild **contradiction risk**: the
public docs describe only 2 rich-text link types generically, not the
4-type version noted from the live Information session. **Not resolvable
from docs — still needs live admin**, and flag the 2-vs-4 discrepancy for
the next live pass.

**11. Data story and Event page types**
Both are now documented from scratch:

- **Data story**: goals/audience/URL/access-permission table; content is
  built from **Data story content sections**, each with an optional
  Section title plus Text, Callout, Images, and PowerBI embed (per
  `.../data-story/data-story-content-section`). The **Callout** component
  page confirms Data story is 1 of only 3 content types supporting
  callouts (Transaction, Information, Data story).
- **Event**: "How an Event page works" gives the full field list: *Title,
  Description, Primary Agency, Call to action, Date time, Cost, Location,
  Image, Main body text, Partner agencies, Contact us, Topics.* Supporting
  subpages found: **Call to action on Event** (title/description/SF.gov-
  or-external link/link text/screenreader label) and **Location on Event
  page** (online checkbox + call-to-action signup link, in-person/
  virtual/hybrid support).

**Doc-confirmed**: both page types now have a real field/block inventory
that can replace the "entirely unverified" placeholder in
`wagtail-content-mapping.md`.

---

### Summary

- Moved to `[x] doc-confirmed` in `wagtail-content-mapping.md`: **items 1,
  2, 11** (Data story, Event).
- Left `[ ]`, needs live admin, but with new detail recorded there: **item
  5** (component may be disabled in CMS entirely), **item 10** (public
  docs show only 2 link types generically, contradicting the 4-type live
  observation — flagged for re-check).
- Left `[ ]`, no new doc coverage found: **items 3, 4, 6, 7, 8, 9**.

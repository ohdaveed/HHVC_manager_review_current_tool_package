# Karl live-admin verification — 2026-07-06

Raw findings from a live, logged-in Karl CMS session (api.sf.gov),
read-only — nothing was saved or published; any inserted test blocks were
left un-submitted/discarded by navigating away. This closes out follow-up
tasks #1–#2 and #4–#8 from `docs/wagtail-content-mapping.md`'s checklist
(task #3 is only partially resolved — see item 3 below).

This file is the full research log; `wagtail-content-mapping.md` carries
the condensed, action-relevant version of each finding.

---

**1. TOPIC — Services/Resources intro text**
Both blocks have identical structure: Title (single-line text) → Links
(repeatable list; each link is either "SF.gov page" or "External link"
type). Neither block offers a free-text/description/intro field beyond
Title + Links — there is no paragraph field above the link list.

**2. CAMPAIGN — Related field**
(a) Repeatable — confirmed by adding two separate "Page" entries via the
"+" control (raw name `related_links`, a StreamField). (b) The page
chooser is **not** restricted to Transaction/Information/Campaign/Topic.
Searching "resource" in the chooser returned Resource Collection pages
alongside Event, Campaign, and Report pages, and a live Resource
Collection page ("City Resources for interacting with persons who are
deaf...") was successfully selected as the Related target. This
contradicts the Help Center's documented 4-content-type restriction —
flagged in the main doc for re-check on other page types' Related
pickers.

**3. TRANSACTION — "Redirect this page to"**
Present as a label with an empty, visually greyed-out placeholder box at
the bottom of the form, but on a new/unsaved Transaction it is fully
disabled — DOM inspection found zero `<input>`/`<select>` elements with
"redirect" in their name or id anywhere on the page. It's inert until
(presumably) the page has been saved once. **Not fully resolved** — raw
field name still needs checking on an already-saved Transaction page.

**4. INFORMATION — raw field names**
Primary Agency → `primary_agency`; "Part of" → `part_of`; Information
section → `information_section`; Partner agencies → `partner_agencies`;
Topics → `topics`; Related → `related`.

**5. Raw field names — Resource Collection / Campaign / Topic**

- **Resource Collection**: Title `title`, Description `description`,
  Primary agency `primary_agency`, Data dashboard `data_dashboard`,
  Introductory text `introductory_text`, Body `body` (StreamField whose
  block-type choices are exactly Documents / Resources / Data stories —
  these aren't separate top-level fields, they're block options inside
  Body), Custom section `custom_section`, Topics `topics`, Partner
  agencies `partner_agencies`.
- **Campaign**: Title `title`, Primary agency `primary_agency`, Logo
  `logo`, Background header image `background_header_image`, Color theme
  `theme`, Spotlight 1 `spotlight_1` (containing Top facts
  `fact_items`/`facts_title` and Additional content), Spotlight 2
  `spotlight_2`, About `about_campaign`, Partner agencies
  `partner_agencies`, Related `related_links`, Contact us `contact`
  (sub-blocks: `address`/`phone`/`email`/`social_media_other`).
- **Topic**: Title `title`, Primary agency `primary_agency`, Description
  `description`, Set top-level? `top_level_topic`, Page content
  `content_fields` (StreamField; block types map to `page_content`
  (Content top), `content`, `services`, `spotlight`, `resources`), Partner
  agencies `partner_agencies`.

**6. ADDRESS SNIPPET — "Hours and days open"**
A repeatable StreamField of "Office hours" entries (add multiple via
"+"). Each entry has a Days radio choice: "Monday to Friday" (single
"All" row with Open-from/to time pickers + "Add break") or "Custom",
which expands into one row per day of the week (Monday–Sunday), each with
its own independent Open-from/to time pickers and its own "Add break"
control. Note: this field only rendered/functioned correctly on the
full-page snippet form (`/admin/snippets/cms/address/add/`) — inside the
page-chooser's inline "Create" tab, the same field's JS widget failed to
initialize (empty, non-interactive).

**7. TRANSACTION — rich text Link tool types**
4 options: Internal link, External link, Email link, Phone link. Resolves
the discrepancy from the 2026-07-06 Help Center doc pass (which found
only 2 types documented publicly) in favor of the 4-type claim.

**8. Other page types — top-level fields**

- **Agency**: Title, Description, Logo, Main image, Alert, Quick links,
  Meeting information, Section title 1 + Subsection, Spotlight 1/2 +
  Highlights, Section title 2 + Subsection, About, Call to action,
  Divisions or subcommittees, Partner agencies, People, Public records,
  Archive information, Meeting archive information, Contact us, Redirect
  this page to, Topics.
- **About us**: Title, Primary agency, Information, Resources.
- **Location**: Title, Primary agency, Description, Alert, Essential
  information, Image, Body (Getting here/Parking/Accessibility/Public
  transportation/Accordions/Services), About, Partner agencies, At this
  location, People, Related locations, Contact us.
- **Meeting**: Title, Primary agency, agency-listing selector, Meeting
  information (cancelled flag, Date/time, Location, Overview, Agenda,
  Meeting resources, Videos, Related documents), Regulations and notices,
  Notices, Partner agencies.
- **News**: Headline, Primary agency, Date, Image, Redirect this page to
  (present here too, positioned mid-form rather than at the bottom),
  Abstract, Body, Type (News/Press Release dropdown), Topics, Partner
  agencies.
- **Profile**: Name, Pronouns, Profile photo, Primary job title (+ line
  2), Primary agency, Additional roles, Biography, Direct contact (phone/
  email/social), Optional content, Spotlight, Quick links, Contact us,
  Redirect this page to.
- **Report**: Title, Date, Primary agency, Spotlight, Content, Print
  version (document chooser), Partner agencies.
- **Step by step**: Title, Primary agency, Description, Intro, Steps,
  Topics, Partner agencies.

---

### Summary

- Fully resolved: items 1, 4, 5, 6, 7, 8.
- Corrects a prior wrong assumption (not just fills a gap): item 2 —
  Campaign's Related is repeatable and its picker isn't restricted the
  way the Help Center docs claim. This required correcting both
  `docs/wagtail-content-mapping.md`'s Campaign table and
  `pages/mosquito-education-workshop.js`'s `karl` notes, which had
  inherited the wrong "single-item" assumption.
- Partially resolved: item 3 — Transaction's redirect field exists and is
  present on several other page types too (Agency, News, Profile), but
  its raw field name still needs an already-saved page to inspect.

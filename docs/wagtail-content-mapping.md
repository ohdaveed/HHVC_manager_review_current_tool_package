# Mockup → Karl (Wagtail) content mapping

Karl, SF.gov's CMS, is a custom product built on Wagtail by Digital Services
engineers. This tool has no Wagtail integration and never will (see
`CLAUDE.md`: static mockup, no backend) — this doc exists only so the `karl`
strings already present on every card/step/section/callout in `pages/*.js`
translate into concrete Wagtail terms when Digital Services builds the real
pages. It's a naming bridge for that handoff conversation, not a schema spec.

## Verified against the real Karl "Transaction" add-page form (2026-07-05)

Unlike the rest of this doc (which is speculative — see "Other page types"
below), everything in this section was confirmed directly in Karl's live
"New: Transaction" form, via a real logged-in session. Treat it as
authoritative for the `Transaction` page type specifically.

**Real Karl page types** (from the "Create a page" chooser): `About us`,
`Agency`, `Campaign`, `Data story`, `Document Collection Search`, `Event`,
`Form`, `Information`, `Location`, `Meeting`, `News`, `Profile`, `Report`,
`Resource Collection`, `Step by step`, `Topic`, `Transaction`. The mockup's
`type` values (`Transaction`, `Topic`, `Information`, `Resource Collection`)
match these exactly.

**A Transaction page has named, purpose-specific panels — not a generic
list of sections.** This is the single biggest correction to the earlier
guesswork in this doc: there is no arbitrary `sections[]`-style StreamField
at the top level. Each panel below is its own named field with its own block
rules:

| Karl panel (field name)                                           | UI label                                                                                                    | Block type(s) available                                                                                                                        | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `title`, `description`                                            | Page title / Description                                                                                    | plain text / textarea                                                                                                                          | —                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `primary_agency`                                                  | Primary agency                                                                                              | page chooser, restricted to `Agency` pages                                                                                                     | Required                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `cost`                                                            | Cost                                                                                                        | single struct, **max 1 item**, no chooser (auto-inserted)                                                                                      | Required radio group `cost` (`Free`, `Flat fee`, `Range`, `Minimum and up`, `None`) reveals different nested fields per option: `Flat fee` → numeric "Flat fee" field; `Range` → numeric "Minimum cost" + "Maximum cost"; `Minimum and up` → numeric "Minimum cost" only; `Free` and `None` reveal no extra fields. All five variants end with the same "Cost description" field — Draftail rich text, **capped at 120 characters**, same "/" slash-command block insertion as other rich text fields in this form. Both `cost` and `things_to_know` live together under the parent grouping "What to Know Before You Start". |
| `things_to_know`                                                  | Things to Know                                                                                              | single block type `title_and_text`, **repeatable** (no max seen — 3 instances observed in one live draft), no chooser                          | Fields: "Title" (plain text) + "Text" — Draftail rich text (see standard toolbar note below the table). Ships **pre-seeded with 1 example** ("Who this page is for.") on a brand-new page, but editors can add more freely.                                                                                                                                                                                                                                                                                                                                                                                                   |
| `what_to_do`                                                      | What to Do                                                                                                  | chooser: **`Callout`** or **`Section`**                                                                                                        | `Callout` here is a **single Draftail rich text field only — no separate title/heading field**, unlike `things_to_know`/`custom_section`/`supporting_information`/`good_for_community` which all pair a plain-text title with their rich text. Standard toolbar (see below the table), placeholder "Write something or type '/' to insert a block". A mockup `steps[]` entry = one `Section` block (see below)                                                                                                                                                                                                                |
| _(within a `Section` block)_ `section_title`, `section_specifics` | Section title / Section specifics                                                                           | `section_specifics` chooser: `Address`, `Callout`, `Document`, `Email`, `Button link`, `Phone number`, `Text`                                  | `Text` and `Callout` here are both Draftail rich text, same standard toolbar + "/" placeholder as `what_to_do`'s top-level `Callout`. **`Callout` has no title field here either** — same gap as above. A step's `text`/`bullets` → `Text`; `button`/`buttonUrl`/`buttonTarget` → `Button link`; `callout` → `Callout`. All as siblings inside one `Section`, not fields on the step itself. If a mockup `callout.title` needs to survive the move to Karl, it has no dedicated field — fold it into the Callout's rich text (e.g. as a bolded lead-in) or flag the gap for Digital Services.                                 |
| `special_cases`                                                   | Label: "Special cases"; helptext: 'If this field is blank, the heading "Special cases" will show on SF.gov' | plain text (blank = default heading shown)                                                                                                     | Not a StreamField itself — a text override for the heading of the two panels below it (`custom_section`, `supporting_information`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `custom_section`                                                  | Custom Section                                                                                              | single block type `title_and_text`, no chooser                                                                                                 | Fields: "Custom section heading" (plain text) + "Custom section text" — Draftail rich text (see standard toolbar note below the table).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `supporting_information`                                          | Accordion title and text                                                                                    | single block type `title_and_text` (block instance labeled "Accordion item"), no chooser                                                       | Fields: "Accordion title" (plain text) + "Accordion text" — Draftail rich text, placeholder "Write something or type '/' to insert a block". Ships **pre-seeded with 5 example items** on a new page.                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `related`                                                         | Related                                                                                                     | page chooser (any page type), repeatable, no chooser popup (single "kind")                                                                     | Field label: "Page \*" (required) with a "Choose a page" button — no type restriction shown. **No custom title/text per item** — just a page reference. Display text is presumably pulled from the target page itself, unlike the mockup's `cards[]` (`title`, `text`, `target`)                                                                                                                                                                                                                                                                                                                                              |
| `good_for_community`                                              | "Why is this Transaction Good for the Community?"                                                           | single block type, **repeatable** (2 instances observed), labeled **"Additional info"** — same struct as `get_help`'s "Additional info" option | Fields: "Title" (plain text) + "Text" (Draftail rich text, standard toolbar)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `get_help`                                                        | Contact us                                                                                                  | chooser: `Address`, `Email`, `Phone number`, `Additional info`                                                                                 | `Address` is a **chooser** ("Choose an address" button — references a stored Address record, not inline fields). `Additional info` = Title + Text, same struct as `good_for_community`. `Phone number` fields: "Owner" (optional; helptext: "Use if you need to name the person or group that owns this phone number. Otherwise it can be left blank."), "Phone number", "Extension", "Phone number details" (helptext: e.g. "You must answer automated questions before you talk to a human," can be left blank). `Email` fields: "Title" + "Email".                                                                         |
| `partner_agencies`                                                | Partner agencies                                                                                            | page chooser restricted to `Agency` pages, repeatable                                                                                          | Helptext confirmed: "Add other close partner agencies, divisions or subcommittees."                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `topics`                                                          | Topics                                                                                                      | page chooser restricted to `Topic` pages, repeatable                                                                                           | Also has a **"Hide on Topic Pages"** checkbox (seen earlier as `hide_on_topic_pages` in the raw form fields). Helptext explains the transaction won't auto-list under "More services" on Topic pages. (The earlier "use for parts of a step-by-step" phrasing was an unconfirmed screenshot approximation — superseded by this simpler description, not independently re-verified word-for-word.)                                                                                                                                                                                                                             |
| _(unnamed field name — not yet inspected)_                        | "Redirect this page to"                                                                                     | plain text field                                                                                                                               | Sits at the very bottom of the form, after `topics`. Not in the mockup schema at all. Confirmed as a **disabled/greyed-out plain text field on a new, unsaved page** — likely only becomes active once the page exists, consistent with a typical Wagtail redirect-target field. Field name still not inspected.                                                                                                                                                                                                                                                                                                              |

Practical implications for `pages/*.js` → Transaction pages:

- A step with a button and callout (e.g. `report-rats-or-mice.js` step 1,
  "Start your report") becomes one `what_to_do` → `Section` block whose
  `section_specifics` holds a `Text` block, a `Button link` block, and a
  `Callout` block, in that order.
- A step that's just bullets (step 2, "Notify your landlord before
  reporting") becomes a `Section` with a single `Text` block in
  `section_specifics` (bullets render as a bulleted list inside the Draftail
  `Text` block, same as any other rich text).
- The mockup's `cards[]` "Related pages" section maps to `related`, but each
  card's custom `text` description has **no home** in the real schema —
  `related` is just a page reference list. `karl` notes on cards that assume
  a custom description per related item should flag this gap for Digital
  Services rather than assume it's supported.
- **Every Draftail rich text field in this form shares the same toolbar:**
  Bold, H3, H4, Bulleted list, Numbered list, Blockquote, Line break,
  Document, Link (no H2). Confirmed across `cost` description, `things_to_know`
  text, `what_to_do`'s `Callout` text, `custom_section` text, and
  `supporting_information`'s "Accordion text" — all consistent, so treat this
  as the one standing toolbar spec for any rich text field in a Transaction
  page rather than re-verifying per field.
- **This toolbar applies only to the paired "text" fields, not the paired
  "title" fields.** Every `title`/`heading` counterpart — "Section title"
  (`what_to_do`'s `Section` block), "Accordion title"
  (`supporting_information`), "Custom section heading" (`custom_section`),
  "Title" (`things_to_know`) — is plain text only, no formatting toolbar at
  all. Don't assume a title field accepts rich text just because its sibling
  text field does.
- The mockup has no equivalent of `cost`, `custom_section`,
  `good_for_community`, `get_help`, `partner_agencies`, or `topics` as
  distinct concepts — those are real Karl fields with no corresponding
  mockup field today.

**`Address` and `Button link` block internals (within `section_specifics`),
not previously expanded beyond their names in the table above:**

- `Address` opens a **snippet chooser modal** (Search/Create tabs) rather
  than inline fields — it references a stored Address snippet, not a
  one-off value. The Create form inside that modal has: Agency (dropdown),
  Organization, Addressee, Location name, Line1 (required), Line2, City
  (required), State (required dropdown), Zip (required), a rich-text
  "Location notes" field, and a repeatable "Hours and days open" field —
  though that repeatable's add-control didn't visibly render inside the
  nested modal in this pass, so its concrete UI is still unconfirmed.
- `Button link` is a radio choice of `SF.gov page` / `External URL` / `None`,
  each revealing a page chooser or a URL text field respectively, plus a
  shared "Link text" field and a "Screenreader label" field. This is the
  block a mockup `step.button`/`buttonUrl`/`buttonTarget` maps to.
- **Resolved 2026-07-05:** the `Phone number` block's owner field is
  labeled **"Owner"**, not "Name" — re-verified directly in Karl in both
  `get_help`'s `Phone number` block and `section_specifics`'s `Phone
number` block, with identical label and helptext in both. It's one
  shared block definition, not two divergent ones; the `get_help` row
  above has been corrected to match.

**Editor UI mechanics worth knowing before scripting against this form
again:** simple-type panels (`cost`, `things_to_know`, `custom_section`,
`good_for_community`, `related`, `partner_agencies`, `topics`) auto-insert
their one block type directly on "+" with no chooser popup — a chooser
(`w-combobox` with `[role="option"]` entries) only appears when a panel
genuinely offers more than one block type (`what_to_do`, `section_specifics`,
`get_help`). Programmatic form-filling here is fragile: naive
`element.value = x` + synthetic `dispatchEvent(new Event('input'))` does not
persist (Wagtail's Telepath/Stimulus widgets don't treat it as a real
keystroke), and even genuine `Input.insertText` via the Chrome DevTools
Protocol can silently land in the wrong node (a hidden Django formset
management field like `what_to_do-count`) if the DOM scope used to find the
target input is too broad. Anyone automating this again should scope every
write to the field's exact `name`/`id` (e.g. `what_to_do-0-value-section_title`),
never a "closest wrapper, then first input" search.

## Verified against the real Karl "Information" add-page form (2026-07-05)

Like the Transaction section above, everything here was confirmed directly
in Karl's live "New: Information" form. Treat it as authoritative for the
`Information` page type specifically. Note the form itself is a single
"Content" tab — no separate Promote/Settings tabs were shown.

| Karl field                                          | UI label                                      | Block type(s) available                         | Notes                                                                                                                                                                                                                                                                         |
| --------------------------------------------------- | --------------------------------------------- | ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| _(title)_                                           | Page title \*                                 | plain text                                      | Required                                                                                                                                                                                                                                                                      |
| _(description)_                                     | Description                                   | plain multi-line textarea                       | No rich text toolbar — unlike Transaction's rich text fields, this one is plain text only                                                                                                                                                                                     |
| _(primary agency — field name not yet inspected)_   | Primary agency \*                             | page chooser, restricted to `Agency` pages      | Required                                                                                                                                                                                                                                                                      |
| _(field name not yet inspected)_                    | Part of (repeatable)                          | page chooser, restricted to `Transaction` pages | Each item chooses one Transaction page this Information page supports                                                                                                                                                                                                         |
| _(field name not yet inspected)_                    | Information section (repeatable stream field) | chooser: `Title and text`, `Image`, `Callout`   | `Title and text` = plain "Title" text field + rich text "Text" field. `Image` = a single "Choose an image" chooser (Search/Upload tabs, collection filter, tags). `Callout` = **single rich text field only, no separate title** — same gap as Transaction's `Callout` blocks |
| _(partner agencies — field name not yet inspected)_ | Partner agencies (repeatable)                 | page chooser restricted to `Agency` pages       | Same restriction as Primary agency                                                                                                                                                                                                                                            |
| _(topics — field name not yet inspected)_           | Topics (repeatable)                           | page chooser restricted to `Topic` pages        | —                                                                                                                                                                                                                                                                             |
| _(related — field name not yet inspected)_          | Related (repeatable)                          | generic "Page" field, unrestricted page chooser | Any page type, no warning banner, shows the full page list — same shape as Transaction's `related`: no custom title/text per item, just a page reference                                                                                                                      |

These field-name column entries reuse Transaction's confirmed names
(`primary_agency`, `partner_agencies`, `topics`, `related`) as a plausible
guess since the UI labels and restrictions are identical, but that reuse is
**not independently confirmed** for Information — only the UI labels and
chooser behavior above were directly observed.

Practical implications for `pages/*.js` → Information pages:

- The mockup's `sections[]` (`paragraphs[]`, `bullets[]`, `callout`) maps to
  the "Information section" stream field's `Title and text`/`Callout` blocks,
  not a generic StreamField as previously guessed — confirms the same
  "named panels, not generic sections" pattern seen on Transaction.
- A mockup section with an image would need an `Image` block inserted
  alongside/between `Title and text` blocks; the mockup schema has no
  first-class image field today, so this is a gap to flag for Digital
  Services if any Information page mockup adds one.
- **The rich text toolbar is the same standing spec as Transaction's**: Bold,
  H3, H4, Bulleted list, Numbered list, Blockquote, Line break, Document
  link, Link (no H2) — confirmed again here across the "Information
  section"'s `Text`/`Callout` fields. Treat this toolbar as universal across
  page types rather than re-verifying per type.
- **New detail this session, not previously captured for Transaction:** the
  "/" slash-command menu (not just the toolbar) offers the same formatting
  options plus a nested "Blocks" group (`Title and text`, `Image`, `Callout`
  can all be embedded _inside_ rich text, not just as top-level stream
  items) and an "Actions" section (`Split block`). Worth re-checking whether
  Transaction's rich text fields have this same nested-block/Actions menu —
  it wasn't looked for during that verification pass.
- **New detail this session:** the Link tool (in both toolbar and "/" menu)
  opens a chooser with four link types — Internal link (page tree),
  External link, Email link, Phone link. The Document icon opens a separate
  "Choose a document" modal (Search/Upload tabs, collection filter, document
  library list) distinct from the Link tool's own internal-link picker.
  These are presumably shared editor widgets, so likely apply to
  Transaction's rich text fields too, but that's an inference, not
  something re-confirmed on the Transaction form.
- Page action controls (Save draft / Publish split button, Preview button,
  and an info-icon side panel showing draft/lock state, publish schedule,
  locale, lock status, and usage/reference count) appear to be generic Karl
  editor chrome rather than Information-specific — flagging here since it
  wasn't documented during the Transaction pass, not because it's assumed
  unique to Information.

## Verified against the real Karl "Resource Collection" add-page form (2026-07-05)

Like the Transaction and Information sections above, everything here was
confirmed directly in Karl's live "New: Resource Collection" form (every
"+" menu explored, nothing saved or published). Treat it as authoritative
for the `Resource Collection` page type specifically. Field names below are
UI labels, not raw Wagtail field names — those weren't inspected, following
the same convention as the Information section above.

| Karl field            | UI label                       | Block type(s) available                           | Notes                                                                                                                                                                                                                                                                                                 |
| --------------------- | ------------------------------ | ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| _(title)_             | Page title \*                  | plain text                                        | Required                                                                                                                                                                                                                                                                                              |
| _(description)_       | Description                    | plain text                                        | —                                                                                                                                                                                                                                                                                                     |
| _(primary agency)_    | Primary agency \*              | page chooser, restricted to `Agency` pages        | Required                                                                                                                                                                                                                                                                                              |
| _(data dashboard)_    | Data dashboard (repeatable)    | single block type `Powerbi embed`, no chooser     | Fields: "Desktop embed url" \* (URL), "Mobile embed url" \* (URL), nested "Aspect ratios" struct (Desktop Width\*/Height\*, Mobile Width\*/Height\*, pre-filled 700/700 and 360/900 defaults respectively), "Alt text" \* (screenreader accessibility), "Source data" (URL), "Data notes" (rich text) |
| _(introductory text)_ | Introductory text (repeatable) | single block type `Title and text`, no chooser    | Title (plain text) + Text (rich text) — same struct shape as `custom_section` below and Transaction's `custom_section`/`things_to_know`                                                                                                                                                               |
| _(body)_              | Body (repeatable stream field) | chooser: `Documents`, `Data stories`, `Resources` | See nested breakdown below the table — each of these 3 is itself a repeatable-section-with-nested-stream shape, not a flat block                                                                                                                                                                      |
| _(custom section)_    | Custom section (repeatable)    | single block type `Title and text`, no chooser    | Title (plain text) + Text (rich text) — identical struct to "Introductory text"                                                                                                                                                                                                                       |
| _(topics)_            | Topics (repeatable)            | page chooser restricted to `Topic` pages          | —                                                                                                                                                                                                                                                                                                     |
| _(partner agencies)_  | Partner agencies (repeatable)  | page chooser restricted to `Agency` pages         | Helptext: "Add other close partner agencies, divisions or subcommittees." — identical wording to Transaction's `partner_agencies`, so likely a shared snippet/helptext across page types rather than coincidence                                                                                      |

**`Body`'s three block types, each a nested "section with its own stream"
rather than a flat block:**

- `Documents` → repeatable "Document section" items, each with a Title
  field plus a nested "Content" stream offering two block types:
  `Documents` (a nested repeatable "Document" block, each a "Choose a
  document" chooser) and `Description` (required rich text).
- `Data stories` → repeatable "Data story section" items, each with a
  Title field plus a required "Data stories" stream containing `Page`
  blocks — a page chooser restricted to `Data story` pages.
- `Resources` → repeatable "Resource section" items, each with a Title
  field plus a "Links" stream offering two block types: `SF.gov page`
  (an unrestricted page chooser — any page type) and `External link`
  (Title\*, URL\*, and a "Description" rich-text field with helper text
  encouraging a full sentence including keywords/acronyms for
  accessibility/SEO).

**Confirmed via full-text page extraction that Partner agencies is the
last section on this form** — unlike Transaction/Information, there is
**no `Related`, `Redirect this page to`, or `Contact us`/`get_help`
section** on Resource Collection.

Practical implications for `pages/*.js` → Resource Collection pages:

- A mockup section with only `paragraphs[]` (e.g.
  `report-a-problem.js`'s "About this collection") maps to "Introductory
  text"'s `Title and text` block (heading → Title, paragraphs → Text).
- A mockup section whose `cards[]` are cross-links to other pages by
  `target` (e.g. `report-a-problem.js`'s "Report a housing health problem"
  and "Related pages" sections, which link to Transaction/Information
  pages via `target` keys) most likely maps to `Body` → `Resources` →
  `SF.gov page` link blocks. But as with Transaction's `related` and
  Information's `related`, **`SF.gov page` is just an unrestricted page
  reference — it has no custom title/text field of its own**, so each
  card's custom `text` description again has no home in the real schema.
  This is the same recurring gap as the other two verified page types;
  `karl` notes on `report-a-problem.js`/`prevent-problems.js`/etc. cards
  that assume a custom description per linked item should flag this for
  Digital Services rather than assume it's supported.
- The mockup has no equivalent of `data dashboard` (Powerbi embed),
  `Documents`, `Data stories` (as a distinct concept from a generic card),
  or `partner_agencies`/`topics` — those are real Karl fields/blocks with
  no corresponding mockup field today.

## Verified against the real Karl "Campaign" add-page form (2026-07-05)

Like the sections above, everything here was confirmed directly in Karl's
live "New: Campaign" form (every "+" menu explored, nothing saved or
published). Treat it as authoritative for the `Campaign` page type
specifically. Field names below are UI labels, not raw Wagtail field
names — those weren't inspected. **No mockup page currently declares
`type: 'Campaign'`** (see practical implications below), so there is no
existing `pages/*.js` file to cross-check this against yet.

| Karl field                  | UI label                                    | Block type(s) available                                                        | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| --------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| _(title)_                   | Title \*                                    | plain text                                                                     | Required                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| _(primary agency)_          | Primary agency \*                           | page chooser, restricted to `Agency` pages                                     | Required                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| _(logo)_                    | Logo                                        | image chooser                                                                  | Helper: minimum 100×100px, square preferred                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| _(background header)_       | Background header image                     | image chooser                                                                  | Helper: minimum 400px tall, 16:5 aspect ratio recommended                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| _(color theme)_             | Color theme                                 | dropdown: `Black`, `Blue`, `Green`, `Orange`                                   | —                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| _(spotlight_1/spotlight_2)_ | Spotlight 1 / Spotlight 2 (each repeatable) | single block type `Spotlight`, no chooser                                      | Fields: "Spotlight title", "Spotlight description", "Spotlight image" (chooser, min 1080×350px), "Image alignment" \* radio (`Side by side`/`Full width`), "Image position" \* radio (`Right`/`Left`), a nested "Button link" (same shape as Transaction's: `SF.gov page`/`External URL`/`None` radio, page chooser or URL, "Link text" \*, "Screenreader label"). Two independent top-level fields, not one repeatable field with two slots.                                                                                                          |
| _(top facts)_               | Top facts                                   | "Facts title" (plain text) + repeatable "Fact items"                           | Each Fact item: optional Image chooser, "Fact title", "Fact text" (rich text)                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| _(additional content)_      | Additional content (repeatable stream)      | chooser: `Image with text`, `Video`, `Accordion section`, `Embed`, `Resources` | See nested breakdown below the table — each offers its own sub-fields, several deeply nested                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| _(about)_                   | About                                       | "About campaign" — single rich text field                                      | —                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| _(partner agencies)_        | Partner agencies (repeatable)               | page chooser restricted to `Agency` pages                                      | Same field/restriction as Transaction/Resource Collection's `partner_agencies`                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| _(related)_                 | Related (raw name `related_links`, a repeatable StreamField — **confirmed via live admin, 2026-07-06**) | one block type (`Page block`) per entry, but **repeatable** — the "no chooser" in the original 2026-07-05 note meant no *block-type* picker (every entry is a Page block, there's no alternative block type to choose), **not** that only one entry is allowed. That distinction was missed on first pass and propagated into the checklist and `mosquito-education-workshop.js`'s `karl` notes as "single-item, not repeatable" — corrected below. | Helper: "Link to news on another City website (no external news). Choose a SF.gov page, or enter an external URL." Fields: "Link to" radio (`SF.gov page`/`External URL`/`None`), "Page" \* chooser or URL field depending on the radio, "Link text" \*. **Unlike Transaction/Information/Resource Collection's `related`** (a bare unrestricted page reference with no link-type choice), Campaign's `Related` can point to an external URL and carries its own "Link text" — a materially different shape, not the same field reused. **Content-type restriction contradiction (2026-07-06 live check):** the Help Center's "Related" page states only Transaction/Information/Campaign/Topic can be tagged as Related — but live-testing Campaign's own Related picker, searching "resource" surfaced Resource Collection pages as selectable results, and one was successfully chosen as a target. Either the restriction doesn't apply to Campaign's `related_links` specifically, or the Help Center claim is stale/inaccurate — flag for re-check on Transaction/Information/Topic's Related pickers too, since only Campaign's was live-tested. |
| _(contact us)_              | Contact us (repeatable stream)              | default `Contact` block, 4 nested sub-streams                                  | See nested breakdown below the table                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |

**`Additional content`'s five block types:**

- `Image with text` → Image chooser, Title, "Description" (rich text,
  **capped 120 characters** — same cap pattern as Transaction's Cost
  description).
- `Video` → "Video title", "Describe what this video is about" (rich text,
  capped 120 characters), and a required "Video type" struct (max 1 item)
  choosing between `External link` (URL \*, a link-text description) or
  `Embed` (YouTube URL \*, required "Video transcript" rich text).
- `Accordion section` → Title, "Accordion sidebar" (rich text), and
  repeatable "Accordion item" blocks — each an Accordion item Title + a
  "Body" stream offering `Address` (chooser), `Phone number` (Owner, Phone
  number, Extension, Phone number details — same "Owner" label confirmed
  elsewhere in this doc), and `Text` (rich text).
- `Embed` → "iFrame URL" \*, "Alt text" (screenreader), "Aspect ratio" radio
  (`Default 4:3`, `Landscape 16:9`, `Square 1:1`, `Portrait 9:16`).
- `Resources` → Title, repeatable "Resource sections" (each Title + a
  "Links" stream offering `SF.gov page` [unrestricted chooser] or
  `External link` [Title \*, URL \*] — same two-block shape as Resource
  Collection's `Resources` panel), plus a separately repeatable
  "Downloadable resources" list of Document choosers.

**`Contact us`'s default `Contact` block, 4 nested sub-streams:**

- `Address` → a chooser referencing a stored Address snippet (same pattern
  as Transaction's `get_help`/`section_specifics` Address blocks).
- `Phone` → Owner, Phone number, Extension, Phone number details — the
  same confirmed "Owner" label, not "Name" (see the Transaction section's
  resolved discrepancy above).
- `Email` → Title, Email \*.
- `Social media / other` → a chooser between `Social media` (Facebook, X,
  Instagram URL fields) and `Other (custom)` (Title + Text rich text) —
  the only block in this doc so far offering a dedicated social-links
  struct.

**Confirmed via scrolling that `Contact us` is the final section on the
page** — nothing follows it, matching the same "confirm via full-page
scroll/extraction" verification method used for Resource Collection's
`Partner agencies`.

Practical implications for `pages/*.js` → Campaign pages:

- No page in `pages/*.js` currently has `type: 'Campaign'`.
  `mosquito-education-workshop.js`'s `editorNote` already flags Campaign
  as a candidate content type ("use Campaign if HHVC treats it as an
  ongoing program with spotlight/top facts") — if that page is ever
  switched from `Information` to `Campaign`, its hero/intro content would
  likely need reshaping into `Spotlight 1`/`Top facts` rather than the
  mockup's current `sections[]`/`cards[]` shape, since Campaign has no
  generic sections StreamField either.
- The mockup schema has no equivalent of `Logo`, `Background header image`,
  `Color theme`, `Spotlight 1`/`Spotlight 2`, `Top facts`, or the `Video`/
  `Accordion section`/`Embed` block types in `Additional content` — these
  are real Karl fields with no corresponding mockup concept today.
- Campaign's `Related` block is the first `related`-shaped field in this
  doc that supports an external URL and its own link text — if a Campaign
  mockup page is ever built, `related`-style `karl` notes should not
  assume the "just a bare page reference, no custom text" gap documented
  for Transaction/Information/Resource Collection; that gap doesn't apply
  here.
- **Correction (2026-07-06 live-admin check):** Campaign's `Related` is
  repeatable, not single-item — `mosquito-education-workshop.js`'s karl
  notes previously claimed only 1 of its 4 related cards could occupy
  Related and the other 3 needed an `Additional content → Resources`
  block instead. That was wrong; all 4 cards can map directly to
  repeatable `related_links` entries. The page's `karl` notes have been
  corrected accordingly.

## Verified against the real Karl "Topic" add-page form (2026-07-05)

Like the sections above, everything here was confirmed directly in Karl's
live "New: Topic" form at api.sf.gov. Treat it as authoritative for the
`Topic` page type specifically. Field names below are UI labels, not raw
Wagtail field names — those weren't inspected. This is a single-tab
("Content") form, same as the other verified page types.

| Karl field           | UI label                                              | Block type(s) available                                                                                                   | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| -------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| _(title)_            | Title \*                                              | plain text                                                                                                                | Required                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| _(primary agency)_   | Primary agency \*                                     | page chooser, restricted to `Agency` pages                                                                                | Required                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| _(description)_      | Description                                           | plain textarea                                                                                                            | Helper guidance: start with keywords to aid scanning — not a general-purpose intro paragraph field                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| _(set top-level)_    | Set top-level?                                        | checkbox                                                                                                                  | When checked, this Topic can no longer be used as a **child** topic — instead it surfaces on the main Services list page. Mutually exclusive with being nested under a parent.                                                                                                                                                                                                                                                                                                                                                                                                                             |
| _(page content)_     | **Child topics** (StreamField label — see note below) | chooser, repeatable, offers 6 block types: `Child topics`, `Content top`, `Services`, `Spotlight`, `Resources`, `Content` | **Naming trap:** the outer StreamField itself is UI-labeled "Child topics," but one of the six block _choices_ inside it is _also_ literally named "Child topics" — a block type sharing its exact label with its own parent field. Internally this field is called "Page content." Don't assume "Child topics" always means the outer field; check which one a reference is actually pointing at. Editor **pre-populates one each** of `Content top`, `Services`, `Spotlight`, `Resources`, and `Content` on a new page — `Child topics` is not pre-populated. Duplicates of any block type can be added. |
| _(partner agencies)_ | Partner agencies (repeatable)                         | page chooser restricted to `Agency` pages                                                                                 | Same field/restriction as Transaction/Resource Collection/Campaign's `partner_agencies`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |

**The six "Page content" block types:**

- `Child topics` — a nested list of child Topic pages (distinct from the
  parent `Set top-level?` checkbox; this is how a Topic declares its own
  children rather than declaring itself top-level).
- `Content top` and `Content` are **the identical block type under two
  names** — "Content top" is simply the pre-populated instance that
  appears first; "Content" is the same shape for any additional instance
  added later. Both are: a plain-text Title + a required, separately
  nested "Section content" stream. That nested stream offers **its own
  six block types** — `Button link`, `Phone number`, `Resources`,
  `Spotlight`, `Timeline`, `Text` — which **partially overlap but are not
  identical** to the outer "Page content" stream's six types: `Resources`
  and `Spotlight` are usable at _both_ levels (top-level or nested inside
  a Content block); `Child topics`/`Services` are outer-level only;
  `Button link`/`Phone number`/`Timeline`/`Text` are inner-level only.
  `Timeline` is a block type not seen on any other verified page type in
  this doc.
- `Services` — Title + a "Links" list, each link either an `SF.gov page`
  chooser or an `External link`. Per Karl's Help Center docs (not the
  live form, but corroborating): Transaction and Step by step pages
  **auto-populate** under a "More services" heading on the Topic page
  once tagged with this topic on their own `topics` field — a manually
  added `Services` entry for the same page removes it from "More
  services" and pins it wherever the editor placed it instead.
  Automatically added pages are not visible/editable from the Topic
  page's own editor.
- `Spotlight` — Spotlight title, Spotlight description, Spotlight image
  (chooser, recommends min 1080×350px), Image alignment (`Side by
side`/`Full width`), Image position (`Right`/`Left`), and an optional
  Button link. Same shape as Campaign's `Spotlight 1`/`Spotlight 2`
  blocks, but repeatable here rather than two fixed named slots.
- `Resources` — identical structure to `Services` (Title + Links list of
  `SF.gov page`/`External link`). Per Karl's Help Center docs, Resources
  tiles are supported on 4 other content types too (`About`, `Campaign`,
  `Resource collection`, `Topic`), suggesting this is a shared reusable
  block across page types rather than Topic-specific.

**Corroborating (not live-form-verified) context from Karl's Help Center
documentation:**

- Only Digital Services can create new Topic pages; a topic can be
  requested and drafted without being published/visible yet.
- "Top-level" topics (see `Set top-level?` above) are collected onto a
  single sitewide Services list page — 14 existed as of the docs'
  last update.
- A Topic can have "Child topics" to form a hierarchy (see the
  `Child topics` block above).
- Only 4 content types can be tagged as Related pages: `Transaction`,
  `Information`, `Campaign`, `Topic` — `Resource Collection` is
  conspicuously absent from that list, worth reconciling against this
  doc's Resource Collection section (which found no `related` field on
  Resource Collection at all — consistent with this omission, not a
  contradiction).

Practical implications for `pages/*.js` → Topic pages:

- The mockup's `pestsTopic` (`agency-service-grouping.js`) has 9 body
  sections, none of which use `steps[]` or `table[][]` — all are
  `paragraphs[]`/`bullets[]`/`cards[]`, which maps reasonably cleanly:
  intro/orientation sections with no cards → nested `Text` blocks inside
  a `Content`/`Content top` block's Section content stream (not the
  page-level `Description` field, which per its own helper text is a
  short keyword field, not a prose intro — this mockup's paragraphs are
  too long for that). Sections with cards linking to Transaction pages
  → a `Services` block; sections with cards linking to Information/
  Resource Collection/Campaign pages → `Resources` blocks.
- **Real-schema gap:** both `Services` and `Resources` blocks are Title +
  Links only — **no intro-paragraph field**. Every mockup section in
  `pestsTopic` that has both a `paragraphs[]` intro _and_ `cards[]` (e.g.
  "Report a problem", "Prevent pests and housing health problems") loses
  that intro paragraph if mapped directly to a top-level `Services`/
  `Resources` block. The alternative — nesting a `Text` block plus a
  `Resources`/`Services` block together inside one `Content`/`Content
top` block's Section content stream — preserves the paragraph but adds
  a layer of nesting. Flag this choice for Digital Services rather than
  assuming either resolves it.
- The mockup has no equivalent of `Primary agency`, `Set top-level?`,
  `Child topics`, `Spotlight`, `Timeline`, or `Partner agencies` — real
  Karl fields/blocks with no corresponding mockup concept today.
- `pestsTopic`'s `editorNote` already says "tag Topics so child pages
  appear on this Topic; manually link Information pages after publish" —
  consistent with the Help Center docs' auto-tag-vs-manual-link
  distinction confirmed above (Transaction/Step-by-step auto-populate
  under "More services"; Information pages do not auto-populate anywhere
  and must be manually added via `Resources`).

## Other page types (Data story, Event, etc.) — unverified

Everything below this point (aside from the verified Transaction,
Information, Resource Collection, Campaign, and Topic sections above) is
the original guesswork, not yet checked against a live Karl form. Confirm
with Digital Services (or repeat the same live-session verification)
before relying on it.

### Data story and Event — doc-confirmed field lists (2026-07-06)

Unlike the rest of this section (guesswork), these two page types were
checked against the Help Center on 2026-07-06 and have a real field/block
inventory. Still UI labels only — no raw Wagtail names, and not the live
admin form — but no longer "entirely unverified." Full research log:
`docs/karl-help-center-research-2026-07-06.md`.

**Data story**: goals/audience/URL/access-permission table, plus content
built from repeatable **Data story content sections**, each with an
optional Section title and Text, Callout, Images, and a PowerBI embed. The
Callout component page confirms Data story is 1 of only 3 content types
that support callouts (Transaction, Information, Data story).

**Event**: "How an Event page works" gives the full field list — Title,
Description, Primary Agency, Call to action, Date time, Cost, Location,
Image, Main body text, Partner agencies, Contact us, Topics. Supporting
subpages: **Call to action on Event** (title/description/SF.gov-or-
external link/link text/screenreader label) and **Location on Event
page** (an online checkbox plus call-to-action signup link, supporting
in-person/virtual/hybrid).

### Agency, About us, Location, Meeting, News, Profile, Report, and Step by step — live-admin-confirmed field lists (2026-07-06)

Live-admin-confirmed (stronger tier than doc-confirmed) top-level field
lists, from opening each "New: <Type>" form directly in Karl. Only
top-level fields were captured, not full nested-block detail, and raw
Wagtail field names weren't inspected for these 8 types. Full research
log: `docs/karl-live-admin-verification-2026-07-06.md`.

- **Agency**: Title, Description, Logo, Main image, Alert, Quick links,
  Meeting information, Section title 1 + Subsection, Spotlight 1/2 +
  Highlights, Section title 2 + Subsection, About, Call to action,
  Divisions or subcommittees, Partner agencies, People, Public records,
  Archive information, Meeting archive information, Contact us,
  **Redirect this page to**, Topics.
- **About us**: Title, Primary agency, Information, Resources.
- **Location**: Title, Primary agency, Description, Alert, Essential
  information, Image, Body (Getting here/Parking/Accessibility/Public
  transportation/Accordions/Services), About, Partner agencies, At this
  location, People, Related locations, Contact us.
- **Meeting**: Title, Primary agency, agency-listing selector, Meeting
  information (cancelled flag, Date/time, Location, Overview, Agenda,
  Meeting resources, Videos, Related documents), Regulations and notices,
  Notices, Partner agencies.
- **News**: Headline, Primary agency, Date, Image, **Redirect this page
  to** (positioned mid-form here, not at the bottom), Abstract, Body,
  Type (News/Press Release dropdown), Topics, Partner agencies.
- **Profile**: Name, Pronouns, Profile photo, Primary job title (+ line
  2), Primary agency, Additional roles, Biography, Direct contact (phone/
  email/social), Optional content, Spotlight, Quick links, Contact us,
  **Redirect this page to**.
- **Report**: Title, Date, Primary agency, Spotlight, Content, Print
  version (document chooser), Partner agencies.
- **Step by step**: Title, Primary agency, Description, Intro, Steps,
  Topics, Partner agencies.

**Cross-reference for Transaction's "Redirect this page to" (task #3):**
Agency, News, and Profile all show this field on their *new/unsaved* live
forms — so the field itself isn't Transaction-specific or disabled in the
CMS entirely. This is consistent with the theory that it only activates
(renders input elements) once a page has been saved once, rather than
being disabled outright.
in-person/virtual/hybrid).

### Page-level fields → Wagtail Page model (general guess)

| Mockup field (`build_scripts/schema.js`) | Likely Wagtail equivalent                                                                              |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `slug`                                   | Page `slug`                                                                                            |
| `title`                                  | Page `title`                                                                                           |
| `summary`                                | Page `search_description` / intro `RichTextField`, depending on template                               |
| `audience`                               | Custom `StreamField`/`ListBlock` ("Who this is for") if Karl has one, otherwise folded into intro copy |
| `reading`                                | Editorial metadata field, if Karl tracks reading level; otherwise QA-only, not migrated                |
| `seoTitle`                               | Page `seo_title`                                                                                       |
| `metaDescription`                        | Page `search_description`                                                                              |
| `primaryCta`                             | Whatever field/block Karl uses to flag the page's one primary call-to-action                           |
| `editorNote`                             | **Not migrated.** QA-only; equivalent to a Wagtail workflow comment, not page content                  |

### Section-level (`sectionSchema`) → StreamField blocks (general guess)

This is now known **not** to hold for `Information`, `Resource
Collection`, `Campaign`, or `Topic` — see the verified sections above;
all four use named fields with specific block types (`Information
section`'s `Title and text`/`Image`/`Callout`; `Resource Collection`'s
`Introductory text`/`Body`/`Custom section`; `Campaign`'s `Spotlight`/
`Top facts`/`Additional content`/`About`; `Topic`'s `Page content` stream
of `Services`/`Resources`/`Content`/`Spotlight`/`Child topics`), not a
generic sections StreamField, same pattern as `Transaction`. No
remaining page type in this doc is still open for this guess to apply
to — everything below is unconfirmed for entirely different reasons
(never checked at all).

| Mockup shape                       | Guessed Wagtail block                                                                                                          |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `section.paragraphs[]`             | `RichTextBlock`                                                                                                                |
| `section.bullets[]`                | `RichTextBlock` (bulleted list) or a dedicated `ListBlock`                                                                     |
| `section.table[][]`                | `TableBlock`                                                                                                                   |
| `section.cards[]`                  | Related Links block, body link, Resource Collection item block, or an Agency-page link-section block, depending on `card.karl` |
| `section.callout` / `step.callout` | A callout/aside `StructBlock` (`text`, optional `title`)                                                                       |
| `section.button` / `step.button`   | A CTA block — internal page chooser vs. external link, `buttonStyle` selecting primary/secondary                               |

## Karl fields themselves

`karl` strings (on cards, steps, sections, callouts) are placement/rationale
notes for reviewers and — eventually — for whoever builds the Wagtail page.
They are not content and are never rendered outside the `karl-tag` `<mark>`
elements in this mockup. Keep them written as instructions to a Wagtail
page-builder ("use X block because Y"), not as prose about the mockup.

## Open items for the next Karl verification session

Confirmed gaps and unresolved field names, pulled from the verified sections
above and from inline `karl` notes across `pages/*.js`. Check these off (or
correct them) the next time a live Karl session is available, rather than
re-discovering them from scratch.

**Remaining `[ ]` items are tracked as numbered follow-up tasks** (see the
project task list, tasks #1–#8) rather than carried as full inline
write-ups here — each bullet below just names the gap and points at its
task. Method precedence for those tasks: try Karl MCP
(`searchDocumentation`/`getPage` against the Help Center) first with fresh
query phrasings before falling back to a live logged-in admin session.

**2026-07-06 pass against the public Karl Editor Help Center**
(`sfdigitalservices.gitbook.io/karl-sf.gov-editor-help-center`): items marked
`[x] doc-confirmed` below were corroborated by editor documentation — a
weaker source than the live admin form (it shows UI labels and behavior, not
raw field names), but strong enough to stop treating them as open questions.
Everything still `[ ]` needs the logged-in admin form.

### Confirmed schema gaps (recurring, cross-page)

- [x] **doc-confirmed: `Related`/page-reference fields carry no custom
      description** (Transaction `related`, Information `related`) — the
      Help Center "Related" component page confirms Related items render as
      "a title and link" pulled from the target page and auto-updated when
      it changes; there is no per-item title/text. Affects ~34 cards across
      ~19 pages (the largest single gap by volume), e.g.
      `bed-bug-rules-prevention.js`, `agency-service-grouping.js`,
      `report-a-problem.js`, `prevent-problems.js`, most
      `lookup-*`/`report-*` pages. **Does not apply to Campaign** — its
      `Related` is a distinct `Page block` with its own "Link text."
      Resource Collection's `Body → Resources → SF.gov page` internal-link
      case is likewise a bare page chooser per the "Resources" component
      page, but note **External link entries in Resources DO carry their
      own Title, URL, and description** — only internal SF.gov page links
      lose the custom card text.
- [ ] **Contradicted, needs re-check: `Related`'s content-type
      restriction.** Doc claim was Transaction/Information/Campaign/Topic
      only, per the Help Center's "Related" page (*"Only a few content
      types can be tagged as Related pages: Transaction, Information,
      Campaign, Topic"*). **2026-07-06 live-admin check on Campaign's
      Related picker contradicts this**: searching "resource" surfaced
      Resource Collection pages as selectable results, and one was
      successfully chosen as a target. Either the restriction doesn't
      apply to Campaign's `related_links` specifically, or the Help
      Center claim is stale — Transaction/Information/Topic's Related
      pickers haven't been live-tested yet, only Campaign's. Downgraded
      from doc-confirmed pending that re-check.
- [x] **doc-confirmed: Information pages have no button/CTA block type** —
      the "Button" component page enumerates exactly where buttons exist
      (Transaction call-to-action; Event/Meeting signup links;
      Agency/Campaign/Report Spotlights) and Information is not among them.
      Verified schema stands: `Title and text` / `Image` / `Callout` only.
      Affects 11 Information pages, including `bed-bug-rules-prevention.js`,
      `what-happens-after-report.js`, `tenant-rights-reporting.js`,
      `fly-information.js`, `mite-information.js`. (Same page also confirms
      Button fields — SF.gov-page-or-external choice, "Link text" capped at
      25 characters, "Screenreader label" — and an editorial "no more than
      one button per page" rule that several mockup pages with multiple
      `button` entries would violate.)
- [x] **doc-confirmed: Information pages have no Section/step container** —
      the Help Center's "How an Information page works" section list (Title,
      Description, Primary Agency, Part of, Information section [Title and
      text / Image / Callout], Partner agencies, Topics, Related) has no
      `what_to_do`-style Section wrapper for step-by-step content.
- [x] **doc-confirmed: no block type for tabular content on Information
      pages** — a mockup `table[][]` has no home in `Title and
      text`/`Image`/`Callout`. The Help Center's "How a Report page works"
      page states: *"You can add a table to Reports. It is the only
      content type that supports tables."* That's an affirmative
      exclusivity claim, not just silence on other page types — no page
      type other than Report has a table block, Information included.
- [x] **live-admin-confirmed (2026-07-06): Topic's `Services`/`Resources`
      blocks have no intro-paragraph field** — both blocks are Title
      (single-line) + Links (repeatable, each an `SF.gov page` or
      `External link`); no free-text/description field above the link
      list on either block type.
- [x] **live-admin-confirmed (2026-07-06): Campaign's `Related` is
      repeatable** (raw name `related_links`, a StreamField — confirmed
      by adding two separate Page entries) **and its picker is not
      restricted to Transaction/Information/Campaign/Topic** — see the
      new contradiction item above and the corrected Campaign table row.

### Field names / UI mechanics still unconfirmed

- [ ] Transaction's "Redirect this page to" raw Wagtail field name —
      **partially resolved (2026-07-06 live check):** the field label is
      present at the bottom of the Transaction form but is inert on a new/
      unsaved page — DOM inspection found zero `<input>`/`<select>`
      elements with "redirect" in their name/id anywhere on the page. It's
      likely disabled until the page has been saved once, rather than
      disabled in the CMS entirely as the Help Center doc suggested (see
      `docs/karl-help-center-research-2026-07-06.md` item 5). Raw field
      name still needs checking on an already-saved Transaction page —
      remains open as follow-up task #3.
- [x] **live-admin-confirmed (2026-07-06): Information's raw field
      names** — Primary Agency → `primary_agency`; "Part of" → `part_of`;
      Information section → `information_section`; Partner agencies →
      `partner_agencies`; Topics → `topics`; Related → `related`.
- [x] **live-admin-confirmed (2026-07-06): Resource Collection / Campaign
      / Topic raw field names** — see the new "Live-admin-confirmed raw
      field names (2026-07-06)" note in
      `docs/karl-live-admin-verification-2026-07-06.md` for the full list;
      Campaign's is also folded into its table above.
- [x] **live-admin-confirmed (2026-07-06): `Address` block's "Hours and
      days open" is a repeatable StreamField of "Office hours" entries.**
      Each entry has a Days radio: "Monday to Friday" (one row, Open-from/
      to time pickers + "Add break") or "Custom" (expands to one
      independent row per day, Monday–Sunday, each with its own time
      pickers and "Add break"). Note: this field only rendered/functioned
      on the full snippet admin form (`/admin/snippets/cms/address/add/`)
      — inside the page-chooser's inline "Create" tab, the same field's JS
      widget failed to initialize.
- [x] **live-admin-confirmed: Transaction's rich text fields have the same
      "/" slash-menu** as Information — confirmed directly on a
      Transaction page in the live Karl admin (2026-07-06). (2026-07-06
      doc check found no public doc page mentioning a "/" slash-command
      menu for any content type, so this was previously unresolvable from
      docs alone — resolved instead by direct live-admin observation.)
- [x] **live-admin-confirmed (2026-07-06): Transaction's rich text Link
      tool has 4 types** — Internal link, External link, Email link, Phone
      link. Resolves the discrepancy noted in
      `docs/karl-help-center-research-2026-07-06.md` (item 10) in favor of
      the 4-type claim; the public docs' 2-type description is incomplete.

### Entirely unverified

- [x] **doc-confirmed (partial): Data story and Event page types** — see
      the "Data story and Event" subsection added under "Other page
      types" below; both now have a real field/block inventory sourced
      from the Help Center rather than guesswork. Full research log:
      `docs/karl-help-center-research-2026-07-06.md`.
- [x] **live-admin-confirmed (2026-07-06): Agency, About us, Location,
      Meeting, News, Profile, Report, and Step by step** — see the new
      "Agency, About us, Location, Meeting, News, Profile, Report, and
      Step by step" subsection under "Other page types" below for
      top-level field lists sourced directly from the live admin forms.
      Only top-level fields were captured (not full nested-block detail),
      and raw Wagtail field names weren't inspected for these 8 types —
      still open if ever needed, but out of scope for now since none of
      these types are used by any `pages/*.js` file in this repo. Full
      detail in `docs/karl-live-admin-verification-2026-07-06.md`.

## Accuracy check: "HHVC Karl CMS Governance and Technical Design Manual" (2026-07-06)

A separate Google Doc ("HHVC Karl CMS Governance and Technical Design
Manual") was checked against the public Karl Editor Help Center
(`sfdigitalservices.gitbook.io/karl-sf.gov-editor-help-center`) via the
Karl MCP tools. That doc lives outside this repo and isn't edited here —
this section only records where its claims disagree with Karl's actual
documented behavior, so future editors don't inherit its errors.

**Corrected — the source doc's claim is wrong or overstated:**

- **Alerts:** the doc claims alerts are "allowed only on Topic/Location"
  and forbidden on Transaction/Information. Karl's Alert page states only
  **2 content types support alerts: Agency and Location** — not Topic.
- **Reading level:** the doc lists "Grade 5–6 for service pages" as a
  "Critical Fail Point" (publish-blocking). Karl's Readability page states
  the opposite: *"5th grade reading level is not required on SF.gov, but
  it's a helpful guideline."* It is not a publication gate.
- **Grade 8 legal/fee pages:** the doc states "Grade 8 maximum" as a hard
  ceiling. Karl's specialist-writing guidance says to "aim for" 8th grade
  but to "prioritize clarity and findability over a grade level" — a
  suggestion, not a maximum enforced at publish.
- **Tables:** the doc implies tables are a general component (with a
  3-column limit) available across page types. Karl's Report page docs
  state **Report is the only content type that supports tables at all**
  ("It is the only content type that supports tables"). The 3-column
  guidance is real but the doc omits that no other page type has tables.
- **"Code Interpretation Template":** the doc names this as one of "4
  required design system templates" with 7 mandatory fields. No such
  content type exists in Karl. The real 14 Karl content types are Agency,
  About, Campaign, Data story, Event, Information, Location, Meeting,
  News, Profile, Report, Resource collection, Topic, Transaction, and
  Step by step — there is no Code Interpretation type or its 7 fields
  anywhere in the Help Center.
- **Card layouts:** the doc claims cards are "system-automated; editors
  cannot override." No Karl Help Center page makes this claim in either
  direction — cards are covered per-content-type (e.g. Topic's `Services`/
  `Resources` blocks, Resource Collection's `Body` blocks) with ordinary
  editor-filled Title/Links fields, not an automated layout. Treat this
  claim as unconfirmed/likely wrong rather than a real constraint.

**Left alone — HHVC-specific policy, not a Karl CMS platform claim, so
Karl's Help Center has no bearing on it either way:**

- 72-hour owner notice before reporting
- Mandatory "SRO or residential hotel" phrasing
- 311 as the primary/required route, no independent intake path
- "rats or mice" instead of "rodents" in titles

These are HHVC program/content decisions, not Karl platform rules — Karl's
documentation doesn't confirm or contradict them, and they're out of scope
for this doc's Karl-CMS-mapping purpose.

## What this doc is not

- Not a live Wagtail schema for anything beyond the verified `Transaction`,
  `Information`, `Resource Collection`, `Campaign`, and `Topic` sections
  above — Karl's actual StreamField block names and Page models for other
  page types live in the Digital Services Wagtail codebase, not here.
- Not a migration tool — nothing in this repo reads or writes Wagtail data.
- The "Other page types" section is a hypothesis to confirm with Digital
  Services, not a guarantee.

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

| Karl panel (field name)                                           | UI label                                                                                                    | Block type(s) available                                                                                                                        | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `title`, `description`                                            | Page title / Description                                                                                    | plain text / textarea                                                                                                                          | —                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `primary_agency`                                                  | Primary agency                                                                                              | page chooser, restricted to `Agency` pages                                                                                                     | Required                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `cost`                                                            | Cost                                                                                                        | single struct, **max 1 item**, no chooser (auto-inserted)                                                                                      | Required radio group `cost` (`Free`, `Flat fee`, `Range`, `Minimum and up`, `None`) reveals different nested fields per option: `Flat fee` → numeric "Flat fee" field; `Range` → numeric "Minimum cost" + "Maximum cost"; `Minimum and up` → numeric "Minimum cost" only; `Free` and `None` reveal no extra fields. All five variants end with the same "Cost description" field — Draftail rich text, **capped at 120 characters**, same "/" slash-command block insertion as other rich text fields in this form. Both `cost` and `things_to_know` live together under the parent grouping "What to Know Before You Start".                                                                                                                                                                                                             |
| `things_to_know`                                                  | Things to Know                                                                                              | single block type `title_and_text`, **repeatable** (no max seen — 3 instances observed in one live draft), no chooser                          | Fields: "Title" (plain text) + "Text" — Draftail rich text (see standard toolbar note below the table). Ships **pre-seeded with 1 example** ("Who this page is for.") on a brand-new page, but editors can add more freely.                                                                                                                                                                                                                                                                                                                                                                   |
| `what_to_do`                                                      | What to Do                                                                                                  | chooser: **`Callout`** or **`Section`**                                                                                                        | `Callout` here is a **single Draftail rich text field only — no separate title/heading field**, unlike `things_to_know`/`custom_section`/`supporting_information`/`good_for_community` which all pair a plain-text title with their rich text. Standard toolbar (see below the table), placeholder "Write something or type '/' to insert a block". A mockup `steps[]` entry = one `Section` block (see below)                                                                                                                                                                                |
| _(within a `Section` block)_ `section_title`, `section_specifics` | Section title / Section specifics                                                                           | `section_specifics` chooser: `Address`, `Callout`, `Document`, `Email`, `Button link`, `Phone number`, `Text`                                  | `Text` and `Callout` here are both Draftail rich text, same standard toolbar + "/" placeholder as `what_to_do`'s top-level `Callout`. **`Callout` has no title field here either** — same gap as above. A step's `text`/`bullets` → `Text`; `button`/`buttonUrl`/`buttonTarget` → `Button link`; `callout` → `Callout`. All as siblings inside one `Section`, not fields on the step itself. If a mockup `callout.title` needs to survive the move to Karl, it has no dedicated field — fold it into the Callout's rich text (e.g. as a bolded lead-in) or flag the gap for Digital Services. |
| `special_cases`                                                   | Label: "Special cases"; helptext: 'If this field is blank, the heading "Special cases" will show on SF.gov' | plain text (blank = default heading shown)                                                                                                     | Not a StreamField itself — a text override for the heading of the two panels below it (`custom_section`, `supporting_information`)                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `custom_section`                                                  | Custom Section                                                                                              | single block type `title_and_text`, no chooser                                                                                                 | Fields: "Custom section heading" (plain text) + "Custom section text" — Draftail rich text (see standard toolbar note below the table).                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `supporting_information`                                          | Accordion title and text                                                                                    | single block type `title_and_text` (block instance labeled "Accordion item"), no chooser                                                       | Fields: "Accordion title" (plain text) + "Accordion text" — Draftail rich text, placeholder "Write something or type '/' to insert a block". Ships **pre-seeded with 5 example items** on a new page.                                                                                                                                                                                                                                                                                                                                                                                         |
| `related`                                                         | Related                                                                                                     | page chooser (any page type), repeatable, no chooser popup (single "kind")                                                                     | Field label: "Page *" (required) with a "Choose a page" button — no type restriction shown. **No custom title/text per item** — just a page reference. Display text is presumably pulled from the target page itself, unlike the mockup's `cards[]` (`title`, `text`, `target`)                                                                                                                                                                                                                                                                                                               |
| `good_for_community`                                              | "Why is this Transaction Good for the Community?"                                                           | single block type, **repeatable** (2 instances observed), labeled **"Additional info"** — same struct as `get_help`'s "Additional info" option | Fields: "Title" (plain text) + "Text" (Draftail rich text, standard toolbar)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `get_help`                                                        | Contact us                                                                                                  | chooser: `Address`, `Email`, `Phone number`, `Additional info`                                                                                 | `Address` is a **chooser** ("Choose an address" button — references a stored Address record, not inline fields). `Additional info` = Title + Text, same struct as `good_for_community`. `Phone number` fields: "Name" (optional; helptext: name the person/group that owns this phone number, can be left blank), "Phone number", "Extension", "Phone number details" (helptext: e.g. "You must answer automated questions before you talk to a human," can be left blank). `Email` fields: "Title" + "Email".                                                                                |
| `partner_agencies`                                                | Partner agencies                                                                                            | page chooser restricted to `Agency` pages, repeatable                                                                                          | Helptext confirmed: "Add other close partner agencies, divisions or subcommittees."                                                                                                                                                                                                                                                                                                                                                                                                     |
| `topics`                                                          | Topics                                                                                                      | page chooser restricted to `Topic` pages, repeatable                                                                                           | Also has a **"Hide on Topic Pages"** checkbox (seen earlier as `hide_on_topic_pages` in the raw form fields). Helptext explains the transaction won't auto-list under "More services" on Topic pages. (The earlier "use for parts of a step-by-step" phrasing was an unconfirmed screenshot approximation — superseded by this simpler description, not independently re-verified word-for-word.)                                                                                                                                                                                                                                                      |
| _(unnamed field name — not yet inspected)_                        | "Redirect this page to"                                                                                     | plain text field                                                                                                                               | Sits at the very bottom of the form, after `topics`. Not in the mockup schema at all. Confirmed as a **disabled/greyed-out plain text field on a new, unsaved page** — likely only becomes active once the page exists, consistent with a typical Wagtail redirect-target field. Field name still not inspected.                                                                                                                                                                                                                                                                              |

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
- `get_help`'s `Phone number` block fields were previously recorded as
  "Name" for the owner field (see the `get_help` row above); this pass's
  independent re-look at a `Phone number` block observed the same field
  labeled "Owner" instead. Not yet reconciled — it's unclear whether this is
  the same struct with inconsistent recall, two different Phone number
  block definitions (one for `section_specifics`, one for `get_help`), or a
  simple naming slip in one of the two observations. Re-verify the exact
  label before relying on either name.

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
| _(title)_                                           | Page title *                                  | plain text                                      | Required                                                                                                                                                                                                                                                                      |
| _(description)_                                     | Description                                   | plain multi-line textarea                       | No rich text toolbar — unlike Transaction's rich text fields, this one is plain text only                                                                                                                                                                                     |
| _(primary agency — field name not yet inspected)_   | Primary agency *                              | page chooser, restricted to `Agency` pages      | Required                                                                                                                                                                                                                                                                      |
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

## Other page types (Topic, Resource Collection, etc.) — unverified

Everything below this point (aside from the verified Transaction and
Information sections above) is the original guesswork, not yet checked
against a live Karl form. Confirm with Digital Services (or repeat the same
live-session verification) before relying on it.

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

This is now known **not** to hold for `Information` — see the verified
section above; it uses a named "Information section" stream field with
specific block types (`Title and text`, `Image`, `Callout`), not a generic
sections StreamField, same pattern as `Transaction`. This guess may still
hold for `Topic`/`Resource Collection`, which remain unconfirmed.

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

## What this doc is not

- Not a live Wagtail schema for anything beyond the verified `Transaction`
  and `Information` sections above — Karl's actual StreamField block names
  and Page models for other page types live in the Digital Services Wagtail
  codebase, not here.
- Not a migration tool — nothing in this repo reads or writes Wagtail data.
- The "Other page types" section is a hypothesis to confirm with Digital
  Services, not a guarantee.

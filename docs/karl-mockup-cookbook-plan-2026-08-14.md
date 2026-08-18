# Cookbook plan: building HHVC mockups section by section, against the real Karl editor

**Status:** written up — the cookbook this plans is `docs/karl-mockup-cookbook.md`.
Keep this file as the capture record: the method, the page IDs, and the
open/closed items. Captured 2026-08-14 from the **live, logged-in Karl admin**
(`api.sf.gov/admin`), one representative page per content type, read-only.

**Two content types were probed after this plan was written** and appear only in
the cookbook: **Topic** (`content_fields` MENU: Child topics, Content top,
Services, Spotlight, Resources, Content; a `Content` block is `title` +
`section_content`, itself a MENU of Button link, Phone number, Resources,
Spotlight, Timeline, Text — captured on HHVC's own live Topic page, ID 97543)
and **About us** (`sf.About`, ID 16344: `title`, `primary_agency`, `about_info`
single block `title`+`text`, `resources` MENU of Resources section /
Downloadable files — with **no `description`** and **no `tags`**, the only type
of the eight that breaks that uniformity).

**What this document is.** A build plan for a cookbook aimed at HHVC staff —
people who will author a page mockup in this tool and, later, rebuild that page
in Karl. It carries the editor layout the cookbook must be written against, the
recipe format each chapter should follow, and the rules that are easy to get
wrong. It is **not** a second Karl field reference: that already exists in
`docs/source/hhvc-policy/karl-content-type-field-reference.md` (per-type field
lists plus HHVC mockup mapping) and `docs/wagtail-content-mapping.md` (the
2026-07-05/07-06 verification log and its open-items list). Where this capture
closes an item those docs left open, it is called out under "What this capture
settles" — the correction belongs in those files, not in a parallel summary that
rots. Read them first; read this for what to _do_ with them.

**Method, and its limits.** Each page was opened in the real editor, its
`data-contentpath` fields enumerated top to bottom, and every StreamField's "+"
button clicked to record whether it opens a **block menu** (multiple block types)
or **inserts a single block type directly** (no menu — Karl inserts immediately),
then the inserted block's own fields read one level deep. Nothing was saved or
published; only client-side form state was touched, and every form was navigated
away from or reloaded. Block insertion is the only way to see a block's fields
without an existing example, so a probe that finds an empty menu and an inserted
block is reporting a real single-type stream, not a failed click.

| Content type        | Page probed                                     | ID     |
| ------------------- | ----------------------------------------------- | ------ |
| Transaction         | Report rats or mice                             | 102818 |
| Agency              | Mayor's Office of Innovation                    | 185    |
| Information         | Free meals for youth under age 18 (UESF strike) | 88734  |
| Resource Collection | County Clerk Forms and Documents                | 1027   |
| Campaign            | Student Success Fund old                        | 849    |
| Report              | Fee Schedule/Records                            | 159    |

---

## Gating facts the cookbook must open with

A staff author who learns these on page four has already wasted an afternoon.

- **You cannot create an Agency page yourself.** The Karl help center is explicit:
  Digital Services must create that content type for you. The HHVC Agency page is
  the top of the redesigned section, so the cookbook's Agency chapter is a
  _request-and-fill_ recipe, not a create recipe.
- **`Primary agency` is mandatory on every content type.** It appeared on all six
  editors probed, help text _"The agency that owns and manages this page
  content."_ One page, one primary agency; its name renders under the title and
  description on SF.gov.
- **There are exactly two tabs: Content and Promote.** No Settings tab is
  surfaced. Say so, because authors will look for one. Everything SEO — `slug`,
  `seo_title`, `search_description`, `show_in_menus`, `tags` — lives on
  **Promote**, and those are identical across all six types.
- **A "+" button that opens no menu is not broken.** Roughly half the streams in
  Karl hold exactly one block type and insert it on click. The cookbook should
  say which are which, per section, so nobody hunts for a chooser that does not
  exist.
- **Tables exist on Report pages only.** Confirmed again here: Report's `content`
  stream is the only one of the six offering a `Table` block. A mockup
  `table[][]` on any other page type has no home in Karl.

---

## The recipe format every chapter follows

One chapter per content type. Inside a chapter, one entry per section, **in
editor top-to-bottom order rather than logical order** — the cookbook is meant to
be followable while scrolling the real form.

Each entry:

1. **Karl field name** (the raw `data-contentpath`, so it can be grepped and
   matched against the two reference docs) and its visible label.
2. **How to add it** — single-insert click, or menu with the exact option names.
3. **The block's own fields**, one level deep, marking nested streams.
4. **The mockup equivalent** — which `sections[]` shape in `pages/*.js` stands
   for it, and what the section's `karl` note should say. That `karl` string is
   already this mapping written per section; the cookbook is the general case of
   it.
5. **The trap, if the section has one** — inheritance, character limits, a block
   that cannot hold what the author wants.

---

## Verified editor layouts

Field names are raw `data-contentpath` values. `MENU:` lists the block chooser's
options verbatim. `SINGLE:` lists the fields of the one block type the stream
inserts.

### Transaction — `sf.Transaction`

The workhorse type for HHVC's "report", "pay", and "request" pages.

| Order | Field                    | Shape                                                                    |
| ----- | ------------------------ | ------------------------------------------------------------------------ |
| 1     | `title`                  | text — _"The page title as you'd like it to be seen by the public"_      |
| 2     | `description`            | textarea — starts with key words, helps the user decide to read further  |
| 3     | `primary_agency`         | page chooser, mandatory                                                  |
| 4     | `cost`                   | SINGLE: `cost`, `flat_fee`, `range`, `minimum`, `maximum`, `description` |
| 5     | `things_to_know`         | SINGLE: `title`, `text`                                                  |
| 6     | `what_to_do`             | MENU: **Callout**, **Section**                                           |
| 7     | `special_cases`          | text — blank means the heading "Special cases" still shows on SF.gov     |
| 8     | `supporting_information` | SINGLE: `title`, `text`                                                  |
| 9     | `custom_section`         | SINGLE: `title`, `text`                                                  |
| 10    | `good_for_community`     | SINGLE: `title`, `text`                                                  |
| 11    | `related`                | page chooser only                                                        |
| 12    | `get_help`               | MENU: **Address**, **Email**, **Phone number**, **Additional info**      |
| 13    | `partner_agencies`       | page chooser only                                                        |
| 14    | `hide_on_topic_pages`    | checkbox — hides the page from "More services" on topic pages            |
| 15    | `topics`                 | page chooser only                                                        |

**`what_to_do → Section` is where the steps live**, and it is two levels deep:

- `Section` = `section_title` + `section_specifics` (a nested stream)
- `section_specifics` MENU: **Address**, **Callout**, **Document**, **Email**,
  **Button link**, **Phone number**, **Text**

That palette is the whole vocabulary of a step's body. A mockup step carrying
anything else — a table, an image — cannot be built as written.

**Mockup mapping:** `what_to_do` ↔ a section with `component: 'what-to-do'` and
`steps[]`; `supporting_information` ↔ `component: 'supporting'` (the accordion,
`open: true` to render it expanded); `get_help` ↔ `component: 'contact'`;
`related` ↔ `component: 'related'`.

**`things_to_know` does not map one-to-one onto `whatToKnow`, and the name
match is a trap.** Karl's `things_to_know` is a **repeatable** stream of
`title` + `text` blocks. The mockup's `whatToKnow` is a single page-level
object holding a `cost` string plus named subsections (see
`pages/public-records-request.js`, and `renderWhatToKnow()` in
`js/mockup/page-render.js`). So each named subsection becomes **its own**
`things_to_know` block, while `whatToKnow.cost` belongs in Karl's separate
`cost` field — not in a `things_to_know` block. An author who pastes the whole
box into one block loses the per-subsection H3s that SF.gov renders.

### Agency — `sf.Agency`

The HHVC section's front door. Long form; the cookbook should split it into
"above the fold", "services and resources", "about", and "contact".

| Order | Field                                          | Shape                                                                                       |
| ----- | ---------------------------------------------- | ------------------------------------------------------------------------------------------- |
| 1     | `title`                                        | text — descriptive, short, sentence case                                                    |
| 2     | `show_agency_list`                             | checkbox                                                                                    |
| 3     | `description`                                  | textarea                                                                                    |
| 4     | `logo`                                         | image chooser — min 100×100, squarish, white/transparent background                         |
| 5     | `main_image`                                   | image chooser — min 400px tall, 16:5 horizontal                                             |
| 6     | `alert`                                        | SINGLE: `alert_style`, `title`, `description`, `start_date`, `expiration_date`              |
| 7     | `alert_agency_wide`                            | checkbox — shows the alert on every page with the same primary agency                       |
| 8     | `quicklinks`                                   | SINGLE: `link_to`, `url`, `page`, `title`, `description`                                    |
| 9     | `meeting_information`                          | MENU: **Address**, **Things to know**                                                       |
| 10    | `services_title` + `services`                  | SINGLE: `title` + a nested list, each entry MENU: **SF.gov page**, **External link**        |
| 11    | `spotlight_1`                                  | SINGLE: `title`, `description`, `image`, `image_alignment`, `image_position`, `button_link` |
| 12    | `spotlight_2`                                  | same shape — Agency allows up to 2 spotlights                                               |
| 13    | `highlights`                                   | SINGLE, one block holding **two** highlight items, each `image` + a link + `description`    |
| 14    | `resources_title` + `resources`                | same shape as `services`                                                                    |
| 15    | `about_description`                            | chooser — points at the About us page                                                       |
| 16    | `call_to_action`                               | SINGLE: `title`, `description`, `button_link`                                               |
| 17    | `divisions_subcommittees`                      | SINGLE: `agency_section_title`, `agencies`                                                  |
| 18    | `partner_agencies`                             | page chooser only                                                                           |
| 19    | `people`                                       | SINGLE: `title`, `description`, `profiles` (nested: `profile_page`, `role`)                 |
| 20    | `public_records`                               | MENU: **Link**, **Email**, **Phone**                                                        |
| 21    | `archive_url` / `archive_date`                 | url + text — date is REQUIRED if a URL is given                                             |
| 22    | `meeting_archive_url` / `meeting_archive_date` | same pair for meetings                                                                      |
| 23    | `contact`                                      | SINGLE: `address`, `phone`, `email`, `social_media_other`                                   |
| 24    | `topics`                                       | page chooser only                                                                           |

Contact sub-blocks: `phone` = `owner`, `phone_number`, `extension`, `details`;
`email` = `title`, `email`; `social_media_other` MENU: **Social media**,
**Other (custom)**.

**Mockup mapping:** `services`/`resources` ↔ sections with
`component: 'services'` / `'resources'` and `cards[]`; `spotlight_1` ↔ the
page-level `spotlight`; `call_to_action` ↔ `primaryCta`; `contact` ↔
`component: 'contact'`.

### Information — `sf.Information`

The simplest type, and the one HHVC uses most for explanatory pages.

| Order | Field                 | Shape                                            |
| ----- | --------------------- | ------------------------------------------------ |
| 1     | `title`               | text                                             |
| 2     | `description`         | textarea                                         |
| 3     | `primary_agency`      | page chooser, mandatory                          |
| 4     | `part_of`             | page chooser only                                |
| 5     | `information_section` | MENU: **Title and text**, **Callout**, **Image** |
| 6     | `partner_agencies`    | page chooser only                                |
| 7     | `topics`              | page chooser only                                |
| 8     | `related`             | page chooser only                                |

**Three block types, and that is the entire body.** No button, no step
container, no table.

**`steps[]` on an Information page is still buildable — do not tell authors to
move it.** The stream is repeatable, so a step sequence becomes N sequential
**Title and text** blocks (Title = step title, Text = the step's paragraphs).
What has no Karl equivalent is the _numbered, visually sequenced_ presentation
the mockup draws — that is a presentation gap to raise with Digital Services,
not a reason to rewrite the content as a Transaction. The corpus already
handles this correctly: `pages/what-happens-after-report.js` is an Information
page with a `steps[]` section whose `karl` note spells out exactly that
one-block-per-step mapping and flags the numbering gap. The cookbook should
teach that pattern rather than forbid it.

**`button` and `table[][]` are the genuine exclusions.** A button belongs on a
Transaction (call-to-action) or an Agency/Campaign/Report spotlight; a table
belongs on a Report. Checked against the current corpus: of the six Information
pages in `pages/`, none carries a `button` or a `table[][]`, so this is
preventive guidance rather than a live defect.

### Resource Collection — `sf.ResourceCollection`

| Order | Field               | Shape                                                                                                                                   |
| ----- | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | `title`             | text                                                                                                                                    |
| 2     | `description`       | textarea                                                                                                                                |
| 3     | `primary_agency`    | page chooser, mandatory                                                                                                                 |
| 4     | `data_dashboard`    | SINGLE: `desktop_embed_url`, `mobile_embed_url`, `aspect_ratios` (desktop/mobile width+height), `alt_text`, `source_data`, `data_notes` |
| 5     | `introductory_text` | SINGLE: `title`, `text`                                                                                                                 |
| 6     | `body`              | MENU: **Documents**, **Data stories**, **Resources**                                                                                    |
| 7     | `custom_section`    | SINGLE: `title`, `text`                                                                                                                 |
| 8     | `topics`            | page chooser only                                                                                                                       |
| 9     | `partner_agencies`  | page chooser only                                                                                                                       |

Inside `body → Resources`, each entry's `content` is itself a MENU:
**Documents**, **Description**.

### Campaign — `sf.Campaign`

| Order | Field                              | Shape                                                                                          |
| ----- | ---------------------------------- | ---------------------------------------------------------------------------------------------- |
| 1     | `title`                            | text — note there is **no `description`** field on Campaign                                    |
| 2     | `primary_agency`                   | page chooser, mandatory                                                                        |
| 3     | `logo` / `background_header_image` | image choosers                                                                                 |
| 4     | `theme`                            | select                                                                                         |
| 5     | `spotlight_1`                      | SINGLE, spotlight shape                                                                        |
| 6     | `facts_title` + `fact_items`       | SINGLE: `image` + `title_and_text` (`title`, `text`)                                           |
| 7     | `additional_content`               | MENU: **Image with text**, **Accordion section**, **Resources**, **Video**, **Embed**          |
| 8     | `spotlight_2`                      | SINGLE, spotlight shape — Campaign also allows 2                                               |
| 9     | `about_campaign`                   | chooser                                                                                        |
| 10    | `partner_agencies`                 | page chooser only                                                                              |
| 11    | `related_links`                    | SINGLE: `link_to`, `url`, `page`, `link_text` — **the one Related that carries its own label** |
| 12    | `contact`                          | SINGLE: `address`, `phone`, `email`, `social_media_other`                                      |

`additional_content` block fields: Image with text = `image`, `title`,
`description`; Accordion section = `title`, `accordion_sidebar`,
`accordion_items` (nested: `title`, `body`); Resources = `title`,
`resource_sections`, `downloadable_resources`; Video = `title`, `description`,
`video_type`; Embed = `iframe_url`, `alt_text`, `aspect_ratio`.

### Report — `sf.Report`

| Order | Field              | Shape                                                                                       |
| ----- | ------------------ | ------------------------------------------------------------------------------------------- |
| 1     | `title`            | text                                                                                        |
| 2     | `date`             | text                                                                                        |
| 3     | `primary_agency`   | page chooser, mandatory                                                                     |
| 4     | `spotlight`        | SINGLE: `title`, `description`, `image`, `image_alignment`, `image_position`, `button_link` |
| 5     | `content`          | MENU: **Body** (one required rich-text field), **Table**                                    |
| 6     | `print_version`    | chooser                                                                                     |
| 7     | `partner_agencies` | page chooser only                                                                           |

`Table` block fields: `table_header_options`, `description` (labelled
**Caption**), `table` (the grid).

**Mockup mapping:** `date` ↔ `reportDate`; `print_version` ↔ `printVersionUrl`;
`content → Table` ↔ a section's `table[][]`; `content → Body` ↔ `paragraphs[]` /
`bullets[]`.

---

## The one rule most likely to be broken

**A card in a chooser-backed section publishes the destination page's own words,
not the words typed on the card.** This capture is direct evidence, not
inference: inserting an entry into Agency `services` and Agency `resources`
offers exactly two options — **SF.gov page** or **External link** — and the entry
carries no label and no description field of its own. `related`, `topics`,
`partner_agencies` and Transaction `related` are bare page choosers by the same
measurement.

That is the failure the review tool exists to catch, and this repo already
encodes it: `js/card-inheritance.js` classifies a section as `inherits`,
`title-only`, or `authored`, and `js/mockup/page-render.js` resolves every card
description through `cardDescription()` rather than printing `card.text`. See
"Card descriptions are inherited, not printed" in `AGENTS.md` / `CLAUDE.md` for
the three-bucket breakdown, and
`docs/source/hhvc-policy/2026-08-08-karl-card-inheritance-verification.md` for
the census behind the external-link exception.

The cookbook must state it in author-facing terms: **if the words matter, they
belong on the destination page.** Writing them on the card produces copy nobody
will ever see on SF.gov.

---

## Proposed chapter order

Ordered by what HHVC actually has to build, not by content-type alphabet.

1. **Before you start** — the gating facts above; who to ask for an Agency page;
   where the mockup tool fits (a review aid; it never writes to Karl and never
   publishes).
2. **Every page, every time** — title and description writing rules, primary
   agency, the Promote tab, the slug.
3. **Information pages** — the simplest recipe, and the one that teaches the
   three-block palette. Good first chapter because most HHVC pages are this type.
4. **Transaction pages** — including the two-level `what_to_do → Section →
section_specifics` walk-through, which is the hardest structure in the set.
5. **Resource Collection pages.**
6. **Report pages** — and the "tables live here only" rule.
7. **The Agency page** — a fill-in recipe, framed as a request to Digital
   Services.
8. **Campaign pages** — last; HHVC has the least need for it.
9. **Linking pages together** — the inheritance rule, Related, Topics, partner
   agencies, and how a mockup `card.target` becomes a real page chooser.
10. **Checking your work** — `bun run validate` and `bun run test` after editing
    `pages/*.js`, the Checks panel's scored rules, reading level, and the
    plain-language standards with their citations.

Each chapter written against one real HHVC page, so the reader follows a concrete
example rather than an abstract field list.

---

## What this capture settles

Corrections belong in `docs/wagtail-content-mapping.md`'s open-items list; they
are recorded here so the next session does not re-derive them.

- **Agency and Report now have full nested-block detail and raw field names.**
  That list previously carried only top-level fields for eight types, with raw
  Wagtail names explicitly not inspected, on the grounds that no `pages/*.js`
  used them. Both are used now — the HHVC front door is an Agency page and the
  fee schedule is a Report — so the gap mattered.
- **Transaction `what_to_do → Section → section_specifics` palette is measured**:
  Address, Callout, Document, Email, Button link, Phone number, Text.
- **Agency `services`/`resources` entries offer only SF.gov page / External link**
  — the same shape previously live-confirmed for Topic, now confirmed for Agency.
- **Report `content` offers Body and Table only**, re-confirming the
  tables-are-Report-only claim from the help center against the live form.
- **Campaign `related_links` is the one Related-style field carrying its own
  label** — measured shape `link_to`, `url`, `page`, `link_text`. Every other
  Related/Topics/partner field probed across the six types is a bare chooser.
  This corroborates the existing note that Campaign's Related is a distinct Page
  block rather than the inheriting kind.
- **Corpus check on the Information exclusions.** `pages/` currently holds six
  Information pages, not the eleven an earlier pass counted. None carries a
  `button` or a `table[][]`. One — `pages/what-happens-after-report.js` — carries
  `steps[]`, and that is fine: the repeatable `information_section` stream builds
  it as one Title-and-text block per step, which the page's own `karl` note
  already documents. The only unbuildable part is the numbered step _styling_.

Still open, unchanged by this pass: the `Related` content-type restriction
conflict (help center says four types, Campaign's live picker allows a fifth).
That needs Digital Services, not another probe.

---

## Housekeeping

- No CMS content was modified. Blocks were inserted into unsaved forms to read
  their fields; nothing was saved or published, and every form was left or
  reloaded.
- This file lives in `docs/`, which is **not** in `.prettierignore` — run
  `bun run format` before committing, or `format:check` fails CI.

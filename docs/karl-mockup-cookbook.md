# The HHVC mockup cookbook

**How to build a page mockup, section by section, so it matches what Karl can
actually publish.**

Karl layouts here were read from the **live logged-in Karl admin on
2026-08-14**, one representative page per content type. The capture method,
the page IDs, and what it settled are in
`docs/karl-mockup-cookbook-plan-2026-08-14.md`. Deeper background lives in
`docs/source/hhvc-policy/karl-content-type-field-reference.md` and
`docs/wagtail-content-mapping.md`; this file is the procedure, those are the
references.

**Who this is for.** Anyone on the HHVC team writing or revising a page mockup
in this tool. You do not need to know Wagtail. You do need to know that a
mockup is a **proposal**, not a publication: nothing in this repo writes to
Karl, and approving a mockup is not approving publication.

**Why the Karl layout matters when you are only writing a mockup.** A mockup
that cannot be built is worse than no mockup, because a manager spends real
judgement approving copy that will never appear. Every recipe below therefore
pairs a Karl field with the mockup shape that stands for it.

---

## Chapter 1 — Before you start

**What you actually edit.** One file per page under `pages/`, named after the
page. Copy the nearest existing page of the same content type and change it;
that is faster and safer than writing one from scratch, and it keeps the house
voice. A new file needs two more edits or the page silently disappears:

1. `import '../pages/<your-file>.js'` in `js/core/page-data.js`
2. a `[pageKey, menuLabel]` entry in that file's `order` array

`bun run validate` fails if you forget the import, so you will find out
immediately rather than after review.

**There is also an in-browser "add page" feature** — the Add and Delete buttons
in the sidebar, directly under the page picker, with the running list of what
you added or deleted under Help → "Pages added and deleted". It lives in your
browser only and never writes to `pages/`. Use it to try an idea; use a file
for anything a manager will review.

**Four facts about Karl that change what you should write.**

- **You cannot create an Agency page yourself.** Digital Services must create
  that content type. The HHVC Agency page is the front door of the section, so
  its mockup is a request-and-fill exercise, not a build-it-yourself one.
- **Every non-Agency page needs a Primary agency.** Karl makes it mandatory
  on all other seven content types, and the agency name renders under the title
  and description on SF.gov. One page, one primary agency.
- **The Karl editor has three tabs: Content, Promote, and Settings.** Everything
  SEO — the URL slug, the search title, the search description — is on Promote.
  (Settings houses publishing controls like go-live/expiry dates, not page
  content).
- **A "+" button that opens no menu is not broken.** About half of Karl's
  repeatable fields hold exactly one kind of block and add it on click. Each
  recipe below says which behave that way.

---

## Chapter 2 — Every page, every time

### The page-level fields

Required on every mockup — `bun run validate` fails without them:

| Field      | What it is                                       | Karl equivalent                  |
| ---------- | ------------------------------------------------ | -------------------------------- |
| `slug`     | the intended SF.gov URL                          | Promote → `slug`                 |
| `type`     | the Karl content type, spelled as Karl spells it | the page type you choose         |
| `title`    | the public page title                            | Content → `title`                |
| `summary`  | the description under the title                  | Content → `description`          |
| `audience` | who the page is for (reviewer aid)               | none — this is ours              |
| `reading`  | the target reading grade                         | none — SF.gov standard, not Karl |

Common optional fields: `seoTitle` (Promote → `seo_title`), `metaDescription`
(Promote → `search_description`), `editorNote` (a note to reviewers, never
published), `editorStatus` (`needs-review` / `blocked` / `placeholder`),
`whatToKnow`, `contact`, `spotlight`, `partnerAgencies`, `primaryCta`,
`topicTag`, `reportDate`, `printVersionUrl`.

**Two Karl fields have no mockup field that renders.** `Primary agency` is
always HHVC, so nothing carries it. Karl's `topics` chooser is a placement
decision rather than page content; the schema does have a `topicTag` string and
three pages set it (`'Agency: Healthy Housing and Vector Control'`), but nothing
in `js/` renders it today — so put anything a builder needs to know about
placement in a `karl` note rather than relying on that field to show up.

### Writing the title and summary

Karl's own help text is the rule: a title is _"descriptive, short, and in
sentence case"_; a description _"should start with key words and help the user
decide to read further."_ Copy is plain-language, roughly Grade 6, written for
tenants. The Checks panel scores both, and `js/standards/plain-language.js` cites the
standards manual section behind each failure.

### The `karl` note is not a comment — it decides what renders

**Read this before writing any section.** Every section carries a required
`karl` string describing which Karl block it maps to. It is content, not
commentary: `js/core/card-inheritance.js` reads the wording of that string to decide
whether a section's cards show their own text, only their title, or the
destination page's title and summary.

The classifier checks three patterns, in this order — first match wins:

| Order | If your `karl` note contains                                             | The mockup renders                            | Use it for                                        |
| ----- | ------------------------------------------------------------------------ | --------------------------------------------- | ------------------------------------------------- |
| 1     | `table block` or `title and text`                                        | the card's own `title` and `text`             | Table blocks, Title-and-text blocks               |
| 2     | `related field`, `related panel`, `related_links`, or `resource section` | the destination's title, **and nothing else** | Related panels, a Resource Collection's Resources |
| 3     | `services subsection`, `resources subsection`, or `page chooser`         | the destination's title **and its summary**   | Agency Services/Resources, generic page choosers  |
| —     | none of the above                                                        | the card's own `title` and `text`             | the default, and the risky one — see below        |

**A note matching none of the three patterns classifies as `unknown`, and an
unknown section renders the card's own text** — the same as an authored block.
That default is permissive on purpose (a Table block must never be blanked), but
it means a chooser-backed section with a vaguely worded note quietly shows copy
Karl will drop. Write one of the phrases above.

**Get the phrase right or the mockup lies to the reviewer.** A Related section
whose note says only "page chooser" falls to rule 3 and prints a description
Karl will never render. That is exactly the mistake this tool exists to catch,
so the note wording is worth a second look every time.

Beyond that one contract, write `karl` notes as instructions to whoever builds
the page in Karl — "Maps to an Information section → Title and text block:
Title = this heading, Text = the two paragraphs below" — and keep open
questions for the client team in them. They render to reviewers as Karl tags.

### The two section markers

Almost every section carries `kind`, and some also carry `component`:

- **`kind: 'body'`** — the section is page copy. Used 104 times in the corpus.
- **`kind: 'placement'`** — the section is a placement decision (Related
  panels, partner agencies), not copy to approve. Used 32 times.
- **`component`** — add it only when the section maps to a specific Karl
  component that renders differently: `body`, `services`, `resources`,
  `related`, `contact`, `spotlight`, `what-to-do`, `supporting`, `intro`,
  `top-facts`. Ten files use it; the rest need only `kind`.

---

## Chapter 3 — Information pages

**Worked example: `pages/hhvc-inspection-scope.js`.** Six Information pages in
the corpus; this is the type to reach for when the page explains something and
the reader is not being asked to _do_ something.

### The Karl form, top to bottom

| Field                 | How to add it                                    |
| --------------------- | ------------------------------------------------ |
| `title`               | text                                             |
| `description`         | textarea                                         |
| `primary_agency`      | page chooser, mandatory                          |
| `part_of`             | page chooser only — no menu                      |
| `information_section` | MENU: **Title and text**, **Callout**, **Image** |
| `partner_agencies`    | page chooser only                                |
| `topics`              | page chooser only                                |
| `related`             | page chooser only                                |

### The recipe

`information_section` is repeatable, so **one mockup section = one Title and
text block**. The heading becomes the block's Title; paragraphs and bullets
become its Text.

```js
{
  heading: 'Use this page before you report',
  karl: 'Maps to an "Information section" → Title and text block: Title = this heading, Text = the two paragraphs plus the bulleted list below (bullets render as a bulleted list inside the same rich text field).',
  kind: 'body',
  paragraphs: ['...'],
  bullets: ['...'],
}
```

A callout is its own block, so a section may carry `callout` alongside its
copy:

```js
callout: {
  text: 'Report an active problem through 311.',
  variant: 'info',
}
```

### Traps

- **Three block types is the whole body.** Title and text, Callout, Image. If
  the content will not fit one of those, it does not belong on an Information
  page.
- **No button — and the tool will not stop you.** `button`/`buttonUrl` are
  schema-legal on any section or step, so validate passes either way. This is a
  fact about Karl, not about the mockup: buttons exist on a Transaction's
  call-to-action and on Agency/Campaign/Report spotlights, and an Information
  page has nowhere to put one. None of the six Information pages carries one;
  keep it that way rather than trusting a green validate.
- **No table.** Tables are a Report-only block. Convert tabular content to a
  bulleted list — `pages/hhvc-inspection-scope.js` does this and says so in its
  `karl` note.
- **`steps[]` is fine, its numbering is not.** The stream is repeatable, so a
  step sequence builds as one Title-and-text block per step.
  `pages/what-happens-after-report.js` does exactly that. What Karl has no
  equivalent for is the numbered, visually sequenced presentation — flag that
  as a presentation gap for Digital Services rather than rewriting the content
  as a Transaction.

---

## Chapter 4 — Transaction pages

**Worked example: `pages/report-rats-mice-four-legged-problems.js`.** Thirteen
Transaction pages in the corpus — the type HHVC builds most. Use it when the
reader has to _do_ something: report, pay, request, look up.

### The Karl form, top to bottom

| Field                    | How to add it                                                                  |
| ------------------------ | ------------------------------------------------------------------------------ |
| `title`                  | text                                                                           |
| `description`            | textarea                                                                       |
| `primary_agency`         | page chooser, mandatory                                                        |
| `cost`                   | single block: `cost`, `flat_fee`, `range`, `minimum`, `maximum`, `description` |
| `things_to_know`         | single block: `title`, `text` — repeatable                                     |
| `what_to_do`             | MENU: **Callout**, **Section**                                                 |
| `special_cases`          | text — leave blank and the "Special cases" heading still shows                 |
| `supporting_information` | single block: `title`, `text`                                                  |
| `custom_section`         | single block: `title`, `text`                                                  |
| `good_for_community`     | single block: `title`, `text`                                                  |
| `related`                | page chooser only                                                              |
| `get_help`               | MENU: **Address**, **Email**, **Phone number**, **Additional info**            |
| `partner_agencies`       | page chooser only                                                              |
| `hide_on_topic_pages`    | checkbox — hides the page from "More services" on topic pages                  |
| `topics`                 | page chooser only                                                              |

### Steps live two levels down

`what_to_do → Section` is the only place a step sequence belongs, and it nests:

- **Section** = `section_title` + `section_specifics`
- **`section_specifics`** MENU: **Address**, **Callout**, **Document**,
  **Email**, **Button link**, **Phone number**, **Text**

That palette is the entire vocabulary of a step's body. A step needing a table
or an image cannot be built as drawn.

```js
{
  heading: 'What to do',
  karl: 'Maps to the "What to do" field → Section block: Section title = this heading; each step below is the Section specifics stream (Text for the paragraphs, Button link for the CTA).',
  kind: 'body',
  steps: [
    {
      title: 'Check what HHVC can inspect',
      text: ['...'],
      bullets: ['...'],
      button: 'Report through 311',
      buttonUrl: 'https://sf311.org',
      karl: 'Section specifics → Text block, then a Button link block for the CTA.',
    },
  ],
}
```

### Things to know, and the `cost` trap

Karl's `things_to_know` is a **repeatable** stream of `title` + `text` blocks.
The mockup's `whatToKnow` is one page-level object:

```js
whatToKnow: {
  cost: 'Free',
  thingsToKnow: [{ label: 'Who can report', text: '...' }],
  items: ['...'],
}
```

**Each labelled entry becomes its own `things_to_know` block** — pasting the
whole box into one block loses the per-entry headings SF.gov renders. And
**`cost` does not belong in a `things_to_know` block at all**: Karl has a
separate `cost` field with its own flat-fee/range structure.

### Supporting information renders as an accordion

`component: 'supporting'` is the collapsible Supporting information block. Two
switches matter:

- `open: true` renders it expanded on load (the report pages' "While you wait"
  tips use this).
- `flat: true` renders it as Karl's **Custom section** instead — a plain
  heading and text with no toggle.

### Traps

- **`get_help` is contact blocks, not free text.** Address, Email, Phone
  number, Additional info. Map it with `component: 'contact'`.
- **`related` is a bare page chooser.** See Chapter 10 — no card text survives.
- **One button per page** is the editorial rule. A mockup with several is worth
  a note to the client team.

---

## Chapter 5 — Resource Collection pages

**Worked example: `pages/healthy-housing-vermin-resources.js`.** Three in the
corpus. Use it when the page is a signposted list of other pages, documents and
records rather than prose.

### The Karl form, top to bottom

| Field               | How to add it                                                                    |
| ------------------- | -------------------------------------------------------------------------------- |
| `title`             | text                                                                             |
| `description`       | textarea                                                                         |
| `primary_agency`    | page chooser, mandatory                                                          |
| `data_dashboard`    | single block: embed URLs, aspect ratios, `alt_text`, `source_data`, `data_notes` |
| `introductory_text` | single block: `title`, `text`                                                    |
| `body`              | MENU: **Documents**, **Data stories**, **Resources**                             |
| `custom_section`    | single block: `title`, `text`                                                    |
| `topics`            | page chooser only                                                                |
| `partner_agencies`  | page chooser only                                                                |

Inside `body → Resources`, each entry's own `content` is another menu:
**Documents** or **Description**.

### The recipe

Each grouped list of links is one `body → Resources` block: the heading becomes
its Title, and every card becomes one entry.

```js
{
  heading: 'If you rent',
  karl: 'Maps to Body → Resource section: Title = this heading; each card below is one entry (SF.gov page or External link). Internal entries render the destination page title only.',
  kind: 'body',
  cards: [{ title: 'Tenant rights when reporting housing conditions', target: 'tenantRights' }],
}
```

### Traps

- **A Resource section shows the title and nothing else** for an internal
  SF.gov page. Write `resource section` in the `karl` note so the mockup drops
  the description too — see Chapter 10.
- **An External link entry is different**: it carries its own title, URL and
  description, because there is no destination page to inherit from.

---

## Chapter 6 — Report pages

**Worked example: `pages/health-code-article-11.js`.** One in the corpus, and
it is the reason the type is here: **Report is the only content type with a
table block.**

### The Karl form, top to bottom

| Field              | How to add it                                                                                     |
| ------------------ | ------------------------------------------------------------------------------------------------- |
| `title`            | text                                                                                              |
| `date`             | text → mockup `reportDate`                                                                        |
| `primary_agency`   | page chooser, mandatory                                                                           |
| `spotlight`        | single block: `title`, `description`, `image`, `image_alignment`, `image_position`, `button_link` |
| `content`          | MENU: **Body** (one required rich-text field), **Table**                                          |
| `print_version`    | chooser → mockup `printVersionUrl`                                                                |
| `partner_agencies` | page chooser only                                                                                 |

`Table` block fields: `table_header_options`, `description` (labelled
**Caption**), and the grid itself.

### The recipe

```js
{
  heading: 'Article 11 sections at a glance',
  karl: 'Maps to Content → Table block: Caption = this heading, header row first. Report is the only content type with a table block.',
  kind: 'body',
  table: [
    ['Section', 'What it covers'],
    ['Sec. 581', 'Garbage and refuse'],
  ],
}
```

The first row is the header row. Prose sections between tables are
`content → Body` blocks and take `paragraphs`/`bullets` as usual.

### Traps

- **A Table section's cards are authored.** If a table section also carries
  `cards`, say `table block` in the `karl` note so the mockup keeps their text —
  rule 1 in Chapter 2. Getting this wrong blanks a table's cards.
- **`reportDate` is a display date**, not a publication gate.

---

## Chapter 7 — The Agency page

**Worked example: `pages/agency-service-grouping.js`** — the HHVC front door.
One in the corpus. **Digital Services has to create the real page**, so treat
this mockup as the brief you hand them.

### The Karl form, in editor order

| Field                           | How to add it                                                                                               |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `title`, `description`          | text, textarea                                                                                              |
| `logo`, `main_image`            | image choosers — logo min 100×100 squarish; main image min 400px tall, 16:5                                 |
| `alert`                         | single block: `alert_style`, `title`, `description`, `start_date`, `expiration_date`                        |
| `alert_agency_wide`             | checkbox — repeats the alert on every page with this primary agency                                         |
| `quicklinks`                    | single block: link target, `title`, `description`                                                           |
| `meeting_information`           | MENU: **Address**, **Things to know**                                                                       |
| `services_title` + `services`   | single block: a Title plus a list; each entry is **SF.gov page** or **External link**                       |
| `spotlight_1`, `spotlight_2`    | single block: `title`, `description`, `image`, `image_alignment`, `image_position`, `button_link` — up to 2 |
| `highlights`                    | single block holding **two** items, each an image, a link and a description                                 |
| `resources_title` + `resources` | same shape as `services`                                                                                    |
| `about_description`             | chooser — points at the About us page                                                                       |
| `call_to_action`                | single block: `title`, `description`, `button_link` → mockup `primaryCta`                                   |
| `divisions_subcommittees`       | single block: section title + agencies                                                                      |
| `partner_agencies`              | page chooser only                                                                                           |
| `people`                        | single block: `title`, `description`, profiles (`profile_page`, `role`)                                     |
| `public_records`                | MENU: **Link**, **Email**, **Phone**                                                                        |
| `archive_url` / `archive_date`  | the date is **required** if a URL is given                                                                  |
| `contact`                       | single block: address, phone, email, social — phone carries owner/extension/details                         |
| `topics`                        | page chooser only                                                                                           |

### The recipe

Services and Resources are the whole point of an Agency page, and both are
grouped lists of links:

```js
{
  heading: 'Get help with pests, mold, or trash',
  component: 'services',
  karl: 'Maps to the Agency Services subsection: Title = this heading; each card is a page chooser entry, so the destination page title and summary publish, not this card text.',
  kind: 'body',
  cards: [{ title: 'Report rats, mice, and other four-legged problems', target: 'rodentsReport' }],
}
```

### Traps

- **Services and Resources entries have no text of their own.** Measured on the
  live form: adding an entry offers **SF.gov page** or **External link**, and
  nothing else. Whatever a card says here, SF.gov prints the destination page's
  title and summary. **If the words matter, fix the destination page.**
- **Two spotlights maximum.**
- **`alert_agency_wide` is louder than it looks** — it puts the alert on every
  page whose primary agency is HHVC.

---

## Chapter 8 — Campaign pages

**Worked examples: `pages/mosquito-education-workshop.js` and
`pages/integrated-pest-management-education.js`.** Two in the corpus, so this
chapter is deliberately thin. Use Campaign for time-bound outreach, not for
standing service content.

| Field                             | How to add it                                                                             |
| --------------------------------- | ----------------------------------------------------------------------------------------- |
| `title`                           | text — **Campaign has no `description` field**                                            |
| `primary_agency`                  | page chooser, mandatory                                                                   |
| `logo`, `background_header_image` | image choosers                                                                            |
| `theme`                           | select                                                                                    |
| `spotlight_1`, `spotlight_2`      | spotlight blocks, up to 2                                                                 |
| `facts_title` + `fact_items`      | single block: `image` + a title/text pair → mockup `component: 'top-facts'` and `facts[]` |
| `additional_content`              | MENU: **Image with text**, **Accordion section**, **Resources**, **Video**, **Embed**     |
| `about_campaign`                  | chooser                                                                                   |
| `partner_agencies`                | page chooser only                                                                         |
| `related_links`                   | single block: link target + **`link_text`**                                               |
| `contact`                         | address, phone, email, social                                                             |

`additional_content` block fields: Image with text = `image`, `title`,
`description`; Accordion section = `title`, `accordion_sidebar`,
`accordion_items` (each `title` + `body`); Resources = `title`,
`resource_sections`, `downloadable_resources`; Video = `title`, `description`,
`video_type`; Embed = `iframe_url`, `alt_text`, `aspect_ratio`.

### Traps

- **Campaign's Related is the exception.** `related_links` carries its own
  `link_text`, so a Campaign related card's label is authored, not inherited —
  unlike every other Related field in Karl. Say `related_links` in the `karl`
  note.
- **No description field** means the summary you write in the mockup has no
  home on the real page. Note it rather than silently dropping it.

---

## Chapter 9 — Topic and About us

Both are single-page types in the corpus, so this chapter is a field list and
its traps.

### Topic — `pages/healthy-housing-conditions-topic.js`

Live layout: `title`, `primary_agency`, `description`, `top_level_topic`,
`content_fields`, `partner_agencies`.

`content_fields` MENU: **Child topics**, **Content top**, **Services**,
**Spotlight**, **Resources**, **Content**. A `Content` block is `title` +
`section_content`, and `section_content` MENU: **Button link**, **Phone
number**, **Resources**, **Spotlight**, **Timeline**, **Text**.

Topic's Services and Resources have the same shape as Agency's — a Title plus a
list of **SF.gov page** / **External link** entries, no per-entry text.

**Worth knowing:** HHVC exists on SF.gov today as a Topic page
(`api.sf.gov/admin/pages/97543/`). The redesign moves it to an Agency page, and
the mockup key `pestsTopic` is a leftover from that era — the name is kept
deliberately so review state and validation invariants stay stable. Do not
"fix" it.

### About us — `pages/about-hhvc-team.js`

Live layout: `title`, `primary_agency`, `about_info` (single block: `title`,
`text`), `resources` (MENU: **Resources section**, **Downloadable files**).

**Two things break the pattern every other type follows:** About us has **no
`description` field** on Content, and **no `tags` field** on Promote. An About
us page is reached from the Agency page's `about_description` chooser.

---

## Chapter 10 — Linking pages together

### Cards point at page keys, not URLs

```js
cards: [{ title: 'Tenant rights when reporting housing conditions', target: 'tenantRights' }]
```

`target` is the mockup page key — the `window.HHVC_PAGES['...']` name, not a
slug. `bun run validate` fails on a target that resolves to nothing, which is
how a broken link gets caught before review rather than after.

For a link that leaves SF.gov, use `url` instead of `target`.

### Inline links inside copy

`[label](pageKey)` inside a paragraph, bullet, table cell or callout. The
target must be a real page key, an `http(s)` URL, or the inert `#` sentinel.
`mailto:` and root-relative paths are deliberately rejected — they render as
dead buttons.

### The inheritance rule, one more time

This is the single most consequential thing in the cookbook.

| Karl block                                       | What SF.gov prints                | So the card's own text is |
| ------------------------------------------------ | --------------------------------- | ------------------------- |
| Agency/Topic Services or Resources subsection    | destination title **and summary** | never shown               |
| Related panel; Resource Collection's Resources   | destination title only            | never shown               |
| Table block; Title-and-text block                | exactly what you wrote            | shown                     |
| Campaign `related_links`                         | your `link_text`                  | shown                     |
| An **External link** entry in an inheriting list | your title and description        | shown                     |

The mockup enforces this by resolving every card description through one
helper, so you cannot see text on screen that Karl would drop. The `karl` note
wording is what selects the rule — Chapter 2 has the phrase table.

**If the words on a card matter, they belong on the destination page.**

### Marking a claim you cannot source

```js
bullets: [
  {
    text: 'Structural leaks are routed to the Department of Building Inspection.',
    unverified: true,
    unverifiedReason:
      'Citation traces only to tier-3 material — source it or soften before publication.',
  },
]
```

This renders an "Unverified" pill and is counted in the validation summary.
Use it instead of quietly publishing a claim you are unsure of.

---

## Chapter 11 — Checking your work

**After editing anything under `pages/`, run both:**

```bash
bun run validate   # schema + the business invariants below
bun run test       # the unit suite
```

`bun run validate` enforces more than field shapes:

- every `card.target`, every `buttonTarget`, and every inline `[label](key)`
  link must resolve to a real page key, an `http(s)` URL, or `#`
- **a `paragraphs[]` or a step's `text[]` holding three or more entries is a
  hard failure** — the check counts entries and does not look at what they say,
  so three ordinary paragraphs fail exactly like three list items. Split the
  section or move the items to `bullets[]`.
- no image may load from another host — the tool has to work offline
- the Agency page's copy must not mention out-of-scope terms (`plumbing`,
  `dbi`, `roof leak`, `sewer`, `permit issue`, `construction defect`); HHVC
  scope is Article 11 only

**Then look at the page in the tool.** Open the mockup, and check:

- **Page checks** — the scored rules, failures listed first. Page type,
  Audience and Reading target are shown but not scored, because validation
  already guarantees them.
- **Computed reading level** — this one does fail, and it is the one that tells
  you whether the copy actually hits its target.
- **Content standards** — errors cite the standards manual section; warnings
  are advisory.
- **Karl tags** — toggle them on and read your own `karl` notes back. If a note
  does not tell a Karl builder exactly which block to add, rewrite it.

**Before saying it is done:** if you changed anything about how reviews are
imported or exported, export the review data, re-import it, and confirm
existing decisions survive. That path has destroyed reviews before.

---

## Appendix — which content type?

| The page…                                                 | Content type        |
| --------------------------------------------------------- | ------------------- |
| is the front door for the whole program                   | Agency              |
| asks the reader to do something (report, pay, look up)    | Transaction         |
| explains something with no action attached                | Information         |
| is a signposted list of other pages, records or documents | Resource Collection |
| is a reference document, especially one with tables       | Report              |
| is time-bound outreach                                    | Campaign            |
| groups a subject area across departments                  | Topic               |
| describes the team behind the program                     | About us            |

When two fit, pick the one whose Karl form holds your content: a page with a
table is a Report, a page with steps and a button is a Transaction, and a page
with neither is usually Information.

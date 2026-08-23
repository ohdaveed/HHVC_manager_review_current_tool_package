# Karl CMS export / field map — the content types this mockup actually uses

**What this is:** one field map per Karl content type that a `pages/*.js` file currently declares,
written to be the canonical machine-facing source for anything that has to name a Karl destination —
including the structured Karl-guide registry called for by the CMS-guide redesign plan supplied
2026-08-15 (no plan file exists under `docs/superpowers/plans/` for it at the time of writing).
It answers six questions per field, and refuses to answer any of them by guessing:

1. the exact live UI label and the navigation path that reaches it,
2. the block name and the raw Wagtail field name,
3. required versus optional,
4. repeatable versus single-use,
5. how an internal SF.gov page link is represented versus an external URL,
6. what is still unresolved, and what earlier docs got wrong.

**What this is not:** a re-verification. Every row is sourced from a dated capture — no field here
was invented to fill a hole. Where a hole exists it is written as a hole, with a `U#` identifier,
because the consuming plan's acceptance criteria say unresolved mappings must be explicit rather
than guessed. Compiled 2026-08-15 against the page corpus at that date.

**The eight-type scoping is the point, and it is census-driven** — `build_scripts/load-pages.js`
decides what belongs here, not a judgement call. A second section, "Types not yet in use", carries a
forward-looking inventory of the other nine Karl types for when more pages are added; it is
deliberately shallower and maps to nothing that exists today.

---

## Scope — the eight types currently in use

Measured from `pages/*.js` via `build_scripts/load-pages.js`, 2026-08-15. 29 pages, 8 distinct
`type` values. Types Karl offers but this mockup does not use (`Data story`, `Document Collection
Search`, `Event`, `Form`, `Location`, `Meeting`, `News`, `Profile`, `Step by step`) are out of
scope by definition and are not mapped here.

| `type` value          | Pages | Sections | Steps | Page keys                                                                                                                                                                                                                                                         | Nested-block evidence |
| --------------------- | ----- | -------- | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| `Transaction`         | 14    | 47       | 34    | `inspectorLookup`, `inspectionPrepInitial`, `inspectionPrepFollowup`, `findRecords`, `findHotelRecords`, `findViolations`, `payFee`, `publicRecords`, `insectsReport`, `filthReport`, `rodentsReport`, `sroHotelReport`, `noticeOfViolation`, `tenantNoticeSteps` | **E1** — full         |
| `Information`         | 6     | 37       | 5     | `article11Compliance`, `scopeInfo`, `ownerGuidance`, `mosquitoControl`, `tenantRights`, `afterReport`                                                                                                                                                             | **E1** — full         |
| `Resource Collection` | 3     | 14       | 0     | `verminResources`, `recordsHub`, `ownerHub`                                                                                                                                                                                                                       | **E1** — full         |
| `Campaign`            | 2     | 14       | 0     | `ipmEducation`, `mosquitoWorkshop`                                                                                                                                                                                                                                | **E1** — full         |
| `Topic`               | 1     | 5        | 0     | `healthyHousingTopic`                                                                                                                                                                                                                                             | **E1** — full         |
| `Agency`              | 1     | 6        | 0     | `pestsTopic`                                                                                                                                                                                                                                                      | **E1** — full         |
| `About us`            | 1     | 4        | 0     | `aboutHhvcTeam`                                                                                                                                                                                                                                                   | **E1** — full         |
| `Report`              | 1     | 9        | 0     | `article11Guide`                                                                                                                                                                                                                                                  | **E1** — full         |

**All eight are E1 as of 2026-08-15.** Five were captured from the live add-page form in July;
`Agency`, `About us` and `Report` were only top-level label lists until a read-only admin session on
2026-08-15 captured their panel trees, raw field names, required markers and StreamField choosers
too. That session also re-read the other five, which is where `O11`–`O13` came from.

**What that leaves genuinely open is no longer "we haven't looked."** Every remaining `U#` falls
into one of three cases, and they want different things:

- **A mockup construct Karl has no field for** (`U1`–`U4`, `U6`). No capture will produce one;
  these need a decision from Digital Services about what to do instead.
- **A content decision** (`U5`). Its source conflict is settled — the Karl half was answered by
  the 2026-08-15 capture — and what remains is an editorial call, not a question about the CMS.
- **A question about published output** (`U12`, `U16`). Their source conflict is settled by the
  2026-08-23 precedence reversal, and settled the other way: the Help Center governs both, so
  Related's four-type restriction and the one-Spotlight cap are what to build to, and the form's
  permissiveness is a gap in the form. What each still asks is a question about PUBLISHED OUTPUT:
  whether a Related entry of a fifth type actually publishes, and whether a Topic template renders
  a second Spotlight. Those need E4 — not a decision, and not another form capture.

---

## Evidence tiers

Every row carries one. They are not interchangeable, and blending them is the failure mode this
repo's documentation culture exists to prevent.

| Tier   | Meaning                                                                                                                                                                                                                                                                                                    | Source                                                                                                  |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| **E1** | Observed directly in Karl's live "New: `<Type>`" add-page form, every "+" menu opened. The only source for raw Wagtail field names, panel order, and fields the Help Center does not discuss. **Subordinate to E3 wherever both describe the same field** — the form is more permissive than the guidance. | `docs/wagtail-content-mapping.md` (2026-07-05), `docs/karl-live-admin-verification-2026-07-06.md`       |
| **E2** | Observed in the live admin form, **top-level fields only** — labels are real; block internals, required markers and repeatability were not captured.                                                                                                                                                       | `docs/karl-live-admin-verification-2026-07-06.md` (2026-07-06)                                          |
| **E3** | **Karl Editor Help Center documentation — the source of truth for how a page should be built.** Shows labels, behaviour and editorial rules; never raw field names. Where a parent page is stale against its own child pages, the child wins (see `O9`).                                                   | Swept directly 2026-08-15 (see Sources); earlier pass in `docs/karl-help-center-research-2026-07-06.md` |
| **E4** | Measured from live rendered sf.gov pages — what a component actually publishes, which is a different question from what its editor form is called.                                                                                                                                                         | `docs/source/hhvc-policy/2026-08-08-karl-card-inheritance-verification.md`                              |
| **U**  | Unresolved. Named in the register at the end; never rendered as a path.                                                                                                                                                                                                                                    | —                                                                                                       |

Raw Wagtail field names exist only where a tier-E1 pass inspected them. A blank raw-name cell means
"not inspected", never "has none".

### Precedence, revised 2026-08-23: the Help Center is the source of truth

**Where sources disagree about how a page should be built, the Karl Editor Help Center (E3) wins**
— over the live admin capture (E1), over the older repo docs, and over the `karl` notes in
`pages/*.js`. This reverses the rule recorded here on 2026-08-15, and the reversal is a directive,
not a new measurement: nothing about the captures changed.

**The Help Center wins where it speaks; its silence is not a claim.** It is an editor guide rather
than a field inventory. It never publishes raw Wagtail field names, never records required markers
at the schema level, and lists fields selectively — Transaction's page omits `special_cases`,
`hide_on_topic_pages` and `redirect_url`, none of which it means to deny. So E1 remains the only
source for raw names, panel order, and any field the guide does not discuss. Where both describe
the same field, the Help Center governs.

**A practical consequence worth stating plainly: the form is more permissive than the guidance, and
the guidance is now the rule.** E1 measured that Campaign accepts a second Spotlight in
`spotlight_1`, that `things_to_know` has no schema maximum, and that `Button link` carries
`maxlength="255"`. All three are true of the form and none of them licenses the behaviour. Follow
the documented caps: the Spotlight table below, two Things-to-know items, 25-character buttons.

**E4 still answers a different question and is not superseded.** E1 says what fields the editor
form has; E3 says how a page should be built; E4 says what a published page actually renders. The
card-inheritance findings rest on E4 and stand — no guidance document can tell you what a template
outputs.

---

## Navigation paths

Two segments, and they have different evidential weight.

**Reaching the form** — `Karl admin → Pages → [parent page] → Add child page → "<Type>"`, starting
from `https://api.sf.gov/sso/login?next=/admin/`. The endpoints of that path are recorded: the
type chooser is labelled **"Create a page"** and lists all 17 Karl types, and the resulting form is
headed **"New: `<Type>`"**. The intermediate "Add child page" control is standard Wagtail chrome and
is _not_ separately recorded in either verification log — treat it as the one inferred step in an
otherwise observed path.

**The direct URL, measured 2026-08-15.** Every type's add-page form is
`https://api.sf.gov/admin/pages/add/sf/<model>/<parent_id>/`, where `sf` is the Django app label and
`<model>` is the lowercased model name. `2` is the site root. This is faster and less ambiguous than
the chooser, and it is what the capture below used:

| Type     | `<model>`  | Type                | `<model>`            | Type         | `<model>`    |
| -------- | ---------- | ------------------- | -------------------- | ------------ | ------------ |
| Agency   | `agency`   | Information         | `information`        | Report       | `report`     |
| About us | `about`    | Resource Collection | `resourcecollection` | Topic        | `topic`      |
| Campaign | `campaign` | Transaction         | `transaction`        | Step by step | `stepbystep` |

**One consequence already applied to the corpus.** The capture showed that 27 `karl` notes across 15
pages described `Step by step`'s Step block while sitting on Transaction and Information pages. Those
notes were rewritten onto `what_to_do -> Section` rather than the pages being retyped — see
"Step by step" under "Types not yet in use" for the evidence and the reason.

**Reaching the field** — everything after the form opens is recorded verbatim, and this is the part
an editor actually follows:

```text
New: <Type>  →  Content tab  →  <panel UI label>  →  [+]  →  <block name>  →  <field UI label>
```

**Every form is a three-tab `TabbedInterface`: Content, Promote, Settings.** The 2026-07-05 captures
recorded "a single Content tab, no Promote/Settings shown"; the panel tree says otherwise on all
eight types (`O12`). That matters because the Promote tab is where two mockup fields live —
see the next subsection.

A panel offering exactly one block type **auto-inserts it on "+" with no chooser popup**; a chooser
(`w-combobox`, `[role="option"]` entries) appears only where the panel genuinely offers more than
one. Confirmed again in this capture: Agency's `services` and About us's `about_info` inserted
silently, while Report's `content`, Topic's `content_fields` and Campaign's `additional_content` each
opened a list. "Click + then choose X" is wrong wherever no chooser appears.

### The Promote tab — where `seoTitle` and `metaDescription` actually go

Identical on all eight types, and it closes what was `U11`:

| Panel              | Raw field            | Required | Mockup source                                                                                              |
| ------------------ | -------------------- | -------- | ---------------------------------------------------------------------------------------------------------- |
| For search engines | `slug`               | **yes**  | `slug`                                                                                                     |
| For search engines | `seo_title`          | no       | `seoTitle`                                                                                                 |
| For search engines | `search_description` | no       | `metaDescription`                                                                                          |
| For site menus     | `show_in_menus`      | no       | —                                                                                                          |
| Tags               | `tags`               | no       | `topicTag` is _not_ this — it is unmapped metadata (stored values are Agency labels, not Topic references) |

The Settings tab carries `go_live_at` and `expire_at` (a `PublishingPanel`). Neither has a mockup
equivalent and neither is content.

---

## Cross-cutting conventions

These hold across every E1 type. Stating them once keeps them out of 200 table rows.

### Rich text is one standing spec

Every Draftail rich text field on every verified form shares one toolbar: **Bold, H3, H4, Bulleted
list, Numbered list, Blockquote, Line break, Document, Link — no H2** (with the exception of
Report's `Body`, where H2 is explicitly supported and auto-generates the table of contents). Confirmed
across Transaction's `cost` description, `things_to_know`, `what_to_do` Callout, `custom_section` and
`supporting_information`, and again across Information's `Text`/`Callout`. Treat it as universal
rather than re-verifying per field.

The `/` slash menu offers the same formatting plus a nested **Blocks** group (`Title and text`,
`Image`, `Callout` can be embedded _inside_ rich text, not only as top-level stream items) and an
**Actions** group (`Split block`). Live-confirmed on both Information and Transaction.

**The toolbar applies to "text" fields only, never to their paired "title" fields.** "Section
title", "Accordion title", "Custom section heading" and `things_to_know`'s "Title" are all plain
text with no toolbar. Do not infer rich text for a title from its sibling.

### Internal page links versus external URLs — the five distinct representations

This is requirement 5, and Karl does not have one answer. Five different shapes are in play, and
picking the wrong one is how a mockup card's description silently ceases to exist:

| #   | Shape                        | Where it appears                                                                                                                                                                 | Internal link                                    | External URL                          | Carries its own title/text?                                                                                                                                                      |
| --- | ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Bare page reference**      | `related` on Transaction and Information                                                                                                                                         | "Page \*" + "Choose a page" button, unrestricted | **Not possible** — page chooser only  | **No.** Title and link are pulled from the target page (E3)                                                                                                                      |
| 2   | **`Button link` block**      | Transaction `section_specifics`; Campaign/Topic/Agency/Report Spotlight; Topic `Content` section content                                                                         | radio `SF.gov page` → page chooser               | radio `External URL` → URL text field | "Link text" \* + "Screenreader label". **Link text cap: 25 characters (E3)** — the rule. The field's own `maxlength="255"` (E1) is a gap in the form, not permission — see `O14` |
| 3   | **`Resources` links list**   | Resource Collection `body → Resources`; Campaign `Additional content → Resources`; Topic `Services`/`Resources`; Agency `services`/`resources` subsections; About us `resources` | block type `SF.gov page`, unrestricted chooser   | block type `External link`            | **Split.** `SF.gov page` carries nothing; `External link` carries Title \*, URL \*, Description                                                                                  |
| 4   | **Campaign `related_links`** | Campaign `Related` only                                                                                                                                                          | radio `SF.gov page` → "Page" \* chooser          | radio `External URL` → URL field      | **Yes** — "Link text" \*. Materially different from shape 1                                                                                                                      |
| 5   | **Rich text Link tool**      | any Draftail field                                                                                                                                                               | "Internal link" (page tree)                      | "External link"; also Email and Phone | Label is the selected text                                                                                                                                                       |

Shape 5's four link types (Internal, External, Email, Phone) are live-confirmed on both Transaction
and Information. The Document icon is a _separate_ "Choose a document" modal, not a link type.

**Shape 1 is the recurring schema gap and the largest one by volume** — **67 cards across 19
pages** sit on a field that publishes a title and a link and nothing else, counting Transaction and
Information sections whose `karl` note names a Related field or panel. The figure moves with the cut
you take: 83 cards across 24 pages for every Related-naming section regardless of type, and 111
across 25 for the whole `title-only` bucket as `js/core/card-inheritance.js` classifies it. An earlier
draft said "roughly 34" without naming a cut, which is how a number ends up unfalsifiable — and the
spread between these three is why the cut has to travel with the figure. See "Card inheritance"
below, which is how the renderer already handles it.

### Fields that recur unchanged across types

| UI label              | Raw name                                   | Restriction                       | Repeatable | Appears on                                                                       |
| --------------------- | ------------------------------------------ | --------------------------------- | ---------- | -------------------------------------------------------------------------------- |
| Primary agency \*     | `primary_agency`                           | page chooser, `Agency` pages only | single     | Transaction, Information, Resource Collection, Campaign, Topic, About us, Report |
| Partner agencies      | `partner_agencies`                         | page chooser, `Agency` pages only | repeatable | Transaction, Information, Resource Collection, Campaign, Topic, Agency, Report   |
| Topics                | `topics`                                   | page chooser, `Topic` pages only  | repeatable | Transaction, Information, Resource Collection, Agency                            |
| Redirect this page to | `redirect_url` (Agency: `agency_redirect`) | plain text                        | single     | Transaction, Agency, News, Profile                                               |

Partner agencies helptext is identical wherever it appears: _"Add other close partner agencies,
divisions or subcommittees."_ Transaction's Topics field additionally carries a **"Hide on Topic
Pages"** checkbox (`hide_on_topic_pages`).

**"Redirect this page to" is inert everywhere, permanently.** The Help Center component page states
_"This component has been disabled in the CMS. Contact Digital Services for help redirecting
pages."_ It is not a save-state timing quirk. No mockup page uses it; never emit an instruction
pointing at it.

### Raw field names, all eight types, re-read 2026-08-15

Read from each form's own panel tree rather than from labels, so these are the strings a script
would address. Panel order is the form's order.

| Type                | Content-tab fields, in order                                                                                                                                                                                                                                    |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Transaction         | `title`, `description`, `primary_agency`, `cost`, `things_to_know`, `what_to_do`, `special_cases`, `supporting_information`, `custom_section`, `good_for_community`, `related`, `get_help`, `partner_agencies`, `hide_on_topic_pages`, `topics`, `redirect_url` |
| Information         | `title`, `description`, `primary_agency`, `part_of`, `information_section`, `partner_agencies`, `topics`, `related`                                                                                                                                             |
| Resource Collection | `title`, `description`, `primary_agency`, `data_dashboard`, `introductory_text`, `body`, `custom_section`, `topics`, `partner_agencies`                                                                                                                         |
| Campaign            | `title`, `primary_agency`, `logo`, `background_header_image`, `theme`, `spotlight_1`, `facts_title`, `fact_items`, `additional_content`, `spotlight_2`, `about_campaign`, `partner_agencies`, `related_links`, `contact`                                        |
| Topic               | `title`, `primary_agency`, `description`, `top_level_topic`, `content_fields`, `partner_agencies`                                                                                                                                                               |
| Agency              | see the Agency section — 26 panels                                                                                                                                                                                                                              |
| About us            | `title`, `primary_agency`, `about_info`, `resources`                                                                                                                                                                                                            |
| Report              | `title`, `date`, `primary_agency`, `spotlight`, `content`, `print_version`, `partner_agencies`                                                                                                                                                                  |

### Required fields are nearly uniform

Read off the rendered form for all eight types on 2026-08-15. **At page-level scalar fields, nearly every
type requires exactly `title`, `primary_agency` and `slug`** (along with `services_title` and
`resources_title` on Agency; Transaction's `cost` is optional per E3 — see the Transaction
section) — nothing else — with one exception:

- **Agency has no `primary_agency` at all** (it _is_ the agency), and instead additionally requires
  **`services_title`** and **`resources_title`**, the two section headings. Its required set is
  `title`, `services_title`, `resources_title`, `slug`.

`slug` sits on the Promote tab, so a page cannot be saved from the Content tab alone. And since the
mockup has no field for `primary_agency` (`U6`), **seven of the eight types cannot be created from
mockup data without one value supplied by hand.**

A panel label ending in `*` marks a required StreamField, which renders no named input until a block
is added — that is how Agency's **Public records\*** was caught. Absence from the required-input list
is only evidence for a field that actually renders an input.

### Three corrections this pass produced against the earlier captures

- **`special_cases` and `redirect_url` are the two Transaction names previously written as "not
  inspected"** (`U7` and the "Redirect this page to" note). Both closed.
- **Transaction's panel order is `supporting_information` _before_ `custom_section`**, not the
  reverse — `O13`.
- **`Topic` has no `related` field**, re-confirmed at E1. `healthyHousingTopic` renders a Related
  panel anyway (`U5`).

### Spotlight — one component, five host types, two different caps

The Spotlight block is shared, and the per-type **count limit** is the part a generated instruction
gets wrong. Documented 2026-08-15 (E3):

| Host type    | Spotlights allowed | Mockup usage today                                       |
| ------------ | ------------------ | -------------------------------------------------------- |
| **Agency**   | up to 2            | `pestsTopic` uses 0                                      |
| **Campaign** | up to 2            | `ipmEducation` and `mosquitoWorkshop` use exactly 2 each |
| **Report**   | **1**              | `article11Guide` uses 1 (page-level `spotlight`)         |
| **Topic**    | **1**              | `healthyHousingTopic` uses 1                             |
| Profile      | 1                  | type not in use                                          |

Fields: Spotlight title, Spotlight description, an image, a **full width** / **side by side**
(half width) choice — side by side additionally choosing left or right — and an **optional button**
(link shape 2). Full-width puts the text under the image; half-width embeds the image in the
spotlight's colour block. On most types the Spotlight sits at the top of the page and a second one
toward the middle.

**The documented caps are the rule, and the forms do not enforce them.** Campaign's `spotlight_1`
accepted **two** Spotlight blocks on its own with its add control still enabled, and Topic's
`content_fields` will take a second Spotlight (`U16`) — so a page can be built that exceeds the cap
and saves. Do not. Treat this table as the constraint and the form's permissiveness as a gap in the
form, exactly as with the 25-character button cap (`O14`).

---

## Transaction — E1, full block detail

14 pages, 47 sections, 34 steps. The heaviest-used type in the corpus.

**Path:** `New: Transaction → Content`. **A Transaction has named, purpose-specific panels — there
is no generic `sections[]`-style StreamField at the top level.** This is the correction that
invalidated the original guesswork in `wagtail-content-mapping.md`, and it applies to all five E1
types.

| Panel / field (UI label)                        | Raw name                 | Required                     | Repeatable                                          | Block type(s)                                                                                             | Mockup source                                                                                  |
| ----------------------------------------------- | ------------------------ | ---------------------------- | --------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Page title                                      | `title`                  | yes                          | single                                              | plain text                                                                                                | `title`                                                                                        |
| Description                                     | `description`            | not recorded                 | single                                              | textarea                                                                                                  | `summary`                                                                                      |
| Primary agency                                  | `primary_agency`         | **yes**                      | single                                              | page chooser → `Agency` only                                                                              | — (no mockup field; `U6`)                                                                      |
| Cost                                            | `cost`                   | no                           | **max 1 item**                                      | struct, auto-inserted, no chooser                                                                         | `whatToKnow.cost`                                                                              |
| Things to Know                                  | `things_to_know`         | not recorded                 | repeatable, **max 2 items** (E3; form accepts more) | one type: `title_and_text`, no chooser                                                                    | `whatToKnow.thingsToKnow[]` / `.items[]`                                                       |
| What to Do                                      | `what_to_do`             | not recorded                 | repeatable                                          | **chooser**: `Callout` \| `Section`                                                                       | `sections[].steps[]`                                                                           |
| ↳ Section title                                 | `section_title`          | not recorded                 | single per Section                                  | plain text                                                                                                | `step.title`                                                                                   |
| ↳ Section specifics                             | `section_specifics`      | not recorded                 | repeatable                                          | **chooser**: `Address` \| `Callout` \| `Document` \| `Email` \| `Button link` \| `Phone number` \| `Text` | `step.text[]`/`bullets[]` → `Text`; `step.button*` → `Button link`; `step.callout` → `Callout` |
| Special cases                                   | `special_cases`          | no                           | single                                              | plain text — heading override for the two panels below                                                    | — (closed `U7`)                                                                                |
| Accordion title and text                        | `supporting_information` | not recorded                 | **repeatable** (5 pre-seeded)                       | one type: `title_and_text`, instance labelled "Accordion item"                                            | `section` with `component: 'supporting'`                                                       |
| Custom Section                                  | `custom_section`         | not recorded                 | repeatable                                          | one type: `title_and_text`, no chooser                                                                    | `section` with `component: 'supporting'`, `flat: true`                                         |
| Related                                         | `related`                | "Page \*" required per entry | repeatable                                          | page chooser, unrestricted, **no chooser popup**                                                          | `section.cards[]` where the section is a Related panel                                         |
| Why is this Transaction Good for the Community? | `good_for_community`     | not recorded                 | **repeatable** (2 seen)                             | one type, labelled "Additional info": Title + Text                                                        | — (`U6`)                                                                                       |
| Contact us                                      | `get_help`               | not recorded                 | repeatable                                          | **chooser**: `Address` \| `Email` \| `Phone number` \| `Additional info`                                  | `contact` (unused on Transaction pages)                                                        |
| Partner agencies                                | `partner_agencies`       | not recorded                 | repeatable                                          | page chooser → `Agency` only                                                                              | `partnerAgencies[]` (9 of 14 pages)                                                            |
| Topics                                          | `topics`                 | not recorded                 | repeatable                                          | page chooser → `Topic` only, plus "Hide on Topic Pages" checkbox                                          | — unmapped metadata (mockup values store Agency labels)                                        |
| Redirect this page to                           | `redirect_url`           | —                            | single                                              | plain text, **disabled by design**                                                                        | — (closed `U7`)                                                                                |

**`cost` internals.** Cost and Things to know are both **optional** fields within the What to know
before you start section (E3) — the field's own radio (`Free`, `Flat fee`, `Range`, `Minimum and
up`, `None`) is required once a Cost block exists, which is what the 2026-08-15 capture recorded and
is not the same claim. The radio reveals
different nested numeric fields per option; all five variants end at the same **"Cost description"**
rich text field, **capped at 120 characters**. `cost` and `things_to_know` sit together under the
parent grouping **"What to know before you start"**, which renders as a grey box beneath the
Description (E3). Both fields are optional. **Things to know exists so a reader can decide whether
they want the service at all** — eligibility, application deadline, response time, grant amount,
programme start and end dates, what's new.

**`Callout` has no title field** — in `what_to_do` and in `section_specifics` alike, it is a single
Draftail field, unlike `things_to_know`/`custom_section`/`supporting_information`/`good_for_community`,
which all pair a plain-text title with rich text. A mockup `callout.title` therefore has no home;
fold it into the rich text as a bolded lead-in or flag it (`U2`).

**`Button link` internals.** Radio `SF.gov page` / `External URL` / `None`, revealing a page chooser
or a URL field, plus a shared **"Link text" \*** and **"Screenreader label"**. This is link shape 2.

**`Address` is a snippet chooser**, not inline fields — it references a stored Address record.
`Phone number`'s first field is labelled **"Owner"**, not "Name" (re-verified in both `get_help` and
`section_specifics`; it is one shared block definition).

**Practical shape.** A step with text, a button and a callout becomes **one `Section` block** whose
`section_specifics` holds a `Text`, a `Button link` and a `Callout` block as siblings — not fields on
the step. Bullets render inside the `Text` block's rich text, not as a separate block.

**Unresolved for this type:** the 8 mockup sections carrying a **section-level** `button`/`buttonUrl`
outside any step have no documented home — Transaction's only `Button link` slot is inside a
`what_to_do` Section. See `U1`.

---

## Information — E1, full block detail

6 pages, 37 sections. Single "Content" tab.

| Panel / field (UI label) | Raw name              | Required     | Repeatable        | Block type(s)                                         | Mockup source                                                                                 |
| ------------------------ | --------------------- | ------------ | ----------------- | ----------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Page title \*            | `title`               | **yes**      | single            | plain text                                            | `title`                                                                                       |
| Description              | `description`         | no           | single            | **plain textarea — no rich text toolbar**             | `summary`                                                                                     |
| Primary agency \*        | `primary_agency`      | **yes**      | single            | page chooser → `Agency` only                          | — (`U6`)                                                                                      |
| Part of                  | `part_of`             | not recorded | repeatable        | page chooser → **`Transaction` pages only**           | — (`U6`)                                                                                      |
| Information section      | `information_section` | not recorded | repeatable stream | **chooser**: `Title and text` \| `Image` \| `Callout` | `sections[]` — `heading`+`paragraphs[]`/`bullets[]` → `Title and text`; `callout` → `Callout` |
| Partner agencies         | `partner_agencies`    | not recorded | repeatable        | page chooser → `Agency` only                          | `partnerAgencies[]` (unused here)                                                             |
| Topics                   | `topics`              | not recorded | repeatable        | page chooser → `Topic` only                           | `topicTag` (2 of 6 pages)                                                                     |
| Related                  | `related`             | not recorded | repeatable        | unrestricted page chooser, link shape 1               | `section` with `component: 'related'` (2 sections)                                            |

`Title and text` = plain "Title" + rich text "Text". `Image` = a single "Choose an image" chooser
(Search/Upload tabs, collection filter, tags). `Callout` = **single rich text field, no title** —
the same gap as Transaction.

**Three hard exclusions, all doc-confirmed (E3), two of which the mockup currently respects (with one pending decision):**

- **No button/CTA block exists on Information.** The Button component page enumerates every place
  buttons live (Transaction call-to-action; Event/Meeting signup; Agency/Campaign/Report Spotlights)
  and Information is absent. Census confirms: zero `button` fields across the 6 Information pages.
- **No Section/step container.** Information has no `what_to_do`-style wrapper. The mockup has
  **5 steps on one Information page** (`afterReport`) — see `U3`.
- **No table block.** _"You can add a table to Reports. It is the only content type that supports
  tables."_ Census confirms zero `table[][]` on Information pages.

---

## Resource Collection — E1, full block detail

3 pages, 14 sections.

| Panel / field (UI label) | Raw name            | Required     | Repeatable        | Block type(s)                                             | Mockup source                                      |
| ------------------------ | ------------------- | ------------ | ----------------- | --------------------------------------------------------- | -------------------------------------------------- |
| Page title \*            | `title`             | **yes**      | single            | plain text                                                | `title`                                            |
| Description              | `description`       | no           | single            | plain text                                                | `summary`                                          |
| Primary agency \*        | `primary_agency`    | **yes**      | single            | page chooser → `Agency` only                              | — (`U6`)                                           |
| Data dashboard           | `data_dashboard`    | not recorded | repeatable        | one type: `Powerbi embed`, no chooser                     | — unused                                           |
| Introductory text        | `introductory_text` | not recorded | repeatable        | one type: `Title and text`, no chooser                    | section with `paragraphs[]` only (5 sections)      |
| Body                     | `body`              | not recorded | repeatable stream | **chooser**: `Documents` \| `Data stories` \| `Resources` | section with `cards[]` (12 sections) → `Resources` |
| Custom section           | `custom_section`    | not recorded | repeatable        | one type: `Title and text`, no chooser                    | —                                                  |
| Topics                   | `topics`            | not recorded | repeatable        | page chooser → `Topic` only                               | `topicTag` — unused here                           |
| Partner agencies         | `partner_agencies`  | not recorded | repeatable        | page chooser → `Agency` only                              | `partnerAgencies[]` — unused here                  |

**`Body`'s three block types are each a nested section-with-its-own-stream, not flat blocks:**

- **`Documents`** → repeatable "Document section" items: Title + a nested "Content" stream offering
  `Documents` (nested repeatable "Document" chooser blocks) and `Description` (**required** rich text).
- **`Data stories`** → repeatable "Data story section" items: Title + a required "Data stories"
  stream of `Page` blocks, chooser restricted to `Data story` pages.
- **`Resources`** → repeatable "Resource section" items: Title + a "Links" stream offering
  **`SF.gov page`** (unrestricted page chooser, no text of its own) or **`External link`**
  (Title \*, URL \*, and a Description rich text field whose helper text asks for a full sentence
  with keywords/acronyms for accessibility and SEO). This asymmetry is link shape 3 and is the
  reason an external card keeps its authored description while an internal one cannot.

**Partner agencies is the last field on this form** — confirmed by full-text extraction. Resource
Collection has **no `Related`, no `Contact us`/`get_help`, and no "Redirect this page to"**.

**`Data dashboard` internals** (unused by the mockup, recorded for completeness): "Desktop embed
url" \*, "Mobile embed url" \*, nested "Aspect ratios" struct (Desktop Width\*/Height\*, Mobile
Width\*/Height\*, pre-filled 700/700 and 360/900), "Alt text" \*, "Source data", "Data notes".

---

## Campaign — E1, full block detail

2 pages, 14 sections. The mockup's Campaign pages use exactly 2 spotlights each, which is what the
form allows.

| Panel / field (UI label) | Raw name                     | Required                               | Repeatable                          | Block type(s)                                                                                  | Mockup source                                                   |
| ------------------------ | ---------------------------- | -------------------------------------- | ----------------------------------- | ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Title \*                 | `title`                      | **yes**                                | single                              | plain text                                                                                     | `title`                                                         |
| Primary agency \*        | `primary_agency`             | **yes**                                | single                              | page chooser → `Agency` only                                                                   | — (`U6`)                                                        |
| Logo                     | `logo`                       | no                                     | single                              | image chooser, min 100×100, square preferred                                                   | — unused                                                        |
| Background header image  | `background_header_image`    | no                                     | single                              | image chooser, min 400px tall, 16:5 recommended                                                | — unused                                                        |
| Color theme              | `theme`                      | not recorded                           | single                              | dropdown: `Black` \| `Blue` \| `Green` \| `Orange`                                             | — unused                                                        |
| Spotlight 1              | `spotlight_1`                | not recorded                           | **repeatable** (2 inserted live)    | one type: `Spotlight`, no chooser                                                              | `section` with `component: 'spotlight'`                         |
| Spotlight 2              | `spotlight_2`                | not recorded                           | **repeatable**, same as Spotlight 1 | one type: `Spotlight`, no chooser                                                              | as above                                                        |
| Top facts                | `facts_title` + `fact_items` | not recorded                           | Fact items repeatable               | "Facts title" plain text + repeatable "Fact items"                                             | `section` with `component: 'top-facts'`; `facts[]` → Fact items |
| Additional content       | `additional_content`         | not recorded                           | repeatable stream                   | **chooser**: `Image with text` \| `Video` \| `Accordion section` \| `Embed` \| `Resources`     | `section` with `component: 'supporting'` → `Accordion section`  |
| About                    | `about_campaign`             | not recorded                           | single                              | single rich text field, "About campaign"                                                       | — unused                                                        |
| Partner agencies         | `partner_agencies`           | not recorded                           | repeatable                          | page chooser → `Agency` only                                                                   | — unused                                                        |
| Related                  | `related_links`              | "Page" \* and "Link text" \* per entry | **repeatable**                      | one block type (`Page block`), link shape 4                                                    | `section` with `component: 'related'`                           |
| Contact us               | `contact`                    | not recorded                           | repeatable stream                   | default `Contact` block, 4 nested sub-streams (`address`/`phone`/`email`/`social_media_other`) | `contact`                                                       |

**`Spotlight` internals:** "Spotlight title", "Spotlight description", "Spotlight image" (chooser,
min 1080×350), **"Image alignment" \*** radio (`Side by side` / `Full width`), **"Image position" \***
radio (`Right` / `Left`), and a nested `Button link` (link shape 2). Spotlight 1 and Spotlight 2 are
**two independent top-level fields**, not one repeatable field with two slots — a third spotlight
concept has nowhere to go.

**`Additional content`'s five block types:**

- `Image with text` → Image chooser, Title, Description (rich text, **capped 120 chars**).
- `Video` → "Video title", "Describe what this video is about" (rich text, capped 120), required
  "Video type" struct (max 1) choosing `External link` (URL \*) or `Embed` (YouTube URL \*, required
  "Video transcript").
- `Accordion section` → Title, "Accordion sidebar" (rich text), repeatable "Accordion item" blocks —
  each a Title plus a "Body" stream of `Address` (chooser) / `Phone number` / `Text`.
- `Embed` → "iFrame URL" \*, "Alt text", "Aspect ratio" radio (`Default 4:3` / `Landscape 16:9` /
  `Square 1:1` / `Portrait 9:16`).
- `Resources` → Title, repeatable "Resource sections" (Title + Links stream of `SF.gov page` /
  `External link` [Title \*, URL \*]), plus a separately repeatable "Downloadable resources" list of
  Document choosers.

**`Contact us`'s four sub-streams:** `Address` (snippet chooser), `Phone` (Owner, Phone number,
Extension, Phone number details), `Email` (Title, Email \*), and `Social media / other` — a chooser
between `Social media` (Facebook, X, Instagram URL fields) and `Other (custom)` (Title + Text). This
is the only Contact-us in Karl with a social struct, which is why `contactSchema` carries an optional
`social` field the other types never populate.

**Contact us is the final section on this form** — confirmed by full-page scroll.

**Campaign's `Related` is repeatable and takes external URLs.** It is not the same field as
Transaction/Information's `related` despite the shared label. See `O2` for the correction this
superseded.

---

## Topic — E1, full block detail

1 page (`healthyHousingTopic`), 5 sections.

| Panel / field (UI label)                                        | Raw name           | Required     | Repeatable        | Block type(s)                                                                                                  | Mockup source                              |
| --------------------------------------------------------------- | ------------------ | ------------ | ----------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| Title \*                                                        | `title`            | **yes**      | single            | plain text                                                                                                     | `title`                                    |
| Primary agency \*                                               | `primary_agency`   | **yes**      | single            | page chooser → `Agency` only                                                                                   | — (`U6`)                                   |
| Description                                                     | `description`      | no           | single            | plain textarea — helper says _start with keywords_, **not a prose intro field**                                | `summary`                                  |
| Set top-level?                                                  | `top_level_topic`  | no           | single            | checkbox                                                                                                       | — unused                                   |
| **Child topics** (outer StreamField; internally "Page content") | `content_fields`   | not recorded | repeatable stream | **chooser, 6 types**: `Child topics` \| `Content top` \| `Services` \| `Spotlight` \| `Resources` \| `Content` | `sections[]`                               |
| Partner agencies                                                | `partner_agencies` | not recorded | repeatable        | page chooser → `Agency` only                                                                                   | `partnerAgencies[]` (present on this page) |

**Naming trap, verbatim from the capture:** the outer StreamField is UI-labelled **"Child topics"**,
and one of its six block _choices_ is **also** literally named "Child topics". Internally the field
is "Page content", raw name `content_fields`. Any generated instruction naming "Child topics" must
disambiguate which one it means.

Block raw names: `page_content` (Content top), `content`, `services`, `spotlight`, `resources`.
The editor **pre-populates one each** of `Content top`, `Services`, `Spotlight`, `Resources` and
`Content` on a new page; `Child topics` is not pre-populated. Duplicates of any type can be added.

- **`Content top` and `Content` are the identical block type under two names** — Title + a required
  nested "Section content" stream offering its own six types: `Button link`, `Phone number`,
  `Resources`, `Spotlight`, `Timeline`, `Text`. The two levels overlap but are not identical:
  `Resources`/`Spotlight` work at both; `Child topics`/`Services` are outer-only;
  `Button link`/`Phone number`/`Timeline`/`Text` are inner-only.
- **`Services` and `Resources` are structurally identical** — Title + a Links list of `SF.gov page`
  or `External link` (link shape 3), and **neither has an intro-paragraph field**
  (live-admin-confirmed 2026-07-06). Every mockup section carrying both `paragraphs[]` and `cards[]`
  loses the paragraph on a direct mapping; the alternative is nesting a `Text` block plus a
  `Services`/`Resources` block inside one `Content` block's Section content stream. That choice is
  `U4` — it is a decision for Digital Services, not something to resolve by picking one.
- **`Spotlight`** — same shape as Campaign's, but repeatable here rather than two fixed slots.
- **`Timeline`** — a block type seen on no other verified type. Unused by the mockup.

**Topic has no `Related` field.** `healthyHousingTopic` renders a `component: 'related'` section
anyway. See `U5`.

**Auto-population behaviour (E3):** Transaction and Step-by-step pages tagged with this topic on
their own `topics` field auto-populate under a "More services" heading; adding the same page manually
as a `Services` entry removes it from "More services" and pins it where the editor put it.
Auto-added pages are not visible or editable from the Topic page's own editor. Information pages do
not auto-populate anywhere and must be added manually.

---

## Agency — E1, captured 2026-08-15

**Content tab, in panel order, with raw field names read from the form's own panel tree:**

| Panel UI label                     | Raw field                                                                    | Required               | Repeatable        | Block type(s)                                                        | Mockup source                                  |
| ---------------------------------- | ---------------------------------------------------------------------------- | ---------------------- | ----------------- | -------------------------------------------------------------------- | ---------------------------------------------- |
| Title\*                            | `title`                                                                      | **yes**                | single            | plain text                                                           | `title`                                        |
| Select to show page on agency list | `show_agency_list`                                                           | no                     | single            | checkbox                                                             | — (Digital Services controls this)             |
| Description                        | `description`                                                                | no                     | single            | textarea                                                             | `summary`                                      |
| Logo                               | `logo`                                                                       | no                     | single            | image chooser                                                        | —                                              |
| Main image                         | `main_image`                                                                 | no                     | single            | image chooser                                                        | —                                              |
| Alert                              | `alert` + `alert_agency_wide`                                                | no                     | single            | text + checkbox                                                      | —                                              |
| Quick links                        | `quicklinks`                                                                 | no                     | repeatable        | link list (`SF.gov page` / `External link`)                          | —                                              |
| Meeting information                | `meeting_information`                                                        | no                     | single            | rich text                                                            | —                                              |
| **Section title 1\***              | **`services_title`**                                                         | **yes**                | single            | plain text                                                           | the `services` section's `heading` — see below |
| Subsection                         | **`services`**                                                               | no                     | repeatable        | Subsection (auto-insert) → `SF.gov page` / `External link` (shape 3) | `component: 'services'` sections               |
| Spotlight 1                        | `spotlight_1`                                                                | no                     | repeatable        | `Spotlight` block                                                    | —                                              |
| Spotlight 2                        | `spotlight_2`                                                                | no                     | repeatable        | `Spotlight` block                                                    | —                                              |
| Highlights                         | `highlights` (`HighlightsPanel`)                                             | no                     | repeatable        | `Highlight` block                                                    | —                                              |
| **Section title 2\***              | **`resources_title`**                                                        | **yes**                | single            | plain text                                                           | the `resources` sections' `heading`            |
| Subsection                         | **`resources`**                                                              | no                     | repeatable        | Subsection (auto-insert) → `SF.gov page` / `External link` (shape 3) | `component: 'resources'` sections              |
| About                              | `about_description`                                                          | no                     | single            | rich text                                                            | `component: 'body'` section                    |
| ↳ Call to action                   | `call_to_action`                                                             | no                     | single            | Call to action block (Title, Description, Button link)               | —                                              |
| ↳ Divisions or subcommittees       | `divisions_subcommittees`                                                    | no                     | repeatable        | page chooser (`Agency` / `Division`)                                 | —                                              |
| ↳ Partner agencies                 | `partner_agencies`                                                           | no                     | repeatable        | page chooser (`Agency` only)                                         | `partnerAgencies[]` — unused here              |
| People                             | `people`                                                                     | no                     | repeatable        | Person snippet chooser                                               | —                                              |
| Public records\*                   | `public_records`                                                             | **yes** (panel marked) | repeatable stream | Public records struct / links                                        | —                                              |
| Archive information                | `archive_url`, `archive_date`, `meeting_archive_url`, `meeting_archive_date` | no                     | single            | URLs / dates                                                         | —                                              |
| Contact us                         | `contact`                                                                    | no                     | repeatable stream | default `Contact` block (4 sub-streams)                              | `contact` — unused here                        |
| Redirect this page to              | `agency_redirect`                                                            | —                      | single            | plain text, **inert by design**                                      | —                                              |
| Topics                             | `topics`                                                                     | no                     | repeatable        | page chooser (`Topic` only)                                          | — unmapped metadata                            |

**`services_title` and `resources_title` are required, which the Help Center gets wrong.** It says
the heading is optional and defaults to "Services"/"Resources" if left blank; the form marks both
`Section title 1` and `Section title 2` with an asterisk and `required` on the input, so the defaults
are **pre-filled rather than blank-permitted**. An editor may rename them but not empty them.

**`agency_redirect` is a `ConditionalReadOnlyFieldPanel`** — the panel class itself, not a rendering
accident, which is the structural reason "Redirect this page to" is inert everywhere.

**The subsection shape, expanded two levels and confirmed at E1:**

1. `services` / `resources` "+" → **auto-inserts a Subsection block with no chooser** (one block type).
2. The Subsection has a single field: **`services-N-value-title`** — labelled **"Title"**, **not
   required**.
3. The Subsection's own "+" → chooser offering exactly **`SF.gov page`** and **`External link`**.

So a mockup section maps to **one Subsection**: its `heading` is the Subsection Title, and each
`card` is one link entry. This is link shape 3, and the Help Center's "You can link to any type of
page from the Services section" holds — the chooser applies no content-type restriction.

**What each entry publishes is measured separately (E4):** an Agency Services/Resources subsection
entry is a page picker that publishes the destination page's title **and** its summary. It is the
only bucket in the whole corpus that inherits a description. See "Card inheritance" below.

---

## About us — E1, captured 2026-08-15

Four Content-tab panels, and that is the whole type:

| Panel UI label   | Raw field        | Required | Repeatable        | Block type(s)                                                                         | Mockup source                         |
| ---------------- | ---------------- | -------- | ----------------- | ------------------------------------------------------------------------------------- | ------------------------------------- |
| Title\*          | `title`          | **yes**  | single            | plain text                                                                            | `title`                               |
| Primary agency\* | `primary_agency` | **yes**  | single            | page chooser → `Agency` only                                                          | — (`U6`)                              |
| Information      | **`about_info`** | no       | repeatable stream | `Custom section` (title text + rich text)                                             | `paragraphs[]` / `bullets[]` sections |
| Resources        | **`resources`**  | no       | repeatable stream | `Resources section` (`SF.gov page` / `External link` / `Downloadable files`, shape 3) | `component: 'resources'` section      |

**`about_info` block internals, expanded at E1.** "+" auto-inserts (one block type only), giving:

| Field                      | UI label                 | Type      | Required |
| -------------------------- | ------------------------ | --------- | -------- |
| `about_info-N-value-title` | **Custom section title** | text      | no       |
| `about_info-N-value-text`  | **Custom section text**  | rich text | no       |

Both optional — a block may carry text with no heading. The labels match the Help Center's wording
exactly, which is a useful cross-check on a type documented nowhere else.

**About pages take no images** (E3). An org chart belongs on a separate Information page the About
page links to. `aboutHhvcTeam` declares none, so nothing breaks.

`resources` is the shared component of link shape 3: an **External link** entry carries its own
Title, URL and description; an **SF.gov page** entry is a bare page reference. Its "+" also offers
**Downloadable files** for PDFs and other uploads.

Creating one means tagging an **existing Agency**; a button back to this About page is then added
automatically from that Agency page's About section (E3).

---

## Report — E1, captured 2026-08-15

1 page (`article11Guide`). 9 sections, **7 carrying `table[][]`**, plus 4 section-level buttons,
3 card sections, 1 callout, and page-level `spotlight` + `reportDate`.

| Panel UI label   | Raw field          | Required | Repeatable        | Block type(s)                              | Mockup source                           |
| ---------------- | ------------------ | -------- | ----------------- | ------------------------------------------ | --------------------------------------- |
| Title\*          | `title`            | **yes**  | single            | plain text                                 | `title`                                 |
| Date             | `date`             | no       | single            | date picker                                | `reportDate`                            |
| Primary agency\* | `primary_agency`   | **yes**  | single            | page chooser → `Agency` only               | — (`U6`)                                |
| Spotlight        | `spotlight`        | no       | single            | `Spotlight` block (link shape 2)           | `spotlight`                             |
| **Content**      | **`content`**      | no       | repeatable stream | **chooser**: `Body` (rich text) \| `Table` | `sections[]`                            |
| Print version    | `print_version`    | no       | single            | document chooser                           | `printVersionUrl` — **no page sets it** |
| Partner agencies | `partner_agencies` | no       | repeatable        | page chooser → `Agency` only               | `partnerAgencies[]` — unused here       |

**`content`'s chooser offers exactly two block types: `Body` and `Table`.** Opened directly in the
form on 2026-08-15 — this is now E1, not an inference from the overview page. There is no Callout
block, no Accordion block, no page-card block, and no button.

| Mockup field                 | Karl destination             | Note                                                                      |
| ---------------------------- | ---------------------------- | ------------------------------------------------------------------------- |
| `paragraphs[]` / `bullets[]` | `content` → **Body**         | one Rich Text Editor field; images, block quotes, hyperlinks, bullets     |
| `table[][]` ×7               | `content` → **Table**        | Report is the only Karl type with tables                                  |
| `cards[]` ×3 sections        | `content` → Body → hyperlink | no page-card block exists — the mockup's own fallback note is the mapping |
| `callout` ×1                 | **no home**                  | `U18` resolved against the component matrix — see below                   |
| `button` ×4 (section-level)  | **no home**                  | `U1` — the Spotlight is the only button slot, and it is already in use    |

**`Body` internals.** **Heading 2 auto-generates a table of contents** on the right of the published
page; **Heading 3** appears under "See all sections". **Do not use Heading 4, 5 or 6** — they never
appear. So the mockup's nine section headings are H2s inside one Body field, not nine blocks.

**`Table` internals**, in the order they appear after choosing Table:

| Field                                               | Type                                                                                                 |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| **Table header options**                            | dropdown: first row as header · first column as header · first row **and** first column · no headers |
| **Description**                                     | text, displays **between the Caption and the table**                                                 |
| **Caption**                                         | the table's title                                                                                    |
| **Add column** → **Rich text** → **Column heading** | columns added by button, rows via the + at each row's lower left                                     |

Use **2 or 3 columns** — more forces horizontal scrolling and breaks on a phone. And a detail with
real editorial weight for a page carrying seven tables: **text inside a table is not machine
translated**, while the rest of sf.gov is by default.

**`U18` resolved against the component matrix.** `docs/source/hhvc-policy/karl-content-type-field-reference.md`
lists **Callout: Yes** and **Accordions: Yes** for Report. The live chooser offers neither.
`article11Guide`'s one callout therefore has no home and must fold into the Body rich text — as a
bolded lead-in, the same fallback Transaction's title-less Callout needs (`U2`). The matrix row is
`O11`.

---

## Types not yet in use — captured for future pages

Karl offers seventeen content types and this mockup declares eight. The other nine were captured in
the same read-only session on 2026-08-15, at panel-tree depth: raw field names and panel order for
all of them, chooser contents and block internals only where a plausible HHVC page would need them.
**Nothing here maps to a page that exists** — this section answers "which type should this page be?"
before the per-type sections above answer "what fields does it have?".

They were deliberately not expanded two levels deep the way Agency's Subsection was. That expansion
was justified because a live page depended on it; nothing depends on these yet.

| Type                       | `<model>`                  | Plausible HHVC use                                    | Captured                            |
| -------------------------- | -------------------------- | ----------------------------------------------------- | ----------------------------------- |
| **Step by step**           | `stepbystep`               | the step-bearing pages — see below, this one matters  | panels + `steps` block internals    |
| **Event**                  | `event`                    | a workshop with a date, versus the current Campaign   | panels + `call_to_action` internals |
| **Form**                   | `form`                     | `forms/mosquito-workshop-request/` has a real sub-app | panels                              |
| **News**                   | `news`                     | program announcements                                 | panels                              |
| **Location**               | `locationpage`             | an office or clinic address                           | panels                              |
| **Profile**                | `profile`                  | named staff                                           | panels                              |
| Data story                 | `datastory`                | none identified                                       | panels                              |
| Meeting                    | `meeting`                  | none identified                                       | panels                              |
| Document Collection Search | `documentcollectionsearch` | none identified                                       | panels                              |

Every one of these is the same three-tab `TabbedInterface`, read from its panel tree, so the
Promote-tab table above applies unchanged. **Required markers were measured only on `Step by step`
and `Event`** (both `title`, `primary_agency`, `slug`, like the eleven measured types); for the
other seven that pattern is an inference, not a measurement, and is not asserted here.

### Step by step — the type 27 `karl` notes were describing

**Content tab:** `title`, `primary_agency`, `description`, `intro`, `steps`, `topics`,
`partner_agencies`.

**The `steps` block, expanded (E1):**

| Field                            | UI label         | Type                                      | Required |
| -------------------------------- | ---------------- | ----------------------------------------- | -------- |
| `steps-N-value-step_type`        | Step type\*      | select: **`number`**, **`and`**, **`or`** | **yes**  |
| `steps-N-value-title`            | Title\*          | text                                      | **yes**  |
| `steps-N-value-optional`         | Optional         | checkbox                                  | no       |
| `steps-N-value-cost`             | Cost             | —                                         | no       |
| `steps-N-value-time`             | Time             | —                                         | no       |
| `steps-N-value-step_description` | Step description | rich text                                 | no       |
| `related_content_transactions`   | Transaction link | page chooser                              | no       |

**This is the block 27 mockup `karl` notes named**, on 14 pages typed `Transaction` and one typed
`Information`. Those notes read _"Transaction -> Steps -> Step. Step type: number. … Optional, Cost,
Time, and Transaction link: blank"_ — seven fields, seven exact matches, and **none of them exists
on a Transaction page**. Transaction's `what_to_do` → `Section` is `section_title` plus a
`section_specifics` stream and nothing else.

**Resolved by rewriting the notes, not by retyping the pages** (2026-08-15). The deciding fact is
that `Step by step` has **no page-level `cost` and no `things_to_know`**: retyping the 14
Transaction pages would have dropped `whatToKnow` from every one of them, since `whatToKnow.cost` is
a single page-level statement with nowhere to go. `Step by step`'s `cost` is **per step**, which is
a different thing. The notes now point at `what_to_do -> Section`; the pages stay Transactions.

That leaves this type a live candidate for anything genuinely step-shaped that carries no page-level
cost or things-to-know — and `U3`'s `afterReport` is exactly that question.

### Event

**Content tab:** `title`, `primary_agency`, `description`, `call_to_action`, `date_time`, `cost`,
`location`, `image`, `body`, `partner_agencies`, `contact`, `topics`.

`call_to_action` is a block of **Call to action title**, **Call to action description**, and a
nested **Button link** (`link_to` radio → SF.gov page or External URL). **This is one of only two
homes for the mockup's `primaryCta`** — the other is Agency's `call_to_action` — which the "Mockup
fields with no Karl destination" table above records as unmappable, true only for the eight types
in use.

Event also has a page-level `cost`, like Transaction, so a workshop page needing both a date and a
cost statement fits here in a way Campaign does not.

### Form

**Content tab:** `title`, `schema_url`, `confirmation_title`, `confirmation_body`, `primary_agency`,
`get_help`, `partner_agencies`, `translatable_strings`.

**`schema_url` is the whole mechanism** — the form itself lives elsewhere and Karl references it by
URL. That is worth knowing before anyone assumes `forms/mosquito-workshop-request/` would be
rebuilt inside Karl; on this evidence it would be hosted and pointed at.

### News, Location, Profile

- **News** — `title`, `primary_agency`, `date`, `image`, `redirect_url`, `abstract`, `body`,
  `news_type`, `topics`, `partner_agencies`. Note `redirect_url` sits mid-form here rather than at
  the bottom, and `news_type` is the News-versus-Press-Release switch.
- **Location** — `title`, `primary_agency`, `description`, `alert`, `image`, `body`, `intro`,
  `services`, `about_location`, `partner_agencies`, `at_this_location`, `people`,
  `related_locations`, `contact`. It has its own `services` field, like Agency.
- **Profile** — `title`, `pronouns`, `image`, `primary_job_title`, `primary_job_title_line_2`,
  `primary_agency`, a `ProfileReferencesPanel`, `biography`, `phone`, `email`, `social_media`,
  `spotlight`, `quick_links`, `contact`, `redirect_url`.

### Data story, Meeting, Document Collection Search

Field lists only — no HHVC page is heading toward any of these.

- **Data story** — `title`, `primary_agency`, `description`, `content`, `partner_agencies`.
- **Meeting** — `title`, `primary_agency`, `primary_agencies`, `cancelled`, `date_time`,
  `meeting_location`, `overview`, `agenda`, `videos`, `related_documents`, `notices`,
  `partner_agencies`.
- **Document Collection Search** — `title`, `description`, `primary_agency`, `collection`. Four
  fields; it is a search page over a document collection, not an authored page.

---

## Card inheritance — the rule that keeps a description from being invented

Requirement 5 has a second half that lives in this repo rather than in Karl: what a card _publishes_.
`js/core/card-inheritance.js` is the one classifier, shared by the browser renderer and
`build_scripts/audit-card-inheritance.js` so the two cannot drift. It keys on the section's `karl`
note, **not** on `section.component` — a first version keyed on `component` and would have blanked
table blocks and title-and-text blocks (74 of its 98 findings sat in sections carrying no
`component` at all).

| Bucket       | What publishes                           | Where it applies                                                  | Evidence                                    |
| ------------ | ---------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------- |
| `inherits`   | destination page's **title and summary** | Agency Services/Resources subsection entry                        | E4, DOM-level against live pages 2026-08-08 |
| `title-only` | **title and link, nothing else**         | Related panel entry; Resource Collection's Resource-section entry | E4, each verified separately                |
| `authored`   | the card's own words, untouched          | Table block, Title-and-text block                                 | E4                                          |

**An external-URL entry inside an inheriting subsection keeps its own authored text** — settled by a
census of all 332 `departments--*` pages in `sf.gov/sitemap.xml`: 333 of 363 entries whose `href`
leaves sf.gov render their own description. There is no destination page to inherit from, so the
description is authored on the entry. This is the same asymmetry as link shape 3 above, seen from
the published side.

**External entries in a `title-only` section are the opposite case** — that component renders no
description for _any_ entry, so such text is dead and was deleted rather than mapped.

The Help Center contradicts itself on this; do not re-widen these buckets from the docs alone. Full
write-up: `docs/source/hhvc-policy/2026-08-08-karl-card-inheritance-verification.md`.

---

## Mockup fields with no Karl destination

Requirement 6, first half. These are real fields in `build_scripts/schema.js` that no verified Karl
field accepts.

| Mockup field                                      | Used?                                                           | Status                                                                                                                                                                                                                                |
| ------------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `audience[]`                                      | all 29 pages                                                    | **Not migrated.** HHVC editorial standard, not a Karl concept                                                                                                                                                                         |
| `reading`                                         | all 29 pages                                                    | **Not migrated.** HHVC grade-level target                                                                                                                                                                                             |
| `editorNote`                                      | 26 pages                                                        | **Not migrated.** QA guidance — equivalent to a Wagtail workflow comment, not page content                                                                                                                                            |
| `editorStatus`                                    | 12 pages                                                        | **Not migrated.** Review-state, mockup only                                                                                                                                                                                           |
| `kind`                                            | every section                                                   | **Not migrated.** Drives tag colour in the mockup                                                                                                                                                                                     |
| `karl`                                            | every section (schema-required), all 39 steps, 113 of 183 cards | **Not migrated** — it is the instruction _about_ the migration                                                                                                                                                                        |
| `topicTag`                                        | 3 pages                                                         | **Not migrated.** Unmapped metadata (mockup values store Agency labels, not Topic chooser references)                                                                                                                                 |
| `seoTitle` / `metaDescription`                    | all 29 pages                                                    | Verified mapping to Wagtail Promote tab fields (`seo_title` / `search_description`, closed `U11`)                                                                                                                                     |
| `callout.title`                                   | several                                                         | **No home.** Every Karl `Callout` is a bare rich text field (`U2`)                                                                                                                                                                    |
| `primaryCta`                                      | **0 pages**                                                     | Schema-declared, unused. No home on the eight types in use — but `call_to_action` exists on **Agency** (in use, unused by `pestsTopic`) and on **Event** (not in use). So it is unmappable today rather than unmappable in principle. |
| `printVersionUrl`                                 | **0 pages**                                                     | Schema-declared, unused. Report's "Print version" field exists and is a document chooser, not a URL                                                                                                                                   |
| section-level `button`/`buttonUrl` outside a step | 5 Transaction, 2 Campaign, 1 Topic                              | Re-measured 2026-08-16, superseding "8 Transaction, 4 Report, 2 Campaign, 1 Topic": Report now carries none, and the Transaction count is 5. The 3 Campaign/Topic ones sit inside `spotlight` sections and are fine; the 5 are `U1`   |

**Karl fields with no mockup concept**, conversely: `Cost` (partially — `whatToKnow.cost` covers the
description, not the radio), `Custom Section` on Transaction, `good_for_community`, `Data dashboard`,
`Documents`, `Data stories`, `Logo`, `Background header image`, `Color theme`, `About campaign`,
`Timeline`, `Set top-level?`, `Child topics`, `Part of`, and `Primary agency` on every type
(`U6`).

---

## Unresolved register

**Read the `Status` column before the row.** Only `open` and `narrowed` rows may never be rendered
as a path — for those, render the displayed value, the copy action, and the unresolved state. A
`closed-E3` row **has** a documented path and should be rendered as one, tagged E3; treating the
whole register as a blocklist would suppress exactly what the 2026-08-15 sweep bought.

| ID    | Status   | Unresolved                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Blocked on                                                 |
| ----- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `U1`  | open     | **Section-level buttons outside a step.** 8 Transaction sections and 4 Report sections carry `button`/`buttonUrl` with no documented Karl slot. Transaction's only `Button link` is inside a `what_to_do` Section; Report's is documented only inside the Spotlight. The Help Center also states an editorial "no more than one button per page" rule, which several pages would already violate.                                                                                                                                                                                                                                                                                                                                                                                                                                             | Digital Services decision                                  |
| `U2`  | open     | **`callout.title` has no field.** Every Karl `Callout` — Transaction `what_to_do`, Transaction `section_specifics`, Information `information_section` — is a single rich text field with no title. Recorded at E1 on **2026-07-05**, when every "+" menu on those forms was opened; the 2026-08-15 pass re-confirmed `what_to_do`'s two block types but did not re-enumerate `section_specifics`. Fold into the rich text as a bolded lead-in, or get a field added. Two payFee callouts now carry this flag inline.                                                                                                                                                                                                                                                                                                                          | Digital Services decision                                  |
| `U3`  | narrowed | **Answered 2026-08-15, and the answer has a cost.** `Step by step` exists and its `steps` block is an exact fit — see "Types not yet in use" below. But `Step by step` has **no page-level `cost` and no `things_to_know`**, so retyping `afterReport` would drop its `whatToKnow` entirely. The alternatives are unchanged: keep it Information and render the steps as `information_section` Title-and-text blocks, or make it a Transaction and use `what_to_do`. Still a content decision.                                                                                                                                                                                                                                                                                                                                                | Content decision                                           |
| `U4`  | open     | **Topic `Services`/`Resources` blocks have no intro paragraph.** Documented at E3 (Help Center) and recorded in the 2026-07-06 live-admin log; **not re-opened in either 2026-08-15 session**, so it is not E1 despite an earlier draft of this row saying "live-confirmed". A mockup section carrying both `paragraphs[]` and `cards[]` either loses the paragraph or gains a nesting layer (`Content` → Section content → `Text` + `Resources`).                                                                                                                                                                                                                                                                                                                                                                                            | Digital Services decision, or a live-admin re-check        |
| `U5`  | open     | **Split by the 2026-08-15 capture; the Karl half is settled.** Topic, Resource Collection and Report have **no `related` field** — confirmed at E1 on each form. What remains is a mockup question, not a source conflict: `healthyHousingTopic` renders a `component: 'related'` section that Karl cannot host on that type. Either the panel moves into `content_fields` as a `Resources` block, or the page drops it.                                                                                                                                                                                                                                                                                                                                                                                                                      | Content decision                                           |
| `U6`  | open     | **`Primary agency` is required on 7 types and the mockup has no field for it.** Also `Part of` (Information) and `good_for_community` (Transaction). A page cannot be saved without Primary agency.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Add a mockup field, or accept it as an at-build-time input |
| `U7`  | closed   | **Closed 2026-08-15 (E1).** Transaction's "Special cases" heading override is `special_cases`. The same capture also read `redirect_url`, the previously uninspected raw name behind "Redirect this page to".                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | closed                                                     |
| `U8`  | closed   | **Closed 2026-08-15 (E1).** Agency `services`/`resources` expanded two levels in the live form: Subsection auto-inserts, carries one optional `Title`, and its own "+" offers `SF.gov page` / `External link`. All 26 panel raw names captured. `services_title`/`resources_title` are **required**, contradicting the Help Center.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | closed                                                     |
| `U9`  | closed   | **Closed 2026-08-15 (E1).** About us is four panels — `title`, `primary_agency`, `about_info`, `resources`. `about_info` auto-inserts a block of `Custom section title` (text) + `Custom section text` (rich text), both optional.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | closed                                                     |
| `U10` | closed   | **Closed 2026-08-15 (E1).** Report `content` chooser offers exactly `Body` and `Table`, opened in the live form. Table fields: Table header options, Description, Caption, Add column → Rich text → Column heading.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | closed                                                     |
| `U11` | closed   | **Closed 2026-08-15 (E1).** Every type has a **Promote** tab: `slug` (required), `seo_title`, `search_description`, `show_in_menus`, `tags`. So `seoTitle` → `seo_title` and `metaDescription` → `search_description` are verified, not inherited guesswork.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | closed                                                     |
| `U12` | narrowed | **Re-framed 2026-08-23 by the precedence reversal.** The Help Center states Related accepts only Transaction/Information/Campaign/Topic; the live Campaign picker returned and accepted a Resource Collection page. Under the revised rule the Help Center governs, so the four-type restriction **stands** (`O3`) and the unrestricted picker is a gap in the form rather than a refutation of the doc. This is no longer a question about which source is right. Two things remain: whether the form should be constrained to match, and whether such an entry would publish if one were built — the evidence is a **picker** observation, and a chooser offering an option is not the CMS accepting it.                                                                                                                                    | E4 — save and publish a Resource Collection into Related   |
| `U13` | closed   | **Closed 2026-08-15 (E1).** Raw field names captured for all eight types from each form's panel tree. See "Raw field names, all eight types" above.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | closed                                                     |
| `U14` | closed   | **Closed 2026-08-15 (E1).** `additional_content` is its own top-level FieldPanel, a sibling of `spotlight_1` and `spotlight_2` — not nested inside either. The 2026-07-06 parenthetical was capture-order shorthand.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | closed                                                     |
| `U15` | closed   | **Closed 2026-08-15 (E1).** Report has no page-card block; `content` offers only `Body` and `Table`. Each card becomes an inline hyperlink in the Body rich text and loses its `text`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | closed                                                     |
| `U16` | narrowed | **Re-framed 2026-08-23; the half that was asked is still open.** Topic's `content_fields` chooser lists `Spotlight` among six block types in a repeatable stream, so a second one can be ADDED on the form — and the 2026-08-15 Campaign measurement shows the same is true of `spotlight_1`. Under the revised precedence that permissiveness is a gap in the form, not a licence: Topic's documented one-Spotlight cap is the rule to build to. What `U16` still asks is whether the TEMPLATE renders a second one, and E1 cannot answer that. `healthyHousingTopic` uses one either way, so nothing in the corpus turns on it.                                                                                                                                                                                                             | E4 — publish a Topic carrying two Spotlights               |
| `U17` | closed   | **Closed 2026-08-15 (E1). Agency's Resources is a DIFFERENT block, despite the shared label.** About us `resources` opens a chooser of `Resources section` / `Downloadable files`; Agency `resources` auto-inserts a Subsection (single block type, no chooser) whose entries are `SF.gov page` / `External link`. So the Help Center's list of four is right and its count of five is the error. This independently explains the E4 finding that **only** Agency subsection entries publish the destination's summary — it is not the same component as everyone else's Resources.                                                                                                                                                                                                                                                           | closed                                                     |
| `U18` | closed   | **Closed 2026-08-15 (E1).** Report's `content` chooser offers `Body` and `Table` only — no Callout, no Accordion. The component matrix asserting both for Report is wrong (`O11`), and `article11Guide`'s one callout must fold into the Body rich text.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | closed                                                     |
| `U19` | closed   | **Closed 2026-08-15, and incomplete — see `U24`.** All ten over-length labels were shortened; the longest **section- and step-level** button label in the corpus is now 25 characters (`mosquitoWorkshop`, at the cap exactly). The sweep did not reach page-level Spotlight buttons, which is how `article11Guide`'s 27-character label survived it. Each new label leans on its own heading or callout for the context the long version carried — `article11Guide`'s two `filthReport` buttons stay distinguishable as "Report garbage or filth" and "Report overgrowth", and "Report a dead bird" keeps its "to the State" in the callout directly above it.                                                                                                                                                                               | closed                                                     |
| `U20` | open     | **Intro paragraphs on an Agency Services/Resources section have nowhere to go.** The Subsection carries a single optional `Title` and a links list — no description field, which is exactly what closing `U8` established by expanding it two levels in the live form. Three `pestsTopic` sections carry `paragraphs[]` alongside their `cards[]`, and a direct mapping loses the paragraph. This is `U4`'s shape measured on Agency rather than on Topic, and it needs the same answer: accept the loss, or nest the prose in a block with room for it. Opened 2026-08-16 by the transcript exporter's coverage check, which is what made a silent loss into a countable one.                                                                                                                                                                | Digital Services decision                                  |
| `U21` | open     | **Three types have no page `description` field at all, and three mockup pages carry a summary anyway.** Campaign, About us and Report each omit `description` from their Content tab — read off their own panel trees at E1 on 2026-08-15, and visible in the "Raw field names, all eight types" table above. `ipmEducation`, `mosquitoWorkshop`, `aboutHhvcTeam` and `article11Guide` all declare a `summary` the mockup renders under the page title. Campaign's `about_campaign` rich text is an About SECTION rather than a page description, so folding a summary into it is a content decision, not a mapping. Opened 2026-08-16 by the transcript exporter's coverage check.                                                                                                                                                           | Content decision                                           |
| `U22` | open     | **Information has no Contact us panel, and two Information pages carry `contact`.** `get_help` exists on Transaction, and a `Contact` block on Campaign and Agency; Information's eight panels include none of them (E1). `article11Compliance` and `ownerGuidance` both declare contact details. Either the details move onto a Transaction or Agency page the Information page links to, or they become an `information_section` Title-and-text block that is not a real Contact component. Opened 2026-08-16 by the transcript exporter's coverage check.                                                                                                                                                                                                                                                                                  | Content decision                                           |
| `U23` | open     | **Information has no `cost` and no `things_to_know`, and one Information page carries `whatToKnow`.** Those two panels sit under Transaction's "What to Know Before You Start" grouping and exist on no other verified type. `article11Compliance` declares a `whatToKnow`. This is the same trade `U3` names from the other direction — that entry is about steps wanting a Transaction, this one is about a What-to-know wanting one. Opened 2026-08-16 by the transcript exporter's coverage check.                                                                                                                                                                                                                                                                                                                                        | Content decision                                           |
| `U24` | open     | **One button label exceeds the 25-character cap, which is now a rule rather than guidance.** `article11Guide`'s page-level Spotlight button reads "View Health Code Article 11" — **27 characters** (`pages/health-code-article-11.js:22`). Measured 2026-08-23 across all 18 `button` values in the corpus: it is the only one over, and every section- and step-level label is at or under 25. `U19` reported the corpus clean because it swept section- and step-level buttons only and never reached the page-level Spotlight. Under the 2026-08-15 precedence this was an off-guidance label that cost nothing; under the 2026-08-23 reversal (`O14`) it is a violation. Shorten it to 25 or fewer — "View Article 11" is 15 and keeps the sense — or record a Digital Services exception. Opened 2026-08-23 by the precedence reversal. | Content decision, or a Digital Services exception          |

---

## Obsolete and superseded claims

Requirement 6, second half. Each of these is currently stated somewhere in this repo and is wrong as
of 2026-08-15. They are listed rather than silently corrected because the corrections belong in the
files that carry them.

| ID    | Claim                                                                                                                     | Where it still appears                                                                         | Reality (2026-08-15)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ----- | ------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `O1`  | _"No mockup page currently declares `type: 'Campaign'`"_ and _"Campaign not modeled — `mosquitoWorkshop` is Information"_ | `docs/wagtail-content-mapping.md` §Campaign; `karl-content-type-field-reference.md` §HHVC gaps | **2 Campaign pages**: `ipmEducation`, `mosquitoWorkshop`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `O2`  | _"Campaign's `Related` is single-item, not repeatable"_                                                                   | superseded inline in `wagtail-content-mapping.md`; may survive in older `karl` notes           | Repeatable (`related_links`), corrected 2026-07-06                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `O3`  | _Related is restricted to 4 content types_                                                                                | Karl Help Center (unchanged upstream)                                                          | **Stands (E3).** The live picker is unrestricted, so a page of any type can be selected on the form — but the documented restriction to four content types is what to follow. `U12` is now a question about whether the form should be constrained, not about which source is right.                                                                                                                                                                                                                                                          |
| `O4`  | _"`Report` type — not in mockup"_                                                                                         | `karl-content-type-field-reference.md` §HHVC gaps                                              | `article11Guide` is a Report page with 7 table sections                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `O5`  | _"none of these types are used by any `pages/*.js` file in this repo"_ (of the 8 live-admin types)                        | `docs/wagtail-content-mapping.md` §Entirely unverified                                         | **Three of them are**: `Agency`, `About us`, `Report` — which is why `U8`–`U10` were opened, and why `U13` still matters after the 2026-08-15 sweep closed two of them at E3                                                                                                                                                                                                                                                                                                                                                                  |
| `O6`  | _"`pestsTopic` (`agency-service-grouping.js`) has 9 body sections"_, discussed as a Topic page                            | `docs/wagtail-content-mapping.md` §Topic practical implications                                | `pestsTopic` is now `type: 'Agency'` with **6** sections; the Topic page is `healthyHousingTopic`                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `O7`  | Type list _"`Agency`, `Transaction`, `Information`, `Resource Collection`, `Campaign`, `Report`"_                         | (Corrected in this PR: `AGENTS.md`, `CLAUDE.md`.)                                              | **8 types** — the list omits `Topic` and `About us`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `O8`  | Spot-check table naming `bedBugsInfo`, `ratsReport`, `preventHub` as the per-type exemplars                               | `karl-content-type-field-reference.md` §Spot-check                                             | None of those three keys exist in the current corpus                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `O9`  | _"There are 4 different components you can add in the 'Additional Content' section"_                                      | Karl Help Center, Campaign → Additional content (upstream)                                     | **Five.** The Help Center's own `embed-on-a-campaign-page` child page documents the fifth; the parent page is stale against its own children, and the child wins. The live form independently shows the same five                                                                                                                                                                                                                                                                                                                             |
| `O10` | Agency top-level field list omitting the agency-list checkbox                                                             | `docs/karl-live-admin-verification-2026-07-06.md` (E2)                                         | The Help Center adds **"Select to show page on agency list"** (a checkbox Digital Services controls) and records that the header image field is labelled **"Main image"**                                                                                                                                                                                                                                                                                                                                                                     |
| `O11` | Component availability matrix: **Callout: Yes** and **Accordions: Yes** for Report                                        | `docs/source/hhvc-policy/karl-content-type-field-reference.md` §Component availability matrix  | Report's `content` chooser offers **`Body` and `Table` only** (E1, 2026-08-15). `article11Guide` carries one callout that therefore has no home                                                                                                                                                                                                                                                                                                                                                                                               |
| `O12` | _"the form itself is a single 'Content' tab — no separate Promote/Settings tabs were shown"_                              | `docs/wagtail-content-mapping.md` §Information (and implied for the other four E1 types)       | Every one of the eight types is a three-tab `TabbedInterface`: Content, Promote, Settings. The Promote tab is where `seo_title`/`search_description` live                                                                                                                                                                                                                                                                                                                                                                                     |
| `O13` | Transaction panel order listing `custom_section` before `supporting_information`                                          | `docs/wagtail-content-mapping.md` §Transaction table                                           | The form's own panel order is `special_cases`, **`supporting_information`, `custom_section`**, `good_for_community`                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `O14` | _"Buttons can only be 25 characters long"_                                                                                | Karl Help Center, Button component (upstream)                                                  | **The 25-character cap is the rule (E3).** The live field carries `maxlength="255"`, measured 2026-08-15 on a Transaction `section_specifics` block, so a long label saves rather than failing — that is a gap in the form, not permission. Ten mockup labels exceeded the cap and all ten were shortened (`U19`). **One label still exceeds it**, measured 2026-08-23: `article11Guide`'s Spotlight button is 27 characters. `U19` counted only section- and step-level buttons and did not reach the page-level Spotlight. Opened as `U24`. |

`O7` is a canon change, so it followed the cross-tool rule: `AGENTS.md` first, then the `CLAUDE.md`
mirror. `.github/copilot-instructions.md` needed no change and got none — it is a deliberate pointer
file carrying no counts or lists, which is the convention that kept it from rotting the way the
other two did.

**`O3` was re-verified on 2026-08-15** by fetching the Related component page directly. The
four-type restriction text is byte-for-byte unchanged and is authoritative. Any mockup Related entry
pointing outside those four types needs re-pointing or a Digital Services exception.

---

## Sources

Every claim above traces to one of these. No row was authored from memory of how Wagtail usually works.

- `docs/wagtail-content-mapping.md` — live add-page-form captures, 2026-07-05 (E1) and the
  2026-07-06 corrections.
- `docs/karl-live-admin-verification-2026-07-06.md` — raw field names, Campaign `Related`
  repeatability, top-level field lists for the 8 additional types (E2).
- `docs/karl-help-center-research-2026-07-06.md` — Help Center corroboration (E3).
- `docs/source/hhvc-policy/karl-content-type-field-reference.md` — component availability matrix,
  editorial caps (Description ≤ 110 chars, Title ≤ 65, tables ≤ 3 columns).
- `docs/source/hhvc-policy/2026-08-08-karl-card-inheritance-verification.md` — what cards actually
  publish, measured on live sf.gov (E4).
- `build_scripts/schema.js` and `pages/*.js` — the mockup side, censused 2026-08-15 via
  `build_scripts/load-pages.js`.
- **Karl Editor Help Center, swept directly 2026-08-15** (E3) —
  `sfdigitalservices.gitbook.io/karl-sf.gov-editor-help-center`, 371 URLs enumerated, 14 fetched.
  This sweep is the source for everything marked E3 in the Agency, About us and Report sections,
  for the Spotlight cap table, and for `O9`/`O10`/`U16`/`U17`. Pages read:
  `content-types/building-a-page-by-content-type/` → `report/how-a-report-page-works`,
  `report/body-on-a-report-page`, `report/spotlight-on-a-report-page`,
  `about/how-an-about-page-works`, `about/information`, `about/resources-on-an-about-page`,
  `agency/how-an-agency-page-works`, `agency/services-on-an-agency-page`,
  `agency/resources-on-an-agency-page`, `campaign/additional-content`; plus `components/related`,
  `components/resources`, `components/spotlight`, `components/tables`.

- **Live Karl admin, captured 2026-08-15** (E1) — an authenticated, read-only session against
  `api.sf.gov/admin/pages/add/sf/<model>/2/` for **all seventeen** Karl content types — the eight in
  use at full depth, the other nine at panel-tree depth. Panel trees were read from
  each form's own `w-edit-handler-data` payload; StreamField choosers were opened in place to record
  their block types; Agency's `services` and About us's `about_info` were expanded two levels. **No
  form was submitted, saved or published** — every inserted block existed only in an unsaved form and
  was discarded by navigating away, and the session was left on the page explorer. This is the source
  for the raw-field-name table, the Promote-tab table, the Agency/About us/Report sections, the
  "Types not yet in use" section, and for `O11`–`O13` and the closure of `U7`–`U11`, `U13`–`U15`,
  `U17` and `U18`. A second pass on 2026-08-15 captured `Step by step`'s `steps` block and Event's
  `call_to_action`, and confirmed Transaction's `what_to_do` → `Section` shape — which together
  narrowed `U12` and `U16` to their published-output halves, and drove the 27-note rewrite
  recorded above.

**What each source is still for.** The Help Center governs how a page should be built, and it is
what a reviewer and an editor follow. It cannot supply raw Wagtail field names, panel order, or
required markers, and it does not enumerate every field a form carries — `api.sf.gov/admin/` sits
behind `sso/login`, so those come from an authenticated session and nowhere else. That is why the
E1 capture remains in this document rather than being retired: it fills the gaps the guidance does
not address, and it records where the form is more permissive than the rule, which is a finding
worth keeping rather than a conflict to resolve.

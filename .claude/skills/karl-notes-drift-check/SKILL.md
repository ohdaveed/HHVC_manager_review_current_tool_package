---
name: karl-notes-drift-check
description: Cross-check the karl placement notes in pages/*.js against the real Karl Editor Help Center documentation, to catch a mockup note that's gone stale, misstates a real schema constraint, or omits editorial guidance the docs actually state. Use when asked to check karl notes for drift, audit CMS placement claims, or verify a specific karl note's factual claim. Not a general "ask Karl a question" tool — see the scoping note below on what mcp__claude_ai_Karl__sendFeedback is and isn't for.
---

# Karl notes drift check

Every card, step, section, and callout across `pages/*.js` can carry a `karl`
string — a precise, CMS-technical note mapping the mockup's content onto a
real Karl (Wagtail) StreamField block, usually citing a specific field name,
a repeat/max constraint, or a confirmed schema gap (308 of these across the
repo as of 2026-08-15; see `grep -rn "karl:" pages/*.js`). They're written
once, by whoever built that page, and nothing re-checks them against the real
CMS afterward — so a note that was accurate when written can go stale
silently as Karl's schema or documented guidance changes.

**Check `docs/karl-export-field-map.md` first.** It is the E1 record of what
every Karl content type's editor form actually contains — UI labels,
navigation paths, block names, raw Wagtail field names, required markers,
repeatability, and how an internal page link differs from an external URL —
captured from the live admin on 2026-08-15 for all seventeen content types.
Most drift questions are answered there without any tool call, and it carries
an explicit register of what is still unresolved so you can tell a gap from
an answer.

**The Help Center is a weaker source than the live form, and this is not
theoretical.** `mcp__claude_ai_Karl__getPage` and `searchDocumentation` query
the **public Karl Editor Help Center** (a GitBook site,
`sfdigitalservices.gitbook.io/karl-sf.gov-editor-help-center`). It has been
wrong about this repo's own subject matter at least four times, each recorded
in the field map's obsolete register: it asserts Callout and Accordion support
on Report (`O11`), understates Campaign's `Additional content` block count
(`O9`), states a Related content-type restriction the live picker does not
enforce (`O3`/`U12`), and says buttons "can only be 25 characters" when the
field carries `maxlength="255"` (`O14`). **Where the two disagree about what a
form contains, the live form wins.**

**An earlier version of this skill said "there is no tool here that reads real,
currently-published SF.gov page content." That is no longer true**, and
believing it is what sends a session to the weaker source. Two routes exist:

- **The live Karl admin**, via Playwright MCP or a CDP-attached browser, at
  `https://api.sf.gov/admin/pages/add/sf/<model>/<parent_id>/`. Sign in through
  `https://api.sf.gov/sso/login?next=/admin/`. Read each form's own panel tree
  out of the `w-edit-handler-data` payload rather than scraping labels, and
  open a StreamField's "+" to record its block types. **Read-only: never
  submit, save or publish** — blocks inserted to inspect a chooser live only
  in an unsaved form and are discarded by navigating away.
- **Live rendered sf.gov pages**, which answer a different question: what a
  component actually _publishes_, as opposed to what its editor form is
  called. That distinction is why the card-inheritance rules are measured on
  rendered pages and cannot be derived from any form.

What the Help Center is still good for: editorial guidance the form does not
encode — button-text libraries, the one-button-per-page recommendation,
image dimensions, and the reasoning behind a component's intended use.

## What this catches, concretely (three real examples, checked 2026-08-07)

- **Confirmed accurate**: `mosquito-education-workshop.js`'s note that
  Spotlight "requires a Spotlight image (min 1080×350px)" — the docs'
  [Size and cropping specs](https://sfdigitalservices.gitbook.io/karl-sf.gov-editor-help-center/using-karl-the-cms/components/images/size-and-cropping-specs)
  page states Spotlight images are "Minimum 1080 px wide, Minimum 350 px
  height," exactly matching.
- **Confirmed accurate**: `lookup-building-records.js`'s note that "Resource
  Collection has no dedicated Related field (confirmed live)" — the
  [Related](https://sfdigitalservices.gitbook.io/karl-sf.gov-editor-help-center/using-karl-the-cms/components/related)
  component's docs list only Transaction, Information, Campaign, and Topic as
  taggable; Resource Collection is absent, corroborating the mockup team's
  claim.
- **Real gap found — in the mockup's note, not the docs**:
  `report-garbage-filth-vegetation.js` and
  `report-cockroaches-mosquitoes-insects.js` both describe `things_to_know`
  as "confirmed repeatable, no max." The docs'
  [What to know before you start section](https://sfdigitalservices.gitbook.io/karl-sf.gov-editor-help-center/using-karl-the-cms/content-types/building-a-page-by-content-type/transaction/what-to-know-before-you-start-section-cost-and-things-to-know)
  page says: "We recommend keeping it brief and no more than 2 items, if you
  can." The note isn't technically wrong (there's no hard schema max) but it
  omits real editorial guidance a reviewer relying on the note wouldn't know
  to check for.

## Procedure

1. `grep -rn "karl:" pages/*.js` to find notes. Prioritize ones making a
   **checkable factual claim** — a specific number, a "confirmed" or
   "no home in Karl" assertion, a named block/field — over notes that are
   pure open questions for the client team (see the scoping note below;
   those aren't checkable against documentation at all).
2. For each, `mcp__claude_ai_Karl__searchDocumentation` with a query built
   from the claim (block/component name + the specific attribute — image
   size, repeat limit, which content types support it). Follow a promising
   hit with `getPage` if the search snippet is too thin to judge.
3. Classify the result:
   - **Matches** — say so briefly; no action needed.
   - **Note is incomplete or outdated relative to docs** (like the
     `things_to_know` example) — this is a finding about the repo's own
     content, not a documentation problem. Report it plainly so the note can
     be tightened; don't call `sendFeedback` for it.
   - **Docs themselves look wrong, contradictory, or silent on something a
     mockup note relies on** — this is the one case `sendFeedback` exists
     for. Before calling it: re-read the doc page once to sanity-check you
     didn't just search the wrong term, and **always propose the exact
     `content` text to the user and get explicit confirmation before
     sending** — this posts to a real documentation team, is visible to
     others, and per `sendFeedback`'s own description is for reporting
     problems only, never for confirming a page is fine or for filing a
     product opinion.

## Scoping note: what has no automatable outlet here

39 of the 308 `karl` notes (as of 2026-08-15;
`grep -rn "karl:" pages/*.js | grep -iE "flag for|Digital Services|open question"`)
are phrased as open product/design questions **for Digital Services** — the
client team that owns this project, e.g. "flag for Digital Services if a
distinct heading is actually needed." `sendFeedback` reports issues in the
Help Center's _documentation_ to the people who maintain those docs — a
different audience entirely, with no channel to the client team. Don't
route these through `sendFeedback`; they have no automated outlet through
this MCP connection and need a human to actually raise them with Digital
Services. This skill's value is narrower and real: catching drift in the
checkable, factual subset of notes, not closing the loop on every open
question in the file.

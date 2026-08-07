---
name: karl-notes-drift-check
description: Cross-check the karl placement notes in pages/*.js against the real Karl Editor Help Center documentation, to catch a mockup note that's gone stale, misstates a real schema constraint, or omits editorial guidance the docs actually state. Use when asked to check karl notes for drift, audit CMS placement claims, or verify a specific karl note's factual claim. Not a general "ask Karl a question" tool — see the scoping note below on what mcp__claude_ai_Karl__sendFeedback is and isn't for.
---

# Karl notes drift check

Every card, step, section, and callout across `pages/*.js` can carry a `karl`
string — a precise, CMS-technical note mapping the mockup's content onto a
real Karl (Wagtail) StreamField block, usually citing a specific field name,
a repeat/max constraint, or a confirmed schema gap (242 of these across the
repo as of 2026-08-07; see `grep -rn "karl:" pages/*.js`). They're written
once, by whoever built that page, and nothing re-checks them against the real
CMS afterward — so a note that was accurate when written can go stale
silently as Karl's schema or documented guidance changes.

**Read this before using the Karl MCP tools here, because their names invite
a wrong assumption:** `mcp__claude_ai_Karl__getPage` and `searchDocumentation`
query the **public Karl Editor Help Center** (a GitBook documentation site,
`sfdigitalservices.gitbook.io/karl-sf.gov-editor-help-center`) — not a live
API into this project's actual Karl CMS instance. There is no tool here that
reads real, currently-published SF.gov page content. What you *can* verify is
whether a `karl` note's claim about Karl's **documented** capabilities and
constraints (block types, field limits, which content types support which
component) matches what the Help Center actually says.

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

53 of the 242 `karl` notes (as of 2026-08-07;
`grep -rn "karl:" pages/*.js | grep -iE "flag for|Digital Services|open question"`)
are phrased as open product/design questions **for Digital Services** — the
client team that owns this project, e.g. "flag for Digital Services if a
distinct heading is actually needed." `sendFeedback` reports issues in the
Help Center's *documentation* to the people who maintain those docs — a
different audience entirely, with no channel to the client team. Don't
route these through `sendFeedback`; they have no automated outlet through
this MCP connection and need a human to actually raise them with Digital
Services. This skill's value is narrower and real: catching drift in the
checkable, factual subset of notes, not closing the loop on every open
question in the file.

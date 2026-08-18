# SF.gov and Karl editor guidance — local snapshot

A captured snapshot of the public [SF.gov and Karl Editor Help
Center](https://sfdigitalservices.gitbook.io/karl-sf.gov-editor-help-center),
maintained by San Francisco Digital Services.

**Captured:** 2026-07-30. **Source index:** the site's own
`llms.txt` (371 pages), which GitBook publishes for machine consumption
alongside a `.md` version of every page.

## Why this exists

Two reasons, and the second is the load-bearing one.

**It grounds the plain-language scorer.** `js/standards/plain-language.js` encodes rules
from these pages plus `notebooklm/hhvc-standards-manual.md`. Every rule in that
file cites its source; this snapshot is where a reviewer checks the citation
without a network round-trip.

**It is the offline fallback for Karl grounding in the AI assist feature.**
There is no Karl CMS MCP server configured in this repository — the "Karl MCP"
referenced in `docs/wagtail-content-mapping.md` is a *documentation* MCP
(`searchDocumentation` / `getPage`) pointing at this same public GitBook, and it
lives in a contributor's private `~/.codex/config.toml`. So Karl grounding has to
degrade gracefully: when `KARL_MCP_URL` is unset, the AI service reads these
files instead. The tool must keep working with no network and no MCP, which is
the same posture every other optional layer in this repo takes.

## What is here

| File | Covers |
| --- | --- |
| `writing-and-style.md` | Content principles, readability, plain language, tone and voice, house style A-to-Z, page structure, the QA checklist, and SF.gov's own AI guidelines |
| `content-types-and-components.md` | The content types, how to choose one, and the component catalogue |

## Refreshing it

These are captures, not a mirror — they are organised for use as model context
rather than page-for-page. When Digital Services updates the Help Center,
re-fetch from the URLs cited inline in each file and note a new capture date
here. The site's `llms.txt` lists every page if something has moved.

## Standing conflicts with the HHVC standards manual

Where this guidance and `notebooklm/hhvc-standards-manual.md` disagree, **neither
has been silently picked**. Each conflict is recorded at the point of use in
`js/standards/plain-language.js` and left for a human:

- **Meta description length.** Manual §7.8 requires 110–160 characters;
  `index.html` and `getRuleResultsFor` require 110 or fewer. All 19 pages sit at
  87–109, so they cannot satisfy both. The scorer checks the opening verb only.
- **Reading level as a gate.** Manual §7.2.1 treats grade targets as
  publish-blocking; the Karl Readability page says a 5th-grade level "is not
  required on SF.gov, but it's a helpful guideline". Recorded already in
  `docs/wagtail-content-mapping.md:733-739`. The scorer treats it as advisory.
- **Heading levels.** Manual §7.4.1 says H3 for main sections and H4 for
  subheadings; the Karl Headings page says H2 for page titles and H3 for
  subheadings.
- **Bullet punctuation.** The A-to-Z guide says no punctuation within bullets;
  every bullet in `pages/*.js` ends in a period (115 of them). That is one
  house-convention decision, not 115 findings, so the scorer does not check it.
- **Contractions.** The manual bans them outright; the A-to-Z guide permits them
  in news and lighter content while avoiding negative contractions in service
  and instructional copy. HHVC pages are service copy, so the stricter manual
  rule governs and the scorer bans them.

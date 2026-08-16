# Live SF.gov snapshots (`sfgov-live`)

What SF.gov publishes **today** for the pages this redesign replaces, captured
so the AI can cite the live site rather than only the policy documents behind
it. Chunks from this folder are filed under the `sfgov-live` category.

**These are snapshots, not sources of truth.** A page here reflects one fetch on
one date; SF.gov can change the next day. Every file records the URL it came
from and the date it was fetched, in front matter, so a citation can be checked
and a stale capture is visible rather than silently authoritative.

**Why they are committed.** Retrieval has to be reproducible: an ingest run
should embed the same bytes a reviewer can open in the diff. A fetch-at-ingest
design would make the corpus depend on whatever the network returned that
minute, and a changed SF.gov page would look like a changed answer with no
commit to point at.

**This `README.md` is not ingested** — `build_scripts/knowledge-sources.js`
filters `README.md` out of every corpus folder, which is how these
folder-level notes stay out of the citable set.

## Refreshing a snapshot

Manual, deliberate, and never part of a build — the same posture as
`bun run ingest`. Re-fetch the page with Firecrawl (markdown, main content
only), replace the body below the front matter, update `fetched`, and commit
the diff. The diff **is** the record of what SF.gov changed.

Captured pages:

| File | Live URL | Karl content type |
| --- | --- | --- |
| `get-help-with-vermin-in-your-building.md` | `sf.gov/get-help-vermin-your-building` | `sf.Transaction` |
| `keeping-your-building-free-of-vermin.md` | `sf.gov/information--keeping-your-building-free-vermin` | `sf.Information` |
| `report-a-health-nuisance-or-hazards.md` | `sf.gov/report-health-nuisance-or-hazards` | `sf.Transaction` |
| `healthy-housing-conditions-topic.md` | `sf.gov/topics--healthy-housing-conditions` | `sf.Topic` |
| `environmental-health-agency.md` | `sf.gov/departments--department-public-health--environmental-health` | `sf.Agency` |
| `sfgov-structural-design-patterns.md` | (Cross-site structural patterns) | `sf.StructuralPatterns` |

The content type in that table is not a guess — SF.gov serves it as a `type`
meta tag on every page (`sf.Transaction`, `sf.Information`), which is a free
second confirmation of the Karl mapping the cookbook documents.

One editing note: navigation furniture is stripped ("Skip to main content", the
trailing "Did you find what you needed?"), and SF.gov's own duplicated
"What to know" block is left as-is rather than silently deduplicated — it is
what the page actually renders.

# Mockup Page Content Depth — Design

Date: 2026-07-02
Status: Approved (design); pending spec review

## Goal

Improve the **completeness and depth** of the content in all 17 mockup pages
(`pages/*.js`) of the HHVC Manager Review Mockup Tool. Pages that feel thin
should gain useful detail — clearer steps, "what to include" / "what to expect"
guidance, generic examples, reference tables, and clarifying notes — without
changing the tool's structure, rendering, or navigation.

This is a content-only change. No `js/`, `css/`, `index.html`, slug, `target`,
or navigation `order` changes.

## Constraints and guardrails (agreed)

- **Safe/generic depth only.** Do not invent specifics that are not already in
  the repo: no fee amounts, dollar values, deadlines/dates, phone numbers, or
  legal citations. Expand with guidance that is generally true and
  self-contained.
- **Reading level:** keep each page at its stated target (mostly Grade 5–6).
  Short sentences, plain words, active voice.
- **Scope:** HHVC / Article 11 only. Public content must not route users to
  non-HHVC issue paths.
- **Topic page banned terms:** the `pestsTopic` page must never contain
  `plumbing`, `dbi`, `roof leak`, `sewer`, `permit issue`, or
  `construction defect` (enforced by `build_scripts/validate.js`).
- **Preserve existing fields:** keep every existing `karl` note, `slug`,
  `type`, `summary`, `audience`, `reading`, SEO field, `target`, and the
  navigation `order`. Do not modify SEO fields (`seoTitle`, `metaDescription`,
  `primaryCta`) — that is a separate improvement dimension.
- **Add `karl` for new sub-elements.** Every new section/step/callout should
  carry a `karl` placement/rationale note so the manager-review UI stays
  accurate.
- **Additive only.** Prefer adding to existing sections/steps over rewriting.
  Do not delete existing user-facing content.

## Renderer-supported content shapes (source of truth: `js/page-render.js`)

All text is escaped (`escapeHtml`) — plain text only, no HTML/markdown.

Section-level fields that render:

- `paragraphs: string[]`
- `steps: Step[]` (ordered list)
- `bullets: string[]`
- `table: string[][]` (first row is the header row)
- `callout: { text: string, karl?: string }`
- `button` + `buttonTarget` + `buttonStyle`
- `cards: Card[]`

Step fields that render (`renderSteps`):

- `title: string`
- `text: string[]`
- `bullets: string[]`
- `button: string` (renders the primary CTA)
- `callout: { text, karl? }`

Card fields that render (`renderCards`):

- `title`, `text`
- `target` (must be an existing page key) OR `url` (external, opens new tab)
- `karl`

Only these shapes will be used to add depth. Any card `target` must resolve to
an existing page key (validated), so new cards will reuse existing pages only.

## Per page-type depth patterns

### Transaction / report pages

`report-rats-or-mice`, `report-cockroaches`, `report-bed-bugs`,
`report-mosquitoes`, `report-vegetation-garbage`,
`report-mold-humidity-condensation`

- Keep the single primary 311 CTA first; do not add competing CTAs.
- Enrich the "What to do" steps with clearer sub-detail and, where a real gap
  exists, a "Before you report" preparation bullet list.
- Expand the "what to include" checklist with generic, broadly-true items.
- Clarify "What happens next" (weekday processing, possible inspector contact,
  possible no-notice inspection for urgent risks) using existing framing.
- Add reassurance callouts where relevant and already implied: language access
  ("You can ask for help in your language"), accessibility, and
  no-retaliation — phrased generically, no new legal claims.

### Information / prevention pages

`keep-rats-and-mice-out`, `prevent-cockroaches`, `prevent-mosquitoes`,
`bed-bug-rules-prevention`, `reduce-indoor-moisture`,
`integrated-pest-management-property-managers`, `hhvc-inspection-scope`,
`what-happens-after-report`, `tenant-rights-reporting`

- Add a short "Why this matters" framing paragraph where missing.
- Add concrete, generic examples and step-by-step prevention detail.
- Add a "When to get help" / "When to report" pointer back to the relevant
  Transaction page (via existing `target`s).
- Use a reference `table` where it genuinely aids scanning (e.g., signs → what
  to do, or problem → prevention action). Keep tables small.

### Topic page

`agency-service-grouping` (key `pestsTopic`)

- Light touch. Add a few clarifying sentences only.
- Keep the four Hick's-Law clusters (report, prevent, inspect, tenant help) and
  the existing card set intact.
- Never introduce banned terms.

### Fee page

`pay-healthy-housing-fee`

- Add process/eligibility clarity and "what to have ready" guidance.
- Do NOT invent fee amounts, due dates, or penalties.

## Verification plan

Run after each batch of edits and again at the end:

1. `bun run validate` — Zod schema, `target` integrity, Topic banned terms,
   Topic-first ordering. Must print `validated 17 pages`.
2. `bun run format` — Prettier (no semicolons, single quotes, 2-space indent,
   100 print width, ES5 trailing commas).
3. `bun run build` — regenerate inventory + single-file exports (requires
   `data/` dir to exist; `mkdir -p data` first on a fresh clone).
4. Browser spot-check via the dev server (`bun run dev`, port 8080): load a few
   representative pages (a report page, a prevention page, the Topic page, the
   fee page) and confirm the new content renders and reads cleanly. Capture
   before/after screenshots and a short demo.

## Success criteria

- All 17 pages have noticeably more useful, on-scope detail than before.
- `bun run validate` passes with `validated 17 pages`; `bun run format:check`
  is clean; `bun run build` succeeds.
- No new invented specifics; reading level preserved; all `karl` notes present
  (existing preserved, new sub-elements annotated); no navigation/target/slug
  changes; Topic page free of banned terms.

## Out of scope

- SEO/metadata improvements (separate dimension).
- Structural/rendering changes, new page types, or new pages.
- Restructuring navigation or `order`.
- Any change to `js/`, `css/`, `index.html`, or build scripts.

# HHVC Manager Review Packet — 19-Page Agency IA

## Update summary

This package presents the consolidated **19-page** HHVC mockup set, led by a
**Healthy Housing and Vector Control Agency page** (PR #60). The earlier
33/40-page set — one Topic page plus many single-pest report and prevention
pages — was folded into a smaller, lower-choice information architecture:

- 1 Agency page (`pestsTopic` — key name retained from the Topic-page era for
  review-state and validation stability)
- 3 consolidated report Transactions: `rodentsReport`, `filthReport`,
  `insectsReport`
- Records lookup: `recordsHub`, `findRecords`, `findViolations`,
  `findHotelRecords`, `publicRecords`
- Owner-facing: `ownerHub`, `noticeOfViolation`, `payFee`, `ownerGuidance`
- Rights and process: `scopeInfo`, `article11Guide`, `afterReport`,
  `tenantRights`
- Mosquito programs: `mosquitoControl`, `mosquitoWorkshop`

Retired page keys redirect to their replacement pages via
`HHVC_DELETED_PAGE_ALIASES` in `js/page-data.js`, so old shared links still
resolve.

## Manager review focus

Review the Agency page first. Confirm that it:

- Uses the Karl page type: **Agency**
- Opens at `sf.gov/agency-healthy-housing-and-vector-control`
- Uses short, plain-language text for a 5th to 6th-grade reading target
- Keeps the public page limited to Article 11 / HHVC issues
- Does not add non-HHVC routing paths (no plumbing, DBI, roof leak, sewer,
  permit, or construction-defect content — `bun run validate` enforces this)
- Uses scannable service groups instead of one long mixed link list

Then work through the queue. The three consolidated report Transactions are
the highest-traffic pattern; confirm the "choose the closest problem" framing
holds up for each pest cluster.

## Pages with open SME/legal flags

These pages carry explicit `editorStatus` flags in `pages/*.js` and should not
be approved for publication until the flagged items are resolved (they can
still receive structural/content-direction decisions):

| Page                | Flag          | Open items                                                          |
| ------------------- | ------------- | ------------------------------------------------------------------- |
| `noticeOfViolation` | `blocked`     | NOV templates, appeal windows, contact routes, free-visit sequencing |
| `findHotelRecords`  | `placeholder` | Interim sfdph.org URL — confirm the real lookup entry point          |
| `mosquitoWorkshop`  | `placeholder` | Capacity, lead time, and intake backend are illustrative             |

Also outstanding: the real SF.gov payment URL for `payFee` (its CTA is inert
until confirmed) and the FY26–27 fee schedule PDF URL for `ownerHub`.

## Decision options

| Decision            | Meaning                                                          |
| ------------------- | ---------------------------------------------------------------- |
| Approved            | Manager accepts page structure and content direction.            |
| Approved with edits | Minor wording or ordering changes needed.                        |
| Revise and resubmit | Page needs structural, legal, or policy changes before approval. |
| Blocked             | Cannot proceed until a policy/source issue is resolved.          |

## Suggested automation handoff

Have managers export the all-page decision template CSV or current-page review
CSV from the review workspace. A Make.com scenario can watch the Drive folder
where exports are placed and update only manager-review columns in the master
workbook by `page_key` or `url_slug`.

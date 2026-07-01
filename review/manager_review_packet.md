# HHVC Manager Review Packet — Topic Page Update

## Update summary

This package converts **Pests and housing problems** from an Agency page section / service grouping into a **Topic page**.

The Topic page is now organized into four low-choice clusters:

1. Report a problem
2. Prevent pests and housing health problems
3. Know what HHVC can inspect
4. Tenant rights and help

## Manager review focus

Review the Topic page first. Confirm that it:

- Uses the Karl page type: **Topic page**
- Opens at `sf.gov/topic-pests-and-housing-problems`
- Uses short, plain-language text for a 5th to 6th-grade reading target
- Keeps the public page limited to Article 11 / HHVC issues
- Does not add non-HHVC routing paths to the Topic page
- Uses scannable clusters instead of one long mixed link list

## Pages affected by this update

- `pestsTopic` — converted Topic page
- `moldReport` — new transaction page for mold from humidity or condensation
- `scopeInfo` — revised to keep scope content focused on HHVC pest, vector, and housing health conditions

## Decision options

| Decision | Meaning |
|---|---|
| Approved | Manager accepts page structure and content direction. |
| Approved with edits | Minor wording or ordering changes needed. |
| Revise and resubmit | Page needs structural, legal, or policy changes before approval. |
| Blocked | Cannot proceed until a policy/source issue is resolved. |

## Suggested automation handoff

Have managers export the all-page decision template CSV or current-page review CSV from the sidebar. A Make.com scenario can watch the Drive folder where exports are placed and update only manager-review columns in the master workbook by `page_key` or `url_slug`.

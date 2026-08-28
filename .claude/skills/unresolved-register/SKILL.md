---
name: unresolved-register
description: "Close an unresolved register entry (U#) in `docs/karl-export-field-map.md`: understand the entry, verify with measurement, update mirrors, and coordinate multi-PR merges. Use this skill when closing a `U#` entry in `docs/karl-export-field-map.md`'s UNRESOLVED section, or when a precedence rule change requires updating register entries and mirrors (AGENTS.md, CLAUDE.md)."
trigger: "Use this skill when closing a `U#` entry in `docs/karl-export-field-map.md`'s UNRESOLVED section, or when a precedence rule change requires updating register entries and mirrors (AGENTS.md, CLAUDE.md)."
author: arrizon.david
source_sessions:
  - arrizon.david_arrizon.david's Organization_default_d7c985e8-d331-4af7-b82a-875634944d44
contributors:
  - arrizon.david
version: 1
created_by_agent: claude_code
created_at: 2026-08-24T15:05:50.517Z
updated_at: 2026-08-24T15:05:50.517Z
---

## When to use

Use this when:

- A `U#` entry in `docs/karl-export-field-map.md`'s UNRESOLVED register needs closure
- Fixing the gap requires measurement to verify (corpus scan, field count, etc.)
- A documentation precedence reversal requires updating mirrors and re-evaluating register entries

## The unresolved register

The register at the bottom of `docs/karl-export-field-map.md` documents known gaps explicitly. Each `U#` entry records: what the issue is, why it exists (precedence rule or discovery method), what closes it, and (once resolved) the date and what completed it.

## Workflow

### 1. Understand the entry

Read the `U#` row. It records:

- **What**: the specific gap (field exceeds cap, page type unmapped, etc.)
- **Closure**: the condition that closes it (content decision, exception, measurement, etc.)
- **Path**: the page and field (e.g., `article11Guide:22`)

### 2. Determine the fix

**Measurement gap**: use `build_scripts/load-pages.js` to scan the corpus, find affected items, fix them.  
**Content gap**: make the minimal change (not a UX redesign); mark it as a content decision.  
**Decision gap**: escalate rather than guessing.

### 3. Create a targeted fix PR

If the entry was opened by a feature PR, branch off that PR's feature branch (not main). This keeps the closure tied to its parent work.

### 4. Measure before and after

Before claiming the fix is done, measure:

- Count of items exceeding the rule (should go to 0)
- Longest item now under the rule
- Specific pages/fields that changed

Include the measurement in the PR description as evidence, not assumptions.

### 5. Update the register

In `docs/karl-export-field-map.md`:

- Mark the entry: `Status: Closed (YYYY-MM-DD)`
- If this closure completed an earlier sweep (e.g., finishes what U19 left short), update that entry to note it
- If closure makes an obsolete-register (`O#`) entry contradictory, update the `O#` entry to reflect new reality (never leave contradictions)

### 6. Update mirrors if precedence changed

If a rule precedence reversed (e.g., "Help Center now wins over measured data"):

- Update `docs/karl-export-field-map.md` with the new rule
- Update both mirrors: `AGENTS.md` (full section) and `CLAUDE.md` (summary)
- Update tests that encoded the old rule (e.g., `tests/karl-blocks.test.js`)
- Update JSDoc/prose mentioning the old rule

All four must agree — and **no test proves that they do.** Know what the gates
actually cover before citing one as evidence:

- `tests/mirror-consistency.test.js` checks that a registry of shared FACTS appears
  in all three instruction files, plus a short list of byte-identical sections. It is
  presence, not parity and not polarity: a mirror that keeps the token and reverses
  the sentence around it still passes. The file says so itself.
- `tests/doc-counts.test.js` and `build_scripts/doc-claims.js` compare selected
  number-anchored claims in the instruction docs against the filesystem. They do not
  read the unresolved register, and they do not verify a Karl field-map measurement.

So a green suite is evidence for those specific checks and nothing more. Semantic
agreement across the four artifacts is still a reading job, and the measurement
behind a closure is only as good as the command recorded in step 4.

### 7. Merge on stacked-PR repos

If merging into a feature branch (not main), merge through GitHub's documented
endpoint — `gh pr merge` is the supported path:

```bash
gh pr merge <number> --squash
```

There is no `merge-async` REST operation; `PUT /repos/{owner}/{repo}/pulls/{n}/merge`
is the underlying API if you need it directly.

Verify the rebase kept both halves:

```bash
bun run validate
bun run test
gh pr checks --watch
```

## Anti-patterns

- **Skipping measurement**: a fix that "looks right" leaves the entry stale
- **Forgetting mirrors**: updating only the field map creates three drifting versions of the rule
- **Leaving obsolete-register entries contradicted**: if closure invalidates an `O#` entry, update it (it documents reality)
- **Treating entries as cosmetic**: an unresolved entry is documented debt worth its own commit

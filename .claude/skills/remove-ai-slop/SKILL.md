---
name: remove-ai-slop
description: Find and remove AI slop from code and writing, then polish what remains. Slop is content that does not correspond to reality — dead files nobody references, helpers copy-pasted until the copies disagree, instructions that describe an architecture the project abandoned, prose that fills space without adding information. Use this whenever the user asks to clean up, polish, tighten, de-slop, consolidate, or "make this less AI-generated" — and also when they ask you to review work produced by AI agents, merge parallel AI-authored branches, audit a codebase for duplication or dead code, refresh stale docs, or edit AI-drafted prose. Reach for it proactively after several agents have worked on the same codebase in parallel, since that is where slop accumulates fastest.
---

# Remove AI slop

## What slop actually is

Slop is **content that does not correspond to reality** — either it never did, or it stopped and nobody noticed.

That definition matters because the obvious one is wrong. Slop is _not_ "text that is long," and it is _not_ "comments that explain things." Acting on that instinct is how a cleanup pass destroys the most valuable thing in a codebase.

A real example. A repo's contributor guide said:

> Write **detailed, explanatory** comments and docs, not terse ones. Comments justify the _why_ — product rationale, trade-offs, and exact WCAG contrast math in CSS — not restatements of the code.

Its modules opened with long header blocks explaining load-order hazards and past bugs. A pattern-matching "remove AI slop" pass would have stripped every one of them. They were the house style, they were correct, and they were the reason the code was maintainable. Meanwhile the actual slop in that repo was elsewhere: 625 lines of an unrelated design system's stylesheet that nothing imported, and an agent-instruction file telling contributors to use a CSS framework the project had never depended on.

**Length is not the signal. Correspondence to reality is.** Test every candidate against that.

## The discipline: evidence before deletion

Every removal needs a reason you can _show_ someone:

| Evidence                        | How you get it                                            |
| ------------------------------- | --------------------------------------------------------- |
| Nothing references it           | grep across the whole repo, including configs and docs    |
| It duplicates something exactly | `diff` the two, byte for byte                             |
| It contradicts the project      | quote the config, lockfile, or style guide it contradicts |
| Its claim is false              | measure the thing it claims                               |
| It is unreachable               | trace the call path                                       |

If you cannot name the evidence, you are editing to taste — and taste is exactly where a cleanup pass does damage. When you genuinely believe something should go but can't prove it, say so and let the user decide. "This looks like filler to me, but it may be deliberate" is a useful sentence. Deleting it silently is not.

## Workflow

### 1. Learn the project's conventions first

Skipping this is the single most common way a de-slop pass goes wrong, so do it before you look at a single candidate.

Read whatever the project uses to state its standards: `CLAUDE.md`, `AGENTS.md`, `CONTRIBUTING.md`, `.editorconfig`, linter and formatter configs, style guides, and — for prose — any voice or brand guide. Note anything the project explicitly asks for that a naive pass would strip.

**If the project names one of these canonical, read that one first and reconcile the rest toward it.** Projects that mirror their guide across several agent-instruction files usually say which is the source of truth, and the mirrors are exactly where stale claims accumulate — so a rule you find only in a mirror is a finding, not an instruction to follow.

**Whatever the project documents as intentional is protected.** If it says comments should be verbose, verbose comments are not slop. If it says a browser/Node pair is deliberately duplicated, that pair stays. You can still flag a documented convention you think is wrong, but flag it — do not quietly override it.

### 2. Gather candidates with evidence

Work through the taxonomies below. For each candidate, record what it is, where it is, and the evidence. Cheap mechanical checks first, since they find the highest-confidence items fastest:

```bash
# Files nothing else mentions — the strongest single signal. The script lives
# beside this file, so give its full path; your shell starts at the repo root,
# not in the skill directory. Exits 3 rather than reporting an empty result if
# a search fails. See its --help for options.
python3 <skill-dir>/scripts/find_unreferenced.py

# Are two files that look like copies actually identical?
diff -q path/a path/b

# Does a dependency the config recommends actually exist here?
grep -rn "tailwind\|flowbite" --include=package.json --include="*.css" .
```

It matches on basename, so it cannot rule on two files sharing a name — it lists
those separately as ambiguous. Check those by qualified path if you suspect them.

### 3. Check whether duplicate copies agree

When you find the same helper written more than once, **diff the copies before you consolidate them.** Duplication is untidy; duplication that has _drifted_ is a bug, and it is usually the most valuable thing a cleanup pass finds.

A real case: one module's HTML-escaping fallback escaped its input. Its sibling's returned the input unchanged. The two files were written by parallel agents that could not see each other, and the second was feeding externally-supplied strings into `innerHTML`. The consolidation was routine; discovering the divergence was the point.

So when copies disagree, work out which behavior is correct before unifying — the difference may be the defect, and picking the wrong side silently ships it.

### 4. Apply, smallest blast radius first

Sequence the work so a problem is easy to isolate and revert:

1. **Deletions** — dead files, orphans, contradictory config. No runtime surface.
2. **Corrections** — false claims, stale counts, broken instructions.
3. **Consolidations** — merging duplicates. Real behavior change; verify each.
4. **Polish** — structural and stylistic. Do last, when the noise is gone.

Group them into separate commits, each with its evidence in the message. A reviewer should be able to check any single claim without re-deriving your whole analysis.

### 5. Verify — measure, don't assert

Run whatever the project already gates on: formatter, linter, type check, test suite, build.

For a change that is _supposed_ to be behavior-preserving, saying "this preserves behavior" is not verification. Find a way to measure it:

- Refactoring CSS that merges duplicate rules? Capture the computed styles before and after and diff them. In the real case this came from, that diff showed exactly one change across fourteen selectors and two themes — the one intended fix. Every other property was byte-identical, which no amount of careful reading would have established.
- Refactoring a pure function? Run both versions over the same inputs and compare.
- Reorganizing prose? Extract the factual claims from both versions and diff the
  two sets. This is not optional ceremony: in a measured comparison, a careful
  edit that skipped this step silently dropped three dates from a status memo —
  the start date, the test date, and the completion commitment. Reading the
  result twice would not have caught it; `comm` over the extracted sets did.

### 6. Report honestly

Say what you removed, what you left, and what you deliberately did not touch. If you found something and decided it was _not_ slop, say that too — a rejected finding is a real result, and it stops the next person re-investigating it.

## Code slop

Deep detail and worked examples: `references/code-slop.md`. Read it when you are doing a substantial code pass.

The recurring patterns:

- **Orphans** — files nothing imports, references, or runs. Especially one-shot migration scripts that already ran, and generated artifacts from tools nobody uses anymore.
- **Foreign boilerplate** — config from a tool or template that contradicts the project. Instructions to use frameworks that appear nowhere in the dependency list.
- **Drifted duplicates** — the same helper written 2–3 times, copies no longer agreeing. See step 3.
- **Restated vocabularies** — one list of valid values written out in six places, sometimes as hand-maintained inverses of each other. Adding a value means finding all six.
- **Split declarations** — the same thing configured in two files, each specifying part of it, so neither describes what actually happens and deleting either breaks something invisible.
- **Dead abstractions** — a "reusable base" introduced once and then never used, while later code rolls its own.
- **Stale instructions** — docs describing an architecture the project has since replaced. Actively harmful: they cause wrong edits, confidently.
- **Fossil comments** — comments describing code that no longer exists, or a constraint that no longer applies.

## Prose slop

Deep detail and before/after examples: `references/prose-slop.md`. Read it when you are editing writing.

The tells, roughly in order of how much they cost the reader:

- **Filler openers** — "It's worth noting that", "In today's fast-paced world", "When it comes to X". Cut to the sentence's actual content.
- **Hedge stacks** — "may potentially help to some extent". One hedge is honest calibration; three is refusing to say anything.
- **Restating the question** — an opening paragraph that repeats the prompt back before starting.
- **Reflexive both-sidesing** — "there are pros and cons" where the evidence actually points one way. False balance is an accuracy problem, not a style one.
- **Empty summaries** — a closing paragraph that adds nothing, or a heading with a sentence under it that restates the heading.
- **Structural tics** — every paragraph three sentences, every list three items, every point bolded. The problem is _mechanical sameness_, not any single instance.
- **Padded scaffolding** — headers and bullets imposed on content that is one flowing paragraph.

A caution on word-level tells. Lists of "AI words" circulate — _delve_, _tapestry_, _testament to_, _not only… but also_, em-dashes. Some are genuinely overused, but hunting them mechanically produces stilted text and false positives, because these are also ordinary English that human writers use well. Judge the sentence, not the vocabulary. An em-dash is not slop; forty em-dashes all doing the same rhythmic job is.

## What to leave alone

Getting this list wrong is worse than doing nothing, because the deletions are silent and the loss is permanent.

- **Documented conventions.** Covered above, and worth repeating: the project's stated style wins.
- **Comments explaining _why_.** "Uses X because Y breaks under Z" is the highest-value comment there is and the hardest to reconstruct once gone. Comments restating _what_ the code does are fair game.
- **Bug archaeology.** "This looks redundant but removing it caused `<specific failure>`" is a warning left by someone who paid for the knowledge.
- **Defensive code that looks unreachable.** A guard for a case that "can't happen" may be why it doesn't. Trace it before cutting.
- **Deliberate duplication.** Sometimes two copies exist because a module boundary prevents sharing — CommonJS/ESM, browser/server, a schema mirrored across a network boundary. The fix is a test pinning them together, not a merge that breaks the boundary.
- **Domain-required repetition.** Legal, safety, accessibility and regulatory text is often repetitive by requirement. Do not tighten it without asking.
- **Precision that reads as hedging.** "Roughly 40%" may be the honest number. Cut the hedge only when the certainty is real.

## Verify claims before acting on them

If you are working from an audit, a review, or another agent's report, **check each finding against the source before you act.** Reports are confidently wrong often enough that this pays for itself.

In the session this skill came from, an audit reported that a panel rendered no empty state. The code rendered one unconditionally, and a test asserted it. Acting on that finding would have added dead code to fix a bug that did not exist. Rejecting it was a real result and belonged in the report.

## Output format

Lead with a findings table so the user can scan and object before anything is applied:

```markdown
## Findings

| #   | What                                      | Where                | Evidence                             | Proposed           |
| --- | ----------------------------------------- | -------------------- | ------------------------------------ | ------------------ |
| 1   | Orphaned stylesheet, 625 lines            | `.superdesign/…css`  | zero references repo-wide            | delete             |
| 2   | Escape helper written 3×, copies disagree | `js/a.js`, `js/b.js` | b's fallback returns input unescaped | consolidate on a's |

## Not slop — leaving alone

- Module header comments: `CONTRIBUTING.md` requires them.

## Rejected findings

- "Panel has no empty state" — it does, rendered unconditionally at `ops.js:105`.

## Verification

- <the project's own gates, with results>
- <measurement for anything claimed behavior-preserving>
```

## Audit and cleanup are different jobs

This skill triggers on both "clean this up" and "review what these agents did" — and those want different endings. **Match the ending to what was asked.**

- **A cleanup request** — clean up, polish, tighten, de-slop, consolidate — is authorization to edit. Present the findings, then apply them in the order from step 4. For a small, obvious cleanup the full table is too much ceremony: make the change and say what you did and why.
- **A review or audit request** — review, audit, check, "what's wrong with this" — is not. Stop at the report. Editing the branch you were asked to assess destroys the thing under assessment and pre-empts a decision that was the user's to make. Offer to apply the findings; do not apply them unasked.

When the request is genuinely ambiguous, report first and ask. That costs one exchange; the other error costs the user work they had not agreed to lose.

Either way, **anything irreversible or outside the stated scope needs explicit approval** — deleting files the user did not point you at, rewriting history, touching anything outside the path they named. A file that is out of scope but looks like slop gets flagged, not deleted.

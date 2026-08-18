# Inline link target validation

**Status:** design settled 2026-08-13, implementation in two PRs (see "Delivery" at
the end). Written up because the rationale below is the part the code cannot
explain — most of these decisions look arbitrary from the diff and are not.

## The problem

`js/inline-content-edit-link-tool.js` lets a reviewer wrap selected body copy in a
link by typing a target into an inline-toolbar input. `surround()` branches the
same way `formatMarkdown()` (`js/page-render.js:82`) does when it renders authored
`[label](target)` markdown: `/^https?:\/\//` becomes a real external anchor,
anything else becomes `<a data-render-target="…">`, which the mockup turns into an
in-page navigation button.

An external target is run through `safeUrl()` before it reaches the `href`. **An
internal target is not checked against anything at all.** Whatever the reviewer
typed becomes the `data-render-target` value verbatim.

That is a content-correctness hole, not a security one:

- A typo (`rodentsProbelm`) becomes a control that raises the red
  "Unknown page key" banner on click — a state a reviewer reads as corruption,
  produced by an ordinary spelling mistake.
- A `mailto:`/`tel:`/root-relative target — all things a reviewer can reasonably
  expect to work, and two of which `safeUrl()` itself permits — fails the
  `/^https?:\/\//` test, so it is treated as a page key and becomes a dead
  button.
- Nothing errors at any point. The link looks right in the editor, commits
  cleanly, persists, and only misbehaves when someone clicks it.

`bun run validate` never sees any of this. It walks `pages/*.js`, and a
reviewer-typed link lives in review state (`section_edits`), which is deliberately
never written back to source. So the browser-side check is the only check there
can be.

## What a target may be

**The vocabulary already exists — this feature adopts it rather than inventing
one.** `findBrokenInlineLinks()` (`build_scripts/data-checks.js:88`) defines what a
valid inline markdown target is for authored copy: an existing page key, an
`http(s)` URL, or the inert `#` sentinel. The link tool's own input placeholder
already reads "Page key or https://…". Inventing a second, wider vocabulary here
would mean a reviewer could type something the widget accepts and CI would reject
if the same text were ever moved into source.

**`mailto:`, `tel:`, and root-relative targets are excluded on purpose, even
though `safeUrl()` allows them.** Accepting them at the widget would not be
enough: `formatMarkdown()` would still render them as a `data-render-target`
button, because its branch is `/^https?:\/\//`. Making them work means widening
that regex — and `formatMarkdown()` renders authored copy on every page of the
mockup, so a change there has a far larger blast radius than a review-only widget
justifies. If those schemes are wanted later, the renderer is the place to start,
not this predicate.

**The key set is the live pages UNIONED with `pageRegistry.knownKeys()`.**
Corrected during implementation: the first version used `knownKeys()` alone,
on the assumption it was a superset. It is not — it returns only what the
registry itself holds (`added` plus `hidden`), so on a browser where the
reviewer has neither added nor deleted anything it is the empty array, and
every target was rejected including correct ones. The existing e2e link cases
caught it by ceasing to insert links at all.

Both halves are needed. `HHVC_DATA.pages` is what is in the mockup; the
registry's `hidden` keys are pages the reviewer deleted, which stay valid
targets because hiding is explicitly reversible — Restore is the affordance
that makes delete safe, and rejecting a link to a hidden page would let
deleting one page silently invalidate prose on every other page linking to it.
The union is built once, in `js/inline-content-edit-link-tool.js`'s
`linkableKeys()`, published on `window.InlineEdit` so the typed and pasted
paths cannot resolve different sets.

## Where the check runs

**In `commit()` (`js/inline-content-edit.js`), over the markdown the adapter just
produced — not inside the adapter.** `js/inline-content-edit-adapter.js`'s header
states its own design property: it is a pure serialization boundary with no
imports and no load-order dependency of its own. Teaching it what a page key is
would make a parsing module depend on a domain concept, and would add a
`knownKeys` argument to every caller and every case in
`tests/inline-content-edit-adapter.test.js` for no gain the predicate does not
already provide.

`commit()` is the better site for a reason beyond tidiness: **it is the one point
both typed and pasted links converge on.** A pasted anchor never touches
`commitLink()` — the tool's `static get sanitize()` allows `href` and
`data-render-target`, so Editor.js's sanitizer passes a copied link straight
through to the adapter with the toolbar closed. Guarding only the typed path would
leave the paste path exactly as broken as it is today.

**The check must run before any write.** `commit()` validates the adapter's
markdown output ahead of `setByPath` and ahead of the debounced autosave. Ordering
it after would mean the refusal loop (below) re-persists the broken link on every
blur — the guarantee would be cosmetic.

## The predicate

`js/inline-link-target.js`, dual-exported (`window.inlineLinkTarget` plus
`module.exports`) exactly like `js/review-merge.js`, `js/card-inheritance.js`,
`js/standards/plain-language.js` and `js/inline-content-edit-data.js`.

```js
isValidInlineLinkTarget(target, knownKeys) -> boolean
findInvalidInlineLinkTargets(value, knownKeys) -> string[]
```

**`safeUrl` is NOT folded in, reversing the original plan.** Measured rather
than assumed: `findBrokenInlineLinks`'s existing rule already rejects
`javascript:`, `data:` and protocol-relative targets, because none of them is a
page key, `#`, or http(s)-prefixed — and `SAFE_URL_SCHEMES` contains `https:`,
so no `https://`-prefixed string exists that `safeUrl` rejects. It would have
been an argument that never changes an answer, and there is consequently no
`bun run validate` tightening either. Sanitizing the string that reaches an
`href` is a different job and stays where it already is, at the write site in
`js/inline-content-edit-link-tool.js` and `js/page-render.js`.

That also moots the question of how to reach `safeUrl` from a dual-exported
module. The predicate imports nothing and reads no global, matching
`js/card-inheritance.js` and `js/standards/plain-language.js`, so it carries no
load-order dependency and adds no second `require(esm)` crossing on the Node
side (`build_scripts/data-checks.js:11` already has one, and CI never
exercises that crossing under Node — only Bun).

Reimplementing the rule inside either caller was rejected outright. Two copies
free to drift is the exact condition this consolidation exists to remove.

**The target is trimmed before testing.** `formatMarkdown()`'s capture is
`([^)]+)`, so a padded target arrives with its whitespace and the question the
rule asks is about the target, not whitespace hygiene. This is the refactor's
one behaviour change at `findBrokenInlineLinks`, and it reaches beyond authored
copy: that function also runs inside the AI output validator, where a
padded-but-valid target was one more way to reject a legitimate draft.

**`findBrokenInlineLinks()` is refactored onto the same predicate**, which tightens
`bun run validate`: authored inline markdown targets are now checked for scheme,
not only for resolvability. No page currently carries a target this rejects, so
the tightening is behaviour-neutral today — and a `javascript:` target in page
copy failing CI is the correct outcome, not a regression to guard against.

**The refactor must keep the key set a parameter, and must keep both AI-path
calls.** `findBrokenInlineLinks` is invoked twice by the AI validator, under
`__generated__` and `__generated_probe__`, with the broken-target results unioned —
because `data-checks.js` uses one `pages` object both as the walk target and as the
resolvable-key set, which made the draft's own sentinel key resolvable. Collapsing
those to one call reopens that hole.

## Refusing an invalid target

**Typed and pasted are different code paths and get different treatment, because
the reviewer's position differs.**

### Typed (`commitLink()`)

Refuse. Nothing is inserted, the target-entry input stays open, `aria-invalid` goes
on the input, and Enter retries. The alternatives were both worse: inserting the
link flagged `unverified: true` misuses a pill that means "a human should confirm
this claim" to mean "this control is broken", and dropping the link silently
discards what the reviewer was trying to do.

**The rule text is a permanently-present visually-hidden `<span>` inside
`actionsWrapper`, referenced by a standing `aria-describedby`.** Injecting the
description only while invalid makes a description behave like a live region;
a standing one is announced when focus first enters the field, so the reviewer
learns the rule before breaking it, and `aria-invalid` alone carries the state
change. `title`/`placeholder` were rejected — neither is reliably announced, and
`placeholder` disappears at the first keystroke.

**The datalist is populated in `showActions()`, not `renderActions()`.** The tool's
own header records that `renderActions()` runs once to build the element rather
than once per open. `pageOrder` changes at runtime whenever a reviewer adds or
deletes a page, so a list built once goes stale in exactly the session where a
reviewer created the page they now want to link to.

**Suggestions come from `pageOrder`; acceptance comes from `knownKeys()`.** The two
sets deliberately differ. Suggesting a page the reviewer just hid invites them to
link to something absent from the mockup; accepting it when typed exists only so an
existing link survives a delete/restore cycle. `#` is accepted but never suggested
— it is an authoring convention for placeholder copy, and putting it in a menu
advertises "make a link that does nothing" as a normal reviewer action. Options
carry `value` = page key and `label` = menu label, since the key is what the
attribute needs and the label is the only form the reviewer recognises.

### Pasted (`commit()`)

Refuse the whole commit, and offer an explicit way out. The widget commits on
`focusout`, so refusing means blur no longer ends the edit.

- **`aria-invalid` and `aria-describedby` go on the holder div**, not on the
  individual `<a>` elements — Editor.js rewrites the contenteditable's internals
  freely, so per-anchor state would not survive.
- **The "Remove broken links (N)" button is appended inside the holder.** That
  placement is load-bearing: the holder's `focusout` listener returns early when
  focus moves to a descendant (`js/inline-content-edit.js:733`), so focusing the
  button cannot re-fire `commit()`. One button for all of them rather than one per
  link — several buttons multiply the `aria-describedby` target problem inside a
  widget rendered inline in body copy, and a strip-one-per-press design makes the
  click count a function of a number the reviewer cannot see.
- **Focus returns to the contenteditable, caret in the offending block** — not to
  the button. Focus belongs where the reviewer's work is; the button is announced
  anyway by way of `aria-describedby`.
- **`Escape` keeps meaning full cancel.** The remove action is additive, never a
  replacement. Escape discarding everything is the rare, deliberate case; the
  button salvaging the good typing and nuking only the link is the common one.
  Forcing every reviewer through the button to preserve one guarantee is a worse
  trade than keeping both doors.

### Refusal mechanics

**The refocus is deferred and unbounded.** `.focus()` called synchronously inside
`focusout` is unreliable — focus is mid-transition — so it defers via
`setTimeout(0)`, the same idiom this file's render path already uses. Without the
refocus, neither the held-in-field behaviour nor the `aria-invalid` announcement
happens at all; the refusal would silently do nothing, which is the failure mode
this whole section exists to avoid.

It is deliberately not bounded to N attempts. A "refuse once, then let it through"
policy is the silent salvage this design rejected, reached by a counter the
reviewer cannot see; the loop ends when the link is fixed, removed, or Escape is
pressed.

**The deferred callback re-checks staleness before focusing.** A `setTimeout(0)`
can land after the reviewer has navigated (`j`/`k`, a page delete).
`EditorSession` already tests `!document.body.contains(this.holder)` for this
class of problem; the refusal callback needs the same guard, or it focuses a
detached node and strands the invalid-state markers on a dead holder.

**Refusal is disabled when the DOCUMENT has lost focus, keyed on
`document.hasFocus()`.** A tab switch, a devtools open or an OS-level window
blur still reaches `commit()`, and refusing there would fight the browser and
steal focus back the moment the reviewer returned to the tab — so the commit
runs with refusal off: it declines to write rather than declining to close.

The original design said to key this on `relatedTarget === null`, and that was
wrong. A null `relatedTarget` also describes the most ordinary exit there is —
clicking any non-focusable element, which is most of the mockup — so keying on
it disables the refusal in exactly the common case. Measured: the paste e2e case
blurs with no `relatedTarget`, and while it did, the refusal never fired.

**That check is not the only guard, because it could not be verified.** Whether
`document.hasFocus()` has already flipped to `false` by the time `focusout`
runs on a window blur is timing-dependent, and headless Chromium reports the
page as focused even with another tab brought to the front — so the branch is
unproven rather than measured. The deferred refocus therefore re-checks
`document.hasFocus()` itself, at the moment focus would actually be taken,
where the question has an unambiguous answer. Worst case, a window blur shows
a refusal notice the reviewer finds on return; focus is never stolen either
way.

## Explicitly out of scope

- **Editing an existing link's target.** Clicking the tool on linked text still
  only unlinks. Changing a target remains unlink, reselect, relink.
- **Widening the scope to headings/summary/title.** Those render through a bare
  `escapeHtml()` with no `formatMarkdown()` call, so a link typed there could never
  render as one. That is the existing design, not an omission.
- **Card descriptions.** They carry no `data-rewrite-field` at all, deliberately —
  see CLAUDE.md's "Card descriptions are inherited, not printed".

## Delivery

**PR 1 — consolidation, no reviewer-visible change.**

- `js/inline-link-target.js` with the injected-`safeUrl` predicate.
- `tests/inline-link-target.test.js`, written first (TDD), covering: a live page
  key; a hidden-but-known key; an unknown key; `#`; `http` and `https`; a
  whitespace-padded `https://` target (must pass); `mailto:`/`tel:`/root-relative
  (must fail, with the renderer reason recorded in the test name);
  `javascript:`/`data:`/protocol-relative; and the empty string.
- `build_scripts/data-checks.js` refactored onto it, key set still a parameter,
  both sentinel calls preserved.
- `package.json`'s explicit `test` list, plus `AGENTS.md`, `CLAUDE.md` and
  `.github/copilot-instructions.md` — `tests/doc-counts.test.js` asserts all three
  docs state the real unit-test count and that `CLAUDE.md` names every test file,
  each guarded by `claims.length > 0`, so a new test file that skips the doc edits
  lands red rather than merely undocumented.

Gate: `bun run validate` and `bun run test` green. Green `validate` is what proves
the tightening is behaviour-neutral for the current page corpus.

**PR 2 — the widget.**

- `showActions()` datalist population from `pageOrder`.
- `commitLink()` refusal, `aria-invalid`, the standing hidden description span.
- `commit()`'s pre-write guard, the holder-level invalid state, the
  "Remove broken links (N)" button, the deferred and staleness-checked refocus,
  and the null-`relatedTarget` exemption.
- Cases added to the existing `tests/e2e/inline-content-edit.spec.js` — the paste
  case injects the anchor via `page.evaluate` rather than simulating a clipboard,
  since what is under test is `commit()`'s reaction to an anchor being present,
  not the browser's paste implementation. The spec-file count is unchanged, so
  this PR carries no `doc-counts` obligation of its own.

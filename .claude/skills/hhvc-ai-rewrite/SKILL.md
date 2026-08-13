---
name: hhvc-ai-rewrite
description: HHVC repo: how the AI rewrite feature works — selection picks the FIELD not the substring, data-rewrite-field paths use the ORIGINAL section index, getByPath/setByPath prototype guards, popover clamping. Load before editing js/ai-rewrite*.js or anything touching data-rewrite-field addressing.
---

<!-- Extracted from CLAUDE.md/AGENTS.md on 2026-08-13. AGENTS.md remains the
     canonical copy of this content; see "Cross-tool canon" there. -->

# AI rewrite (optional)

A floating button that appears when a reviewer selects body copy in the mockup,
offering an AI rewrite of the containing field. `js/ai-rewrite.js` is the
orchestrator (selection, request lifecycle, apply/undo), `js/ai-rewrite-render.js`
the view (button, popover, positioning), and both ride the existing
`window.AiAssist.client`. Same posture as the rest of the AI surface: additive,
invisible unless `/api/ai/*` is configured, and it never writes to `pages/*.js`.

- **The selection picks the FIELD, not the substring.** `formatMarkdown()`
  escapes HTML and rewrites `[label](target)` into elements, so a DOM offset
  does not map back to an offset in the source markdown, and a selection
  spanning two elements has no coherent splice. The whole containing
  paragraph/bullet is sent and replaced; the popover shows it in full so the
  scope of the change is visible before the request, not after. The field text
  is read from page data via `getByPath`, never from `textContent` — the latter
  is rendered output.
- **`data-rewrite-field` paths use the ORIGINAL `page.sections` index.**
  `partitionSections()` redistributes sections into seven role buckets rendered
  in a fixed layout order, so render order is not source order. The index is
  captured onto a render-time shallow copy (`__sectionIndex`) inside that loop;
  a path built from render order rewrites the wrong section, silently. The
  regression test for this is mutation-proven — it was confirmed to FAIL against
  a deliberately render-order-broken renderer, because its first version's
  negative assertion passed trivially and proved nothing.
- **Annotation is opt-in per call site.** `paragraphList`/`bulletList`/
  `renderSteps` emit nothing without a path prefix, which is how the v1 scope
  (paragraphs, bullets, step text — not cards, tables, callouts, `whatToKnow`
  or spotlight) is expressed. Widening it is passing a prefix at one more call
  site, not editing the renderers.
- **`getByPath`/`setByPath` reject `__proto__`/`prototype`/`constructor`.**
  Without that, `setByPath(obj, '__proto__.x', v)` walked onto `Object.prototype`
  and wrote through it, polluting every plain object in the app — confirmed by
  exploit probe. These take paths straight from DOM attributes, which devtools
  can edit, so this is not hypothetical. `setByPath` also never creates
  intermediate objects: it returns `false` rather than inventing page structure
  no schema validated.
- **An applied rewrite is flagged `unverified: true`** with the reason
  "AI-rewritten draft — verify before publishing", reusing the schema's existing
  pill rather than a new AI-specific flag, so AI-touched copy is distinguishable
  from human-authored copy at a glance in the mockup itself. Undo is one step
  and consumed on use, matching `js/review-queue-undo.js`.
- **The popover's position is clamped unconditionally.** Anchoring below the
  selection (and flipping above) is a preference, not a guarantee: the mockup
  runs ~8,800px, so a selection below the fold yields a `rect` outside the
  viewport and BOTH anchors land off screen. An earlier version relied on
  `max-height: 70vh` plus internal scrolling, which bounds how tall the popover
  is and not where it sits — the Rewrite/Apply buttons rendered unclickable,
  reported by Playwright as simultaneously "visible, enabled and stable" and
  "outside of the viewport".
- **`generateRewrite()` is a SIBLING of `generateContent()`, not a
  generalization of it.** `generateRequestSchema` is a discriminated union on
  `task` because the branches genuinely differ — `content` requires `prompt`,
  `rewrite-field` requires `fieldText` and declares none. Folding the two into
  one dispatcher would risk the page-draft path for no gain. Note Zod's
  `z.object` STRIPS unknown keys rather than rejecting, so a stray `prompt` on a
  rewrite request is dropped, not a 400.
- **The validator checks link TARGETS, not whole links.** Rewording a link's
  visible label is the point of the feature; changing or dropping its target is
  a content regression nothing else would catch, so every dropped target is
  named back to the model for the existing one-retry loop.
- **`tests/e2e/ai-rewrite.spec.js` is the only layer that can cover this.**
  Both modules are browser-only IIFEs with no `module.exports`, so there is no
  unit layer beneath the e2e spec — the same structural gap the CSV/JSON import
  round-trip has.

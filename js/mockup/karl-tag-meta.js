// Shared Karl tag kind labels and legend markup. Loaded after js/core/utils.js so
// escapeHtml is available for legend rendering.

import { escapeHtml } from '../core/utils.js'
import {
  guideForContext,
  linkShapeMeta,
  unresolvedDescription,
} from '../karl/karl-guide-registry.js'

let guideId = 0

function nextKarlGuideId() {
  guideId += 1
  return `karl-guide-${guideId}`
}

function normalizeKarlGuide(options = {}) {
  return guideForContext(options)
}

function guideStatusLabel(guide) {
  if (guide?.unresolvedId) return `${guide.unresolvedId} unresolved`
  if (guide?.status === 'inherited') return 'Inherited value'
  if (guide?.status === 'mockup-only') return 'Mockup only'
  // Checked BEFORE the evidence line below, which would otherwise render an
  // inferred row's evidence tier as "U confirmed" — a contradiction in two
  // words, on the one badge whose job is separating a measured destination
  // from a chosen one.
  if (guide?.status === 'inferred') return 'Inferred — verify'
  return guide?.evidence ? `${guide.evidence} confirmed` : 'Review mapping'
}

function guideCopyValues(values = []) {
  return values
    .filter(
      (item) =>
        item &&
        typeof item.label === 'string' &&
        item.label.length > 0 &&
        typeof item.value === 'string'
    )
    .map((item) => ({ label: item.label, value: item.value, source: item.source || 'visible' }))
}

/* **Every element in this panel is phrasing content, and that is a constraint
   rather than a style.**

   The panel is emitted inside `<span class="karl-guide">`, which sits wherever
   its tag sits — inside an `<h3>`, an `<li>`, a table cell, or a paragraph. A
   `<span>` may contain only phrasing content, so the `<div>`/`<ol>`/`<p>`/`<h4>`
   this used to build were invalid there in every position, and inside a `<p>`
   they were actively destructive: the HTML parser closes an open paragraph when
   a block-level start tag arrives, so the panel escaped `.karl-guide` — the
   positioned ancestor it is absolutely positioned against — and opened
   somewhere else on the page, silently restructuring the reviewed mockup in the
   process.

   Three call sites hit exactly that and were fixed by moving the TAG out of the
   paragraph (renderAudienceFraming, renderTable's preview note,
   renderPrintVersion). That is a fix per call site, and there are 35+ of them;
   this is the same fix once, at the only place the panel markup is built. A
   future tag placed inside a paragraph now cannot break the page.

   Semantics are preserved with ARIA rather than lost: `role="list"` /
   `role="listitem"` keeps the steps announced as a list of N items, and
   `role="heading" aria-level="4"` keeps the values heading a heading. The
   ordinals the `<ol>` used to draw come from a CSS counter — see
   css/karl-guide.css, where they have to stay in step with this markup. */
/* The Field and Rules rows, built only from `guide.field` — which
   js/karl/karl-guide-registry.js populates from js/karl/karl-blocks.js, the
   transcribed inventory tests/karl-blocks.test.js guards against
   docs/karl-export-field-map.md. Nothing here restates a Karl fact; a wrong
   value has to be wrong in the inventory first, where CI can see it.

   Two rows rather than one because they answer different questions. Field
   answers "what am I typing into", and the raw Wagtail name is the half a UI
   breadcrumb cannot give — an editor comparing the mockup against an export, or
   reading a colleague's note, has the raw name and not the label. Rules answers
   "what will the form let me do", and it prints the field map's own words:
   `not recorded` is a real answer there and is NOT the same claim as
   `Optional`. See fieldMetaFor()'s header for why that distinction is the whole
   point.

   Phrasing content only, like the rest of this panel. */
function renderKarlGuideField(field) {
  if (!field) return ''
  const rules = [
    field.required ? `Required: ${field.required}` : '',
    field.repeatable || '',
    field.blockTypes || '',
  ].filter(Boolean)
  const rulesRow = rules.length
    ? `<span class="karl-guide-rules"><strong>Rules:</strong> ${rules
        .map((rule) => `<span class="karl-guide-rule">${escapeHtml(rule)}</span>`)
        .join('<span class="karl-guide-rule-sep" aria-hidden="true">·</span>')}</span>`
    : ''
  return `<span class="karl-guide-field"><strong>Field:</strong> <code>${escapeHtml(field.rawName)}</code><span class="karl-guide-field-label">${escapeHtml(field.uiLabel)}</span></span>${rulesRow}`
}

/* The guidance row. Separated from Rules by its own label word and its own
   class — never by colour alone, since colour is not an encoding a reviewer can
   read out loud, and this distinction is the one that decides whether a
   reviewer treats a number as something the form will enforce. */
function renderKarlGuideGuidance(guidance) {
  if (!guidance?.text) return ''
  const schema = guidance.schema
    ? `<span class="karl-guide-guidance-schema">${escapeHtml(guidance.schema)}</span>`
    : ''
  return `<span class="karl-guide-guidance"><strong>Guidance:</strong> ${escapeHtml(guidance.text)}${schema}</span>`
}

function renderKarlGuidePanel(guide, panelId) {
  const values = guideCopyValues(guide.values)
  const unresolved = guide.unresolvedId
    ? `<span class="karl-guide-unresolved"><strong>${escapeHtml(guide.unresolvedId)}:</strong> ${escapeHtml(unresolvedDescription(guide.unresolvedId))}</span>`
    : ''
  const valueRows = values.length
    ? `<span class="karl-guide-values"><span class="karl-guide-values-heading" role="heading" aria-level="4">Copy visible values</span>${values
        .map(
          (item) =>
            `<span class="karl-guide-value"><span class="karl-guide-value-body"><strong>${escapeHtml(item.label)}</strong><span class="karl-guide-value-source">${escapeHtml(item.source)}</span><code>${escapeHtml(item.value)}</code></span><button type="button" class="karl-guide-copy" data-karl-copy="${escapeHtml(item.value)}" aria-label="Copy ${escapeHtml(item.label)}">Copy</button></span>`
        )
        .join('')}</span>`
    : ''
  return `<span id="${escapeHtml(panelId)}" class="karl-guide-panel" role="group" hidden><span class="karl-guide-panel-header"><strong>Recreate in Karl</strong><span class="karl-guide-status">${escapeHtml(guideStatusLabel(guide))}</span></span><span class="karl-guide-steps" role="list">${guide.steps.map((step) => `<span role="listitem">${escapeHtml(step)}</span>`).join('')}</span>${guide.path ? `<span class="karl-guide-path"><strong>Path:</strong> <span>${escapeHtml(guide.path)}</span></span>` : ''}${renderKarlGuideField(guide.field)}${renderKarlGuideGuidance(guide.guidance)}${guide.linkShape ? `<span class="karl-guide-link-shape"><strong>Link shape:</strong> ${escapeHtml(linkShapeMeta(guide.linkShape)?.label || guide.linkShape)}</span>` : ''}${unresolved}${valueRows}</span>`
}
const KARL_TAG_KINDS = {
  meta: {
    label: 'Metadata',
    hint: 'Page type, title, summary, and program fields',
  },
  body: {
    label: 'Body',
    hint: 'Section headings, paragraphs, and structural content',
  },
  placement: {
    label: 'Placement',
    hint: 'Links, buttons, and card items — where content goes in Karl',
  },
  editor: {
    label: 'Editor only',
    hint: 'QA notes — do not publish',
  },
}

function karlKindMeta(kind) {
  return KARL_TAG_KINDS[kind] || KARL_TAG_KINDS.body
}

// Phrases the free-text `karl` notes in pages/*.js actually use (confirmed by
// grep against the real corpus, not guessed) to signal a note that is NOT a
// settled placement — an editorial hold, a missing Karl field, or an open
// question for Digital Services. Matching this only ever ADDS a badge to a
// tag that otherwise renders exactly as it would without a match: a false
// negative costs nothing (the note still displays in full), and there is no
// path where a match hides or rewrites content.
const GAP_LABEL_PATTERN =
  /\bBLOCKED\b|\bflag(?:ged)? for Digital Services\b|\bno clean mapping\b|\bdoes not fit\b|\bno dedicated\b/i

/**
 * Split a raw `karl` free-text note into display parts WITHOUT attempting to
 * fully parse it — the notes across pages/*.js use wildly inconsistent
 * conventions (`Field: value`, `Field = value`, `->` chains, bare rationale,
 * terse one-liners), so anything past the safest possible split would
 * misparse a meaningful fraction of the corpus and render worse than the
 * flat string it replaces.
 *
 * Only ONE separator is trusted as unambiguous: a `->`/`→` arrow, and only
 * when it appears in the note's OWN FIRST SENTENCE (before the first
 * `.`/`!`/`?`). An arrow appearing later, e.g. "...Heading → Title,
 * paragraphs → Text.", describes a field mapping in running rationale prose,
 * not a CMS location path, and must not be split as one.
 *
 * Every other note is only split at its first sentence boundary, so a short
 * "headline" clause can render bold/prominent and the rest renders as
 * supporting detail — never dropped, never hidden, always in original order.
 * If the resulting first "sentence" reads as noise (under 12 characters,
 * e.g. "Step." out of "Step type: number.") the next sentence folds in so
 * the headline never renders as a fragment.
 *
 * Validated against every karl string in pages/*.js during design: nothing
 * renders worse than today's flat string — in the worst case (no punctuation,
 * no arrow) `headline` is the whole trimmed string and `rationale` is ''.
 *
 * @param {string} label Raw karl string (unescaped — caller must escapeHtml
 *   every field of the return value before interpolating).
 * @returns {{breadcrumb: string[], headline: string, rationale: string, flagged: boolean}}
 */
function parseKarlLabel(label) {
  const text = typeof label === 'string' ? label.trim() : ''
  const flagged = GAP_LABEL_PATTERN.test(text)
  if (!text) return { breadcrumb: [], headline: '', rationale: '', flagged }

  const splitSentence = (s) => {
    const m = s.match(/^(.*?[.!?])(?:\s+(.*))?$/s)
    return m ? { head: m[1].trim(), rest: (m[2] || '').trim() } : { head: s.trim(), rest: '' }
  }

  const first = splitSentence(text)
  let breadcrumb = []
  let headline = first.head
  let rationale = first.rest

  const arrowParts = first.head.split(/\s*(?:->|→)\s*/)
  if (arrowParts.length > 1) {
    breadcrumb = arrowParts.slice(0, -1).map((s) => s.trim())
    headline = arrowParts[arrowParts.length - 1].trim()
  }

  if (headline.replace(/[.!?]+$/, '').length < 12 && rationale) {
    const next = splitSentence(rationale)
    headline = `${headline} ${next.head}`.trim()
    rationale = next.rest
  }

  return { breadcrumb, headline: headline.replace(/\.$/, ''), rationale, flagged }
}

function renderKarlTagLegend(variant = 'full') {
  const items = Object.entries(KARL_TAG_KINDS)
    .map(([kind, meta]) => {
      const swatch = `<span class="karl-tag karl-tag-legend-swatch" data-kind="${kind}"><span class="karl-tag-kind">${escapeHtml(meta.label)}</span></span>`
      if (variant === 'compact') {
        return `<li class="karl-tag-legend-item karl-tag-legend-item--compact" title="${escapeHtml(meta.hint)}">${swatch}</li>`
      }
      return `<li class="karl-tag-legend-item">${swatch}<span class="karl-tag-legend-desc">${escapeHtml(meta.hint)}</span></li>`
    })
    .join('')
  // The "reading a tag" notes only render for the full (Help-tab) variant —
  // the compact variant is a color key only, with no room for prose.
  const notes =
    variant === 'full'
      ? `<div class="karl-tag-legend-notes">
          <strong class="karl-tag-legend-title">Using the Karl guide</strong>
          <ul class="karl-tag-legend-notes-list">
            <li>Open a tag to follow numbered Karl admin steps and see the exact visible values.</li>
            <li>Copy buttons copy the displayed title, text, URL, or inherited destination value.</li>
            <li><strong>E1–E4</strong> identifies the evidence tier; <strong>U#</strong> means a decision is still required.</li>
            <li>Page references, Button links, Resources links, Campaign Related links, and Draftail links accept different fields.</li>
            <li><span class="karl-tag-inherit">Inherited value</span> means Karl reads the linked page; Related and Resource Collection entries are title-only.</li>
            <li>Audience, reading targets, QA metadata, and unresolved fields are mockup guidance, not publishable Karl fields.</li>
          </ul>
        </div>`
      : ''
  return `
    <div class="karl-tag-legend karl-tag-legend--${variant}" role="note" aria-label="Karl tag color key">
      <strong class="karl-tag-legend-title">Tag colors</strong>
      <ul class="karl-tag-legend-list">${items}</ul>
      ${notes}
    </div>
  `
}

/* mountKarlTagLegend() is gone along with both of its mount points.
   #karlTagLegendSidebar headed a permanent banner above the mockup — half a
   screen of colour key on every page load, decoding an encoding that was never
   colour-only, since each tag already names its kind in words. #karlTagLegendCompact
   had no element in index.html at all and had been a no-op for some time.
   js/review/dashboard-guidance.js now renders this legend once, in the Help tab, where
   reference material belongs. */

// Guarded so this module can be require()d from Node/Bun, which
// build_scripts/karl-vocabulary.js does to share GAP_LABEL_PATTERN rather than
// keep a second copy of it. An unguarded assignment threw "window is not
// defined" the moment anything server-side tried, and a validator that had to
// restate the pattern would be one more thing free to drift from the renderer
// — which is the class of problem that validator exists to catch.
if (typeof window !== 'undefined') {
  window.KARL_TAG_KINDS = KARL_TAG_KINDS
  window.karlKindMeta = karlKindMeta
}

export {
  GAP_LABEL_PATTERN,
  guideCopyValues,
  guideStatusLabel,
  karlKindMeta,
  nextKarlGuideId,
  normalizeKarlGuide,
  parseKarlLabel,
  renderKarlGuidePanel,
  renderKarlTagLegend,
}

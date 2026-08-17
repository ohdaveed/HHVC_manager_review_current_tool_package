// Shared Karl tag kind labels and legend markup. Loaded after js/utils.js so
// escapeHtml is available for legend rendering.

import { escapeHtml } from './utils.js'
import { guideForContext, linkShapeMeta, unresolvedDescription } from './karl-guide-registry.js'

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

function renderKarlGuidePanel(guide, panelId) {
  const values = guideCopyValues(guide.values)
  const unresolved = guide.unresolvedId
    ? `<p class="karl-guide-unresolved"><strong>${escapeHtml(guide.unresolvedId)}:</strong> ${escapeHtml(unresolvedDescription(guide.unresolvedId))}</p>`
    : ''
  const valueRows = values.length
    ? `<div class="karl-guide-values"><h4>Copy visible values</h4>${values
        .map(
          (item) =>
            `<div class="karl-guide-value"><div><strong>${escapeHtml(item.label)}</strong><span class="karl-guide-value-source">${escapeHtml(item.source)}</span><code>${escapeHtml(item.value)}</code></div><button type="button" class="karl-guide-copy" data-karl-copy="${escapeHtml(item.value)}" aria-label="Copy ${escapeHtml(item.label)}">Copy</button></div>`
        )
        .join('')}</div>`
    : ''
  return `<div id="${escapeHtml(panelId)}" class="karl-guide-panel" hidden><div class="karl-guide-panel-header"><strong>Recreate in Karl</strong><span class="karl-guide-status">${escapeHtml(guideStatusLabel(guide))}</span></div><ol class="karl-guide-steps">${guide.steps.map((step) => `<li>${escapeHtml(step)}</li>`).join('')}</ol>${guide.path ? `<p class="karl-guide-path"><strong>Path:</strong> <span>${escapeHtml(guide.path)}</span></p>` : ''}${guide.linkShape ? `<p class="karl-guide-link-shape"><strong>Link shape:</strong> ${escapeHtml(linkShapeMeta(guide.linkShape)?.label || guide.linkShape)}</p>` : ''}${unresolved}${valueRows}</div>`
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
   js/dashboard-guidance.js now renders this legend once, in the Help tab, where
   reference material belongs. */

window.KARL_TAG_KINDS = KARL_TAG_KINDS
window.karlKindMeta = karlKindMeta

export {
  guideCopyValues,
  guideStatusLabel,
  karlKindMeta,
  nextKarlGuideId,
  normalizeKarlGuide,
  parseKarlLabel,
  renderKarlGuidePanel,
  renderKarlTagLegend,
}

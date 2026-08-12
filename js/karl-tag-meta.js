// Shared Karl tag kind labels and legend markup. Loaded after js/utils.js so
// escapeHtml is available for legend rendering.

import { escapeHtml } from './utils.js'
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
 * fully parse it — the ~350 notes across pages/*.js use wildly inconsistent
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
          <strong class="karl-tag-legend-title">Reading a tag</strong>
          <ul class="karl-tag-legend-notes-list">
            <li><strong>Report Content › Table block</strong> — the CMS path, when the note names one.</li>
            <li>Bold text — the specific field or block.</li>
            <li>Lighter text below — the reviewer's placement rationale.</li>
            <li><span class="karl-tag-flag">Unresolved mapping</span> — an open question or editorial hold, not a settled placement.</li>
            <li><span class="karl-tag-inherit">Card text won't publish</span> — Karl renders the linked page's own title/description here instead of this card's fields.</li>
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

export { karlKindMeta, parseKarlLabel, renderKarlTagLegend }

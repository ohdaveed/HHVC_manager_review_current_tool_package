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
  return `
    <div class="karl-tag-legend karl-tag-legend--${variant}" role="note" aria-label="Karl tag color key">
      <strong class="karl-tag-legend-title">Tag colors</strong>
      <ul class="karl-tag-legend-list">${items}</ul>
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

export { karlKindMeta, renderKarlTagLegend }

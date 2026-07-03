// Shared Karl tag kind labels and legend markup. Loaded after js/utils.js so
// escapeHtml is available for legend rendering.
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

function mountKarlTagLegend() {
  const compactMount = document.getElementById('karlTagLegendCompact')
  const sidebarMount = document.getElementById('karlTagLegendSidebar')
  if (compactMount && !compactMount.dataset.mounted) {
    compactMount.innerHTML = renderKarlTagLegend('compact')
    compactMount.dataset.mounted = 'true'
  }
  if (sidebarMount && !sidebarMount.dataset.mounted) {
    sidebarMount.innerHTML = renderKarlTagLegend('full')
    sidebarMount.dataset.mounted = 'true'
  }
}

window.KARL_TAG_KINDS = KARL_TAG_KINDS
window.karlKindMeta = karlKindMeta
window.mountKarlTagLegend = mountKarlTagLegend

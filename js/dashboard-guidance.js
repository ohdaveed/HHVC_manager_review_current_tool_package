/* Dashboard guidance copy migration.
   Keeps descriptive review guidance near the page preview and trims repeated sidebar helper copy at runtime. */
;(function migrateDescriptiveTextToDashboard() {
  const GUIDANCE_ID = 'dashboardGuidancePanel'
  const STYLE_ID = 'dashboardGuidanceStyles'

  const guidanceItems = [
    {
      title: 'Review page patterns',
      text: 'Use the page selector or quick search to review rebuilt SF.gov page patterns for Environmental Health and HHVC.',
    },
    {
      title: 'Test wording safely',
      text: 'Edit the title, short summary, primary CTA, and search metadata in the sidebar. Changes stay local until you export or clear them.',
    },
    {
      title: 'Use Karl placement tags',
      text: 'Karl tags show where text belongs in the CMS. Visual boxes are mockup aids; the tag text controls placement guidance.',
    },
    {
      title: 'Export review decisions',
      text: 'Review exports download to your browser only. They do not publish pages or change source files.',
    },
    {
      title: 'Reading targets',
      text: 'Transaction pages target grade 5 to 6. Prevention pages target grade 6. Inspection and enforcement pages may use grade 6 to 8.',
    },
  ]

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;')
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return

    const style = document.createElement('style')
    style.id = STYLE_ID
    style.textContent = `
      .dashboard-guidance-panel {
        padding: 0.95rem 1rem 1rem;
        background: var(--sfds-white);
      }

      .dashboard-guidance-panel h3 {
        margin: 0 0 0.55rem;
        font-size: 1rem;
      }

      .dashboard-guidance-grid {
        display: grid;
        grid-template-columns: repeat(5, minmax(0, 1fr));
        gap: 0.55rem;
      }

      .dashboard-guidance-card {
        border: 1px solid var(--sfds-border);
        border-radius: var(--radius);
        background: var(--sfds-white);
        padding: 0.7rem;
      }

      .dashboard-guidance-card strong {
        display: block;
        margin-bottom: 0.2rem;
        color: var(--sfds-slate-1);
        font-size: 0.82rem;
        line-height: 1.25;
      }

      .dashboard-guidance-card span {
        display: block;
        color: var(--sfds-slate-3);
        font-size: 0.76rem;
        line-height: 1.35;
      }

      [data-migrated-dashboard-copy='true'] {
        display: none !important;
      }

      @media (max-width: 1180px) {
        .dashboard-guidance-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }

      @media (max-width: 720px) {
        .dashboard-guidance-grid {
          grid-template-columns: 1fr;
        }
      }
    `
    document.head.appendChild(style)
  }

  // Guidance copy is static (doesn't depend on the current page or review
  // state), so the panel is built once and mounted at a fixed position as a
  // permanent sibling of #reviewDashboardCore. It never needs to be found
  // and reinserted after a dashboard re-render.
  function buildGuidancePanel() {
    const panel = document.createElement('section')
    panel.id = GUIDANCE_ID
    panel.className = 'dashboard-guidance-panel'
    panel.setAttribute('aria-label', 'Review guidance')
    panel.innerHTML = `
      <h3>Review guidance</h3>
      <div class="dashboard-guidance-grid">
        ${guidanceItems
          .map(
            (item) => `
          <div class="dashboard-guidance-card">
            <strong>${escapeHtml(item.title)}</strong>
            <span>${escapeHtml(item.text)}</span>
          </div>
        `
          )
          .join('')}
      </div>
    `
    return panel
  }

  function mountGuidancePanel() {
    const helpPanel = document.getElementById('reviewWorkspaceHelp')
    if (!helpPanel || document.getElementById(GUIDANCE_ID)) return

    const panel = buildGuidancePanel()
    helpPanel.appendChild(panel)
  }

  function compactSidebarCopy() {
    const selectors = [
      '.sidebar-header + p',
      '.control-group:nth-of-type(2) .field-help',
      '.control-group:nth-of-type(3) > .details-body > .field-help',
      '.control-group:nth-of-type(4) > .details-body > .field-help',
      '.karl-help-nested',
      '.manager-review > .details-body > .field-help:first-child',
      '.control-group:last-of-type .details-body > p:first-child',
    ]

    selectors.forEach((selector) => {
      document.querySelectorAll(selector).forEach((element) => {
        element.setAttribute('data-migrated-dashboard-copy', 'true')
      })
    })
  }

  function refresh() {
    injectStyles()
    mountGuidancePanel()
    compactSidebarCopy()
  }

  // Guidance content and the sidebar copy it replaces are both static, so a
  // couple of delayed retries at startup are enough to catch #reviewDashboard
  // or the sidebar mounting slightly after this script runs. No
  // MutationObserver is needed since nothing else ever removes this panel.
  function init() {
    refresh()
    window.setTimeout(refresh, 0)
    window.setTimeout(refresh, 250)
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init)
  } else {
    init()
  }
})()

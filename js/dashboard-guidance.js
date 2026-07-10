/* Dashboard guidance copy migration.
   Keeps descriptive review guidance near the page preview and trims repeated sidebar helper copy at runtime. */
;(function migrateDescriptiveTextToDashboard() {
  const GUIDANCE_ID = 'dashboardGuidancePanel'
  const REFERENCE_ID = 'dashboardReferencePanel'
  const COMPLIANCE_RULES_ID = 'dashboardComplianceRulesPanel'
  const SHORTCUTS_ID = 'dashboardShortcutsPanel'
  const STYLE_ID = 'dashboardGuidanceStyles'

  // js/utils.js loads first (see index.html script order), so the shared
  // helper is always available.
  const { escapeHtml } = window.utils

  const guidanceItems = [
    {
      title: 'Review page patterns',
      text: 'Use the page dropdown in the sidebar, sticky-bar Previous/Next, or the Sitemap tab to move between mockups.',
    },
    {
      title: 'Overview vs Page checks',
      text: 'Overview scores every page in one table. Page checks shows the same 9 rules for only the page in the mockup.',
    },
    {
      title: 'Search metadata',
      text: 'Edit SEO title and meta description in the sidebar to test search-result wording. Changes stay local until you export or clear them.',
    },
    {
      title: 'Karl tag colors',
      text: 'Each tag shows its type (Metadata, Body, Placement, Editor only) and color. Purple = body structure. Yellow = CMS placement for links and cards. Blue = page metadata. Green = editor-only QA.',
    },
    {
      title: 'Export review decisions',
      text: 'Review exports download to your browser only. They do not publish pages or change source files.',
    },
    {
      title: 'Back up your reviews',
      text: 'Reviews save to this browser only. Use "Download backup (JSON)" to keep a copy, and "Import backup (JSON)" to restore it on another machine.',
    },
  ]

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
        grid-template-columns: repeat(auto-fill, minmax(13rem, 1fr));
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

      .dashboard-shortcuts-list {
        margin: 0;
        padding: 0;
        list-style: none;
        display: grid;
        gap: 0.35rem;
      }

      .dashboard-shortcuts-item {
        display: flex;
        flex-wrap: wrap;
        align-items: baseline;
        justify-content: space-between;
        gap: 0.35rem 0.75rem;
        font-size: 0.78rem;
        color: var(--sfds-slate-2);
      }

      .dashboard-shortcuts-keys {
        display: inline-flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 0.2rem;
      }

      .dashboard-shortcuts-keys kbd {
        border: 1px solid var(--sfds-border);
        border-radius: 4px;
        background: var(--sfds-slate-5);
        padding: 0.1rem 0.35rem;
        font-size: 0.72rem;
        font-weight: 700;
      }

      .dashboard-help-intro {
        margin-top: 0;
        margin-bottom: 0.65rem;
      }

      .dashboard-reading-target {
        margin-top: 0.65rem;
        font-weight: 600;
      }

      .dashboard-compliance-rules {
        margin: 0;
        padding-left: 1.1rem;
        color: var(--sfds-slate-2);
        font-size: 0.78rem;
        line-height: 1.45;
      }

      .dashboard-compliance-rules li + li {
        margin-top: 0.35rem;
      }

      [data-sidebar-copy-migrate='true'],
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

  // Guidance copy is static; mount once into the Help workspace tab panel.
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

  function buildComplianceRulesPanel() {
    const panel = document.createElement('section')
    panel.id = COMPLIANCE_RULES_ID
    panel.className = 'dashboard-guidance-panel'
    panel.setAttribute('aria-label', 'Karl compliance rules')
    panel.innerHTML = `
      <h3>Karl compliance rules (9)</h3>
      <p class="field-help dashboard-help-intro">
        Overview scores every page against these rules. Page checks shows the same rules for only
        the mockup page. Search metadata edits in the sidebar update checks for the open page.
      </p>
      <ol class="dashboard-compliance-rules">
        <li><strong>Page type</strong> — content type must be set</li>
        <li><strong>Title</strong> — present and 80 characters or fewer</li>
        <li><strong>Summary</strong> — present and 180 characters or fewer</li>
        <li><strong>Audience</strong> — at least one audience entry</li>
        <li><strong>Primary CTA</strong> — required for Transaction pages only</li>
        <li><strong>Related links</strong> — at least 3 linked cards or action links</li>
        <li><strong>SEO title</strong> — 60 characters or fewer</li>
        <li><strong>Meta description</strong> — 110 characters or fewer</li>
        <li><strong>Reading target</strong> — grade-level target must be set on the page</li>
      </ol>
    `
    return panel
  }

  function mountComplianceRulesPanel() {
    const helpPanel = document.getElementById('reviewWorkspaceHelp')
    if (!helpPanel || document.getElementById(COMPLIANCE_RULES_ID)) return

    helpPanel.appendChild(buildComplianceRulesPanel())
  }

  function buildShortcutsPanel() {
    const shortcuts = window.reviewKeyboardShortcuts?.list || []
    const panel = document.createElement('section')
    panel.id = SHORTCUTS_ID
    panel.className = 'dashboard-guidance-panel'
    panel.setAttribute('aria-label', 'Keyboard shortcuts')
    panel.innerHTML = `
      <h3>Keyboard shortcuts</h3>
      <p class="field-help dashboard-help-intro">
        Shortcuts pause while you type in a field. Press <kbd>?</kbd> anywhere to open the full
        shortcut dialog.
      </p>
      <ul class="dashboard-shortcuts-list">
        ${shortcuts
          .map(
            (shortcut) => `
          <li class="dashboard-shortcuts-item">
            <span class="dashboard-shortcuts-keys">${shortcut.keys
              .map((key) => `<kbd>${escapeHtml(key)}</kbd>`)
              .join(' ')}</span>
            <span>${escapeHtml(shortcut.description)}</span>
          </li>
        `
          )
          .join('')}
      </ul>
    `
    return panel
  }

  function mountGuidancePanel() {
    const helpPanel = document.getElementById('reviewWorkspaceHelp')
    if (!helpPanel || document.getElementById(GUIDANCE_ID)) return

    helpPanel.appendChild(buildGuidancePanel())
  }

  function mountShortcutsPanel() {
    const helpPanel = document.getElementById('reviewWorkspaceHelp')
    if (!helpPanel || document.getElementById(SHORTCUTS_ID)) return
    if (!window.reviewKeyboardShortcuts?.list?.length) {
      document.addEventListener('hhvc:shortcuts-ready', mountShortcutsPanel, { once: true })
      return
    }

    helpPanel.appendChild(buildShortcutsPanel())
  }

  // Static reference content moved out of the sidebar (see
  // docs/superpowers/specs/2026-07-06-dashboard-redesign-design.md): it never changes
  // per page, so it belongs with the other Help tab guidance, not among live edit
  // fields. Mounted once, same as buildGuidancePanel().
  function buildReferencePanel() {
    const panel = document.createElement('section')
    panel.id = REFERENCE_ID
    panel.className = 'dashboard-guidance-panel'
    panel.setAttribute('aria-label', 'Applied rules and reading targets')
    panel.innerHTML = `
      <h3>Review reminders</h3>
      <p class="field-help dashboard-help-intro">
        Personal per-page checklist for this browser tab only — click items to mark them off while
        you review. This is not an automated compliance score.
      </p>
      <ul class="checklist">
        <li><button type="button" class="check">SF.gov system typography and SFDS-style spacing</button></li>
        <li><button type="button" class="check">Action Blue for links and primary action</button></li>
        <li><button type="button" class="check">Agency page uses scannable service and resource groups</button></li>
        <li><button type="button" class="check">Article 11 / HHVC scope only</button></li>
        <li><button type="button" class="check">72-hour tenant notice where applicable</button></li>
        <li><button type="button" class="check">No standard photo requirement</button></li>
        <li><button type="button" class="check">Reporting routes through the 3 consolidated report pages</button></li>
        <li><button type="button" class="check">Enforcement pathway included without overloading Transaction pages</button></li>
        <li><button type="button" class="check">Tenant rights and anti-retaliation reassurance included</button></li>
      </ul>
      <h3>Reading targets</h3>
      <p>
        <strong>Transaction:</strong> Grade 5–6<br /><strong>Prevention:</strong> Grade 6<br /><strong
          >Inspection/process:</strong
        >
        Grade 6–7<br /><strong>Enforcement/NOV:</strong> Grade 7–8
      </p>
      <p class="field-help dashboard-reading-target" id="readingCurrent">
        Current page target: <span id="readingTargetValue">—</span>
      </p>
    `
    return panel
  }

  function mountReferencePanel() {
    const helpPanel = document.getElementById('reviewWorkspaceHelp')
    if (!helpPanel || document.getElementById(REFERENCE_ID)) return

    helpPanel.appendChild(buildReferencePanel())
    // The checklist markup used to be static in index.html, so ui-controls.js's
    // initChecklist() (bound once at bootstrap, before this script runs) found it
    // immediately. Mounted dynamically here instead, it needs an explicit (re-)bind
    // and a state sync for whichever page happens to be open right now.
    if (typeof initChecklist === 'function') initChecklist()
    if (typeof applyChecklistState === 'function') applyChecklistState(getCurrentKey())
    // #readingTargetValue is only written on page render (editor-panel.js); the
    // panel mounts lazily on first Help open, so sync it for the current page.
    if (typeof updateReadingTarget === 'function') {
      updateReadingTarget(window.HHVC_DATA?.pages?.[getCurrentKey()])
    }
  }

  function compactSidebarCopy() {
    document.querySelectorAll('[data-sidebar-copy-migrate="true"]').forEach((element) => {
      element.setAttribute('data-migrated-dashboard-copy', 'true')
    })
  }

  function refresh() {
    injectStyles()
    mountGuidancePanel()
    mountComplianceRulesPanel()
    mountShortcutsPanel()
    mountReferencePanel()
    compactSidebarCopy()
  }

  window.refreshDashboardGuidance = refresh

  function init() {
    // Only sidebar-visible effects run at load; the Help panels (~90 elements)
    // mount lazily via window.refreshDashboardGuidance when the Help tab opens
    // (setWorkspaceTab in js/ux-improvements-workspace.js).
    injectStyles()
    compactSidebarCopy()

    // If the workspace is already open on the Help tab when this init runs,
    // mount now — same belt-and-braces guard as the Overview queue's init.
    const workspace = document.getElementById('reviewWorkspace')
    const helpPanel = document.getElementById('reviewWorkspaceHelp')
    if (workspace && !workspace.hidden && helpPanel && !helpPanel.hidden) {
      refresh()
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init)
  } else {
    init()
  }
})()

/* Dashboard guidance copy migration.
   Keeps descriptive review guidance near the page preview and trims repeated sidebar helper copy at runtime. */

import { applyChecklistState, initChecklist } from './ui-controls.js'
import { renderKarlTagLegend } from './karl-tag-meta.js'
import { getCurrentKey } from './utils.js'
import { updateReadingTarget } from './editor-panel.js'
;(function migrateDescriptiveTextToDashboard() {
  const GUIDANCE_ID = 'dashboardGuidancePanel'
  const REFERENCE_ID = 'dashboardReferencePanel'
  const COMPLIANCE_RULES_ID = 'dashboardComplianceRulesPanel'
  const SHORTCUTS_ID = 'dashboardShortcutsPanel'
  const STYLE_ID = 'dashboardGuidanceStyles'

  // js/utils.js loads first (see index.html script order), so the shared
  // helper is always available.
  const { escapeHtml } = window.utils

  // A card is `{ title, text }`, or `{ title, html }` when it renders real
  // markup rather than a description of it.
  //
  // Two cards were removed rather than reworded. "Overview vs Page checks"
  // existed to explain why two tabs looked alike — a help card standing in for
  // a fix, and the tabs now differ (Overview triages the site, Page checks
  // scores the open page and no longer scores rules that cannot fail).
  // "Karl tag colors" described a colour key in prose; the key itself is below.
  const guidanceItems = [
    {
      title: 'Move between pages',
      text: 'Use the page dropdown in the sidebar, the sticky-bar Previous and Next buttons, or Open on any Overview row.',
    },
    {
      title: 'Search metadata',
      text: 'Edit SEO title and meta description in the sidebar to test search-result wording. Changes stay local until you export or clear them.',
    },
    {
      title: 'Karl tags',
      html: `${renderKarlTagLegend('full')}<span>Tags mark where each block is entered in Karl CMS — a bold headline names the field or block, lighter text below is the reviewer's rationale. Placement follows the tag text, not the shape of the mockup box around it. Toggle them with the switch in the toolbar.</span>`,
    },
    {
      title: 'Reviews live in this browser',
      text: 'Nothing here publishes a page or changes a source file. Decisions are saved to this browser only, so use Export reviews to keep a copy or move them to another machine.',
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

      /* DIRECT children only. A card is either a title plus its own text span,
         or a title followed by a whole embedded component — today the Karl tag
         legend, which arrived here when the legend moved out of the mockup and
         into Help. An unscoped descendant selector reached inside that
         component and restyled its parts: the .karl-tag-kind pills lost the
         deliberate --sfds-slate-2 they carry for contrast (3.78:1 on the pill
         fill, a WCAG 2.1 AA failure axe never saw because no scan opened this
         tab) and were forced to display:block, stacking pills designed to sit
         inline. Scoping to the child combinator keeps the intended styling for
         the text cards and stops the rule reaching into anything nested. */
      .dashboard-guidance-card > span {
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

      /* The explicit color is load-bearing. @sfgov/design-system ships a bare
         kbd element rule setting color to #1d4d70 — a hardcoded light-mode
         blue with no dark-mode counterpart — and an element selector outranks
         the inherited panel colour, so every key in this list rendered at
         2.09:1 on the dark background. Naming the token here is what removes
         the vendor colour from the cascade in both themes. */
      .dashboard-shortcuts-keys kbd {
        border: 1px solid var(--sfds-border);
        border-radius: 4px;
        background: var(--sfds-slate-5);
        color: var(--sfds-slate-1);
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
            ${
              /* item.html is markup this module builds itself (the Karl legend),
                 never reviewer- or import-supplied content — the escaped
                 item.text branch is what every other card takes. */
              item.html ? item.html : `<span>${escapeHtml(item.text)}</span>`
            }
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

  /**
   * Keep the collapsed AI assist / stored-data sections at the end of Help.
   *
   * They are authored in index.html, so they start as the Help panel's first
   * child, while every panel above mounts by appending. Re-appending an element
   * already in the DOM moves it, which puts them last without an `order` rule —
   * so the reading order a keyboard or screen-reader user gets still matches
   * what is on screen.
   */
  function moveAdvancedToEnd() {
    const helpPanel = document.getElementById('reviewWorkspaceHelp')
    const advanced = document.getElementById('reviewWorkspaceAdvanced')
    if (helpPanel && advanced && advanced.parentNode === helpPanel) {
      helpPanel.appendChild(advanced)
    }
  }

  function refresh() {
    injectStyles()
    mountGuidancePanel()
    mountComplianceRulesPanel()
    mountShortcutsPanel()
    mountReferencePanel()
    moveAdvancedToEnd()
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

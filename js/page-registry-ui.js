/* UI for the reviewer-managed page registry: the sidebar's "Add page…" /
   "Delete this page" controls, and the "Pages added and deleted" section at the
   end of the Help tab.

   A self-mounting IIFE in js/main.js's review/UX block, after
   js/dashboard-guidance.js — it reads window.pageRegistry (published by
   js/page-registry.js in the core block) and talks to nothing else through
   imports, matching every other layer here.

   TWO SURFACES, ON PURPOSE. The verbs live in the sidebar, directly under the
   page picker, because that is where a reviewer already is when they decide the
   page list is wrong. The LIST of what has been added or deleted lives in Help,
   with the other stored-state panels, because it grows and because a panel is
   not something a reviewer needs in view while judging a page. Neither gets a
   workspace tab: the strip was deliberately cut from six tabs to three, and
   every tab costs one of the 1-3 number-key shortcuts.

   Restore lives in the Help list rather than in a toast. showToast
   self-dismisses after 4 seconds and its own docblock argues that anything
   needing longer belongs in a persistent control — which is exactly why the
   review queue's undo sits in the bulk bar rather than in its action toast. A
   deleted page is recoverable for as long as the reviewer wants, so it needs the
   persistent control and not a second, worse copy of it. */

;(function mountPageRegistryUi() {
  if (typeof document === 'undefined') return

  const SIDEBAR_FORM_ID = 'pageAdminForm'
  const SIDEBAR_STATUS_ID = 'pageAdminStatus'
  const HELP_PANEL_ID = 'reviewWorkspacePages'

  /** Whether the Help list has been rendered at least once. */
  let mounted = false

  /**
   * The utils this module needs, resolved per call rather than at module scope.
   * Every one of them is present by the time this file mounts, but reading them
   * lazily keeps the file honest about the fact that it depends on globals
   * rather than imports, and makes the guards below meaningful.
   * @returns {object|null}
   */
  function utils() {
    return window.utils || null
  }

  /**
   * @param {*} value
   * @returns {string} HTML-safe text, or '' when utils has not loaded
   */
  function esc(value) {
    return utils()?.escapeHtml?.(value) ?? ''
  }

  /**
   * @returns {string} the page key currently displayed
   */
  function currentKey() {
    return utils()?.getCurrentKey?.() ?? ''
  }

  /**
   * Write the sidebar's status line.
   * @param {string} message
   */
  function setStatus(message) {
    utils()?.setText?.(SIDEBAR_STATUS_ID, message)
  }

  // -------------------------------------------------------------------------
  // The add-page form
  // -------------------------------------------------------------------------

  /**
   * Markup for the new-page form.
   *
   * The fields are exactly the six the page schema requires, plus the key and
   * an optional slug. Nothing more: a reviewer fills in sections, paragraphs
   * and bullets afterwards by clicking them on the rendered mockup, which the
   * inline content editor already handles. Duplicating that here would be a
   * second, worse editor.
   * @param {string[]} [errors] problems to show above the fields
   * @param {object} [values] values to keep in the fields after a failed submit
   * @returns {string}
   */
  function formHtml(errors, values) {
    const held = values || {}
    const types = window.pageRegistryData?.ALLOWED_PAGE_TYPES || []
    const errorHtml = errors?.length
      ? `<div class="page-admin-errors" role="alert">
           <p>This page could not be added:</p>
           <ul>${errors.map((error) => `<li>${esc(error)}</li>`).join('')}</ul>
         </div>`
      : ''

    return `
      <form id="pageAdminAddForm" novalidate>
        ${errorHtml}
        <label for="newPageTitle">Page title</label>
        <input type="text" id="newPageTitle" value="${esc(held.title)}" autocomplete="off" />

        <label for="newPageType">Page type</label>
        <select id="newPageType">
          ${types
            .map(
              (type) =>
                `<option value="${esc(type)}"${held.type === type ? ' selected' : ''}>${esc(
                  type
                )}</option>`
            )
            .join('')}
        </select>

        <label for="newPageSummary">Summary</label>
        <textarea id="newPageSummary" rows="2">${esc(held.summary)}</textarea>

        <label for="newPageAudience">Who this page is for — one per line</label>
        <textarea id="newPageAudience" rows="3">${esc(held.audience)}</textarea>

        <label for="newPageReading">Reading target</label>
        <input type="text" id="newPageReading" value="${esc(held.reading || 'Grade 6')}" />

        <label for="newPageKey">Page key</label>
        <input type="text" id="newPageKey" value="${esc(held.key)}" autocomplete="off" />
        <p class="field-help">
          Letters and numbers only, starting with a letter — for example
          <code>noiseComplaints</code>. Used in the page's URL and in exports, so it cannot be
          changed later.
        </p>

        <label for="newPageSlug">Slug (optional)</label>
        <input type="text" id="newPageSlug" value="${esc(held.slug)}" autocomplete="off" />
        <p class="field-help">Defaults to <code>sf.gov/</code> plus the title.</p>

        <div class="page-admin-form-actions">
          <button type="submit" class="tool-btn">Add page</button>
          <button type="button" class="tool-btn secondary-tool" data-page-admin="cancel-add">
            Cancel
          </button>
        </div>
      </form>`
  }

  /**
   * Show or hide the add-page form.
   * @param {boolean} open
   * @param {string[]} [errors]
   * @param {object} [values]
   */
  function setFormOpen(open, errors, values) {
    const host = document.getElementById(SIDEBAR_FORM_ID)
    const trigger = document.getElementById('addPageButton')
    if (!host) return
    host.hidden = !open
    host.innerHTML = open ? formHtml(errors, values) : ''
    if (trigger) {
      trigger.setAttribute('aria-expanded', open ? 'true' : 'false')
      trigger.textContent = open ? 'Cancel' : 'Add page…'
    }
    if (open) document.getElementById('newPageTitle')?.focus()
  }

  /**
   * Read the form back out of the DOM.
   * @returns {object}
   */
  function readForm() {
    const get = (id) => document.getElementById(id)?.value ?? ''
    return {
      key: get('newPageKey'),
      title: get('newPageTitle'),
      type: get('newPageType'),
      summary: get('newPageSummary'),
      audience: get('newPageAudience'),
      reading: get('newPageReading'),
      slug: get('newPageSlug'),
    }
  }

  /**
   * Validate and create. On failure the form is re-rendered with the reviewer's
   * values still in it — retyping six fields because one key collided is the
   * kind of small cruelty that makes a tool feel hostile.
   */
  function submitForm() {
    const values = readForm()
    const result = window.pageRegistry?.addPage?.(values)
    if (!result) return
    if (!result.ok) {
      setFormOpen(true, result.errors, values)
      document.querySelector('.page-admin-errors')?.scrollIntoView({ block: 'nearest' })
      return
    }
    setFormOpen(false)
    setStatus(`Added "${values.title}". Click any text on the page to edit it.`)
    window.showToast?.(`Added page "${values.title}"`, 'success')
    render()
  }

  // -------------------------------------------------------------------------
  // Delete
  // -------------------------------------------------------------------------

  /**
   * Build the delete confirmation.
   *
   * The inbound-link count is the part that earns its place. Once a page leaves
   * DATA.pages, cardDescription() in js/page-render.js stops resolving an
   * inheriting card's text from the destination and falls through to the card's
   * own authored `text` — precisely the copy the card-inheritance work exists to
   * prove can never publish. Nothing errors; a plausible paragraph simply
   * appears on a different page than the one the reviewer was working on. Naming
   * the count here is the only place that consequence is visible before the
   * fact.
   * @param {string} key
   * @param {string} title
   * @returns {string}
   */
  function deleteMessage(key, title) {
    const links = window.pageRegistry?.countInboundLinks?.(key) || {
      cards: 0,
      buttons: 0,
      pages: [],
    }
    const lines = [
      `Delete "${title}" from this mockup?`,
      '',
      'It leaves the page list, the mockup and the review queue. Your decision and notes for it ' +
        'are kept, and you can restore it from "Pages added and deleted" in the Help tab.',
    ]
    const total = links.cards + links.buttons
    if (total) {
      lines.push(
        '',
        `${total} link${total === 1 ? '' : 's'} on ${links.pages.length} other page${
          links.pages.length === 1 ? '' : 's'
        } point here (${links.pages.join(', ')}). Cards that would have shown this page's own ` +
          'title and summary will fall back to the text written on the card instead — which is ' +
          'text that cannot publish on the real site.'
      )
    }
    return lines.join('\n')
  }

  /**
   * Delete the page currently on screen, after confirming.
   *
   * Re-derives the target at click time rather than trusting anything rendered
   * earlier, and treats a missing window.confirm as "do not delete" — the same
   * discipline the orphan prune in js/review-ops.js applies, and for the same
   * reason: this is a destructive action and the inverted default would fire it
   * silently in any environment without a confirm.
   */
  function deleteCurrentPage() {
    const key = currentKey()
    const title = window.HHVC_DATA?.pages?.[key]?.title || key
    if (!key) return
    if (typeof window.confirm !== 'function') return
    if (!window.confirm(deleteMessage(key, title))) return

    const result = window.pageRegistry?.deletePage?.(key)
    if (!result?.ok) {
      const message = result?.error || 'That page could not be deleted.'
      setStatus(message)
      window.showToast?.(message, 'warn')
      return
    }
    setStatus(`Deleted "${title}". Restore it from the Help tab.`)
    window.showToast?.(`Deleted "${title}"`, 'info')
    render()
  }

  /**
   * Enable or disable the delete button for whatever page is open.
   *
   * pestsTopic is refused by js/page-registry.js regardless, but a button that
   * looks available and then explains itself in a dialog is worse than one that
   * says up front why it cannot be used.
   */
  function syncDeleteButton() {
    const button = document.getElementById('deletePageButton')
    if (!button) return
    const key = currentKey()
    const protectedKeys = window.pageRegistryData?.PROTECTED_PAGE_KEYS || []
    const isProtected = protectedKeys.includes(key)
    const isLast = (window.HHVC_DATA?.order?.length ?? 0) <= 1
    button.disabled = isProtected || isLast
    button.title = isProtected
      ? 'The HHVC agency page anchors the site and cannot be deleted.'
      : isLast
        ? 'This is the last page in the mockup.'
        : ''
  }

  // -------------------------------------------------------------------------
  // The Help list
  // -------------------------------------------------------------------------

  /**
   * One row in the Help list.
   * @param {{key: string, title: string}} entry
   * @param {string} meta secondary line under the title
   * @param {string} actions button markup
   * @returns {string}
   */
  function row(entry, meta, actions) {
    return `
      <li class="page-admin-row">
        <div>
          <strong>${esc(entry.title)}</strong>
          <span class="page-admin-key">${esc(entry.key)}</span>
          <p class="field-help">${esc(meta)}</p>
        </div>
        <div class="page-admin-row-actions">${actions}</div>
      </li>`
  }

  /**
   * Render the "Pages added and deleted" section.
   *
   * Both lists are re-derived from saved state on every render, never cached:
   * this panel can sit open in Help while a sync pull, a backup import or a
   * sidebar delete changes the registry underneath it.
   */
  function render() {
    const host = document.getElementById(HELP_PANEL_ID)
    if (!host) return
    mounted = true
    syncDeleteButton()

    const added = window.pageRegistry?.listAdded?.() || []
    const hidden = window.pageRegistry?.listHidden?.() || []

    const addedHtml = added.length
      ? `<ul class="page-admin-list">
          ${added
            .map((entry) =>
              row(
                entry,
                entry.hidden ? 'Added during review, then deleted.' : 'Added during review.',
                `<button type="button" class="review-queue-action" data-page-admin="open" data-page-key="${esc(
                  entry.key
                )}"${entry.hidden ? ' disabled' : ''}>Open</button>
                 <button type="button" class="review-queue-action" data-page-admin="remove" data-page-key="${esc(
                   entry.key
                 )}">Remove</button>`
              )
            )
            .join('')}
        </ul>`
      : '<p class="ds-empty">No pages have been added in this browser.</p>'

    const hiddenHtml = hidden.length
      ? `<ul class="page-admin-list">
          ${hidden
            .map((entry) =>
              row(
                entry,
                entry.wasAdded
                  ? 'Added during review, then deleted.'
                  : 'A mockup page, deleted during review. Its source file is untouched.',
                `<button type="button" class="review-queue-action" data-page-admin="restore" data-page-key="${esc(
                  entry.key
                )}">Restore</button>`
              )
            )
            .join('')}
        </ul>`
      : '<p class="ds-empty">No pages have been deleted.</p>'

    host.innerHTML = `
      <p class="field-help">
        Pages added or deleted here exist only in this browser, alongside your reviews. The
        mockup's source files are never changed. They travel to another machine through
        <strong>Export reviews → Everything, for another browser (JSON)</strong> — the CSV
        formats carry reviews but not pages.
      </p>
      <div class="ds-section-header"><h4 class="ds-section-title">Pages you added</h4></div>
      ${addedHtml}
      <div class="ds-section-header"><h4 class="ds-section-title">Pages you deleted</h4></div>
      ${hiddenHtml}`
  }

  /**
   * Restore a deleted page, re-deriving nothing from the rendered row but its
   * key.
   * @param {string} key
   */
  function restore(key) {
    const result = window.pageRegistry?.restorePage?.(key)
    if (!result?.ok) {
      window.showToast?.(result?.error || 'That page could not be restored.', 'warn')
      render()
      return
    }
    window.showToast?.('Page restored', 'success')
    render()
  }

  /**
   * Drop a reviewer-added page for good.
   *
   * The review record is deliberately left behind rather than deleted here.
   * Every other path in this tool merges rather than deletes, and there is
   * already exactly one sanctioned review-data deletion flow — the orphan prune
   * in "Stored review data on this browser", two sections up in this same panel,
   * which will offer this record once the page is gone. Adding a second way to
   * lose a review is not worth saving the reviewer one click.
   * @param {string} key
   */
  function removeAdded(key) {
    if (typeof window.confirm !== 'function') return
    const title =
      window.pageRegistry?.listAdded?.()?.find((entry) => entry.key === key)?.title || key
    const message =
      `Remove the added page "${title}" (${key}) from this browser?\n\n` +
      'The page and its content are deleted and cannot be restored. Any review you recorded ' +
      'for it is kept, and will be offered for removal under "Records for pages that no longer ' +
      'exist" in Stored review data.\n\nExport a backup first if you might need it.'
    if (!window.confirm(message)) return

    const result = window.pageRegistry?.removeAddedPage?.(key)
    if (!result?.ok) {
      window.showToast?.(result?.error || 'That page could not be removed.', 'warn')
      render()
      return
    }
    window.showToast?.(`Removed "${title}"`, 'info')
    render()
  }

  // -------------------------------------------------------------------------
  // Wiring
  // -------------------------------------------------------------------------

  /**
   * One delegated handler for both surfaces. Bound to `document` because the
   * Help panel's markup is replaced wholesale on every render, so per-button
   * listeners would need rebinding each time.
   * @param {MouseEvent} event
   */
  function handleClick(event) {
    const target = event.target
    if (!(target instanceof Element)) return

    if (target.closest('#addPageButton')) {
      const host = document.getElementById(SIDEBAR_FORM_ID)
      setFormOpen(Boolean(host?.hidden))
      return
    }
    if (target.closest('#deletePageButton')) {
      deleteCurrentPage()
      return
    }

    const action = target.closest('[data-page-admin]')
    if (!action) return
    const key = action.getAttribute('data-page-key') || ''
    switch (action.getAttribute('data-page-admin')) {
      case 'cancel-add':
        setFormOpen(false)
        break
      case 'open':
        window.renderPage?.(key)
        break
      case 'restore':
        restore(key)
        break
      case 'remove':
        removeAdded(key)
        break
      default:
        break
    }
  }

  /**
   * @param {SubmitEvent} event
   */
  function handleSubmit(event) {
    if (!(event.target instanceof Element)) return
    if (event.target.id !== 'pageAdminAddForm') return
    event.preventDefault()
    submitForm()
  }

  /**
   * Render on demand when the Help tab opens.
   */
  function ensureRendered() {
    render()
  }

  function init() {
    if (!window.pageRegistry) return
    document.addEventListener('click', handleClick)
    document.addEventListener('submit', handleSubmit)

    /* refreshUx() dispatches this after every render, so it is how the delete
       button learns which page is open, and how the Help list learns that a
       sync pull or an import changed the registry. Re-rendering the list only
       when Help is actually visible matches js/review-ops.js. */
    document.addEventListener('hhvc:review-data-changed', () => {
      syncDeleteButton()
      if (mounted && utils()?.isWorkspacePanelOpen?.('help')) render()
    })

    syncDeleteButton()
    window.__mountPageRegistryOnTabOpen = ensureRendered
    /* Catch-up for a reviewer who left Help open: js/ux-improvements.js
       initializes earlier and restores the persisted workspace_tab before this
       hook exists, so without this the panel would sit empty until they
       switched tabs and back. */
    utils()?.mountWorkspacePanelIfOpen?.('help', render)
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init)
  else init()
})()

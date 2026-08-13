/* Inline content editing: edit-widget markup. Sibling to
   js/inline-content-edit.js (the orchestrator, which owns click handling
   and the commit/cancel/undo lifecycle) — mirrors the ai-assist split
   (js/ai-assist.js + js/ai-assist-render.js). Loads before the orchestrator
   in js/main.js.

   Renders model-free, reviewer-authored text only (whatever the reviewer
   just typed), same trust level as every other reviewer-input field in this
   tool — escaped the same way the sidebar fields already are, via
   escapeHtml, not because this text is any less trusted than page copy but
   because it becomes part of page copy the moment it's committed. */
;(function mountInlineContentEditRender() {
  if (typeof window === 'undefined') return
  window.InlineEdit = window.InlineEdit || {}

  const { escapeHtml } = window.utils

  /**
   * Build a scalar field's Editor.js holder: an empty <div> Editor.js will
   * mount into, carrying the same data-rewrite-field the plain <input>/
   * <textarea> widget carries so decorateListControls()/decorateEditedFields()
   * and the click-delegation guards in js/inline-content-edit.js need no
   * changes to find it. `id` must be unique per open editor instance —
   * Editor.js's `holder` config takes an element id, and a stale id left
   * over from a previous edit on the same field would mount into a detached
   * node. `data-inline-edit-editorjs-holder` marks it for the single-block
   * chrome-suppression CSS in css/inline-content-edit.css.
   * @param {{path: string, id: string}} options
   * @returns {string}
   */
  function editorJsHolderHtml({ path, id }) {
    const escapedPath = escapeHtml(path)
    const escapedId = escapeHtml(id)
    return `<div class="inline-edit-input inline-edit-editorjs-holder" id="${escapedId}" data-rewrite-field="${escapedPath}" data-inline-edit-editorjs-holder data-inline-edit-input></div>`
  }

  /**
   * The "+ Add" control appended after the last item in an editable list
   * (a section's paragraphs or bullets).
   * @param {string} path dot-path of the array, e.g. 'sections.2.bullets'
   * @returns {string}
   */
  function listAddControlHtml(path) {
    const escapedPath = escapeHtml(path)
    return `<button type="button" class="inline-edit-add" data-inline-edit-add="${escapedPath}" data-export-exclude aria-label="Add item">+ Add</button>`
  }

  /**
   * The per-item "×" removal control.
   * @param {string} path dot-path of the array
   * @param {number} index the item's current index within the array
   * @returns {string}
   */
  function listRemoveControlHtml(path, index) {
    const escapedPath = escapeHtml(path)
    return `<button type="button" class="inline-edit-remove" data-inline-edit-remove="${escapedPath}" data-inline-edit-index="${index}" data-export-exclude aria-label="Remove this item">×</button>`
  }

  /**
   * The CSS-only "Edited" badge for title/summary/heading/CTA — fields with
   * no `unverified` schema slot to reuse the existing pill mechanism.
   * @returns {string}
   */
  function editedBadgeHtml() {
    return `<span class="inline-edit-badge" data-export-exclude>Edited</span>`
  }

  /**
   * The "Reset to original" control shown next to a field currently
   * displaying the Edited badge.
   * @param {string} path
   * @returns {string}
   */
  function resetControlHtml(path) {
    const escapedPath = escapeHtml(path)
    return `<button type="button" class="inline-edit-reset" data-inline-edit-reset="${escapedPath}" data-export-exclude>Reset to original</button>`
  }

  /**
   * The notice shown when a commit is refused because the field carries a
   * link pointing nowhere — the message plus the one way out.
   *
   * Returns a live element rather than an HTML string, unlike every other
   * function here, because the orchestrator appends it into the LIVE
   * Editor.js holder mid-session and attaches a listener to its button.
   * Building it from `innerHTML` would mean re-parsing a subtree Editor.js is
   * actively managing, and would hand back no node to bind to.
   *
   * The element carries `data-export-exclude` like the other reviewer-only
   * controls, so it can never leak into a mockup PNG export.
   *
   * @param {string} id The id `aria-describedby` on the holder will point at.
   * @returns {HTMLElement}
   */
  function brokenLinkNoticeElement(id) {
    const wrapper = document.createElement('div')
    wrapper.id = id
    wrapper.className = 'inline-edit-broken-links'
    wrapper.setAttribute('data-export-exclude', '')
    // Not role="alert": the holder's aria-describedby points here and focus
    // returns to the field in the same beat, so the text is announced on
    // arrival. An alert on top of that would say it twice.
    //
    // Built with createElement/textContent rather than innerHTML throughout.
    // The notice quotes link targets, and a pasted target is arbitrary text —
    // there is no markup in this notice, so there is no reason for an HTML
    // sink to exist on a path that handles it.
    const message = document.createElement('p')
    message.className = 'inline-edit-broken-links-message'
    message.setAttribute('data-inline-edit-broken-links-message', '')

    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'inline-edit-broken-links-remove'
    button.setAttribute('data-inline-edit-remove-broken-links', '')

    wrapper.appendChild(message)
    wrapper.appendChild(button)
    return wrapper
  }

  /**
   * Update an existing notice for the current set of broken targets.
   *
   * Both the message and the button label name the count, because the button
   * removes ALL of them in one press — a label reading "Remove broken link"
   * over three links would understate what pressing it does.
   *
   * @param {HTMLElement} noticeEl
   * @param {Array<string>} targets
   * @returns {void}
   */
  function updateBrokenLinkNotice(noticeEl, targets) {
    if (!noticeEl) return
    const count = targets.length
    const messageEl = noticeEl.querySelector('[data-inline-edit-broken-links-message]')
    const buttonEl = noticeEl.querySelector('[data-inline-edit-remove-broken-links]')
    if (messageEl) {
      // The offending targets are quoted so the reviewer can tell a typo from
      // a page they only thought existed — the count alone would leave them
      // hunting for which link is wrong.
      const quoted = targets.map((target) => `“${target}”`).join(', ')
      const subject = count === 1 ? 'link points' : 'links point'
      const object = count === 1 ? 'the link' : 'the links'
      messageEl.textContent =
        `This edit can't be saved yet: ${count} ${subject} nowhere (${quoted}). ` +
        `Fix the target, remove ${object}, or press Escape to discard the edit.`
    }
    if (buttonEl) {
      buttonEl.textContent = count === 1 ? 'Remove broken link' : `Remove broken links (${count})`
    }
  }

  window.InlineEdit.render = {
    editorJsHolderHtml,
    listAddControlHtml,
    listRemoveControlHtml,
    editedBadgeHtml,
    resetControlHtml,
    brokenLinkNoticeElement,
    updateBrokenLinkNotice,
  }
})()

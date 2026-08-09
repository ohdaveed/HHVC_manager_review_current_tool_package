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
   * Build a scalar field's edit widget: an <input> for single-line fields
   * (title, heading, CTA label) or a <textarea> for fields that can run
   * long (summary, a paragraph, a bullet).
   * @param {{tag: 'input'|'textarea', value: string, path: string}} options
   * @returns {string}
   */
  function scalarEditorHtml({ tag, value, path }) {
    const escapedPath = escapeHtml(path)
    if (tag === 'textarea') {
      return `<textarea class="inline-edit-input" data-rewrite-field="${escapedPath}" data-inline-edit-input rows="3">${escapeHtml(value)}</textarea>`
    }
    return `<input type="text" class="inline-edit-input" data-rewrite-field="${escapedPath}" data-inline-edit-input value="${escapeHtml(value)}" />`
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

  window.InlineEdit.render = {
    scalarEditorHtml,
    listAddControlHtml,
    listRemoveControlHtml,
    editedBadgeHtml,
    resetControlHtml,
  }
})()

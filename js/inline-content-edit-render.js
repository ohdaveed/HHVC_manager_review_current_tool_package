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

  window.InlineEdit.render = {
    editorJsHolderHtml,
    listAddControlHtml,
    listRemoveControlHtml,
    editedBadgeHtml,
    resetControlHtml,
  }
})()

// Core app state: validated page data shared across the tool's modules.
// Imported by js/ui-controls.js, js/editor-panel.js, js/page-render.js,
// js/app.js, and js/manager-review-export.js, all of which read these
// bindings directly. ES module imports are *live views* onto the exporting
// module's binding, so a reader that imported `currentPageKey` sees each
// new value without re-importing — the same visibility the old shared
// classic-<script> global scope gave us. Shared helpers (escapeHtml,
// getPrimaryCta, setPrimaryCta, ...) come from js/utils.js.
//
// The `./page-registry.js` import is for its side effect and is load-bearing
// twice over. It pulls in `./page-data.js`, which assigns window.HHVC_DATA
// (after pulling in all 29 pages/*.js files, which register themselves onto
// window.HHVC_PAGES) — so importing it here makes the ordering a property of
// the module graph rather than of a hand-maintained script-tag list, and the
// throw below can only ever fire on genuinely malformed page data.
//
// It then applies the reviewer's saved page registry: pages added in the
// browser are pushed onto `order`/`pages` and deleted ones are removed, BEFORE
// the ORIGINAL_DATA clone below. That sequencing is the point. ORIGINAL_DATA is
// taken exactly once, and computeSectionEdits() returns {} when a page has no
// entry in it — so a page added after this line would accept inline paragraph
// and bullet edits, autosave them, and silently lose them on the next load.

import './page-registry.js'
import { hasValidPageData } from './utils.js'

const DATA = window.HHVC_DATA
if (!hasValidPageData(DATA)) {
  throw new Error('HHVC mockup page data did not load or is malformed.')
}
const ORIGINAL_DATA = JSON.parse(JSON.stringify(DATA))
const pageData = DATA.pages
const pageOrder = DATA.order

// Published for js/sync/review-state-sync.js's restorePageContentFromOriginal,
// which resets a page's in-memory copy to its pristine state when adopting
// the server's version. It reads this through `window` rather than importing
// it so that module stays free of this one's page-data dependency chain —
// see the comment on that function for why the distinction matters.
window.ORIGINAL_DATA = ORIGINAL_DATA

// The page currently shown in the mockup viewer.
let currentPageKey = 'pestsTopic'

/**
 * Point the shared "current page" binding at a different page key.
 *
 * Exists because an ES module's imported bindings are read-only to the
 * importer: js/page-render.js used to assign `currentPageKey = key`
 * directly when the tool still shared one global lexical scope, and that
 * assignment is a TypeError once these files are modules. Routing the one
 * write through a setter defined here keeps the mutation in the module
 * that owns the binding, and every importer still observes it live.
 * @param {string} key
 * @returns {void}
 */
function setCurrentPageKey(key) {
  currentPageKey = key
}

export { DATA, ORIGINAL_DATA, currentPageKey, pageData, pageOrder, setCurrentPageKey }

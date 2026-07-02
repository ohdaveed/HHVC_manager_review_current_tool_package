// Core app state: validated page data shared across the tool's modules.
// Loaded before js/ui-controls.js, js/editor-panel.js, js/page-render.js,
// js/app.js, and js/manager-review-export.js, all of which read these
// top-level bindings directly (classic <script> tags share one global
// lexical environment, so `const`/`let` declared here are visible to
// scripts loaded afterward). Shared helpers (escapeHtml, getPrimaryCta,
// setPrimaryCta, ...) come from js/utils.js, which loads first.
const DATA = window.HHVC_DATA
if (!DATA || !DATA.pages || !DATA.order) {
  throw new Error('HHVC mockup page data did not load. Check script order in index.html.')
}
const ORIGINAL_DATA = JSON.parse(JSON.stringify(DATA))
const pageData = DATA.pages
const pageOrder = DATA.order

// The page currently shown in the mockup viewer.
let currentPageKey = 'pestsTopic'

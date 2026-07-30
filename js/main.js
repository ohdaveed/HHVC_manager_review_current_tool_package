/* Single entry point for the review tool.

   This module replaces the hand-maintained block of ~47 classic <script>
   tags that used to live in index.html. Those tags shared one global
   lexical scope, so their ORDER was load-bearing and silently breakable —
   `build_scripts/index-html-checks.js` existed purely to catch a file that
   had no tag, or a tag pointing at a file that no longer existed.

   The import list below encodes that same order explicitly, and the module
   graph now enforces it: a module that needs `escapeHtml` imports it, so it
   cannot run too early no matter what this file says. What remains
   order-sensitive is the group of self-mounting IIFE subsystems further
   down, which take no imports and communicate through `window.<Namespace>`
   objects — they still have to run after the core modules that create those
   namespaces, which is why they stay listed in their original sequence.

   Load-order dependency: this file is the root of the graph. Nothing
   imports it. */

// ---------------------------------------------------------------------------
// Styles. Vite resolves and bundles these, so the deployed build no longer
// depends on node_modules/ being present at runtime the way the old
// <link href="node_modules/..."> tags did.
// ---------------------------------------------------------------------------
import './../css/theme.css'
import '@sfgov/design-system/dist/css/base.css'
import '@sfgov/design-system/dist/css/typography.css'
import '@sfgov/design-system/dist/css/components.css'
import './../css/styles.css'
import './../css/ux-improvements.css'
import './../css/interactive-sitemap.css'

// ---------------------------------------------------------------------------
// Third-party libraries.
//
// These three used to arrive as browser globals: papaparse straight from
// node_modules/, and Fuse/defu as committed IIFE bundles under js/vendor/
// rebuilt by a `vendor:browser` npm script. Vite imports them from npm
// directly, so js/vendor/ and that script are both gone.
//
// They are re-published onto `window` here because their consumers still
// reach for them as globals behind `typeof X === 'undefined'` guards
// (js/utils.js's parseCsv, js/review-queue-rows.js's fuzzy search,
// js/ux-improvements-export.js's backup merge). Those guards are the
// documented fallback path that keeps each feature degrading gracefully
// rather than throwing, and they are exercised by the Node-side tests where
// no bundler runs — so the globals stay, and no consumer needed editing.
// ---------------------------------------------------------------------------
import Papa from 'papaparse'
import Fuse from 'fuse.js'
import { defu } from 'defu'

window.Papa = Papa
window.Fuse = Fuse
window.defu = defu

// ---------------------------------------------------------------------------
// Core modules, in dependency order. js/state.js pulls in js/page-data.js,
// which pulls in all 19 pages/*.js files, so importing it here is what
// populates window.HHVC_DATA before anything reads it.
// ---------------------------------------------------------------------------
import './utils.js'
import './karl-tag-meta.js'
import './page-data.js'
import './state.js'
import './ui-controls.js'
import './editor-panel.js'
import './page-render.js'
import './app.js'
import './manager-review-export.js'
import './review-state-validation.js'
import './reading-level.js'
import './review-state-store.js'
import './review-merge.js'
import './review-state-sync.js'

// ---------------------------------------------------------------------------
// Review/UX layers. Each is a self-mounting IIFE that reads window.HHVC_DATA
// and localStorage and attaches its own window.<Namespace>; they are additive
// on top of the core and must run after it. Order within this block still
// matters — the orchestrators (ux-improvements, review-queue,
// interactive-sitemap) assemble public APIs from the sibling files listed
// immediately above them.
// ---------------------------------------------------------------------------
import './ux-improvements-state-sync.js'
import './ux-improvements-workspace.js'
import './ux-improvements-export.js'
import './ux-improvements.js'
import './review-queue-state.js'
import './review-queue-rows.js'
import './review-queue-render.js'
import './review-queue-import.js'
import './review-queue.js'
import './dashboard-guidance.js'
import './interactive-sitemap-data.js'
import './interactive-sitemap-render.js'
import './interactive-sitemap.js'
import './keyboard-shortcuts.js'

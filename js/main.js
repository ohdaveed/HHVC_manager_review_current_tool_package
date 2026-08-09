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
   down, which communicate through `window.<Namespace>` objects — they still
   have to run after the core modules that create those namespaces, which is
   why they stay listed in their original sequence.

   "Take no imports" is what this used to say, and it is not true: only
   js/review-queue*.js takes none. The rest import js/utils.js helpers, so the
   graph orders them against the core on its own. The edge it cannot see, and
   the reason this order is still hand-maintained, is a `window.<Namespace>`
   one IIFE assigns and another reads at mount time.

   Load-order dependency: this file is the root of the graph. Nothing
   imports it. */

// ---------------------------------------------------------------------------
// Styles. Vite resolves and bundles these, so the deployed build no longer
// depends on node_modules/ being present at runtime the way the old
// <link href="node_modules/..."> tags did.
//
// ORDER MATTERS, and css/theme.css must stay LAST.
//
// theme.css is the semantic token layer, and its dark-mode block overrides the
// raw `--sfds-*` primitives that css/styles.css declares on :root. Custom
// properties resolve at use time, so a token can be *referenced* before it is
// declared without trouble — but when the same property is declared twice at
// the same specificity, the later declaration wins. Importing theme.css first
// (as it was) meant styles.css re-declared every --sfds-* afterwards and the
// entire dark theme silently did nothing.
// ---------------------------------------------------------------------------
import '@sfgov/design-system/dist/css/base.css'
import '@sfgov/design-system/dist/css/typography.css'
import '@sfgov/design-system/dist/css/components.css'
import './../css/styles.css'
import './../css/ux-improvements.css'
import './../css/ai-assist.css'
import './../css/dashboard.css'
import './../css/review-insights.css'
import './../css/review-ops.css'
import './../css/ai-rewrite.css'
import './../css/inline-content-edit.css'
import './../css/theme.css'

// ---------------------------------------------------------------------------
// Third-party libraries (papaparse, Fuse, defu), published onto `window` for
// the consumers that still read them as globals.
//
// This MUST stay first, and must stay a separate module rather than a few
// assignments in this file's body: a module body runs after every one of its
// static imports has evaluated, so inlining these would set the globals only
// after the review-queue modules had already mounted and rendered. See the
// header of js/third-party-globals.js for the failure that caused.
// ---------------------------------------------------------------------------
import './third-party-globals.js'

// ---------------------------------------------------------------------------
// Core modules, in dependency order.
//
// js/page-data.js imports all 19 pages/*.js files (each registering itself
// onto window.HHVC_PAGES) and then assembles window.HHVC_DATA. js/state.js
// side-effect-imports it for exactly that reason, so the ordering is already
// guaranteed by the module graph; listing page-data.js here as well is
// belt-and-braces documentation of the sequence, not what makes it work.
// ---------------------------------------------------------------------------
import './utils.js'
import './karl-tag-meta.js'
import './page-data.js'
import './state.js'
import './ui-controls.js'
import './editor-panel.js'
// BEFORE page-render.js: js/card-inheritance.js publishes window.cardInheritance
// and exports nothing, so a consumer cannot import a binding from it and the
// graph has no name to order by. js/page-render.js reads that global to decide
// whether a card renders its own text or the destination page's summary, and
// side-effect-imports this file itself so the ordering is genuinely enforced —
// this line is the same belt-and-braces documentation of the sequence that
// page-data.js above is, not what makes it work.
import './card-inheritance.js'
import './page-render.js'
import './app.js'
import './manager-review-export.js'
import './review-state-validation.js'
import './reading-level.js'
import './review-state-store.js'
import './review-merge.js'
import './inline-content-edit-data.js'
import './review-state-sync.js'

// ---------------------------------------------------------------------------
// Review/UX layers. Each is a self-mounting IIFE that reads window.HHVC_DATA
// and localStorage and attaches its own window.<Namespace>; they are additive
// on top of the core and must run after it. Order within this block still
// matters — the orchestrators (ux-improvements, review-queue) assemble
// public APIs from the sibling files listed
// immediately above them.
// ---------------------------------------------------------------------------
import './ux-improvements-state-sync.js'
import './ux-improvements-workspace.js'
import './ux-improvements-export.js'
import './ux-improvements.js'
import './review-queue-state.js'
// Undo before rows: applyQueueAction records its snapshot through this.
import './review-queue-undo.js'
import './review-queue-rows.js'
import './review-queue-render.js'
import './review-queue-import.js'
import './review-queue.js'
// Overview charts. After review-queue-render.js, which calls into it, and
// after review-queue-rows.js, whose getQueueRows() supplies its data.
import './review-insights-data.js'
import './review-insights.js'
// Ops/status tab. After review-state-sync.js, whose config it reports, and
// after the review layers whose state it inspects.
import './review-ops-data.js'
import './review-ops.js'
import './dashboard-guidance.js'

// Plain-language scoring and the AI-assist workspace tab. Same IIFE pattern as
// the layers above: no imports, mounted on window, so they must run after the
// core modules that publish the namespaces they read (window.renderPageMain
// for the draft preview, window.showToast for feedback).
import './plain-language.js'
import './ai-assist-client.js'
import './ai-assist-render.js'
import './ai-assist.js'
import './ai-rewrite-render.js'
import './ai-rewrite.js'
import './inline-content-edit-render.js'
import './inline-content-edit.js'

// PNG export of the mockups. Imported after the review layers because it uses
// window.showToast for progress and window.renderPage to step through pages.
import './mockup-image-export.js'

import './keyboard-shortcuts.js'

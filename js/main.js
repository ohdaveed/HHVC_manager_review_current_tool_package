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
   js/review/review-queue*.js takes none. The rest import js/core/utils.js helpers, so the
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
// raw `--legacy-*` primitives that css/styles.css declares on :root. Custom
// properties resolve at use time, so a token can be *referenced* before it is
// declared without trouble — but when the same property is declared twice at
// the same specificity, the later declaration wins. Importing theme.css first
// (as it was) meant styles.css re-declared every --legacy-* afterwards and the
// entire dark theme silently did nothing.
// ---------------------------------------------------------------------------
// Self-hosted @font-face declarations for the two typefaces the real
// www.sf.gov site renders (Roboto Flex for body, Roboto Slab for headings —
// confirmed against 7 live sf.gov pages, see css/theme.css's --font-body/
// --font-display comment). Latin-only subset: this repo works fully offline
// (including the build:singlefile export), so the fonts must be bundled
// rather than pulled from a CDN.
//
// Roboto Slab gets both weight 400 AND 700: SFDS's heading ladder is weight
// 700 throughout, and a browser asked for 700 with only 400 loaded doesn't
// fail — it synthesises bold by geometrically smearing the 400 outlines,
// which has different metrics and stroke contrast from the real face and
// reads as a rendering fault rather than a type choice (see
// tests/font-loading.test.js, which guards exactly this).
//
// Roboto Flex comes from a DIFFERENT package than Roboto Slab, and that
// asymmetry is deliberate — do not "tidy" it into a matching pair of static
// imports. @fontsource/roboto-flex (the static package, like roboto-slab
// above) is generated from the variable Roboto Flex source and its own
// metadata documents exactly one static weight — `weights: [400]` — at any
// version, so there is no latin-700.css it could ever ship. Roboto Flex
// itself IS a variable font upstream; the static package is a single frozen
// instance of it. @fontsource-variable/roboto-flex ships the real variable
// file instead — one face whose `font-weight` range is `100 1000` — so it
// replaces the static 400 rather than adding to it, and incidentally fixes
// every OTHER weight this tool ever asks for, not just 700: bold body copy
// (.eyebrow, .brand, .table th, .tool-btn, …) was rendering synthesised bold
// the whole time the static package was in use. `wght.css` rather than the
// bare default/`full.css` is deliberate too: it loads only the weight axis,
// not the optical-size/slant/width/grade axes this design never varies.
//
// The package swap has one consequence that reaches beyond this file:
// @fontsource-variable packages register a DIFFERENT font-family name than
// their static counterparts — 'Roboto Flex Variable', not 'Roboto Flex' —
// a Fontsource convention that lets a project depend on both at once
// without one silently shadowing the other. Every place that names the
// sans family (the sans token in css/sfds.css, --font-body/--font-caption
// in css/theme.css, the vendored docs/source/sfds/tokens.json capture and
// its disagreements.md entry) had to move to the new name together with
// this import, or the browser falls back to the system sans with nothing
// visibly broken. tests/e2e/mockup-tokens.spec.js asserts the ACTUAL
// consequence via `document.fonts.check('700 16px "…"')`, since a package
// swap that gets only the string right and the runtime face wrong is
// exactly the failure mode this whole change exists to close out.
import '@fontsource-variable/roboto-flex/wght.css'
import '@fontsource/roboto-slab/latin-400.css'
import '@fontsource/roboto-slab/latin-700.css'
import '@sfgov/design-system/dist/css/base.css'
import '@sfgov/design-system/dist/css/typography.css'
import '@sfgov/design-system/dist/css/components.css'
import './../css/sfds.css'
import './../css/styles.css'
import './../css/ux-improvements.css'
import './../css/ai-assist.css'
import './../css/dashboard.css'
import './../css/review-insights.css'
import './../css/review-ops.css'
import './../css/ai-rewrite.css'
import './../css/inline-content-edit.css'
import './../css/karl-guide.css'
import './../css/theme.css'

// ---------------------------------------------------------------------------
// Third-party libraries (papaparse, Fuse, defu), published onto `window` for
// the consumers that still read them as globals.
//
// This MUST stay first, and must stay a separate module rather than a few
// assignments in this file's body: a module body runs after every one of its
// static imports has evaluated, so inlining these would set the globals only
// after the review-queue modules had already mounted and rendered. See the
// header of js/core/third-party-globals.js for the failure that caused.
// ---------------------------------------------------------------------------
import './core/third-party-globals.js'

// ---------------------------------------------------------------------------
// Core modules, in dependency order.
//
// js/core/page-data.js imports all 29 pages/*.js files (each registering itself
// onto window.HHVC_PAGES) and then assembles window.HHVC_DATA. js/core/state.js
// reaches it through js/core/page-registry.js, which imports it first, so the
// ordering is already guaranteed by the module graph; listing these here as
// well is belt-and-braces documentation of the sequence, not what makes it work.
//
// js/core/page-registry.js sits between them because it must run BEFORE js/core/state.js
// takes its one-time ORIGINAL_DATA clone — see that file's header for why a
// page added after the clone silently loses its inline edits. To do its work it
// needs window.reviewState, so it also pulls js/review/review-state-validation.js and
// js/review/review-state-store.js forward; both import only js/core/utils.js, so hoisting
// them is safe, and their later lines below are already-evaluated no-ops kept
// as documentation of where they sit in the sequence.
// ---------------------------------------------------------------------------
import './core/utils.js'
import './mockup/karl-tag-meta.js'
import './core/page-data.js'
import './core/page-registry-data.js'
import './core/page-registry.js'
import './core/state.js'
import './review/ui-controls.js'
import './review/editor-panel.js'
// BEFORE page-render.js: js/core/card-inheritance.js publishes window.cardInheritance
// and exports nothing, so a consumer cannot import a binding from it and the
// graph has no name to order by. js/mockup/page-render.js reads that global to decide
// whether a card renders its own text or the destination page's summary, and
// side-effect-imports this file itself so the ordering is genuinely enforced —
// this line is the same belt-and-braces documentation of the sequence that
// page-data.js above is, not what makes it work.
import './core/card-inheritance.js'
// The Karl panel inventory. Import-free and window-published exactly like
// card-inheritance.js above it, so its only ordering requirement is being
// evaluated before js/karl/karl-transcript.js reads window.karlBlocks.
import './karl/karl-blocks.js'
// The transcript builder over that inventory. Reads window.karlBlocks above it,
// plus window.cardInheritance and window.utils. Pure and DOM-free; the
// workspace panel is what mounts a UI on top of it.
import './karl/karl-transcript.js'
import './mockup/page-render.js'
import './karl/karl-guide.js'
import './core/app.js'
import './review/manager-review-export.js'
import './review/review-state-validation.js'
import './standards/reading-level.js'
import './review/review-state-store.js'
import './review/review-merge.js'
import './editing/inline-content-edit-data.js'
import './editing/inline-content-edit-adapter.js'
// Publishes window.inlineLinkTarget, read by inline-content-edit-link-tool.js
// (a reviewer-typed target) and inline-content-edit.js (a pasted one). Listed
// here rather than imported by either, because it is also require()d from
// build_scripts/data-checks.js under Node and is deliberately import-free so
// it carries no load-order dependency of its own.
import './mockup/inline-link-target.js'
import './sync/review-state-sync.js'

// ---------------------------------------------------------------------------
// Review/UX layers. Each is a self-mounting IIFE that reads window.HHVC_DATA
// and localStorage and attaches its own window.<Namespace>; they are additive
// on top of the core and must run after it. Order within this block still
// matters — the orchestrators (ux-improvements, review-queue) assemble
// public APIs from the sibling files listed
// immediately above them.
// ---------------------------------------------------------------------------
import './review/ux-improvements-state-sync.js'
import './review/ux-improvements-workspace.js'
import './review/ux-improvements-export.js'
import './review/ux-improvements.js'
import './review/review-queue-state.js'
// Undo before rows: applyQueueAction records its snapshot through this.
import './review/review-queue-undo.js'
import './review/review-queue-rows.js'
import './review/review-queue-render.js'
import './review/review-queue-import.js'
import './review/review-queue.js'
// Overview charts. After review-queue-render.js, which calls into it, and
// after review-queue-rows.js, whose getQueueRows() supplies its data.
import './review/review-insights-data.js'
import './review/review-insights.js'
// Ops/status tab. After review-state-sync.js, whose config it reports, and
// after the review layers whose state it inspects.
import './review/review-ops-data.js'
import './review/review-ops.js'
import './review/dashboard-guidance.js'
// Add/delete page controls. After dashboard-guidance.js, which owns the Help
// panel's layout, and after review-queue*.js, whose one-step undo this consumes
// when a page is deleted (window.ReviewQueueInternal.undo.clearAction).
import './core/page-registry-ui.js'

// Plain-language scoring and the AI-assist workspace tab. Same IIFE pattern as
// the layers above: no imports, mounted on window, so they must run after the
// core modules that publish the namespaces they read (window.renderPageMain
// for the draft preview, window.showToast for feedback).
import './standards/plain-language.js'
import './ai/ai-assist-client.js'
import './ai/ai-assist-render.js'
import './ai/ai-assist.js'
import './ai/ai-rewrite-render.js'
import './ai/ai-rewrite.js'
import './editing/inline-content-edit-render.js'
import './editing/inline-content-edit-link-tool.js'
import './editing/inline-content-edit.js'

// PNG export of the mockups. Imported after the review layers because it uses
// window.showToast for progress and window.renderPage to step through pages.
import './mockup/mockup-image-export.js'

// The Karl transcript panel. After the review layers because it reads
// window.reviewState and window.showToast, and after js/karl/karl-transcript.js
// whose builder it renders.
import './karl/karl-transcript-panel.js'

import './review/keyboard-shortcuts.js'

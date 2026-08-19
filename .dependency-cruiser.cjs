/* Architecture rules, as checks rather than as prose.
 *
 * **Why this exists.** This repo documents an unusual number of load-order and
 * layering invariants — which module must be evaluated before which, which
 * files may import nothing, where the React boundary sits — and until now
 * enforced almost none of them. Each was a paragraph in AGENTS.md and a comment
 * at the top of a file, both of which a refactor can silently invalidate. Every
 * rule below was verified against the current graph before being written; none
 * describes an aspiration.
 *
 * CommonJS on purpose: the repo root has no `"type": "module"`, and everything
 * under `build_scripts/` is CJS deliberately (see AGENTS.md on Bun 1.3.14
 * dropping `require()` of async ESM).
 */
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      comment:
        'A cycle makes evaluation order undefined, which matters more here than in most ' +
        'codebases: js/core/state.js side-effect-imports js/core/page-registry.js specifically so the ' +
        "reviewer's added and deleted pages are applied BEFORE ORIGINAL_DATA is cloned. A cycle " +
        'anywhere in that chain reorders it silently.',
      from: {},
      to: { circular: true },
    },

    {
      name: 'mockup-stays-react-free',
      severity: 'error',
      comment:
        'The React + MUI islands are scoped to #reviewWorkspace, and that boundary is the ' +
        'product decision, not a style: #mockPage is a preview of a real SF.gov page, so ' +
        'Material styling on that surface would misrepresent the thing under review. The core ' +
        'renderer and its helpers must therefore never reach React, MUI or Emotion — the ' +
        'islands are loaded by a dynamic import from js/review/ux-improvements-state-sync.js, which ' +
        'is also what keeps them in their own chunk.',
      from: {
        path:
          '^js/mockup/page-render\\.js$|' +
          '^js/core/(state|utils|card-inheritance|page-data)\\.js$|' +
          '^js/review/(ui-controls|editor-panel)\\.js$',
      },
      to: { path: 'node_modules/(react|react-dom|@mui|@emotion)' },
    },

    {
      name: 'base-modules-import-nothing',
      severity: 'error',
      comment:
        'These are the dual-export modules (window.<Namespace> plus module.exports) and the ' +
        'base helper every other module reads. Their import-free-ness is load-bearing rather ' +
        'than tidy: build_scripts/data-checks.js require()s js/core/utils.js across the CJS/ESM ' +
        'boundary, and Bun rejects require() of an ASYNC module — so one deferring await, or ' +
        'one import that introduces one, breaks `bun run validate` with a TypeError naming ' +
        'neither file. The same property is what lets the Node audits and the browser share ' +
        'exactly one classifier instead of two copies free to drift.',
      from: {
        path:
          '^js/core/(utils|card-inheritance|page-registry-data)\\.js$|' +
          '^js/standards/plain-language\\.js$|' +
          '^js/karl/karl-blocks\\.js$|' +
          '^js/review/(review-insights-data|review-ops-data|review-merge)\\.js$',
      },
      to: { pathNot: '^$' },
    },

    {
      name: 'pages-enter-through-page-data',
      severity: 'error',
      comment:
        'Every pages/*.js file assigns onto window.HHVC_PAGES and is side-effect-imported by ' +
        'js/core/page-data.js, which is what guarantees window.HHVC_DATA is populated before ' +
        'anything reads it. A second importer would give the page set a second evaluation ' +
        'point and an undefined order. build_scripts/page-import-checks.js already fails ' +
        'validation on a page file NOBODY imports; this is the opposite direction.',
      from: { pathNot: '^js/core/page-data\\.js$' },
      to: { path: '^pages/.+\\.js$' },
    },
  ],

  required: [
    {
      name: 'state-applies-the-page-registry',
      severity: 'error',
      comment:
        'js/core/state.js must keep importing js/core/page-registry.js. The import is for its side ' +
        'effect and looks removable to anything that reads it as unused — but it is what ' +
        "applies the reviewer's added and deleted pages onto window.HHVC_DATA before " +
        'js/core/state.js clones ORIGINAL_DATA. Drop it and the clone captures the wrong page set, ' +
        'which surfaces later as a field reset restoring a page that was deleted.',
      module: { path: '^js/core/state\\.js$' },
      to: { path: '^js/core/page-registry\\.js$' },
    },
  ],

  options: {
    /* `doNotFollow` rather than `exclude` for node_modules, and the difference
       is not cosmetic. `exclude` drops those modules from the graph entirely,
       so an `import 'react'` edge stops existing and `mockup-stays-react-free`
       silently matches nothing — a rule that can never fire. `doNotFollow`
       records the edge and declines to traverse INTO the package, which is
       what the rule needs and what keeps the cruise fast.

       Caught by mutation-testing the rule rather than by reading the config:
       the first version returned exit 0 with `import 'react'` sitting at the
       top of js/mockup/page-render.js. */
    doNotFollow: { path: 'node_modules' },
    exclude: { path: '^(dist|dist-singlefile|archive|forms|tools/oxlint|\\.worktrees)' },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: { exportsFields: ['exports'], conditionNames: ['import', 'require'] },
  },
}

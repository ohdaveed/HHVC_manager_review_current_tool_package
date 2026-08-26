/**
 * module-loadability — the export contract of the modules nothing else imports.
 *
 * WHY THIS FILE EXISTS, since a test that only imports things looks like
 * ceremony: Bun's coverage reports only files a test actually LOADED. An
 * unimported module is absent from lcov.info entirely rather than recorded at
 * zero, so the reported percentage silently measures whichever subset the
 * suite happened to import — and adding a module nobody imports RAISES it.
 *
 * `bunfig.toml`'s `coveragePathIgnorePatterns` declares the files that cannot
 * be instrumented without running them (the IIFE mounts, `js/main.js`, the
 * `build_scripts/` CLI entry points). These four are the remainder: importable
 * modules with no import-time side effects that simply nothing imported. They
 * belong in the denominator, and the honest way to put them there is a real
 * import rather than a synthesized zero-hit record — a fabricated row would
 * have to guess which lines are executable, and would report
 * `js/react/theme.js` as untested when `tests/react-theme.test.js` covers it
 * by reading its source as text.
 *
 * The assertions are export-surface contracts rather than `toBeDefined()`
 * filler. Each names what its module publishes, so a rename or a dropped
 * export fails here instead of at a distant call site — `build_scripts/ai/`
 * is consumed by `server.ts` across the CJS boundary, where a missing export
 * surfaces as `undefined is not a function` at request time.
 *
 * Load-order note: no happy-dom dependency of its own. `js/react/theme.js`
 * reads design tokens only when its factory is CALLED, not at module scope,
 * so importing it needs nothing from `tests/helpers/browser-env.js` — but
 * that preload runs first regardless, per `bunfig.toml`.
 */

import { describe, test, expect } from 'bun:test'

import aiIndex from '../build_scripts/ai/index.js'
import complianceAudit from '../build_scripts/ai/compliance-audit.js'
import docsFileSet from '../build_scripts/docs-file-set.js'
import { createWorkspaceTheme, subscribeToColorScheme, prefersDark } from '../js/react/theme.js'

describe('build_scripts/ai/index.js', () => {
  test('publishes the eight entries server.ts imports across the CJS boundary', () => {
    expect(Object.keys(aiIndex).sort()).toEqual([
      'DISCLOSURE',
      'MAX_ATTEMPTS',
      'addUsage',
      'generateContent',
      'generateRewrite',
      'getCapabilities',
      'getPages',
      'listModels',
    ])
  })

  test('exports the generation entry points as functions', () => {
    expect(typeof aiIndex.generateContent).toBe('function')
    expect(typeof aiIndex.generateRewrite).toBe('function')
    expect(typeof aiIndex.getCapabilities).toBe('function')
    expect(typeof aiIndex.listModels).toBe('function')
  })
})

describe('build_scripts/ai/compliance-audit.js', () => {
  test('publishes its generator alongside the three retrieval constants', () => {
    expect(Object.keys(complianceAudit).sort()).toEqual([
      'DRAFT_CATEGORIES',
      'MAX_ATTEMPTS',
      'TOP_K',
      'generateComplianceAudit',
    ])
  })

  // DRAFT_CATEGORIES names the corpus categories the system prompt forbids a
  // finding from resting on. It is a set of category slugs, not prose, and a
  // string here would still pass a truthiness check while matching nothing.
  test('exposes DRAFT_CATEGORIES as a non-empty collection of category slugs', () => {
    const categories = Array.from(complianceAudit.DRAFT_CATEGORIES)
    expect(categories.length).toBeGreaterThan(0)
    for (const category of categories) expect(typeof category).toBe('string')
  })
})

describe('build_scripts/docs-file-set.js', () => {
  test('publishes the shared derivation and its exclusion prefixes', () => {
    expect(Object.keys(docsFileSet).sort()).toEqual(['NOT_OURS', 'ourMarkdownFiles'])
    expect(typeof docsFileSet.ourMarkdownFiles).toBe('function')
  })

  // Both callers (lint-docs and check-links) exit 0 when handed no inputs, so
  // an empty derivation is a broken gate that reports success. That is why
  // they treat it as a failure, and why a non-empty result is asserted here.
  test('derives a non-empty markdown file set from git ls-files', () => {
    const files = docsFileSet.ourMarkdownFiles()
    expect(Array.isArray(files)).toBe(true)
    expect(files.length).toBeGreaterThan(0)
    expect(files.every((file) => file.endsWith('.md'))).toBe(true)
  })
})

describe('js/react/theme.js', () => {
  test('publishes the MUI bridge factory and the colour-scheme helpers', () => {
    expect(typeof createWorkspaceTheme).toBe('function')
    expect(typeof subscribeToColorScheme).toBe('function')
    expect(typeof prefersDark).toBe('function')
  })
})

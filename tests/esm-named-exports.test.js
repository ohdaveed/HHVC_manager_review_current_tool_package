/**
 * A module that is named-imported must actually declare those ESM exports.
 *
 * **Why this exists, and why nothing else catches it.** `js/karl-blocks.js`
 * published only `window.karlBlocks` and `module.exports`, while
 * `js/karl-guide-registry.js` did `import { PROMOTE_PANEL } from
 * './karl-blocks.js'`. In a browser that is a hard `SyntaxError` — "does not
 * provide an export named 'PROMOTE_PANEL'" — and it killed the entire module
 * graph on page load, so `bun run dev` served a dead page.
 *
 * Every gate in this repo stayed green through it, and each for its own reason:
 *
 * - `bun run build` passes because Vite's CommonJS plugin synthesises named
 *   exports from `module.exports` at build time.
 * - `bun run test` passes because Bun's CJS/ESM interop does the same thing.
 * - `bun run test:e2e` passes because it runs `bun run start` — the BUILT
 *   bundle, where the plugin has already resolved it.
 *
 * So the one command a developer types every day was the only one that broke,
 * and the only one nothing ran. This test closes that gap statically, without a
 * browser: it reads the import statements rather than executing them, so it
 * cannot be fooled by an interop layer that is kinder than the browser.
 *
 * It deliberately checks the DECLARED exports rather than the resolved ones. A
 * dual-export module may legitimately publish onto `window` and `module.exports`
 * as well; what it may not do is be named-imported without saying so in ESM.
 */
import { describe, expect, test } from 'bun:test'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dir, '..')

/** Strip comments and strings crudely, so a path inside prose is not parsed. */
function code(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
}

/** Every `import { a, b } from './x.js'` in a file, as [specifier, names]. */
function namedImports(source) {
  const out = []
  const re = /import\s*\{([^}]+)\}\s*from\s*['"](\.[^'"]+)['"]/g
  let m
  while ((m = re.exec(source))) {
    const names = m[1]
      .split(',')
      .map((n) =>
        n
          .trim()
          .split(/\s+as\s+/)[0]
          .trim()
      )
      .filter(Boolean)
    out.push([m[2], names])
  }
  return out
}

/** Every name a module exports via ESM syntax. */
function esmExports(source) {
  const names = new Set()
  for (const m of source.matchAll(/export\s*\{([^}]+)\}/g)) {
    for (const raw of m[1].split(',')) {
      const n = raw
        .trim()
        .split(/\s+as\s+/)
        .pop()
        .trim()
      if (n) names.add(n)
    }
  }
  for (const m of source.matchAll(
    /export\s+(?:const|let|var|function\*?|class)\s+([A-Za-z_$][\w$]*)/g
  )) {
    names.add(m[1])
  }
  return names
}

/** Every .js/.jsx file under js/, recursively. */
function jsFiles(dir = path.join(root, 'js'), acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) jsFiles(full, acc)
    else if (/\.jsx?$/.test(entry.name)) acc.push(full)
  }
  return acc
}

describe('ESM named imports', () => {
  test('every named import resolves to a real ESM export in the target module', () => {
    const broken = []
    for (const file of jsFiles()) {
      const source = code(fs.readFileSync(file, 'utf8'))
      for (const [spec, names] of namedImports(source)) {
        const target = path.resolve(path.dirname(file), spec)
        if (!fs.existsSync(target)) continue // path resolution is another test's job
        const exported = esmExports(code(fs.readFileSync(target, 'utf8')))
        for (const name of names) {
          if (!exported.has(name)) {
            broken.push(
              `${path.relative(root, file)} imports { ${name} } from ` +
                `'${spec}', which declares no such ESM export`
            )
          }
        }
      }
    }
    expect(broken).toEqual([])
  })

  test('finds imports to check, so a broken parse cannot pass silently', () => {
    let found = 0
    for (const file of jsFiles()) {
      found += namedImports(code(fs.readFileSync(file, 'utf8'))).length
    }
    expect(found).toBeGreaterThan(10)
  })
})

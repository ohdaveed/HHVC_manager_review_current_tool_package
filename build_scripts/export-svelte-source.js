/**
 * Export structured TypeScript page modules and index.ts for the Svelte app
 * (hhvc-manager-review-svelte).
 *
 * Validates page schema and business invariants, transforms the browser global
 * assignments (window.HHVC_PAGES['key'] = { ... }) into clean ES module exports
 * (export const key = { ... }), generates the index.ts aggregator, formats all
 * output with Prettier, and writes to the destination directory.
 *
 * Usage:
 *   bun build_scripts/export-svelte-source.js [--target <dir>]
 */
const fs = require('node:fs')
const path = require('node:path')
const prettier = require('prettier')
const fg = require('fast-glob')
const { loadPageData, root } = require('./load-pages')
const { dataSchema } = require('./schema')
const {
  findMissingOrderKeys,
  findBrokenCardTargets,
  findBrokenButtonTargets,
  findBrokenInlineLinks,
  isTopicPageFirst,
  findBannedTerms,
  findListFormatViolations,
  findUnsafeUrls,
  findExternalAssetUrls,
} = require('./data-checks')

const DEFAULT_TARGET_DIR = path.join(root, 'dist-svelte/data')

function validateBeforeExport(data) {
  const parsed = dataSchema.safeParse(data)
  if (!parsed.success) {
    throw new Error(
      'Validation errors:\n' +
        parsed.error.issues.map((i) => `- ${i.path.join('.') || 'root'}: ${i.message}`).join('\n')
    )
  }

  const keys = new Set(Object.keys(parsed.data.pages))
  if (!keys.has('pestsTopic')) throw new Error('pestsTopic missing')
  if (keys.has('agency')) throw new Error('old agency key still present')
  if (!isTopicPageFirst(parsed.data.order)) throw new Error('Agency page (pestsTopic) not first')

  const missingOrderKeys = findMissingOrderKeys(parsed.data.pages, parsed.data.order)
  if (missingOrderKeys.length) throw new Error('order key missing: ' + missingOrderKeys[0])

  const brokenCardTargets = findBrokenCardTargets(parsed.data.pages)
  if (brokenCardTargets.length) {
    throw new Error(
      `${brokenCardTargets[0].pageKey} links to missing target ${brokenCardTargets[0].target}`
    )
  }

  const brokenButtonTargets = findBrokenButtonTargets(parsed.data.pages)
  if (brokenButtonTargets.length) {
    throw new Error(
      `${brokenButtonTargets[0].pageKey} links to missing target ${brokenButtonTargets[0].target}`
    )
  }

  const brokenInlineLinks = findBrokenInlineLinks(parsed.data.pages)
  if (brokenInlineLinks.length) {
    throw new Error(
      `${brokenInlineLinks[0].pageKey} has an inline markdown link to missing target ${brokenInlineLinks[0].target}`
    )
  }

  const bannedTerms = [
    'plumbing',
    'dbi',
    'roof leak',
    'sewer',
    'permit issue',
    'construction defect',
  ]
  const foundBannedTerms = findBannedTerms(parsed.data.pages.pestsTopic, bannedTerms)
  if (foundBannedTerms.length) throw new Error('Agency page banned term: ' + foundBannedTerms[0])

  const listFormatViolations = findListFormatViolations(parsed.data.pages)
  if (listFormatViolations.length) {
    throw new Error(
      `${listFormatViolations[0].pageKey} ${listFormatViolations[0].path} has ${listFormatViolations[0].count} items; use bullets[] for lists of 3 or more`
    )
  }

  const unsafeUrls = findUnsafeUrls(parsed.data.pages)
  if (unsafeUrls.length) {
    throw new Error(
      `${unsafeUrls[0].pageKey} ${unsafeUrls[0].path} has an unsafe URL scheme: ${unsafeUrls[0].url}`
    )
  }

  const externalAssets = findExternalAssetUrls(parsed.data.pages)
  if (externalAssets.length) {
    throw new Error(
      `${externalAssets[0].pageKey} ${externalAssets[0].path} references external asset: ${externalAssets[0].url}`
    )
  }
}

async function exportSvelteSource(targetDir = DEFAULT_TARGET_DIR) {
  const data = loadPageData()
  validateBeforeExport(data)

  const prettierConfig = {
    semi: false,
    singleQuote: true,
    tabWidth: 2,
    trailingComma: 'es5',
    printWidth: 100,
    parser: 'typescript',
  }

  fs.mkdirSync(targetDir, { recursive: true })

  const pageFiles = fg.sync('pages/*.js', { cwd: root, onlyFiles: true }).sort()
  const exportedPages = []

  for (const pageRel of pageFiles) {
    const absPath = path.join(root, pageRel)
    const source = fs.readFileSync(absPath, 'utf8')
    const match = source.match(/window\.HHVC_PAGES\[['"](\w+)['"]\]\s*=\s*/)
    if (!match) {
      throw new Error(`Could not find window.HHVC_PAGES['key'] assignment in ${pageRel}`)
    }
    const pageKey = match[1]
    const baseName = path.basename(pageRel, '.js')

    // Transform window.HHVC_PAGES assignment into export const <pageKey> = ...
    // Remove window.HHVC_PAGES = window.HHVC_PAGES || {} header
    let transformed = source
      .replace(/window\.HHVC_PAGES\s*=\s*window\.HHVC_PAGES\s*\|\|\s*\{\}\s*\n*/, '')
      .replace(/window\.HHVC_PAGES\[['"]\w+['"]\]\s*=\s*/, `export const ${pageKey} = `)

    const formatted = await prettier.format(transformed, prettierConfig)
    const outPath = path.join(targetDir, `${baseName}.ts`)
    fs.writeFileSync(outPath, formatted, 'utf8')
    exportedPages.push({ pageKey, baseName, outPath })
  }

  // Generate index.ts
  const importLines = exportedPages.map(
    ({ pageKey, baseName }) => `import { ${pageKey} } from './${baseName}'`
  )
  const keyLines = exportedPages.map(({ pageKey }) => `  ${pageKey},`)

  const indexSource = `/**
 * The corpus, keyed by the name \`cards[].target\` uses to point at a page.
 *
 * Exported from HHVC_manager_review_current_tool_package.
 */
${importLines.join('\n')}

export const pagesByKey = {
${keyLines.join('\n')}
}

export const allPages = Object.values(pagesByKey)
`

  const formattedIndex = await prettier.format(indexSource, prettierConfig)
  fs.writeFileSync(path.join(targetDir, 'index.ts'), formattedIndex, 'utf8')

  return {
    exportedCount: exportedPages.length,
    targetDir,
    exportedPages,
  }
}

if (require.main === module) {
  const args = process.argv.slice(2)
  let targetDir = DEFAULT_TARGET_DIR
  const targetIndex = args.indexOf('--target')
  if (targetIndex !== -1 && args[targetIndex + 1]) {
    targetDir = path.resolve(process.cwd(), args[targetIndex + 1])
  }

  exportSvelteSource(targetDir)
    .then(({ exportedCount, targetDir: outDir }) => {
      console.log(`Successfully exported ${exportedCount} TypeScript page modules to ${outDir}`)
    })
    .catch((err) => {
      console.error('Error exporting Svelte source:', err.message)
      process.exit(1)
    })
}

module.exports = {
  exportSvelteSource,
  DEFAULT_TARGET_DIR,
  validateBeforeExport,
}

import { describe, test, expect } from 'bun:test'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { exportSvelteSource, validateBeforeExport } from '../build_scripts/export-svelte-source.js'
import { loadPageData } from '../build_scripts/load-pages.js'

describe('exportSvelteSource pipeline', () => {
  test('exports one TypeScript module per page plus index.ts to target directory', async () => {
    // Expected count is derived from the loader, not hardcoded, so adding a
    // page does not break this test (see the test-data invariants in AGENTS.md).
    const pageCount = loadPageData().order.length
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hhvc-svelte-export-test-'))
    try {
      const result = await exportSvelteSource(tmpDir)
      expect(result.exportedCount).toBe(pageCount)

      const files = fs.readdirSync(tmpDir)
      expect(files.length).toBe(pageCount + 1) // pages + index.ts
      expect(files).toContain('index.ts')

      // Verify index.ts imports all pages
      const indexContent = fs.readFileSync(path.join(tmpDir, 'index.ts'), 'utf8')
      expect(indexContent).toContain('export const pagesByKey = {')
      expect(indexContent).toContain('export const allPages = Object.values(pagesByKey)')
      expect(indexContent).toContain('pestsTopic,')
      expect(indexContent).toContain('insectsReport,')

      // Verify one individual page module structure
      const pageFile = path.join(tmpDir, 'report-cockroaches-mosquitoes-insects.ts')
      expect(fs.existsSync(pageFile)).toBe(true)
      const pageContent = fs.readFileSync(pageFile, 'utf8')
      expect(pageContent).toContain('export const insectsReport = {')
      expect(pageContent).not.toContain('window.HHVC_PAGES')

      // Dynamically import exported index.ts
      const exportedModule = await import(path.join(tmpDir, 'index.ts'))
      expect(Object.keys(exportedModule.pagesByKey).length).toBe(pageCount)
      expect(exportedModule.allPages.length).toBe(pageCount)
      expect(exportedModule.pagesByKey.insectsReport.title).toBe(
        'Report cockroaches, mosquitoes, and other insects'
      )
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  })

  test('validateBeforeExport fails when invariants are violated', () => {
    const data = loadPageData()
    // Test that valid data passes
    expect(() => validateBeforeExport(data)).not.toThrow()

    // Test that missing pestsTopic throws
    const invalidData = {
      order: data.order,
      pages: { ...data.pages },
    }
    delete invalidData.pages.pestsTopic
    expect(() => validateBeforeExport(invalidData)).toThrow(/pestsTopic missing/)
  })
})

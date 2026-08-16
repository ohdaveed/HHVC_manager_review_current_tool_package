// build_scripts/knowledge-sources.js
//
// The corpus `bun run ingest` embeds: which documents go into
// knowledge_chunks, and what `category` each one is filed under.
//
// It used to be one glob — `docs/source/**/*.md` — which quietly excluded the
// two things a reviewer most often needs the AI to know. The 2026-08-14 Karl
// capture lives in `docs/`, one directory up, so the newest and most accurate
// field data was unretrievable while the older GitBook-derived reference was
// citable. And the mockup copy under review was never in the corpus at all, so
// the AI could reason about policy but not about the page in front of it.
//
// **Category is the whole point of this file.** Every chunk carries one, it is
// resolved server-side from the matched row rather than echoed by the model,
// and it is what lets a citation say whether a claim comes from adopted policy,
// a measurement of the CMS, live SF.gov content, or a draft nobody has approved.
// Mixing those was the failure worth engineering against.
const { readFileSync } = require('node:fs')
const { basename, resolve } = require('node:path')
const fg = require('fast-glob')

const ROOT = resolve(__dirname, '..')
const SOURCE_DIR = resolve(ROOT, 'docs/source')

/**
 * The Karl capture, which lives in `docs/` rather than `docs/source/`.
 *
 * Listed explicitly rather than moved. AGENTS.md, CLAUDE.md and the
 * copilot mirror all name these paths, `tests/doc-counts.test.js` reads them,
 * and the cookbook is linked from a merged PR — relocating a document to satisfy
 * an ingestion glob is the tail wagging the dog.
 */
const KARL_CAPTURE_FILES = [
  'docs/karl-mockup-cookbook.md',
  // The capture record, not just the cookbook. It carries the per-content-type
  // field tables in their rawest form — ordinal position, `data-contentpath`
  // names, MENU-vs-SINGLE — which is exactly what someone asks the AI about
  // ("what fields does a Transaction have, in order?"). The cookbook prose
  // covers the same ground for a human but drops the ordering column.
  'docs/karl-mockup-cookbook-plan-2026-08-14.md',
  // The field map, added 2026-08-15. It is the E1 record of what every Karl
  // content type's editor form actually contains — raw Wagtail field names,
  // required markers, repeatability, and how an internal page link differs
  // from an external URL — captured from the live admin rather than read off
  // the Help Center. Without it the corpus could answer "what does the Help
  // Center say about Report tables?" but not "what does the Report form
  // actually offer?", and those have given different answers four times
  // (see the doc's own `O3`, `O9`, `O11`, `O14`). It also carries the
  // unresolved register, so a retrieval can distinguish a settled mapping
  // from an open question instead of presenting both with equal confidence.
  'docs/karl-export-field-map.md',
]

/**
 * `docs/source/<segment>/...` — the first path segment is the category, which
 * is how `hhvc-policy` and `sfgov-style` have always been derived. A scraped
 * SF.gov snapshot dropped in `docs/source/sfgov-live/` therefore files itself
 * with no code change here.
 *
 * @param {string} relativePath e.g. "hhvc-policy/foo.md" -> "hhvc-policy"
 * @returns {string}
 */
function categoryFor(relativePath) {
  return relativePath.split('/')[0]
}

/**
 * Render one text item, which the page schema allows to be either a plain
 * string or `{ text, unverified }`.
 *
 * @param {string|{text?: string}} item
 * @returns {string}
 */
function itemText(item) {
  if (typeof item === 'string') return item
  if (item && typeof item === 'object' && typeof item.text === 'string') return item.text
  return ''
}

/**
 * Project a mockup page object into markdown for chunking.
 *
 * Markdown rather than the raw object, because the existing chunker splits on
 * `##`/`###` headings and prefixes each chunk with its heading path — so a
 * section's copy keeps the section's name attached to it, and a retrieved chunk
 * can say where in the page it came from without a join.
 *
 * Deliberately includes the `karl` placement notes: they carry the CMS
 * rationale a reviewer asks about ("why is this a Related panel?"), and they are
 * first-class content in this repo rather than comments.
 *
 * @param {string} pageKey
 * @param {object} page
 * @returns {string}
 */
function projectPageToMarkdown(pageKey, page) {
  const lines = []
  lines.push(`# ${page.title || pageKey}`)
  lines.push('')
  lines.push(
    `Proposed ${page.type || 'page'} mockup for \`${page.slug || pageKey}\` (page key \`${pageKey}\`).`
  )
  lines.push('')
  if (page.summary) {
    lines.push('## Summary')
    lines.push('')
    lines.push(page.summary)
    lines.push('')
  }

  for (const section of page.sections || []) {
    lines.push(`## ${section.heading}`)
    lines.push('')
    if (section.karl) {
      lines.push(`Karl placement note: ${section.karl}`)
      lines.push('')
    }
    for (const paragraph of section.paragraphs || []) {
      const text = itemText(paragraph)
      if (text) {
        lines.push(text)
        lines.push('')
      }
    }
    for (const bullet of section.bullets || []) {
      const text = itemText(bullet)
      if (text) lines.push(`- ${text}`)
    }
    if ((section.bullets || []).length) lines.push('')
    for (const step of section.steps || []) {
      lines.push(`### ${step.title}`)
      lines.push('')
      for (const text of step.text || []) {
        const value = itemText(text)
        if (value) {
          lines.push(value)
          lines.push('')
        }
      }
      for (const bullet of step.bullets || []) {
        const value = itemText(bullet)
        if (value) lines.push(`- ${value}`)
      }
      if ((step.bullets || []).length) lines.push('')
    }
    for (const row of section.table || []) {
      lines.push(`- ${row.join(' — ')}`)
    }
    if ((section.table || []).length) lines.push('')
    if (section.callout?.text) {
      lines.push(`> ${section.callout.text}`)
      lines.push('')
    }
  }

  return lines.join('\n')
}

/**
 * Every document to embed, in a stable order.
 *
 * `sourceFile` doubles as the prune key and the first half of a chunk id, so
 * the values here must stay stable across runs — `mockup/<pageKey>.md` rather
 * than a path that does not exist on disk being the one thing to notice.
 *
 * @param {object} [options]
 * @param {Record<string, object>} [options.pages] Mockup pages to project.
 *   Injectable so tests need neither the real corpus nor the page loader.
 * @returns {Array<{sourceFile: string, category: string, markdown: string}>}
 */
function collectKnowledgeSources(options = {}) {
  const sources = []

  const files = fg
    .sync('**/*.md', { cwd: SOURCE_DIR, onlyFiles: true })
    .filter((file) => basename(file) !== 'README.md')
    .sort((a, b) => a.localeCompare(b))

  for (const relativePath of files) {
    sources.push({
      sourceFile: relativePath,
      category: categoryFor(relativePath),
      markdown: readFileSync(resolve(SOURCE_DIR, relativePath), 'utf8'),
    })
  }

  for (const relativePath of KARL_CAPTURE_FILES) {
    sources.push({
      sourceFile: `karl/${basename(relativePath)}`,
      category: 'karl',
      markdown: readFileSync(resolve(ROOT, relativePath), 'utf8'),
    })
  }

  const pages = options.pages || {}
  for (const pageKey of Object.keys(pages).sort((a, b) => a.localeCompare(b))) {
    sources.push({
      sourceFile: `mockup/${pageKey}.md`,
      category: 'mockup-draft',
      markdown: projectPageToMarkdown(pageKey, pages[pageKey]),
    })
  }

  return sources
}

module.exports = {
  KARL_CAPTURE_FILES,
  categoryFor,
  collectKnowledgeSources,
  projectPageToMarkdown,
}

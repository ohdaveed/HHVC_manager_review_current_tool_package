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
// The same shape of gap survived that fix and was closed on 2026-08-16: the
// HHVC Web Governance and Content Standards Manual lives in `notebooklm/`, so
// the manual `js/plain-language.js` cites by section number for every scored
// rule was the one document a compliance audit could not quote back.
//
// **Category is the whole point of this file.** Every chunk carries one, it is
// resolved server-side from the matched row rather than echoed by the model,
// and it is what lets a citation say whether a claim comes from adopted policy,
// a measurement of the CMS, live SF.gov content, or a draft nobody has approved.
// Mixing those was the failure worth engineering against.
const { readFileSync } = require('node:fs')
const { basename, resolve } = require('node:path')
const fg = require('fast-glob')
const { parseCsv } = require('./csv.js')

const ROOT = resolve(__dirname, '..')
const SOURCE_DIR = resolve(ROOT, 'docs/source')

/**
 * The compliance matrix, which is the one corpus source that is not markdown.
 *
 * It maps 203 requirements to the code section that imposes each one — the
 * only place in the repo where "seal openings larger than 1/4 inch" and
 * "SF Health Code Article 2 Sec. 92(b)-(c)" sit in the same row. That pairing
 * is exactly what a compliance finding needs: an audit can otherwise say a
 * page contradicts policy but not name the provision.
 *
 * **Projected at ingest time rather than converted into a committed file**,
 * the same treatment `pages/*.js` gets. A committed markdown copy would be a
 * second source of truth free to drift from the CSV, and the CSV is what the
 * program actually maintains.
 */
const COMPLIANCE_MATRIX_FILE = 'notebooklm/compliance-standards.csv'

/** Where the projected matrix files, and the stable id its chunks carry. */
const COMPLIANCE_MATRIX_SOURCE = 'hhvc-policy/compliance-standards-matrix.md'

/**
 * Documents that belong in the corpus but live outside `docs/source/`, each
 * paired with the category it files under.
 *
 * Listed explicitly rather than moved. AGENTS.md, CLAUDE.md and the
 * copilot mirror all name these paths, `tests/doc-counts.test.js` reads them,
 * and the cookbook is linked from a merged PR — relocating a document to satisfy
 * an ingestion glob is the tail wagging the dog.
 *
 * **This was a flat list of paths that all became `category: 'karl'`**, which
 * was true while the only outside documents were Karl captures and stopped
 * being true the moment the standards manual needed to come in. Filing that as
 * `karl` would have told the audit prompt it was a measurement of what the CMS
 * can publish — the category confusion this file's header calls the failure
 * worth engineering against. Each entry now names its own category.
 *
 * **`sourceFile` is `<category>/<basename>`**, which leaves every already
 * ingested Karl row's id byte-identical. Those ids are the prune key
 * (`build_scripts/ingest-knowledge.js` deletes rows whose `source_file` is
 * absent from a run), so renaming one orphans its old rows and re-embeds the
 * same text under a new name.
 */
const EXTERNAL_SOURCE_FILES = [
  { path: 'docs/karl-mockup-cookbook.md', category: 'karl' },
  // The capture record, not just the cookbook. It carries the per-content-type
  // field tables in their rawest form — ordinal position, `data-contentpath`
  // names, MENU-vs-SINGLE — which is exactly what someone asks the AI about
  // ("what fields does a Transaction have, in order?"). The cookbook prose
  // covers the same ground for a human but drops the ordering column.
  { path: 'docs/karl-mockup-cookbook-plan-2026-08-14.md', category: 'karl' },
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
  { path: 'docs/karl-export-field-map.md', category: 'karl' },
  // The 2026-07-06 live-admin session: read-only, logged in to api.sf.gov,
  // closing eight open items the GitBook could not answer. It is the older
  // sibling of the field map and is kept alongside it rather than folded in,
  // because it records what was observed BEING WRONG in the Help Center — a
  // retrieval asking "is the Help Center right about X?" has nowhere else to
  // land. Superseded claims are marked in the field map's obsolete register,
  // which is itself in the corpus.
  { path: 'docs/karl-live-admin-verification-2026-07-06.md', category: 'karl' },
  // **The single largest gap this list existed to have.** The HHVC Web
  // Governance and Content Standards Manual v2.1 is the authority
  // `js/plain-language.js` cites by section number for every scored
  // `severity: 'error'` rule (§7.x, and §6.3 for the Karl Button component),
  // and it was not in the corpus at all — so `compliance-audit` was grounding
  // findings in Health Code extracts and IPM guidance while the document that
  // actually defines what a compliant HHVC page looks like was unretrievable.
  // A reviewer reading a citation could not get from a finding back to the
  // manual section the tool's own checks are named after.
  { path: 'notebooklm/hhvc-standards-manual.md', category: 'hhvc-standards' },
  // The Article 11 interpretation handbook: how the legal text becomes
  // plain-language page copy, plus the "Services First" / "One page goal"
  // principles the mockup IA is built on. Policy rather than standards — it
  // is what a page's SUBSTANCE can be non-compliant with, where the manual
  // above governs its form.
  { path: 'notebooklm/master-guidelines.md', category: 'hhvc-policy' },
  // Approved Biological & Pest Control Standards v2.1 — the enforceable
  // treatment detail behind the pest pages (1/4-inch exclusion gaps, the
  // Article 11A 72-hour and 28-day rules, the wasp public-versus-private
  // dual track). Several pages state these numbers; nothing else in the
  // corpus lets an audit check one. It is a single line of raw HTML with no
  // markdown headings, which the chunker handles by falling through to its
  // size split — measured at 2 chunks, so it degrades to "no heading path"
  // rather than to one unbounded chunk.
  { path: 'notebooklm/hhvc-ipm-reference-materials.md', category: 'hhvc-policy' },
  // The claim-verification sheet the Publication Readiness Checklist gates
  // health and safety wording against. It is what makes an `unverified: true`
  // pill resolvable: the disease-risk claims a page makes have an approved
  // form, and this is where it is written down.
  { path: 'notebooklm/disease-risk-reference-sheet.md', category: 'hhvc-policy' },
  // The cross-content-type synthesis of what SF.gov actually publishes —
  // layout rhythms and editorial rules per archetype, each tied to a named
  // live exemplar. The per-page snapshots in `docs/source/sfgov-live/` are the
  // evidence; this is the pattern read off them, and it is the shape a
  // question like "how does a real Agency page open?" needs.
  { path: 'docs/sfgov-live-design-inspiration.md', category: 'sfgov-live' },
]

/**
 * **Why several obvious candidates are deliberately NOT above**, since the
 * next reader will otherwise re-derive this and add them:
 *
 * - **A superseded document cannot travel with its own warning.**
 *   `build_scripts/knowledge-chunking.js` prefixes each chunk with its
 *   HEADING PATH, never with the file's opening banner — so
 *   `docs/wagtail-content-mapping.md`'s "specific claims below that are now
 *   wrong" header is attached to chunk 1 and to nothing else, while chunks 2
 *   through 40 retrieve as confident current fact. That rules out that file,
 *   `docs/karl-help-center-research-2026-07-06.md` (whose findings the live
 *   captures overturned), and `hhvc_chapter_drafts/**`, which the manual
 *   consolidates and which carries its own `outdated/` subdirectory.
 * - **Draft page copy is not policy.** `notebooklm/hhvc-inspection-scope.md`,
 *   `what-happens-after-report.md`, `reduce-indoor-moisture{,-v2}.md` and
 *   `report-mold-humidity.md` are Page Blueprints — "Page ID GH-021", "Karl
 *   Page Type", "Status: Mockup Completed". Filing them as `hhvc-policy`
 *   would make a proposal citable as adopted guidance, and `pages/*.js`
 *   already covers that ground honestly as `mockup-draft`.
 * - **Records of what the tool did are not sources.**
 *   `docs/karl-multi-source-audit-report.md` is generated by
 *   `bun run audit:karl` and reports its own pass count;
 *   `docs/sitemap-audit-vs-standards-manual-2026-07-06.md` and
 *   `docs/source-of-truth-audit-2026-07-06.md` audit a 39-page corpus that is
 *   now 29 pages; `docs/2026-08-14-sfds-adoption-status.md` and
 *   `docs/brutalist-dashboard-design-2026-07-06.md` are about this tool's own
 *   CSS. None is something a page can be non-compliant with.
 *
 * `notebooklm/compliance-standards.csv` used to sit on this list, excluded by
 * format alone. It is projected now — see `projectComplianceMatrixToMarkdown`.
 */

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
 * Strip the `$…$` math delimiters NotebookLM wrapped nine numeric values in
 * when it produced the CSV, and collapse the double spaces they leave behind.
 *
 * `larger than  $1/4$  inch ( $0.25$  inches)` is the real shape. Left alone
 * it embeds the delimiters as content, so a page correctly stating the
 * quarter-inch rule reads as a near-miss against its own requirement.
 *
 * @param {string} value
 * @returns {string}
 */
function stripMathDelimiters(value) {
  return String(value ?? '')
    .replace(/\$([^$]*)\$/g, '$1')
    .replace(/\s+/g, ' ')
    .replace(/\(\s+/g, '(')
    .replace(/\s+\)/g, ')')
    .trim()
}

/**
 * Project the compliance matrix CSV into markdown for chunking.
 *
 * **One `###` per requirement, grouped under a `##` per category.** That is a
 * heading per row — 203 of them — which is more sections than any other
 * document in the corpus, and it is deliberate: the chunker splits on headings
 * and prefixes each chunk with its heading path, so every requirement retrieves
 * as its own chunk carrying its own name. A finding cites one provision, and
 * this is the granularity that lets it. The cost is real and worth naming: 203
 * short, similarly-worded chunks can crowd a top-6 retrieval that a prose
 * source would otherwise win. Grouping rows by code section instead would cut
 * that to about 61 chunks — the fallback if crowding is ever measured rather
 * than feared.
 *
 * The trailing `Source` column is dropped. It holds NotebookLM's own citation
 * indices ("16, 5, 6, 7…"), which point into a source list that is not in this
 * repo — embedding them would put unresolvable numbers next to resolvable
 * legal citations.
 *
 * @param {string} csvText Raw contents of the compliance matrix CSV.
 * @returns {string}
 */
function projectComplianceMatrixToMarkdown(csvText) {
  const rows = parseCsv(csvText)
  const [, ...dataRows] = rows

  const lines = ['# HHVC compliance standards matrix', '']
  lines.push(
    'Each entry pairs one requirement with the code section or rule that imposes it,',
    'the standard that counts as meeting it, and who is responsible. Projected from',
    `\`${COMPLIANCE_MATRIX_FILE}\`, which is the maintained source.`,
    ''
  )

  // Grouped rather than emitted in row order. The CSV returns to
  // `Regulations/Sanitation` after a detour through `Regulations/Mechanical`,
  // so a straight pass writes that `##` twice — two chunks sharing one heading
  // path, which is the one thing a citation label must not be ambiguous about.
  // Insertion order is preserved, so the document still reads in the CSV's own
  // sequence.
  const byCategory = new Map()
  for (const row of dataRows) {
    const [category, topic, requirement, standard, legalSource, responsibleParty] =
      row.map(stripMathDelimiters)
    if (!topic) continue
    if (!byCategory.has(category)) byCategory.set(category, [])
    byCategory.get(category).push({ topic, requirement, standard, legalSource, responsibleParty })
  }

  for (const [category, entries] of byCategory) {
    lines.push(`## ${category}`, '')
    for (const entry of entries) {
      lines.push(`### ${entry.topic}`, '')
      if (entry.requirement) lines.push(`**Requirement:** ${entry.requirement}`, '')
      if (entry.standard) lines.push(`**Meets the standard when:** ${entry.standard}`, '')
      if (entry.legalSource) lines.push(`**Legal source:** ${entry.legalSource}`, '')
      if (entry.responsibleParty) lines.push(`**Responsible party:** ${entry.responsibleParty}`, '')
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

  sources.push({
    sourceFile: COMPLIANCE_MATRIX_SOURCE,
    category: 'hhvc-policy',
    markdown: projectComplianceMatrixToMarkdown(
      readFileSync(resolve(ROOT, COMPLIANCE_MATRIX_FILE), 'utf8')
    ),
  })

  for (const { path: relativePath, category } of EXTERNAL_SOURCE_FILES) {
    sources.push({
      sourceFile: `${category}/${basename(relativePath)}`,
      category,
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
  COMPLIANCE_MATRIX_SOURCE,
  EXTERNAL_SOURCE_FILES,
  categoryFor,
  collectKnowledgeSources,
  projectComplianceMatrixToMarkdown,
  projectPageToMarkdown,
}

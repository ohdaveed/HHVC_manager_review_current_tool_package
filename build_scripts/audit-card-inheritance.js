/**
 * Card inheritance audit — reports cards whose title/text will not render.
 *
 * Load-order dependency: none at runtime. This is a Node-side script like
 * `validate.js`, run by hand via `bun run audit-cards`. It loads page data
 * through `build_scripts/load-pages.js` (the same VM-context loader
 * validate/export use), so it never imports browser modules.
 *
 * WHY THIS EXISTS
 *
 * A Karl Services/Resources subsection entry, and a Related-panel entry, is
 * only a page picker: "add an SF.gov page or External link". There is no label
 * field and no description field, so what the published card shows comes from
 * the DESTINATION page, not from anything typed into the card.
 *
 * A subsection renders the destination's Title AND Description — confirmed in
 * the Karl editor docs ("Services on an Agency page", "Resources on an Agency
 * page") and against the live Environmental Health Agency page, whose card text
 * is verbatim each destination's own summary. The Related panel and a Resource
 * Collection's Resource section render the Title and a link and no description
 * at all — each confirmed separately against live pages on 2026-08-08. See WHY
 * THERE ARE THREE BUCKETS below.
 *
 * A card in this mockup that says something different is therefore showing a
 * reviewer copy that will never appear on SF.gov — which matters more here than
 * in most codebases, because approving that copy is the entire point of the
 * tool.
 *
 * WHY IT CLASSIFIES BY `karl` AND NOT BY `section.component`
 *
 * The first version of this audit keyed on `section.component` and was wrong.
 * 74 of the 98 mismatches it found sat in sections with no `component` at all,
 * and those are not one kind of thing: some are genuine picker fields (a
 * Resource Collection's "Resource section" items, a Related panel), while
 * others are **Table blocks** and **Title and text blocks** whose card text IS
 * authored and must not be touched. `article11Guide`'s "Mold and lead hazards"
 * is a table. A mechanical pass keyed on `component` would have corrupted it.
 *
 * The `karl` note is the real authority — it names the Karl block each section
 * maps to. So that is what this reads.
 *
 * WHY THERE ARE THREE BUCKETS AND NOT TWO
 *
 * Inheritance is not one behaviour. An Agency Services/Resources subsection
 * renders the destination's Title AND Description; the Related panel and a
 * Resource Collection's Resource section render the Title and a link and
 * NOTHING else (each verified live 2026-08-08). Treating them alike asked one
 * question — "does the card text equal the destination summary?" — which is
 * simply the wrong question for the title-only pair, where the answer should
 * be that there is no card text at all.
 *
 * It went wrong in both directions at once, which is why the split is worth
 * the extra bucket. It reported 49 correctly-empty Related cards as findings,
 * an over-report inviting someone to "fix" them by pasting in copy the panel
 * cannot show. And it stayed SILENT on a Resource-section card whose text
 * already matched its destination summary verbatim — scored as passing, when
 * the text renders nowhere and should not be there at all.
 *
 * WHY IT REPORTS AND DOES NOT FIX
 *
 * Titles are safe to sync: a card title that differs from its destination is
 * simply wrong. Descriptions are not, and the direction of the fix is not
 * always card-ward — where the mockup's card text is sharper than the
 * destination page's summary, the right change is to the destination. That is
 * a content judgement per card, so this prints the list and stops. It is a
 * report, not a CI gate, and deliberately exits 0 even with findings.
 *
 * WHAT CHANGED WHEN THE RENDERER STARTED INHERITING (2026-08-09)
 *
 * The paragraph above describes the state this audit was born into, where
 * `js/page-render.js` printed `card.text` verbatim and the only way to close a
 * finding was a per-card editorial decision. That decision has been made once,
 * globally: the renderer now resolves an inheriting card's description through
 * `classifySection()` and prints the DESTINATION page's summary, so a card's
 * own `text` in an inheriting section renders nowhere at all — exactly the
 * condition this file already described for the title-only bucket.
 *
 * So the assertion for BOTH inheriting buckets is now the same one, and it is
 * the title-only bucket's assertion: the card must carry no text of its own.
 * See the `textMatches` comment in `auditCards` for why that had to change
 * rather than stay "does the card text equal the destination summary?" — the
 * four destination summaries that were worth improving were improved in the
 * same change, on the destination pages, which is where the copy now lives.
 *
 * Anything it cannot classify is reported under UNKNOWN rather than assumed
 * safe, so a new section with an unfamiliar `karl` note surfaces instead of
 * being silently skipped.
 */

const { loadPageData } = require('./load-pages')
// The classifier itself lives in js/card-inheritance.js so the renderer and
// this audit read one copy of it. A second set of regexes here would let the
// mockup show one thing while the audit asserted another, and nothing would
// report the disagreement. See that file's header for the WHY behind each
// bucket's regex; the WHY behind the three-bucket SPLIT stays above, because
// it is this audit's own history.
const { classifySection, AUTHORED, INHERITS, TITLE_ONLY } = require('../js/card-inheritance')

/**
 * Compare every internal card link against the page it points at.
 *
 * @param {Record<string, any>} pages keyed by page key
 * @returns {{total: number, findings: object[], unknown: object[]}}
 */
function auditCards(pages) {
  let total = 0
  const findings = []
  const unknown = []

  for (const [pageKey, page] of Object.entries(pages)) {
    for (const section of page.sections || []) {
      const kind = classifySection(section)
      for (const card of section.cards || []) {
        // External links have no SF.gov page to inherit from, so their title
        // and text are genuinely authored whatever block holds them.
        if (!card.target) continue
        const dest = pages[card.target]
        // A broken target is findBrokenCardTargets' job, not this script's.
        if (!dest) continue
        total++

        const cardText = card.text ?? ''
        const destText = dest.summary ?? ''
        const row = {
          pageKey,
          kind,
          section: section.heading,
          target: card.target,
          titleMatches: card.title === dest.title,
          // "Correct" is now the same assertion for both inheriting buckets:
          // the card carries NO text of its own. A title-only component
          // renders no description at all, and since js/page-render.js started
          // resolving descriptions through classifySection(), an inheriting
          // component renders the DESTINATION's summary — so in both cases a
          // card's own `text` is a field that reaches no reader.
          //
          // This used to ask whether an inheriting card's text equalled the
          // destination summary, which was the right question only while the
          // renderer printed card text verbatim: back then the two strings had
          // to be kept manually identical, and the audit's job was to find
          // where they had drifted. Keeping that comparison after the renderer
          // began inheriting would have demanded a duplicate of the summary on
          // every card purely to satisfy this check — re-creating the drift
          // the inheritance was introduced to make impossible.
          textMatches: cardText === '',
          cardTitle: card.title,
          destTitle: dest.title,
          cardText,
          destText,
        }
        if (row.titleMatches && row.textMatches) continue
        if (kind === 'unknown') unknown.push(row)
        else if (kind === 'inherits' || kind === 'title-only') findings.push(row)
        // 'authored' rows are expected to differ and are not reported.
      }
    }
  }
  return { total, findings, unknown }
}

/**
 * Print one card finding, truncating the copy so a long summary does not bury
 * the page key that identifies it.
 *
 * @param {object} row
 */
function printRow(row) {
  console.log(`  ${row.pageKey} :: ${row.section} -> ${row.target}`)
  if (!row.titleMatches) {
    console.log(`     title card: ${row.cardTitle}`)
    console.log(`     title dest: ${row.destTitle}`)
  }
  if (!row.textMatches) {
    console.log(`     text  card: ${row.cardText.slice(0, 96)}`)
    // A Related card has no destination text to compare against — the panel
    // renders none — so printing the summary here would imply a target to sync
    // toward, which is the exact mistake this bucket exists to prevent.
    if (row.kind === 'title-only')
      console.log('     text  dest: (none — this component renders no description)')
    else console.log(`     text  dest: ${row.destText.slice(0, 96)}`)
  }
}

function main() {
  const { pages } = loadPageData()
  const { total, findings, unknown } = auditCards(pages)

  const titleIssues = findings.filter((r) => !r.titleMatches)
  const textIssues = findings.filter(
    (r) => r.titleMatches && !r.textMatches && r.kind === 'inherits'
  )
  const deadText = findings.filter(
    (r) => r.titleMatches && !r.textMatches && r.kind === 'title-only'
  )

  console.log(`internal card links checked: ${total}`)
  console.log(`will not render as written:  ${findings.length}`)
  console.log(`  title mismatches: ${titleIssues.length} (safe to sync to the destination)`)
  console.log(
    `  text mismatches:  ${textIssues.length} (the renderer inherits the destination summary — delete it)`
  )
  console.log(
    `  dead card text:   ${deadText.length} (the component renders none — safe to delete)`
  )
  console.log(`unclassified sections:       ${unknown.length}`)

  if (titleIssues.length) {
    console.log('\nTITLE — the card names the destination differently:')
    titleIssues.forEach(printRow)
  }
  if (textIssues.length) {
    console.log('\nTEXT — the destination summary below is what renders. Delete the card text:')
    textIssues.forEach(printRow)
  }
  if (deadText.length) {
    console.log('\nDEAD TEXT — a title-only card carrying copy that cannot render. Delete it:')
    deadText.forEach(printRow)
  }
  if (unknown.length) {
    console.log('\nUNKNOWN — the section karl note names no recognized Karl block.')
    console.log('Classify it, or extend AUTHORED/INHERITS in this file:')
    unknown.forEach(printRow)
  }
}

if (require.main === module) main()

module.exports = { auditCards, classifySection, AUTHORED, INHERITS, TITLE_ONLY }

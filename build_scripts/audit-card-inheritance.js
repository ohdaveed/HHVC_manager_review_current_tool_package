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
 * is verbatim each destination's own summary. The Related panel renders the
 * Title and a link and no description at all — confirmed 2026-08-08 against a
 * live Transaction page. See WHY THERE ARE THREE BUCKETS below.
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
 * renders the destination's Title AND Description; the Related panel renders
 * its Title and a link and NOTHING else (verified live 2026-08-08). Treating
 * them alike asked one question — "does the card text equal the destination
 * summary?" — that is simply the wrong question for Related, where the answer
 * should be that there is no card text at all. It reported 49 correctly-empty
 * Related cards as findings, an over-report that invited someone to "fix" them
 * by pasting in copy the panel cannot show.
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
 * Anything it cannot classify is reported under UNKNOWN rather than assumed
 * safe, so a new section with an unfamiliar `karl` note surfaces instead of
 * being silently skipped.
 */

const { loadPageData } = require('./load-pages')

/**
 * Karl blocks that render the destination's Title AND its Description. An
 * Agency Services/Resources subsection entry is only "add an SF.gov page or
 * External link", so both fields come from the page it points at.
 *
 * Checked third, so a section naming an authored block or a Related panel wins.
 */
const INHERITS = /resource section|services subsection|resources subsection|page.{0,3} chooser/i

/**
 * The Related panel renders the destination's Title and a link — and NOTHING
 * else. Verified 2026-08-08 at DOM level against the live Transaction page
 * sf.gov/pay-your-annual-healthy-housing-fee-apartment-buildings, whose Related
 * entries each hold link text and no other text node. Full write-up in
 * `docs/source/hhvc-policy/2026-08-08-karl-card-inheritance-verification.md`.
 *
 * This is a SEPARATE bucket from INHERITS rather than a member of it, because
 * the correct assertion is the opposite one: a Related card's text must be
 * EMPTY. Lumping the two together asked whether the card text equalled the
 * destination summary, which reported 49 correctly-blank cards as findings —
 * and would have had someone "fix" them by pasting in copy that cannot render.
 *
 * Note the editor help center contradicts itself here: the Transaction
 * content-type page claims the right-side bar shows "title and description".
 * The live page disproves it. Do not re-widen this from the docs alone.
 *
 * Checked BEFORE INHERITS: the Related karl notes also contain the phrase
 * 'a generic unrestricted "Page" chooser', which INHERITS would otherwise claim.
 */
const TITLE_ONLY = /related field|related panel|related_links/i

/**
 * Karl blocks that hold authored card content. A table row or a rich-text
 * block writes its own words, so a difference from the destination page is
 * expected and correct. Checked first.
 */
const AUTHORED = /table block|title and text/i

/**
 * Decide how a section's cards reach the page.
 *
 * @param {{karl?: string}} section
 * @returns {'authored'|'title-only'|'inherits'|'unknown'}
 */
function classifySection(section) {
  const karl = section.karl || ''
  if (AUTHORED.test(karl)) return 'authored'
  if (TITLE_ONLY.test(karl)) return 'title-only'
  if (INHERITS.test(karl)) return 'inherits'
  return 'unknown'
}

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
          // What "correct" means depends on the component. A Related card is
          // right when it carries NO text; a subsection card is right when its
          // text is the destination's summary verbatim.
          textMatches: kind === 'title-only' ? cardText === '' : cardText === destText,
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
      console.log('     text  dest: (none — Related renders no description)')
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
  console.log(`  text mismatches:  ${textIssues.length} (needs a per-card decision)`)
  console.log(`  dead card text:   ${deadText.length} (Related renders none — safe to delete)`)
  console.log(`unclassified sections:       ${unknown.length}`)

  if (titleIssues.length) {
    console.log('\nTITLE — the card names the destination differently:')
    titleIssues.forEach(printRow)
  }
  if (textIssues.length) {
    console.log('\nTEXT — decide per card whether to sync down or improve the destination:')
    textIssues.forEach(printRow)
  }
  if (deadText.length) {
    console.log('\nDEAD TEXT — a Related card carrying copy that cannot render. Delete it:')
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

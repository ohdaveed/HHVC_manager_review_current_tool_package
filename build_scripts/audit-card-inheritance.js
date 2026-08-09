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
 * WHY EXTERNAL-URL CARDS ARE CHECKED, AND WHY ONLY ONE OF THE TWO CASES
 * PRODUCES A FINDING (2026-08-09)
 *
 * Until this date the loop opened with `if (!card.target) continue`, so a card
 * pointing at an external URL was invisible here. The reasoning was that an
 * external link has no SF.gov page to inherit from, so its title and text must
 * be authored — true of the TITLE, and it is why no title assertion is made
 * below. It was never true of the text, and the single `continue` was hiding
 * two unrelated situations behind one silence.
 *
 * **A title-only component renders no description for ANY entry.** That was
 * established at DOM level: a Related entry and a Resource-section entry each
 * hold link text and no other text node. That is a fact about the COMPONENT,
 * not about the destination, so it holds whether the entry points at an SF.gov
 * page or at an external link. Card text in one of those sections is dead data
 * either way, and it now reports in the same DEAD TEXT bucket the internal ones
 * always did.
 *
 * **An inheriting subsection's external entry KEEPS its authored text**, so it
 * produces no finding — and that is measured, not assumed. It was an open
 * question for a day: only the INTERNAL case had been checked live, and
 * deleting an external card's text on the strength of an internal finding would
 * have been the same mistake the TITLE_ONLY comment in
 * `js/card-inheritance.js` warns about ("Do not re-widen this from the docs
 * alone"), merely pointed the other way. It was settled by a census of all 332
 * `departments--*` pages in `sf.gov/sitemap.xml`: 333 of the 363 entries whose
 * `href` leaves sf.gov render a `tile-description` of their own. An external
 * entry therefore HAS a description field, authored on the entry rather than
 * inherited from anywhere, and `js/page-render.js` printing `card.text` for one
 * is correct. They are skipped here exactly like an `authored` section's cards.
 *
 * Two details of that census matter, because a repeat that misses either gets a
 * different answer. `api.sf.gov`/`media.api.sf.gov` hosts were counted
 * SEPARATELY (69 with a description to 29 without): those are SF.gov's own
 * document store, so such an entry is a Document Picker upload whose text comes
 * off the Document object — a third mechanism, and folding it in would answer a
 * different question with the same number. And each anchor was matched to its
 * own closing `</a>` before its description was read, since attributing a
 * neighbour's description to an entry is how a sweep like this quietly confirms
 * whatever it set out to find. Full write-up in
 * `docs/source/hhvc-policy/2026-08-08-karl-card-inheritance-verification.md`.
 *
 * Nothing about internal cards changed with this widening: they are still
 * counted, asserted and bucketed exactly as before, and the external rows carry
 * their own counter so they cannot quietly inflate the internal total that the
 * renderer's correctness is read from.
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
 * Compare every internal card link against the page it points at, and check
 * every external-URL card against what its component can render at all.
 *
 * @param {Record<string, any>} pages keyed by page key
 * @returns {{total: number, externalTotal: number, findings: object[],
 *   unknown: object[], externalAuthored: object[]}}
 */
function auditCards(pages) {
  let total = 0
  let externalTotal = 0
  const findings = []
  const unknown = []
  const externalAuthored = []

  for (const [pageKey, page] of Object.entries(pages)) {
    for (const section of page.sections || []) {
      const kind = classifySection(section)
      for (const card of section.cards || []) {
        if (!card.target) {
          auditExternalCard({ pageKey, section, kind, card, externalAuthored, findings })
          // Counted separately from `total` on purpose: `total` is the number
          // the renderer's inheritance behaviour is judged by, and folding in a
          // second population would make a change in one look like a change in
          // the other.
          if (kind === 'title-only' || kind === 'inherits') externalTotal++
          continue
        }
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
  return { total, externalTotal, findings, unknown, externalAuthored }
}

/**
 * Classify one external-URL card and file it, if it has text to file.
 *
 * Split out of `auditCards`'s loop rather than inlined because the two paths
 * share almost nothing: an external card has no destination page, so there is
 * no title to compare, no summary to compare against, and the only question
 * left is whether its own `text` can reach a reader. Inline, that would be four
 * unrelated guard clauses sitting inside a loop whose every other line is about
 * a destination — and the internal path is the one whose correctness the
 * renderer is judged by, so it is the one worth keeping legible.
 *
 * `titleMatches: true` is asserted rather than computed, and that is not a
 * shortcut: an external card's title IS its authored link label, with no
 * SF.gov page to disagree with. Setting it keeps these rows out of the TITLE
 * bucket's filter without that filter needing to learn about external cards.
 *
 * @param {{pageKey: string, section: object, kind: string, card: object,
 *   externalAuthored: object[], findings: object[]}} args
 */
function auditExternalCard({ pageKey, section, kind, card, externalAuthored, findings }) {
  const cardText = card.text ?? ''
  // An external card with no text of its own is correct in every bucket:
  // title-only renders none, and the open question about inheriting
  // subsections only arises when there is copy that might or might not show.
  if (cardText === '') return
  // 'authored' and 'unknown' sections keep their external card text untouched.
  // A table row or a rich-text block writes its own words whatever it links to,
  // and an unrecognized `karl` note is reported through the internal UNKNOWN
  // path already — guessing at an external card inside one would be the
  // component-keyed mistake this file's second WHY block exists to remember.
  if (kind !== 'title-only' && kind !== 'inherits') return

  const row = {
    pageKey,
    kind,
    section: section.heading,
    target: card.url,
    external: true,
    titleMatches: true,
    textMatches: false,
    cardTitle: card.title,
    destTitle: '',
    cardText,
    destText: '',
  }
  if (kind === 'title-only') findings.push(row)
  else externalAuthored.push(row)
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
  const { total, externalTotal, findings, unknown, externalAuthored } = auditCards(pages)

  const titleIssues = findings.filter((r) => !r.titleMatches)
  const textIssues = findings.filter(
    (r) => r.titleMatches && !r.textMatches && r.kind === 'inherits'
  )
  const deadText = findings.filter(
    (r) => r.titleMatches && !r.textMatches && r.kind === 'title-only'
  )

  console.log(`internal card links checked: ${total}`)
  console.log(`external card links checked: ${externalTotal}`)
  console.log(`will not render as written:  ${findings.length}`)
  console.log(`  title mismatches: ${titleIssues.length} (safe to sync to the destination)`)
  console.log(
    `  text mismatches:  ${textIssues.length} (the renderer inherits the destination summary — delete it)`
  )
  console.log(
    `  dead card text:   ${deadText.length} (the component renders none — safe to delete)`
  )
  console.log(`unclassified sections:       ${unknown.length}`)
  // Printed OUTSIDE the "will not render as written" total, because these are
  // correct rather than broken: an external entry in a subsection authors its
  // own description and Karl renders it (census of 2026-08-09, see the header).
  // The line stays even though it can never be a finding, because "the audit
  // said nothing about them" is indistinguishable from "the audit does not look
  // at them" — which is exactly the silence that hid this class for a day.
  console.log(
    `external authored text:      ${externalAuthored.length} (renders as written — verified live 2026-08-09)`
  )

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
  // Not listed per row. They are correct, and a list of correct things under a
  // heading is read as a to-do list by whoever skims this next.
  if (unknown.length) {
    console.log('\nUNKNOWN — the section karl note names no recognized Karl block.')
    console.log('Classify it, or extend AUTHORED/INHERITS in this file:')
    unknown.forEach(printRow)
  }
}

if (require.main === module) main()

module.exports = { auditCards, classifySection, AUTHORED, INHERITS, TITLE_ONLY }

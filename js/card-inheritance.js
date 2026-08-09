/* Shared card-inheritance classifier: the single place that decides how a
   section's cards reach the published page — whether Karl renders the
   DESTINATION page's title and description, its title alone, or the card's own
   authored words.

   Consumed by the browser (js/page-render.js, which side-effect-imports this
   file so the graph guarantees it) via window.cardInheritance, and by
   build_scripts/audit-card-inheritance.js via a plain require — so it has no
   DOM dependency and must stay loadable in both contexts, exactly like
   js/review-merge.js.

   It lives here rather than in the audit script because the renderer and the
   audit must never come to disagree about what inherits. The audit's whole
   claim is "this card text will not appear on SF.gov"; the renderer's whole
   job, since this change, is to show what will. Two copies of these regexes
   would let the mockup show one thing and the audit assert another, and the
   drift would be invisible until a reviewer approved copy that cannot ship.

   Load-order dependency: none of its own — it imports nothing and reads no
   global. It must simply be evaluated before anything calls
   window.cardInheritance, which js/page-render.js's own import of this file
   enforces, and js/main.js lists ahead of page-render.js as documentation. */

/**
 * Karl blocks that render the destination's Title AND its Description. An
 * Agency Services/Resources subsection entry is only "add an SF.gov page or
 * External link", so both fields come from the page it points at.
 *
 * Checked third, so a section naming an authored block or a Related panel wins.
 */
const INHERITS = /services subsection|resources subsection|page.{0,3} chooser/i

/**
 * Karl blocks that render the destination's Title and a link — and NOTHING
 * else. Two components live here, verified separately on 2026-08-08. Full
 * write-up in
 * `docs/source/hhvc-policy/2026-08-08-karl-card-inheritance-verification.md`.
 *
 * The **Related panel**: checked at DOM level against the live Transaction page
 * sf.gov/pay-your-annual-healthy-housing-fee-apartment-buildings, whose Related
 * entries each hold link text and no other text node.
 *
 * A **Resource Collection's Resource section**: checked across three live
 * sf.ResourceCollection pages. The decisive one is
 * sf.gov/vacancy-notice-local-agency-formation-commission, whose entry for
 * `bos-boards-commissions-and-task-forces-application-instruction` rendered
 * that page's Title and nothing else — while the destination demonstrably has
 * a Description. So the blank is Karl declining to render one, not a
 * destination with none to give. That control matters: two sibling pages
 * looked like evidence and were not, one holding only PDFs (whose in-entry
 * "Published <date>" is Document metadata) and one whose single internal link
 * could not be told apart from an inline body link.
 *
 * Resource section sat in INHERITS first, on the reasoning that it resembles a
 * Resources subsection and that keeping card text was the conservative
 * default. Conservative is not the same as correct: it left 19 cards of
 * unrenderable copy in the mockup and dressed them up as decisions a reviewer
 * would spend judgement on.
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
const TITLE_ONLY = /related field|related panel|related_links|resource section/i

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

if (typeof window !== 'undefined') {
  window.cardInheritance = { classifySection, AUTHORED, INHERITS, TITLE_ONLY }
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { classifySection, AUTHORED, INHERITS, TITLE_ONLY }
}

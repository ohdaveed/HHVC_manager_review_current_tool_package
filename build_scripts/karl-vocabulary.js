// build_scripts/karl-vocabulary.js
//
// The controlled vocabulary of Karl constructs a `karl` note may name, plus the
// checks `bun run validate` runs over the notes in pages/*.js.
//
// **Why this exists.** A `karl` note is first-class content here — it is the
// instruction someone follows when they rebuild a mockup page in the real CMS.
// Nothing checked one. `sectionSchema` requires the field
// (build_scripts/schema.js) and `min(1)` is its only constraint, so a note can
// name a Karl field that does not exist on that page's content type and ship. A
// reviewer following one goes looking for controls that are not on the form.
//
// **The vocabulary is DERIVED, not written.** js/karl-blocks.js is the panel
// inventory — every panel of every content type, transcribed from
// docs/karl-export-field-map.md and guarded against it by
// tests/karl-blocks.test.js. Every term this module accepts comes from there:
// panel UI labels, raw Wagtail field names, and the block types named in each
// panel's own chooser. A hand-written list was the first version of this file
// and is what the 2026-08-17 rewrite removed — it was a second transcription of
// the same document, free to drift from it, which is the exact failure this
// module exists to catch. It also produced false positives that a derived list
// cannot: `About` and `Information` are real panels on Agency and About us, and
// notes naming them correctly were reported as unmoored because the hand list
// happened not to contain those two words.
//
// **The vocabulary is PER TYPE, which is the whole point.** A flat set can only
// ask "does this note name something Karl-ish". Per type it can ask the question
// that actually matters — "does this note name something that exists on THIS
// page's form" — and that is the defect class worth catching: a note describing
// `Step by step`'s Step block while sitting on a Transaction page names real
// Karl fields, on the wrong form, and reads as authoritative.
//
// **Two tiers, on purpose.** Naming nothing on this page's form is an error.
// Naming something that belongs to a DIFFERENT type's form is also an error, and
// a sharper one — it is the wrong-form case above, and it is reported separately
// so the message can say which type the term belongs to.
//
// **Deliberately unresolved notes are a first-class state, not a failure.**
// Part of the corpus says "BLOCKED", "flag for Digital Services", "no clean
// mapping" — an honest record that a mapping does not exist yet.
// GAP_LABEL_PATTERN is imported from js/karl-tag-meta.js rather than restated,
// so the validator and the badge a reviewer sees cannot come to disagree about
// what counts as unresolved.
const { classifySection } = require('../js/card-inheritance.js')
const { GAP_LABEL_PATTERN } = require('../js/karl-tag-meta.js')
const { KARL_PANELS, PROMOTE_PANEL } = require('../js/karl-blocks.js')

/**
 * Terms a note may use for ANY type: link shapes and page-level fields that are
 * properties of Karl rather than of one form. These are the only strings in this
 * file not derived from the inventory, and each is a construct the field map
 * documents cross-type rather than in a per-type table.
 */
const CROSS_TYPE_TERMS = [
  'SF.gov page',
  'External link',
  'Button link',
  'Document Picker',
  'page chooser',
  'rich text',
  'Draftail',
  'inline page link',
  'Promote',
  ...PROMOTE_PANEL.fields.flatMap((field) => [field.label, field.rawName]),
  // **Nested block names, which the inventory cannot supply.** These are the
  // repeatable ITEM types inside a panel's chooser — a Resource Collection's
  // `body → Resources` holds "Resource section" items, each with a "Links"
  // stream — and the field map documents them in the prose beneath its tables
  // rather than in the "Block type(s)" cell js/karl-blocks.js transcribes.
  // Every one of the notes that named them was correct and was reported as
  // unmoored until this list existed.
  //
  // They belong in js/karl-blocks.js, beside KARL_FLAGS, which exists for
  // exactly this reason — half the mapping lives in footnotes. They are here
  // rather than there because transcribing them properly means a nesting
  // structure and a drift test of its own, which is a change to the inventory
  // rather than to its first consumer.
  'Resource section',
  'Document section',
  'Data story section',
  'Accordion item',
  'Accordion sidebar',
  'Fact items',
  'Subsection',
  // 'Links' is deliberately NOT here. It is a real stream name, and it is also
  // a substring of `related_links` and `quicklinks` — adding it made a Topic
  // note that names Karl's `related_links` field, which Topic does not have,
  // match its own vocabulary and stop being reported. That note is `U5`, one of
  // the two findings this check exists for, so the generic term cost more than
  // it bought.
]

/**
 * Block type names out of a panel's `blockTypesDoc` cell.
 *
 * The cell is prose with a small number of shapes — `chooser: A | B | C`,
 * `one type: x, no chooser`, `one type: y, instance labelled "Z"` — so this
 * takes everything after a colon, splits on `|` and commas, and adds any quoted
 * name. Over-collecting is safe here and under-collecting is not: a term this
 * misses becomes a false "unmoored" report against a note that is correct.
 *
 * @param {string} doc a panel's blockTypesDoc
 * @returns {string[]}
 */
function blockTypeTerms(doc) {
  if (typeof doc !== 'string' || !doc) return []
  const terms = []
  const afterColon = doc.includes(':') ? doc.slice(doc.indexOf(':') + 1) : doc
  for (const part of afterColon.split(/[|,]/)) {
    const cleaned = part.replace(/\(.*?\)/g, '').trim()
    if (cleaned.length > 2) terms.push(cleaned)
  }
  for (const quoted of doc.match(/"([^"]+)"/g) || []) terms.push(quoted.replace(/"/g, ''))
  return terms
}

/**
 * Every term accepted on one Karl content type, lowercased.
 *
 * @param {string} type a Karl content type name, e.g. 'Transaction'
 * @returns {Set<string>}
 */
function termsForType(type) {
  const terms = [...CROSS_TYPE_TERMS]
  for (const panel of KARL_PANELS[type] || []) {
    terms.push(panel.uiLabel)
    // The inventory keeps the document's parenthetical on Topic's outer
    // StreamField; a note naming just the label should still match.
    terms.push(panel.uiLabel.replace(/\s*\(.*\)\s*$/, ''))
    terms.push(panel.rawName)
    terms.push(...blockTypeTerms(panel.blockTypesDoc))
  }
  return new Set(
    terms
      .filter((term) => typeof term === 'string' && term.trim().length > 2)
      .map((term) => term.trim().toLowerCase())
  )
}

/** Every type's vocabulary, built once. */
const TERMS_BY_TYPE = Object.fromEntries(
  Object.keys(KARL_PANELS).map((type) => [type, termsForType(type)])
)

/**
 * Walk every object in the page set that may carry a `karl` note.
 *
 * @param {Record<string, object>} pages
 * @returns {Array<{pageKey: string, type: string, where: string, karl: string}>}
 */
function collectKarlNotes(pages) {
  const notes = []
  for (const [pageKey, page] of Object.entries(pages)) {
    const type = page.type
    const push = (where, karl) => {
      if (typeof karl === 'string' && karl.trim()) notes.push({ pageKey, type, where, karl })
    }
    push('spotlight', page.spotlight?.karl)
    for (const card of page.partnerAgencies || []) push('partnerAgency card', card.karl)
    for (const section of page.sections || []) {
      const at = `section "${section.heading}"`
      push(at, section.karl)
      push(`${at} callout`, section.callout?.karl)
      push(`${at} image`, section.image?.karl)
      for (const card of section.cards || []) push(`${at} card`, card.karl)
      for (const step of section.steps || []) {
        push(`${at} step "${step.title}"`, step.karl)
        push(`${at} step "${step.title}" callout`, step.callout?.karl)
      }
    }
  }
  return notes
}

/** Whether a note names any term in a vocabulary. Substring, case-insensitive:
 *  ordinals ("a second repeatable Services block") put the term mid-sentence, so
 *  a prefix match would miss most of the corpus. */
function namesTermFrom(karl, terms) {
  const haystack = karl.toLowerCase()
  for (const term of terms) {
    if (haystack.includes(term)) return term
  }
  return null
}

/**
 * Notes that name nothing on their own page's form and do not declare
 * themselves unresolved.
 *
 * @param {Record<string, object>} pages
 * @returns {Array<{pageKey: string, type: string, where: string, karl: string}>}
 */
function findUnmooredNotes(pages) {
  return collectKarlNotes(pages).filter(({ type, karl }) => {
    if (GAP_LABEL_PATTERN.test(karl)) return false
    const terms = TERMS_BY_TYPE[type]
    if (!terms) return false // unknown type is schema.js's job, not this one
    return !namesTermFrom(karl, terms)
  })
}

/**
 * Notes naming a construct that belongs to a DIFFERENT content type's form.
 *
 * This is the check with teeth, and the reason the vocabulary is per type. Such
 * a note names real Karl fields — it reads as precise and authoritative — and
 * sends an editor to a form that does not have them.
 *
 * A note is only reported when it names NOTHING valid for its own type, so a
 * note that correctly describes its own form and mentions another type in
 * passing ("unlike Information, this type has…") is not a finding.
 *
 * @param {Record<string, object>} pages
 * @returns {Array<{pageKey: string, type: string, where: string, karl: string, term: string, belongsTo: string[]}>}
 */
function findWrongTypeNotes(pages) {
  const found = []
  for (const note of findUnmooredNotes(pages)) {
    for (const [otherType, terms] of Object.entries(TERMS_BY_TYPE)) {
      if (otherType === note.type) continue
      const term = namesTermFrom(note.karl, terms)
      if (!term) continue
      const belongsTo = Object.entries(TERMS_BY_TYPE)
        .filter(([, other]) => other.has(term))
        .map(([name]) => name)
      found.push({ ...note, term, belongsTo })
      break
    }
  }
  return found
}

/**
 * Sections that HAVE cards but whose note classifies as `unknown`.
 *
 * js/card-inheritance.js decides from the note's wording whether a card
 * publishes the destination page's title and summary, its title alone, or its
 * own authored words — so an unclassified card-bearing section is one where the
 * renderer has no rule and silently falls through. It is invisible whenever the
 * authored values happen to match the destination's, which is exactly how it
 * survives review.
 *
 * Sections without cards are not included: most of the corpus is prose, and no
 * bucket should claim them.
 *
 * @param {Record<string, object>} pages
 * @returns {Array<{pageKey: string, heading: string, cards: number}>}
 */
function findUnclassifiedCardSections(pages) {
  const found = []
  for (const [pageKey, page] of Object.entries(pages)) {
    for (const section of page.sections || []) {
      if (!section.cards || !section.cards.length) continue
      if (classifySection(section) === 'unknown') {
        found.push({ pageKey, heading: section.heading, cards: section.cards.length })
      }
    }
  }
  return found
}

module.exports = {
  CROSS_TYPE_TERMS,
  TERMS_BY_TYPE,
  blockTypeTerms,
  collectKarlNotes,
  findUnclassifiedCardSections,
  findUnmooredNotes,
  findWrongTypeNotes,
  termsForType,
}

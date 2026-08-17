// build_scripts/karl-vocabulary.js
//
// The controlled vocabulary of Karl constructs a `karl` note may name, plus the
// checks `bun run validate` runs over the notes in pages/*.js.
//
// **Why this exists.** A `karl` note is first-class content here — it is the
// instruction someone follows when they rebuild a mockup page in the real CMS.
// Until now nothing checked one. `sectionSchema` requires the field
// (build_scripts/schema.js) and `min(1)` was its only constraint, so a note
// could name a Karl field that does not exist on that page's content type and
// ship. Twenty-seven of them did: they described `Step by step`'s Step block —
// `step_type`, `optional`, `cost`, `time`, `related_content_transactions` —
// while sitting on Transaction and Information pages, which have none of those
// fields. Seven fields, seven exact matches, wrong content type. A reviewer
// following one would have gone looking for controls that are not on the form.
//
// **Why the vocabulary is seeded from working code, not invented.**
// js/card-inheritance.js already decides what a card publishes by matching
// three regexes against the note's wording, and js/page-render.js's
// inferSectionRole() routes a section to a different renderer the same way. So
// a vocabulary is already implied by behaviour; writing a second, independent
// one would create exactly the drift this module is meant to detect. The
// canonical terms below are the ones those two files act on, plus the block
// names the live-admin capture recorded (docs/karl-export-field-map.md).
//
// **Two tiers, on purpose.** The corpus spells nearly every high-frequency
// concept several ways — `related_links`, `Related field`, `related panel`,
// `Related panel`, `Related section` are all in use for one field. Rejecting
// variants outright would fail a large, semantically correct fraction of the
// corpus and teach people to route around the check. So: naming nothing
// recognizable is an error, and naming it by a non-canonical alias is a report.
//
// **Deliberately unresolved notes are a first-class state, not a failure.**
// Roughly a tenth of the corpus says "BLOCKED", "flag for Digital Services",
// "no clean mapping" — an honest record that a mapping does not exist yet.
// GAP_LABEL_PATTERN is imported from js/karl-tag-meta.js rather than restated,
// so the validator and the badge the reviewer sees cannot come to disagree
// about what counts as unresolved.
const { classifySection } = require('../js/card-inheritance.js')
const { GAP_LABEL_PATTERN } = require('../js/karl-tag-meta.js')

/**
 * Canonical Karl constructs, each with the aliases seen in the corpus.
 *
 * `canonical` is the spelling to write. `aliases` are accepted but reported by
 * `findAliasDrift`, so normalization is a visible, reviewable pass rather than
 * a silent rewrite. Matching is case-insensitive and substring-based —
 * ordinals ("a second repeatable Services block") put the term mid-sentence, so
 * a prefix match would miss most of the corpus.
 */
const VOCABULARY = [
  // Transaction
  { canonical: 'what_to_do', aliases: ['What to Do'] },
  { canonical: 'Section specifics', aliases: ['section_specifics'] },
  { canonical: 'Section title', aliases: ['section_title'] },
  { canonical: 'things_to_know', aliases: ['Things to Know'] },
  { canonical: 'supporting_information', aliases: ['Supporting information'] },
  { canonical: 'custom_section', aliases: ['Custom Section'] },
  { canonical: 'good_for_community', aliases: [] },
  { canonical: 'get_help', aliases: ['Contact us'] },
  // Cross-type link and body blocks
  { canonical: 'Related field', aliases: ['related panel', 'Related panel', 'Related section'] },
  { canonical: 'related_links', aliases: [] },
  { canonical: 'Title and text', aliases: [] },
  { canonical: 'Callout', aliases: [] },
  { canonical: 'Button link', aliases: [] },
  { canonical: 'Text block', aliases: [] },
  { canonical: 'Image', aliases: [] },
  { canonical: 'Document Picker', aliases: [] },
  // Agency / Topic / About us groupings
  { canonical: 'Services subsection', aliases: ['Services block'] },
  { canonical: 'Resources subsection', aliases: ['Resources block'] },
  { canonical: 'Resource section', aliases: [] },
  { canonical: 'SF.gov page', aliases: ['SF.gov page link'] },
  { canonical: 'External link', aliases: [] },
  { canonical: 'Information section', aliases: [] },
  { canonical: 'Introductory text', aliases: [] },
  // Campaign
  { canonical: 'Additional content', aliases: [] },
  { canonical: 'Spotlight', aliases: [] },
  { canonical: 'Top facts', aliases: [] },
  { canonical: 'Accordion', aliases: [] },
  // Report
  { canonical: 'Report Content', aliases: [] },
  { canonical: 'Table block', aliases: [] },
  { canonical: 'Body', aliases: [] },
  // Page-level fields that a note may legitimately name as a destination
  { canonical: 'primary_agency', aliases: ['Primary agency'] },
  { canonical: 'partner_agencies', aliases: ['Partner agencies'] },
  { canonical: 'topics', aliases: ['Topics'] },
  { canonical: 'part_of', aliases: ['Part of'] },
  { canonical: 'Print version', aliases: [] },
  { canonical: 'inline page link', aliases: [] },
]

/** Every accepted term, canonical or alias, lowercased for matching. */
const ALL_TERMS = VOCABULARY.flatMap((entry) => [entry.canonical, ...entry.aliases]).map((term) =>
  term.toLowerCase()
)

/**
 * Walk every object in the page set that may carry a `karl` note.
 *
 * @param {Record<string, object>} pages
 * @returns {Array<{pageKey: string, where: string, karl: string, section?: object}>}
 */
function collectKarlNotes(pages) {
  const notes = []
  const push = (pageKey, where, karl, section) => {
    if (typeof karl === 'string' && karl.trim()) notes.push({ pageKey, where, karl, section })
  }
  for (const [pageKey, page] of Object.entries(pages)) {
    push(pageKey, 'spotlight', page.spotlight?.karl)
    for (const card of page.partnerAgencies || []) push(pageKey, 'partnerAgency card', card.karl)
    for (const section of page.sections || []) {
      const at = `section "${section.heading}"`
      push(pageKey, at, section.karl, section)
      push(pageKey, `${at} callout`, section.callout?.karl)
      push(pageKey, `${at} image`, section.image?.karl)
      for (const card of section.cards || []) push(pageKey, `${at} card`, card.karl)
      for (const step of section.steps || []) {
        push(pageKey, `${at} step "${step.title}"`, step.karl)
        push(pageKey, `${at} step "${step.title}" callout`, step.callout?.karl)
      }
    }
  }
  return notes
}

/**
 * Notes that name no recognized Karl construct and do not declare themselves
 * unresolved. Tier 1 — a hard failure.
 *
 * @param {Record<string, object>} pages
 * @returns {Array<{pageKey: string, where: string, karl: string}>}
 */
function findUnmooredNotes(pages) {
  return collectKarlNotes(pages)
    .filter(({ karl }) => {
      if (GAP_LABEL_PATTERN.test(karl)) return false
      const haystack = karl.toLowerCase()
      return !ALL_TERMS.some((term) => haystack.includes(term))
    })
    .map(({ pageKey, where, karl }) => ({ pageKey, where, karl }))
}

/**
 * Notes using an accepted alias rather than the canonical spelling. Tier 2 —
 * reported, never fatal, because the corpus is full of them and they are
 * correct, just inconsistent.
 *
 * @param {Record<string, object>} pages
 * @returns {Array<{pageKey: string, where: string, used: string, canonical: string}>}
 */
function findAliasDrift(pages) {
  const found = []
  for (const { pageKey, where, karl } of collectKarlNotes(pages)) {
    const haystack = karl.toLowerCase()
    for (const entry of VOCABULARY) {
      for (const alias of entry.aliases) {
        if (haystack.includes(alias.toLowerCase())) {
          found.push({ pageKey, where, used: alias, canonical: entry.canonical })
        }
      }
    }
  }
  return found
}

/**
 * Sections that HAVE cards but whose note classifies as `unknown`.
 *
 * This is the assertion with teeth. js/card-inheritance.js decides from the
 * note's wording whether a card publishes the destination page's title and
 * summary, its title alone, or its own authored words — so an unclassified
 * card-bearing section is one where the renderer has no rule and silently falls
 * through. It is invisible whenever the authored values happen to match the
 * destination's, which is exactly how it survives review.
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
  VOCABULARY,
  collectKarlNotes,
  findUnmooredNotes,
  findAliasDrift,
  findUnclassifiedCardSections,
}

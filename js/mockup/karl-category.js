/* What kind of CMS thing a Karl tag points at, as a SECOND axis beside the
   tag's `kind`.

   **Why this is derived rather than authored, and why `kind` is not renamed.**
   js/karl/karl-guide-registry.js computes `role = context.role ||
   context.component || kind`, and 14 of the 31 karlTag() call sites in
   js/mockup/page-render.js pass a bare kind literal with no role — so for those
   sites the kind string IS the role that resolves a Karl field path. Renaming
   the kinds to carry semantic categories would change `role` for all 14, and
   any new name absent from ROLE_PANELS/ROLE_ALIASES resolves to '' and reports
   "Mockup only". That is a confident wrong answer about where an editor should
   paste approved copy, which is the failure this whole subsystem exists to
   prevent. So the category reads signals that are ALREADY in scope at
   karlTag(), and nothing that feeds role resolution is touched.

   **Colour follows the category; the kind keeps its word.** The two cannot both
   own the chip's fill. They do not need to: every tag already prints its kind
   in words inside `.karl-tag-kind`, so the kind survives as a text encoding
   while the category takes the colour — which also keeps the encoding readable
   without colour.

   Imports nothing and reads no global, so it has no load-order dependency and
   can be tested without a DOM. */

/**
 * The six categories, in the order the legend lists them.
 *
 * Six rather than the brief's five: `editor` covers QA notes, which are not
 * Karl fields at all and must never read as publishable content.
 */
const KARL_CATEGORIES = {
  metadata: {
    label: 'Metadata',
    hint: 'Page title, description, slug, and search fields',
  },
  block: {
    label: 'StreamField',
    hint: 'Body content blocks — the default when nothing more specific applies',
  },
  action: {
    label: 'Action',
    hint: 'Button links and calls to action',
  },
  callout: {
    label: 'Callout',
    hint: 'Callouts and things-to-know panels',
  },
  inherited: {
    label: 'Link picker',
    hint: 'Page choosers — Karl publishes the destination page’s own words',
  },
  editor: {
    label: 'Editor only',
    hint: 'QA notes — do not publish',
  },
}

// Roles that name page metadata rather than body content. Kept as a set rather
// than a regex so adding one is a data edit with an obvious diff.
const METADATA_ROLES = new Set(['title', 'description', 'slug', 'seoTitle', 'metaDescription'])

// Link shapes that are page CHOOSERS — the destination page supplies the
// words. `button-link` is deliberately absent: it takes authored link text and
// is an action, not an inherited value.
const PICKER_SHAPES = new Set(['page-reference', 'resources-list', 'campaign-related'])

/**
 * Classify one Karl tag.
 *
 * **The branch order is the contract, not an implementation detail**, because
 * these signals co-occur in the real corpus: a Spotlight CTA carries both
 * `role: 'spotlight'` and `linkShape: 'button-link'`, and an inheriting card
 * carries both an `inheritanceFact` and a `linkShape`. Every collision is
 * pinned in tests/karl-category.test.js, so reordering these branches goes red.
 *
 * Total by construction: an unrecognized combination returns `block`, the named
 * default. Returning undefined would render a tag with no fill at all, which
 * reads as a styling bug rather than as an unclassified tag.
 *
 * @param {{kind?: string, role?: string, linkShape?: string,
 *   inheritanceFact?: string}} signals Everything karlTag() has in scope.
 * @returns {string} One of the KARL_CATEGORIES keys.
 */
function karlCategory({ kind, role, linkShape, inheritanceFact } = {}) {
  // First, and unconditionally: an editor-only note must never be coloured as
  // anything publishable, whatever else it happens to carry.
  if (kind === 'editor') return 'editor'
  if (kind === 'meta' || METADATA_ROLES.has(role)) return 'metadata'
  // Inheritance before link shape: an inheriting card usually carries both, and
  // "Karl supplies these words" is the more important fact for a reviewer than
  // "this is a link".
  if (inheritanceFact) return 'inherited'
  if (PICKER_SHAPES.has(linkShape)) return 'inherited'
  // Link shape before role: a Spotlight CTA is an action that happens to live
  // in a spotlight, not a spotlight that happens to be clickable.
  if (linkShape === 'button-link') return 'action'
  if (role === 'callout' || role === 'what-to-know') return 'callout'
  return 'block'
}

export { KARL_CATEGORIES, karlCategory }

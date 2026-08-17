/* The Karl CMS panel inventory: what an editor's form actually contains, per
   content type, in the order the form presents it.

   Transcribed by hand from docs/karl-export-field-map.md — the E1 record of
   each type's live add-page form — rather than parsed from it at runtime.
   Parsing was rejected because half the mapping lives in prose FOOTNOTES under
   those tables (a Callout has no title field; the cost description caps at 120
   characters; bullets fold into the Text block's rich text rather than becoming
   a block of their own), and a parser that reads only the tables loses exactly
   those and reports success. tests/karl-blocks.test.js parses the document
   instead, so drift goes red in CI without the runtime ever depending on the
   prose staying machine-readable.

   Every row of every per-type table is transcribed, including the rows whose
   Mockup source is "—". A panel with no mockup value is not a panel an editor
   can skip: `primary_agency` is required on seven of the eight types and this
   tool has no field for it (U6), so the transcript has to say so rather than
   leave a hole the editor discovers when Karl refuses to save.

   Dual-exported (window.karlBlocks plus module.exports) exactly like
   js/card-inheritance.js and js/review-merge.js: the browser panel and the Node
   CLI must share one inventory rather than two copies free to come to disagree
   about which field an editor is being sent to.

   Load-order dependency: none of its own — it imports nothing and reads no
   global. It must simply be evaluated before anything calls window.karlBlocks,
   which js/main.js guarantees by listing it ahead of js/karl-transcript.js. */

/**
 * A panel's mockup source, as a tagged union rather than a dotted path.
 *
 * The field map's "Mockup source" column is a PREDICATE on six of the eight
 * types — `section` with `component: 'supporting'`, `component: 'services'`
 * sections, `section with cards[]` — and a dotted path only on Transaction's
 * scalars. A path resolver would therefore cover one type and leave the rest
 * silently empty, which is the failure this whole feature exists to prevent.
 *
 * - `{ kind: 'none' }` — the panel has no mockup source.
 * - `{ kind: 'path', path, altPaths? }` — a dotted page path. `altPaths` covers
 *   the one field the mockup spells two ways (`whatToKnow.thingsToKnow` and
 *   `whatToKnow.items` are the same Karl panel).
 * - `{ kind: 'sections', match, field?, nth?, inferred? }` — every section
 *   matching `match`; `field` narrows the emission to one field of it (Agency's
 *   `services_title` takes the matched section's `heading`), and `nth` picks a
 *   single match by index (Campaign's Spotlight 1 and Spotlight 2 are two
 *   independent fields, not one repeatable one).
 *
 * A panel may carry an ARRAY of sources, which are tried in order and all
 * emitted.
 *
 * `inferred: true` marks a mapping this repo derived rather than one the field
 * map documents. There is exactly one today — a plain Transaction body section
 * reaching `custom_section` — and the transcript prints it as inferred so an
 * editor verifies it rather than trusting it.
 */

/** @typedef {{component?: string|null, flat?: boolean, has?: string[], lacks?: string[], cardClass?: string}} Match */

/**
 * Whether one section satisfies a panel's match predicate. Every declared key
 * must hold; an absent key constrains nothing.
 *
 * `cardClass` is PASSED IN rather than derived here, so this module keeps its
 * "imports nothing, reads no global" property and the classification stays the
 * single one in js/card-inheritance.js. Re-deriving it here would be a second
 * copy of the rule that decides whether a card publishes its own words — the
 * exact drift that classifier exists to prevent.
 *
 * @param {Match} match
 * @param {object} section
 * @param {string|null} cardClass the js/card-inheritance.js classification
 * @returns {boolean}
 */
function matchesSection(match, section, cardClass) {
  if (!match || !section) return false
  if ('component' in match) {
    // `?? null` rather than a falsiness check: a section carrying no
    // `component` at all is a distinct case the Transaction body rule keys on,
    // and it has to be expressible as a match rather than as "anything".
    const actual = section.component ?? null
    if (actual !== match.component) return false
  }
  if ('flat' in match && Boolean(section.flat) !== match.flat) return false
  for (const field of match.has || []) {
    if (!section[field]) return false
  }
  for (const field of match.lacks || []) {
    if (section[field]) return false
  }
  if ('cardClass' in match && cardClass !== match.cardClass) return false
  return true
}

/**
 * The panel inventory for one content type, in the form's own order.
 *
 * Returns an empty array for an unknown type rather than throwing: the caller
 * reports "no Karl panel inventory for type X" as a transcript-level error,
 * which names the problem better than a stack trace from deep inside a walk.
 * build_scripts/schema.js's `type` union is what makes that case unreachable
 * from real page data in the first place.
 * @param {string} type
 * @returns {object[]}
 */
function panelsFor(type) {
  return KARL_PANELS[type] || []
}

/**
 * One panel of a type, by its raw Wagtail field name.
 *
 * Raw names are unique within a type — asserted in tests/karl-blocks.test.js —
 * which is why they, and not the UI label, are the key. Several types repeat a
 * label: Agency has TWO panels called "Subsection", one under Section title 1
 * and one under Section title 2.
 *
 * @param {string} type
 * @param {string} rawName
 * @returns {object|null}
 */
function panelByRawName(type, rawName) {
  return panelsFor(type).find((panel) => panel.rawName === rawName) || null
}

/** A uiLabel as it should read inside a breadcrumb. The inventory keeps the
 *  document's own label verbatim, including the parenthetical the field map
 *  adds to disambiguate Topic's outer StreamField from the block choice of the
 *  same name — useful in the record, noise in a path an editor follows. */
function crumbLabel(panel) {
  return panel.uiLabel.replace(/\s*\(.*\)\s*$/, '')
}

/**
 * The Karl navigation path to one panel, as an editor clicks it.
 *
 * Every level here is DERIVED from the transcription rather than authored, so
 * the drift guard covers the path as well as the fields:
 *
 * - the parent chain comes from `subPanelOf`, itself asserted against the
 *   field map's `↳` prefix;
 * - a repeated uiLabel is qualified by the nearest preceding panel with a
 *   different label, which is what the form itself shows — Agency's two
 *   "Subsection" panels are told apart by the "Section title 1"/"Section
 *   title 2" heading immediately above each, and panel ORDER is transcribed;
 * - `within` names a block type from the panel's own chooser and is checked
 *   against `blockTypesDoc` by the caller's own test, so it cannot invent a
 *   level either.
 *
 * @param {string} type
 * @param {object|null} panel
 * @param {string} [within] a block type from this panel's chooser
 * @returns {string} e.g. 'Content → Section title 1 → Subsection'
 */
function breadcrumbFor(type, panel, within) {
  if (!panel) return ''
  const panels = panelsFor(type)
  const chain = []
  const seen = new Set([panel.rawName])
  let current = panel
  while (current.subPanelOf && !seen.has(current.subPanelOf)) {
    seen.add(current.subPanelOf)
    const parent = panelByRawName(type, current.subPanelOf)
    if (!parent) break
    chain.unshift(parent)
    current = parent
  }
  const parts = []
  const root = chain[0] || panel
  if (panels.filter((entry) => entry.uiLabel === root.uiLabel).length > 1) {
    const index = panels.indexOf(root)
    for (let i = index - 1; i >= 0; i -= 1) {
      if (panels[i].uiLabel !== root.uiLabel) {
        parts.push(crumbLabel(panels[i]))
        break
      }
    }
  }
  parts.push(...chain.map(crumbLabel), crumbLabel(panel))
  if (within) parts.push(within)
  return ['Content', ...parts].join(' → ')
}

/**
 * The field map's footnotes, as explicit values. These are half the mapping and
 * none of them are in the tables, so a table-driven transcription drops them
 * silently — which is why tests/karl-blocks.test.js asserts them by name rather
 * than leaving them for a reader to notice.
 */
const KARL_FLAGS = {
  // Every Karl Callout — Transaction `what_to_do`, Transaction
  // `section_specifics`, Information `information_section` — is a single
  // Draftail field with no title (U2, field map line 829). A mockup
  // `callout.title` therefore has no home at all.
  calloutHasNoTitle: true,
  // All five `cost` radio variants end at the same "Cost description" rich text
  // field, capped at 120 characters (field map line 317).
  costDescriptionMaxChars: 120,
  // "Bullets render inside the Text block's rich text, not as a separate
  // block" (field map line 334).
  bulletsFoldIntoText: true,
  // The Help Center's 25-character button rule is real editorial guidance; the
  // live field carries maxlength="255" (O14, field map line 871). Reporting
  // only the schema limit loses the guidance, and reporting only the guidance
  // as a limit would be false.
  buttonLabelGuidanceChars: 25,
  buttonLabelMaxChars: 255,
  // Rendering/editorial caps, NOT schema ones — the forms accept more, measured
  // 2026-08-15 (field map lines 264-282). Reported as guidance, never as a stop.
  spotlightsAllowed: { Agency: 2, Campaign: 2, Report: 1, Topic: 1 },
}

/**
 * The heading each add-page form carries once it opens, which is the first
 * instruction in every transcript. The path TO the form is
 * `Karl admin → Pages → [parent] → Add child page → "<Type>"`, or directly
 * `https://api.sf.gov/admin/pages/add/sf/<model>/2/` (field map lines 94-110);
 * everything after the form opens is what an editor actually follows.
 */
const KARL_NAV = {
  Transaction: 'New: Transaction → Content',
  Information: 'New: Information → Content',
  'Resource Collection': 'New: Resource Collection → Content',
  Campaign: 'New: Campaign → Content',
  Topic: 'New: Topic → Content',
  Agency: 'New: Agency → Content',
  'About us': 'New: About us → Content',
  Report: 'New: Report → Content',
}

/**
 * The Promote tab, which every one of the eight types carries identically —
 * so it is one record here rather than a repeated block in each per-type
 * inventory. The field map documents it in a single table (see `docLine`),
 * which is what closed `U11`.
 *
 * It lives in the INVENTORY rather than in js/karl-transcript.js, where it was
 * first written, because it is a fact about Karl's form: the same reason every
 * other panel is here. The builder consumes it; it does not own it.
 *
 * Deliberately NOT a member of `KARL_PANELS`, and therefore not returned by
 * `panelsFor()`. Those are Content-tab panels in the form's own order, and
 * folding a second tab into that list would put this in the middle of the
 * sequence an editor works down. It is also shaped differently — flat fields
 * rather than a block source — because none of these is a StreamField.
 *
 * The instruction cannot be dropped for being small: `slug` is required on
 * every type, and it is the reason a page cannot be saved from the Content tab
 * alone.
 */
const PROMOTE_PANEL = {
  uiLabel: 'Promote → For search engines',
  docLine: 149,
  fields: [
    { label: 'Slug', rawName: 'slug', path: 'slug', required: true },
    { label: 'Title tag', rawName: 'seo_title', path: 'seoTitle', required: false },
    {
      label: 'Meta description',
      rawName: 'search_description',
      path: 'metaDescription',
      required: false,
    },
  ],
}

/**
 * The unresolved register, as SHAPE RULES rather than as a list of page keys.
 *
 * A path allowlist was rejected: it would let a newly authored section inherit
 * an old exemption just by landing at the same index, which is precisely the
 * case the ratchet exists to catch. Closing a register entry upstream therefore
 * means deleting its rule here, and every section it covered fails until it is
 * mapped — which is the behaviour wanted, since a closed entry means a
 * destination now exists.
 *
 * `docLine` cites the row in docs/karl-export-field-map.md's "Unresolved
 * register" that documents the decision this rule defers to.
 */
const UNRESOLVED = [
  {
    id: 'U1',
    shape: 'section-button-outside-step',
    docLine: 836,
    reason:
      "Section-level buttons outside a step. Transaction's only Button link slot sits inside a what_to_do Section, and Report's only inside the Spotlight. Blocked on a Digital Services decision.",
  },
  {
    id: 'U3',
    shape: 'information-steps',
    docLine: 838,
    reason:
      'Steps on an Information page. Information has no what_to_do-style container. Karl’s Step by step type fits the steps exactly but has no page-level cost and no things_to_know, so retyping would drop whatToKnow entirely. Blocked on a content decision.',
  },
  {
    id: 'U5',
    shape: 'topic-related',
    docLine: 840,
    reason:
      'A Related panel on a Topic page. Topic has no `related` field, confirmed at E1. Either the panel moves into content_fields as a Resources block, or the page drops it. Blocked on a content decision.',
  },
  {
    id: 'U20',
    shape: 'agency-subsection-paragraphs',
    docLine: 855,
    reason:
      'Intro paragraphs on an Agency Services/Resources section. The Subsection carries a single optional Title and a links list — there is no description field, so the paragraph has nowhere to go. This is U4’s shape measured on Agency rather than Topic, and it needs the same answer. Blocked on a Digital Services decision.',
  },
  // U21 is one register entry over three shapes rather than three entries: the
  // gap is a property of the type, so the same open question lands under a
  // different name on each of the three types that have it. Splitting it would
  // suggest three decisions where there is one.
  {
    id: 'U21',
    shape: 'campaign-page-summary',
    docLine: 856,
    reason:
      'Campaign has no page `description` field, and both Campaign pages declare a summary the mockup renders under the title. `about_campaign` is an About SECTION rather than a page description, so folding it in is a content decision. Blocked on a content decision.',
  },
  {
    id: 'U21',
    shape: 'about-us-page-summary',
    docLine: 856,
    reason:
      'About us has no page `description` field — its whole Content tab is four panels — and `aboutHhvcTeam` declares a summary. Blocked on a content decision.',
  },
  {
    id: 'U21',
    shape: 'report-page-summary',
    docLine: 856,
    reason:
      'Report has no page `description` field, and `article11Guide` declares a summary. Blocked on a content decision.',
  },
  {
    id: 'U22',
    shape: 'information-page-contact',
    docLine: 857,
    reason:
      'Information has no Contact us panel — `get_help` is Transaction’s, and the `Contact` block belongs to Campaign and Agency — yet two Information pages carry `contact`. Blocked on a content decision.',
  },
  {
    id: 'U23',
    shape: 'information-page-whattoknow',
    docLine: 858,
    reason:
      'Information has no `cost` and no `things_to_know`; both sit under Transaction’s "What to Know Before You Start" grouping. One Information page carries `whatToKnow`. This is U3’s trade seen from the other side. Blocked on a content decision.',
  },
]

const KARL_PANELS = {
  Transaction: [
    {
      uiLabel: 'Page title',
      rawName: 'title',
      order: 0,
      required: true,
      repeatable: false,
      requiredDoc: 'yes',
      repeatableDoc: 'single',
      blockTypesDoc: 'plain text',
      sourceDoc: 'title',
      source: {
        kind: 'path',
        path: 'title',
      },
      docLine: 305,
    },
    {
      uiLabel: 'Description',
      rawName: 'description',
      order: 1,
      required: false,
      repeatable: false,
      requiredDoc: 'not recorded',
      repeatableDoc: 'single',
      blockTypesDoc: 'textarea',
      sourceDoc: 'summary',
      source: {
        kind: 'path',
        path: 'summary',
      },
      docLine: 306,
    },
    {
      uiLabel: 'Primary agency',
      rawName: 'primary_agency',
      order: 2,
      required: true,
      repeatable: false,
      requiredDoc: 'yes',
      repeatableDoc: 'single',
      blockTypesDoc: 'page chooser → Agency only',
      sourceDoc: '— (no mockup field; U6)',
      source: {
        kind: 'none',
      },
      docLine: 307,
      note: 'U6 — the mockup has no primary_agency field, and Karl requires it. Supply the parent Agency page by hand.',
    },
    {
      uiLabel: 'Cost',
      rawName: 'cost',
      order: 3,
      required: true,
      repeatable: false,
      requiredDoc: 'yes (radio)',
      repeatableDoc: 'max 1 item',
      blockTypesDoc: 'struct, auto-inserted, no chooser',
      sourceDoc: 'whatToKnow.cost',
      source: {
        kind: 'path',
        path: 'whatToKnow.cost',
      },
      docLine: 308,
    },
    {
      uiLabel: 'Things to Know',
      rawName: 'things_to_know',
      order: 4,
      required: false,
      repeatable: true,
      requiredDoc: 'not recorded',
      repeatableDoc: 'repeatable (3 seen live)',
      blockTypesDoc: 'one type: title_and_text, no chooser',
      sourceDoc: 'whatToKnow.thingsToKnow[] / .items[]',
      source: {
        kind: 'path',
        path: 'whatToKnow.thingsToKnow',
        altPaths: ['whatToKnow.items'],
      },
      docLine: 309,
    },
    {
      uiLabel: 'What to Do',
      rawName: 'what_to_do',
      order: 5,
      required: false,
      repeatable: true,
      requiredDoc: 'not recorded',
      repeatableDoc: 'repeatable',
      blockTypesDoc: 'chooser: Callout | Section',
      sourceDoc: 'sections[].steps[]',
      source: {
        kind: 'sections',
        match: {
          has: ['steps'],
        },
      },
      docLine: 310,
    },
    {
      uiLabel: 'Section title',
      rawName: 'section_title',
      order: 6,
      required: false,
      repeatable: false,
      requiredDoc: 'not recorded',
      repeatableDoc: 'single per Section',
      blockTypesDoc: 'plain text',
      sourceDoc: 'step.title',
      source: {
        kind: 'none',
      },
      docLine: 311,
      subPanelOf: 'what_to_do',
    },
    {
      uiLabel: 'Section specifics',
      rawName: 'section_specifics',
      order: 7,
      required: false,
      repeatable: true,
      requiredDoc: 'not recorded',
      repeatableDoc: 'repeatable',
      blockTypesDoc:
        'chooser: Address | Callout | Document | Email | Button link | Phone number | Text',
      sourceDoc: 'step.text[]/bullets[] → Text; step.button → Button link; step.callout → Callout',
      source: {
        kind: 'none',
      },
      docLine: 312,
      subPanelOf: 'what_to_do',
    },
    {
      uiLabel: 'Special cases',
      rawName: 'special_cases',
      order: 8,
      required: false,
      repeatable: false,
      requiredDoc: 'no',
      repeatableDoc: 'single',
      blockTypesDoc: 'plain text — heading override for the two panels below',
      sourceDoc: '— (closed U7)',
      source: {
        kind: 'none',
      },
      docLine: 313,
    },
    {
      uiLabel: 'Accordion title and text',
      rawName: 'supporting_information',
      order: 9,
      required: false,
      repeatable: true,
      requiredDoc: 'not recorded',
      repeatableDoc: 'repeatable (5 pre-seeded)',
      blockTypesDoc: 'one type: title_and_text, instance labelled "Accordion item"',
      sourceDoc: "section with component: 'supporting'",
      source: {
        kind: 'sections',
        match: {
          component: 'supporting',
          flat: false,
        },
      },
      docLine: 314,
    },
    {
      uiLabel: 'Custom Section',
      rawName: 'custom_section',
      order: 10,
      required: false,
      repeatable: true,
      requiredDoc: 'not recorded',
      repeatableDoc: 'repeatable',
      blockTypesDoc: 'one type: title_and_text, no chooser',
      sourceDoc: "section with component: 'supporting', flat: true",
      source: [
        {
          kind: 'sections',
          match: {
            component: 'supporting',
            flat: true,
          },
        },
        {
          kind: 'sections',
          match: {
            component: null,
            lacks: ['steps', 'cards'],
          },
          inferred: true,
        },
      ],
      docLine: 315,
    },
    {
      uiLabel: 'Related',
      rawName: 'related',
      order: 11,
      required: true,
      repeatable: true,
      requiredDoc: '"Page " required per entry',
      repeatableDoc: 'repeatable',
      blockTypesDoc: 'page chooser, unrestricted, no chooser popup',
      sourceDoc: 'section.cards[] where the section is a Related panel',
      source: {
        kind: 'sections',
        match: {
          cardClass: 'title-only',
        },
      },
      docLine: 316,
    },
    {
      uiLabel: 'Why is this Transaction Good for the Community?',
      rawName: 'good_for_community',
      order: 12,
      required: false,
      repeatable: true,
      requiredDoc: 'not recorded',
      repeatableDoc: 'repeatable (2 seen)',
      blockTypesDoc: 'one type, labelled "Additional info": Title + Text',
      sourceDoc: '— (U6)',
      source: {
        kind: 'none',
      },
      docLine: 317,
    },
    {
      uiLabel: 'Contact us',
      rawName: 'get_help',
      order: 13,
      required: false,
      repeatable: true,
      requiredDoc: 'not recorded',
      repeatableDoc: 'repeatable',
      blockTypesDoc: 'chooser: Address | Email | Phone number | Additional info',
      sourceDoc: 'contact (unused on Transaction pages)',
      source: {
        kind: 'path',
        path: 'contact',
      },
      docLine: 318,
    },
    {
      uiLabel: 'Partner agencies',
      rawName: 'partner_agencies',
      order: 14,
      required: false,
      repeatable: true,
      requiredDoc: 'not recorded',
      repeatableDoc: 'repeatable',
      blockTypesDoc: 'page chooser → Agency only',
      sourceDoc: 'partnerAgencies[] (9 of 14 pages)',
      source: {
        kind: 'path',
        path: 'partnerAgencies',
      },
      docLine: 319,
    },
    {
      uiLabel: 'Topics',
      rawName: 'topics',
      order: 15,
      required: false,
      repeatable: true,
      requiredDoc: 'not recorded',
      repeatableDoc: 'repeatable',
      blockTypesDoc: 'page chooser → Topic only, plus "Hide on Topic Pages" checkbox',
      sourceDoc: '— unmapped metadata (mockup values store Agency labels)',
      source: {
        kind: 'none',
      },
      docLine: 320,
      note: 'topicTag is unmapped metadata — the stored values are Agency labels, not Topic chooser references.',
    },
    {
      uiLabel: 'Redirect this page to',
      rawName: 'redirect_url',
      order: 16,
      required: false,
      repeatable: false,
      requiredDoc: '—',
      repeatableDoc: 'single',
      blockTypesDoc: 'plain text, disabled by design',
      sourceDoc: '— (closed U7)',
      source: {
        kind: 'none',
      },
      docLine: 321,
      note: 'Disabled by design — a ConditionalReadOnlyFieldPanel. Never type into it.',
    },
  ],
  Information: [
    {
      uiLabel: 'Page title',
      rawName: 'title',
      order: 0,
      required: true,
      repeatable: false,
      requiredDoc: 'yes',
      repeatableDoc: 'single',
      blockTypesDoc: 'plain text',
      sourceDoc: 'title',
      source: {
        kind: 'path',
        path: 'title',
      },
      docLine: 356,
    },
    {
      uiLabel: 'Description',
      rawName: 'description',
      order: 1,
      required: false,
      repeatable: false,
      requiredDoc: 'no',
      repeatableDoc: 'single',
      blockTypesDoc: 'plain textarea — no rich text toolbar',
      sourceDoc: 'summary',
      source: {
        kind: 'path',
        path: 'summary',
      },
      docLine: 357,
    },
    {
      uiLabel: 'Primary agency',
      rawName: 'primary_agency',
      order: 2,
      required: true,
      repeatable: false,
      requiredDoc: 'yes',
      repeatableDoc: 'single',
      blockTypesDoc: 'page chooser → Agency only',
      sourceDoc: '— (U6)',
      source: {
        kind: 'none',
      },
      docLine: 358,
      note: 'U6 — supply the parent Agency page by hand; the mockup has no field for it.',
    },
    {
      uiLabel: 'Part of',
      rawName: 'part_of',
      order: 3,
      required: false,
      repeatable: true,
      requiredDoc: 'not recorded',
      repeatableDoc: 'repeatable',
      blockTypesDoc: 'page chooser → Transaction pages only',
      sourceDoc: '— (U6)',
      source: {
        kind: 'none',
      },
      docLine: 359,
    },
    {
      uiLabel: 'Information section',
      rawName: 'information_section',
      order: 4,
      required: false,
      repeatable: true,
      requiredDoc: 'not recorded',
      repeatableDoc: 'repeatable stream',
      blockTypesDoc: 'chooser: Title and text | Image | Callout',
      sourceDoc: 'sections[] — heading+paragraphs[]/bullets[] → Title and text; callout → Callout',
      source: [
        {
          kind: 'sections',
          match: {
            lacks: ['cards', 'steps'],
          },
        },
        {
          kind: 'sections',
          match: {
            cardClass: 'authored',
          },
        },
      ],
      docLine: 360,
    },
    {
      uiLabel: 'Partner agencies',
      rawName: 'partner_agencies',
      order: 5,
      required: false,
      repeatable: true,
      requiredDoc: 'not recorded',
      repeatableDoc: 'repeatable',
      blockTypesDoc: 'page chooser → Agency only',
      sourceDoc: 'partnerAgencies[] (unused here)',
      source: {
        kind: 'path',
        path: 'partnerAgencies',
      },
      docLine: 361,
    },
    {
      uiLabel: 'Topics',
      rawName: 'topics',
      order: 6,
      required: false,
      repeatable: true,
      requiredDoc: 'not recorded',
      repeatableDoc: 'repeatable',
      blockTypesDoc: 'page chooser → Topic only',
      sourceDoc: 'topicTag (2 of 6 pages)',
      source: {
        kind: 'none',
      },
      docLine: 362,
      note: 'topicTag is unmapped metadata — the stored values are Agency labels, not Topic chooser references. Do not paste one into this chooser.',
    },
    {
      uiLabel: 'Related',
      rawName: 'related',
      order: 7,
      required: false,
      repeatable: true,
      requiredDoc: 'not recorded',
      repeatableDoc: 'repeatable',
      blockTypesDoc: 'unrestricted page chooser, link shape 1',
      sourceDoc: "section with component: 'related' (2 sections)",
      source: [
        {
          kind: 'sections',
          match: {
            component: 'related',
          },
        },
        {
          kind: 'sections',
          match: {
            cardClass: 'title-only',
          },
        },
      ],
      docLine: 363,
    },
  ],
  'Resource Collection': [
    {
      uiLabel: 'Page title',
      rawName: 'title',
      order: 0,
      required: true,
      repeatable: false,
      requiredDoc: 'yes',
      repeatableDoc: 'single',
      blockTypesDoc: 'plain text',
      sourceDoc: 'title',
      source: {
        kind: 'path',
        path: 'title',
      },
      docLine: 387,
    },
    {
      uiLabel: 'Description',
      rawName: 'description',
      order: 1,
      required: false,
      repeatable: false,
      requiredDoc: 'no',
      repeatableDoc: 'single',
      blockTypesDoc: 'plain text',
      sourceDoc: 'summary',
      source: {
        kind: 'path',
        path: 'summary',
      },
      docLine: 388,
    },
    {
      uiLabel: 'Primary agency',
      rawName: 'primary_agency',
      order: 2,
      required: true,
      repeatable: false,
      requiredDoc: 'yes',
      repeatableDoc: 'single',
      blockTypesDoc: 'page chooser → Agency only',
      sourceDoc: '— (U6)',
      source: {
        kind: 'none',
      },
      docLine: 389,
      note: 'U6 — supply the parent Agency page by hand; the mockup has no field for it.',
    },
    {
      uiLabel: 'Data dashboard',
      rawName: 'data_dashboard',
      order: 3,
      required: false,
      repeatable: true,
      requiredDoc: 'not recorded',
      repeatableDoc: 'repeatable',
      blockTypesDoc: 'one type: Powerbi embed, no chooser',
      sourceDoc: '— unused',
      source: {
        kind: 'none',
      },
      docLine: 390,
    },
    {
      uiLabel: 'Introductory text',
      rawName: 'introductory_text',
      order: 4,
      required: false,
      repeatable: true,
      requiredDoc: 'not recorded',
      repeatableDoc: 'repeatable',
      blockTypesDoc: 'one type: Title and text, no chooser',
      sourceDoc: 'section with paragraphs[] only (5 sections)',
      // `emit: 'prose'` because a Resource Collection section can carry BOTH
      // paragraphs and cards, and the two halves go to two different panels.
      // Without the scope this panel — a Title-and-text block with no chooser
      // at all — also emitted the section's cards, telling an editor to pick
      // pages in a panel that has no page chooser.
      source: {
        kind: 'sections',
        match: {
          has: ['paragraphs'],
        },
        emit: 'prose',
      },
      docLine: 391,
    },
    {
      uiLabel: 'Body',
      rawName: 'body',
      order: 5,
      required: false,
      repeatable: true,
      requiredDoc: 'not recorded',
      repeatableDoc: 'repeatable stream',
      blockTypesDoc: 'chooser: Documents | Data stories | Resources',
      sourceDoc: 'section with cards[] (12 sections) → Resources',
      // The other half of the same split: this panel takes the links and leaves
      // the prose to `introductory_text` above.
      source: {
        kind: 'sections',
        match: {
          has: ['cards'],
        },
        emit: 'cards',
      },
      docLine: 392,
    },
    {
      uiLabel: 'Custom section',
      rawName: 'custom_section',
      order: 6,
      required: false,
      repeatable: true,
      requiredDoc: 'not recorded',
      repeatableDoc: 'repeatable',
      blockTypesDoc: 'one type: Title and text, no chooser',
      sourceDoc: '—',
      source: {
        kind: 'none',
      },
      docLine: 393,
    },
    {
      uiLabel: 'Topics',
      rawName: 'topics',
      order: 7,
      required: false,
      repeatable: true,
      requiredDoc: 'not recorded',
      repeatableDoc: 'repeatable',
      blockTypesDoc: 'page chooser → Topic only',
      sourceDoc: 'topicTag — unused here',
      source: {
        kind: 'none',
      },
      docLine: 394,
      note: 'topicTag is unmapped metadata — the stored values are Agency labels, not Topic chooser references.',
    },
    {
      uiLabel: 'Partner agencies',
      rawName: 'partner_agencies',
      order: 8,
      required: false,
      repeatable: true,
      requiredDoc: 'not recorded',
      repeatableDoc: 'repeatable',
      blockTypesDoc: 'page chooser → Agency only',
      sourceDoc: 'partnerAgencies[] — unused here',
      source: {
        kind: 'path',
        path: 'partnerAgencies',
      },
      docLine: 395,
    },
  ],
  Campaign: [
    {
      uiLabel: 'Title',
      rawName: 'title',
      order: 0,
      required: true,
      repeatable: false,
      requiredDoc: 'yes',
      repeatableDoc: 'single',
      blockTypesDoc: 'plain text',
      sourceDoc: 'title',
      source: {
        kind: 'path',
        path: 'title',
      },
      docLine: 425,
    },
    {
      uiLabel: 'Primary agency',
      rawName: 'primary_agency',
      order: 1,
      required: true,
      repeatable: false,
      requiredDoc: 'yes',
      repeatableDoc: 'single',
      blockTypesDoc: 'page chooser → Agency only',
      sourceDoc: '— (U6)',
      source: {
        kind: 'none',
      },
      docLine: 426,
      note: 'U6 — supply the parent Agency page by hand; the mockup has no field for it.',
    },
    {
      uiLabel: 'Logo',
      rawName: 'logo',
      order: 2,
      required: false,
      repeatable: false,
      requiredDoc: 'no',
      repeatableDoc: 'single',
      blockTypesDoc: 'image chooser, min 100×100, square preferred',
      sourceDoc: '— unused',
      source: {
        kind: 'none',
      },
      docLine: 427,
    },
    {
      uiLabel: 'Background header image',
      rawName: 'background_header_image',
      order: 3,
      required: false,
      repeatable: false,
      requiredDoc: 'no',
      repeatableDoc: 'single',
      blockTypesDoc: 'image chooser, min 400px tall, 16:5 recommended',
      sourceDoc: '— unused',
      source: {
        kind: 'none',
      },
      docLine: 428,
    },
    {
      uiLabel: 'Color theme',
      rawName: 'theme',
      order: 4,
      required: false,
      repeatable: false,
      requiredDoc: 'not recorded',
      repeatableDoc: 'single',
      blockTypesDoc: 'dropdown: Black | Blue | Green | Orange',
      sourceDoc: '— unused',
      source: {
        kind: 'none',
      },
      docLine: 429,
    },
    {
      uiLabel: 'Spotlight 1',
      rawName: 'spotlight_1',
      order: 5,
      required: false,
      repeatable: true,
      requiredDoc: 'not recorded',
      repeatableDoc: 'repeatable (2 inserted live)',
      blockTypesDoc: 'one type: Spotlight, no chooser',
      sourceDoc: "section with component: 'spotlight'",
      source: {
        kind: 'sections',
        match: {
          component: 'spotlight',
        },
        nth: 0,
      },
      docLine: 430,
    },
    {
      uiLabel: 'Spotlight 2',
      rawName: 'spotlight_2',
      order: 6,
      required: false,
      repeatable: true,
      requiredDoc: 'not recorded',
      repeatableDoc: 'repeatable, same as Spotlight 1',
      blockTypesDoc: 'one type: Spotlight, no chooser',
      sourceDoc: 'as above',
      source: {
        kind: 'sections',
        match: {
          component: 'spotlight',
        },
        nth: 1,
      },
      docLine: 431,
      note: 'Spotlight 1 and Spotlight 2 are two independent top-level fields, not one repeatable field with two slots, so a third spotlight concept has nowhere to go.',
    },
    {
      uiLabel: 'Top facts',
      rawName: 'facts_title + fact_items',
      order: 7,
      required: false,
      repeatable: true,
      requiredDoc: 'not recorded',
      repeatableDoc: 'Fact items repeatable',
      blockTypesDoc: '"Facts title" plain text + repeatable "Fact items"',
      sourceDoc: "section with component: 'top-facts'; facts[] → Fact items",
      source: {
        kind: 'sections',
        match: {
          component: 'top-facts',
        },
      },
      docLine: 432,
    },
    {
      uiLabel: 'Additional content',
      rawName: 'additional_content',
      order: 8,
      required: false,
      repeatable: true,
      requiredDoc: 'not recorded',
      repeatableDoc: 'repeatable stream',
      blockTypesDoc: 'chooser: Image with text | Video | Accordion section | Embed | Resources',
      sourceDoc: "section with component: 'supporting' → Accordion section",
      source: {
        kind: 'sections',
        match: {
          component: 'supporting',
        },
      },
      docLine: 433,
    },
    {
      uiLabel: 'About',
      rawName: 'about_campaign',
      order: 9,
      required: false,
      repeatable: false,
      requiredDoc: 'not recorded',
      repeatableDoc: 'single',
      blockTypesDoc: 'single rich text field, "About campaign"',
      sourceDoc: '— unused',
      source: {
        kind: 'none',
      },
      docLine: 434,
    },
    {
      uiLabel: 'Partner agencies',
      rawName: 'partner_agencies',
      order: 10,
      required: false,
      repeatable: true,
      requiredDoc: 'not recorded',
      repeatableDoc: 'repeatable',
      blockTypesDoc: 'page chooser → Agency only',
      sourceDoc: '— unused',
      source: {
        kind: 'none',
      },
      docLine: 435,
    },
    {
      uiLabel: 'Related',
      rawName: 'related_links',
      order: 11,
      required: false,
      repeatable: true,
      requiredDoc: '"Page" and "Link text" per entry',
      repeatableDoc: 'repeatable',
      blockTypesDoc: 'one block type (Page block), link shape 4',
      sourceDoc: "section with component: 'related'",
      source: [
        {
          kind: 'sections',
          match: {
            component: 'related',
          },
        },
        {
          kind: 'sections',
          match: {
            cardClass: 'title-only',
          },
        },
      ],
      docLine: 436,
    },
    {
      uiLabel: 'Contact us',
      rawName: 'contact',
      order: 12,
      required: false,
      repeatable: true,
      requiredDoc: 'not recorded',
      repeatableDoc: 'repeatable stream',
      blockTypesDoc:
        'default Contact block, 4 nested sub-streams (address/phone/email/social_media_other)',
      sourceDoc: 'contact',
      source: {
        kind: 'path',
        path: 'contact',
      },
      docLine: 437,
    },
  ],
  Topic: [
    {
      uiLabel: 'Title',
      rawName: 'title',
      order: 0,
      required: true,
      repeatable: false,
      requiredDoc: 'yes',
      repeatableDoc: 'single',
      blockTypesDoc: 'plain text',
      sourceDoc: 'title',
      source: {
        kind: 'path',
        path: 'title',
      },
      docLine: 479,
    },
    {
      uiLabel: 'Primary agency',
      rawName: 'primary_agency',
      order: 1,
      required: true,
      repeatable: false,
      requiredDoc: 'yes',
      repeatableDoc: 'single',
      blockTypesDoc: 'page chooser → Agency only',
      sourceDoc: '— (U6)',
      source: {
        kind: 'none',
      },
      docLine: 480,
      note: 'U6 — supply the parent Agency page by hand; the mockup has no field for it.',
    },
    {
      uiLabel: 'Description',
      rawName: 'description',
      order: 2,
      required: false,
      repeatable: false,
      requiredDoc: 'no',
      repeatableDoc: 'single',
      blockTypesDoc: 'plain textarea — helper says _start with keywords_, not a prose intro field',
      sourceDoc: 'summary',
      source: {
        kind: 'path',
        path: 'summary',
      },
      docLine: 481,
    },
    {
      uiLabel: 'Set top-level?',
      rawName: 'top_level_topic',
      order: 3,
      required: false,
      repeatable: false,
      requiredDoc: 'no',
      repeatableDoc: 'single',
      blockTypesDoc: 'checkbox',
      sourceDoc: '— unused',
      source: {
        kind: 'none',
      },
      docLine: 482,
    },
    {
      uiLabel: 'Child topics (outer StreamField; internally "Page content")',
      rawName: 'content_fields',
      order: 4,
      required: false,
      repeatable: true,
      requiredDoc: 'not recorded',
      repeatableDoc: 'repeatable stream',
      blockTypesDoc:
        'chooser, 6 types: Child topics | Content top | Services | Spotlight | Resources | Content',
      sourceDoc: 'sections[]',
      source: [
        {
          kind: 'sections',
          match: {
            component: 'services',
          },
        },
        {
          kind: 'sections',
          match: {
            component: 'resources',
          },
        },
        {
          kind: 'sections',
          match: {
            component: 'spotlight',
          },
        },
      ],
      docLine: 483,
    },
    {
      uiLabel: 'Partner agencies',
      rawName: 'partner_agencies',
      order: 5,
      required: false,
      repeatable: true,
      requiredDoc: 'not recorded',
      repeatableDoc: 'repeatable',
      blockTypesDoc: 'page chooser → Agency only',
      sourceDoc: 'partnerAgencies[] (present on this page)',
      source: {
        kind: 'path',
        path: 'partnerAgencies',
      },
      docLine: 484,
    },
  ],
  Agency: [
    {
      uiLabel: 'Title',
      rawName: 'title',
      order: 0,
      required: true,
      repeatable: false,
      requiredDoc: 'yes',
      repeatableDoc: 'single',
      blockTypesDoc: 'plain text',
      sourceDoc: 'title',
      source: {
        kind: 'path',
        path: 'title',
      },
      docLine: 526,
    },
    {
      uiLabel: 'Select to show page on agency list',
      rawName: 'show_agency_list',
      order: 1,
      required: false,
      repeatable: false,
      requiredDoc: 'no',
      repeatableDoc: 'single',
      blockTypesDoc: 'checkbox',
      sourceDoc: '— (Digital Services controls this)',
      source: {
        kind: 'none',
      },
      docLine: 527,
    },
    {
      uiLabel: 'Description',
      rawName: 'description',
      order: 2,
      required: false,
      repeatable: false,
      requiredDoc: 'no',
      repeatableDoc: 'single',
      blockTypesDoc: 'textarea',
      sourceDoc: 'summary',
      source: {
        kind: 'path',
        path: 'summary',
      },
      docLine: 528,
    },
    {
      uiLabel: 'Logo',
      rawName: 'logo',
      order: 3,
      required: false,
      repeatable: false,
      requiredDoc: 'no',
      repeatableDoc: 'single',
      blockTypesDoc: 'image chooser',
      sourceDoc: '—',
      source: {
        kind: 'none',
      },
      docLine: 529,
    },
    {
      uiLabel: 'Main image',
      rawName: 'main_image',
      order: 4,
      required: false,
      repeatable: false,
      requiredDoc: 'no',
      repeatableDoc: 'single',
      blockTypesDoc: 'image chooser',
      sourceDoc: '—',
      source: {
        kind: 'none',
      },
      docLine: 530,
    },
    {
      uiLabel: 'Alert',
      rawName: 'alert + alert_agency_wide',
      order: 5,
      required: false,
      repeatable: false,
      requiredDoc: 'no',
      repeatableDoc: 'single',
      blockTypesDoc: 'text + checkbox',
      sourceDoc: '—',
      source: {
        kind: 'none',
      },
      docLine: 531,
    },
    {
      uiLabel: 'Quick links',
      rawName: 'quicklinks',
      order: 6,
      required: false,
      repeatable: true,
      requiredDoc: 'no',
      repeatableDoc: 'repeatable',
      blockTypesDoc: 'link list (SF.gov page / External link)',
      sourceDoc: '—',
      source: {
        kind: 'none',
      },
      docLine: 532,
    },
    {
      uiLabel: 'Meeting information',
      rawName: 'meeting_information',
      order: 7,
      required: false,
      repeatable: false,
      requiredDoc: 'no',
      repeatableDoc: 'single',
      blockTypesDoc: 'rich text',
      sourceDoc: '—',
      source: {
        kind: 'none',
      },
      docLine: 533,
    },
    {
      uiLabel: 'Section title 1',
      rawName: 'services_title',
      order: 8,
      required: true,
      repeatable: false,
      requiredDoc: 'yes',
      repeatableDoc: 'single',
      blockTypesDoc: 'plain text',
      sourceDoc: "the services section's heading — see below",
      source: {
        kind: 'sections',
        match: {
          component: 'services',
        },
        field: 'heading',
      },
      docLine: 534,
      note: 'Required, and the Help Center is wrong that it defaults to blank — the form pre-fills "Services" and refuses an empty value.',
    },
    {
      uiLabel: 'Subsection',
      rawName: 'services',
      order: 9,
      required: false,
      repeatable: true,
      requiredDoc: 'no',
      repeatableDoc: 'repeatable',
      blockTypesDoc: 'Subsection (auto-insert) → SF.gov page / External link (shape 3)',
      sourceDoc: "component: 'services' sections",
      source: {
        kind: 'sections',
        match: {
          component: 'services',
        },
      },
      docLine: 535,
    },
    {
      uiLabel: 'Spotlight 1',
      rawName: 'spotlight_1',
      order: 10,
      required: false,
      repeatable: true,
      requiredDoc: 'no',
      repeatableDoc: 'repeatable',
      blockTypesDoc: 'Spotlight block',
      sourceDoc: '—',
      source: {
        kind: 'none',
      },
      docLine: 536,
    },
    {
      uiLabel: 'Spotlight 2',
      rawName: 'spotlight_2',
      order: 11,
      required: false,
      repeatable: true,
      requiredDoc: 'no',
      repeatableDoc: 'repeatable',
      blockTypesDoc: 'Spotlight block',
      sourceDoc: '—',
      source: {
        kind: 'none',
      },
      docLine: 537,
    },
    {
      uiLabel: 'Highlights',
      rawName: 'highlights (HighlightsPanel)',
      order: 12,
      required: false,
      repeatable: true,
      requiredDoc: 'no',
      repeatableDoc: 'repeatable',
      blockTypesDoc: 'Highlight block',
      sourceDoc: '—',
      source: {
        kind: 'none',
      },
      docLine: 538,
    },
    {
      uiLabel: 'Section title 2',
      rawName: 'resources_title',
      order: 13,
      required: true,
      repeatable: false,
      requiredDoc: 'yes',
      repeatableDoc: 'single',
      blockTypesDoc: 'plain text',
      sourceDoc: "the resources sections' heading",
      source: {
        kind: 'sections',
        match: {
          component: 'resources',
        },
        field: 'heading',
      },
      docLine: 539,
      note: 'Required, same as Section title 1. An editor may rename it but not empty it.',
    },
    {
      uiLabel: 'Subsection',
      rawName: 'resources',
      order: 14,
      required: false,
      repeatable: true,
      requiredDoc: 'no',
      repeatableDoc: 'repeatable',
      blockTypesDoc: 'Subsection (auto-insert) → SF.gov page / External link (shape 3)',
      sourceDoc: "component: 'resources' sections",
      source: {
        kind: 'sections',
        match: {
          component: 'resources',
        },
      },
      docLine: 540,
    },
    {
      uiLabel: 'About',
      rawName: 'about_description',
      order: 15,
      required: false,
      repeatable: false,
      requiredDoc: 'no',
      repeatableDoc: 'single',
      blockTypesDoc: 'rich text',
      sourceDoc: "component: 'body' section",
      source: {
        kind: 'sections',
        match: {
          component: 'body',
        },
      },
      docLine: 541,
    },
    {
      uiLabel: 'Call to action',
      rawName: 'call_to_action',
      order: 16,
      required: false,
      repeatable: false,
      requiredDoc: 'no',
      repeatableDoc: 'single',
      blockTypesDoc: 'Call to action block (Title, Description, Button link)',
      sourceDoc: '—',
      source: {
        kind: 'none',
      },
      docLine: 542,
      subPanelOf: 'about_description',
    },
    {
      uiLabel: 'Divisions or subcommittees',
      rawName: 'divisions_subcommittees',
      order: 17,
      required: false,
      repeatable: true,
      requiredDoc: 'no',
      repeatableDoc: 'repeatable',
      blockTypesDoc: 'page chooser (Agency / Division)',
      sourceDoc: '—',
      source: {
        kind: 'none',
      },
      docLine: 543,
      subPanelOf: 'about_description',
    },
    {
      uiLabel: 'Partner agencies',
      rawName: 'partner_agencies',
      order: 18,
      required: false,
      repeatable: true,
      requiredDoc: 'no',
      repeatableDoc: 'repeatable',
      blockTypesDoc: 'page chooser (Agency only)',
      sourceDoc: 'partnerAgencies[] — unused here',
      source: {
        kind: 'path',
        path: 'partnerAgencies',
      },
      docLine: 544,
      subPanelOf: 'about_description',
    },
    {
      uiLabel: 'People',
      rawName: 'people',
      order: 19,
      required: false,
      repeatable: true,
      requiredDoc: 'no',
      repeatableDoc: 'repeatable',
      blockTypesDoc: 'Person snippet chooser',
      sourceDoc: '—',
      source: {
        kind: 'none',
      },
      docLine: 545,
    },
    {
      uiLabel: 'Public records',
      rawName: 'public_records',
      order: 20,
      required: true,
      repeatable: true,
      requiredDoc: 'yes (panel marked)',
      repeatableDoc: 'repeatable stream',
      blockTypesDoc: 'Public records struct / links',
      sourceDoc: '—',
      source: {
        kind: 'none',
      },
      docLine: 546,
      note: 'Required panel with no mockup source: the asterisk marks a required StreamField that renders no input until a block is added.',
    },
    {
      uiLabel: 'Archive information',
      rawName: 'archive_url, archive_date, meeting_archive_url, meeting_archive_date',
      order: 21,
      required: false,
      repeatable: false,
      requiredDoc: 'no',
      repeatableDoc: 'single',
      blockTypesDoc: 'URLs / dates',
      sourceDoc: '—',
      source: {
        kind: 'none',
      },
      docLine: 547,
    },
    {
      uiLabel: 'Contact us',
      rawName: 'contact',
      order: 22,
      required: false,
      repeatable: true,
      requiredDoc: 'no',
      repeatableDoc: 'repeatable stream',
      blockTypesDoc: 'default Contact block (4 sub-streams)',
      sourceDoc: 'contact — unused here',
      source: {
        kind: 'path',
        path: 'contact',
      },
      docLine: 548,
    },
    {
      uiLabel: 'Redirect this page to',
      rawName: 'agency_redirect',
      order: 23,
      required: false,
      repeatable: false,
      requiredDoc: '—',
      repeatableDoc: 'single',
      blockTypesDoc: 'plain text, inert by design',
      sourceDoc: '—',
      source: {
        kind: 'none',
      },
      docLine: 549,
      note: 'Disabled by design — a ConditionalReadOnlyFieldPanel. Never type into it.',
    },
    {
      uiLabel: 'Topics',
      rawName: 'topics',
      order: 24,
      required: false,
      repeatable: true,
      requiredDoc: 'no',
      repeatableDoc: 'repeatable',
      blockTypesDoc: 'page chooser (Topic only)',
      sourceDoc: '— unmapped metadata',
      source: {
        kind: 'none',
      },
      docLine: 550,
      note: 'topicTag is unmapped metadata — the stored values are Agency labels, not Topic chooser references.',
    },
  ],
  'About us': [
    {
      uiLabel: 'Title',
      rawName: 'title',
      order: 0,
      required: true,
      repeatable: false,
      requiredDoc: 'yes',
      repeatableDoc: 'single',
      blockTypesDoc: 'plain text',
      sourceDoc: 'title',
      source: {
        kind: 'path',
        path: 'title',
      },
      docLine: 583,
    },
    {
      uiLabel: 'Primary agency',
      rawName: 'primary_agency',
      order: 1,
      required: true,
      repeatable: false,
      requiredDoc: 'yes',
      repeatableDoc: 'single',
      blockTypesDoc: 'page chooser → Agency only',
      sourceDoc: '— (U6)',
      source: {
        kind: 'none',
      },
      docLine: 584,
      note: 'U6 — supply the parent Agency page by hand; the mockup has no field for it.',
    },
    {
      uiLabel: 'Information',
      rawName: 'about_info',
      order: 2,
      required: false,
      repeatable: true,
      requiredDoc: 'no',
      repeatableDoc: 'repeatable stream',
      blockTypesDoc: 'Custom section (title text + rich text)',
      sourceDoc: 'paragraphs[] / bullets[] sections',
      source: {
        kind: 'sections',
        match: {
          lacks: ['cards'],
        },
      },
      docLine: 585,
    },
    {
      uiLabel: 'Resources',
      rawName: 'resources',
      order: 3,
      required: false,
      repeatable: true,
      requiredDoc: 'no',
      repeatableDoc: 'repeatable stream',
      blockTypesDoc:
        'Resources section (SF.gov page / External link / Downloadable files, shape 3)',
      sourceDoc: "component: 'resources' section",
      source: {
        kind: 'sections',
        match: {
          component: 'resources',
        },
      },
      docLine: 586,
    },
  ],
  Report: [
    {
      uiLabel: 'Title',
      rawName: 'title',
      order: 0,
      required: true,
      repeatable: false,
      requiredDoc: 'yes',
      repeatableDoc: 'single',
      blockTypesDoc: 'plain text',
      sourceDoc: 'title',
      source: {
        kind: 'path',
        path: 'title',
      },
      docLine: 617,
    },
    {
      uiLabel: 'Date',
      rawName: 'date',
      order: 1,
      required: false,
      repeatable: false,
      requiredDoc: 'no',
      repeatableDoc: 'single',
      blockTypesDoc: 'date picker',
      sourceDoc: 'reportDate',
      source: {
        kind: 'path',
        path: 'reportDate',
      },
      docLine: 618,
    },
    {
      uiLabel: 'Primary agency',
      rawName: 'primary_agency',
      order: 2,
      required: true,
      repeatable: false,
      requiredDoc: 'yes',
      repeatableDoc: 'single',
      blockTypesDoc: 'page chooser → Agency only',
      sourceDoc: '— (U6)',
      source: {
        kind: 'none',
      },
      docLine: 619,
      note: 'U6 — supply the parent Agency page by hand; the mockup has no field for it.',
    },
    {
      uiLabel: 'Spotlight',
      rawName: 'spotlight',
      order: 3,
      required: false,
      repeatable: false,
      requiredDoc: 'no',
      repeatableDoc: 'single',
      blockTypesDoc: 'Spotlight block (link shape 2)',
      sourceDoc: 'spotlight',
      source: {
        kind: 'path',
        path: 'spotlight',
      },
      docLine: 620,
    },
    {
      uiLabel: 'Content',
      rawName: 'content',
      order: 4,
      required: false,
      repeatable: true,
      requiredDoc: 'no',
      repeatableDoc: 'repeatable stream',
      blockTypesDoc: 'chooser: Body (rich text) | Table',
      sourceDoc: 'sections[]',
      source: {
        kind: 'sections',
        match: {},
      },
      docLine: 621,
    },
    {
      uiLabel: 'Print version',
      rawName: 'print_version',
      order: 5,
      required: false,
      repeatable: false,
      requiredDoc: 'no',
      repeatableDoc: 'single',
      blockTypesDoc: 'document chooser',
      sourceDoc: 'printVersionUrl — no page sets it',
      source: {
        kind: 'path',
        path: 'printVersionUrl',
      },
      docLine: 622,
    },
    {
      uiLabel: 'Partner agencies',
      rawName: 'partner_agencies',
      order: 6,
      required: false,
      repeatable: true,
      requiredDoc: 'no',
      repeatableDoc: 'repeatable',
      blockTypesDoc: 'page chooser → Agency only',
      sourceDoc: 'partnerAgencies[] — unused here',
      source: {
        kind: 'path',
        path: 'partnerAgencies',
      },
      docLine: 623,
    },
  ],
}

if (typeof window !== 'undefined') {
  window.karlBlocks = {
    KARL_PANELS,
    KARL_NAV,
    KARL_FLAGS,
    PROMOTE_PANEL,
    UNRESOLVED,
    breadcrumbFor,
    matchesSection,
    panelByRawName,
    panelsFor,
  }
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    KARL_PANELS,
    KARL_NAV,
    KARL_FLAGS,
    PROMOTE_PANEL,
    UNRESOLVED,
    breadcrumbFor,
    matchesSection,
    panelByRawName,
    panelsFor,
  }
}

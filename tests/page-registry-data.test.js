// Pure logic for the reviewer-managed page registry (js/page-registry-data.js):
// validating a page a reviewer authored in the browser, and applying a stored
// registry onto live page data.
//
// No DOM and no localStorage — the module is dual-exported like
// js/review-merge.js and js/standards/plain-language.js, so it is require()'d directly.
//
// The bucket that matters most here is applyRegistryToData. It runs on the boot
// path at the root of the module graph, reading a blob that NOTHING upstream has
// validated (state.globals is copied through untouched by both review-state
// validators, which is what lets the feature ship without a storage-version
// bump). So "drops a bad entry instead of throwing" is not defensive
// programming for its own sake: a throw there takes every later module with it
// and leaves the reviewer at index.html's static "Loading…" placeholder, with no
// UI left to remove the entry that broke it.
const { describe, test, expect } = require('bun:test')
const {
  ALLOWED_PAGE_TYPES,
  PROTECTED_PAGE_KEYS,
  REQUIRED_PAGE_FIELDS,
  applyRegistryToData,
  buildPageFromForm,
  countInboundLinks,
  emptyRegistry,
  isValidPageObject,
  menuLabelFor,
  parseAudienceList,
  readRegistry,
  slugify,
  validateNewPage,
} = require('../js/page-registry-data.js')
const { pageSchema } = require('../build_scripts/schema.js')
const { restoreOrderIndex } = require('../js/page-registry-data.js')

/** A minimal valid form submission, spread-and-overridden per test. */
function formInput(overrides) {
  return {
    key: 'noiseComplaints',
    title: 'Report a noise complaint',
    type: 'Transaction',
    summary: 'Tell us about ongoing noise from a neighbouring property.',
    reading: 'Grade 6',
    audience: 'A tenant kept awake by a neighbour\nA property manager fielding complaints',
    ...overrides,
  }
}

/** A live `{pages, order}` object, fresh per test so mutation cannot leak. */
function liveData() {
  return {
    pages: {
      pestsTopic: { title: 'HHVC', slug: 'sf.gov/hhvc', type: 'Topic' },
      ownerHub: { title: 'Owners', slug: 'sf.gov/owners', type: 'Resource Collection' },
      tenantRights: { title: 'Tenants', slug: 'sf.gov/tenants', type: 'Information' },
    },
    order: [
      ['pestsTopic', 'Agency page: Healthy Housing and Vector Control'],
      ['ownerHub', 'Resource collection: Property owner responsibilities'],
      ['tenantRights', 'Information: Tenant rights and reporting'],
    ],
  }
}

/** A registry `added` entry built the way addPage() builds one. */
function addedEntry(overrides) {
  const validation = validateNewPage(formInput(overrides), { existingKeys: [] })
  return { page: validation.page, label: validation.label, created_at: '2026-08-10T00:00:00.000Z' }
}

describe('REQUIRED_PAGE_FIELDS', () => {
  // The drift guard. build_scripts/schema.js is CommonJS and needs Zod, so the
  // browser restates its required-field list rather than importing it — the
  // same trade js/review-state-validation.js makes for the review-record rules.
  // This is what makes the restatement safe: add a seventh required field to
  // pageSchema without mirroring it and CI fails here, instead of the tool
  // happily creating pages that would be rejected by `bun run validate`.
  test('matches every required field of pageSchema in build_scripts/schema.js', () => {
    const schemaRequired = Object.entries(pageSchema.shape)
      .filter(([, field]) => !field.isOptional())
      .map(([name]) => name)
      .sort()
    expect([...REQUIRED_PAGE_FIELDS].sort()).toEqual(schemaRequired)
  })
})

describe('ALLOWED_PAGE_TYPES', () => {
  // Deliberately NARROWER than the schema, which only enforces min(1). These
  // are the five the page picker groups by; authored pages also use `Agency`
  // and `Report`, which land in the Information optgroup. A reviewer choosing
  // from a <select> should not be able to create that mismatch by accident.
  test('lists exactly the five types the page picker groups by', () => {
    expect(ALLOWED_PAGE_TYPES).toEqual([
      'Topic',
      'Transaction',
      'Resource Collection',
      'Campaign',
      'Information',
    ])
  })

  test('is not the same as what the schema permits, on purpose', () => {
    expect(pageSchema.shape.type.safeParse('Agency').success).toBe(true)
    expect(ALLOWED_PAGE_TYPES).not.toContain('Agency')
  })
})

describe('slugify', () => {
  test('lowercases and hyphenates a title', () => {
    expect(slugify('Report a Noise Complaint')).toBe('report-a-noise-complaint')
  })

  test('collapses runs of punctuation into a single hyphen', () => {
    expect(slugify('Rats, mice & other  problems!')).toBe('rats-mice-other-problems')
  })

  test('trims leading and trailing hyphens', () => {
    expect(slugify('  --Hello--  ')).toBe('hello')
  })

  test('returns an empty string for input with no alphanumerics', () => {
    expect(slugify('!!!')).toBe('')
    expect(slugify('')).toBe('')
    expect(slugify(null)).toBe('')
  })
})

describe('menuLabelFor', () => {
  // The prefix is load-bearing, not decoration: buildPageSelect() strips a
  // type prefix from the ORDER LABEL, not from the page title, so a label
  // without one renders the type name inside an optgroup already headed by it.
  test('prefixes the title with the page type', () => {
    expect(menuLabelFor({ type: 'Transaction', title: 'Pay your fee' })).toBe(
      'Transaction: Pay your fee'
    )
  })

  test('falls back to the bare title when there is no type', () => {
    expect(menuLabelFor({ title: 'Pay your fee' })).toBe('Pay your fee')
  })

  test('does not throw on null', () => {
    expect(menuLabelFor(null)).toBe('')
  })
})

describe('parseAudienceList', () => {
  test('splits a textarea into one entry per line', () => {
    expect(parseAudienceList('A tenant\nA property owner')).toEqual([
      'A tenant',
      'A property owner',
    ])
  })

  test('drops blank lines and trims each entry', () => {
    expect(parseAudienceList('  A tenant  \n\n\n  An owner ')).toEqual(['A tenant', 'An owner'])
  })

  test('accepts an array unchanged apart from trimming and blanks', () => {
    expect(parseAudienceList([' A tenant ', '', 'An owner'])).toEqual(['A tenant', 'An owner'])
  })

  test('returns an empty array for empty input', () => {
    expect(parseAudienceList('')).toEqual([])
    expect(parseAudienceList(undefined)).toEqual([])
  })
})

describe('validateNewPage', () => {
  test('accepts a complete submission and returns a schema-valid page', () => {
    const result = validateNewPage(formInput(), { existingKeys: ['pestsTopic'] })
    expect(result.ok).toBe(true)
    expect(result.errors).toEqual([])
    expect(result.key).toBe('noiseComplaints')
    expect(pageSchema.safeParse(result.page).success).toBe(true)
  })

  test('derives a slug from the title when none is supplied', () => {
    const result = validateNewPage(formInput(), { existingKeys: [] })
    expect(result.page.slug).toBe('sf.gov/report-a-noise-complaint')
  })

  test('keeps an explicitly supplied slug', () => {
    const result = validateNewPage(formInput({ slug: 'sf.gov/noise' }), { existingKeys: [] })
    expect(result.page.slug).toBe('sf.gov/noise')
  })

  test('rejects a key already in use', () => {
    const result = validateNewPage(formInput({ key: 'ownerHub' }), {
      existingKeys: ['pestsTopic', 'ownerHub'],
    })
    expect(result.ok).toBe(false)
    expect(result.errors).toContain('Page key "ownerHub" is already in use. Choose another.')
  })

  test('accepts a Set of existing keys as readily as an array', () => {
    const result = validateNewPage(formInput({ key: 'ownerHub' }), {
      existingKeys: new Set(['ownerHub']),
    })
    expect(result.ok).toBe(false)
  })

  test('rejects a key that is not a bare identifier', () => {
    for (const key of ['noise complaints', 'noise-complaints', '2ndPage', 'noise.key', 'a/b']) {
      const result = validateNewPage(formInput({ key }), { existingKeys: [] })
      expect(result.ok).toBe(false)
    }
  })

  // A key becomes an object property on window.HHVC_PAGES. `pages.__proto__ =
  // value` walks onto Object.prototype and writes through it, polluting every
  // plain object in the app — the same reason getByPath/setByPath reject these
  // three segments.
  test('rejects the prototype-pollution key names', () => {
    for (const key of ['__proto__', 'prototype', 'constructor']) {
      const result = validateNewPage(formInput({ key }), { existingKeys: [] })
      expect(result.ok).toBe(false)
      expect(result.errors.join(' ')).toContain('reserved')
    }
  })

  test('requires a title, a summary, and a reading target', () => {
    expect(validateNewPage(formInput({ title: '  ' }), {}).errors).toContain('Title is required.')
    expect(validateNewPage(formInput({ summary: '' }), {}).errors).toContain('Summary is required.')
    expect(validateNewPage(formInput({ reading: '' }), {}).errors).toContain(
      'Reading target is required (for example "Grade 6").'
    )
  })

  test('requires at least one audience line', () => {
    const result = validateNewPage(formInput({ audience: '   \n  ' }), {})
    expect(result.ok).toBe(false)
    expect(result.errors).toContain('Add at least one audience, one per line.')
  })

  test('rejects a page type outside the allowed set', () => {
    const result = validateNewPage(formInput({ type: 'Agency' }), {})
    expect(result.ok).toBe(false)
    expect(result.errors.join(' ')).toContain('Page type must be one of')
  })

  test('reports every problem at once rather than stopping at the first', () => {
    const result = validateNewPage({ key: '', title: '', summary: '' }, {})
    expect(result.errors.length).toBeGreaterThan(3)
  })

  test('does not throw on a null submission', () => {
    expect(validateNewPage(null, {}).ok).toBe(false)
    expect(validateNewPage(undefined, undefined).ok).toBe(false)
  })
})

describe('buildPageFromForm', () => {
  const page = buildPageFromForm({
    title: 'Report a noise complaint',
    summary: 'Tell us about noise.',
    type: 'Transaction',
    reading: 'Grade 6',
    audience: ['A tenant'],
    slug: 'sf.gov/noise',
  })

  test('produces a page that satisfies the real page schema', () => {
    expect(pageSchema.safeParse(page).success).toBe(true)
  })

  test('marks the page as a placeholder', () => {
    expect(page.editorStatus).toBe('placeholder')
  })

  // `karl` is the one field required on a section but optional on a card, a
  // callout and an image — so it is exactly the one a starter section forgets.
  test('gives the starter section a non-empty karl note', () => {
    expect(page.sections).toHaveLength(1)
    expect(typeof page.sections[0].karl).toBe('string')
    expect(page.sections[0].karl.trim().length).toBeGreaterThan(0)
  })

  test('says plainly that no Karl block has been chosen rather than guessing one', () => {
    expect(page.sections[0].karl).toContain('NO KARL BLOCK ASSIGNED YET')
  })

  test('copies the audience array rather than aliasing the caller’s', () => {
    const audience = ['A tenant']
    const built = buildPageFromForm({
      title: 'T',
      summary: 'S',
      type: 'Information',
      reading: 'Grade 6',
      audience,
      slug: 'sf.gov/t',
    })
    audience.push('Someone else')
    expect(built.audience).toEqual(['A tenant'])
  })
})

describe('isValidPageObject', () => {
  const valid = buildPageFromForm({
    title: 'T',
    summary: 'S',
    type: 'Information',
    reading: 'Grade 6',
    audience: ['A tenant'],
    slug: 'sf.gov/t',
  })

  test('accepts a page carrying all six required fields', () => {
    expect(isValidPageObject(valid)).toBe(true)
  })

  test('rejects a page missing any one required field', () => {
    for (const field of REQUIRED_PAGE_FIELDS) {
      const copy = { ...valid }
      delete copy[field]
      expect(isValidPageObject(copy)).toBe(false)
    }
  })

  test('rejects an empty or non-string audience', () => {
    expect(isValidPageObject({ ...valid, audience: [] })).toBe(false)
    expect(isValidPageObject({ ...valid, audience: 'A tenant' })).toBe(false)
    expect(isValidPageObject({ ...valid, audience: [''] })).toBe(false)
  })

  test('rejects non-objects', () => {
    expect(isValidPageObject(null)).toBe(false)
    expect(isValidPageObject('a page')).toBe(false)
    expect(isValidPageObject([valid])).toBe(false)
  })
})

describe('readRegistry', () => {
  test('returns both halves from a state blob that has one', () => {
    const registry = readRegistry({
      globals: { page_registry: { added: { a: {} }, hidden: { b: {} } } },
    })
    expect(Object.keys(registry.added)).toEqual(['a'])
    expect(Object.keys(registry.hidden)).toEqual(['b'])
  })

  test('reads an absent, null or malformed registry as empty rather than throwing', () => {
    for (const state of [null, undefined, {}, { globals: {} }, { globals: { page_registry: 7 } }]) {
      expect(readRegistry(state)).toEqual(emptyRegistry())
    }
  })

  // Keyed objects, never arrays — the whole reason the storage shape is what it
  // is. Merging two arrays concatenates and duplicates every entry on the first
  // import; merging two keyed maps is a spread that unions keys.
  test('reads an array-valued half as empty, since the halves are keyed maps', () => {
    const registry = readRegistry({ globals: { page_registry: { added: [{ key: 'a' }] } } })
    expect(registry.added).toEqual({})
  })
})

describe('applyRegistryToData', () => {
  test('appends an added page to pages and order', () => {
    const data = liveData()
    const result = applyRegistryToData(data, { added: { noiseComplaints: addedEntry() } }, {})
    expect(result.added).toEqual(['noiseComplaints'])
    expect(data.pages.noiseComplaints.title).toBe('Report a noise complaint')
    expect(data.order.at(-1)).toEqual(['noiseComplaints', 'Transaction: Report a noise complaint'])
  })

  // Never unshifts. build_scripts/validate.js requires pestsTopic to be first
  // in `order`, and while that check never runs against a browser registry, the
  // invariant is what the parent link on every page and every fallback key
  // assume.
  test('never displaces pestsTopic from the front of order', () => {
    const data = liveData()
    applyRegistryToData(data, { added: { noiseComplaints: addedEntry() } }, {})
    expect(data.order[0][0]).toBe('pestsTopic')
  })

  test('mutates the given objects in place rather than replacing them', () => {
    const data = liveData()
    const pages = data.pages
    const order = data.order
    applyRegistryToData(data, { added: { noiseComplaints: addedEntry() } }, {})
    // js/state.js exports these by reference and three other modules hold the
    // same references, so only in-place mutation propagates.
    expect(data.pages).toBe(pages)
    expect(data.order).toBe(order)
  })

  test('is idempotent — re-applying does not duplicate an order row', () => {
    const data = liveData()
    const registry = { added: { noiseComplaints: addedEntry() } }
    applyRegistryToData(data, registry, {})
    applyRegistryToData(data, registry, {})
    expect(data.order.filter(([key]) => key === 'noiseComplaints')).toHaveLength(1)
  })

  // The single most consequential aliasing rule in the feature.
  // registry.added[k].page is the pristine original computeSectionEdits()
  // diffs the live page against; if the two were the same object every inline
  // edit would diff clean and section edits would silently stop persisting.
  test('never aliases the registry’s page object into data.pages', () => {
    const data = liveData()
    const entry = addedEntry()
    applyRegistryToData(data, { added: { noiseComplaints: entry } }, {})
    expect(data.pages.noiseComplaints).not.toBe(entry.page)
    data.pages.noiseComplaints.title = 'Edited live'
    expect(entry.page.title).toBe('Report a noise complaint')
  })

  test('removes a hidden page from both order and pages', () => {
    const data = liveData()
    const result = applyRegistryToData(data, { hidden: { ownerHub: { hidden_at: 'x' } } }, {})
    expect(result.hidden).toEqual(['ownerHub'])
    expect(data.pages.ownerHub).toBeUndefined()
    expect(data.order.map(([key]) => key)).toEqual(['pestsTopic', 'tenantRights'])
  })

  test('stashes a hidden page’s original index, order tuple, and page object', () => {
    const data = liveData()
    const stash = {}
    applyRegistryToData(data, { hidden: { ownerHub: { hidden_at: 'x' } } }, stash)
    expect(stash.ownerHub.index).toBe(1)
    expect(stash.ownerHub.entry).toEqual([
      'ownerHub',
      'Resource collection: Property owner responsibilities',
    ])
    expect(stash.ownerHub.page.title).toBe('Owners')
  })

  test('refuses to hide a protected page', () => {
    const data = liveData()
    const result = applyRegistryToData(data, { hidden: { pestsTopic: { hidden_at: 'x' } } }, {})
    expect(result.hidden).toEqual([])
    expect(result.dropped).toEqual(['pestsTopic'])
    expect(data.pages.pestsTopic).toBeDefined()
  })

  test('protects exactly pestsTopic and nothing else', () => {
    expect(PROTECTED_PAGE_KEYS).toEqual(['pestsTopic'])
  })

  // An empty `order` makes buildPageSelect() render five empty optgroups and
  // getCurrentKey() return a key with no page behind it.
  test('refuses to empty order', () => {
    const data = { pages: { onlyPage: { title: 'T' } }, order: [['onlyPage', 'Only']] }
    const result = applyRegistryToData(data, { hidden: { onlyPage: { hidden_at: 'x' } } }, {})
    expect(result.hidden).toEqual([])
    expect(data.order).toHaveLength(1)
  })

  test('adds before it hides, so a page added and then hidden ends up absent', () => {
    const data = liveData()
    const result = applyRegistryToData(
      data,
      { added: { noiseComplaints: addedEntry() }, hidden: { noiseComplaints: { hidden_at: 'x' } } },
      {}
    )
    expect(result.added).toEqual(['noiseComplaints'])
    expect(result.hidden).toEqual(['noiseComplaints'])
    expect(data.pages.noiseComplaints).toBeUndefined()
    expect(data.order.map(([key]) => key)).not.toContain('noiseComplaints')
  })

  test('ignores a hidden key that names no live page', () => {
    const data = liveData()
    const result = applyRegistryToData(data, { hidden: { neverExisted: { hidden_at: 'x' } } }, {})
    expect(result.hidden).toEqual([])
    expect(result.dropped).toEqual([])
    expect(data.order).toHaveLength(3)
  })

  // The read-path contract. Anything here is reachable from a hand-edited
  // localStorage blob or another reviewer's backup, and a throw on this code
  // path takes the whole app down.
  test('drops an added entry with an unusable page instead of throwing', () => {
    const data = liveData()
    const registry = {
      added: {
        missingFields: { page: { title: 'Only a title' } },
        notAnObject: { page: 'a page' },
        nullEntry: null,
        'bad key': { page: addedEntry().page },
      },
    }
    const result = applyRegistryToData(data, registry, {})
    expect(result.added).toEqual([])
    expect(result.dropped.sort()).toEqual(['bad key', 'missingFields', 'notAnObject', 'nullEntry'])
    expect(data.order).toHaveLength(3)
  })

  // Asserted through Object.defineProperty rather than an object literal: a
  // literal's `__proto__:` key sets the prototype instead of creating an own
  // property, so it never reaches the Object.keys() loop and a test written
  // that way passes without exercising anything. The hazard being guarded is
  // real — `data.pages['__proto__'] = clone` writes through Object.prototype
  // and pollutes every plain object in the app.
  test('drops a prototype-polluting key without touching Object.prototype', () => {
    const data = liveData()
    const added = {}
    for (const key of ['__proto__', 'prototype', 'constructor']) {
      Object.defineProperty(added, key, {
        value: { page: addedEntry().page },
        enumerable: true,
        configurable: true,
        writable: true,
      })
    }
    const result = applyRegistryToData(data, { added }, {})
    expect(result.added).toEqual([])
    expect(result.dropped.sort()).toEqual(['__proto__', 'constructor', 'prototype'])
    expect({}.title).toBeUndefined()
    expect(data.order).toHaveLength(3)
  })

  test('does not throw on malformed data or a malformed registry', () => {
    for (const data of [
      null,
      undefined,
      {},
      { pages: {} },
      { order: [] },
      { pages: 1, order: 1 },
    ]) {
      expect(() => applyRegistryToData(data, { added: {} }, {})).not.toThrow()
    }
    const data = liveData()
    for (const registry of [null, undefined, 7, 'x', [], { added: 1, hidden: 'x' }]) {
      expect(() => applyRegistryToData(data, registry, {})).not.toThrow()
    }
    expect(data.order).toHaveLength(3)
  })

  test('tolerates a missing stash argument', () => {
    const data = liveData()
    expect(() => applyRegistryToData(data, { hidden: { ownerHub: {} } })).not.toThrow()
    expect(data.pages.ownerHub).toBeUndefined()
  })

  test('falls back to a derived label when the stored one is missing or blank', () => {
    const data = liveData()
    const entry = addedEntry()
    delete entry.label
    applyRegistryToData(data, { added: { noiseComplaints: entry } }, {})
    expect(data.order.at(-1)[1]).toBe('Transaction: Report a noise complaint')
  })
})

describe('countInboundLinks', () => {
  // This exists because the consequence is otherwise invisible. Once
  // pageData[card.target] stops resolving, cardDescription() in
  // js/page-render.js falls through to the card's own authored `text` — exactly
  // the copy the card-inheritance work exists to prove can never publish. No
  // error, just a plausible paragraph appearing.
  function linkedData() {
    return {
      pages: {
        pestsTopic: {
          sections: [
            { heading: 'Services', cards: [{ title: 'Owners', target: 'ownerHub' }] },
            { heading: 'Go', buttonTarget: 'ownerHub' },
          ],
        },
        tenantRights: {
          sections: [
            {
              heading: 'Related',
              cards: [
                { title: 'Owners', target: 'ownerHub' },
                { title: 'Elsewhere', url: 'https://example.gov' },
              ],
            },
            { heading: 'Steps', steps: [{ title: 'One', buttonTarget: 'ownerHub' }] },
          ],
        },
        ownerHub: { sections: [{ heading: 'Self', cards: [{ title: 'Me', target: 'ownerHub' }] }] },
      },
    }
  }

  test('counts inbound cards and buttons and names the referring pages', () => {
    const summary = countInboundLinks(linkedData(), 'ownerHub')
    expect(summary.cards).toBe(2)
    expect(summary.buttons).toBe(2)
    expect(summary.pages).toEqual(['pestsTopic', 'tenantRights'])
  })

  test('ignores self-references, since hiding a page cannot dangle its own links', () => {
    const summary = countInboundLinks(linkedData(), 'ownerHub')
    expect(summary.pages).not.toContain('ownerHub')
  })

  test('reports nothing for a page nobody links to', () => {
    expect(countInboundLinks(linkedData(), 'tenantRights')).toEqual({
      cards: 0,
      buttons: 0,
      links: 0,
      pages: [],
    })
  })

  test('does not throw on malformed input', () => {
    expect(countInboundLinks(null, 'ownerHub')).toEqual({
      cards: 0,
      buttons: 0,
      links: 0,
      pages: [],
    })
    expect(countInboundLinks({ pages: { a: null } }, 'ownerHub').cards).toBe(0)
    expect(countInboundLinks(linkedData(), '')).toEqual({
      cards: 0,
      buttons: 0,
      links: 0,
      pages: [],
    })
  })
})

describe('restoreOrderIndex', () => {
  // The regression this exists for: a remembered numeric index is measured
  // against an order that earlier hides already shortened, so two hides can
  // record the same number and restoring them permutes the reviewer's reading
  // order — which drives j/k navigation, the queue, the picker and PNG export.
  const canonical = ['A', 'B', 'C', 'D']

  test('inserts before the first canonical successor that is present', () => {
    expect(restoreOrderIndex(canonical, ['A', 'D'], 'B')).toBe(1)
    expect(restoreOrderIndex(canonical, ['A', 'B', 'D'], 'C')).toBe(2)
  })

  test('restores two hidden pages to canonical order in EITHER click order', () => {
    // B then C.
    let order = ['A', 'D']
    order.splice(restoreOrderIndex(canonical, order, 'B'), 0, 'B')
    order.splice(restoreOrderIndex(canonical, order, 'C'), 0, 'C')
    expect(order).toEqual(['A', 'B', 'C', 'D'])

    // C then B — the order that a remembered index gets wrong.
    order = ['A', 'D']
    order.splice(restoreOrderIndex(canonical, order, 'C'), 0, 'C')
    order.splice(restoreOrderIndex(canonical, order, 'B'), 0, 'B')
    expect(order).toEqual(['A', 'B', 'C', 'D'])
  })

  test('appends when no canonical successor is present', () => {
    expect(restoreOrderIndex(canonical, ['A', 'B'], 'D')).toBe(2)
  })

  test('appends a key the canonical sequence has never seen', () => {
    expect(restoreOrderIndex(canonical, ['A', 'B'], 'Z')).toBe(2)
  })

  test('puts a first-position page back at the front', () => {
    expect(restoreOrderIndex(canonical, ['B', 'C'], 'A')).toBe(0)
  })

  test('does not throw on malformed input', () => {
    expect(restoreOrderIndex(null, null, 'A')).toBe(0)
    expect(restoreOrderIndex(canonical, undefined, 'A')).toBe(0)
  })
})

describe('applyRegistryToData: canonical order tracking', () => {
  // The contract changed from "mutates the passed-in array in place" to
  // "returns the updated order; the caller keeps it and passes it back in
  // next time" — a passed-in array the function never touches is what makes
  // it safe for a second, careless call site to pass a fresh [] without
  // silently sharing state with the first call site's array.
  test('records the full site order before hiding anything', () => {
    const data = liveData()
    const result = applyRegistryToData(data, { hidden: { ownerHub: { hidden_at: 'x' } } }, {}, [])
    // ownerHub is in the canonical list even though it was just removed from
    // `order` — that is what lets restore position it again.
    expect(result.canonicalOrder).toEqual(['pestsTopic', 'ownerHub', 'tenantRights'])
  })

  test('extends the canonical list with a page added later, without rebuilding it', () => {
    const data = liveData()
    const first = applyRegistryToData(data, { hidden: { ownerHub: { hidden_at: 'x' } } }, {}, [])
    // A mid-session add: the caller passes the PREVIOUS return value back in,
    // so the earlier hidden key must survive rather than being recomputed
    // from the shortened order.
    const second = applyRegistryToData(
      data,
      { added: { noiseComplaints: addedEntry() } },
      {},
      first.canonicalOrder
    )
    expect(second.canonicalOrder).toEqual([
      'pestsTopic',
      'ownerHub',
      'tenantRights',
      'noiseComplaints',
    ])
    // The array passed IN as the 4th argument is never mutated — this is the
    // whole point of the contract change.
    expect(first.canonicalOrder).toEqual(['pestsTopic', 'ownerHub', 'tenantRights'])
  })

  test('tolerates a missing canonical array', () => {
    const data = liveData()
    expect(() => applyRegistryToData(data, { hidden: { ownerHub: {} } }, {})).not.toThrow()
  })

  test('does not mutate the array passed in as canonicalOrder', () => {
    const data = liveData()
    const input = []
    applyRegistryToData(data, { hidden: { ownerHub: { hidden_at: 'x' } } }, {}, input)
    expect(input).toEqual([])
  })
})

describe('validateNewPage: slug derivation', () => {
  // The old check tested the ASSEMBLED slug, which is never empty because of the
  // `sf.gov/` prefix — so the branch was dead and a title with no alphanumerics
  // shipped `sf.gov/` as the page address.
  test('rejects a title that slugifies to nothing, rather than yielding "sf.gov/"', () => {
    const result = validateNewPage(formInput({ title: '!!!' }), { existingKeys: [] })
    expect(result.ok).toBe(false)
    expect(result.errors.join(' ')).toContain('Slug is required')
  })

  test('accepts an explicit slug even when the title slugifies to nothing', () => {
    const result = validateNewPage(formInput({ title: '!!!', slug: 'sf.gov/noise' }), {
      existingKeys: [],
    })
    // The title itself is still required to be non-empty, which '!!!' satisfies.
    expect(result.ok).toBe(true)
    expect(result.page.slug).toBe('sf.gov/noise')
  })
})

describe('validateNewPage: inherited Object.prototype names', () => {
  // Found in review. These satisfy PAGE_KEY_PATTERN and Object.keys() never
  // reports them, so a collision check built on either says the key is free —
  // and then `data.pages.toString` resolves to the inherited FUNCTION, which is
  // truthy, so applyRegistryToData's "already present, skip" branch fires, the
  // page is never inserted, and addPage() reports success and asks renderPage()
  // to display a function.
  test('rejects toString, valueOf and hasOwnProperty as page keys', () => {
    for (const key of ['toString', 'valueOf', 'hasOwnProperty', 'isPrototypeOf']) {
      const result = validateNewPage(formInput({ key }), { existingKeys: [] })
      expect(result.ok).toBe(false)
      expect(result.errors.join(' ')).toContain('reserved')
    }
  })

  test('still accepts an ordinary identifier', () => {
    expect(validateNewPage(formInput(), { existingKeys: [] }).ok).toBe(true)
  })

  test('applyRegistryToData drops an inherited-name entry instead of skipping it', () => {
    const data = liveData()
    const added = {}
    Object.defineProperty(added, 'toString', {
      value: { page: addedEntry().page },
      enumerable: true,
      configurable: true,
      writable: true,
    })
    const result = applyRegistryToData(data, { added }, {}, [])
    // Dropped as invalid, NOT silently treated as already present.
    expect(result.dropped).toEqual(['toString'])
    expect(result.added).toEqual([])
    expect(data.order).toHaveLength(3)
  })

  test('an own-property presence check still makes a real re-apply idempotent', () => {
    const data = liveData()
    const registry = { added: { noiseComplaints: addedEntry() } }
    const canonical = []
    applyRegistryToData(data, registry, {}, canonical)
    const second = applyRegistryToData(data, registry, {}, canonical)
    expect(second.added).toEqual([])
    expect(data.order.filter(([key]) => key === 'noiseComplaints')).toHaveLength(1)
  })
})

describe('isValidPageObject: malformed OPTIONAL fields', () => {
  // Found in review. Checking only the six required fields let `sections: {}`
  // through, and partitionSections() does `(page.sections || []).entries()` — a
  // plain object is truthy so the `|| []` never fires and `.entries` is
  // undefined. That is a TypeError at render time, reachable at startup from a
  // saved last_page_key or a ?page= deep link, which is exactly the
  // fatal-throw-on-the-boot-path this module exists to avoid.
  const base = {
    slug: 'sf.gov/x',
    type: 'Information',
    title: 'T',
    summary: 'S',
    audience: ['A tenant'],
    reading: 'Grade 6',
  }

  test('rejects a non-array sections field', () => {
    expect(isValidPageObject({ ...base, sections: {} })).toBe(false)
    expect(isValidPageObject({ ...base, sections: 'body' })).toBe(false)
  })

  test('rejects a section that is not an object', () => {
    expect(isValidPageObject({ ...base, sections: ['a heading'] })).toBe(false)
  })

  // Not stricter than build_scripts/schema.js: heading and karl are REQUIRED on
  // a section there, so requiring them cannot reject a page CI would accept.
  test('rejects a section missing the schema-required heading or karl', () => {
    expect(isValidPageObject({ ...base, sections: [{ karl: 'K' }] })).toBe(false)
    expect(isValidPageObject({ ...base, sections: [{ heading: 'H' }] })).toBe(false)
    expect(isValidPageObject({ ...base, sections: [{ heading: ' ', karl: 'K' }] })).toBe(false)
  })

  test('accepts a well-formed section, an empty array, and an absent field', () => {
    expect(isValidPageObject({ ...base, sections: [{ heading: 'H', karl: 'K' }] })).toBe(true)
    expect(isValidPageObject({ ...base, sections: [] })).toBe(true)
    expect(isValidPageObject(base)).toBe(true)
  })

  test('a page built by the form still validates', () => {
    const built = buildPageFromForm({
      title: 'T',
      summary: 'S',
      type: 'Information',
      reading: 'Grade 6',
      audience: ['A tenant'],
      slug: 'sf.gov/t',
    })
    expect(isValidPageObject(built)).toBe(true)
  })

  test('applyRegistryToData drops an entry whose sections are malformed', () => {
    const data = liveData()
    const registry = { added: { noiseComplaints: { page: { ...base, sections: {} } } } }
    const result = applyRegistryToData(data, registry, {}, [])
    expect(result.dropped).toEqual(['noiseComplaints'])
    expect(data.order).toHaveLength(3)
  })
})

describe('applyRegistryToData: reporting key collisions', () => {
  // Found in review. The same "a page already occupies this key" condition covers
  // a harmless idempotent re-apply AND an added key that has since become a real
  // authored page. Only the caller can tell them apart, so the result reports the
  // keys rather than passing over them silently — js/page-registry.js filters
  // them against the authored-key set it captured at boot.
  test('reports a key already occupied by a page in `collided`, not `added`', () => {
    const data = liveData()
    const entry = addedEntry({ key: 'ownerHub' })
    const result = applyRegistryToData(data, { added: { ownerHub: entry } }, {}, [])
    expect(result.collided).toEqual(['ownerHub'])
    expect(result.added).toEqual([])
    // The existing page is untouched — the authored one wins.
    expect(data.pages.ownerHub.title).toBe('Owners')
    expect(data.order).toHaveLength(3)
  })

  test('an idempotent re-apply lands in `collided` too, since only the caller can judge', () => {
    const data = liveData()
    const registry = { added: { noiseComplaints: addedEntry() } }
    const canonical = []
    expect(applyRegistryToData(data, registry, {}, canonical).added).toEqual(['noiseComplaints'])
    const second = applyRegistryToData(data, registry, {}, canonical)
    expect(second.added).toEqual([])
    expect(second.collided).toEqual(['noiseComplaints'])
  })

  test('always returns the collided array, even on malformed input', () => {
    expect(applyRegistryToData(null, {}, {}, []).collided).toEqual([])
  })
})

describe('nested optional section fields', () => {
  // Found in review, one level deeper than the previous fix reached. The section
  // guard stopped at its two required fields, so `paragraphs: {}` still got
  // through — and paragraphList() maps over it, throwing exactly like
  // partitionSections() did on a non-array `sections`.
  const base = {
    slug: 'sf.gov/x',
    type: 'Information',
    title: 'T',
    summary: 'S',
    audience: ['A tenant'],
    reading: 'Grade 6',
  }
  const withSection = (extra) => ({ ...base, sections: [{ heading: 'H', karl: 'K', ...extra }] })

  test('rejects a non-array paragraphs, bullets, cards, table or steps', () => {
    for (const field of ['paragraphs', 'bullets', 'cards', 'table', 'steps']) {
      expect(isValidPageObject(withSection({ [field]: {} }))).toBe(false)
      expect(isValidPageObject(withSection({ [field]: 'text' }))).toBe(false)
    }
  })

  test('accepts arrays and absent fields', () => {
    expect(isValidPageObject(withSection({ paragraphs: ['p'], bullets: [] }))).toBe(true)
    expect(isValidPageObject(withSection({}))).toBe(true)
  })

  test('applyRegistryToData drops an entry with a malformed nested field', () => {
    const data = liveData()
    const registry = { added: { noiseComplaints: { page: withSection({ paragraphs: {} }) } } }
    expect(applyRegistryToData(data, registry, {}, []).dropped).toEqual(['noiseComplaints'])
    expect(data.order).toHaveLength(3)
  })
})

describe('countInboundLinks: inline markdown links', () => {
  // Found in review. formatMarkdown() turns `[label](pageKey)` into a real
  // data-render-target navigation control, so a page can be linked to entirely
  // through prose — and counting only cards and buttons reported "nothing links
  // here" for exactly those pages, which is the delete confirmation failing at
  // the one job it has.
  const linked = (section) => ({
    pages: { pestsTopic: { sections: [{ heading: 'H', karl: 'K', ...section }] } },
  })

  test('counts a link in a paragraph', () => {
    const summary = countInboundLinks(
      linked({ paragraphs: ['See [the guide](ownerHub).'] }),
      'ownerHub'
    )
    expect(summary.links).toBe(1)
    expect(summary.pages).toEqual(['pestsTopic'])
  })

  test('counts links in bullets, table cells, callouts and step text', () => {
    expect(countInboundLinks(linked({ bullets: ['[a](ownerHub)'] }), 'ownerHub').links).toBe(1)
    expect(countInboundLinks(linked({ table: [['[a](ownerHub)']] }), 'ownerHub').links).toBe(1)
    expect(
      countInboundLinks(linked({ callout: { text: '[a](ownerHub)' } }), 'ownerHub').links
    ).toBe(1)
    expect(
      countInboundLinks(linked({ steps: [{ title: 'S', text: ['[a](ownerHub)'] }] }), 'ownerHub')
        .links
    ).toBe(1)
  })

  test('reads the object form of a text item, not just a bare string', () => {
    const summary = countInboundLinks(
      linked({ paragraphs: [{ text: '[a](ownerHub)', unverified: true }] }),
      'ownerHub'
    )
    expect(summary.links).toBe(1)
  })

  test('does not match a link to a DIFFERENT page whose key shares a prefix', () => {
    expect(countInboundLinks(linked({ paragraphs: ['[a](ownerHubTwo)'] }), 'ownerHub').links).toBe(
      0
    )
  })

  test('counts cards, buttons and inline links independently', () => {
    const data = {
      pages: {
        pestsTopic: {
          sections: [
            { heading: 'H', karl: 'K', cards: [{ title: 'C', target: 'ownerHub' }] },
            { heading: 'H2', karl: 'K', buttonTarget: 'ownerHub' },
            { heading: 'H3', karl: 'K', paragraphs: ['[a](ownerHub)'] },
          ],
        },
      },
    }
    const summary = countInboundLinks(data, 'ownerHub')
    expect(summary).toEqual({ cards: 1, buttons: 1, links: 1, pages: ['pestsTopic'] })
  })
})

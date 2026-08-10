/* Pure logic for the reviewer-managed page registry: validating a page a
   reviewer authored in the browser, and applying the stored registry onto the
   live window.HHVC_DATA.

   No DOM, no localStorage, no imports — dual-exported onto window and
   module.exports exactly like js/review-merge.js and js/plain-language.js, so
   tests/page-registry-data.test.js can require() it with no browser at all.

   LOAD ORDER: this file is evaluated in js/main.js's CORE block, pulled in
   through js/page-registry.js, which js/state.js imports. That is MUCH earlier
   than js/inline-content-edit-data.js runs, and it is why this file must not
   copy that file's trick of resolving `window.utils.setByPath` at module scope:
   js/utils.js is not guaranteed to have been evaluated yet. Everything here is
   self-contained for that reason — including the five-line slugify, which
   duplicates nothing that exists elsewhere but would otherwise be the one thing
   tempting an import.

   WHY VALIDATION LIVES HERE AT ALL. The registry is stored under
   state.globals.page_registry, and `globals` is the one slot the review-state
   validators copy through untouched (a shallow spread in
   js/review-state-validation.js; `.passthrough()` in
   build_scripts/review-state-schema.js). That is what lets the feature ship
   without a storage-version bump — a bump would discard every reviewer's local
   state — but it also means nothing upstream has checked the blob. It reaches
   applyRegistryToData() from hand-edited localStorage and from another
   reviewer's JSON backup as readily as from our own form, so this module
   re-validates every entry on the way in and DROPS what fails rather than
   throwing. A throw here would be fatal: js/page-registry.js evaluates inside
   js/state.js's subtree at the root of the module graph, so it would take every
   later module with it and leave the reviewer looking at index.html's static
   "Loading…" placeholder with no UI left to remove the bad entry. */

/* The one page key that may never be hidden. build_scripts/validate.js
   requires `pestsTopic` to exist AND to be first in `order`, and
   js/page-render.js renders a hardcoded data-render-target="pestsTopic" parent
   link on every other page. It is also the fallback in resolvePageKey(),
   getCurrentKey(), js/state.js and js/app.js — so hiding it does not degrade
   the tool gracefully, it removes the floor everything else falls back to. */
const PROTECTED_PAGE_KEYS = ['pestsTopic']

/* The five types the page picker groups by, from js/ui-controls.js's `groups`
   map. build_scripts/schema.js only enforces `type: z.string().min(1)`, so
   authored pages legitimately carry `Agency` and `Report` too and simply land
   in the Information optgroup. A reviewer picking from a <select> should not be
   able to create that mismatch by accident, so the form is constrained to the
   five that group correctly — deliberately narrower than the schema, not a
   restatement of it. */
const ALLOWED_PAGE_TYPES = [
  'Topic',
  'Transaction',
  'Resource Collection',
  'Campaign',
  'Information',
]

/* Mirrors the six required fields of `pageSchema` in build_scripts/schema.js.
   Restated rather than imported because that file is CommonJS and needs Zod,
   neither of which belongs in the browser bundle — the same reasoning
   js/review-state-validation.js applies to its own mirror of the review-record
   rules. tests/page-registry-data.test.js pins the two copies together the way
   tests/decision-vocabulary.test.js pins the decision vocabulary. */
const REQUIRED_PAGE_FIELDS = ['slug', 'type', 'title', 'summary', 'audience', 'reading']

/* A page key becomes an object property on window.HHVC_PAGES, a value in an
   `<option>`, and a `?page=` URL parameter. Restricting it to a bare
   identifier keeps all three safe at once and is far easier to reason about
   than escaping each site separately (though js/ui-controls.js escapes its
   interpolation too — belt and braces, because this rule is only enforced for
   keys that arrive through this module). */
const PAGE_KEY_PATTERN = /^[A-Za-z][A-Za-z0-9]*$/

/* The three segments js/utils.js's getByPath/setByPath reject, plus every other
   name inherited from Object.prototype.

   `__proto__` would not merely be odd: `pages[key] = value` walks onto
   Object.prototype and writes through it, polluting every plain object in the
   app. PAGE_KEY_PATTERN excludes that one alone, and only because of the
   underscores — `constructor` and `prototype` are lowercase letter-only words
   that DO match it, so this set is what actually stops them.

   The INHERITED names are a second, quieter hole and the reason this is not a
   fixed list of three. `toString`, `valueOf` and `hasOwnProperty` all satisfy
   PAGE_KEY_PATTERN, and `Object.keys()` never reports them, so a collision
   check built on either one says the key is free. `data.pages.toString` then
   resolves to the inherited FUNCTION, which is truthy — so applyRegistryToData's
   "already present, skip" branch fires, the page is never inserted, and
   addPage() reports success and asks renderPage() to display a function.
   Measured, not theorised: `toString` validated clean and applied as
   `{added: [], dropped: []}` with an unchanged order.

   Derived from Object.prototype rather than written out, so it cannot fall
   behind the runtime. The own-property checks in applyRegistryToData are the
   other half of the fix — this list stops the key being accepted, `hasOwn`
   stops an inherited name being mistaken for an existing page. */
const UNSAFE_PAGE_KEYS = new Set([
  '__proto__',
  'prototype',
  'constructor',
  ...Object.getOwnPropertyNames(Object.prototype),
])

/**
 * Own-property presence, never `key in obj` or a bare truthiness test.
 * `pages.toString` is truthy on every plain object; `hasOwn(pages, 'toString')`
 * is not.
 * @param {object} target
 * @param {string} key
 * @returns {boolean}
 */
function hasOwn(target, key) {
  return Boolean(target) && Object.prototype.hasOwnProperty.call(target, key)
}

/* Section fields the schema types as arrays. Anything here that arrives as an
   object or a string reaches a `.map()`/`.entries()` in js/page-render.js and
   throws at render time — the boot-path throw this module exists to prevent. */
const SECTION_ARRAY_FIELDS = ['paragraphs', 'bullets', 'cards', 'table', 'steps']

/** Maximum characters accepted in any single free-text field on the form. */
const MAX_FIELD_LENGTH = 2000

/**
 * A deep clone, via JSON round-trip, matching js/state.js's ORIGINAL_DATA
 * clone rather than reaching for structuredClone — page objects are plain JSON
 * by construction (build_scripts/schema.js admits nothing else), and using the
 * same mechanism as the pristine snapshot means the two cannot disagree about
 * what survives a clone.
 * @param {*} value
 * @returns {*} a structurally independent copy, or null if it cannot be cloned
 */
function deepClone(value) {
  try {
    return JSON.parse(JSON.stringify(value))
  } catch {
    return null
  }
}

/**
 * Normalize whatever is stored at state.globals.page_registry into the shape
 * the rest of this module expects. Total by design: a missing, null, malformed
 * or array-valued registry reads as empty rather than throwing, because this
 * runs on the boot path where a throw is fatal.
 * @param {object|null|undefined} state a review-state blob
 * @returns {{added: object, hidden: object}}
 */
function readRegistry(state) {
  const raw = state && typeof state === 'object' ? state.globals?.page_registry : null
  const source = isPlainObject(raw) ? raw : {}
  return {
    added: isPlainObject(source.added) ? source.added : {},
    hidden: isPlainObject(source.hidden) ? source.hidden : {},
  }
}

/**
 * An empty registry, for seeding a state blob that has never held one.
 * @returns {{added: object, hidden: object}}
 */
function emptyRegistry() {
  return { added: {}, hidden: {} }
}

/**
 * True for a non-null, non-array object. Arrays are excluded deliberately: the
 * registry's two halves are keyed maps precisely so that merging two of them
 * is a spread that unions keys, where merging arrays would concatenate and
 * duplicate every entry on the first import.
 * @param {*} value
 * @returns {boolean}
 */
function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

/**
 * Turn a title into a URL path segment. Deliberately conservative — lowercase
 * ASCII words joined by hyphens — because the result is shown to a reviewer as
 * the page's sf.gov address and is compared against real SF.gov slugs.
 * @param {string} value
 * @returns {string}
 */
function slugify(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

/**
 * Build the `order` label for a page.
 *
 * The prefix is not decoration. buildPageSelect() strips a
 * `Topic|Transaction|Resource Collection|Campaign|Information:` prefix from the
 * ORDER LABEL (js/ui-controls.js), not from the page title — so a label without
 * one renders the type name inside the option text, inside an optgroup already
 * headed by that same type. All 22 authored entries carry it; so must these.
 * @param {{type?: string, title?: string}} page
 * @returns {string}
 */
function menuLabelFor(page) {
  const type = String(page?.type ?? '').trim()
  const title = String(page?.title ?? '').trim()
  return type ? `${type}: ${title}` : title
}

/**
 * Split a textarea's contents into an audience list — one entry per line,
 * blanks dropped. `audience` is a non-empty array in the schema, so the
 * emptiness of the result is what validateNewPage() reports on.
 * @param {string|string[]} value
 * @returns {string[]}
 */
function parseAudienceList(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry ?? '').trim()).filter(Boolean)
  }
  return String(value ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

/**
 * Validate a page key on its own terms — shape and safety, not uniqueness.
 * Split out from the uniqueness check because applyRegistryToData() needs
 * exactly this half: a stored key must still be shape-checked, but it is
 * expected to already be present in the registry it came from.
 * @param {string} key
 * @returns {string[]} human-readable problems, empty when the key is fine
 */
function findPageKeyShapeErrors(key) {
  const errors = []
  const value = String(key ?? '')
  if (!value) {
    errors.push('Page key is required.')
    return errors
  }
  if (UNSAFE_PAGE_KEYS.has(value)) {
    errors.push(`Page key "${value}" is reserved and cannot be used.`)
  }
  if (!PAGE_KEY_PATTERN.test(value)) {
    errors.push(
      'Page key must start with a letter and contain only letters and numbers ' +
        '(for example "noiseComplaints").'
    )
  }
  return errors
}

/**
 * Validate the form a reviewer filled in, before any page object exists.
 *
 * `existingKeys` must include every key the new page could collide with: the
 * live page set, the registry's own added and hidden halves, AND the keys of
 * window.HHVC_DELETED_PAGE_ALIASES. That last one is easy to omit and matters:
 * an added page shadowing a retired key is harmless to resolvePageKey (which
 * checks pageData first), but it silently makes a legacy shared link land
 * somewhere its author never wrote, which is worse than the redirect it
 * replaced.
 * @param {object} input raw form values
 * @param {{existingKeys?: string[]|Set<string>}} [options]
 * @returns {{ok: boolean, errors: string[], page: object|null, key: string, label: string}}
 */
function validateNewPage(input, options) {
  const errors = []
  const source = isPlainObject(input) ? input : {}
  const key = String(source.key ?? '').trim()
  const existing = options?.existingKeys
  const taken = existing instanceof Set ? existing : new Set(existing || [])

  errors.push(...findPageKeyShapeErrors(key))
  if (key && taken.has(key)) {
    errors.push(`Page key "${key}" is already in use. Choose another.`)
  }

  const title = String(source.title ?? '').trim()
  if (!title) errors.push('Title is required.')

  const summary = String(source.summary ?? '').trim()
  if (!summary) errors.push('Summary is required.')

  const type = String(source.type ?? '').trim()
  if (!type) errors.push('Page type is required.')
  else if (!ALLOWED_PAGE_TYPES.includes(type)) {
    errors.push(`Page type must be one of: ${ALLOWED_PAGE_TYPES.join(', ')}.`)
  }

  const reading = String(source.reading ?? '').trim()
  if (!reading) errors.push('Reading target is required (for example "Grade 6").')

  const audience = parseAudienceList(source.audience)
  if (!audience.length) errors.push('Add at least one audience, one per line.')

  /* The slugified TITLE is what gets validated, not the assembled slug. Testing
     the assembled string is vacuous — `sf.gov/${...}` is never empty, so the
     branch never fired — and it let a title with no letters or digits ("!!!")
     through as the address `sf.gov/`, which a reviewer would read as a broken
     page rather than as a prompt to supply a slug. */
  const derivedSlug = slugify(title)
  const slug = String(source.slug ?? '').trim() || (derivedSlug ? `sf.gov/${derivedSlug}` : '')
  if (!slug) {
    errors.push('Slug is required — add one, or use a title containing letters or numbers.')
  }

  for (const [label, value] of [
    ['Title', title],
    ['Summary', summary],
    ['Slug', slug],
  ]) {
    if (value.length > MAX_FIELD_LENGTH) {
      errors.push(`${label} is too long (limit ${MAX_FIELD_LENGTH} characters).`)
    }
  }

  if (errors.length) return { ok: false, errors, page: null, key, label: '' }

  const page = buildPageFromForm({ title, summary, type, reading, audience, slug })
  return { ok: true, errors: [], page, key, label: menuLabelFor(page) }
}

/**
 * Build a schema-valid page object from already-validated form values.
 *
 * The starter section is what makes the page immediately useful: the inline
 * content editor anchors its "+ Add" control on a section's heading, so a page
 * with no sections at all would give a reviewer nothing to click. Note `karl`
 * is REQUIRED on every section by build_scripts/schema.js — the one required
 * field on a section that is not required on a card, a callout or an image —
 * and its value here says plainly that no Karl block has been chosen, because
 * a placeholder that guessed at a real StreamField mapping would be worse than
 * one that admits it does not know.
 * @param {{title: string, summary: string, type: string, reading: string,
 *   audience: string[], slug: string}} values
 * @returns {object} a page object satisfying build_scripts/schema.js
 */
function buildPageFromForm(values) {
  return {
    slug: values.slug,
    type: values.type,
    title: values.title,
    summary: values.summary,
    audience: [...values.audience],
    reading: values.reading,
    editorStatus: 'placeholder',
    editorNote:
      'Added during manager review in the browser. This page has no source file in ' +
      'pages/ and exists only in this reviewer’s saved review state.',
    sections: [
      {
        heading: 'What this page needs to cover',
        karl:
          'NO KARL BLOCK ASSIGNED YET — this section was created during review, not ' +
          'mapped from the real schema. Decide the StreamField block before this page ' +
          'becomes real content.',
        kind: 'body',
        /* `open` matters on a Transaction page, which renders its supporting
           body sections as accordions — collapsed unless this is set. A page
           whose only content is hidden behind a closed disclosure the moment it
           is created reads as an empty page, and the reviewer's next move is to
           click the one paragraph they are meant to replace. Harmless on every
           other page type, which does not render an accordion at all. */
        open: true,
        paragraphs: ['Replace this paragraph with the content this page should carry.'],
      },
    ],
  }
}

/**
 * Check a page object pulled out of storage against the six required fields.
 * Shape only — this is the read-path guard, and it must not be stricter than
 * build_scripts/schema.js or a page that validates in CI would be dropped here.
 * @param {*} page
 * @returns {boolean}
 */
function isValidPageObject(page) {
  if (!isPlainObject(page)) return false
  for (const field of REQUIRED_PAGE_FIELDS) {
    const value = page[field]
    if (field === 'audience') {
      if (!Array.isArray(value) || !value.length) return false
      if (!value.every((entry) => typeof entry === 'string' && entry.trim())) return false
      continue
    }
    if (typeof value !== 'string' || !value.trim()) return false
  }

  /* The OPTIONAL structure matters too, and checking only the required six was
     not enough. `sections: {}` satisfies every rule above, and then
     partitionSections() does `(page.sections || []).entries()` — a plain object
     is truthy, so the `|| []` never fires and `.entries` is undefined. That is a
     TypeError at render time, reachable at startup from a saved last_page_key or
     a ?page= deep link, i.e. exactly the fatal-throw-on-the-boot-path this
     module's DROP-don't-throw posture exists to avoid.

     Deliberately no stricter than build_scripts/schema.js: sections is optional,
     but a section that exists requires a non-empty `heading` AND `karl` there, so
     requiring them here cannot reject a page that CI would accept. */
  if (page.sections !== undefined) {
    if (!Array.isArray(page.sections)) return false
    for (const section of page.sections) {
      if (!isPlainObject(section)) return false
      if (typeof section.heading !== 'string' || !section.heading.trim()) return false
      if (typeof section.karl !== 'string' || !section.karl.trim()) return false
      /* One level deeper, for the same reason and the same failure. The section
         guard above stopped at its two required fields, so `paragraphs: {}` still
         got through — and paragraphList() maps over it, which throws exactly like
         partitionSections() did. Every one of these is an array in
         build_scripts/schema.js, so requiring that here rejects nothing CI
         accepts. */
      for (const field of SECTION_ARRAY_FIELDS) {
        if (section[field] !== undefined && !Array.isArray(section[field])) return false
      }
    }
  }
  return true
}

/**
 * Validate one stored `added` entry. Separate from validateNewPage() because
 * the two answer different questions: that one asks "may this be created?"
 * (including uniqueness), this one asks "is what we stored still usable?".
 * @param {string} key
 * @param {*} entry
 * @returns {boolean}
 */
function isValidAddedEntry(key, entry) {
  if (findPageKeyShapeErrors(key).length) return false
  if (!isPlainObject(entry)) return false
  return isValidPageObject(entry.page)
}

/**
 * Apply a registry onto a live `{pages, order}` object, IN PLACE.
 *
 * In place is not a style choice. js/state.js exports `pageData`/`pageOrder` as
 * references to these very objects, and js/ui-controls.js,
 * js/page-render.js and js/manager-review-export.js hold the same references —
 * so `data.order = [...]` would update window.HHVC_DATA and leave three
 * modules reading a detached array. Only push/splice/delete propagate.
 *
 * Added pages are APPENDED. Never unshifted: build_scripts/validate.js
 * requires `pestsTopic` to be first in `order`, and while that check never runs
 * against a browser registry, the invariant is what the rest of the tool
 * assumes (the parent link on every page, every fallback key).
 *
 * Hidden pages leave `order` AND `pages`. Leaving them in `pages` would be the
 * subtler bug: with no `<option>` in the picker, getCurrentKey() falls back to
 * 'pestsTopic', so every later review write for that page would be filed under
 * the wrong key. Removing them from `pages` also makes the review queue's
 * selection paths self-heal, since every one of them already gates on
 * `DATA.pages[key]`.
 *
 * @param {{pages: object, order: Array<[string, string]>}} data usually window.HHVC_DATA
 * @param {{added?: object, hidden?: object}} registry
 * @param {object} [stash] filled with `{index, entry, page}` per hidden key so
 *   restore can put the original tuple back
 * @param {string[]} [canonicalOrder] extended in place with every key present
 *   after the add pass, in order. This is the reference sequence
 *   `restoreOrderIndex()` restores against; see its own comment for why a
 *   remembered numeric index is not enough.
 * @returns {{added: string[], hidden: string[], dropped: string[]}} what actually happened
 */
function applyRegistryToData(data, registry, stash, canonicalOrder) {
  const result = { added: [], hidden: [], dropped: [], collided: [] }
  if (!isPlainObject(data) || !isPlainObject(data.pages) || !Array.isArray(data.order)) {
    return result
  }
  const normalized = isPlainObject(registry)
    ? {
        added: isPlainObject(registry.added) ? registry.added : {},
        hidden: isPlainObject(registry.hidden) ? registry.hidden : {},
      }
    : emptyRegistry()
  const hiddenStash = isPlainObject(stash) ? stash : {}

  // Add first, then hide: a reviewer can add a page and later hide it, and
  // that sequence has to end with the page absent rather than present.
  for (const key of Object.keys(normalized.added)) {
    const entry = normalized.added[key]
    if (!isValidAddedEntry(key, entry)) {
      result.dropped.push(key)
      continue
    }
    /* A page already occupies this key, so nothing is inserted. Reported in
       `collided` rather than passed over in silence, because the same condition
       covers two very different situations and only the CALLER can tell them
       apart: a harmless idempotent re-apply of a page this registry added
       earlier, or an added key that has since become a real authored page in
       pages/*.js. The second is not harmless — the Help panel would present the
       authored page as reviewer-added, and Remove would delete it from the live
       mockup. js/page-registry.js holds the authored-key set captured at boot
       and decides; see its handling of result.collided.

       hasOwn, not truthiness — an inherited name like `toString` is truthy here
       and would silently skip the insert while addPage() reported success. */
    if (hasOwn(data.pages, key)) {
      result.collided.push(key)
      continue
    }
    const clone = deepClone(entry.page)
    if (!clone) {
      result.dropped.push(key)
      continue
    }
    // A clone, never the stored object. registry.added[key].page is the
    // pristine original that computeSectionEdits() diffs the live page
    // against; if the two aliased, every inline edit would diff clean and
    // section edits would silently stop persisting.
    data.pages[key] = clone
    const label =
      typeof entry.label === 'string' && entry.label.trim() ? entry.label : menuLabelFor(clone)
    data.order.push([key, label])
    result.added.push(key)
  }

  /* Learn the canonical sequence BETWEEN the two passes: after adds (so a
     reviewer-created page takes its place in it) and before hides (so it still
     describes the full site rather than whatever is left). The caller keeps the
     same array across calls, so a mid-session hide extends it rather than
     rebuilding it from an already-shortened order. */
  if (Array.isArray(canonicalOrder)) {
    for (const [key] of data.order) {
      if (!canonicalOrder.includes(key)) canonicalOrder.push(key)
    }
  }

  for (const key of Object.keys(normalized.hidden)) {
    if (findPageKeyShapeErrors(key).length) {
      result.dropped.push(key)
      continue
    }
    if (PROTECTED_PAGE_KEYS.includes(key)) {
      result.dropped.push(key)
      continue
    }
    const index = data.order.findIndex(([orderKey]) => orderKey === key)
    if (index === -1) continue
    // Never empty `order`. buildPageSelect() would render five empty
    // optgroups and getCurrentKey() would return a key with no page behind it.
    if (data.order.length <= 1) {
      result.dropped.push(key)
      continue
    }
    const [entry] = data.order.splice(index, 1)
    hiddenStash[key] = { index, entry, page: data.pages[key] }
    delete data.pages[key]
    result.hidden.push(key)
  }

  return result
}

/**
 * Where a restored page belongs in the CURRENT order.
 *
 * A remembered numeric index is not enough, and the failure is easy to miss
 * because a single delete-then-restore looks right. The index is recorded
 * against an order that earlier hides have already shortened, so two hides can
 * record the same number: delete B then C from `[A,B,C,D]` and both stash index
 * 1 (C really is at index 1 of `[A,C,D]`). Restoring in that order splices B at
 * 1 to give `[A,B,D]`, then C at 1 to give `[A,C,B,D]` — the reviewer's reading
 * order silently permuted, which is what drives j/k navigation, the queue, the
 * picker and batch PNG export.
 *
 * Positioning against the canonical sequence instead is order-independent: the
 * page goes immediately before its first canonical successor that is currently
 * present. Restoring B in that example finds D (C is still hidden) and lands
 * `[A,B,D]`; restoring C then finds D and lands `[A,B,C,D]`, whichever order
 * the reviewer clicks them in.
 *
 * @param {string[]} canonicalOrder every key in canonical sequence
 * @param {string[]} currentKeys the keys currently in `order`, in order
 * @param {string} key the key being restored
 * @returns {number} the index to splice at; the end when nothing anchors it
 */
function restoreOrderIndex(canonicalOrder, currentKeys, key) {
  const canonical = Array.isArray(canonicalOrder) ? canonicalOrder : []
  const current = Array.isArray(currentKeys) ? currentKeys : []
  const position = canonical.indexOf(key)
  if (position === -1) return current.length
  for (let i = position + 1; i < canonical.length; i += 1) {
    const index = current.indexOf(canonical[i])
    if (index !== -1) return index
  }
  return current.length
}

/**
 * Count the links that would go dangling if `targetKey` were hidden.
 *
 * This exists because the consequence is otherwise invisible to the reviewer.
 * cardDescription() in js/page-render.js resolves an inheriting card's text
 * from `pageData[card.target]`; once that lookup fails it falls through to the
 * card's own authored `text` — which is precisely the copy the card-inheritance
 * work exists to prove can never publish. Nothing errors, and a plausible
 * paragraph simply appears. cardTitle() reverts to the stale authored title the
 * same way, and clicking the card raises a red "Unknown page key" banner. So the
 * delete confirmation names the count rather than letting the reviewer discover
 * it later on a different page.
 *
 * `title-only` sections are counted too even though they render no description
 * for any entry: their titles still inherit, and their buttons still navigate.
 * @param {{pages: object}} data
 * @param {string} targetKey
 * @returns {{cards: number, buttons: number, pages: string[]}}
 */
function countInboundLinks(data, targetKey) {
  const summary = { cards: 0, buttons: 0, links: 0, pages: [] }
  if (!isPlainObject(data) || !isPlainObject(data.pages) || !targetKey) return summary
  const referring = new Set()

  /* Matches an inline markdown link whose TARGET is this page key.
     `formatMarkdown()` turns `[label](article11Guide)` into a real
     data-render-target navigation control, so a page can be linked to entirely
     through prose — and counting only cards and buttons reported "nothing links
     here" for exactly those pages, which is the confirmation dialog failing at
     the one job it has. The key is a bare identifier by construction, so it
     needs no regex escaping. */
  const inlineLink = new RegExp(`\\[[^\\]]*\\]\\(${targetKey}\\)`)

  /** Every string a section can carry that formatMarkdown() runs over. */
  const sectionText = (section) => {
    const out = []
    const push = (item) => {
      if (typeof item === 'string') out.push(item)
      else if (isPlainObject(item) && typeof item.text === 'string') out.push(item.text)
    }
    for (const field of ['paragraphs', 'bullets']) {
      for (const item of Array.isArray(section[field]) ? section[field] : []) push(item)
    }
    for (const row of Array.isArray(section.table) ? section.table : []) {
      for (const cell of Array.isArray(row) ? row : []) push(cell)
    }
    if (isPlainObject(section.callout)) push(section.callout.text)
    for (const step of Array.isArray(section.steps) ? section.steps : []) {
      if (!isPlainObject(step)) continue
      for (const field of ['text', 'bullets']) {
        for (const item of Array.isArray(step[field]) ? step[field] : []) push(item)
      }
      if (isPlainObject(step.callout)) push(step.callout.text)
    }
    return out
  }

  for (const [pageKey, page] of Object.entries(data.pages)) {
    if (pageKey === targetKey || !isPlainObject(page)) continue
    const sections = Array.isArray(page.sections) ? page.sections : []
    for (const section of sections) {
      if (!isPlainObject(section)) continue
      for (const text of sectionText(section)) {
        if (inlineLink.test(text)) {
          summary.links += 1
          referring.add(pageKey)
        }
      }
      for (const card of Array.isArray(section.cards) ? section.cards : []) {
        if (isPlainObject(card) && card.target === targetKey) {
          summary.cards += 1
          referring.add(pageKey)
        }
      }
      if (section.buttonTarget === targetKey) {
        summary.buttons += 1
        referring.add(pageKey)
      }
      for (const step of Array.isArray(section.steps) ? section.steps : []) {
        if (isPlainObject(step) && step.buttonTarget === targetKey) {
          summary.buttons += 1
          referring.add(pageKey)
        }
      }
    }
  }

  summary.pages = [...referring].sort()
  return summary
}

if (typeof window !== 'undefined') {
  window.pageRegistryData = {
    ALLOWED_PAGE_TYPES,
    PAGE_KEY_PATTERN,
    PROTECTED_PAGE_KEYS,
    REQUIRED_PAGE_FIELDS,
    applyRegistryToData,
    buildPageFromForm,
    countInboundLinks,
    deepClone,
    emptyRegistry,
    isValidPageObject,
    menuLabelFor,
    parseAudienceList,
    readRegistry,
    restoreOrderIndex,
    slugify,
    validateNewPage,
  }
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    ALLOWED_PAGE_TYPES,
    PAGE_KEY_PATTERN,
    PROTECTED_PAGE_KEYS,
    REQUIRED_PAGE_FIELDS,
    applyRegistryToData,
    buildPageFromForm,
    countInboundLinks,
    deepClone,
    emptyRegistry,
    isValidPageObject,
    menuLabelFor,
    parseAudienceList,
    readRegistry,
    restoreOrderIndex,
    slugify,
    validateNewPage,
  }
}

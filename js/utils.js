/* Shared utilities for HHVC mockup tool modules.
   Centralizes common functions to reduce duplication and ensure consistent
   escaping, CTA handling, and date formatting across the codebase. */

/** Canonical field list for a persisted review record (see buildReviewRecord). */
const REVIEW_RECORD_FIELDS = [
  'review_date',
  'reviewer',
  'page_key',
  'page_title',
  'page_type',
  'url_slug',
  'decision',
  'notes',
  'risks_or_blockers',
  'follow_up_owner',
  'seo_title',
  'meta_description',
  'primary_cta',
  'reading_target',
  'edited_title',
  'edited_summary',
  'updated_at',
  'history',
  'synced_at',
]

/**
 * THE review decision vocabulary. One row per decision; everything else in the
 * tool derives from this array rather than restating it.
 *
 * It was previously restated in eight places — a chip-class map here, a
 * `VALID_DECISIONS` set and a slug→label map in js/review-queue-state.js, a
 * label→slug map in js/keyboard-shortcuts.js, a display order in
 * js/review-insights-data.js, a colour map in js/review-insights.js, a
 * pre-zeroed tally in js/review-queue-rows.js, and another valid-value set in
 * js/review-state-validation.js. Two of those were exact INVERSES of each other
 * maintained by hand in different files, which is a drift waiting to happen:
 * adding a sixth decision meant finding all eight, and missing one produced a
 * decision that saved but could not be filtered, or filtered but drew no chip.
 *
 * Field notes:
 *
 * - `label` is the persisted value. It goes into localStorage, CSV/JSON
 *   exports, and the sync API, so it is data, not display text — renaming one
 *   is a storage migration, not a copy edit.
 * - `slug` is the `data-queue-action` value used by queue buttons and the
 *   keyboard shortcuts.
 * - `chipClass` replaced an older three-way pass/warn/fail mapping, for triage
 *   rather than cosmetic reasons: that mapping drew `Blocked` and `Revise and
 *   resubmit` identically, and those are exactly the two a manager must tell
 *   apart while scanning — one is waiting on an outside party and nothing the
 *   author does will move it, the other is waiting on the author and is
 *   actionable today. Colour is never the only cue; every chip renders its
 *   decision text beside it.
 * - `vizToken` is the chart fill, deliberately NOT the chip's `--status-*`
 *   border: those are tuned as 1px strokes and, used as large fills, Approved
 *   and Needs review separate by only ΔE 8.4 against a floor of 15. See the
 *   block comment on `--viz-decision-*` in css/theme.css.
 *
 * ORDER IS MEANINGFUL: this is the order a reviewer moves through, and charts,
 * legends and tally rows all follow it so the mix bar does not reshuffle itself
 * as counts change during triage.
 */
const DECISIONS = [
  {
    label: 'Needs review',
    slug: 'needs-review',
    chipClass: 'decision-pending',
    vizToken: '--viz-decision-pending',
    vizFallback: '#8a8d8d',
  },
  {
    label: 'Approved',
    slug: 'approved',
    chipClass: 'decision-approved',
    vizToken: '--viz-decision-approved',
    vizFallback: '#00734f',
  },
  {
    label: 'Approved with edits',
    slug: 'approved-with-edits',
    chipClass: 'decision-edits',
    vizToken: '--viz-decision-edits',
    vizFallback: '#c07000',
  },
  {
    label: 'Revise and resubmit',
    slug: 'revise',
    chipClass: 'decision-revise',
    vizToken: '--viz-decision-revise',
    vizFallback: '#8f57b3',
  },
  {
    label: 'Blocked',
    slug: 'blocked',
    chipClass: 'decision-blocked',
    vizToken: '--viz-decision-blocked',
    vizFallback: '#c0392b',
  },
]

/** Every decision label, in triage order. */
const DECISION_LABELS = DECISIONS.map((decision) => decision.label)

/**
 * The one decision that means "nobody has decided yet".
 *
 * It is the default a brand-new record carries, so it is also what every
 * "has this been reviewed?" test compares against. Named rather than written
 * inline so the comparison cannot drift from the label above.
 */
const DECISION_UNDECIDED = 'Needs review'

/** label -> chip class. */
const DECISION_CHIP_CLASSES = Object.fromEntries(
  DECISIONS.map((decision) => [decision.label, decision.chipClass])
)

/** label -> queue-action slug. */
const DECISION_SLUG_BY_LABEL = Object.fromEntries(
  DECISIONS.map((decision) => [decision.label, decision.slug])
)

/** queue-action slug -> label. The exact inverse of the map above, derived. */
const DECISION_LABEL_BY_SLUG = Object.fromEntries(
  DECISIONS.map((decision) => [decision.slug, decision.label])
)

/**
 * Whether a decision counts as reviewed — i.e. anything but the default.
 * @param {string} decision
 * @returns {boolean}
 */
function isDecided(decision) {
  return Boolean(decision) && decision !== DECISION_UNDECIDED
}

/**
 * A fresh per-decision tally with every decision present at zero, in order.
 *
 * Pre-seeded rather than built up from the rows on purpose: a decision nobody
 * currently holds must still render as "0", not vanish from the chart legend
 * and the stats row.
 * @returns {Record<string, number>}
 */
function zeroDecisionTally() {
  return Object.fromEntries(DECISION_LABELS.map((label) => [label, 0]))
}

;(function initSharedUtils() {
  // Expose utilities to window for backward compatibility
  // during the migration period.
  if (typeof window === 'undefined') return

  window.utils = {
    escapeHtml,
    safeUrl,
    getPrimaryCta,
    setPrimaryCta,
    resolvePageKey,
    today,
    csvEscape,
    toCsv,
    parseCsv,
    downloadFile,
    downloadBlob,
    debounce,
    throttle,
    showErrorBanner,
    getDecisionChipClass,
    DECISIONS,
    DECISION_LABELS,
    DECISION_UNDECIDED,
    DECISION_CHIP_CLASSES,
    DECISION_SLUG_BY_LABEL,
    DECISION_LABEL_BY_SLUG,
    isDecided,
    zeroDecisionTally,
    defaultSeoTitle,
    defaultMetaDescription,
    getValue,
    setValue,
    setText,
    buildReviewRecord,
    REVIEW_RECORD_FIELDS,
    getCurrentKey,
    countRelatedLinks,
    hasValidPageData,
    buildPageRows,
    isWorkspacePanelOpen,
    mountWorkspacePanelIfOpen,
  }

  installGlobalErrorHandlers()
})()

const ERROR_BANNER_ID = 'hhvcGlobalErrorBanner'

/**
 * Show a dismissible, reviewer-facing banner for unexpected errors.
 * Safe to call before the DOM is ready or repeatedly for the same error.
 * @param {string} message
 */
function showErrorBanner(message) {
  if (typeof document === 'undefined') return

  const show = () => {
    let banner = document.getElementById(ERROR_BANNER_ID)
    if (!banner) {
      banner = document.createElement('div')
      banner.id = ERROR_BANNER_ID
      banner.className = 'error-banner'
      banner.setAttribute('role', 'alert')

      const text = document.createElement('span')
      text.id = ERROR_BANNER_ID + 'Text'
      banner.appendChild(text)

      const dismiss = document.createElement('button')
      dismiss.type = 'button'
      dismiss.className = 'error-banner-dismiss'
      dismiss.textContent = 'Dismiss'
      dismiss.addEventListener('click', () => banner.remove())
      banner.appendChild(dismiss)

      document.body.appendChild(banner)
    }
    document.getElementById(ERROR_BANNER_ID + 'Text').textContent = message
  }

  if (document.body) show()
  else document.addEventListener('DOMContentLoaded', show, { once: true })
}

/**
 * Surface uncaught errors and unhandled promise rejections as a visible banner
 * instead of failing silently with only a console message. This is a review
 * tool used by non-technical reviewers, so silent breakage is worse than noise.
 */
function installGlobalErrorHandlers() {
  if (typeof window === 'undefined') return

  window.addEventListener('error', (event) => {
    console.error('Uncaught error:', event.error || event.message)
    showErrorBanner(
      'Something went wrong in the review tool. Some content may not display correctly. ' +
        'Try reloading the page; if this keeps happening, note what you were doing and report it.'
    )
  })

  window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason)
    showErrorBanner(
      'Something went wrong in the review tool. Some content may not display correctly. ' +
        'Try reloading the page; if this keeps happening, note what you were doing and report it.'
    )
  })
}

/**
 * Escape HTML special characters to prevent XSS.
 * @param {string} value
 * @returns {string}
 */
function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

/**
 * Schemes that are safe to put in an `href`. Anything else — `javascript:`,
 * `data:`, `vbscript:` — executes on click, and `escapeHtml` does NOT stop it:
 * `javascript:alert(1)` contains none of the five characters it escapes, so it
 * passes through an escaped attribute completely intact.
 *
 * This matters most for AI assist. `js/page-render.js` renders generated drafts
 * through the same functions as real pages, and the page schema types `url` /
 * `buttonUrl` as bare strings, so a draft could otherwise put a `javascript:`
 * URL behind a clickable link in the preview. `formatMarkdown` already applies
 * the same rule to inline `[label](target)` links via its `^https?://` test;
 * this extends it to the structured URL fields, which had no such guard.
 */
const SAFE_URL_SCHEMES = ['http:', 'https:', 'mailto:', 'tel:']

/**
 * Normalize a URL the way a browser does before resolving it, so a check sees
 * what actually gets fetched rather than what was typed.
 *
 *   - Control characters are stripped: `java\tscript:alert(1)` runs, and
 *     `https:\t//host` loads from `host`.
 *   - Backslashes are equivalent to forward slashes in the authority position.
 *     `new URL('\\\\evil.example', 'https://sf.gov')` resolves to
 *     https://evil.example — so `\\\\host`, `\\/host` and `/\\host` are all
 *     protocol-relative URLs wearing a disguise, and matching only on `//`
 *     lets every one of them through.
 *
 * Shared by `safeUrl()` (the scheme guard, for navigation targets) and
 * `findExternalAssetUrls()` in build_scripts/data-checks.js (the host guard,
 * for image sources). Those two answer different questions but must agree on
 * what the browser will actually do with the string, so the normalization is
 * defined once here rather than restated in each.
 *
 * Returns a probe for TESTING only — never render it. It is lowercased and has
 * characters removed, so it is not the value the caller should emit.
 * @param {string} raw an already-trimmed URL
 * @returns {string} the lowercased, control-stripped, slash-normalized probe
 */
function urlProbe(raw) {
  return String(raw ?? '')
    .replace(/[\u0000-\u0020]/g, '')
    .replace(/\\/g, '/')
    .toLowerCase()
}

/**
 * Return a URL that is safe to interpolate into an `href`, or the inert `#`
 * sentinel when it is not. Accepts absolute http(s)/mailto/tel URLs and
 * any scheme-less relative value (root-relative `/forms/…`, document-relative
 * `help/foo`, bare `#top` or `?q=1`); rejects protocol-relative URLs in every
 * spelling a browser accepts — `//host`, `\\\\host`, `\\/host`, `/\\host` — which
 * look relative but leave the origin. Whitespace is trimmed from the returned
 * value, so callers comparing output against input must trim first.
 *
 * The caller must still run the result through `escapeHtml` — this guards the
 * scheme, not the attribute delimiters.
 * @param {string} value
 * @returns {string} the original URL, or '#' if its scheme is not safe
 */
function safeUrl(value) {
  const raw = String(value ?? '').trim()
  if (!raw) return '#'

  // See urlProbe() for why the raw string cannot be tested directly. The probe
  // is for the tests below only — every `return` here hands back `raw`.
  const probe = urlProbe(raw)

  if (probe.startsWith('#')) return raw
  // Protocol-relative: "//evil.example" inherits the page scheme and leaves the
  // origin, so it is not the same thing as a root-relative path.
  if (probe.startsWith('//')) return '#'
  if (probe.startsWith('/')) return raw

  // Deliberately hand-parsed rather than using `new URL()`: this file is
  // evaluated in the plain VM context that tests/helpers/load-scripts.js builds,
  // which has no URL constructor, and a guard that silently fails closed in one
  // of its two execution contexts is worse than no guard at all.
  const scheme = probe.match(/^([a-z][a-z0-9+.-]*):/)
  if (!scheme) return raw // no scheme at all — a relative path
  return SAFE_URL_SCHEMES.includes(scheme[1] + ':') ? raw : '#'
}

/**
 * Find the primary CTA button text from page sections or fallback.
 * @param {object} page
 * @returns {string}
 */
function getPrimaryCta(page) {
  for (const section of page.sections || []) {
    for (const step of section.steps || []) {
      if (step.button) return step.button
    }
    if (section.button && section.buttonStyle !== 'secondary') return section.button
  }
  if (page.spotlight && page.spotlight.button) return page.spotlight.button
  return page.primaryCta || ''
}

/**
 * Resolves a possibly-stale ?page= key to a real page key. Pure function
 * (no DOM/globals) so js/app.js's resolveInitialPageKey can layer toast
 * side effects on top while this stays independently testable.
 * @param {string|null|undefined} key
 * @param {object} pageData
 * @param {object} [aliases] old-key -> current-key map for retired pages
 * @param {string} [defaultKey]
 * @returns {{key: string, status: 'ok'|'aliased'|'unknown', from: string|null}}
 */
function resolvePageKey(key, pageData, aliases, defaultKey = 'pestsTopic') {
  if (!key) return { key: defaultKey, status: 'ok', from: null }
  if (pageData[key]) return { key, status: 'ok', from: null }
  const alias = aliases && aliases[key]
  if (alias && pageData[alias]) return { key: alias, status: 'aliased', from: key }
  return { key: defaultKey, status: 'unknown', from: key }
}

/**
 * Update the primary CTA button text in page data.
 * @param {object} page
 * @param {string} label
 */
function setPrimaryCta(page, label) {
  for (const section of page.sections || []) {
    for (const step of section.steps || []) {
      if (step.button) {
        step.button = label
        return
      }
    }
    if (section.button && section.buttonStyle !== 'secondary') {
      section.button = label
      return
    }
  }
  if (page.spotlight && page.spotlight.button) {
    page.spotlight.button = label
    return
  }
  page.primaryCta = label
}

/**
 * Get today's date as YYYY-MM-DD.
 * @returns {string}
 */
function today() {
  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

/**
 * Escape a value for CSV output, including formula injection protection.
 * Neutralizes Excel/Google Sheets formula injection by prefixing dangerous cells.
 * @param {string} value
 * @returns {string}
 */
function csvEscape(value) {
  const text = String(value ?? '')

  // Check for formula injection characters. The =/+/-/@ checks run against
  // the trimStart()ed value so a formula hidden behind ordinary spaces is
  // still caught, but the tab/CR checks must run against the RAW text:
  // trimStart() treats \t and \r as whitespace and strips them, so checking
  // the trimmed value for a leading tab/CR could never match (a real bug —
  // previously documented by a test.todo in tests/utils.test.js).
  const trimmed = text.trimStart()
  const needsProtection =
    trimmed.startsWith('=') ||
    trimmed.startsWith('+') ||
    trimmed.startsWith('-') ||
    trimmed.startsWith('@') ||
    text.startsWith('\t') ||
    text.startsWith('\r')

  // The protective apostrophe must be applied before quoting so it stays
  // inside the quoted field when the value also contains commas/quotes/newlines.
  const protectedText = needsProtection ? "'" + text : text

  return /[",\n\r]/.test(protectedText)
    ? '"' + protectedText.replaceAll('"', '""') + '"'
    : protectedText
}

/**
 * Serialize rows (arrays of cell values) to CSV text.
 * @param {Array<Array<string>>} rows
 * @returns {string}
 */
function toCsv(rows) {
  return rows.map((row) => row.map(csvEscape).join(',')).join('\n') + '\n'
}

/**
 * Parse CSV text into rows of cell values, inverse of toCsv/csvEscape.
 * Uses Papa Parse when loaded in the browser; falls back to a hand-rolled parser in tests.
 * @param {string} text
 * @returns {Array<Array<string>>}
 */
function parseCsv(text) {
  if (typeof Papa !== 'undefined' && Papa.parse) {
    const result = Papa.parse(text, {
      delimiter: ',',
      skipEmptyLines: false,
      transform: (value) => (value == null ? '' : String(value)),
    })
    if (result.errors.length) {
      const first = result.errors[0]
      throw new Error(`CSV parse error at row ${first.row}: ${first.message}`)
    }
    const rows = result.data
    if (rows.length && rows[rows.length - 1].length === 1 && rows[rows.length - 1][0] === '') {
      rows.pop()
    }
    return rows
  }

  const rows = []
  let row = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i += 1) {
    const ch = text.charAt(i)
    const next = text.charAt(i + 1)

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"'
        i += 1
      } else if (ch === '"') {
        inQuotes = false
      } else {
        field += ch
      }
      continue
    }

    if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      row.push(field)
      field = ''
    } else if (ch === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else if (ch === '\r') {
      // ignore; \r\n handled via the \n branch above
    } else {
      field += ch
    }
  }

  if (field.length || row.length) {
    row.push(field)
    rows.push(row)
  }

  return rows
}

/**
 * Trigger a browser download of the given content.
 * @param {string} filename
 * @param {string} content
 * @param {string} mimeType
 */
function downloadFile(filename, content, mimeType) {
  downloadBlob(filename, new Blob([content], { type: mimeType }))
}

/**
 * Trigger a browser download for an already-built Blob.
 *
 * Split out of downloadFile because the PNG export path
 * (js/mockup-image-export.js) gets a Blob straight from the renderer and has
 * nothing to serialize — routing it through downloadFile would mean wrapping
 * a Blob inside another Blob. Both share the same object-URL lifecycle:
 * create, click a detached <a>, revoke immediately. Revoking synchronously
 * after click() is safe, since the browser has already begun the download by
 * then, and skipping it leaks the whole blob for the life of the document —
 * which for a 2x page capture is megabytes per export.
 * @param {string} filename suggested name for the saved file
 * @param {Blob} blob
 * @returns {void}
 */
function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

/**
 * Debounce a function to limit execution rate.
 * @param {Function} fn
 * @param {number} delay
 * @returns {Function}
 */
function debounce(fn, delay) {
  let timeoutId
  return function debounced(...args) {
    clearTimeout(timeoutId)
    timeoutId = setTimeout(() => fn.apply(this, args), delay)
  }
}

/**
 * Throttle a function to execute at most once per interval.
 * @param {Function} fn
 * @param {number} limit
 * @returns {Function}
 */
function throttle(fn, limit) {
  let inThrottle
  return function throttled(...args) {
    if (!inThrottle) {
      fn.apply(this, args)
      inThrottle = true
      setTimeout(() => (inThrottle = false), limit)
    }
  }
}

/**
 * Map a review decision to its chip class.
 *
 * Falls back to the neutral pending chip for an unrecognised decision rather
 * than dropping the class, since saved state can carry values this build does
 * not know about (an imported backup, or a decision added later).
 * @param {string} decision
 * @returns {string}
 */
function getDecisionChipClass(decision) {
  return DECISION_CHIP_CLASSES[decision] || 'decision-pending'
}

/**
 * Default SEO title for a page when none has been set explicitly.
 * @param {object} page
 * @returns {string}
 */
function defaultSeoTitle(page) {
  return page.seoTitle || `${page.title || ''} | San Francisco`
}

/**
 * Default meta description for a page when none has been set explicitly.
 * @param {object} page
 * @returns {string}
 */
function defaultMetaDescription(page) {
  return page.metaDescription || page.summary || ''
}

/**
 * Read a form field's current value.
 * @param {string} id
 * @returns {string}
 */
function getValue(id) {
  return document.getElementById(id)?.value ?? ''
}

/**
 * Set a form field's value, if the element exists.
 * @param {string} id
 * @param {string} value
 */
function setValue(id, value) {
  const el = document.getElementById(id)
  if (el) el.value = value ?? ''
}

/**
 * Set an element's text content, if the element exists.
 * @param {string} id
 * @param {string} value
 */
function setText(id, value) {
  const el = document.getElementById(id)
  if (el) el.textContent = value ?? ''
}

/**
 * Whether HHVC_DATA has the shape every module depends on (a pages map and
 * an order list). js/state.js uses this to fail loudly (throw) if
 * window.HHVC_DATA never loaded; every module that reads DATA after that —
 * including ones that might load standalone, before state.js runs — uses it
 * to fail quietly (return early) instead of assuming the shape is valid.
 * @param {object} data
 * @returns {boolean}
 */
function hasValidPageData(data) {
  return Boolean(data && data.pages && data.order)
}

/**
 * Map HHVC_DATA.order into one row per page, looking up each page object and
 * delegating the row's actual shape to the caller.
 *
 * NO CURRENT CALLERS. It was shared scaffolding for the review queue, the
 * portfolio overview and the interactive sitemap; the sitemap was deleted
 * outright and the other two no longer route through it. Recorded rather than
 * removed because it is still published on `window.utils`, but it is a
 * deletion candidate — not a helper to reach for.
 * @param {object} data HHVC_DATA (must have .order and .pages)
 * @param {(key: string, label: string, page: object) => object} enrich
 *   Builds the row for one page; receives the looked-up page object (an
 *   empty object if missing) and returns the complete row.
 * @returns {Array<object>}
 */
function buildPageRows(data, enrich) {
  return data.order.map(([key, label]) => enrich(key, label, data.pages[key] || {}))
}

/**
 * Whether a lazily-mounted workspace panel is currently on screen.
 *
 * Panel VISIBILITY is the signal, deliberately, rather than the persisted
 * `state.ui.workspace_tab`: visibility reflects whatever setWorkspaceTab
 * actually settled on, including the onboarding path that forces the
 * workspace open on first visit and the fallback to 'overview' when a saved
 * tab id is no longer valid.
 *
 * @param {string} panelName The `data-workspace-panel` value. Both real call
 *   sites pass 'help'; the strip is ['overview', 'checks', 'help'] and the
 *   'assist' panel this used to name is now a section inside Help.
 * @returns {boolean}
 */
function isWorkspacePanelOpen(panelName) {
  if (typeof document === 'undefined') return false
  const panel = document.querySelector(`[data-workspace-panel="${panelName}"]`)
  return Boolean(panel) && !panel.hidden
}

/**
 * Mount a lazy workspace panel if its tab is ALREADY open at init() time.
 *
 * Every lazily-mounted panel needs this, and each one needs it for the same
 * reason, so the reason is written here once instead of three times.
 *
 * The panels (AI assist, Tool status — both now sections inside Help) publish a
 * `window.__mount…OnTabOpen` hook that setWorkspaceTab calls when the reviewer
 * opens the tab. But js/ux-improvements.js initializes EARLIER and restores a
 * persisted `workspace_tab` during its own init — before those hooks exist. Its
 * guarded call therefore finds nothing to call and skips, and a reviewer who
 * left one of these tabs open on their last visit came back to an empty panel
 * that only filled in once they switched tabs and back.
 *
 * So each panel also catches the already-open case itself, at its own init().
 *
 * @param {string} panelName The `data-workspace-panel` value, e.g. 'assist'.
 * @param {() => void} mount The panel's own render/ensure-rendered function.
 * @returns {void}
 */
function mountWorkspacePanelIfOpen(panelName, mount) {
  if (isWorkspacePanelOpen(panelName)) mount()
}

/**
 * Get the page key currently selected in the sidebar page picker.
 * @param {string} [fallback] Extra fallback used only when the picker has no
 *   value yet; falls back further to 'pestsTopic' if omitted or also empty.
 * @returns {string}
 */
function getCurrentKey(fallback) {
  return document.getElementById('pageSelect')?.value || fallback || 'pestsTopic'
}

/**
 * Count outbound "related link" affordances on a page: card links, section
 * buttons, and step buttons. Used for portfolio-wide link-density checks.
 * @param {object} page
 * @returns {number}
 */
function countRelatedLinks(page) {
  let count = 0
  for (const section of page.sections || []) {
    count += Array.isArray(section.cards) ? section.cards.length : 0
    count += section.button ? 1 : 0
    for (const step of section.steps || []) {
      count += step.button ? 1 : 0
    }
  }
  return count
}

/**
 * Build a review record for a page with sane defaults, applying overrides
 * and projecting down to the requested field set. This is the single
 * source of truth for the "review record" shape persisted to local
 * storage and exported via CSV/JSON.
 * @param {object} page
 * @param {string} pageKey
 * @param {object} [overrides]
 * @param {string[]} [fields]
 * @returns {object}
 */
function buildReviewRecord(page, pageKey, overrides = {}, fields = REVIEW_RECORD_FIELDS) {
  const base = {
    review_date: today(),
    reviewer: '',
    page_key: pageKey,
    page_title: page.title || pageKey,
    page_type: page.type || '',
    url_slug: page.slug || '',
    decision: 'Needs review',
    notes: '',
    risks_or_blockers: '',
    follow_up_owner: '',
    seo_title: defaultSeoTitle(page),
    meta_description: defaultMetaDescription(page),
    primary_cta: getPrimaryCta(page),
    reading_target: page.reading || '',
    edited_title: '',
    edited_summary: '',
    updated_at: '',
    history: [],
    // Distinct from updated_at (bumped on every local edit): synced_at only
    // changes on an actual pull/push response, so it can be used as the
    // conflict-detection baseline in server.ts's putReviewPage without a
    // pre-push autosave silently invalidating it. See js/review-state-sync.js.
    synced_at: '',
  }
  const merged = { ...base, ...overrides }
  const result = {}
  for (const key of fields) result[key] = merged[key]
  return result
}

export {
  REVIEW_RECORD_FIELDS,
  buildPageRows,
  buildReviewRecord,
  countRelatedLinks,
  csvEscape,
  debounce,
  defaultMetaDescription,
  defaultSeoTitle,
  downloadBlob,
  downloadFile,
  escapeHtml,
  getCurrentKey,
  getPrimaryCta,
  getDecisionChipClass,
  DECISIONS,
  DECISION_LABELS,
  DECISION_UNDECIDED,
  DECISION_CHIP_CLASSES,
  DECISION_SLUG_BY_LABEL,
  DECISION_LABEL_BY_SLUG,
  isDecided,
  zeroDecisionTally,
  getValue,
  hasValidPageData,
  isWorkspacePanelOpen,
  mountWorkspacePanelIfOpen,
  parseCsv,
  resolvePageKey,
  SAFE_URL_SCHEMES,
  safeUrl,
  setPrimaryCta,
  setText,
  setValue,
  showErrorBanner,
  throttle,
  toCsv,
  today,
  urlProbe,
}

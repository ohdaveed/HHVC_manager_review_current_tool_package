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
]

;(function initSharedUtils() {
  // Expose utilities to window for backward compatibility
  // during the migration period.
  if (typeof window === 'undefined') return

  window.utils = {
    escapeHtml,
    getPrimaryCta,
    setPrimaryCta,
    today,
    csvEscape,
    toCsv,
    downloadFile,
    debounce,
    throttle,
    showErrorBanner,
    getStatusChipClass,
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
      banner.setAttribute('role', 'alert')
      banner.style.cssText =
        'position:fixed;top:0;left:0;right:0;z-index:9999;background:#b31412;color:#fff;' +
        'padding:10px 16px;font:14px/1.4 sans-serif;display:flex;justify-content:space-between;' +
        'align-items:center;gap:12px;box-shadow:0 2px 6px rgba(0,0,0,.3);'

      const text = document.createElement('span')
      text.id = ERROR_BANNER_ID + 'Text'
      banner.appendChild(text)

      const dismiss = document.createElement('button')
      dismiss.type = 'button'
      dismiss.textContent = 'Dismiss'
      dismiss.style.cssText =
        'background:transparent;color:#fff;border:1px solid #fff;border-radius:4px;' +
        'padding:4px 10px;cursor:pointer;flex:none;'
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
 * Find the primary CTA button text from page sections or fallback.
 * @param {object} page
 * @returns {string}
 */
function getPrimaryCta(page) {
  for (const section of page.sections || []) {
    for (const step of section.steps || []) {
      if (step.button) return step.button
    }
    if (section.button) return section.button
  }
  return page.primaryCta || ''
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
    if (section.button) {
      section.button = label
      return
    }
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

  // Check for formula injection characters
  const trimmed = text.trimStart()
  const needsProtection =
    trimmed.startsWith('=') ||
    trimmed.startsWith('+') ||
    trimmed.startsWith('-') ||
    trimmed.startsWith('@') ||
    trimmed.startsWith('\t') ||
    trimmed.startsWith('\r')

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
 * Trigger a browser download of the given content.
 * @param {string} filename
 * @param {string} content
 * @param {string} mimeType
 */
function downloadFile(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType })
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
 * Map a review decision to its status-chip color class.
 * 'Approved with edits' counts as passing (green) alongside 'Approved' —
 * to a reviewer scanning a list, it reads as an approved state.
 * @param {string} decision
 * @returns {'pass'|'fail'|'warn'}
 */
function getStatusChipClass(decision) {
  if (decision === 'Approved' || decision === 'Approved with edits') return 'pass'
  if (decision === 'Blocked' || decision === 'Revise and resubmit') return 'fail'
  return 'warn'
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
 * delegating the row's actual shape to the caller. Shared scaffolding for
 * the review queue, portfolio overview, and interactive sitemap, which each
 * enrich a row very differently (staleness/ownership, compliance checks,
 * and link-graph/cluster info respectively) but all start from "one row per
 * page in DATA.order, with that page's data looked up."
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
  }
  const merged = { ...base, ...overrides }
  const result = {}
  for (const key of fields) result[key] = merged[key]
  return result
}

/* The single definition of what an inline link target may be.

   An inline link is written in page copy as `[label](target)` and rendered by
   js/page-render.js's formatMarkdown(): an http(s) target becomes a real
   external anchor, anything else becomes
   `<button data-render-target="...">`, an in-mockup navigation control. So a
   target that is neither a real page key nor a URL renders as a control that
   does nothing on click — or, once js/page-registry.js is involved, raises the
   red "Unknown page key" banner, which reads as corruption for what is usually
   a typo.

   That rule existed in exactly one place — findBrokenInlineLinks() in
   build_scripts/data-checks.js, which walks authored pages/*.js copy at
   validation time — and nowhere at all on the path a REVIEWER creates a link:
   js/inline-content-edit-link-tool.js's typed target, and any anchor pasted
   into an open editor, both of which land in review state rather than in
   source, where `bun run validate` can never see them. This module is that
   rule, extracted so the widget and the validator cannot come to disagree
   about what a link may point at.

   Dual-exported (window.inlineLinkTarget plus module.exports) exactly like
   js/review-merge.js, js/card-inheritance.js and js/plain-language.js, and
   deliberately IMPORT-FREE for the same reason those are: it is read by
   build_scripts/data-checks.js under Bun with no browser, and by browser code
   that must be able to call it without waiting on a load order. It reads no
   global either, so it has no load-order dependency of its own — the key
   collection is always passed in.

   Note what this module deliberately does NOT do: it does not sanitize. The
   `href` an external target ends up in is still run through js/utils.js's
   safeUrl() at the point it is written, by js/inline-content-edit-link-tool.js
   and js/page-render.js. Deciding whether a target is VALID and neutralizing
   the string that reaches an attribute are two different jobs, and folding
   safeUrl() in here would add an argument that never changes an answer: every
   scheme safeUrl rejects is already rejected below for not being a page key,
   not being `#`, and not being http(s)-prefixed. */

/**
 * The reviewer-facing statement of the rule below, in the words a reviewer
 * needs rather than the predicate's terms.
 *
 * It lives here rather than in js/inline-content-edit-link-tool.js so the rule
 * and its description are declared together and cannot drift — the widget
 * renders this into a visually-hidden span referenced by the target input's
 * `aria-describedby`, so it is announced when focus first enters the field
 * rather than only once the reviewer has already got it wrong.
 */
const INLINE_LINK_TARGET_RULE =
  'Enter a page key from the list, an https:// address, or # for a placeholder link.'

/**
 * Whether a collection passed as `knownKeys` holds the given key.
 *
 * Accepts the three shapes the callers actually have, rather than forcing an
 * adapter at either site: a Set (what build_scripts/data-checks.js builds), an
 * array (what window.pageRegistry.knownKeys() returns), and a plain object
 * keyed by page key (the `pages` map itself).
 *
 * The object branch uses Object.prototype.hasOwnProperty rather than a truthy
 * property read, because `toString`, `valueOf` and `hasOwnProperty` all satisfy
 * the page-key pattern used elsewhere in this tool and are inherited by every
 * plain object — so a bare `keys[target]` answers true for a page that does not
 * exist. js/page-registry-data.js guards the same hazard the same way, and
 * learned it the hard way: there, the inherited function being truthy made an
 * "already present, skip" branch fire and a page silently never get added.
 *
 * A missing collection means "no keys known", never "every key valid". Failing
 * open would make the widget silently accept every typo during the window
 * before page data has loaded, which is precisely when a reviewer following a
 * deep link is most likely to be typing.
 *
 * @param {Set<string>|Array<string>|Record<string, unknown>|null|undefined} keys
 * @param {string} target
 * @returns {boolean}
 */
function holdsKey(keys, target) {
  if (!keys) return false
  if (typeof keys.has === 'function') return keys.has(target)
  if (Array.isArray(keys)) return keys.includes(target)
  if (typeof keys === 'object') return Object.prototype.hasOwnProperty.call(keys, target)
  return false
}

/**
 * Whether `target` is something an inline link may point at.
 *
 * Three accepted forms, and they are exactly the three findBrokenInlineLinks()
 * has always accepted for authored copy — this is a consolidation of that rule,
 * not a new one, so a target a reviewer types into the widget can never be
 * something CI would reject if the same text were later moved into source:
 *
 * 1. An existing page key. Checked against whatever collection the caller
 *    passes — in the browser that is window.pageRegistry.knownKeys(), which
 *    INCLUDES pages the reviewer has hidden. Validating against the visible set
 *    instead would mean deleting one page silently invalidates prose on other
 *    pages that link to it, turning a deliberately reversible action into a
 *    destructive one.
 * 2. An http(s) URL, which formatMarkdown() renders as a real external anchor.
 * 3. The bare `#` sentinel, kept un-navigable by the mockup's own click
 *    handler and used in authored copy for a placeholder link.
 *
 * `mailto:`, `tel:` and root-relative paths are rejected, and that is a
 * RENDERER fact rather than a scheme judgement — safeUrl() permits the first
 * two. formatMarkdown()'s branch is /^https?:\/\//, so any of them becomes a
 * `data-render-target` button that does nothing when clicked. Accepting them
 * here would require widening that regex, which paints every page of the
 * mockup rather than just this widget.
 *
 * The value is trimmed before testing. formatMarkdown()'s capture is
 * `([^)]+)`, so a padded target arrives with its whitespace intact, and the
 * question this predicate asks is about the target, not about whitespace
 * hygiene.
 *
 * @param {string} target The raw target, as typed or as captured from markdown.
 * @param {Set<string>|Array<string>|Record<string, unknown>|null|undefined} knownKeys
 * @returns {boolean}
 */
function isValidInlineLinkTarget(target, knownKeys) {
  const trimmed = String(target ?? '').trim()
  if (!trimmed) return false
  if (trimmed === '#') return true
  if (holdsKey(knownKeys, trimmed)) return true
  return /^https?:\/\//i.test(trimmed)
}

if (typeof window !== 'undefined') {
  window.inlineLinkTarget = { isValidInlineLinkTarget, INLINE_LINK_TARGET_RULE }
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { isValidInlineLinkTarget, INLINE_LINK_TARGET_RULE }
}

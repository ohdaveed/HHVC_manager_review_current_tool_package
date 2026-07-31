// Numeric environment-variable parsing for the AI assist tunables.
//
// `Number(process.env.X ?? fallback)` is the obvious spelling and it is wrong:
// `??` only supplies the fallback when the variable is UNSET. A variable that
// is set to a typo parses to NaN and sails straight through into whatever API
// consumes it. That is not a theoretical concern here —
// `AbortSignal.timeout(NaN)` throws a TypeError under Bun, so a single mistyped
// `AI_REQUEST_TIMEOUT_MS` would make every generation fail with an unmapped
// 500, with nothing in the message pointing at the real cause.
//
// Shared by server.ts and provider-anthropic.js so the two cannot drift.

// The default ceiling is the largest value `AbortSignal.timeout()` accepts.
// "Finite" is NOT the same test: `AI_REQUEST_TIMEOUT_MS=1e20` is a perfectly
// finite number and `AbortSignal.timeout()` rejects it outright with
// `TypeError: Value 100000000000000000000 is outside the range
// [0, 9007199254740991]`. That call sits OUTSIDE the generate route's try
// block, so letting such a value through turns every generation into an
// unmapped 500 — precisely the failure mode this helper exists to prevent,
// just moved one typo further along. Non-integers are rejected for the same
// class of reason: a fractional millisecond or a fractional retry count is
// never what anyone meant, and accepting it hides the typo that produced it.
const MAX_SAFE = Number.MAX_SAFE_INTEGER

/**
 * Read a bounded number from the environment, falling back on anything that is
 * not a usable value.
 *
 * Rejects NaN, Infinity, negatives, non-integers, and anything outside
 * [min, max]. A misconfigured deployment gets the documented default and a
 * warning rather than a confusing runtime failure — silently degrading is what
 * makes this class of bug expensive to find.
 *
 * @param {string} name Environment variable to read.
 * @param {number} fallback Value to use when unset or unusable.
 * @param {object} [options]
 * @param {number} [options.min] Smallest acceptable value. Defaults to 1,
 *   since a zero timeout or a negative retry count is never meaningful; pass 0
 *   for settings where "none" is a legitimate choice, like a retry count.
 * @param {number} [options.max] Largest acceptable value. Defaults to
 *   `Number.MAX_SAFE_INTEGER`; pass something tighter when the consumer has a
 *   narrower range than "an integer JavaScript can represent exactly".
 * @returns {number}
 */
function numberFromEnv(name, fallback, options = {}) {
  const min = typeof options.min === 'number' ? options.min : 1
  const max = typeof options.max === 'number' ? options.max : MAX_SAFE
  const raw = process.env[name]
  if (raw === undefined || raw === '') return fallback

  const parsed = Number(raw)
  // `Number.isSafeInteger` covers NaN, Infinity and fractions in one test, and
  // caps the magnitude at the point where integers stop being exact — past
  // which a value cannot round-trip anyway, so the number a deployment set is
  // no longer the number it would get.
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) {
    // Warn rather than throw: an unusable tunable should not stop the server
    // from starting, but it must not pass silently either.
    console.warn(
      `Ignoring ${name}="${raw}": expected a whole number between ${min} and ${max}. ` +
        `Using ${fallback}.`
    )
    return fallback
  }
  return parsed
}

module.exports = { numberFromEnv, MAX_SAFE }

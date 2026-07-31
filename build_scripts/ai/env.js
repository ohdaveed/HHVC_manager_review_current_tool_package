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

/**
 * Read a bounded number from the environment, falling back on anything that is
 * not a usable value.
 *
 * Rejects NaN, Infinity, and negatives. A misconfigured deployment gets the
 * documented default and a warning rather than a confusing runtime failure —
 * silently degrading is what makes this class of bug expensive to find.
 *
 * @param {string} name Environment variable to read.
 * @param {number} fallback Value to use when unset or unusable.
 * @param {object} [options]
 * @param {number} [options.min] Smallest acceptable value. Defaults to 1,
 *   since a zero timeout or a negative retry count is never meaningful; pass 0
 *   for settings where "none" is a legitimate choice, like a retry count.
 * @returns {number}
 */
function numberFromEnv(name, fallback, options = {}) {
  const min = typeof options.min === 'number' ? options.min : 1
  const raw = process.env[name]
  if (raw === undefined || raw === '') return fallback

  const parsed = Number(raw)
  if (!Number.isFinite(parsed) || parsed < min) {
    // Warn rather than throw: an unusable tunable should not stop the server
    // from starting, but it must not pass silently either.
    console.warn(
      `Ignoring ${name}="${raw}": expected a finite number >= ${min}. Using ${fallback}.`
    )
    return fallback
  }
  return parsed
}

module.exports = { numberFromEnv }

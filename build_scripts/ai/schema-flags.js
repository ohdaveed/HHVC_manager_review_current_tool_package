// build_scripts/ai/schema-flags.js
//
// Provider-specific facts about an output schema, carried on the schema object
// itself.
//
// **This file exists to avoid a require cycle, and must keep importing
// nothing.** `schemas.js` requires `providers.js` (for the list of registered
// provider names), which requires `provider-anthropic.js`. So the provider
// cannot require `schemas.js` back to ask whether a schema is compilable —
// `schemas.js`'s own header states that invariant. A leaf module both sides can
// require breaks the tie.
//
// **The flag is a Symbol, deliberately.** The schema object is serialized
// straight into an API request body, and `JSON.stringify` ignores symbol-keyed
// properties — so this annotation cannot leak into the wire format and be
// rejected as an unrecognized field. A string key would have to be stripped
// before every request, which is one forgotten spread away from a 400.

/**
 * Marks a schema Anthropic's structured-output grammar compiler cannot accept.
 * Set in `schemas.js`, read by `provider-anthropic.js`. See the comment on
 * `ANTHROPIC_GRAMMAR_INCOMPATIBLE` in `schemas.js` for the measurements.
 */
const ANTHROPIC_GRAMMAR_INCOMPATIBLE = Symbol.for('hhvc.anthropicGrammarIncompatible')

/**
 * @param {object} schema
 * @returns {boolean} whether Anthropic can compile this schema into a grammar.
 *   Unmarked schemas are assumed compilable: the marker records a measured
 *   failure, and defaulting the other way would silently drop every new schema
 *   to prompt instructions without anyone deciding to.
 */
function supportsAnthropicStructuredOutput(schema) {
  return !(schema && schema[ANTHROPIC_GRAMMAR_INCOMPATIBLE])
}

module.exports = { ANTHROPIC_GRAMMAR_INCOMPATIBLE, supportsAnthropicStructuredOutput }

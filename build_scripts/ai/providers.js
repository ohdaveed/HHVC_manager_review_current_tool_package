// The provider registry for the AI assist feature.
//
// One place that knows which model providers exist, so index.js and server.ts
// can ask "is anything configured?" and "give me the one called X" without
// naming a provider module. Adding a third provider is a require plus a line in
// REGISTRY; nothing downstream of here mentions a provider by name.
//
// Every registered module must export the same surface:
//
//   name            registry key, also the value reported back as `provider`
//   label           human-readable, for the browser's picker
//   isConfigured()  whether this deployment has the key for it
//   getModel()      the configured model id
//   listModelIds()  live model ids this key can see  -> Promise<string[]>
//   normalizeUsage(raw)  provider counters -> {inputTokens, outputTokens, totalTokens}
//   generateObject({system, userPrompt, jsonSchema, signal})
//       -> Promise<{object, model, usage, rawUsage, stopReason}>
//
// Configuration is read from the environment on every call rather than snapshot
// at require time. The registry is a module singleton and server.ts requires it
// once at startup, so caching `isConfigured()` would freeze whatever the
// environment looked like during the first import — which is precisely the
// thing the tests vary between spawns.
const anthropic = require('./provider-anthropic')
const gemini = require('./provider-gemini')
const { UnknownProviderError } = require('./errors')

/**
 * Registration order is meaningful: `defaultProvider()` returns the first
 * CONFIGURED entry, so this is the preference order a deployment gets when a
 * request does not name a provider. Claude leads because it is the path the
 * validate-and-retry loop was tuned against.
 */
const REGISTRY = [anthropic, gemini]

/** @returns {string[]} every registered provider name, configured or not. */
function allProviderNames() {
  return REGISTRY.map((provider) => provider.name)
}

/**
 * @param {string} name
 * @returns {object|null} the provider module, or null if no such name.
 */
function getProvider(name) {
  return REGISTRY.find((provider) => provider.name === name) || null
}

/** @returns {object[]} the provider modules this deployment can actually use. */
function configuredProviders() {
  return REGISTRY.filter((provider) => provider.isConfigured())
}

/** @returns {string[]} names of the providers this deployment can actually use. */
function configuredProviderNames() {
  return configuredProviders().map((provider) => provider.name)
}

/** @returns {boolean} whether generation is possible at all. */
function hasConfiguredProvider() {
  return configuredProviders().length > 0
}

/** @returns {object|null} the first configured provider, in registration order. */
function defaultProvider() {
  return configuredProviders()[0] || null
}

/**
 * Resolve the provider a request should run on.
 *
 * An unnamed provider takes the deployment's default, which keeps every
 * existing single-provider caller working unchanged. A NAMED provider that is
 * not configured is an error rather than a silent fallback: quietly running a
 * Gemini request on Claude would attribute one model's output to another in the
 * panel's meta line and in the downloaded module, which is worse than failing.
 *
 * @param {string} [name] The requested provider, if the client named one.
 * @returns {object} The provider module.
 * @throws {UnknownProviderError} when `name` is unknown or unconfigured, and
 *   when nothing at all is configured.
 */
function resolveProvider(name) {
  if (!name) {
    const fallback = defaultProvider()
    if (!fallback) throw new UnknownProviderError('default', [])
    return fallback
  }
  const provider = getProvider(name)
  if (!provider || !provider.isConfigured()) {
    throw new UnknownProviderError(name, configuredProviderNames())
  }
  return provider
}

module.exports = {
  REGISTRY,
  allProviderNames,
  getProvider,
  configuredProviders,
  configuredProviderNames,
  hasConfiguredProvider,
  defaultProvider,
  resolveProvider,
}

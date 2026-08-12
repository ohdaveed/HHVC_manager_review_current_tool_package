// Unit tests for the AI assist provider registry and the per-provider usage
// normalization that lets one response shape describe either provider.
//
// Deliberately separate from tests/ai-assist-server.test.js, which spawns a
// real server and can therefore only observe whatever environment that spawn
// was given. Provider configuration is read from process.env on every call
// precisely so it can be varied, and these tests are what exercise that: a
// registry that snapshotted its config at require time would pass every server
// test and still freeze the first environment it ever saw.
const { describe, test, expect, beforeEach, afterEach } = require('bun:test')

const providers = require('../build_scripts/ai/providers.js')
const anthropic = require('../build_scripts/ai/provider-anthropic.js')
const gemini = require('../build_scripts/ai/provider-gemini.js')
const {
  UnknownProviderError,
  RefusalError,
  ProviderTimeoutError,
} = require('../build_scripts/ai/errors.js')
const { generateRequestSchema } = require('../build_scripts/ai/schemas.js')

/**
 * Both keys, saved and restored around every test.
 *
 * A test that leaves a key set leaks into its siblings AND into every other
 * file in the run, since Bun shares one process. The keys are `delete`d rather
 * than set to '' when they were absent, so "unset" is restored as unset.
 */
const KEYS = ['ANTHROPIC_API_KEY', 'GEMINI_API_KEY']
let saved = {}

function setKeys({ claude, gemini: geminiKey }) {
  if (claude) process.env.ANTHROPIC_API_KEY = claude
  else delete process.env.ANTHROPIC_API_KEY
  if (geminiKey) process.env.GEMINI_API_KEY = geminiKey
  else delete process.env.GEMINI_API_KEY
}

beforeEach(() => {
  saved = {}
  for (const key of KEYS) saved[key] = process.env[key]
})

afterEach(() => {
  for (const key of KEYS) {
    if (saved[key] === undefined) delete process.env[key]
    else process.env[key] = saved[key]
  }
})

describe('provider registry', () => {
  test('registers claude and gemini, in that order', () => {
    // Order is not cosmetic: defaultProvider() returns the first CONFIGURED
    // entry, so this list is the preference order a deployment inherits.
    expect(providers.allProviderNames()).toEqual(['claude', 'gemini'])
  })

  test('resolves a registered provider by name', () => {
    expect(providers.getProvider('gemini')).toBe(gemini)
    expect(providers.getProvider('claude')).toBe(anthropic)
  })

  test('returns null for a name it does not know', () => {
    expect(providers.getProvider('gpt-9')).toBeNull()
  })

  test('reports no configured providers when neither key is set', () => {
    setKeys({})
    expect(providers.configuredProviderNames()).toEqual([])
    expect(providers.hasConfiguredProvider()).toBe(false)
    expect(providers.defaultProvider()).toBeNull()
  })

  test('reports only the provider whose key is set', () => {
    setKeys({ gemini: 'g' })
    expect(providers.configuredProviderNames()).toEqual(['gemini'])
    expect(providers.hasConfiguredProvider()).toBe(true)
  })

  test('re-reads configuration on every call rather than caching it', () => {
    // The registry is a module singleton required once at server start, so a
    // cached isConfigured() would freeze whatever the environment looked like
    // during that first import.
    setKeys({})
    expect(providers.hasConfiguredProvider()).toBe(false)
    setKeys({ claude: 'a' })
    expect(providers.hasConfiguredProvider()).toBe(true)
  })

  test('defaults to claude when both are configured', () => {
    setKeys({ claude: 'a', gemini: 'g' })
    expect(providers.defaultProvider().name).toBe('claude')
  })

  test('defaults to the only configured provider, whatever its position', () => {
    // The registry order must not be mistaken for "claude is always the
    // default" — a Gemini-only deployment is fully working and gets Gemini.
    setKeys({ gemini: 'g' })
    expect(providers.defaultProvider().name).toBe('gemini')
  })
})

describe('resolveProvider', () => {
  test('takes the deployment default when the request names nothing', () => {
    setKeys({ claude: 'a', gemini: 'g' })
    expect(providers.resolveProvider().name).toBe('claude')
    expect(providers.resolveProvider('').name).toBe('claude')
  })

  test('honours an explicitly named configured provider', () => {
    setKeys({ claude: 'a', gemini: 'g' })
    expect(providers.resolveProvider('gemini').name).toBe('gemini')
  })

  test('throws rather than silently falling back to the default', () => {
    // The whole point. Running a Gemini request on Claude would attribute one
    // model's output to another in the panel's meta line and in the downloaded
    // module, which is worse than failing.
    setKeys({ claude: 'a' })
    expect(() => providers.resolveProvider('gemini')).toThrow(UnknownProviderError)
  })

  test('names what IS available, so a stale client can recover', () => {
    setKeys({ gemini: 'g' })
    try {
      providers.resolveProvider('claude')
      throw new Error('expected resolveProvider to throw')
    } catch (error) {
      expect(error).toBeInstanceOf(UnknownProviderError)
      expect(error.available).toEqual(['gemini'])
      expect(error.message).toContain('gemini')
    }
  })

  test('throws for an unregistered name even when providers are configured', () => {
    setKeys({ claude: 'a' })
    expect(() => providers.resolveProvider('gpt-9')).toThrow(UnknownProviderError)
  })

  test('throws when nothing at all is configured', () => {
    setKeys({})
    expect(() => providers.resolveProvider()).toThrow(UnknownProviderError)
  })
})

describe('provider surface', () => {
  // Guards the contract providers.js documents. A provider missing one of these
  // fails at runtime, on whichever route happens to reach it first, with an
  // error that points at the caller rather than at the omission.
  const REQUIRED = [
    'name',
    'label',
    'isConfigured',
    'getModel',
    'listModelIds',
    'normalizeUsage',
    'generateObject',
  ]

  for (const provider of providers.REGISTRY) {
    test(`${provider.name} exports the full provider surface`, () => {
      for (const field of REQUIRED) expect(provider[field]).toBeDefined()
      expect(typeof provider.name).toBe('string')
      expect(typeof provider.label).toBe('string')
    })
  }

  test('every registry entry has a distinct name', () => {
    const names = providers.allProviderNames()
    expect(new Set(names).size).toBe(names.length)
  })
})

describe('usage normalization', () => {
  test('maps anthropic counters onto the common shape', () => {
    expect(anthropic.normalizeUsage({ input_tokens: 10, output_tokens: 20 })).toEqual({
      inputTokens: 10,
      outputTokens: 20,
      totalTokens: 30,
    })
  })

  test('counts anthropic cached input tokens toward the input total', () => {
    // The API's own definition: "Total input tokens in a request is the
    // summation of input_tokens, cache_creation_input_tokens, and
    // cache_read_input_tokens." They are reported separately, not folded in.
    //
    // This is the warm-cache shape that matters here. prompts.js inlines the
    // whole vendored style corpus and marks it cache_control, so on a warm
    // request essentially the entire prompt is billed through
    // cache_read_input_tokens and input_tokens is a small remainder. Reading
    // only input_tokens reported 42 for a request that really used 18042.
    expect(
      anthropic.normalizeUsage({
        input_tokens: 42,
        cache_read_input_tokens: 18000,
        cache_creation_input_tokens: 0,
        output_tokens: 900,
      })
    ).toEqual({ inputTokens: 18042, outputTokens: 900, totalTokens: 18942 })
  })

  test('counts anthropic cache-creation tokens the same way', () => {
    // The cold half of the same request: identical billing, different counter.
    expect(
      anthropic.normalizeUsage({
        input_tokens: 42,
        cache_read_input_tokens: 0,
        cache_creation_input_tokens: 18000,
        output_tokens: 900,
      })
    ).toEqual({ inputTokens: 18042, outputTokens: 900, totalTokens: 18942 })
  })

  test('maps gemini counters onto the common shape', () => {
    expect(
      gemini.normalizeUsage({
        promptTokenCount: 11,
        candidatesTokenCount: 22,
        totalTokenCount: 40,
      })
    ).toEqual({ inputTokens: 11, outputTokens: 22, totalTokens: 40 })
  })

  test('trusts gemini totalTokenCount over input plus output', () => {
    // Gemini bills thinking tokens on top of prompt+candidates, so recomputing
    // the total understates exactly the thinking-heavy requests this feature
    // makes. 11 + 22 is 33; the real total is 40.
    const usage = gemini.normalizeUsage({
      promptTokenCount: 11,
      candidatesTokenCount: 22,
      thoughtsTokenCount: 7,
      totalTokenCount: 40,
    })
    expect(usage.totalTokens).toBe(40)
  })

  test('falls back to input plus output when gemini reports no total', () => {
    const usage = gemini.normalizeUsage({ promptTokenCount: 11, candidatesTokenCount: 22 })
    expect(usage.totalTokens).toBe(33)
  })

  test('reports zeros rather than NaN for missing usage', () => {
    // A NaN here propagates through addUsage() and poisons the whole summed
    // total, so every provider coerces before it reaches the caller.
    for (const provider of providers.REGISTRY) {
      expect(provider.normalizeUsage(undefined)).toEqual({
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
      })
    }
  })
})

describe('gemini refusal explanation', () => {
  test('lists only the safety categories that actually blocked', () => {
    const explanation = gemini.explainRefusal({
      safetyRatings: [
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', blocked: true },
        { category: 'HARM_CATEGORY_HARASSMENT', blocked: false },
      ],
    })
    expect(explanation).toBe('Blocked on HARM_CATEGORY_DANGEROUS_CONTENT.')
  })

  test('prefers finishMessage when the backend supplies one', () => {
    // Vertex populates it; the Gemini Developer API does not, which is why the
    // safetyRatings path above exists at all.
    expect(gemini.explainRefusal({ finishMessage: 'Declined.' })).toBe('Declined.')
  })

  test('returns null rather than an empty sentence when nothing is known', () => {
    expect(gemini.explainRefusal({})).toBeNull()
    expect(gemini.explainRefusal(undefined)).toBeNull()
    expect(gemini.explainRefusal({ safetyRatings: [{ category: 'X', blocked: false }] })).toBeNull()
  })

  test('treats every refusal finish reason as a refusal', () => {
    // RECITATION is deliberately absent: it means output was suppressed for
    // reproducing training data, which is a generation failure worth surfacing
    // as an error rather than telling a reviewer the model "declined".
    expect([...gemini.REFUSAL_FINISH_REASONS].sort()).toEqual([
      'BLOCKLIST',
      'PROHIBITED_CONTENT',
      'SAFETY',
      'SPII',
    ])
  })
})

describe('shared error types', () => {
  test('RefusalError carries the category and explanation to the route', () => {
    const error = new RefusalError({ category: 'cyber', explanation: 'Declined.' })
    expect(error).toBeInstanceOf(Error)
    expect(error.name).toBe('RefusalError')
    expect(error.category).toBe('cyber')
    expect(error.explanation).toBe('Declined.')
  })

  test('RefusalError nulls its fields when a provider supplies no details', () => {
    const error = new RefusalError()
    expect(error.category).toBeNull()
    expect(error.explanation).toBeNull()
  })

  test('provider-anthropic still re-exports RefusalError from its old home', () => {
    // server.ts imported it from there before it moved to errors.js. The
    // re-export is what keeps that spelling working for anything not updated.
    expect(anthropic.RefusalError).toBe(RefusalError)
  })
})

describe('gemini timeout normalization', () => {
  // The regression: @google/genai implements httpOptions.timeout as a bare
  // `abortController.abort()`, which rejects with a DOMException named
  // "AbortError" — byte-identical to the reviewer pressing Cancel.
  // aiErrorResponse matches that name and answers 499 "Generation was
  // cancelled.", so a Gemini request that ran out of time told the reviewer
  // they had cancelled it. Only the provider can still tell the two apart,
  // because only it can see whether the CALLER's signal was the one that fired.
  function abortError() {
    const controller = new AbortController()
    controller.abort()
    return controller.signal.reason
  }

  test('the SDK timeout is indistinguishable from a cancel by name alone', () => {
    // Pins the premise. If a future SDK starts aborting with a reason, this
    // fails and the normalization below can be reconsidered rather than
    // silently kept forever.
    const error = abortError()
    expect(error.name).toBe('AbortError')
    expect(error.constructor.name).toBe('DOMException')
  })

  test('raises ProviderTimeoutError when the caller never aborted', () => {
    const error = abortError()
    const signal = new AbortController().signal // never aborted
    expect(() => gemini.classifyAbort(error, signal)).toThrow(ProviderTimeoutError)
  })

  test('passes the error through untouched when the caller did abort', () => {
    // A real cancellation still has to reach the signal branches in
    // aiErrorResponse, which answer 499/504 from the route's own signals.
    // Converting this one would report a reviewer's Cancel as a 504.
    const error = abortError()
    const controller = new AbortController()
    controller.abort()
    expect(() => gemini.classifyAbort(error, controller.signal)).toThrow(error)
  })

  test('passes a non-abort error through untouched', () => {
    const error = new Error('upstream exploded')
    expect(() => gemini.classifyAbort(error, new AbortController().signal)).toThrow(error)
  })

  test('ProviderTimeoutError names the provider that ran out of time', () => {
    const error = new ProviderTimeoutError('gemini')
    expect(error).toBeInstanceOf(Error)
    expect(error.name).toBe('ProviderTimeoutError')
    expect(error.provider).toBe('gemini')
  })
})

describe('anthropic timeout normalization', () => {
  // Mirrors the gemini block above. Anthropic's SDK, unlike Gemini's, throws
  // a DISTINCTLY-named error for its own per-call deadline
  // (APIConnectionTimeoutError) rather than reusing a generic AbortError — so
  // classifyAbort here matches on constructor.name instead of a bare `name`
  // check, and the caller's signal is consulted only as the same
  // defense-in-depth check gemini's version uses, not as the sole
  // disambiguator. classifyAbort matches the SDK's error by exact
  // constructor.name (not `instanceof` — the SDK is deliberately not
  // imported here), so this fixture class is named to match the real SDK
  // class byte-for-byte rather than "Fake"-prefixed: the whole point under
  // test is the name string itself, and a prefixed name would never satisfy
  // the equality check classifyAbort actually performs.
  class APIConnectionTimeoutError extends Error {}
  class FakeAPIUserAbortError extends Error {}

  test('raises ProviderTimeoutError when the caller never aborted', () => {
    const error = new APIConnectionTimeoutError('timed out')
    const signal = new AbortController().signal // never aborted
    expect(() => anthropic.classifyAbort(error, signal)).toThrow(ProviderTimeoutError)
  })

  test('passes the error through untouched when the caller did abort', () => {
    const error = new APIConnectionTimeoutError('timed out')
    const controller = new AbortController()
    controller.abort()
    expect(() => anthropic.classifyAbort(error, controller.signal)).toThrow(error)
  })

  test('passes a non-timeout error through untouched', () => {
    const error = new FakeAPIUserAbortError('user aborted')
    expect(() => anthropic.classifyAbort(error, new AbortController().signal)).toThrow(error)
  })

  test('passes a plain Error through untouched', () => {
    const error = new Error('upstream exploded')
    expect(() => anthropic.classifyAbort(error, new AbortController().signal)).toThrow(error)
  })

  test('ProviderTimeoutError names claude as the provider that ran out of time', () => {
    const error = new APIConnectionTimeoutError('timed out')
    const signal = new AbortController().signal
    try {
      anthropic.classifyAbort(error, signal)
    } catch (thrown) {
      expect(thrown).toBeInstanceOf(ProviderTimeoutError)
      expect(thrown.provider).toBe('claude')
    }
  })
})

describe('request schema provider enum', () => {
  test('accepts every registered provider name', () => {
    // The contract providers.js states: adding a provider is "a require plus a
    // line in REGISTRY; nothing downstream of here mentions a provider by
    // name." A second hardcoded list here would let capabilities advertise a
    // provider the schema then rejects as malformed.
    for (const name of providers.allProviderNames()) {
      const result = generateRequestSchema.safeParse({
        task: 'content',
        prompt: 'x',
        provider: name,
      })
      expect(result.success).toBe(true)
    }
  })

  test('rejects a name no registered provider answers to', () => {
    const result = generateRequestSchema.safeParse({
      task: 'content',
      prompt: 'x',
      provider: 'not-a-provider',
    })
    expect(result.success).toBe(false)
  })

  test('derives its accepted values from the registry rather than a literal list', () => {
    // Asserted structurally, so the test keeps its meaning when a third
    // provider lands: whatever REGISTRY holds is exactly what the enum accepts.
    // generateRequestSchema is a discriminated union; extract provider enum from
    // the first union branch (they're identical across all branches).
    const contentBranch = generateRequestSchema.options[0]
    const accepted = contentBranch.shape.provider.unwrap().options
    expect([...accepted].sort()).toEqual([...providers.allProviderNames()].sort())
  })
})

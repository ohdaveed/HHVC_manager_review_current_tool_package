// Tests for build_scripts/ai/env.js — the numeric env-var parser shared by
// server.ts and build_scripts/ai/provider-anthropic.js.
//
// This helper exists because a mistyped tunable used to reach its consumer
// unexamined, and the consumers here are unforgiving: `AbortSignal.timeout()`
// throws a TypeError on NaN and on anything past Number.MAX_SAFE_INTEGER, and
// the call sites are outside the generate route's try block — so a bad value
// is not a degraded setting, it is a 500 on every single generation. The tests
// below therefore assert the RANGE CONTRACT as well as the parsing: whatever
// numberFromEnv returns must be a value AbortSignal.timeout() will accept.

import { describe, test, expect, afterEach } from 'bun:test'
import { numberFromEnv } from '../build_scripts/ai/env.js'

const VAR = 'HHVC_TEST_NUMERIC_ENV'

// Stubbing process.env leaks into sibling test files if it isn't undone.
afterEach(() => {
  delete process.env[VAR]
})

describe('numberFromEnv', () => {
  test('returns the fallback when the variable is unset', () => {
    expect(numberFromEnv(VAR, 240_000)).toBe(240_000)
  })

  test('returns the fallback when the variable is set but empty', () => {
    // Set-but-empty is trivially common in CI matrices and container
    // manifests, and `??` would let it through as the string ''.
    process.env[VAR] = ''
    expect(numberFromEnv(VAR, 240_000)).toBe(240_000)
  })

  test('parses a well-formed value', () => {
    process.env[VAR] = '5000'
    expect(numberFromEnv(VAR, 240_000)).toBe(5000)
  })

  test('rejects a typo that parses to NaN', () => {
    process.env[VAR] = '240_000'
    expect(numberFromEnv(VAR, 240_000)).toBe(240_000)
  })

  test('rejects Infinity', () => {
    process.env[VAR] = 'Infinity'
    expect(numberFromEnv(VAR, 240_000)).toBe(240_000)
  })

  test('rejects a value below the default minimum of 1', () => {
    process.env[VAR] = '0'
    expect(numberFromEnv(VAR, 240_000)).toBe(240_000)
  })

  test('accepts zero when min is 0', () => {
    // ANTHROPIC_MAX_RETRIES=0 is a documented, supported choice.
    process.env[VAR] = '0'
    expect(numberFromEnv(VAR, 1, { min: 0 })).toBe(0)
  })

  test('rejects a fractional value', () => {
    // A fractional millisecond or a fractional retry count is never what
    // anyone meant, so accepting it would hide the typo that produced it.
    process.env[VAR] = '150.5'
    expect(numberFromEnv(VAR, 240_000)).toBe(240_000)
  })

  test('rejects a finite value past Number.MAX_SAFE_INTEGER', () => {
    // The regression case. This value is finite, so the old `Number.isFinite`
    // check accepted it, and AbortSignal.timeout() then threw a TypeError
    // before the route could catch anything.
    process.env[VAR] = '100000000000000000000'
    expect(numberFromEnv(VAR, 240_000)).toBe(240_000)
  })

  test('rejects a value above an explicit max', () => {
    process.env[VAR] = '7200000'
    expect(numberFromEnv(VAR, 240_000, { max: 3_600_000 })).toBe(240_000)
  })

  test('accepts a value exactly at an explicit max', () => {
    process.env[VAR] = '3600000'
    expect(numberFromEnv(VAR, 240_000, { max: 3_600_000 })).toBe(3_600_000)
  })

  test('returns a value inside AbortSignal.timeout range for every hostile input', () => {
    // The contract that actually matters: AbortSignal.timeout() accepts
    // [0, Number.MAX_SAFE_INTEGER] and throws a TypeError outside it. Each of
    // these inputs is one that made it throw.
    //
    // Asserted against the documented RANGE rather than by calling
    // AbortSignal.timeout() itself, which in this suite would be a false pass
    // twice over. tests/helpers/browser-env.js installs a happy-dom global
    // environment, so the AbortSignal here is happy-dom's shim rather than the
    // Bun one server.ts actually runs against — and that shim defers the work
    // into a setTimeout callback, so the range error surfaces asynchronously
    // and `expect(...).not.toThrow()` sails past it. Verified: wrapping
    // `AbortSignal.timeout(1e20)` that way passes green under this preload
    // while printing the TypeError's stack to the console.
    const hostile = ['100000000000000000000', 'Infinity', 'not-a-number', '1e400', '-1', '1.5']
    for (const raw of hostile) {
      process.env[VAR] = raw
      const value = numberFromEnv(VAR, 240_000, { max: 3_600_000 })
      expect(Number.isSafeInteger(value)).toBe(true)
      expect(value).toBeGreaterThanOrEqual(0)
    }
  })
})

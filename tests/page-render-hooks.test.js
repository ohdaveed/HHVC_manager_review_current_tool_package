/**
 * The post-render hook registry.
 *
 * **Why this replaced a monkey-patch.** js/review/ux-improvements.js used to
 * reassign window.renderPage to a wrapper that called the original and then
 * refreshed. That worked, and it forced renderPage onto the global — which
 * measurement showed was responsible for 24 of the 24-plus edges binding the
 * one 16-file dependency cycle in this codebase. A registry inverts it:
 * page-render.js calls back into code it does not import, and every subscriber
 * depends on page-render rather than the reverse.
 *
 * A registry rather than a custom event, deliberately. An event name is a
 * string, so a typo unsubscribes silently and nothing fails — and silent
 * under-coverage is the failure this repo has now hit four separate times.
 */
import { describe, expect, test } from 'bun:test'
import { onAfterRender, runAfterRenderHooks } from '../js/mockup/page-render.js'

describe('onAfterRender', () => {
  test('runs a registered hook with the page key that was rendered', () => {
    const seen = []
    const off = onAfterRender((key) => seen.push(key))
    runAfterRenderHooks('pestsTopic')
    off()
    expect(seen).toEqual(['pestsTopic'])
  })

  test('runs hooks in registration order', () => {
    const order = []
    const a = onAfterRender(() => order.push('a'))
    const b = onAfterRender(() => order.push('b'))
    runAfterRenderHooks('pestsTopic')
    a()
    b()
    expect(order).toEqual(['a', 'b'])
  })

  test('a throwing hook does not prevent the next one', () => {
    const seen = []
    const a = onAfterRender(() => {
      throw new Error('hook blew up')
    })
    const b = onAfterRender(() => seen.push('b ran'))
    runAfterRenderHooks('pestsTopic')
    a()
    b()
    expect(seen).toEqual(['b ran'])
  })

  test('the unsubscribe function stops that hook and leaves others', () => {
    const seen = []
    const off = onAfterRender(() => seen.push('gone'))
    const keep = onAfterRender(() => seen.push('kept'))
    off()
    runAfterRenderHooks('pestsTopic')
    keep()
    expect(seen).toEqual(['kept'])
  })
})

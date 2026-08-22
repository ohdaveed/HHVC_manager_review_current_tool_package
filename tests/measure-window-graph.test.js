/**
 * The window-graph measurement script.
 *
 * **What is worth testing here, and what is not.** The numbers this script
 * prints are not assertable — they change with every file added to `js/`, and
 * `docs/superpowers/specs/2026-08-19-module-coherence-measurement.md` records
 * at length what happens when a measurement's methodology is lost and only its
 * output survives. So these tests pin the PARSING DECISIONS the numbers rest
 * on, against hand-built sources, exactly the way `card-inheritance` and
 * `karl-transcript` are driven with hand-built pages rather than the real
 * corpus: a legitimately added module must never fail this suite.
 *
 * Each case below is a way the count could be silently wrong rather than
 * loudly broken — a scanner that stops recognizing a publish does not throw,
 * it just reports a smaller graph, which reads exactly like progress.
 */
import { describe, expect, test } from 'bun:test'
import {
  buildGraph,
  findPublishes,
  findReferences,
  functionDepthAt,
  stripNonCode,
  stronglyConnectedComponents,
} from '../build_scripts/measure-window-graph.js'

describe('stripNonCode', () => {
  test('blanks a line comment so prose mentioning window.X is not an edge', () => {
    const code = stripNonCode('// see window.ReviewUx for this\nconst a = 1')
    expect(code).not.toContain('window.ReviewUx')
    expect(code).toContain('const a = 1')
  })

  test('blanks a block comment, which is where this repo puts its rationale', () => {
    const code = stripNonCode('/* window.renderPage is wrapped here */\nlet x')
    expect(code).not.toContain('window.renderPage')
    expect(code).toContain('let x')
  })

  test('blanks single- and double-quoted string bodies', () => {
    const code = stripNonCode(`const a = 'window.utils'\nconst b = "window.utils"`)
    expect(code).not.toContain('window.utils')
  })

  test('preserves indices so a reported position still lines up with the source', () => {
    const source = '// pad\nwindow.ReviewUx.init()'
    const code = stripNonCode(source)
    expect(code.length).toBe(source.length)
    expect(code.indexOf('window.ReviewUx')).toBe(source.indexOf('window.ReviewUx'))
  })

  test('keeps code inside a template interpolation but drops the literal text', () => {
    // This repo builds most of its HTML in template literals, so a reference
    // inside ${...} is a real reference; the surrounding markup is not.
    const code = stripNonCode('const html = `<p>window.NotReal</p>${window.utils.escapeHtml(x)}`')
    expect(code).not.toContain('window.NotReal')
    expect(code).toContain('window.utils.escapeHtml')
  })
})

describe('findPublishes', () => {
  test('counts a bare assignment', () => {
    expect([...findPublishes('window.ReviewUx = {}')]).toEqual(['ReviewUx'])
  })

  test('counts a nested assignment, which is how sub-modules attach', () => {
    expect([...findPublishes('window.ReviewUx.stateSync = api')]).toEqual(['ReviewUx'])
  })

  test('counts the idempotent guard idiom this repo mandates', () => {
    expect([...findPublishes('window.AiAssist = window.AiAssist || {}')]).toEqual(['AiAssist'])
  })

  test('does NOT count a comparison as a publish', () => {
    // `window.x === y` and `window.x == y` both end in `=`; a naive pattern
    // reads them as assignments and invents a publisher, which would make the
    // reader its own dependency and quietly shrink the graph.
    expect([...findPublishes('if (window.renderPage === original) {}')]).toEqual([])
    expect([...findPublishes('if (window.renderPage == null) {}')]).toEqual([])
  })
})

describe('findReferences', () => {
  test('separates a read from a publish of the same namespace in one file', () => {
    const refs = findReferences('window.utils = api\nconst { escapeHtml } = window.utils')
    expect(refs.map((r) => r.isPublish)).toEqual([true, false])
  })

  test('an optional call is a read', () => {
    const refs = findReferences('window.renderPage?.(key)')
    expect(refs).toHaveLength(1)
    expect(refs[0].isPublish).toBe(false)
  })
})

describe('functionDepthAt', () => {
  test('a top-level read is mount-time', () => {
    const src = 'const DATA = window.HHVC_DATA'
    expect(functionDepthAt(src)(src.indexOf('window'))).toBe(0)
  })

  test('a read inside a function body is call-time', () => {
    const src = 'function refresh() {\n  return window.HHVC_DATA\n}'
    expect(functionDepthAt(src)(src.indexOf('window'))).toBeGreaterThan(0)
  })

  test('a file-level IIFE wrapper is transparent, so its mount body stays mount-time', () => {
    // The distinction the whole mount-time/call-time split rests on: 31 of the
    // files in js/ are `;(function mountX(){ ... })()`, and counting that
    // wrapper would report every one of their mount bodies as call-time —
    // turning the one genuinely hazardous class into the empty set.
    const src = ';(function mountX() {\n  const DATA = window.HHVC_DATA\n})()'
    expect(functionDepthAt(src)(src.indexOf('window'))).toBe(0)
  })
})

describe('buildGraph', () => {
  const files = [
    { path: 'fixture/a.js', source: 'window.Alpha = {}\nfunction go() { return window.Beta.x }' },
    { path: 'fixture/b.js', source: 'window.Beta = {}\nconst boot = window.Alpha' },
    { path: 'fixture/c.js', source: 'const unused = 1' },
  ]

  test('an edge runs from the reader to the publisher', () => {
    const { edges } = buildGraph(files)
    expect(edges.find((e) => e.namespace === 'Beta')).toMatchObject({
      from: 'fixture/a.js',
      to: 'fixture/b.js',
    })
  })

  test('reading a namespace nobody publishes is not an edge', () => {
    const { edges } = buildGraph([{ path: 'fixture/x.js', source: 'window.NotPublished.go()' }])
    expect(edges).toEqual([])
  })

  test('a file reading its own published namespace is not a self-edge', () => {
    const { edges } = buildGraph([{ path: 'fixture/x.js', source: 'window.X = {}\nwindow.X.go()' }])
    expect(edges).toEqual([])
  })

  test('repeated reads of one namespace collapse to a single edge', () => {
    // The distinction between a dependency and its mention count. Counting
    // occurrences reported 786 "edges" for a graph with 239 file pairs.
    const { edges } = buildGraph([
      { path: 'fixture/p.js', source: 'window.P = {}' },
      {
        path: 'fixture/q.js',
        source: 'function a(){ window.P.x() }\nfunction b(){ window.P.y() }',
      },
    ])
    expect(edges).toHaveLength(1)
    expect(edges[0].occurrences).toBe(2)
  })

  test('an edge read at mount time anywhere is classified mount-time', () => {
    // The hazard is asymmetric: one import-time read is enough to expose the
    // TDZ, however many safe call-time reads sit beside it.
    const { edges } = buildGraph([
      { path: 'fixture/p.js', source: 'window.P = {}' },
      { path: 'fixture/q.js', source: 'function a(){ window.P.x() }\nconst boot = window.P' },
    ])
    expect(edges[0].bindingTime).toBe('mount')
  })
})

describe('stronglyConnectedComponents', () => {
  const adjacency = (pairs) => {
    const map = new Map()
    for (const [from, to] of pairs) {
      if (!map.has(from)) map.set(from, new Set())
      map.get(from).add(to)
    }
    return map
  }

  test('finds a two-node cycle', () => {
    const scc = stronglyConnectedComponents(
      ['a', 'b'],
      adjacency([
        ['a', 'b'],
        ['b', 'a'],
      ])
    )
    expect(scc).toEqual([['a', 'b']])
  })

  test('ignores a component of one, so a plain chain reports no cycle', () => {
    const scc = stronglyConnectedComponents(
      ['a', 'b', 'c'],
      adjacency([
        ['a', 'b'],
        ['b', 'c'],
      ])
    )
    expect(scc).toEqual([])
  })

  test('a self-loop alone is not reported as a component', () => {
    expect(stronglyConnectedComponents(['a'], adjacency([['a', 'a']]))).toEqual([])
  })

  test('returns components largest first', () => {
    const scc = stronglyConnectedComponents(
      ['a', 'b', 'c', 'd', 'e'],
      adjacency([
        ['a', 'b'],
        ['b', 'c'],
        ['c', 'a'],
        ['d', 'e'],
        ['e', 'd'],
      ])
    )
    expect(scc.map((c) => c.length)).toEqual([3, 2])
  })
})

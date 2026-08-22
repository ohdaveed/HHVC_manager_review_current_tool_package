/**
 * Measure the `window.<Namespace>` dependency graph across `js/`.
 *
 * **Why this exists.** `docs/superpowers/specs/2026-08-19-module-coherence-measurement.md`
 * states that every number in it "was derived by script from the tree, not
 * estimated" — but no such script was ever committed. Its figures are the
 * entire justification for the module-coherence conversion (most pointedly:
 * `window.renderPage` accounting for 24 of the edges binding the one 16-file
 * strongly connected component), and a number nobody can re-derive is a number
 * nobody can check. This script makes those claims reproducible, so a later
 * reader can re-run the measurement instead of taking the document's word for
 * it.
 *
 * **What an edge means here.** File A depends on file B when A *reads* a
 * `window.<name>` that B *publishes*. That is the dependency ES modules would
 * make explicit and dependency-cruiser cannot see — `lint:architecture`
 * follows static imports only, so this graph and that one answer different
 * questions and neither substitutes for the other.
 *
 * **This is deliberately a lexical scanner, not a parser.** It strips comments
 * and string bodies and then matches `window.<name>` textually. That choice
 * follows the same reasoning as `tests/module-paths.test.js`: a dumb check
 * whose limits are written down beats a clever one whose failures are silent,
 * and adding a parser dependency to the tree for a diagnostic would be a real
 * cost for a marginal gain. The limits it buys are stated in LIMITS below and
 * printed with `--verbose`, because a measurement that hides its own error
 * bars is what produced the uncheckable numbers in the first place.
 *
 * Usage:
 *   bun build_scripts/measure-window-graph.js [--ref <git-ref>] [--json] [--verbose]
 *
 * With no `--ref` it measures the working tree (tracked files only). With one
 * it measures that commit, which is how a before/after comparison is made:
 *
 *   bun build_scripts/measure-window-graph.js --ref 1ba718e   # the doc's baseline
 *   bun build_scripts/measure-window-graph.js --ref origin/main
 */

const { execFileSync } = require('node:child_process')

/**
 * Known limits of the lexical approach, printed under `--verbose`.
 *
 * Each of these is a case where the count can be wrong. They are listed rather
 * than fixed because fixing them means adopting a parser, and the numbers this
 * script exists to check are order-of-magnitude claims about which namespace
 * dominates a cycle — not figures that turn on a single edge.
 */
const LIMITS = [
  'A `window.x` inside a template-literal ${...} IS counted; one inside the literal text is not.',
  'Dynamic access (window[name]) is invisible — no such call site exists in js/ today.',
  'A namespace published in two files attributes the edge to BOTH publishers.',
  'Mount-time vs call-time is decided by lexical function nesting, treating a file-level IIFE wrapper as transparent. A read inside a callback passed to a mount-time call reads as call-time.',
]

/**
 * Read the tracked `js/` source files at a ref, or from the working tree.
 *
 * @param {string|null} ref git ref to read, or null for the working tree
 * @returns {Array<{path: string, source: string}>}
 */
function collectFiles(ref) {
  const listArgs = ref
    ? ['ls-tree', '-r', '--name-only', ref, '--', 'js']
    : ['ls-files', '--', 'js']
  const paths = execFileSync('git', listArgs, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /\.(js|jsx|mjs)$/.test(line))

  return paths.map((path) => ({
    path,
    source: ref
      ? execFileSync('git', ['show', `${ref}:${path}`], {
          encoding: 'utf8',
          maxBuffer: 64 * 1024 * 1024,
        })
      : require('node:fs').readFileSync(path, 'utf8'),
  }))
}

/**
 * Blank out comments and string bodies so `window.x` in prose is not counted.
 *
 * Replaces each stripped character with a space rather than deleting it, so
 * every surviving index still matches the original source — the caller reports
 * line numbers off this string.
 *
 * Template literals keep their `${...}` interpolations, which is where this
 * codebase puts real expressions; only the literal text between them is blanked.
 *
 * @param {string} src raw file contents
 * @returns {string} same length, with comments and string bodies blanked
 */
function stripNonCode(src) {
  const out = src.split('')
  const blank = (at) => {
    if (out[at] !== '\n') out[at] = ' '
  }

  // A mode stack rather than an ad-hoc `${}` brace counter. The counter version
  // was not lexical-state aware, which cost two real defects: `${'window.X'}`
  // kept a reference that is only a string, and a `}` inside a quoted string
  // inside an interpolation ended the scan early, blanking real code after it.
  // Interpolations nest arbitrarily (a template inside a `${}` inside a
  // template), so the contents of `${...}` go back through this same loop.
  const stack = [{ kind: 'code', depth: 0 }]
  let i = 0

  while (i < src.length) {
    const top = stack[stack.length - 1]
    const ch = src[i]
    const next = src[i + 1]

    if (top.kind === 'template') {
      if (ch === '\\') {
        blank(i++)
        blank(i++)
        continue
      }
      if (ch === '`') {
        stack.pop()
        i++
        continue
      }
      if (ch === '$' && next === '{') {
        stack.push({ kind: 'code', depth: 0 })
        i += 2
        continue
      }
      blank(i++)
      continue
    }

    if (ch === '/' && next === '/') {
      while (i < src.length && src[i] !== '\n') blank(i++)
      continue
    }
    if (ch === '/' && next === '*') {
      blank(i++)
      blank(i++)
      while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) blank(i++)
      blank(i++)
      blank(i++)
      continue
    }
    if (ch === "'" || ch === '"') {
      const quote = ch
      i++
      while (i < src.length && src[i] !== quote) {
        if (src[i] === '\\') blank(i++)
        if (i < src.length) blank(i++)
      }
      i++
      continue
    }
    if (ch === '`') {
      stack.push({ kind: 'template' })
      i++
      continue
    }
    if (ch === '{') {
      top.depth++
      i++
      continue
    }
    if (ch === '}') {
      // Closing an interpolation returns to the template that opened it; a
      // plain block just decrements. Only the innermost code frame can close
      // an interpolation, and only at its own depth 0.
      if (top.depth === 0 && stack.length > 1) {
        stack.pop()
        i++
        continue
      }
      top.depth--
      i++
      continue
    }
    i++
  }
  return out.join('')
}

/**
 * Namespaces a file publishes, e.g. `window.ReviewUx = ...` or `window.utils.x = ...`.
 *
 * @param {string} code stripped source
 * @returns {Set<string>}
 */
function findPublishes(code) {
  const published = new Set()
  // `window.Name =` and `window.Name.sub =`, but not `window.Name ==`/`===`.
  const re = /\bwindow\.([A-Za-z_$][\w$]*)(?:\.[\w$]+)*\s*(?:\|\|=|\?\?=|=)(?!=)/g
  let match
  while ((match = re.exec(code)) !== null) published.add(match[1])
  return published
}

/**
 * Every `window.<name>` occurrence, with its index and whether it is a publish.
 *
 * @param {string} code stripped source
 * @returns {Array<{name: string, index: number, isPublish: boolean}>}
 */
function findReferences(code) {
  const refs = []
  const re = /\bwindow\.([A-Za-z_$][\w$]*)/g
  let match
  while ((match = re.exec(code)) !== null) {
    const after = code.slice(match.index + match[0].length)
    const isPublish = /^(?:\.[\w$]+)*\s*(?:\|\|=|\?\?=|=)(?!=)/.test(after)
    refs.push({ name: match[1], index: match.index, isPublish })
  }
  return refs
}

/**
 * Decide, for each character index, how deeply nested in function bodies it is.
 *
 * A file-level IIFE wrapper is treated as transparent (depth 0 inside it),
 * because its body runs at module-evaluation time — that is the whole point of
 * the mount-time/call-time split, and counting the wrapper would classify
 * every self-mounting subsystem's mount body as call-time.
 *
 * @param {string} code stripped source
 * @returns {(index: number) => number} function-nesting depth at an index
 */
function functionDepthAt(code) {
  // Spans of [start, end) that are inside SOME function body.
  const spans = []
  // Brace frames: each records whether it opened a function body, and whether
  // that function is the transparent file-level IIFE wrapper.
  const braces = []
  // Open expression-bodied arrows, awaiting the end of their expression.
  const arrows = []

  const CONTROL = new Set(['if', 'for', 'while', 'switch', 'catch', 'with', 'do', 'else', 'try'])

  const skipBackWs = (at) => {
    let j = at
    while (j >= 0 && /\s/.test(code[j])) j--
    return j
  }

  /** Read the identifier ending at `at`, or '' if there isn't one. */
  const identEndingAt = (at) => {
    let j = at
    while (j >= 0 && /[\w$]/.test(code[j])) j--
    return code.slice(j + 1, at + 1)
  }

  /** Index of the `(` matching the `)` at `at`, or -1. */
  const matchParenBack = (at) => {
    let depth = 0
    for (let j = at; j >= 0; j--) {
      if (code[j] === ')') depth++
      else if (code[j] === '(') {
        depth--
        if (depth === 0) return j
      }
    }
    return -1
  }

  /**
   * Does the `{` at `at` open a function body?
   *
   * Covers every form this codebase actually uses: `function f() {}`,
   * `() => {}`, and — the case the first version missed — METHOD SYNTAX
   * (`foo() {}`, `constructor() {}`, `get x() {}`, `async foo() {}`), which has
   * no `function` keyword at all. Missing it classified every read inside a
   * class or object method as mount-time, which is exactly backwards: those are
   * the reads ES modules handle safely.
   *
   * @returns {{isFunction: boolean, transparent: boolean}}
   */
  const classifyBrace = (at) => {
    const p = skipBackWs(at - 1)
    if (p < 0) return { isFunction: false, transparent: false }

    // `=> {`
    if (code[p] === '>' && code[p - 1] === '=') return { isFunction: true, transparent: false }

    // `) {` — a parameter list, unless it belongs to a control statement.
    if (code[p] === ')') {
      const open = matchParenBack(p)
      if (open === -1) return { isFunction: false, transparent: false }
      const before = skipBackWs(open - 1)
      const ident = identEndingAt(before)
      if (CONTROL.has(ident)) return { isFunction: false, transparent: false }
      // `(function name() {` / `(function () {` — the repo's named-IIFE idiom,
      // whose body runs at module-evaluation time and so must stay mount-time.
      // Walk back past the name to find the `function` keyword and then the
      // `(` that wraps it.
      let k = before
      let word = identEndingAt(k)
      if (word && word !== 'function') {
        k = skipBackWs(k - word.length)
        word = identEndingAt(k)
      }
      if (word === 'function') {
        const q = skipBackWs(k - word.length)
        if (code[q] === '(') return { isFunction: true, transparent: true }
      }
      return { isFunction: true, transparent: false }
    }
    return { isFunction: false, transparent: false }
  }

  for (let i = 0; i < code.length; i++) {
    const ch = code[i]

    // An expression-bodied arrow — `const read = () => window.X` — opens a
    // function scope with no brace at all. It was being counted as mount-time,
    // which is wrong for the same reason method bodies were.
    if (ch === '=' && code[i + 1] === '>') {
      const after = skipBackWs === null ? i + 2 : i + 2
      let j = after
      while (j < code.length && /\s/.test(code[j])) j++
      if (code[j] !== '{') {
        arrows.push({ start: i, braceDepth: braces.length, parenDepth: 0 })
      }
      i++
      continue
    }

    if (ch === '(' || ch === '[') {
      for (const a of arrows) a.parenDepth++
      continue
    }
    if (ch === ')' || ch === ']') {
      for (let k = arrows.length - 1; k >= 0; k--) {
        if (arrows[k].parenDepth === 0 && arrows[k].braceDepth === braces.length) {
          spans.push([arrows[k].start, i])
          arrows.splice(k, 1)
        } else {
          arrows[k].parenDepth--
        }
      }
      continue
    }
    // `,` and `;` end an expression-bodied arrow at the same nesting level.
    if (ch === ',' || ch === ';') {
      for (let k = arrows.length - 1; k >= 0; k--) {
        if (arrows[k].parenDepth === 0 && arrows[k].braceDepth === braces.length) {
          spans.push([arrows[k].start, i])
          arrows.splice(k, 1)
        }
      }
      continue
    }

    if (ch === '{') {
      const { isFunction, transparent } = classifyBrace(i)
      braces.push({ open: i, isFunction, transparent })
      continue
    }
    if (ch === '}') {
      // Any arrow still open inside this block ends with it.
      for (let k = arrows.length - 1; k >= 0; k--) {
        if (arrows[k].braceDepth >= braces.length) {
          spans.push([arrows[k].start, i])
          arrows.splice(k, 1)
        }
      }
      const frame = braces.pop()
      if (frame && frame.isFunction && !frame.transparent) spans.push([frame.open, i])
      continue
    }
  }

  // Anything still open runs to the end of the file.
  for (const a of arrows) spans.push([a.start, code.length])

  return (index) => spans.filter(([open, close]) => index > open && index < close).length
}

/**
 * Build the window graph for one tree.
 *
 * @param {Array<{path: string, source: string}>} files
 * @returns {object} nodes, edges, publishers and IIFE count
 */
function buildGraph(files) {
  const publishers = new Map() // namespace -> Set<path>
  const prepared = files.map((file) => {
    const code = stripNonCode(file.source)
    const published = findPublishes(code)
    for (const name of published) {
      if (!publishers.has(name)) publishers.set(name, new Set())
      publishers.get(name).add(file.path)
    }
    return { ...file, code, published }
  })

  const iifeCount = prepared.filter((f) => /;\(function\s+[\w$]*\s*\(/.test(f.code)).length

  // An edge is a DISTINCT (from, to, namespace) triple, not one per textual
  // occurrence: `js/review/review-queue.js` naming `window.ReviewUx` in eleven
  // places is one dependency, not eleven. Occurrences are counted separately
  // because the ratio is the useful diagnostic — a namespace read once is a
  // different conversion job from one read forty times.
  const edgeMap = new Map()
  let occurrences = 0
  for (const file of prepared) {
    const depthAt = functionDepthAt(file.code)
    for (const ref of findReferences(file.code)) {
      if (ref.isPublish) continue
      const owners = publishers.get(ref.name)
      if (!owners) continue
      occurrences++
      const bindingTime = depthAt(ref.index) > 0 ? 'call' : 'mount'
      for (const owner of owners) {
        if (owner === file.path) continue
        const id = `${file.path} ${owner} ${ref.name}`
        const existing = edgeMap.get(id)
        if (existing) {
          // Mount-time wins: if a namespace is read even once at
          // module-evaluation time, that edge carries the TDZ hazard whatever
          // the other reads do.
          if (bindingTime === 'mount') existing.bindingTime = 'mount'
          existing.occurrences++
          continue
        }
        edgeMap.set(id, {
          from: file.path,
          to: owner,
          namespace: ref.name,
          bindingTime,
          occurrences: 1,
        })
      }
    }
  }

  return { files: prepared, publishers, edges: [...edgeMap.values()], occurrences, iifeCount }
}

/**
 * Tarjan's strongly-connected components.
 *
 * @param {Array<string>} nodes
 * @param {Map<string, Set<string>>} adjacency
 * @returns {Array<Array<string>>} components of size > 1
 */
function stronglyConnectedComponents(nodes, adjacency) {
  const index = new Map()
  const low = new Map()
  const onStack = new Set()
  const stack = []
  const found = []
  let counter = 0

  function visit(v) {
    index.set(v, counter)
    low.set(v, counter)
    counter++
    stack.push(v)
    onStack.add(v)

    for (const w of adjacency.get(v) ?? []) {
      if (!index.has(w)) {
        visit(w)
        low.set(v, Math.min(low.get(v), low.get(w)))
      } else if (onStack.has(w)) {
        low.set(v, Math.min(low.get(v), index.get(w)))
      }
    }

    if (low.get(v) === index.get(v)) {
      const component = []
      let w
      do {
        w = stack.pop()
        onStack.delete(w)
        component.push(w)
      } while (w !== v)
      if (component.length > 1) found.push(component.sort())
    }
  }

  for (const node of nodes) if (!index.has(node)) visit(node)
  return found.sort((a, b) => b.length - a.length)
}

/**
 * Produce the report object for one tree.
 *
 * @param {string|null} ref
 * @returns {object}
 */
function measure(ref) {
  const files = collectFiles(ref)
  const { publishers, edges, occurrences, iifeCount } = buildGraph(files)

  const adjacency = new Map()
  for (const file of files) adjacency.set(file.path, new Set())
  for (const edge of edges) adjacency.get(edge.from).add(edge.to)

  const sccs = stronglyConnectedComponents(
    files.map((f) => f.path),
    adjacency
  )
  const largest = sccs[0] ?? []
  const inLargest = new Set(largest)

  const intraSccByNamespace = new Map()
  for (const edge of edges) {
    if (!inLargest.has(edge.from) || !inLargest.has(edge.to)) continue
    intraSccByNamespace.set(edge.namespace, (intraSccByNamespace.get(edge.namespace) ?? 0) + 1)
  }

  return {
    ref: ref ?? '(working tree)',
    fileCount: files.length,
    namespaceCount: publishers.size,
    edgeCount: edges.length,
    occurrenceCount: occurrences,
    uniqueEdgeCount: new Set(edges.map((e) => `${e.from} ${e.to}`)).size,
    iifeCount,
    mountTimeEdges: edges.filter((e) => e.bindingTime === 'mount').length,
    callTimeEdges: edges.filter((e) => e.bindingTime === 'call').length,
    sccCount: sccs.length,
    largestScc: largest,
    intraSccByNamespace: [...intraSccByNamespace.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([namespace, count]) => ({ namespace, count })),
  }
}

/**
 * Render a report as text.
 *
 * @param {object} report
 * @param {boolean} verbose
 * @returns {string}
 */
function format(report, verbose) {
  const lines = []
  lines.push(`window graph @ ${report.ref}`)
  lines.push(`  js/ files                 ${report.fileCount}`)
  lines.push(`  namespaces on window      ${report.namespaceCount}`)
  lines.push(
    `  edges                     ${report.edgeCount} (${report.uniqueEdgeCount} file pairs, ${report.occurrenceCount} occurrences)`
  )
  lines.push(`    mount-time              ${report.mountTimeEdges}`)
  lines.push(`    call-time               ${report.callTimeEdges}`)
  lines.push(`  self-mounting IIFEs       ${report.iifeCount}`)
  lines.push(`  SCCs (size > 1)           ${report.sccCount}`)
  lines.push(`  largest SCC               ${report.largestScc.length} files`)

  if (report.largestScc.length > 0) {
    lines.push('')
    lines.push('  the SCC:')
    for (const path of report.largestScc) lines.push(`    ${path.replace(/^js\//, '')}`)
    lines.push('')
    lines.push('  intra-SCC edges by namespace:')
    for (const { namespace, count } of report.intraSccByNamespace) {
      lines.push(`    ${String(count).padStart(4)}  window.${namespace}`)
    }
  }

  if (verbose) {
    lines.push('')
    lines.push('  known limits of this measurement:')
    for (const limit of LIMITS) lines.push(`    - ${limit}`)
  }
  return lines.join('\n')
}

function main() {
  const args = process.argv.slice(2)
  const refIndex = args.indexOf('--ref')
  const ref = refIndex === -1 ? null : args[refIndex + 1]
  const report = measure(ref)

  if (args.includes('--json')) {
    process.stdout.write(JSON.stringify(report, null, 2) + '\n')
    return
  }
  process.stdout.write(format(report, args.includes('--verbose')) + '\n')
}

if (require.main === module) main()

module.exports = {
  buildGraph,
  collectFiles,
  findPublishes,
  findReferences,
  functionDepthAt,
  measure,
  stripNonCode,
  stronglyConnectedComponents,
}

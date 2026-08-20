// Fail when a branch restores a version of a file that the base branch has
// already moved past.
//
// WHY THIS EXISTS, and why the existing gates cannot cover it.
//
// GitHub's "require branches to be up to date before merging" (`strict: true`
// on the branch protection rule) is a check on the COMMIT GRAPH, not on
// content: it asks whether the base branch is reachable from the PR head. A
// branch that MERGES the base and then reverts the merged content satisfies it
// completely. Every other gate in this repo — format:check, validate, the unit
// suite, Playwright — asks only "is this branch internally consistent?", and a
// wholesale revert is perfectly self-consistent. So a PR could pass every
// check while silently undoing shipped work, and one nearly did:
//
//   PR #169's branch contained both #170's and #173's commits as ancestors,
//   while its content had railway.json back at `build:netlify` (a script #170
//   deleted), the workshop page back at the embedded mock form, and 74 lines
//   of tests removed. 36 files, +140/-238 against main. All checks green.
//
// The detection here is deliberately BLOB-EXACT rather than heuristic. For
// each file the branch changes relative to the base tip, it asks: is this
// branch's version byte-identical to some OLDER version of the same path in
// the base branch's own history? A file that matches a superseded revision
// exactly is not "a different approach" — it is that earlier revision,
// restored. That keeps false positives near zero: independently rewriting a
// file into a byte-exact copy of a previous revision essentially only happens
// when reverting, and when it does happen, calling it a revert is correct.
//
// WHAT THIS DOES NOT CATCH, stated so nobody reads it as broader than it is:
// a PARTIAL revert (some hunks reverted, the file not restored wholesale) has
// no byte-exact match and passes. This is a tripwire for the wholesale case —
// the one automation produces and the one that costs whole PRs — not a general
// "does this undo anything" analysis, which cannot be made reliable enough to
// gate on.
//
// Escape hatch: a genuine, intended revert is a normal thing to want. Put
// `[allow-revert]` in any commit message on the branch, or set
// ALLOW_REVERT=1, and this exits 0 while still printing what it found.
//
// Node-side CommonJS like everything else under build_scripts/ (server.ts
// named-imports from here, and that is the supported direction).

const { execFileSync } = require('node:child_process')

// How far back to search a single path's history. A repo this size never comes
// close, and the cap stops a pathological history from turning a fast check
// into a slow one.
const MAX_HISTORY_PER_PATH = 300

/**
 * Run a git command and return trimmed stdout, or null if git exits non-zero.
 *
 * Non-zero is an ordinary, expected answer here — `git rev-parse HEAD:missing`
 * fails for a path that does not exist at that revision, which is information
 * rather than an error — so this never throws for that case.
 * @param {string[]} args
 * @returns {string|null}
 */
function git(args, cwd) {
  try {
    return execFileSync('git', args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      cwd: cwd || process.cwd(),
    }).trim()
  } catch {
    return null
  }
}

/**
 * The blob hash of `path` at `rev`, or null when the path does not exist there.
 * @param {string} rev
 * @param {string} path
 * @returns {string|null}
 */
function blobAt(rev, path, cwd) {
  return git(['rev-parse', `${rev}:${path}`], cwd)
}

/**
 * Commits touching `path` on `rev`, newest first.
 * @param {string} rev
 * @param {string} path
 * @returns {string[]}
 */
function commitsTouching(rev, path, cwd) {
  const out = git(
    ['log', `--max-count=${MAX_HISTORY_PER_PATH}`, '--format=%H', rev, '--', path],
    cwd
  )
  return out ? out.split('\n').filter(Boolean) : []
}

/**
 * Find files whose branch content restores a superseded base revision.
 * @param {string} base A revision (e.g. 'origin/main').
 * @param {string} head A revision (e.g. 'HEAD').
 * @returns {Array<{path: string, restoredFrom: string, supersededBy: string, subject: string}>}
 */
function findRestoredFiles(base, head, cwd) {
  // Two-dot: what HEAD's tree has that the BASE TIP's tree does not. Three-dot
  // would ask "what did this branch introduce since diverging", which is the
  // wrong question — a branch that merged base and then reverted it has
  // introduced those reversions, but the comparison that reveals them is
  // against the base TIP.
  const changed = git(['diff', '--name-only', base, head], cwd)
  if (!changed) return []

  const findings = []
  for (const path of changed.split('\n').filter(Boolean)) {
    const headBlob = blobAt(head, path, cwd)
    // Deleted on the branch. A deletion cannot be "a restored older version",
    // and treating it as one would fire on every legitimate file removal.
    if (!headBlob) continue

    const baseBlob = blobAt(base, path, cwd)
    // New file, not on base at all — nothing to have superseded.
    if (!baseBlob) continue
    if (headBlob === baseBlob) continue

    // Walk the path's history on base, newest first, skipping the tip's own
    // version (already compared above). A byte-exact match means this branch
    // carries that superseded revision verbatim.
    for (const commit of commitsTouching(base, path, cwd)) {
      const historic = blobAt(commit, path, cwd)
      if (!historic || historic === baseBlob) continue
      if (historic !== headBlob) continue

      // Name the base-side commit that moved the file PAST the restored
      // revision, since that is the work being undone and the thing a reader
      // needs to go look at.
      const superseding =
        git(['log', '--format=%H', `${commit}..${base}`, '-1', '--', path], cwd) || base
      findings.push({
        path,
        restoredFrom: commit.slice(0, 9),
        supersededBy: superseding.slice(0, 9),
        subject: git(['log', '--format=%s', '-1', superseding], cwd) || '(unknown)',
      })
      break
    }
  }
  return findings
}

/**
 * True when the branch explicitly opts out of this check.
 * @param {string} base
 * @param {string} head
 * @returns {boolean}
 */
function revertAllowed(base, head, cwd) {
  if (process.env.ALLOW_REVERT === '1') return true
  const messages = git(['log', '--format=%B', `${base}..${head}`], cwd) || ''
  return messages.includes('[allow-revert]')
}

function main() {
  const base = process.env.REVERT_CHECK_BASE || 'origin/main'
  const head = process.env.REVERT_CHECK_HEAD || 'HEAD'

  // No base to compare against (a fresh clone with no remote, a shallow
  // checkout that omitted it). Skip loudly rather than passing silently — a
  // check that cannot run is not a check that passed.
  if (!git(['rev-parse', '--verify', `${base}^{commit}`])) {
    console.log(`check-revert: SKIP — no such base revision "${base}" (needs full history)`)
    return 0
  }
  // On main itself there is nothing to compare.
  if (git(['rev-parse', base]) === git(['rev-parse', head])) {
    console.log('check-revert: SKIP — head is the base branch')
    return 0
  }

  const findings = findRestoredFiles(base, head)
  if (findings.length === 0) {
    console.log(`check-revert: OK — no file restores a superseded ${base} revision`)
    return 0
  }

  console.error(
    `\ncheck-revert: ${findings.length} file(s) restore a version of themselves ` +
      `that ${base} has already moved past:\n`
  )
  for (const f of findings) {
    console.error(`  ${f.path}`)
    console.error(`      this branch carries the version from ${f.restoredFrom},`)
    console.error(`      which ${f.supersededBy} replaced on ${base}: ${f.subject}`)
  }
  console.error(
    '\nThis is what a branch built on a stale base looks like: it can contain\n' +
      `${base} in its history and still revert ${base}'s content, which every\n` +
      'other gate reads as internally consistent.\n\n' +
      'Rebuild the branch on current ' +
      base +
      ', or — if the revert is intended —\n' +
      'put [allow-revert] in a commit message on the branch.\n'
  )
  if (revertAllowed(base, head)) {
    console.error('check-revert: allowed by [allow-revert] / ALLOW_REVERT=1 — not failing.\n')
    return 0
  }
  return 1
}

if (require.main === module) process.exit(main())

module.exports = { findRestoredFiles, revertAllowed }

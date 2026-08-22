// Tests for build_scripts/check-revert.js — the gate that fails when a branch
// restores a version of a file the base branch has already moved past.
//
// Driven against PURPOSE-BUILT temporary git repositories rather than this
// repo's own history, for the same reason card-inheritance and karl-transcript
// use hand-built pages: asserting against the real history would make these
// tests fail whenever someone legitimately reverts something, and would pin
// this repo's commit graph into a test that is supposed to be about an
// algorithm. Each case below builds the exact three-commit shape it needs.
//
// The shape that matters, and the one every other gate in this repo misses:
//
//   A ── B (base tip)          A: file = v1
//    \                          B: file = v2   (the work being undone)
//     └── C (branch head)       C: file = v1   (restored, byte-exact)
//
// with B merged into the branch, so the branch CONTAINS the base and GitHub's
// "up to date" check is satisfied while the content is reverted.

import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const { findRestoredFiles, revertAllowed } = require('../build_scripts/check-revert.js')

let repo

/**
 * Run git in the temp repo.
 * @param {...string} args
 * @returns {string}
 */
function git(...args) {
  return execFileSync('git', args, {
    cwd: repo,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

/**
 * Write a file and commit it.
 * @param {string} name
 * @param {string} contents
 * @param {string} message
 * @returns {void}
 */
function commit(name, contents, message) {
  fs.writeFileSync(path.join(repo, name), contents)
  git('add', '-A')
  git('commit', '-m', message)
}

beforeEach(() => {
  repo = fs.mkdtempSync(path.join(os.tmpdir(), 'revert-check-'))
  git('init', '-q', '-b', 'main')
  // Identity must be local to the temp repo; a machine with no global git
  // identity would otherwise fail to commit at all.
  git('config', 'user.email', 'test@example.test')
  git('config', 'user.name', 'Test')
  // Isolate from the developer's GLOBAL hooks. A machine with
  // core.hooksPath set — a ggshield/pre-commit secret scanner, say — runs that
  // hook on every fixture commit here, which measured ~0.85s each and timed
  // this suite out locally while passing on a bare CI runner. A fixture repo
  // has no business running anyone's personal hooks either way.
  git('config', 'core.hooksPath', '/dev/null')
})

afterEach(() => {
  fs.rmSync(repo, { recursive: true, force: true })
})

describe('findRestoredFiles', () => {
  test('flags a file restored to a version the base has moved past', () => {
    commit('config.json', 'v1\n', 'A: initial')
    commit('config.json', 'v2\n', 'B: the work being undone')
    git('checkout', '-q', '-b', 'feature')
    commit('config.json', 'v1\n', 'C: restore the old version')

    const found = findRestoredFiles('main', 'feature', repo)
    expect(found).toHaveLength(1)
    expect(found[0].path).toBe('config.json')
    // Names the base-side commit being undone, which is what a reader needs.
    expect(found[0].subject).toBe('B: the work being undone')
  })

  // The case that defeats GitHub's `strict` branch protection: the branch
  // MERGES the base, so the base is reachable from the head and the branch
  // reads as fully up to date — and then reverts the content anyway.
  test('flags a revert even when the branch contains the base branch', () => {
    commit('config.json', 'v1\n', 'A: initial')
    git('checkout', '-q', '-b', 'feature')
    commit('other.txt', 'unrelated\n', 'branch work')
    git('checkout', '-q', 'main')
    commit('config.json', 'v2\n', 'B: the work being undone')
    git('checkout', '-q', 'feature')
    git('merge', '-q', '--no-edit', 'main')
    commit('config.json', 'v1\n', 'C: revert after merging main')

    // Precondition: the branch really does contain the base.
    expect(() => git('merge-base', '--is-ancestor', 'main', 'feature')).not.toThrow()

    const found = findRestoredFiles('main', 'feature', repo)
    expect(found.map((f) => f.path)).toEqual(['config.json'])
  })

  test('does not flag an ordinary forward change', () => {
    commit('config.json', 'v1\n', 'A')
    commit('config.json', 'v2\n', 'B')
    git('checkout', '-q', '-b', 'feature')
    commit('config.json', 'v3\n', 'C: a genuinely new version')

    expect(findRestoredFiles('main', 'feature', repo)).toEqual([])
  })

  test('does not flag a new file the base has never seen', () => {
    commit('config.json', 'v1\n', 'A')
    git('checkout', '-q', '-b', 'feature')
    commit('brand-new.txt', 'hello\n', 'C: add a file')

    expect(findRestoredFiles('main', 'feature', repo)).toEqual([])
  })

  // A deletion is not a restored older version. Treating it as one would fire
  // on every legitimate file removal, which would make the gate unusable.
  test('does not flag a deleted file', () => {
    commit('config.json', 'v1\n', 'A')
    commit('doomed.txt', 'bye\n', 'B')
    git('checkout', '-q', '-b', 'feature')
    fs.rmSync(path.join(repo, 'doomed.txt'))
    git('add', '-A')
    git('commit', '-m', 'C: delete it')

    expect(findRestoredFiles('main', 'feature', repo)).toEqual([])
  })

  test('reports every reverted file, not just the first', () => {
    commit('a.txt', 'v1\n', 'A1')
    commit('b.txt', 'v1\n', 'A2')
    commit('a.txt', 'v2\n', 'B1')
    commit('b.txt', 'v2\n', 'B2')
    git('checkout', '-q', '-b', 'feature')
    fs.writeFileSync(path.join(repo, 'a.txt'), 'v1\n')
    fs.writeFileSync(path.join(repo, 'b.txt'), 'v1\n')
    git('add', '-A')
    git('commit', '-m', 'C: revert both')

    expect(
      findRestoredFiles('main', 'feature', repo)
        .map((f) => f.path)
        .sort()
    ).toEqual(['a.txt', 'b.txt'])
  })

  // Documented limitation, asserted so it is a known boundary rather than a
  // surprise: detection is byte-exact on the whole file, so reverting SOME
  // hunks leaves no exact match and passes. This is a tripwire for the
  // wholesale case, not a general "does this undo anything" analysis.
  test('does not flag a partial revert (known, documented limitation)', () => {
    commit('config.json', 'line1\nline2\n', 'A')
    commit('config.json', 'line1-changed\nline2-changed\n', 'B')
    git('checkout', '-q', '-b', 'feature')
    commit('config.json', 'line1\nline2-changed\n', 'C: revert only the first line')

    expect(findRestoredFiles('main', 'feature', repo)).toEqual([])
  })
})

describe('revertAllowed', () => {
  test('is false for an ordinary branch', () => {
    commit('a.txt', 'v1\n', 'A')
    git('checkout', '-q', '-b', 'feature')
    commit('a.txt', 'v2\n', 'ordinary work')
    expect(revertAllowed('main', 'feature', repo)).toBe(false)
  })

  test('is true when a commit message opts out', () => {
    commit('a.txt', 'v1\n', 'A')
    git('checkout', '-q', '-b', 'feature')
    commit('a.txt', 'v2\n', 'revert the thing [allow-revert]')
    expect(revertAllowed('main', 'feature', repo)).toBe(true)
  })

  test('is true when ALLOW_REVERT is set', () => {
    commit('a.txt', 'v1\n', 'A')
    git('checkout', '-q', '-b', 'feature')
    commit('a.txt', 'v2\n', 'ordinary work')
    const saved = process.env.ALLOW_REVERT
    process.env.ALLOW_REVERT = '1'
    try {
      expect(revertAllowed('main', 'feature', repo)).toBe(true)
    } finally {
      // Restore, or this leaks into sibling test files.
      if (saved === undefined) delete process.env.ALLOW_REVERT
      else process.env.ALLOW_REVERT = saved
    }
  })
})

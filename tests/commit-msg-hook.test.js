// Tests for `.githooks/commit-msg`, the gate requiring AI-assisted commits to
// carry both the `Co-Authored-By` and `Claude-Session` trailers.
//
// The hook is shell, so these drive the real script with `sh` against real
// message files rather than reimplementing its logic in JS — a second copy of
// the rule in the test would pass while the shipped rule was broken.
//
// Most assertions here are about what must NOT be rejected. The failure mode
// that matters is not a missed trailer, which is recoverable by amending; it
// is a hook that blocks ordinary human commits, because the fix people reach
// for then is `--no-verify` as a habit, and a bypassed hook enforces nothing.

const { describe, test, expect, beforeAll, afterAll } = require('bun:test')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawnSync } = require('node:child_process')

const HOOK = path.resolve(import.meta.dir, '..', '.githooks', 'commit-msg')

let tmpDir

beforeAll(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hhvc-hook-'))
})
afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

/** Run the hook over `message`; true when the commit would be allowed. */
function accepts(message) {
  const file = path.join(tmpDir, `msg-${Math.abs(hash(message))}`)
  fs.writeFileSync(file, message)
  const result = spawnSync('sh', [HOOK, file], { encoding: 'utf8' })
  return result.status === 0
}

/** Stable per-message filename without Math.random, so a failure reproduces. */
function hash(s) {
  let h = 0
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) | 0
  return h
}

const COAUTHOR = 'Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>'
const SESSION = 'Claude-Session: d04bdf89-cf30-4918-b178-ff0212e57127'

describe('commit-msg hook: the script itself', () => {
  test('is executable, or ggshield’s dispatcher silently skips it', () => {
    // `_dispatch` guards on `[ -x ]` and exits 0 when the bit is missing, so a
    // non-executable hook is not a broken gate -- it is an ABSENT one, with no
    // error to notice. That makes the mode bit part of the contract.
    fs.accessSync(HOOK, fs.constants.X_OK)
  })

  test('is valid POSIX shell', () => {
    const result = spawnSync('sh', ['-n', HOOK], { encoding: 'utf8' })
    expect(result.stderr).toBe('')
    expect(result.status).toBe(0)
  })
})

describe('commit-msg hook: commits it must allow', () => {
  test('allows a plain human commit carrying no trailers', () => {
    expect(accepts('fix: correct the thing\n')).toBe(true)
  })

  test('allows an AI-assisted commit carrying both trailers', () => {
    expect(accepts(`fix: x\n\n${COAUTHOR}\n${SESSION}\n`)).toBe(true)
  })

  test('allows a co-author who is not Claude', () => {
    expect(accepts('fix: x\n\nCo-Authored-By: Dana <dana@example.com>\n')).toBe(true)
  })

  test('allows a fixup!, which inherits the target commit’s trailers', () => {
    expect(accepts(`fixup! fix: x\n\n${COAUTHOR}\n`)).toBe(true)
  })

  test('allows a squash!, for the same reason', () => {
    expect(accepts(`squash! fix: x\n\n${COAUTHOR}\n`)).toBe(true)
  })
})

describe('commit-msg hook: what counts as a trailer', () => {
  test('ignores a trailer named only inside git’s comment block', () => {
    // Cleanup runs AFTER commit-msg, so the file still carries the `#` status
    // block. A message that merely MENTIONS the trailer there has not set it.
    expect(accepts(`fix: x\n\n${COAUTHOR}\n\n# ${SESSION}\n`)).toBe(false)
  })

  test('ignores trailers inside a --verbose diff', () => {
    // `commit --verbose` appends the staged diff below the message. A diff
    // that happens to add a Claude-Session line to some file must not satisfy
    // the trailer for the commit itself.
    const message = [
      'fix: x',
      '',
      COAUTHOR,
      '',
      'diff --git a/a.txt b/a.txt',
      '--- a/a.txt',
      '+++ b/a.txt',
      `+${SESSION}`,
      '',
    ].join('\n')
    expect(accepts(message)).toBe(false)
  })
})

describe('commit-msg hook: commits it must reject', () => {
  test('rejects a Claude co-author with no Claude-Session', () => {
    expect(accepts(`fix: x\n\n${COAUTHOR}\n`)).toBe(false)
  })

  test('rejects a Claude-Session present but empty', () => {
    expect(accepts(`fix: x\n\n${COAUTHOR}\nClaude-Session:\n`)).toBe(false)
  })

  test('rejects a Claude-Session whose value is only whitespace', () => {
    expect(accepts(`fix: x\n\n${COAUTHOR}\nClaude-Session:   \n`)).toBe(false)
  })

  test('rejects a Claude-Session with no matching Co-Authored-By', () => {
    // The pairing runs both ways: a session id without the co-author is just
    // as non-conforming, and catching it is what stops the co-author line
    // from being quietly dropped.
    expect(accepts(`fix: x\n\n${SESSION}\n`)).toBe(false)
  })

  test('matches the co-author case-insensitively', () => {
    expect(accepts('fix: x\n\nco-authored-by: CLAUDE <noreply@anthropic.com>\n')).toBe(false)
  })
})

describe('commit-msg hook: message the author actually sees', () => {
  test('names the missing trailer and offers the escape hatch', () => {
    const file = path.join(tmpDir, 'msg-diagnostic')
    fs.writeFileSync(file, `fix: x\n\n${COAUTHOR}\n`)
    const result = spawnSync('sh', [HOOK, file], { encoding: 'utf8' })
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('Claude-Session')
    expect(result.stderr).toContain('--no-verify')
    // Diagnostics belong on stderr; git shows it, and stdout would be
    // captured by any wrapper reading the hook's output.
    expect(result.stdout).toBe('')
  })
})

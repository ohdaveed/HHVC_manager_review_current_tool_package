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

describe('commit-msg hook: regressions review caught', () => {
  test('rejects a lone, EMPTY Claude-Session with no co-author', () => {
    // The first version counted "session with a value" and "co-author"
    // separately, so this message set neither and exited 0 — a commit
    // announcing the trailer and supplying nothing passed the gate.
    expect(accepts('fix: x\n\nClaude-Session:\n')).toBe(false)
  })

  test('matches Claude-Session case-insensitively', () => {
    // Co-Authored-By was matched case-insensitively from the start and this
    // one was not, which made lower-casing the token a way around the gate.
    expect(accepts('fix: x\n\nclaude-session: abc-123\n')).toBe(false)
  })

  test('ignores a trailer-shaped line that ordinary prose follows', () => {
    // Not a trailer at all: `git interpret-trailers --parse` reports nothing
    // for this message. A whole-message grep counted it and handed out a pass.
    const message = ['docs: describe the trailer syntax', '', `${SESSION}`, 'Then prose.', ''].join(
      '\n'
    )
    expect(accepts(message)).toBe(true)
  })

  test('still enforces under `commit --verbose`, whose diff is not commented', () => {
    // The scissors block's diff lines are raw, so leaving them in place makes
    // the message stop ending in a trailer block and interpret-trailers
    // reports NOTHING — which would read as "no co-author" and skip
    // enforcement on precisely the commits that carry one.
    const message = [
      'fix: x',
      '',
      COAUTHOR,
      '',
      '# ------------------------ >8 ------------------------',
      '# Do not modify or remove the line above.',
      'diff --git a/a.txt b/a.txt',
      '+something',
      '',
    ].join('\n')
    expect(accepts(message)).toBe(false)
  })

  test('enforces on amend!, which replaces a message wholesale', () => {
    // Unlike fixup!/squash!, an `amend!` commit carries its own full message,
    // so exempting it was a free bypass for anything prefixed that way.
    expect(accepts(`amend! fix: x\n\n${COAUTHOR}\n`)).toBe(false)
  })
})

describe('commit-msg hook: hostile git configuration', () => {
  test('still enforces when trailer.separators omits the colon', () => {
    // `trailer.separators` is configurable per user and per repo. Set to a
    // value without `:`, `interpret-trailers --parse` returns NOTHING for
    // this repo's colon-form trailers, every counter reads zero, and an
    // unpaired Claude co-author sails through. The hook pins the separator
    // on its own invocation; this proves the pin, by injecting the hostile
    // value through GIT_CONFIG_* rather than writing to any real config.
    const file = path.join(tmpDir, 'msg-separators')
    fs.writeFileSync(file, `fix: x\n\n${COAUTHOR}\n`)
    const result = spawnSync('sh', [HOOK, file], {
      encoding: 'utf8',
      env: {
        ...process.env,
        GIT_CONFIG_COUNT: '1',
        GIT_CONFIG_KEY_0: 'trailer.separators',
        GIT_CONFIG_VALUE_0: '=',
      },
    })
    expect(result.status).toBe(1)
  })
})

describe('commit-msg hook: a real merge, in a scratch repository', () => {
  // `git merge -m` takes a message the developer WROTE, so exempting merges
  // turned every one of them into a way around the gate. An earlier version
  // did exactly that, returning early whenever MERGE_HEAD existed. These run
  // real merges in a throwaway repo rather than asserting against this one.

  /** A repo with two divergent branches and the hook installed. */
  function scratchRepo(name) {
    const dir = path.join(tmpDir, name)
    const run = (...args) =>
      spawnSync('git', ['-C', dir, ...args], { encoding: 'utf8', env: process.env })
    fs.mkdirSync(dir, { recursive: true })
    spawnSync('git', ['init', '-q', '-b', 'main', dir], { encoding: 'utf8' })
    run('config', 'user.email', 'test@example.com')
    run('config', 'user.name', 'Test')
    // Pin hooksPath at this repo so the machine's global setting, whatever it
    // is, cannot decide whether the test exercises the hook.
    const hooks = path.join(dir, '.git', 'hooks')
    fs.mkdirSync(hooks, { recursive: true })
    fs.copyFileSync(HOOK, path.join(hooks, 'commit-msg'))
    fs.chmodSync(path.join(hooks, 'commit-msg'), 0o755)
    run('config', 'core.hooksPath', hooks)

    run('commit', '-q', '--allow-empty', '-m', 'root')
    run('checkout', '-q', '-b', 'side')
    run('commit', '-q', '--allow-empty', '-m', 'side work')
    run('checkout', '-q', 'main')
    return { dir, run, head: () => run('rev-parse', 'HEAD').stdout.trim() }
  }

  test('blocks a merge whose authored message has an unpaired co-author', () => {
    const repo = scratchRepo('merge-blocked')
    const before = repo.head()
    const merged = repo.run('merge', '--no-ff', '-m', `Merge side\n\n${COAUTHOR}`, 'side')
    expect(merged.status).not.toBe(0)
    expect(repo.head()).toBe(before)
  })

  test('allows a merge whose authored message carries both trailers', () => {
    const repo = scratchRepo('merge-allowed')
    const before = repo.head()
    const merged = repo.run(
      'merge',
      '--no-ff',
      '-m',
      `Merge side\n\n${COAUTHOR}\n${SESSION}`,
      'side'
    )
    expect(merged.status).toBe(0)
    expect(repo.head()).not.toBe(before)
  })

  test('leaves git’s own generated merge message alone', () => {
    // The reason the blanket exemption was unnecessary: a generated merge
    // message carries no Claude trailer, so the rule never fires on it.
    const repo = scratchRepo('merge-generated')
    const before = repo.head()
    const merged = repo.run('merge', '--no-ff', '--no-edit', 'side')
    expect(merged.status).toBe(0)
    expect(repo.head()).not.toBe(before)
  })
})

describe('commit-msg hook: who counts as the agent', () => {
  test('leaves a HUMAN named Claude alone', () => {
    // A substring match on "claude" classified this person as AI and demanded
    // a session id they cannot produce. The identity that signs these commits
    // is an anthropic.com address, and every Co-Authored-By naming the agent
    // in this repository's history uses one.
    expect(accepts('fix: x\n\nCo-Authored-By: Claude Dupont <claude@example.com>\n')).toBe(true)
  })

  test('still catches the agent under any display name', () => {
    expect(accepts('fix: x\n\nCo-Authored-By: Some Agent <noreply@anthropic.com>\n')).toBe(false)
  })
})

describe('commit-msg hook: a non-default core.commentChar', () => {
  test('strips the status block whatever character git was told to use', () => {
    // `core.commentChar` is configurable. A hand-rolled `#` strip leaves a
    // `;`-commented block in place, which ends the message in a non-trailer
    // block — so the parser finds nothing and an unpaired co-author sails
    // through. `git stripspace --strip-comments` honours the setting.
    const file = path.join(tmpDir, 'msg-commentchar')
    fs.writeFileSync(file, `fix: x\n\n${COAUTHOR}\n; status block\n; more\n`)
    const result = spawnSync('sh', [HOOK, file], {
      encoding: 'utf8',
      env: {
        ...process.env,
        GIT_CONFIG_COUNT: '1',
        GIT_CONFIG_KEY_0: 'core.commentChar',
        GIT_CONFIG_VALUE_0: ';',
      },
    })
    expect(result.status).toBe(1)
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

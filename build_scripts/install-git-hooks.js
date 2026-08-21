// Install this repo's tracked git hooks into the local clone.
//
// Hooks under `.git/hooks` are per-clone and never committed, so the tracked
// copies live in `.githooks/` and this script points the clone at them. It
// symlinks rather than copies, so an edit to the tracked hook takes effect
// without a reinstall and a stale copy cannot drift from the reviewed one.
//
// **It deliberately does NOT set `core.hooksPath`.** That is the usual way to
// ship tracked hooks and here it would be a security regression: on this
// machine the setting is already global, pointing at ggshield's hook
// directory, and a repo-local value overrides the global one outright — which
// silently disables the secret scan running on pre-push. It is not needed
// either. ggshield's `_dispatch` forwards each hook to
// `$(git rev-parse --git-dir)/hooks/<name>` whenever that file is executable,
// so a symlink in the clone's own hooks directory already runs.
//
// Run via `bun run hooks:install`.

const fs = require('node:fs')
const path = require('node:path')
const { execFileSync } = require('node:child_process')

const repoRoot = path.resolve(__dirname, '..')
const sourceDir = path.join(repoRoot, '.githooks')

/** Resolve the clone's real git directory; worktrees do not put it at `.git`. */
function gitDir() {
  const out = execFileSync('git', ['rev-parse', '--git-dir'], {
    cwd: repoRoot,
    encoding: 'utf8',
  }).trim()
  return path.resolve(repoRoot, out)
}

/**
 * Report a `core.hooksPath` that would stop these hooks from ever running.
 * An unset value, or ggshield's forwarding directory, are both fine; anything
 * else takes precedence over `.git/hooks` and the install would be a no-op
 * that LOOKS successful, which is the failure worth naming out loud.
 */
function warnIfHooksPathBypasses() {
  let configured = ''
  try {
    configured = execFileSync('git', ['config', '--get', 'core.hooksPath'], {
      cwd: repoRoot,
      encoding: 'utf8',
    }).trim()
  } catch {
    return // unset: git looks in .git/hooks, which is what we want
  }
  if (!configured) return
  const forwards = fs.existsSync(path.join(configured, '_dispatch'))
  if (forwards) {
    console.log(`  note: core.hooksPath is ${configured}, which forwards to .git/hooks`)
    return
  }
  console.warn(
    `  WARNING: core.hooksPath is set to ${configured}, which takes precedence\n` +
      '  over .git/hooks. These hooks will NOT run until that directory forwards\n' +
      '  to the repository, or the setting is cleared.'
  )
}

function install() {
  if (!fs.existsSync(sourceDir)) {
    console.error(`No tracked hooks directory at ${sourceDir}`)
    process.exit(1)
  }
  const hooksDir = path.join(gitDir(), 'hooks')
  fs.mkdirSync(hooksDir, { recursive: true })

  const names = fs.readdirSync(sourceDir).filter((n) => !n.startsWith('.'))
  if (names.length === 0) {
    console.error(`No hooks found in ${sourceDir}`)
    process.exit(1)
  }

  let installed = 0
  for (const name of names) {
    const source = path.join(sourceDir, name)
    const target = path.join(hooksDir, name)
    // Relative, so the link survives the repo being moved or renamed.
    const linkTarget = path.relative(hooksDir, source)

    fs.chmodSync(source, 0o755)

    const existing = fs.lstatSync(target, { throwIfNoEntry: false })
    if (existing) {
      if (existing.isSymbolicLink() && fs.readlinkSync(target) === linkTarget) {
        console.log(`  ${name}: already installed`)
        installed += 1
        continue
      }
      // Never clobber silently. A hand-written hook in a clone is somebody's
      // work, and this script has no way to know it is safe to discard.
      console.error(
        `  ${name}: ${target} already exists and is not our symlink.\n` +
          '  Inspect and remove it, then re-run.'
      )
      process.exitCode = 1
      continue
    }

    fs.symlinkSync(linkTarget, target)
    console.log(`  ${name}: installed`)
    installed += 1
  }

  console.log(`git hooks: ${installed}/${names.length} installed into ${hooksDir}`)
  warnIfHooksPathBypasses()
}

install()

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

function git(...args) {
  return execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8' }).trim()
}

/**
 * Every directory a hook could be read from, deduped.
 *
 * There are two, and in a linked worktree they are DIFFERENT places:
 * `--git-common-dir` is `.git`, where git itself looks when `core.hooksPath`
 * is unset, and `--git-dir` is `.git/worktrees/<name>`, which is where
 * ggshield's `_dispatch` looks because that is the path it resolves. Install
 * into both rather than guessing which mechanism is live.
 *
 * NOT `--git-path hooks`, which is the obvious call and the wrong one: it
 * RESPECTS `core.hooksPath`, so here it returns ggshield's own directory and
 * the install would write into a third party's tree.
 */
function hookDirs() {
  const common = path.resolve(repoRoot, git('rev-parse', '--git-common-dir'), 'hooks')
  const own = path.resolve(repoRoot, git('rev-parse', '--git-dir'), 'hooks')
  // Each directory is paired with the checkout its link should point INTO.
  // The common directory outlives every linked worktree, so its link must
  // name a checkout that outlives them too — the main one. Pointing it at the
  // worktree that happened to run the installer leaves the whole clone with a
  // dangling hook the moment that worktree is removed, and a dangling hook is
  // an absent gate rather than a loud one.
  const entries = [{ dir: common, from: mainWorktree() }]
  if (own !== common) entries.push({ dir: own, from: repoRoot })
  return entries
}

/**
 * The main working tree — the first record of `git worktree list --porcelain`,
 * which git documents as the main one. Falls back to this checkout when the
 * listing cannot be read, which is the pre-worktree behaviour.
 */
function mainWorktree() {
  try {
    for (const line of git('worktree', 'list', '--porcelain').split('\n')) {
      if (line.startsWith('worktree ')) return line.slice('worktree '.length).trim()
    }
  } catch {
    /* fall through */
  }
  return repoRoot
}

/**
 * Report a `core.hooksPath` that would stop these hooks from ever running.
 * Unset, or ggshield's forwarding directory, are both fine; anything else
 * takes precedence and the install becomes a no-op that LOOKS successful,
 * which is the failure worth naming out loud.
 */
function warnIfHooksPathBypasses() {
  let configured = ''
  try {
    configured = git('config', '--get', 'core.hooksPath')
  } catch {
    return // unset: git reads the repository's own hooks directory
  }
  if (!configured) return
  if (fs.existsSync(path.join(configured, '_dispatch'))) {
    console.log(`  note: core.hooksPath is ${configured}, which forwards to the repo's hooks`)
    return
  }
  console.warn(
    `  WARNING: core.hooksPath is set to ${configured}, which takes precedence\n` +
      "  over the repository's hooks directory. These hooks will NOT run until that\n" +
      '  directory forwards to the repository, or the setting is cleared.'
  )
}

/**
 * The executable bit is part of the hook's contract, not packaging: ggshield's
 * dispatcher guards on `[ -x ]` and exits 0 without it, so an unexecutable
 * hook is an ABSENT gate rather than a broken one. Fail loudly instead of
 * chmod-ing it here — a silent fix would dirty the working tree and, worse,
 * would repair at install time the very thing the committed mode bit is
 * supposed to guarantee, hiding a repo that had lost it.
 */
function assertExecutable(source, name) {
  try {
    fs.accessSync(source, fs.constants.X_OK)
  } catch {
    console.error(
      `  ${name}: not executable.\n` +
        `  Restore the bit and commit it: chmod +x .githooks/${name} && ` +
        `git update-index --chmod=+x .githooks/${name}`
    )
    return false
  }
  return true
}

function install() {
  if (!fs.existsSync(sourceDir)) {
    console.error(`No tracked hooks directory at ${sourceDir}`)
    process.exit(1)
  }
  const names = fs.readdirSync(sourceDir).filter((n) => !n.startsWith('.'))
  if (names.length === 0) {
    console.error(`No hooks found in ${sourceDir}`)
    process.exit(1)
  }

  let installed = 0
  let attempted = 0
  for (const { dir, from } of hookDirs()) {
    fs.mkdirSync(dir, { recursive: true })
    for (const name of names) {
      attempted += 1
      const source = path.join(from, '.githooks', name)
      if (!fs.existsSync(source)) {
        // The main checkout can legitimately sit on a revision predating the
        // hook. Say so rather than linking at a path that does not exist.
        console.error(`  ${name}: ${source} does not exist; skipping ${dir}`)
        process.exitCode = 1
        continue
      }
      if (!assertExecutable(source, name)) {
        process.exitCode = 1
        continue
      }
      const target = path.join(dir, name)
      // Relative, so the link survives the repo being moved or renamed.
      const linkTarget = path.relative(dir, source)

      const existing = fs.lstatSync(target, { throwIfNoEntry: false })
      if (existing) {
        // Satisfied by any checkout's copy of the same tracked hook, not only
        // by this one's. Run from a linked worktree, the common directory's
        // link already points at the MAIN checkout's `.githooks`, and
        // repointing it at a temporary worktree would leave the main clone
        // with a dangling hook the moment that worktree is removed.
        const points = existing.isSymbolicLink() ? path.resolve(dir, fs.readlinkSync(target)) : ''
        if (points === path.resolve(source)) {
          console.log(`  ${name} -> ${dir}: already installed`)
          installed += 1
          continue
        }
        if (points.endsWith(path.join('.githooks', name)) && fs.existsSync(points)) {
          console.log(`  ${name} -> ${dir}: already installed via ${points}`)
          installed += 1
          continue
        }
        // Never clobber silently. A hand-written hook in a clone is somebody's
        // work and this script cannot know it is safe to discard.
        console.error(
          `  ${name}: ${target} already exists and is not our symlink.\n` +
            '  Inspect and remove it, then re-run.'
        )
        process.exitCode = 1
        continue
      }

      fs.symlinkSync(linkTarget, target)
      console.log(`  ${name} -> ${dir}: installed`)
      installed += 1
    }
  }

  console.log(`git hooks: ${installed}/${attempted} installed`)
  warnIfHooksPathBypasses()
}

install()

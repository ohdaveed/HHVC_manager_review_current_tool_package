#!/usr/bin/env python3
"""Find files that nothing else in the repository mentions.

"Nothing references it" is the single strongest piece of evidence a cleanup pass
can have, and it is tedious to gather by hand — you have to check source, tests,
configs, CI, package manifests and docs for every candidate. This automates that
sweep.

It reports CANDIDATES, not verdicts. Dynamic imports, glob-based test discovery,
framework file-based routing and convention-named entry points all reference
files without naming them, so read the caveats on each hit before deleting
anything. The script is deliberately noisy in the safe direction: it would
rather show you a file that is actually used than hide one that isn't.

Matching is by basename, which has one blind spot the tool cannot see past: if
two files share a name, a reference to either satisfies both. Those are listed
separately as ambiguous rather than silently dropped.

Usage:
    find_unreferenced.py [ROOT] [options]

    find_unreferenced.py                       # whole repo
    find_unreferenced.py --include 'js/**'     # just one area
    find_unreferenced.py --stem                # match basename without extension too

Options:
    --include GLOB    Only consider files matching GLOB as candidates (repeatable).
    --ext EXT         Only consider files with this extension (repeatable).
    --stem            Also search for the basename minus extension. Catches
                      `import './foo'` for foo.js, at the cost of more false
                      negatives when the stem is a common word.
    --min-lines N     Ignore candidate files shorter than N lines (default 0).
    --json            Emit JSON instead of a table, as
                      {"unreferenced": [...], "ambiguous_basenames": [...]}.

Exit status:
    0  ran successfully (whether or not it found anything)
    2  ROOT is not a directory
    3  a reference search failed — results would be meaningless, so none are shown
"""

import argparse
import fnmatch
import json
import os
import subprocess
import sys
from pathlib import Path

# Directories that never contain hand-written source worth auditing, and whose
# contents would otherwise swamp the results.
SKIP_DIRS = {
    ".git", "node_modules", "dist", "build", "out", "target", "vendor",
    "__pycache__", ".venv", "venv", ".next", ".nuxt", ".cache", "coverage",
    ".pytest_cache", ".mypy_cache", ".tox", ".gradle", "Pods", ".terraform",
}

# Files whose names are the reference — a build tool or framework finds them by
# convention, so "nothing mentions it" says nothing about whether it is used.
CONVENTION_NAMES = {
    "index", "main", "__init__", "setup", "conftest", "app", "server",
    "middleware", "layout", "page", "route", "loading", "error", "not-found",
    "default", "template", "handler", "mod", "lib",
}


def have_ripgrep() -> bool:
    try:
        subprocess.run(["rg", "--version"], capture_output=True, check=True)
        return True
    except (FileNotFoundError, subprocess.CalledProcessError):
        return False


def walk(root: Path):
    """Every file under root, skipping build output and vendored code."""
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        for name in filenames:
            yield Path(dirpath) / name


class SearchError(RuntimeError):
    """A reference search failed, so its result says nothing about the file."""


def count_references(root: Path, needle: str, self_path: Path, use_rg: bool) -> int:
    """How many files other than self_path mention `needle`.

    Raises SearchError if the search itself failed. That must not be swallowed:
    a failed search returns no hits, which reads identically to "nothing
    references this" — the exact conclusion this tool exists to support.
    """
    if use_rg:
        # --hidden and --no-ignore are load-bearing, not belt-and-braces. rg
        # skips dotfiles and honours .gitignore by default, while walk() below
        # skips neither — so without these the two halves disagree about what
        # "the repository" is, and a file referenced only from .github/ or
        # .claude/ is reported as an orphan. Measured: run against this repo,
        # the default flags reported this very script and both reference docs
        # as unreferenced, because the SKILL.md naming them sits under .claude/.
        # The SKIP_DIRS globs still exclude .git, verified under --hidden.
        cmd = ["rg", "--files-with-matches", "--fixed-strings", "--no-messages", "--hidden", "--no-ignore"]
        for d in sorted(SKIP_DIRS):  # sorted: same command every run, easy to paste and re-check
            cmd += ["--glob", f"!{d}/**"]
        # -e, because a candidate named like `-z.js` is otherwise parsed as flags.
        cmd += ["-e", needle, str(root)]
    else:
        cmd = ["grep", "-rlF"]
        # Prune skipped dirs during the walk rather than filtering the output
        # afterwards — the fallback would otherwise read every byte of
        # node_modules before discarding it.
        for d in sorted(SKIP_DIRS):
            cmd.append(f"--exclude-dir={d}")
        cmd += ["-e", needle, str(root)]

    result = subprocess.run(cmd, capture_output=True, text=True)
    # grep and rg both exit 1 for "no matches", which is not an error here.
    if result.returncode not in (0, 1):
        raise SearchError(
            f"{cmd[0]} exited {result.returncode} searching for {needle!r}: "
            f"{result.stderr.strip() or '(no stderr)'}"
        )

    hits = {line for line in result.stdout.splitlines() if line.strip()}
    hits.discard(str(self_path))
    return len(hits)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("root", nargs="?", default=".", help="repository root (default: cwd)")
    ap.add_argument("--include", action="append", default=[], metavar="GLOB")
    ap.add_argument("--ext", action="append", default=[], metavar="EXT")
    ap.add_argument("--stem", action="store_true")
    ap.add_argument("--min-lines", type=int, default=0)
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()

    root = Path(args.root).resolve()
    if not root.is_dir():
        print(f"not a directory: {root}", file=sys.stderr)
        return 2

    use_rg = have_ripgrep()
    exts = {e if e.startswith(".") else f".{e}" for e in args.ext}

    all_files = list(walk(root))
    # How many files share each basename. The search below matches on basename,
    # so when two files are called utils.js a reference to either one satisfies
    # both — and a genuinely dead a/utils.js disappears from the results because
    # b/utils.js is imported somewhere. That failure is silent and in the unsafe
    # direction, so collisions are reported rather than left to be assumed away.
    basename_counts = {}
    for path in all_files:
        basename_counts[path.name] = basename_counts.get(path.name, 0) + 1

    candidates = []
    for path in all_files:
        if exts and path.suffix not in exts:
            continue
        if args.include:
            # fnmatch on the posix string, NOT PurePath.match: pathlib's match()
            # treats `**` as a single level before Python 3.13, so
            # `--include '.superdesign/**'` silently skipped every nested file
            # and reported a clean result for a directory full of orphans.
            # fnmatch's `*` crosses separators, which makes both `js/*` and
            # `js/**` behave the way someone typing them expects.
            rel = path.relative_to(root).as_posix()
            if not any(fnmatch.fnmatch(rel, g) for g in args.include):
                continue
        if args.min_lines:
            try:
                with open(path, "rb") as fh:
                    if sum(1 for _ in fh) < args.min_lines:
                        continue
            except OSError:
                continue
        candidates.append(path)

    findings = []
    shadowed = []
    try:
        for path in candidates:
            refs = count_references(root, path.name, path, use_rg)
            if refs != 0:
                if basename_counts[path.name] > 1:
                    shadowed.append(str(path.relative_to(root)))
                continue
            if args.stem and path.stem != path.name:
                if count_references(root, path.stem, path, use_rg) != 0:
                    continue

            note = ""
            if path.stem in CONVENTION_NAMES:
                note = "convention-named — a framework may load it by path, not by reference"
            elif path.suffix in {".md", ".txt", ".rst"}:
                note = "documentation — may be linked externally or read by humans"
            elif path.suffix in {".yml", ".yaml", ".toml", ".json"} and any(
                # Any ancestor, not just the immediate parent: .github/workflows/ci.yml
                # has parent `workflows`, and GitHub Actions loads it by location.
                part.startswith(".")
                for part in path.relative_to(root).parts[:-1]
            ):
                note = "tool config — its own tool reads it by fixed path"

            try:
                lines = sum(1 for _ in open(path, "rb"))
            except OSError:
                lines = 0

            findings.append({
                "path": str(path.relative_to(root)),
                "lines": lines,
                "caveat": note,
            })
    except SearchError as exc:
        # Abort rather than report a partial list. A search that errored found
        # nothing, which this tool would otherwise read as "nothing references
        # it" — turning a broken run into a delete recommendation.
        print(f"reference search failed: {exc}", file=sys.stderr)
        return 3

    findings.sort(key=lambda f: (-f["lines"], f["path"]))
    shadowed.sort()

    if args.json:
        print(json.dumps({"unreferenced": findings, "ambiguous_basenames": shadowed}, indent=2))
        return 0

    if findings:
        print(f"{len(findings)} candidate(s) with no references under {root}.")
        print("These are CANDIDATES. Verify each before deleting — see caveats.\n")
        width = max(len(f["path"]) for f in findings)
        for f in findings:
            print(f"  {f['path']:<{width}}  {f['lines']:>6} lines")
            if f["caveat"]:
                print(f"  {'':<{width}}  ⚠ {f['caveat']}")
        print("\nBefore deleting, also check for:")
        print("  - dynamic loading: import(expr), require(var), importlib, glob test discovery")
        print("  - references from CI workflows, Dockerfiles, Makefiles, package manifests")
        print("  - a documented public interface that external code depends on")
    else:
        print(f"No unreferenced files found under {root}.")

    if shadowed:
        print(f"\n{len(shadowed)} file(s) share a basename with another file, so this tool")
        print("cannot rule on them — a reference to either one counts for both. If you")
        print("suspect these, grep for the qualified path instead of the bare name:\n")
        for p in shadowed:
            print(f"  {p}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

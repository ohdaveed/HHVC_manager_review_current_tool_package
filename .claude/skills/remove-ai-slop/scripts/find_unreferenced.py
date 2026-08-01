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
    --json            Emit JSON instead of a table.
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


def count_references(root: Path, needle: str, self_path: Path, use_rg: bool) -> int:
    """How many files other than self_path mention `needle`."""
    if use_rg:
        cmd = ["rg", "--files-with-matches", "--fixed-strings", "--no-messages", needle, str(root)]
        for d in SKIP_DIRS:
            cmd[1:1] = ["--glob", f"!{d}/**"]
    else:
        cmd = ["grep", "-rlF", "--", needle, str(root)]

    result = subprocess.run(cmd, capture_output=True, text=True)
    # grep and rg both exit 1 for "no matches", which is not an error here.
    if result.returncode not in (0, 1):
        return -1

    hits = {line for line in result.stdout.splitlines() if line.strip()}
    hits.discard(str(self_path))
    # Filter skipped dirs for the grep fallback, which has no --glob.
    hits = {h for h in hits if not any(f"/{d}/" in h for d in SKIP_DIRS)}
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

    candidates = []
    for path in walk(root):
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
    for path in candidates:
        refs = count_references(root, path.name, path, use_rg)
        if refs != 0:
            continue
        if args.stem and path.stem != path.name:
            if count_references(root, path.stem, path, use_rg) != 0:
                continue

        note = ""
        if path.stem in CONVENTION_NAMES:
            note = "convention-named — a framework may load it by path, not by reference"
        elif path.suffix in {".md", ".txt", ".rst"}:
            note = "documentation — may be linked externally or read by humans"
        elif path.suffix in {".yml", ".yaml", ".toml", ".json"} and path.parent.name.startswith("."):
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

    findings.sort(key=lambda f: (-f["lines"], f["path"]))

    if args.json:
        print(json.dumps(findings, indent=2))
        return 0

    if not findings:
        print(f"No unreferenced files found under {root}.")
        return 0

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
    return 0


if __name__ == "__main__":
    sys.exit(main())

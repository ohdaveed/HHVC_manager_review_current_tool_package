# Vendored third-party code — anti-slop Oxlint rules

Everything in this directory except this file and `LICENSE` is a **verbatim
copy** of a third-party project, checked into this repository rather than
installed from a package registry. This file records where it came from, so a
future reader can tell an upstream file from one of ours without guessing.

- **Upstream project:** [`dmmulroy/anti-slop`](https://github.com/dmmulroy/anti-slop)
  — "Opinionated Oxlint rules for rejecting low-evidence TypeScript and
  JavaScript patterns."
- **Upstream path:** `skills/install-anti-slop/assets/anti-slop/`
- **Upstream commit:** `cd064fe602b5915ff35e1e1c20836ca9bcb3729a`
  (2026-08-13, "perf: adopt Oxlint alternative plugin API")
- **License:** MIT. The upstream license text is reproduced verbatim in
  `LICENSE` beside this file, which is what the MIT terms require of a copy
  distributed this way.

**Why vendored rather than a dependency:** upstream ships these rules as the
payload of a Claude Code skill (`install-anti-slop`), not as a published npm
package, so there is no version to depend on. Copying the source in is the
distribution mechanism the project itself provides.

**Do not reformat these files.** `.prettierignore` excludes this directory on
purpose. The rule sources use tabs, semicolons and double quotes — the opposite
of this repo's Prettier settings on all three counts — and reformatting them
would turn every future upstream update into a whole-file conflict instead of a
readable diff. Same reasoning as `server.ts`: keep two formatters off the same
files.

**To update:** re-run the upstream skill's installer into a fresh directory,
diff it against this one, and bump the commit SHA above in the same change. The
SHA is the only thing that makes "verbatim copy" a checkable claim rather than
an assertion — a reader can `diff -r` this directory against that tree and get
an empty result. It was checked that way when this was added.

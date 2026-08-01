---
name: HHVC_manager_review_current_tool_package
description: Development patterns and conventions for the HHVC manager-review mockup tool. Use when writing or editing code in this repo — page data, render/state modules, review/UX layers, tests, or styles. The full canon lives in AGENTS.md at the repo root.
---

# HHVC_manager_review_current_tool_package — Development Patterns

**Read `AGENTS.md` at the repo root before writing or editing code.** It is the
tool-agnostic source of truth for this repository — architecture, the page-object
schema, validation invariants, build outputs, JS/CSS idioms, testing, and
commit/PR conventions. `CLAUDE.md` mirrors it and adds Claude Code–specific notes.

This skill is deliberately a pointer and nothing more. It used to restate a
quick-reference summary, and that summary rotted: long after the Vite migration it
still told agents this repo had "no bundler", "**No imports/exports**", and a
`tests/helpers/load-scripts.js` harness that had been deleted — and it told them
to register a new page by adding a `<script>` tag to `index.html`, which now has
exactly one. An agent following it would have edited the wrong file with
confidence. A mirror that repeats facts drifts from them; a mirror that points at
them cannot.

If you need a fact about this repo, get it from `AGENTS.md`. If `AGENTS.md` is
missing something you had to work out for yourself, add it there.

---
name: codecov-ci-integration-hhvc
description: "Integrate Codecov and observability tools into CI while respecting this repo's branch-protection gates, doc-mirror consistency rules, and test-enumeration constraints. Handle coverage reports, tokenless uploads, bundler-plugin compatibility, and configuration specific to this project. Use this skill when wiring up Codecov or other coverage tools in this repo, configuring coverage gates in CI, updating Codecov YAML, handling unloaded modules in coverage reports, or troubleshooting gaps between tool capabilities and this repo's branch-protection and test-enumeration constraints."
trigger: "Use this skill when wiring up Codecov or other coverage tools in this repo, configuring coverage gates in CI, updating Codecov YAML, handling unloaded modules in coverage reports, or troubleshooting gaps between tool capabilities and this repo's branch-protection and test-enumeration constraints."
author: arrizon.david
source_sessions:
  - arrizon.david_arrizon.david's Organization_default_7b89478f-0a56-4db2-8eed-afa9b65e5c54
contributors:
  - arrizon.david
version: 1
created_by_agent: claude_code
created_at: 2026-08-26T03:17:37.467Z
updated_at: 2026-08-26T03:17:37.467Z
---

## When to use

You're integrating Codecov (or similar observability) into CI, updating coverage configuration, verifying coverage reports are complete, or troubleshooting failures against this repo's unique constraints: branch-protection rules, doc-mirror consistency, test enumeration gates, and module-loadability patterns.

## Key constraints unique to this repo

**1. Branch protection and status contexts.** Codecov statuses (`codecov/project`, `codecov/patch`) are commit-status contexts eligible as required checks, but they're not jobs in `ci.yml`. The `tests/ci-workflow.test.js` enumeration gate only sees jobs, so it cannot track them. Set `informational: true` in `codecov.yml` to keep them non-gating — that's the only gate that prevents them from blocking merges.

**2. Doc mirrors enforce consistency.** `AGENTS.md`, `CLAUDE.md`, and `.github/copilot-instructions.md` state the same facts about CI and Codecov. Any correction to one must be applied to all three — `tests/mirror-consistency.test.js` will fail otherwise. When explaining Codecov statuses or coverage behavior, update all three mirrors together.

**3. Test enumeration is explicit.** `package.json`'s `test` script names 59 files by path, not glob. Adding a new test file requires adding it to that list, or `tests/doc-counts.test.js` fails. This includes import-only test files like `tests/module-loadability.test.js`.

**4. Coverage is load-based, not guessed.** Bun's coverage reports only files imported during a test run. Unloaded but eligible modules (e.g., `build_scripts/ai/index.js`) produce no lcov records. Do not fabricate zero-hit LCOV rows by guessing which lines are executable — write an import-only test instead, so they get real records.

## Workflow

### Coverage script setup

Bun defaults to text output. Codecov needs lcov format:

```json
"test:coverage": "bun run test --coverage --coverage-reporter=lcov"
```

This forwards flags to the enumerated test script without repeating the file list.

### GitHub Actions upload

```yaml
- name: Upload coverage
  uses: codecov/codecov-action@v5
  with:
    files: ./coverage/lcov.info
    flags: unit
    disable_search: true
    fail_ci_if_error: false # Non-gating
```

### Codecov YAML configuration

```yaml
codecov:
  require_ci_to_pass: true

github_checks:
  annotations: false # Prevent inline marks on every PR

comment:
  layout: 'diff, flags, files'
  require_changes: true # Skip bot comments when coverage didn't move

bundle_analysis:
  status: 'informational' # Document default to guard drift
```

### Unloaded modules

For eligible but unimported modules, add an import-only test:

```javascript
// tests/module-loadability.test.js
import { describe, test, expect } from 'bun:test'
import * as aiIndex from '../build_scripts/ai/index.js'

describe('Module loadability', () => {
  test('build_scripts/ai/index.js exports expected surface', () => {
    expect(aiIndex.capabilities).toBeDefined()
  })
})
```

Add it to `package.json`'s enumerated `test` list. This produces real lcov records.

### Bundler plugin (optional)

Before installing `@codecov/vite-plugin`: check that your Vite version is in its peerDependencies.

```bash
npm view @codecov/vite-plugin peerDependencies.vite
```

If compatible, gate it to CI only to avoid local build overhead:

```js
// vite.config.mjs
codecovVitePlugin({
  enableBundleAnalysis: process.env.CI === 'true',
  bundleName: 'hhvc-manager-review',
  uploadToken: process.env.CODECOV_TOKEN, // honored if set, ignored if tokenless
})
```

### Tokenless uploads

Public repos can upload without a token if your Codecov org allows it (Global Upload Token setting, admin-only). The token is honored if present, ignored if the upload qualifies as tokenless. Keep `CODECOV_TOKEN` configured; it does no harm.

### End-to-end verification

**Locally:** `bun run test:coverage && ls -lh coverage/lcov.info`

**On CI:** Watch the upload step log for "Your upload is now queued for processing" and the Codecov dashboard URL.

**After CI/deploy changes:** Verify all required contexts pass, new contexts don't sit permanently pending, and branch-protection settings match any renamed job names.

## Anti-patterns

- Leaving `github_checks.annotations: true` on sub-100% coverage
- Commenting on every PR even when coverage didn't change
- Installing a bundler plugin without checking peerDependencies
- Guessing which lines are executable instead of writing import-only tests
- Syncing `codecov.yml` to `AGENTS.md` only, forgetting the other mirrors
- Using `informational: false` and expecting CI gates to be the primary control

# Export Svelte Source Specification

## 1. Overview

This document specifies the pipeline for exporting draft page content and structure from this vanilla JS mockup repository to the Svelte application ([`hhvc-manager-review-svelte`](/home/ohdaveed/hhvc-manager-review-svelte)).

## 2. Context & Objectives

- **Role:** This repository acts as the canonical draft baseline for the 29 SF.gov HHVC pages.
- **Review Status:** Managers are not reviewing content in this draft app; draft pages in `pages/*.js` represent the canonical content baseline.
- **Target Application:** `hhvc-manager-review-svelte` (located at `/home/ohdaveed/hhvc-manager-review-svelte`), which consumes page data in `src/lib/data/*.ts` and manages corpus versions, field hashing, and review state in Supabase.

## 3. Decision Log

| ID     | Decision         | Chosen Option                      | Rationale                                                                                                                                      |
| :----- | :--------------- | :--------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------- |
| **D1** | Target Role      | Content & Data Schema Source       | Baseline draft content and presentation structure are ported cleanly to Svelte.                                                                |
| **D2** | State Source     | Static `pages/*.js` Baseline       | Draft pages represent the canonical content; no in-flight reviewer state needs merging.                                                        |
| **D3** | Target Format    | Svelte `src/lib/data/*.ts` modules | Matches `hhvc-manager-review-svelte`'s existing data pipeline and `corpus:lock` system.                                                        |
| **D4** | Packaging Method | `bun run export:svelte` script     | A dedicated CLI script in `build_scripts/export-svelte-source.js` that emits to `dist-svelte/data/` or directly updates the Svelte repository. |
| **D5** | Branch           | `main`                             | All changes executed directly off `main`.                                                                                                      |

## 4. Pipeline Design

### 4.1 Script: `build_scripts/export-svelte-source.js`

1. **Validation:** Executes Zod schema validation (`build_scripts/schema.js`) and business invariant checks (`build_scripts/data-checks.js`) over all 29 pages. Aborts on any error.
2. **Page Transformation:**
   - Loads each `pages/*.js` file via Node VM context.
   - Converts the `window.HHVC_PAGES['key'] = { ... }` assignment into an ES module export: `export const key = { ... };`.
   - Preserves all content fields: `title`, `slug`, `type`, `summary`, `audience`, `reading`, `editorNote`, `whatToKnow`, `sections`, `spotlight`, `sidebar`, `cta`.
   - Resolves card description inheritance where applicable.
3. **Index Generation:**
   - Generates `index.ts` importing all 29 modules and exporting `pagesByKey` and `allPages`.
4. **Formatting:**
   - Formats all generated `.ts` files with Prettier matching repository standards.
5. **Output Targets:**
   - Default: `./dist-svelte/data/`
   - Target flag: `--target <path>` (e.g. `--target ../hhvc-manager-review-svelte/src/lib/data` to update the Svelte repo directly).

### 4.2 Svelte Sync & Verification Workflow

When syncing to `hhvc-manager-review-svelte`:

1. Run `bun run export:svelte --target /home/ohdaveed/hhvc-manager-review-svelte/src/lib/data`.
2. In `hhvc-manager-review-svelte`:
   - Run `bun run corpus:lock` to update `corpus.lock`.
   - Run `bun run corpus:check` to verify the deterministic SHA-256 corpus digest.
   - Run `bun run check` and `bun run test:unit` to verify compilation and tests.

### 4.3 Testing Strategy

- **Unit Test (`tests/export-svelte-source.test.js`):**
  - Asserts 29 TypeScript files are generated.
  - Asserts `index.ts` correctly imports and exports all 29 page keys.
  - Asserts exported objects are syntactically valid TypeScript and match the source page objects.

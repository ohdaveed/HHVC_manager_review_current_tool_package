# AGENTS.md

## Cursor Cloud specific instructions

This is a static, no-framework HHVC/SF.gov manager-review mockup tool. There is
no backend, database, or external service — a single static server is the entire
runtime. Bun powers the dev server and the CLI scripts.

Commands are documented in `README.md` and `.github/copilot-instructions.md`
(canonical source for `dev`/`start`/`validate`/`export`/`build`/`format`).
Notable, non-obvious points:

- **Bun is required and lives on `PATH` via `~/.bun/bin`/`~/.bashrc`.** It is
  installed to `~/.bun/bin`. The startup update script installs Bun and runs
  `bun install`. Non-login shells may not pick it up automatically;
  if `bun` is not found, run `export PATH="$HOME/.bun/bin:$PATH"`.
- **Run/dev:** `bun run dev` serves at `http://127.0.0.1:8080` with `--watch`
  (auto-reloads on file changes); use `bun run start` for no-watch serving.
  Use `HOST=0.0.0.0 bun run dev` to expose it and
  `PORT=3000 bun run dev` to change the port. `start-dev.sh` first kills any stale
  listener on the port.
- **Lint:** `bun run format:check` (Prettier) is the lint step — there is no
  ESLint/tsc. `.prettierignore` excludes `data/`, `server.ts`, and the generated
  single-file HTML exports.
- **Tests:** there is no unit-test suite. `bun run validate`
  (`build_scripts/validate.js`) is the de-facto test — it Zod-validates every
  `pages/*.js` + `js/page-data.js`. It always validates the full page list; you
  cannot validate one page in isolation.
- **Build output:** `bun run build` (and `bun run export`) writes to
  `data/page_inventory.{json,csv}`. Those files are gitignored, so the `data/`
  directory is absent on a fresh clone (empty directories are not committed);
  `build_scripts/extract-pages.js` creates it automatically. Dev/serve does not
  touch `data/`; only build/export does.
- **Generated files are gitignored** (`manager-review-single-file.html`,
  `single-file-export-current-source.html`, `data/page_inventory.*`), so a clean
  build leaves the working tree clean. Never hand-edit those generated files —
  edit sources and re-run `bun run build`.
- **Reviewer state is browser-only:** all review decisions/notes persist in
  `localStorage` under `hhvcManagerReviewState:v1`; there is no server-side state.

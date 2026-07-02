# AGENTS.md

## Cursor Cloud specific instructions

This is a static, no-framework mockup/review tool for SF.gov HHVC content. Runtime is
**Bun** (see `README.md` and `package.json` scripts for the full command list). There is no
backend, database, or test framework — `bun run validate` (Zod page-data validation) is the
closest thing to tests.

Non-obvious notes for running here:

- **Bun is required and is installed to `~/.bun/bin`.** The startup update script installs Bun
  and runs `bun install`. If `bun` is not on `PATH` in a fresh shell, add it with
  `export PATH="$HOME/.bun/bin:$PATH"` (the Bun installer also appends this to `~/.bashrc`).
- **Dev server:** `bun run dev` serves the app at `http://127.0.0.1:8080` with file watching
  (`start-dev.sh` first kills any existing listener on `PORT`). Use `bun run start` for no-watch.
  Override with `PORT=` / `HOST=` env vars.
- **`bun run build` requires a `data/` directory to exist first** (`mkdir -p data`). The
  `data/` folder is gitignored and `build_scripts/extract-pages.js` writes
  `data/page_inventory.{json,csv}` without creating the folder, so a fresh clone fails the
  `export`/`build` step until `data/` is created. `bun run dev`/`start` and `bun run validate`
  do not need it.
- The app persists all state in browser `localStorage` (`hhvcManagerReviewState:v1`); there is
  no server-side persistence. Editing fields updates a live in-page preview only.

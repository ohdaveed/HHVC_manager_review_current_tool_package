---
name: starship-prompt-rendering-diagnostics
description: 'Diagnose and fix Starship prompt rendering issues on WSL2 with Windows Terminal and Nerd Fonts by measuring terminal width, glyph rendering, and `$fill` padding. Use this skill when the Starship prompt is rendering awkwardly on WSL2 — wrapping unexpectedly, overflowing the terminal edge, or displaying glyph width mismatches despite correct configuration.'
trigger: 'Use this skill when the Starship prompt is rendering awkwardly on WSL2 — wrapping unexpectedly, overflowing the terminal edge, or displaying glyph width mismatches despite correct configuration.'
author: arrizon.david
source_sessions:
  - arrizon.david_arrizon.david's Organization_default_08d84995-cbfb-4e70-b2c5-38af103f8a17
contributors:
  - arrizon.david
version: 1
created_by_agent: claude_code
created_at: 2026-08-25T15:20:52.394Z
updated_at: 2026-08-25T15:20:52.394Z
---

## The Three Failure Modes

Starship prompt rendering on WSL2 involves three independent factors, each a separate failure point:

1. **Terminal width vs. COLUMNS**: Windows Terminal's cell geometry and the shell's `COLUMNS` variable must match. If they disagree, the prompt overflows by construction.
2. **Starship's `$fill` padding**: The `$fill` directive pads the prompt to an exact width. If that width exceeds the terminal or Starship's computation is wrong, padding causes wrapping.
3. **Nerd Font glyph widths**: Glyphs like `◇` `◆` `★` render double-width in some fonts while Starship counts them as single-width, causing misalignment.

## Diagnosis Workflow

### Run the diagnostic in a real terminal

You must run this in your actual `zsh` shell with a real pty, **not** inside Claude Code's Bash tool (which reports `COLUMNS=0`):

`check-prompt.sh` ships **alongside this file**, so it is wherever this skill
is installed. From the skill's own directory:

```bash
./check-prompt.sh
```

If you are elsewhere, resolve it deterministically rather than guessing — the
script previously lived in a session scratchpad under `/tmp`, and that path
resolved to nothing the moment the session ended:

```bash
"$(dirname "$(find ~/.claude .claude -name 'check-prompt.sh' -path '*starship-prompt*' 2>/dev/null | head -1)")/check-prompt.sh"
```

The script prints three sections: `COLUMNS`, starship's computed width, and a ruler line followed by four glyph-width rows.

### Read the output

- **Ruler line wraps**: Windows Terminal's width and `COLUMNS` disagree. They must agree or the prompt overflows by construction.
- **Starship width > COLUMNS**: `$fill` is padding past the terminal edge. Remove it.
- **Glyph rows wider than the `|ab|` reference row**: Nerd Font glyphs render double-width in your font, but Starship counts them as single-width. Either switch fonts or stop using those glyphs.

## Fix: Removing `$fill`

Edit `~/.config/starship.toml`:

1. Remove `$fill` from the `format` line
2. Delete the `[fill]` table entirely
3. Update any comments mentioning `$fill`

**Consequence**: `$cmd_duration` no longer right-aligns. It now renders inline after the bun segment instead of floating at the right edge.

Open a new terminal tab to see the change (takes effect at the next `starship init`).

## Verification

- Ruler line does not wrap
- Prompt stays within the terminal edge
- `$cmd_duration` appears in the correct location

If wrapping persists after removing `$fill`, **re-run the diagnostic** — do not
jump to glyph widths. The three failure modes are independent, and the ruler
tells you which one you are still in:

- **The ruler itself wraps** — this is still a terminal-width vs `COLUMNS`
  mismatch (failure mode 1), not glyphs. Fix the width first; nothing
  downstream is measurable while the terminal and the shell disagree about how
  many cells exist.
- **The ruler is stable but a glyph row extends past the `|ab|` reference** —
  now it is glyph widths (failure mode 3). Switch fonts or stop using those
  glyphs.
- **The ruler is stable and no glyph row is over-wide** — the remaining
  wrapping is not one of these three; check for other `format` segments that
  pad, and for a `right_format` competing for the same line.

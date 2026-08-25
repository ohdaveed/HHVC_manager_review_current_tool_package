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

```bash
/tmp/claude-1000/*/*/scratchpad/check-prompt.sh
```

The script prints three sections: `COLUMNS`, starship's computed width, and a ruler line followed by four glyph-width rows.

### Read the output

- **Ruler line wraps**: Windows Terminal's width and `COLUMNS` disagree. They must agree or the prompt overflows by construction.
- **Starship width > COLUMNS**: `$fill` is padding past the terminal edge. Remove it.
- **Glyph rows wider than the `|ab|` reference row**: Nerd Font glyphs render double-width in your font, but Starship counts them as single-width. Either switch fonts or stop using those glyphs.

## Fix: Removing `$fill`

Edit `~/.config/starship.toml`:

1. Remove `$fill\` from the `format` line
2. Delete the `[fill]` table entirely
3. Update any comments mentioning `$fill`

**Consequence**: `$cmd_duration` no longer right-aligns. It now renders inline after the bun segment instead of floating at the right edge.

Open a new terminal tab to see the change (takes effect at the next `starship init`).

## Verification

- Ruler line does not wrap
- Prompt stays within the terminal edge
- `$cmd_duration` appears in the correct location

If wrapping persists after removing `$fill`, the issue is glyph widths; investigate with the diagnostic ruler.

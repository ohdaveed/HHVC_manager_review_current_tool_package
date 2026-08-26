---
name: windows-terminal-claude-dev-setup
description: "Fix rendering artifacts in Windows Terminal's Claude Code, remove stale configuration, and add hotkey-driven profiles to launch Claude sessions in WSL repositories. Use this skill when experiencing rendering glitches in Windows Terminal while running Claude Code, or when setting up convenient hotkey shortcuts to launch Claude in specific WSL projects."
trigger: 'Use this skill when experiencing rendering glitches in Windows Terminal while running Claude Code, or when setting up convenient hotkey shortcuts to launch Claude in specific WSL projects.'
author: arrizon.david
source_sessions:
  - arrizon.david_arrizon.david's Organization_default_157935d8-7d04-4b58-95e5-82a55af69712
  - arrizon.david_arrizon.david's Organization_default_92b22506-973c-42d4-86ad-99464d23c191
  - arrizon.david_arrizon.david's Organization_default_6a513126-9df3-44e7-86d2-d5736946d21c
contributors:
  - arrizon.david
version: 1
created_by_agent: claude_code
created_at: 2026-08-25T22:06:01.071Z
updated_at: 2026-08-25T22:06:01.071Z
---

## Rendering artifacts in Claude Code

Claude Code redraws by moving the cursor up N lines and overwriting them. When a logical line soft-wraps across multiple physical rows, the erase count comes up short and stale text from the previous frame survives onscreen.

Three levers reduce it:

1. **Zoom out** (`Ctrl+-` in Windows Terminal) — fewer wraps, fewer miscounts. This is the primary lever: a large font causes nearly every prose line to wrap, multiplying the artifact frequency.
2. **`forceFullRepaint: true`** — experimental setting in `settings.json` (global or per-profile under `profiles.defaults`). Repaints the whole viewport per frame instead of diffing cells. Costs CPU but eliminates stale-row artifacts. Worth enabling if duplication persists after zooming out.
3. **`Ctrl+L`** when it happens — forces a clean repaint (cosmetic recovery, not prevention).

## Remove stale configuration

`settings.json` accumulates dead `backgroundImage` references to paths that no longer exist. Terminal warns on launch: _"One or more resources … could not be found."_

**Remedy:** Open `%USERPROFILE%\AppData\Local\Packages\Microsoft.WindowsTerminal_*\LocalState\settings.json`, remove every dead `backgroundImage`, `backgroundImageOpacity`, and related key, then verify the file parses (`jq . < settings.json`). Common case: Pictures folder is OneDrive-redirected; a baked-in `C:/Users/name/Pictures/terminal/*.png` path won't resolve.

## Add repo-access profiles with hotkeys

Create a Terminal profile that launches Claude in a specific repo and binds it to a hotkey.

In `settings.json`, add a profile to `profiles.list`:

```json
{
  "name": "Claude — <repo-name>",
  "commandline": "wsl.exe -d Ubuntu --cd /path/to/repo -- zsh -ic \"claude; exec zsh\"",
  "tabTitle": "Claude — <repo-name>",
  "icon": "🤖",
  "guid": "{<UUID>}"
}
```

Add a keybinding (to `keybindings` or `profiles.defaults`):

```json
{
  "command": {
    "action": "newTab",
    "profile": "Claude — <repo-name>"
  },
  "keys": "ctrl+shift+<letter>"
}
```

**Critical details:**

- **`zsh -ic`, not `-c`** — Claude lives at `~/.local/bin/claude`, which lands on PATH only via zshrc. The `-i` flag ensures zshrc runs.
- **`exec zsh` at the end** — quitting Claude closes the tab by default. This drops into a normal shell in the repo instead, keeping the tab open.
- **`--cd /path/to/repo`** — absolute WSL path to the repo root.
- **UUID** — generate with `cat /proc/sys/kernel/random/uuid` in WSL.

**Verification:** `jq . < settings.json` parses, hotkey shows in new-tab dropdown (`Ctrl+Shift+Space`), and launching the profile opens Claude in the correct repo.

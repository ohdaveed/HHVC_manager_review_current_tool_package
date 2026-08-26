#!/usr/bin/env bash
# check-prompt.sh — the diagnostic this skill's workflow refers to.
#
# MUST be run in a real terminal with a real pty. Claude Code's Bash tool
# reports COLUMNS=0 and no window size, so every number below comes out wrong
# there — which is the whole reason this is a script you run yourself rather
# than something an agent runs for you.
#
# It prints three sections, matching the three independent failure modes in
# SKILL.md: the width the shell believes it has, the width Starship actually
# renders, and a visual ruler plus glyph rows you compare by eye.
set -uo pipefail

# `tput cols` asks the terminal; `$COLUMNS` is what the shell believes. They
# disagree exactly when the prompt overflows by construction, so both are
# printed rather than one.
term_cols=$(tput cols 2>/dev/null || echo "unknown")
shell_cols=${COLUMNS:-unset}

echo "== 1. Width =="
echo "  tput cols (terminal) : $term_cols"
echo "  \$COLUMNS   (shell)   : $shell_cols"
if [ "$term_cols" != "unknown" ] && [ "$shell_cols" != "unset" ] &&
  [ "$term_cols" != "$shell_cols" ]; then
  echo "  MISMATCH — the prompt will overflow regardless of Starship config."
fi
echo

# Starship exposes no "computed width" flag (checked against 1.25.1), so the
# only honest measurement is to render the prompt and count what it emits.
# ANSI escapes are stripped first; they occupy no cells. The LONGEST line is
# what matters, since the prompt is multi-line.
echo "== 2. Starship rendered width =="
if command -v starship >/dev/null 2>&1; then
  width_arg=${term_cols:-80}
  [ "$width_arg" = "unknown" ] && width_arg=80
  rendered=$(starship prompt -w "$width_arg" 2>/dev/null |
    sed -e 's/\x1b\][^\x07]*\x07//g' -e 's/\x1b\[[0-9;?]*[a-zA-Z]//g')
  # awk's length() counts characters in a UTF-8 locale. It counts a
  # double-width glyph as ONE, which is precisely the assumption Starship
  # makes and section 3 exists to test — so a number here that looks fine
  # does not rule out the glyph failure mode.
  starship_width=$(printf '%s\n' "$rendered" | awk '{ if (length($0) > m) m = length($0) } END { print m + 0 }')
  echo "  longest rendered line: $starship_width cells (as Starship counts them)"
  if [ "$term_cols" != "unknown" ] && [ "$starship_width" -gt "$term_cols" ]; then
    echo "  OVERFLOW — \$fill is padding past the terminal edge. See 'Fix: Removing \$fill'."
  fi
else
  echo "  starship not on PATH — skipped."
fi
echo

# Visual, not computed. The ruler shows where the terminal actually wraps;
# the glyph rows show whether a Nerd Font glyph occupies more cells than
# Starship assumed. Compare the rows BY EYE against the |ab| reference.
echo "== 3. Ruler and glyph widths =="
if [ "$term_cols" != "unknown" ]; then
  ruler=$(awk -v n="$term_cols" 'BEGIN { for (i = 1; i <= n; i++) printf "%s", (i % 10 == 0 ? "|" : "-") }')
  echo "$ruler"
  echo "  ^ if this wraps to a second line, the terminal and \$COLUMNS disagree (section 1)."
else
  echo "  (no terminal width available — ruler skipped)"
fi
echo
echo "  |ab|  <- reference: two single-width cells between the bars"
echo "  |◇◇|  <- white diamond"
echo "  |◆◆|  <- black diamond"
echo "  |★★|  <- star"
echo "  |  |  <- powerline separator"
echo
echo "  Any row whose closing bar sits further right than the |ab| row holds a"
echo "  glyph your font renders double-width while Starship counts it single."

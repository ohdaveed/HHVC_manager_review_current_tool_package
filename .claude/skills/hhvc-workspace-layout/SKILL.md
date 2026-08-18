---
name: hhvc-workspace-layout
description: 'HHVC repo: why `#reviewWorkspace` is a third grid column rather than the last child of `.canvas` — the co-visibility argument, why `.review-workspace[hidden] { display: none }` is load-bearing, why the stacked panel uses `grid-column: 2` and not `1 / -1`, and the 2026-08-15 re-measurement behind the 1700px breakpoint. Load before editing the workspace layout in css/dashboard.css, css/ux-improvements.css, or js/ux-improvements-workspace.js.'
---

<!-- Extracted from CLAUDE.md/AGENTS.md on 2026-08-15. AGENTS.md remains the
     canonical copy of this content; see "Cross-tool canon" there. -->

# The workspace is docked, not stacked

`#reviewWorkspace` is a **third grid column in `.app`**, sticky to the viewport,
not the last child of `.canvas`. It used to be the latter, and the numbers are
the argument: the mockup runs about 8,766px, so the panel began around y=9,413
in a 10,348px document — more than nine screenfuls down. A reviewer could never
see the page and the instruments judging it at once, which was sharpest on
**Page checks**, a panel that scores _the page currently in the mockup_ and
rendered that score nine screens away from it.

Most of the redundancy this layout accumulated followed from that: the same fact
had to be repeated wherever the reviewer might be looking. Co-visibility is what
makes one copy enough, so resist re-adding a second printing of anything.

- **`.app.workspace-docked` is what grows the third column**, toggled alongside
  the panel's `hidden` attribute. `applyWorkspaceVisibility()` in
  `js/ux-improvements-workspace.js` is the single place that does both, plus the
  toggle button's label and `aria-expanded`. The first-run onboarding path used
  to set `hidden` inline and duplicate two of the three steps — which is exactly
  how it came to miss the third, giving a first-run reviewer an open panel the
  grid had made no room for.
- **`.review-workspace[hidden] { display: none }` is load-bearing.** The rule
  above it sets `display: flex`, and a class selector outranks the UA
  stylesheet's `[hidden] { display: none }`, which is where that attribute's
  entire effect lives. Without the pairing, "Hide workspace" and the `w`
  shortcut both appeared to do nothing. Any element that both carries `hidden`
  and declares its own `display` needs this.
- **Below 1700px the panel returns under the canvas, in `grid-column: 2`** —
  deliberately not `1 / -1`. Spanning both columns puts it beneath the sticky,
  full-height sidebar, which then slides over the queue's left edge as the
  reviewer scrolls. Axe caught that before a human did (57 queue cells reported
  as "background could not be determined, partially obscured by another
  element"); it is invisible in a screenshot taken at scroll position 0.
- **The breakpoint is 1700px because that is where three columns actually
  fit**, and it was 1400px for a while, which is not. `.browser-shell` will not
  shrink past its min-content floor — re-measured at 765px on 2026-08-15, down
  from 780px before the SFDS type and spacing work — so it ends at a fixed
  x=1155 (370 sidebar + 20 canvas padding + 765) however narrow its column
  gets, while the panel starts at `100vw - 30vw`. Those cross at 1155/0.7 =
  1650px: every width from 1401px to there docked the panel _on top of_ the
  mockup — 147px of overlap at 1440, 80px at 1536, 35px at 1600. **1700 stayed
  after that re-measurement rather than moving down onto 1650**, because it was
  already a round-up over the old 1671 crossing and the new floor widens that
  margin instead of eating it; 1650–1700 is a band no real display reports, and
  the margin is what covers browser zoom and the widths the 40px test sweep
  never visits. Do not lower it without re-measuring both numbers — the
  crossing is now asserted from the live layout in
  `tests/e2e/workspace-panels.spec.js`, so a shell that grows past its floor
  fails there rather than shipping. The cost is
  that a 14-inch laptop (1512 CSS px) now stacks rather than docks; squeezing
  the mockup instead is the other way out and is rejected on purpose, since it
  would misrepresent the page under review.
- **Any new layout assertion should sweep a range of widths, not pick one.**
  The overlap survived because the only two widths under test sat either side
  of it: `workspace-panels.spec.js` set 1800 to prove docking, and every other
  spec ran at Playwright's 1280 default. The assertion added for it samples
  1280→1920 in 40px steps for that reason.

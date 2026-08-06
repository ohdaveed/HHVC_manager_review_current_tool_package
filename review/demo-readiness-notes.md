# Demo readiness notes

A pre-presentation review pass over the tool: design, functional, and logic.
Written to be read once before the meeting.

## Before you start

**Present at 1720px CSS width or wider** if you want the docked three-column
layout — mockup on the left, review workspace on the right. Below 1700px the
workspace moves under the mockup instead. Both layouts are correct; they just
look different, and it is worth knowing which one you will get rather than
finding out in the room.

To check in the room, in the browser console: `window.innerWidth`. Note this is
**CSS pixels, not the screen's resolution** — display scaling changes it. A
1920px screen at the 125% scaling Windows ships by default reports 1536, which
stacks.

```bash
bun install                 # required — a fresh clone has no node_modules
bun run start               # builds dist/ and serves on :8080
```

Then import `review/demo-review-state.json` through **Import reviews** in the
sidebar. Without it the tool opens at 0 of 19 reviewed and every panel that
makes the case — progress, decision mix, activity over time, history — is empty.
With it: 12 of 19 reviewed, 20 recorded review rounds, four decision types in
play. `review/demo-review-state-empty.json` resets it if you want to show the
first-run state deliberately.

## What this pass found and fixed

Four real defects, all on surfaces the room will see. All four came in with the
two large PRs that merged in the 24 hours before this review (#93 docking the
workspace, #94 tech debt), and all four were invisible to a green CI run.

1. **The mockup overlapped the review panel between 1401px and ~1672px.** 162px
   of overlap at 1440, 100px at 1536, 50px at 1600 — the widths 13-inch and
   14-inch laptops and scaled 1920px displays actually report. The breakpoint
   said "dock" at 1400px while the mockup, which refuses to shrink below about
   780px, was still wider than the column left for it. Fixed by moving the
   breakpoint to where three columns genuinely fit. **This one would very
   likely have shown up on stage.**
2. **44 WCAG 2.1 AA contrast failures on the Page checks tab.** Its text sat at
   4.37:1 against the panel behind it, under the 4.5:1 required. It passed when
   that content was on a white panel; docking the workspace changed the surface
   underneath it and took the ratio down without anyone re-measuring.
3. **4 more contrast failures on the Help tab**, plus a layout break: a blanket
   `card span` style rule reached into the Karl tag legend when #93 moved the
   legend into Help, overriding the darker colour the legend carries
   deliberately and stacking pills designed to sit inline.
4. **The Page checks panel could not be scrolled by keyboard at all.** It is a
   scrollable region that was not in the tab order, so there was no way to put
   the caret in it.

Also fixed: the Agency page's SEO title was missing the `| SF.gov` suffix that
the other 16 pages carry. Content standard failures went from 11 to 10, and
**the Agency page — the first one the review packet says to open — now passes
all of its mandatory checks.**

Why they were missed: the accessibility scan never opened the Checks or Help
tabs, and the only two screen widths under test were 1800px (in one test) and
1280px (everything else) — either side of the overlap. Three new tests now close
both gaps, including one that sweeps every width from 1280 to 1920.

Verified green after all changes: 533 unit tests, 110 end-to-end tests, schema
validation, and the lint step.

## Questions you should expect, with answers

**"Why does every page say Needs review?"**
That block is labelled *Editor-only QA note / Do not publish* and it renders on
all 19 pages by design — the default is "not yet signed off" and a page has to
earn its way out of it. Three pages carry a stronger explicit flag, below.

**"You said 4 blocked but I only count 2."**
The Blocked filter deliberately groups *Blocked* with *Revise and resubmit* —
both mean "cannot publish yet." The count and the filter always agree; they are
one control. (An earlier tile that counted one thing and labelled it another was
removed for exactly this reason.)

**"Your own checks are failing on 10 items."**
That is the tool working. They are real, specific, and each cites the standard
it comes from: four buttons over 25 characters, two pages averaging long
sentences, one "click here" style link, one page using contractions, two SEO
titles missing the site suffix. None is a blocker; all are one-line content
edits. A tool that reported everything passing on a 19-page draft would be the
thing to worry about.

**"Is it accessible?"**
Every page and all three workspace tabs are scanned against WCAG 2.1 A and AA on
every commit, and the build fails on a serious or critical violation. That scan
is what caught three of the four defects above.

**"Where does the data live? Is anything sent anywhere?"**
Reviews are saved in the browser's local storage only. No backend, no database,
no external service. It works fully offline, including the images. There is an
optional sync server and an optional AI drafting panel, both off unless
configured, and both off for this demo.

## Pages with open flags — expect these to come up

| Page | Flag | Open items |
| --- | --- | --- |
| How to respond to a notice of violation | **Blocked** | NOV templates, appeal windows, contact routes, free-visit sequencing — needs Legal |
| Find residential hotel and shelter records | Placeholder | Interim sfdph.org URL; real lookup entry point unconfirmed |
| Free mosquito education workshop | Placeholder | Capacity, lead time and intake backend are illustrative |

Also outstanding: the real SF.gov payment URL for the fee page (its button is
inert until confirmed), and the FY26–27 fee schedule PDF for the owner hub.
Ten individual claims across four pages carry an **Unverified** pill with the
reason in the tooltip; five of them are on *What happens after you report*, so
that page shows the most.

## Two buttons not to click by accident

- **Clear saved reviews**, in the sidebar next to Export and Import.
- **Remove these records**, inside Stored review data at the end of Help.

Both ask for confirmation first, and the seed file will restore everything.

## Known gaps — say these if asked, do not discover them live

- **Dark mode is unverified.** The accessibility scan only runs in light mode.
  The mockup itself is pinned to light regardless of system theme, so a dark
  laptop only darkens the review chrome around it — but it has not been checked.
  Set the machine to light mode.
- **Docking is unavailable below 1700px.** That is a deliberate trade made
  tonight — a correct stacked layout instead of a broken overlapping one — but
  it does mean a 14-inch laptop no longer gets the side-by-side view the recent
  work was built for. The proper fix is to let the mockup shrink gracefully, and
  that is a design decision, not a same-day one.
- **The initial download is 182 kB gzip**, not the ~114 kB the docs claim. Worth
  a look afterwards; not worth raising unless performance comes up.
- **The AI drafting and sync panels will read "not configured"** if anyone opens
  them. That is their correct off state, not an error.

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

Then seed the review state. **Order matters. Importing merges per page, and for
a page the file names, the file wins** — the seed's decision, notes, risks,
owner and reviewer replace whatever was there. Pages the file does *not* name
are left untouched. So on a browser you have used before, importing the seed
both fails to give you a clean 12 of 19 *and* overwrites real review work on any
of those 12 pages:

1. If this browser holds review work you care about, export it first
   (**What to export → "Everything, for another browser — JSON"** → **Export
   reviews**).
2. Click **Clear saved reviews** and confirm. This is the only thing that
   actually clears local state.
3. Import `review/demo-review-state.json` through **Import reviews**.

Without the seed the tool opens at 0 of 19 and every panel that makes the case —
progress, decision mix, activity over time, history — is empty. With it: 12 of
19 reviewed, four decision types, and 32 recorded review rounds (the file
carries 20; the import records one more per page, by design, so the trail shows
who loaded them).

To show the first-run state deliberately, use **Clear saved reviews** and
re-import afterwards. There is no "empty backup" file — an empty import is a
no-op, because the import path merges per page and returns early when the file
names none.

## What this pass found and fixed

Six real defects, all on surfaces the room will see. All of them came in with
the two large PRs that merged in the 24 hours before this review (#93 docking
the workspace, #94 tech debt), and all of them were invisible to a green CI run.

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
5. **In dark mode, body copy inside the mockup was invisible — 1.1:1.** The
   mockup is deliberately pinned to a light theme so it stays a faithful preview
   of a public page. But text colour is inherited as an already-computed value,
   so the dark theme's near-white text leaked straight past those light tokens
   onto the mockup's light background. On a dark-mode laptop, most of the page
   copy simply could not be read.
6. **Every keyboard shortcut key was illegible in dark mode — 2.09:1.** The
   SF.gov design system ships a fixed light-mode blue for `kbd` with no dark
   counterpart, and it outranked the panel's own colour.

Also fixed: the Agency page's SEO title was missing the `| SF.gov` suffix that
the other 16 pages carry. Content standard failures went from 11 to 10, and
**the Agency page — the first one the review packet says to open — now passes
all of its mandatory checks.**

Why they were missed: the accessibility scan never opened the Checks or Help
tabs and never ran in dark mode, and the only two screen widths under test were
1800px (in one test) and 1280px (everything else) — either side of the overlap.
New tests now close all three gaps, including one that sweeps every width from
1280 to 1920 and five that scan in dark mode.

Verified green after all changes: 533 unit tests, 117 end-to-end tests, schema
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
it comes from — ten failing checks across the nineteen pages:

- **button text over 25 characters** — 4 pages (five buttons in total;
  `insectsReport` has two, so the page count and the button count differ)
- **average sentence length** over the Grade 6 target — 2 pages
- **a generic "click here" style link** — 1 page
- **contractions** — 1 page
- **SEO titles missing the site suffix** — 2 pages

None is a blocker; all are one-line content edits. A tool that reported
everything passing on a 19-page draft would be the thing to worry about.

**"Is it accessible?"**
Automated WCAG 2.1 A and AA scans run on every commit and the build fails on a
serious or critical violation. Coverage, precisely:

- **Light mode** — one representative page per content type (**six** of the
  nineteen), plus all three workspace tabs and the shortcuts dialog.
- **Dark mode** — all three workspace tabs, plus **two** pages (the Agency page
  and one Transaction).

Be precise about that if pressed. It is representative coverage, chosen because
the nineteen pages are built from the same render functions, not a scan of every
page — so a defect in markup unique to one unscanned page could still get
through. Those scans caught five of the six defects this pass fixed.

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

Both ask for confirmation first, and re-importing `review/demo-review-state.json`
restores the demo state. Note that **Clear saved reviews** is also the intended
way to reset between runs — it is destructive by design, not a trap.

## Known gaps — say these if asked, do not discover them live

- **Dark mode is now verified and clean**, so this is no longer a gap — but it
  was a bad one, and it is worth knowing what was there in case anyone asks why
  it changed. Body copy inside the mockup was rendering at 1.1:1 — effectively
  invisible — because `color` is inherited as a computed value, so the dark
  theme's text colour leaked past the light tokens onto the mockup's light
  background. Every keyboard shortcut key was at 2.09:1 for a different reason.
  Both are fixed and both are now scanned on every commit.

  What that does and does not license: **the paths this demo actually walks are
  clean in both themes**, which is what matters tomorrow. It is not a
  whole-product guarantee — the dark-mode scan covers the three workspace tabs
  and two of the nineteen pages, so the other seventeen have never been rendered
  under a dark scan. The reason that is a small risk rather than an open one is
  structural rather than statistical: the mockup declares `color-scheme: light`
  and re-pins its colours, so page content renders light whatever the system
  theme is. The bug that was found was precisely a leak across that boundary,
  and the fix closed the boundary rather than patching one page.

  Presenting in light mode still removes the question entirely, if you would
  rather not have it.
- **Docking is unavailable below 1700px.** That is a deliberate trade made
  tonight — a correct stacked layout instead of a broken overlapping one — but
  it does mean a 14-inch laptop no longer gets the side-by-side view the recent
  work was built for. The proper fix is to let the mockup shrink gracefully, and
  that is a design decision, not a same-day one.
- **The initial download is 182 kB gzip**, not the ~114 kB the docs claim. Worth
  a look afterwards; not worth raising unless performance comes up.
- **The AI drafting and sync panels will read "not configured"** if anyone opens
  them. That is their correct off state, not an error.

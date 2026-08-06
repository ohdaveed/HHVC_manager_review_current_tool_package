# Demo run-of-show

The order to do things in. For *what you need to know*, read
`review/demo-readiness-notes.md` — this file assumes you have.

Times are rough and assume a 20-minute slot with questions at the end. Beats 6
and 7 are the ones to cut if you are running short.

---

## Setup (do this before anyone is in the room)

```bash
export PATH="$HOME/.bun/bin:$PATH"
bun install          # only needed on a fresh clone
bun run start        # builds and serves on http://127.0.0.1:8080
```

1. Open `http://127.0.0.1:8080`.
2. **Check the width.** In the console: `window.innerWidth`.
   - **1720 or more** → the workspace docks beside the mockup. This is the
     layout you want.
   - **Under 1700** → the workspace stacks underneath. Still correct, but you
     lose the side-by-side story. Reduce display scaling or move to a bigger
     screen if you can.
3. **Set the machine to light mode.** Dark mode is now verified and clean, but
   the mockup is deliberately pinned to light either way, so light avoids any
   mismatch between what you say and what they see.
4. In the sidebar under **Manager review**, click **Import reviews** and choose
   `review/demo-review-state.json`. The Overview should now read **12/19
   reviewed**.
5. Press `w` to confirm the workspace opens and closes. Leave it open.

If you want to show the empty first-run state at any point, import
`review/demo-review-state-empty.json` to clear, and re-import the seed to
restore. Both take about two seconds.

---

## Beat 1 — What this is (1 min, no clicking)

You are looking at a **mockup of a redesigned SF.gov section**, plus the tool
built to review it. Nineteen pages, one information architecture, and a
structured way for managers to sign each page off.

The thing to say early, because it pre-empts the obvious question: **nothing
here is published, and nothing here can publish.** It is a review instrument.

---

## Beat 2 — The Agency page (2 min)

Opens on **Healthy Housing and Vector Control** — the page the review packet
tells managers to look at first.

Point at the **service grouping**: scannable groups instead of one long mixed
link list, which is what the old Topic page was. Nineteen pages replaced a
33-to-40 page set.

Scroll to the **Editor QA** block at the bottom.

> "Every page carries one of these. The default is *not yet signed off* — a page
> has to earn its way out of it. Three pages carry something stronger, and I'll
> show you one."

---

## Beat 3 — The repeated pattern (2 min)

Sidebar picker → **Report rats, mice, and other four-legged problems**.

This is one of three consolidated report Transactions. The point is that they
are the *same* pattern — "choose the closest problem" — rather than a page per
pest. Flip to **Report garbage, filth, and overgrown vegetation** to show it
repeating.

> "This is the highest-traffic path on the site. One shape, learned once."

---

## Beat 4 — Honest status (2 min)

Picker → **How to respond to a notice of violation**.

The Editor QA block reads **⛔ Blocked**.

> "This page cannot go out until Legal confirms the notice templates and the
> appeal windows. The tool says so on the page itself, and it will not let it be
> marked approved by accident."

Two other pages carry **Placeholder**: the residential hotel records lookup, and
the mosquito workshop. Worth naming so nobody thinks the flags are decorative.

---

## Beat 5 — The checks are real (3 min) — *the credibility beat*

Picker → **Property owner responsibilities**. Then open **Page checks**
(press `2`).

This page fails two mandatory checks, and both are legible to a non-specialist:

| Failing | What it says |
| --- | --- |
| Average sentence length | 15.5 words per sentence, target 15 or fewer — **Manual §7.2.2** |
| Descriptive link text | one link is generic ("click here") — **Manual §7.5** |

> "These aren't opinions. Each one cites the section of the content standards
> manual it comes from, so if you disagree you know which document to go argue
> with."

Failures sort to the top, so what a reviewer can act on is what they see first.

If asked how many there are across the site: **ten mandatory failures across 19
pages**, all one-line content edits. The Agency page passes all of its.

---

## Beat 6 — The review workflow (4 min) — *the strongest single beat*

Press `1` for **Overview**.

Walk it top to bottom:

- **12 of 19 reviewed** — progress, not a guess.
- **Filter chips** — click **Blocked**. Four pages. Say plainly that this groups
  *Blocked* with *Revise and resubmit*, because both mean "cannot publish yet";
  the count and the filter are one control, so they can never disagree.
- **Review activity** — decisions accumulating over the last fortnight.
- **Pages whose checks are failing** — ranked, worst first.

Then the part worth doing live:

1. Tick two or three rows.
2. Click **Approve** in the bulk bar.
3. Press `z` — or click the undo button that appears in the bulk bar. It names
   what it will reverse rather than just saying "Undo", so you can read it aloud.

> "The undo doesn't erase anything. It writes the previous state back as a new
> recorded round, so the trail reads *set to Approved, then reverted* — because
> that's what happened. You can't quietly remove a decision from the record."

That is the single most convincing thing in the tool: it is auditable by
construction.

---

## Beat 7 — Reviews survive (2 min) — *cut this first if short*

In the sidebar, set **What to export** to *"Everything, for another browser —
JSON"* and click **Export reviews**. Then click **Import reviews** and choose
the file you just exported.

Nothing is lost, and nothing is duplicated. Imports **merge** — they never
replace.

> "That matters because reviews live in this browser. The export is how you move
> them between machines or hand them to someone else, and it has to be safe to
> re-import a stale copy."

---

## Beat 8 — Close (1 min)

Three sentences:

- Nineteen pages, one IA, reviewable page by page with a recorded decision trail.
- The standards are enforced by the tool, not remembered by a person — and it
  catches things on our own pages, including the flagship one.
- It runs offline, stores nothing outside the browser, and sends nothing
  anywhere.

Then stop and take questions. The answers to the likely ones are in
`review/demo-readiness-notes.md`.

---

## If something goes wrong

| Symptom | What to do |
| --- | --- |
| Panels look empty / everything says "Not reviewed yet" | The seed did not import. Sidebar → **Import reviews** → `review/demo-review-state.json`. |
| You clicked **Clear saved reviews** | Re-import the seed. Nothing is lost that the file does not restore. |
| Full-width red banner appears | Something threw. Reload the page — review state is saved and will come back. Do not debug it live. |
| Workspace sits under the mockup, not beside it | The window is under 1700px. Expected, not broken. Carry on; the layout is the only difference. |
| Charts missing but the numbers are there | The chart library is a separate lazy-loaded file. The data tables beside it are the real content — carry on. |
| A panel says "Not configured" | The optional sync and AI drafting servers are off by design. That is their correct state, not an error. |

**Do not demo live** unless you have rehearsed it: the AI drafting panel (needs
a key and makes a real model call) and **Save all mockups as PNGs** (navigates
all 19 pages in sequence). Neither is needed for the story above.

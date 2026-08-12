# Demo run-of-show

The order to do things in. For *what you need to know*, read
`review/demo-readiness-notes.md` — this file assumes you have.

Times are rough and assume a 20-minute slot with questions at the end. Beats 6
and 7 are the ones to cut if you are running short.

---

## Setup (do this before anyone is in the room)

```bash
export PATH="$HOME/.bun/bin:$PATH"
bun install                                   # only needed on a fresh clone
bun build_scripts/make-demo-review-state.js   # refresh the seed's dates
bun run start                                 # serves on http://127.0.0.1:8080
```

Regenerate the seed if any time has passed since it was last committed. The
dates inside it are fixed when it is generated and the activity chart plots them
as they are — so a stale file charts stale dates while this script talks about
recent reviewing. The generator takes a second and keeps the two in step.

1. Open `http://127.0.0.1:8080`.
2. **Check the width — this one is a prerequisite, not a preference.** In the
   console: `window.innerWidth`.
   - **1720 or more** → the workspace docks beside the mockup. Run the script
     as written.
   - **Under 1700** → the workspace stacks *below the whole mockup*, roughly
     eleven screenfuls down at a laptop height (measured: the panel starts at
     ~8,994px). The layout is correct, but **the script's keystrokes
     will look broken**: with the workspace already open, `1`/`2`/`3` switch the
     panel without scrolling to it, so you press a key and nothing visibly
     happens. Get above 1720 if you possibly can — reduce display scaling, or
     use a larger screen.

     If you are stuck narrower, two things work:
     - **Scroll down** to the panel after switching tabs, or
     - press **`w` twice** (close, reopen) — reopening focuses the active tab,
       which brings the panel into view.

     Rehearse whichever one you will use. Do not discover it live.
3. **Either colour scheme works for this walkthrough.** The pages and panels
   below are scanned clean in both, and the mockup is pinned to light either
   way, so the page under review looks identical. Light mode removes the
   question entirely if you would rather not field it — see the coverage note in
   `demo-readiness-notes.md` for what the dark scan does and does not cover.
4. **Seed the review state, in this order.** Importing merges *per page*, and
   for the 12 pages the seed names, the seed's values replace whatever was
   there. Pages it does not name are left alone. So skipping the clear step on
   a browser you have used before will not give you 12/29, and will overwrite
   any real review work on those 12 pages.
   1. If this browser holds review work you care about, export it first:
      **What to export → "Everything, for another browser — JSON"** →
      **Export reviews**.
   2. **Clear saved reviews**, and confirm.
   3. **Reload the page.** Do not skip this. Clearing empties the saved data and
      the review form, but any edited title / summary / CTA / SEO text that had
      already been restored onto the page stays there until a reload rebuilds
      the page from source — and the seed cannot undo it, because it carries no
      page-content fields. The reload also returns you to the Agency page, which
      is where Beat 2 starts.
   4. **Import reviews** → `review/demo-review-state.json`.

   The Overview should then read **12/29 reviewed**.
5. **Click once on the mockup** before trying any keyboard shortcut, then press
   `w` to confirm the workspace opens and closes. Leave it open.

> ### Keyboard shortcuts need focus in the right place — read this once
>
> Shortcuts only fire when focus is inside the **mockup**, the **toolbar above
> it**, or the **workspace panel**. That is deliberate — it stops single letters
> firing while you type in the sidebar — but it has one consequence worth
> knowing before you are standing up. Measured, not guessed:
>
> | Right after you… | Next shortcut |
> | --- | --- |
> | **change the page** with the sidebar picker | **works** — rendering moves focus to the page heading |
> | click a sidebar **button** (Import, Clear, Export) | **ignored** |
> | click a sidebar **decision chip** | **ignored** |
> | click anywhere in the mockup or the workspace | **works** |
>
> So the trap is narrow but real: after pressing a sidebar *button*, the next
> key does nothing at all — no error, no feedback. **Click the mockup once** and
> it works again. The visible buttons and tabs always work regardless, and this
> script uses them wherever focus would otherwise be in doubt.

To show the empty first-run state at any point, use **Clear saved reviews** and
reload; reload and re-import the seed to get back. There is no "empty backup"
file to import: an empty import does nothing at all, because the import path
merges per page and returns early when the file names none.

---

## Beat 1 — What this is (1 min, no clicking)

You are looking at a **mockup of a redesigned SF.gov section**, plus the tool
built to review it. Twenty pages, one information architecture, and a
structured way for managers to sign each page off.

The thing to say early, because it pre-empts the obvious question: **nothing
here is published, and nothing here can publish.** It is a review instrument.

---

## Beat 2 — The Agency page (2 min)

Opens on **Healthy Housing and Vector Control** — the page the review packet
tells managers to look at first.

Point at the **service grouping**: scannable groups instead of one long mixed
link list, which is what the old Topic page was. Twenty pages replaced a
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
> appeal windows. The tool carries that on the page itself, so it travels with
> the content instead of living in someone's inbox."

**Do not say the tool prevents approving it.** It does not — `editorStatus`
drives the banner and nothing else; no decision path, queue action or shortcut
consults it, so a reviewer can mark this page Approved immediately. The flag is
advisory, and claiming enforcement is the kind of thing a director will test.
If asked directly whether it is enforced, say no, and that the enforcement that
does exist is the recorded decision trail — you can always see who approved a
flagged page and when.

Two other pages carry **Placeholder**: the residential hotel records lookup, and
the mosquito workshop. Worth naming so nobody thinks the flags are decorative.

---

## Beat 5 — The checks are real (3 min) — *the credibility beat*

Picker → **Property owner responsibilities**. Then open **Page checks** —
click the tab, or press `2` (changing the page puts focus back on the mockup, so
the shortcut works here).

This page fails two mandatory checks, and both are legible to a non-specialist:

| Failing | What it says |
| --- | --- |
| Average sentence length | 15.5 words per sentence, target 15 or fewer — **Manual §7.2.2** |
| Descriptive link text | one link is generic ("click here") — **Manual §7.5** |

> "These aren't opinions. Each one cites the section of the content standards
> manual it comes from, so if you disagree you know which document to go argue
> with."

Failures sort to the top, so what a reviewer can act on is what they see first.

If asked how many there are across the site: **eleven mandatory failures across 20
pages**, all one-line content edits. The Agency page passes all of its.

---

## Beat 6 — The review workflow (4 min) — *the strongest single beat*

Press `1` for **Overview** (focus is in the workspace from the previous beat, so
the shortcut works) — or click the tab.

Walk it top to bottom:

- **12 of 29 reviewed** — progress, not a guess.
- **Filter chips** — click **Blocked**. Four pages. Say plainly that this groups
  *Blocked* with *Revise and resubmit*, because both mean "cannot publish yet";
  the count and the filter are one control, so they can never disagree.
- **Review activity** — decisions accumulating over a fortnight of reviewing.
- **Pages whose checks are failing** — ranked, worst first.

Then the part worth doing live:

1. Tick two or three rows.
2. Click **Approve** in the bulk bar.
3. Click the undo button that appears in the bulk bar — it names what it will
   reverse rather than just saying "Undo", so you can read it aloud. (`z` does
   the same, and focus is already in the workspace here, so it will work.)

> "The undo doesn't erase anything. It writes the previous state back as a new
> recorded round, so the trail reads *set to Approved, then reverted* — because
> that's what happened. You can't quietly remove a decision from the record."

That is the single most convincing thing in the tool: within the review
workflow, the trail is append-only by construction — every decision path goes
through one merge function, and that function only ever appends.

If someone presses on it, the honest boundary is worth knowing: **Clear saved
reviews** wipes this browser's review data outright, and the Stored review data
panel can prune orphaned records. Both are deliberate, confirm-gated, and
all-or-nothing rather than surgical — you cannot quietly rewrite one decision,
which is the property that matters. Say that rather than claiming the record is
indelible.

---

## Beat 7 — Reviews survive (2 min) — *cut this first if short*

In the sidebar, set **What to export** to *"Everything, for another browser —
JSON"* and click **Export reviews**. Then click **Import reviews** and choose
the file you just exported.

Nothing is lost and nothing is duplicated — you exported and re-imported the
same state, so the 12 reviews come back exactly as they were, with the trail
showing the import.

> "That matters because reviews live in this browser. The export is how you move
> them between machines or hand them to someone else, and re-importing has to be
> non-destructive."

**Do not extend that to stale copies.** Imports merge *per page*: pages the file
does not name are untouched and the history is appended rather than replaced,
but for a page the file *does* name, its saved decision, notes, risks, owner and
reviewer replace the current ones. Re-importing an old export therefore reverts
that page to the older review. If asked, say exactly that — it is the same
merge rule as the setup step, and it is a design choice (the file is the
authority for the pages it names), not an accident.

---

## Beat 8 — Close (1 min)

Three sentences:

- Twenty pages, one IA, reviewable page by page with a recorded decision trail.
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
| You clicked **Clear saved reviews** | Reload, then re-import the seed. That restores the 12 seeded pages; any other review work in this browser is gone. |
| Full-width red banner appears | Something threw. Reload — saved reviews come back, though anything typed in the seconds before it may not have been written yet. Do not debug it live. |
| Workspace sits under the mockup, not beside it | The window is under 1700px — expected, but see setup step 2: tab shortcuts will not scroll to it. Scroll down, or press `w` twice to bring it into view. |
| Charts missing but the numbers are there | The chart library is a separate lazy-loaded file. The data tables beside it are the real content — carry on. |
| A panel says "Not configured" | The optional sync and AI drafting servers are off by design. That is their correct state, not an error. |

**Do not demo live** unless you have rehearsed it: the AI drafting panel (needs
a key and makes a real model call) and **Save all mockups as PNGs** (navigates
all 20 pages in sequence). Neither is needed for the story above.

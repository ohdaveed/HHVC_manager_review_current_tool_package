# Archived pages

Reference copies of `pages/*.js` files affected by content-consolidation
work. Nothing here is wired into `index.html` or `js/page-data.js`, and
none of it is validated by `build_scripts/validate.js`.

## Actually retired from `main` (merged, no longer live)

Retired by `origin/claude/report-transaction-only-x352c9`, merged into
`main` at `1d42f78`. These 4 pages are genuinely gone from the live page
set today.

| File                                   | Page key           | Retired by | Folded into                                          |
| -------------------------------------- | ------------------ | ---------- | ---------------------------------------------------- |
| `report-a-problem.js`                  | `reportHub`        | `f2b2983`  | Direct links from the Topic page + left nav (no hub) |
| `report-dead-bird.js`                  | `wnvBirdReport`    | `0a70b69`  | `mosquitoesReport` (report-mosquitoes.js)            |
| `report-mold-humidity-condensation.js` | `moldReport`       | `0a70b69`  | `garbageReport` (report-garbage-clutter.js)          |
| `report-overgrown-vegetation.js`       | `vegetationReport` | `0a70b69`  | `garbageReport` (report-garbage-clutter.js)          |

Content is extracted verbatim from the commit immediately before each
file's deletion (`git show <commit>^:pages/<file>`).

## Proposed only — still live on `main` today

`origin/claude/mockup-page-consolidation-j2d1jl` (commit `b83dc90`)
proposes cutting the page set to 19 pages and converting the main page
into an "Agency" page, deleting 22 `pages/*.js` files in the process. That
branch was **never merged** and conflicts with a documented invariant on
`main` (`validate.js` requires the `agency` key to be absent — it was
replaced by `pestsTopic`), so it looks like an abandoned design direction
rather than shipped consolidation history.

**The 18 pages below (all except the 4 already listed above, which that
branch also deletes) are still live in `pages/` on `main` right now.**
They're archived here only because that branch proposes removing them —
not because they've actually been retired.

| File                              | Page key             |
| --------------------------------- | -------------------- |
| `bed-bug-rules-prevention.js`     | `bedBugsInfo`        |
| `find-district-inspector.js`      | `findInspector`      |
| `fly-information.js`              | `flyInfo`            |
| `ground-wasp-information.js`      | `waspInfo`           |
| `keep-rats-and-mice-out.js`       | `ratsPrevent`        |
| `mite-information.js`             | `miteInfo`           |
| `pigeon-information.js`           | `pigeonInfo`         |
| `prevent-cockroaches.js`          | `cockroachesPrevent` |
| `prevent-garbage-clutter.js`      | `garbageInfo`        |
| `prevent-mosquitoes.js`           | `mosquitoesPrevent`  |
| `prevent-overgrown-vegetation.js` | `vegetationInfo`     |
| `prevent-problems.js`             | `preventHub`         |
| `raccoon-information.js`          | `raccoonInfo`        |
| `reduce-indoor-moisture.js`       | `reduceMoisture`     |
| `report-bed-bugs.js`              | `bedBugsReport`      |
| `report-cockroaches.js`           | `cockroachesReport`  |
| `report-mosquitoes.js`            | `mosquitoesReport`   |
| `report-pigeons.js`               | `pigeonsReport`      |

Content is extracted from `feb11fe` (that branch's base commit, the last
point before it diverged from `main`), which is identical to the current
`main` copy unless noted otherwise.

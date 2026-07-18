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

## Retired by the 19-page consolidation (merged as PR #60, `7f2f24f`)

The consolidation originally proposed on
`origin/claude/mockup-page-consolidation-j2d1jl` (commit `b83dc90`) —
cutting the page set to 19 pages and converting the main page into an
"Agency" page — **has since been merged into `main`** as PR #60
(`7f2f24f`, "Consolidate mockup to 19 pages and convert main page to an
HHVC Agency page"). The merged version kept the `pestsTopic` key for the
Agency page (rather than introducing a bare `agency` key), preserving the
`validate.js` invariant and existing review-state stability.

**The 18 pages below are genuinely retired from `main` today.** Their
old page keys are mapped to replacement pages in
`window.HHVC_DELETED_PAGE_ALIASES` (`js/page-data.js`) so saved
`?page=<oldKey>` links redirect instead of dead-ending.

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

Content is extracted from `feb11fe` (the consolidation branch's base
commit) — the last state of each file before the consolidation removed
it from the live page set.

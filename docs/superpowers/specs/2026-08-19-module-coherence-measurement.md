# Module coherence — measurement of the current tree

**Date:** 2026-08-19, against `main` @ 1ba718e (post file-structure move, post dev-server fix).
Every number below was derived by script from the tree, not estimated.

## The window graph

| | |
| --- | --- |
| `js/` files | 58 |
| namespaces published on `window` | 55 |
| edges in the window graph | 226 |
| distinct cycles | 46 |
| self-mounting IIFEs | 31 |

## Mount-body usage in the 31 IIFEs

A mount body executes at module-evaluation time, so what it reads is what an
ESM cycle could catch in a temporal dead zone.

| Class | Count | Fate under imports |
| --- | --- | --- |
| Publishes (incl. nested `window.X.y =`) | 54 | stay on `window` |
| `typeof window` environment guards | 1 | **keep** — code style mandates it |
| Presence guards (`!window.X?.y`) | 22 | **delete** — the import guarantees it |
| Function destructures (`const { escapeHtml } = window.utils`) | 11 | plain imports |
| **Value reads at import time** | **36** | the genuine hazard |

The 36 value reads are dominated by one pattern: **12 are `const DATA =
window.HHVC_DATA`**. The rest are `ReviewQueueInternal.state` (3),
`reviewState.read` (3), and singletons. Two of the 36 are `window.addEventListener`
and are not a hazard at all.

## The finding that changes the plan

**Edges by binding time:**

- mount-time (import-time, TDZ-hazardous inside an ESM cycle): **78**
- call-time only (safe inside an ESM cycle via function hoisting): **120**

**Cycles formed by mount-time edges alone: ZERO.**

The mount-time subgraph is a DAG. That is precisely what `js/main.js`'s
hand-maintained order encodes — a topological sort someone has been
maintaining by hand. Every one of the 46 cycles runs through at least one
call-time edge, which ES modules handle correctly.

**So the conversion is materially safer than the spec assumed.** The spec's
§2 treats the 50 cycles as the central risk. They are not a runtime risk;
they are a *policy* problem, because `.dependency-cruiser.cjs` holds
`no-circular` at `severity: 'error'`.

## Where the entanglement actually lives

Strongly connected components in the window graph: **exactly one, of 16
files.** The other **42 of 58 files are already acyclic and convert cleanly**
with no design work at all.

The SCC:

```
ai/ai-assist.js                      review/dashboard-guidance.js
core/page-registry-ui.js             review/keyboard-shortcuts.js
core/page-registry.js                review/review-ops.js
editing/inline-content-edit-link-tool.js  review/review-queue.js
editing/inline-content-edit.js       review/ux-improvements-export.js
mockup/mockup-image-export.js        review/ux-improvements-state-sync.js
mockup/page-render.js                review/ux-improvements-workspace.js
sync/review-state-sync.js            review/ux-improvements.js
```

**Intra-SCC edges by responsible namespace:**

| Namespace | Intra-SCC edges |
| --- | --- |
| **`window.renderPage`** | **24** |
| `window.ReviewUx` | 15 |
| `window.pageRegistry` | 4 |
| `window.reviewQueue` | 3 |
| `window.reviewStateSync` | 3 |
| ten others | 1–2 each |

Dropping `window.renderPage` and `window.showToast` from the graph shrinks
the SCC from **16 files to 12**.

## The contradiction

`window.renderPage` is named in the spec's own "Deliberate survivors" list —
it stays on `window` because `js/review/ux-improvements.js` wraps it to
refresh after navigation, and the decorator only forms if the original is on
`window`. Seventeen files reference it.

It is also, by measurement, the single largest contributor to the one cycle
cluster the spec commits to eliminating.

**The spec cannot have both.** §2 says cycles are "broken, not translated" and
that `no-circular` stays at `error`; the survivors list says `window.renderPage`
stays. Keeping it guarantees an SCC of at least 12 files, and `no-circular`
fails on every one.

This is a design decision the spec does not answer, and it has to be made
before a plan can be written.

---

## Re-measurement, 2026-08-21 — and a correction to this document

Everything above is dated 2026-08-19 and stays as written; this section records
what happened when the numbers were re-derived after Task 1 shipped.

**The script this document says produced its numbers was never committed.** It
exists now, as `build_scripts/measure-window-graph.js`, so the claims below are
re-runnable (`bun build_scripts/measure-window-graph.js --ref <ref>`).

**It does not reproduce the figures above, and the gap is structural rather
than a rounding difference.** Measured against this document's own baseline,
`main` @ `1ba718e`:

| Metric | This doc | Re-measured | |
| --- | --- | --- | --- |
| `js/` files | 58 | 58 | matches |
| self-mounting IIFEs | 31 | 31 | matches |
| namespaces on `window` | 55 | 54 | off by one |
| edges | 226 | 251 | — |
| mount-time / call-time | 78 / 120 | 102 / 149 | — |
| largest SCC | **16 files** | **25 files** | — |
| `window.renderPage` intra-SCC edges | **24** | **33** | — |

The 25-file SCC is a strict superset of the 16 listed above. The nine extra are
the sub-modules that attach to a shared namespace — `review-queue-state.js`,
`review-queue-rows.js`, `review-queue-render.js`, `review-queue-import.js`,
`review-queue-undo.js`, `review-insights.js`, `review-insights-data.js`,
`review-ops-data.js`, `inline-content-edit-render.js`. Each does
`window.X = window.X || {}` and then reads siblings' contributions back off the
same object, which forms a clique the original measurement evidently excluded.
Two ownership models were tried to reproduce the exclusion (attribute a
namespace to its bare-assignment creator; attribute it only to whoever assigns
real content) and neither collapses it, because the idempotent idiom means
several files "create" the same namespace. **The original model is not
recoverable from this document**, which is the substantive reason to keep a
script rather than a table.

**What that does and does not invalidate.** The absolute figures above should
be treated as unverified. The *relative* claim they were used for survives:
`window.renderPage` is measurably one of the largest single contributors to the
cycle under either model.

### Step 7 of Task 1: did the tangle shrink?

Measured under one consistent model across three trees, so the comparison holds
whatever the divergence above:

| Tree | edges | largest SCC | `renderPage` intra-SCC edges |
| --- | --- | --- | --- |
| before Task 1 (`d71ff26~1`) | 251 | 25 | 33 |
| after the registry (`d71ff26`) | 238 | 25 | 22 |
| after the flush fix (`451e20b`) | 238 | 25 | 22 |

**Eleven of `window.renderPage`'s 33 intra-SCC edges are gone — a third — and
the SCC did not shrink by a single file.** Mount-time edges are unchanged at
102.

That is the honest result, and it is not a failure of the conversion so much as
a correction to what Task 1 was ever going to achieve. Removing the
`ux-improvements.js` wrapper removed the wrapper's edges. It did not remove
`window.renderPage = renderPage` in `js/mockup/page-render.js`, which is still
load-bearing for `js/editing/inline-content-edit.js`'s own wrapper, nor the ~15
`window.renderPage?.(key)` call sites across the review/UX IIFEs. Seventeen
files still reference it — the same seventeen this document counted.

**The contradiction above is therefore still open, and Task 5 is where it comes
due.** Nothing about Task 1 resolves it: keeping `window.renderPage` still
guarantees an SCC, and `no-circular` would still fail on every file in it. What
Task 1 bought is a smaller share of that SCC's edges and one monkey-patch fewer,
which is real but is not "the tangle shrank."

/**
 * Generate a seeded manager-review state for demos and walkthroughs.
 *
 * WHY THIS EXISTS
 *
 * On a browser that has never been used, the Overview panel is honest and
 * useless at the same time: 19 rows of "Not reviewed yet", a progress bar at
 * 0/19, an activity chart with nothing to plot and a decision tally that is all
 * zeroes. Everything the panel exists to show needs review history to show it.
 * Presenting the tool from that state means describing the features rather than
 * demonstrating them.
 *
 * The output is a plain JSON backup in the shape `importReviewStateBackup()`
 * accepts, so it goes in through the ordinary Import reviews button. Nothing
 * about the tool changes to accommodate it, and a reviewer can clear it with
 * the ordinary Clear saved reviews button.
 *
 * WHY IT IS GENERATED RATHER THAN HAND-WRITTEN
 *
 * Records are built by mergeReviewRecord() — the same function the sidebar, the
 * queue, the import path and server.ts all write through, and the only place a
 * history entry is ever constructed. A hand-authored blob would be a second
 * statement of the record shape, free to drift from the real one and wrong in
 * exactly the way that is hardest to notice: it would import without complaint
 * and simply fail to light up the panels it was written for.
 *
 * Usage:
 *   bun build_scripts/make-demo-review-state.js [outfile]
 *
 * Defaults to review/demo-review-state.json. There is no companion "empty"
 * backup: an empty file cannot reset anything, because the import path merges
 * per page key and takes an early return when the backup names no pages. The
 * Clear saved reviews button is the only thing that actually clears state.
 */

const path = require('path')
const fs = require('fs')
const { mergeReviewRecord } = require('../js/review-merge.js')
const { loadPageData } = require('./load-pages.js')

const REVIEWER = 'M. Chen'

/**
 * The seeded review pass, in the order it "happened".
 *
 * Deliberately NOT all 19 pages. Leaving roughly a third untouched keeps the
 * progress bar short of 100%, keeps "Next needs review" meaningful, and leaves
 * the decision filter chips with something to filter to — a fully-reviewed site
 * removes most of what the Overview tab is for.
 *
 * `daysAgo` spreads the rounds across a fortnight. The activity card is a time
 * series; seeding every record with the same timestamp draws a single point and
 * reads as a broken chart rather than a quiet one.
 */
const SEED = [
  {
    key: 'pestsTopic',
    daysAgo: 13,
    decision: 'Approved',
    notes: 'Service grouping works. Article 11 scope holds — no DBI or plumbing routing.',
    owner: 'Content team',
  },
  {
    key: 'rodentsReport',
    daysAgo: 12,
    decision: 'Approved',
    notes: 'The "choose the closest problem" framing reads well for the rodent cluster.',
    owner: 'Content team',
  },
  {
    key: 'filthReport',
    daysAgo: 12,
    decision: 'Approved with edits',
    notes: 'Shorten the primary button label; otherwise matches the rodent pattern.',
    owner: 'Content team',
  },
  {
    key: 'insectsReport',
    daysAgo: 11,
    decision: 'Approved with edits',
    notes: 'Same button-length edit as the other two report transactions.',
    owner: 'Content team',
  },
  {
    key: 'recordsHub',
    daysAgo: 9,
    decision: 'Approved',
    notes: 'Good landing point for the five lookup pages.',
    owner: 'Records team',
  },
  {
    key: 'findRecords',
    daysAgo: 9,
    decision: 'Approved',
    notes: 'Complaint and inspection lookup confirmed against the live tool.',
    owner: 'Records team',
  },
  {
    key: 'findHotelRecords',
    daysAgo: 8,
    decision: 'Revise and resubmit',
    notes: 'Interim sfdph.org URL. Needs the real lookup entry point before this can go further.',
    risks: 'Placeholder destination — flagged editorStatus: placeholder in the page data.',
    owner: 'Records team',
  },
  {
    key: 'ownerHub',
    daysAgo: 6,
    decision: 'Revise and resubmit',
    notes: 'Sentences run long against the Grade 6 target, and one link reads "click here".',
    risks: 'FY26–27 fee schedule PDF URL still outstanding.',
    owner: 'Owner comms',
  },
  {
    key: 'noticeOfViolation',
    daysAgo: 5,
    decision: 'Blocked',
    notes: 'Cannot progress until Legal confirms the NOV templates and appeal windows.',
    risks:
      'BLOCKED: NOV templates, tenant-specific orders, appeal windows and contact routes all unconfirmed.',
    owner: 'Legal review',
  },
  {
    key: 'payFee',
    daysAgo: 4,
    decision: 'Blocked',
    notes: 'CTA is inert until the real SF.gov payment URL is confirmed.',
    risks: 'Payment destination unconfirmed — do not publish with an inert primary CTA.',
    owner: 'Finance',
  },
  {
    key: 'scopeInfo',
    daysAgo: 3,
    decision: 'Approved with edits',
    notes: 'Tighten the SEO title. Content direction is right.',
    owner: 'Content team',
  },
  {
    key: 'article11Guide',
    daysAgo: 2,
    decision: 'Approved with edits',
    notes: 'Plain-language rewrite is a big improvement. Trim the SEO title and one button label.',
    owner: 'Content team',
  },
]

function isoDaysAgo(days, hour) {
  // Anchored to the script's run time so a freshly generated file always looks
  // like a review that has been running for the last fortnight.
  const base = new Date()
  base.setUTCDate(base.getUTCDate() - days)
  base.setUTCHours(hour, 15, 0, 0)
  return base.toISOString()
}

function build() {
  const { pages } = loadPageData()

  const seededPages = {}
  for (const [index, item] of SEED.entries()) {
    const page = pages[item.key]
    if (!page) throw new Error(`Seed references unknown page key: ${item.key}`)

    const timestamp = isoDaysAgo(item.daysAgo, 9 + (index % 7))

    /* Two rounds on the pages that ended up needing work, one on the rest. A
       review that only ever recorded a single round per page would leave the
       History column reading "1" everywhere and make the append-only trail —
       the thing that distinguishes this from a spreadsheet — invisible. */
    let record = null
    if (item.decision !== 'Approved') {
      record = mergeReviewRecord(
        null,
        {
          page_key: item.key,
          page_title: page.title,
          page_type: page.type,
          url_slug: page.slug,
          reviewer: REVIEWER,
          review_date: timestamp.slice(0, 10),
          decision: 'Needs review',
          notes: 'First pass — reading through.',
          risks_or_blockers: '',
          follow_up_owner: '',
        },
        { timestamp: isoDaysAgo(item.daysAgo + 1, 14), updatedBy: 'local' }
      )
    }

    seededPages[item.key] = mergeReviewRecord(
      record,
      {
        page_key: item.key,
        page_title: page.title,
        page_type: page.type,
        url_slug: page.slug,
        reviewer: REVIEWER,
        review_date: timestamp.slice(0, 10),
        decision: item.decision,
        notes: item.notes,
        risks_or_blockers: item.risks || '',
        follow_up_owner: item.owner || '',
      },
      { timestamp, updatedBy: 'local' }
    )
  }

  return {
    version: 1,
    updated_at: new Date().toISOString(),
    ui: {},
    globals: { reviewer: REVIEWER },
    pages: seededPages,
  }
}

function main() {
  const outArg = process.argv[2]
  const outPath = path.resolve(
    process.cwd(),
    outArg || path.join('review', 'demo-review-state.json')
  )
  const state = build()
  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  fs.writeFileSync(outPath, JSON.stringify(state, null, 2) + '\n')

  /* There is deliberately NO companion "empty" backup written here, and it is
     worth saying why, because writing one is the obvious idea and it does not
     work. `importReviewStateBackup()` merges per page key: it builds `entries`
     from the backup's own pages, and a backup with none takes the
     `!entries.length` early return — "the backup has no reviews matching the
     current page list" — and changes nothing at all. An empty file is not a
     reset, it is a no-op that reports success. The only thing that actually
     clears local review state is the Clear saved reviews button, and that is
     what the demo docs point at. */

  const decisions = {}
  for (const record of Object.values(state.pages)) {
    decisions[record.decision] = (decisions[record.decision] || 0) + 1
  }
  /* Rounds as they exist IN THE FILE. The imported state carries one more per
     page: importReviewStateBackup runs every record through mergeReviewRecord
     with `updatedBy: 'import'`, which appends a boundary entry by design. So
     12 pages generated with 20 rounds land as 32 after import — correct
     behaviour, but the two numbers are not the same number, and the demo notes
     quote the post-import one because that is what a reviewer sees. */
  const rounds = Object.values(state.pages).reduce((sum, r) => sum + r.history.length, 0)
  const pageCount = Object.keys(state.pages).length

  console.log(`wrote ${outPath}`)
  console.log(
    `${pageCount} pages reviewed, ${rounds} recorded rounds in the file ` +
      `(${rounds + pageCount} after import adds its own round per page) — ` +
      Object.entries(decisions)
        .map(([d, n]) => `${d}: ${n}`)
        .join(', ')
  )
}

if (require.main === module) main()

module.exports = { build, SEED }

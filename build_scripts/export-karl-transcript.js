// Write one paste-ready Karl transcript per page into review/karl-transcripts/.
//
// A thin CLI over js/karl/karl-transcript.js — every judgement about what an editor
// is told to type lives there, so this file only loads the corpus, renders, and
// writes.
//
// It reads NO review state. The browser holds that in localStorage and this
// process cannot reach it, so a CLI transcript prints the authored copy and
// says so in its own header ("no review recorded"); the workspace panel is the
// path that carries a reviewer's edits. Printing authored copy while implying
// it was reviewed is the one outcome worth failing to avoid, which is why the
// unreviewed state is marked rather than left blank.
const fs = require('fs')
const path = require('path')
const { loadPageData, root } = require('./load-pages')
const { buildTranscript, renderTranscriptMarkdown } = require('../js/karl/karl-transcript.js')

const OUT_DIR = path.join(root, 'review', 'karl-transcripts')

const pages = loadPageData().pages

// Build EVERY transcript before writing ANY of them. A half-written directory
// is worse than none: an editor opening it cannot tell a fresh file from one
// left over from the previous run, and the stale one still reads as an
// instruction to follow.
const rendered = []
const failures = []
for (const [pageKey, page] of Object.entries(pages)) {
  try {
    rendered.push({
      pageKey,
      markdown: renderTranscriptMarkdown(buildTranscript(page, null, pages)),
    })
  } catch (error) {
    failures.push(`${pageKey}: ${error.message}`)
  }
}

if (failures.length) {
  console.error('No transcripts written — these pages failed to build:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

/* Every existing transcript is removed before the new set is written, so the
   directory holds one file per CURRENT page and nothing else. Overwriting by
   page key alone left a retired or renamed page's file behind, looking exactly
   like a valid instruction — a markdown file of Karl fields to type, for a
   page that is no longer in the corpus. That is the worst shape a stale
   artifact can take here, because a human executes it.

   The delete runs AFTER the build loop and its `failures` gate above, so a
   page that fails to build cannot leave the reviewer with an empty directory
   where a usable set of transcripts used to be. Only `.md` files are removed;
   the directory is gitignored, but a reviewer may have put notes beside them
   and this script did not create those. */
fs.mkdirSync(OUT_DIR, { recursive: true })
for (const existing of fs.readdirSync(OUT_DIR)) {
  if (existing.endsWith('.md')) fs.rmSync(path.join(OUT_DIR, existing))
}
for (const { pageKey, markdown } of rendered) {
  fs.writeFileSync(path.join(OUT_DIR, `${pageKey}.md`), markdown, 'utf8')
}

const unmapped = rendered.reduce(
  (total, { pageKey }) => total + buildTranscript(pages[pageKey], null, pages).unmapped.length,
  0
)
console.log(
  'wrote',
  rendered.length,
  'Karl transcripts to review/karl-transcripts/,',
  unmapped,
  'unmapped findings across them'
)

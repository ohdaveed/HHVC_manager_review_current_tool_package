//
// Pure markdown chunker for the RAG knowledge base. No I/O: takes a markdown
// string and returns chunk records. Dual-exported (window/module.exports),
// matching js/review-merge.js and js/plain-language.js, so this is
// unit-testable without a DB or a browser, and reusable if a browser-side
// tool ever wants the same chunking (none does today).
//
// Splits on ## and ### headings first, keeping a section's ideas together,
// then sub-splits any section over MAX_CHUNK_WORDS at paragraph boundaries
// with OVERLAP_WORDS of context carried into the next chunk, so a fact near a
// chunk boundary is not orphaned from the sentence before it. Every chunk is
// prefixed with its heading path so the embedded text — and what is later
// shown to the model at query time — carries its own section context.

const MAX_CHUNK_WORDS = 500
const OVERLAP_WORDS = 50

const HEADING_RE = /^(#{2,3})\s+(.+)$/

/**
 * Split markdown into sections at ## and ### headings, tracking a heading
 * path (e.g. "Rats > Reporting a sighting") via a stack keyed by heading
 * level. Content before the first heading becomes one section with an empty
 * heading path.
 * @param {string} markdown
 * @returns {Array<{headingPath: string, body: string}>}
 */
function parseSections(markdown) {
  const lines = markdown.split('\n')
  const sections = []
  const stack = []
  let bodyLines = []

  const flush = () => {
    const body = bodyLines.join('\n').trim()
    if (body) sections.push({ headingPath: stack.map((entry) => entry.title).join(' > '), body })
    bodyLines = []
  }

  for (const line of lines) {
    const match = line.match(HEADING_RE)
    if (!match) {
      bodyLines.push(line)
      continue
    }
    flush()
    const level = match[1].length
    const title = match[2].trim()
    while (stack.length && stack[stack.length - 1].level >= level) stack.pop()
    stack.push({ level, title })
  }
  flush()

  return sections
}

/**
 * Split one section's body into paragraph-aligned chunks of at most
 * `maxWords`, carrying `overlapWords` of the previous chunk's tail forward.
 * @param {string} body
 * @param {number} maxWords
 * @param {number} overlapWords
 * @returns {string[]}
 */
function splitIntoWordChunks(body, maxWords, overlapWords) {
  const paragraphs = body
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)

  const chunks = []
  let current = []
  let currentWords = 0

  for (const paragraph of paragraphs) {
    const wordCount = paragraph.split(/\s+/).filter(Boolean).length
    if (currentWords + wordCount > maxWords && current.length) {
      chunks.push(current.join('\n\n'))
      const tailWords = current.join(' ').split(/\s+/).filter(Boolean).slice(-overlapWords)
      current = tailWords.length ? [tailWords.join(' ')] : []
      currentWords = tailWords.length
    }
    current.push(paragraph)
    currentWords += wordCount
  }
  if (current.length) chunks.push(current.join('\n\n'))

  return chunks
}

/**
 * @param {string} markdown
 * @param {string} sourceFile Path recorded on every chunk (relative to
 *   docs/source/, e.g. "hhvc-policy/2026-07-02-ipm-pests-rats.md").
 * @returns {Array<{sourceFile: string, headingPath: string|null, content: string, chunkIndex: number}>}
 */
function chunkMarkdown(markdown, sourceFile) {
  const sections = parseSections(markdown)
  const chunks = []
  let chunkIndex = 0

  for (const section of sections) {
    const bodyChunks = splitIntoWordChunks(section.body, MAX_CHUNK_WORDS, OVERLAP_WORDS)
    for (const bodyChunk of bodyChunks) {
      const content = section.headingPath ? `${section.headingPath}\n\n${bodyChunk}` : bodyChunk
      chunks.push({
        sourceFile,
        headingPath: section.headingPath || null,
        content,
        chunkIndex,
      })
      chunkIndex += 1
    }
  }

  return chunks
}

if (typeof window !== 'undefined') {
  window.chunkMarkdown = chunkMarkdown
}

module.exports = { chunkMarkdown, MAX_CHUNK_WORDS, OVERLAP_WORDS }

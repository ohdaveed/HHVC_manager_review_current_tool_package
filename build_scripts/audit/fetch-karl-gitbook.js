/**
 * Fetch and parse Karl Editor Help Center (GitBook) documentation via llms.txt.
 * Extracts content types, components, character limits, tab models, and editorial rules.
 */

const fs = require('fs')
const path = require('path')

const LLMS_TXT_URL = 'https://sfdigitalservices.gitbook.io/karl-sf.gov-editor-help-center/llms.txt'
const FIXTURES_DIR = path.resolve(__dirname, '../../data/audit_fixtures')
const OUTPUT_FILE = path.join(FIXTURES_DIR, 'karl-gitbook-rules.json')

async function fetchUrl(url) {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'KarlDocAuditor/1.0 (HHVC Manager Review Audit Tool)',
      },
    })
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`)
    }
    return await res.text()
  } catch (err) {
    console.warn(`Failed to fetch ${url}: ${err.message}`)
    return null
  }
}

function parseMarkdownLinks(llmsText) {
  const linkRegex =
    /- \[([^\]]+)\]\((https:\/\/sfdigitalservices\.gitbook\.io\/karl-sf\.gov-editor-help-center\/[^)]+\.md)\)(?:: (.*))?/g
  const links = []
  let match
  while ((match = linkRegex.exec(llmsText)) !== null) {
    links.push({
      title: match[1].trim(),
      url: match[2].trim(),
      summary: match[3] ? match[3].trim() : '',
    })
  }
  return links
}

function extractRulesFromContent(docTitle, docUrl, content) {
  const rules = []

  // Look for character limits
  const charLimitRegex = /(\d+)\s*(?:characters?|chars?)|character limit(?: of|:)?\s*(\d+)/gi
  let match
  while ((match = charLimitRegex.exec(content)) !== null) {
    const limit = match[1] || match[2]
    rules.push({
      type: 'character_limit',
      limit: parseInt(limit, 10),
      context: content
        .substring(Math.max(0, match.index - 80), Math.min(content.length, match.index + 100))
        .trim(),
      source: docTitle,
      url: docUrl,
    })
  }

  // Look for required markers or mandatory fields
  const requiredRegex = /(?:required|mandatory|must include|must have|must provide)[^.\n]+/gi
  while ((match = requiredRegex.exec(content)) !== null) {
    rules.push({
      type: 'requirement',
      statement: match[0].trim(),
      source: docTitle,
      url: docUrl,
    })
  }

  // Look for component rules and prohibitions (e.g., only X supports Y, no tables, etc.)
  const restrictionRegex = /(?:only|cannot|must not|do not|never|supports? only|exclusive)[^.\n]+/gi
  while ((match = restrictionRegex.exec(content)) !== null) {
    rules.push({
      type: 'restriction',
      statement: match[0].trim(),
      source: docTitle,
      url: docUrl,
    })
  }

  return rules
}

async function main() {
  if (!fs.existsSync(FIXTURES_DIR)) {
    fs.mkdirSync(FIXTURES_DIR, { recursive: true })
  }

  console.log(`Fetching Karl GitBook index from: ${LLMS_TXT_URL}`)
  const indexText = await fetchUrl(LLMS_TXT_URL)
  if (!indexText) {
    console.error('Failed to load llms.txt from GitBook')
    process.exit(1)
  }

  const articles = parseMarkdownLinks(indexText)
  console.log(`Found ${articles.length} documentation articles in Karl GitBook.`)

  const scrapedDocs = []
  const allRules = []

  // Batch fetch articles
  const BATCH_SIZE = 5
  for (let i = 0; i < articles.length; i += BATCH_SIZE) {
    const batch = articles.slice(i, i + BATCH_SIZE)
    await Promise.all(
      batch.map(async (art) => {
        const content = await fetchUrl(art.url)
        if (content) {
          const docRules = extractRulesFromContent(art.title, art.url, content)
          allRules.push(...docRules)
          scrapedDocs.push({
            title: art.title,
            url: art.url,
            summary: art.summary,
            length: content.length,
            rulesCount: docRules.length,
          })
        }
      })
    )
    console.log(
      `Fetched ${Math.min(i + BATCH_SIZE, articles.length)} / ${articles.length} articles...`
    )
  }

  const outputPayload = {
    fetched_at: new Date().toISOString(),
    total_articles: scrapedDocs.length,
    articles: scrapedDocs,
    extracted_rules: allRules,
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(outputPayload, null, 2), 'utf8')
  console.log(`Successfully extracted ${allRules.length} rules and saved to ${OUTPUT_FILE}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

/**
 * Scrape and extract structural DOM / markdown information from SF.gov pages.
 * Integrates live scrapes with authoritative Firecrawl captures in docs/source/sfgov-live/
 * and docs/sfgov-*.md.
 */

const fs = require('fs')
const path = require('path')

const ROOT_DIR = path.resolve(__dirname, '../..')
const FIXTURES_DIR = path.join(ROOT_DIR, 'data/audit_fixtures')
const OUTPUT_FILE = path.join(FIXTURES_DIR, 'sfgov-live-snapshots.json')

const KNOWN_CAPTURES = [
  {
    name: 'healthy-housing-conditions',
    expectedType: 'Topic',
    url: 'https://www.sf.gov/topics--healthy-housing-conditions',
    capturePath: 'docs/sfgov-healthy-housing-topic-and-agency-capture-2026-08-08.md',
  },
  {
    name: 'environmental-health-dept',
    expectedType: 'Agency',
    url: 'https://www.sf.gov/departments--department-public-health--environmental-health',
    capturePath: 'docs/sfgov-healthy-housing-topic-and-agency-capture-2026-08-08.md',
  },
  {
    name: 'keeping-building-free-of-vermin',
    expectedType: 'Information',
    url: 'https://www.sf.gov/information--keeping-your-building-free-vermin',
    capturePath: 'docs/source/sfgov-live/keeping-your-building-free-of-vermin.md',
  },
  {
    name: 'report-health-nuisance-or-hazards',
    expectedType: 'Transaction',
    url: 'https://www.sf.gov/report-a-health-nuisance-or-hazards',
    capturePath: 'docs/source/sfgov-live/report-a-health-nuisance-or-hazards.md',
  },
]

function extractStructureFromMarkdown(content, target) {
  if (!content) return null

  // Extract H1
  const h1Match = content.match(/^#\s+(.+)$/m)
  const h1 = h1Match ? h1Match[1].trim() : target.name

  // Extract H2s
  const h2Matches = [...content.matchAll(/^##\s+(.+)$/gm)]
  const h2Headings = h2Matches.map((m) => m[1].trim())

  // Extract H3s
  const h3Matches = [...content.matchAll(/^###\s+(.+)$/gm)]
  const h3Headings = h3Matches.map((m) => m[1].trim())

  // Extract links and buttons
  const linkMatches = [...content.matchAll(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g)]
  const links = linkMatches.map((m) => ({ text: m[1].trim(), href: m[2].trim() }))

  return {
    name: target.name,
    expectedType: target.expectedType,
    url: target.url,
    source: target.capturePath,
    h1,
    h2Headings,
    h3Headings,
    linksCount: links.length,
    links: links.slice(0, 15),
    contentLength: content.length,
  }
}

function main() {
  if (!fs.existsSync(FIXTURES_DIR)) {
    fs.mkdirSync(FIXTURES_DIR, { recursive: true })
  }

  const snapshots = []

  for (const target of KNOWN_CAPTURES) {
    const fullPath = path.join(ROOT_DIR, target.capturePath)
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, 'utf8')
      const parsed = extractStructureFromMarkdown(content, target)
      if (parsed) {
        snapshots.push(parsed)
        console.log(
          `Parsed snapshot for ${target.name} (${parsed.h2Headings.length} H2s, ${parsed.h3Headings.length} H3s)`
        )
      }
    }
  }

  const payload = {
    generated_at: new Date().toISOString(),
    snapshots_count: snapshots.length,
    snapshots,
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(payload, null, 2), 'utf8')
  console.log(`Successfully structured ${snapshots.length} snapshots into ${OUTPUT_FILE}`)
}

main()

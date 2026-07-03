// Add missing karl tags on cards with target links; patch SEO/meta lengths.
const fs = require('fs')
const path = require('path')

const pagesDir = path.join(__dirname, '..', 'pages')

const seoMetaFixes = {
  'integrated-pest-management-property-managers.js': {
    seoTitle: 'IPM for property owners and managers | SF.gov',
    metaDescription:
      'IPM for SF property owners and managers. UC ANR templates for prevention, monitoring, and resident outreach.',
  },
  'property-owner-responsibilities.js': {
    metaDescription:
      'Owner and manager duties for pests, vectors, and housing health under San Francisco Health Code Article 11.',
  },
  'respond-to-notice-of-violation.js': {
    metaDescription:
      'How tenants and owners respond to an Environmental Health notice of violation when both may have corrective actions.',
  },
  'mite-information.js': {
    metaDescription:
      'Tropical rat mites, nest treatment before rodenticides, and when to report rodent or housing-health problems.',
  },
  'mosquito-control-program.js': {
    metaDescription:
      'San Francisco mosquito control, catch-basin treatment, and how to report standing water or mosquito activity.',
  },
  'mosquito-education-workshop.js': {
    metaDescription:
      'Request a free HHVC mosquito workshop with microscopes, live larvae, and hands-on science for schools and camps.',
  },
  'lookup-building-records.js': {
    metaDescription:
      'Find HHVC inspection records, violations, district inspectors, and public records for San Francisco buildings.',
  },
  'lookup-residential-hotel-records.js': {
    metaDescription:
      'Look up Environmental Health records for San Francisco residential hotels, SROs, and shelters.',
  },
  'pay-healthy-housing-fee.js': {
    metaDescription:
      'Pay or learn about the Healthy Housing fee for San Francisco apartment buildings with 3 or more rental units.',
  },
  'pigeon-information.js': {
    metaDescription:
      'How pigeon roosting and droppings affect housing health and when to report the problem to Environmental Health.',
  },
  'raccoon-information.js': {
    metaDescription:
      'Raccoon roundworm risks, safe latrine cleanup, and when to report housing-health conditions HHVC may review.',
  },
  'report-dead-bird.js': {
    metaDescription:
      'Report a dead bird for West Nile surveillance. HHVC may collect and test birds to track virus activity.',
  },
  'tenant-rights-reporting.js': {
    seoTitle: 'Tenant rights when reporting housing conditions | SF.gov',
  },
  'what-happens-after-report.js': {
    seoTitle: 'What happens after you report | SF.gov',
  },
}

function addMissingCardKarl(content) {
  return content.replace(
    /target: '([^']+)',(\r?\n)(\s+)\},/g,
    (match, _target, newline, indent) => {
      if (match.includes('karl:')) return match
      return `target: '${_target}',${newline}${indent}  karl: 'Related section: right-panel linked page',${newline}${indent}},`
    }
  )
}

let karlFiles = 0
let seoFiles = 0

for (const file of fs.readdirSync(pagesDir).filter((f) => f.endsWith('.js'))) {
  const filePath = path.join(pagesDir, file)
  let content = fs.readFileSync(filePath, 'utf8')
  const original = content

  content = addMissingCardKarl(content)
  if (content !== original) karlFiles++

  const patch = seoMetaFixes[file]
  if (patch?.seoTitle) {
    content = content.replace(/seoTitle: '[^']*',/, `seoTitle: '${patch.seoTitle}',`)
    seoFiles++
  }
  if (patch?.metaDescription) {
    content = content.replace(
      /metaDescription:\s*(\r?\n)\s*'[^']*',/,
      `metaDescription:$1    '${patch.metaDescription}',`
    )
    seoFiles++
  }

  if (content !== original) fs.writeFileSync(filePath, content)
}

console.log(`karl card fixes: ${karlFiles} files`)
console.log(`seo/meta patches defined for ${Object.keys(seoMetaFixes).length} files`)

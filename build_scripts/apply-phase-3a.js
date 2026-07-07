#!/usr/bin/env bun
/**
 * One-shot Phase 3A batch edits: contactSection on Tx/Info pages,
 * accordions on report Transactions, resources[] mirrors on hub RCs.
 */
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const pagesDir = path.join(root, 'pages')

const CONTACT_BLOCK = `  contactSection: {
    phone: 'Environmental Health: 415-252-3800',
    email: 'eh@sf.gov',
    karl: 'Contact section: Environmental Health (standardized footer)',
  },
`

const TRANSACTION_FILES = [
  'pay-healthy-housing-fee.js',
  'lookup-residential-violations.js',
  'lookup-residential-hotel-records.js',
  'public-records-request.js',
  'report-dead-bird.js',
  'lookup-complaints-inspections.js',
  'report-mold-humidity-condensation.js',
  'report-garbage-clutter.js',
  'report-bed-bugs.js',
  'report-pigeons.js',
  'report-rats-or-mice.js',
  'report-cockroaches.js',
  'report-mosquitoes.js',
  'report-overgrown-vegetation.js',
]

const INFORMATION_FILES = [
  'integrated-pest-management-property-managers.js',
  'hhvc-inspection-scope.js',
  'mite-information.js',
  'raccoon-information.js',
  'bed-bug-rules-prevention.js',
  'tenant-rights-reporting.js',
  'reduce-indoor-moisture.js',
  'prevent-overgrown-vegetation.js',
  'prevent-mosquitoes.js',
  'prevent-garbage-clutter.js',
  'prevent-cockroaches.js',
  'pigeon-information.js',
  'mosquito-control-program.js',
  'keep-rats-and-mice-out.js',
  'ground-wasp-information.js',
  'fly-information.js',
  'find-district-inspector.js',
]

const REPORT_ACCORDION_FILES = [
  'report-mold-humidity-condensation.js',
  'report-garbage-clutter.js',
  'report-bed-bugs.js',
  'report-pigeons.js',
  'report-rats-or-mice.js',
  'report-cockroaches.js',
  'report-mosquitoes.js',
  'report-overgrown-vegetation.js',
]

const SUPPORTING_SECTION = `    {
      heading: 'Supporting information',
      karl: 'Supporting information: Transaction FAQs via accordions',
      kind: 'body',
      accordions: [
        {
          title: 'Language access and privacy',
          karl: 'Supporting information: Accordion — language, privacy, third-party reporting',
          text: [
            'You can make a report even if you are not the tenant. A friend, family member, advocate, or helper can report for someone else.',
          ],
          bullets: [
            'You can ask 311 for help in your language.',
            'You do not have to give your name to make a report.',
            'HHVC does not share the reporter’s identity with the property owner or manager.',
            'You can ask 311 for a service request number so you can follow up later.',
          ],
        },
      ],
    },
`

function addContactSection(filePath) {
  let content = fs.readFileSync(filePath, 'utf8')
  if (content.includes('contactSection:')) return false
  if (content.includes('  seoTitle:')) {
    content = content.replace('  seoTitle:', `${CONTACT_BLOCK}  seoTitle:`)
  } else if (content.includes('  metaDescription:')) {
    content = content.replace('  metaDescription:', `${CONTACT_BLOCK}  metaDescription:`)
  } else {
    content = content.replace(/\n\}\n$/, `\n${CONTACT_BLOCK}}\n`)
  }
  fs.writeFileSync(filePath, content)
  return true
}

function migrateHelpToAccordions(filePath) {
  let content = fs.readFileSync(filePath, 'utf8')
  const marker = "heading: 'Get help making your report'"
  if (!content.includes(marker)) return false

  const markerIndex = content.indexOf(marker)
  const start = content.lastIndexOf('    {', markerIndex)
  let depth = 0
  let end = -1
  for (let i = start; i < content.length; i++) {
    if (content[i] === '{') depth++
    if (content[i] === '}') {
      depth--
      if (depth === 0) {
        end = i + 1
        if (content[end] === ',') end++
        break
      }
    }
  }
  if (start === -1 || end === -1) {
    throw new Error(`Could not locate help section in ${filePath}`)
  }

  content = content.slice(0, start) + SUPPORTING_SECTION + content.slice(end)
  fs.writeFileSync(filePath, content)
  return true
}

function mirrorResourcesFromCards(filePath, sectionHeading) {
  let content = fs.readFileSync(filePath, 'utf8')
  const sectionStart = content.indexOf(`heading: '${sectionHeading}'`)
  if (sectionStart === -1) throw new Error(`Section "${sectionHeading}" not found in ${filePath}`)

  const sectionSlice = content.slice(sectionStart)
  if (sectionSlice.includes('resources: [')) return false

  const cardsStart = content.indexOf('cards: [', sectionStart)
  if (cardsStart === -1)
    throw new Error(`cards: [ not found after "${sectionHeading}" in ${filePath}`)

  let depth = 0
  let cardsEnd = -1
  for (let i = cardsStart; i < content.length; i++) {
    if (content[i] === '[') depth++
    if (content[i] === ']') {
      depth--
      if (depth === 0) {
        cardsEnd = i + 1
        break
      }
    }
  }
  if (cardsEnd === -1) throw new Error(`Could not parse cards array in ${filePath}`)

  const cardsBlock = content.slice(cardsStart, cardsEnd)
  const resourcesBlock = cardsBlock
    .replace(/^cards: \[/, 'resources: [')
    .replace(
      /karl: 'Resource collection item cross-link to existing [^']+'/g,
      "karl: 'Resource collection body: Resources'"
    )
    .replace(
      /karl: 'Resource collection item cross-link to new Information page'/g,
      "karl: 'Resource collection body: Resources'"
    )
    .replace(
      /karl: 'Resource collection item linking to [^']+'/g,
      "karl: 'Resource collection body: Resources'"
    )

  content = content.slice(0, cardsEnd) + ',\n      ' + resourcesBlock + content.slice(cardsEnd)
  fs.writeFileSync(filePath, content)
  return true
}

let changed = 0
for (const file of [...TRANSACTION_FILES, ...INFORMATION_FILES]) {
  if (addContactSection(path.join(pagesDir, file))) changed++
}
for (const file of REPORT_ACCORDION_FILES) {
  if (migrateHelpToAccordions(path.join(pagesDir, file))) changed++
}
if (mirrorResourcesFromCards(path.join(pagesDir, 'prevent-problems.js'), 'Prevention guides')) {
  changed++
}
if (
  mirrorResourcesFromCards(path.join(pagesDir, 'lookup-building-records.js'), 'Building lookups')
) {
  changed++
}

console.log(`Phase 3A apply: ${changed} file operations completed`)

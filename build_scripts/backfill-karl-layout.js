// One-time backfill: add Karl layout fields to pages/*.js based on content-type patterns.
// Safe to re-run; only fills missing fields.
const fs = require('fs')
const path = require('path')
const vm = require('vm')
const glob = require('fast-glob')

const PAGES_DIR = path.join(__dirname, '..', 'pages')
const HHVC_CONTACT = {
  phone: ['311 (call or text)'],
  email: ['ehb@sfdph.org'],
  other: ['Environmental Health — Healthy Housing and Vector Control'],
}
const TOPIC_TAG = 'Topic: Pests and housing problems'
const VECTOR_IMAGES = {
  flyInfo: {
    src: 'https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?auto=format&fit=crop&w=800&q=80',
    alt: 'House fly on a surface near food waste',
    karl: 'Information section: Image — pest identification aid',
  },
  waspInfo: {
    src: 'https://images.unsplash.com/photo-1558642452-9d2a7deb7f62?auto=format&fit=crop&w=800&q=80',
    alt: 'Ground wasp on soil near a building foundation',
    karl: 'Information section: Image — pest identification aid',
  },
  miteInfo: {
    src: 'https://images.unsplash.com/photo-1574263867127-a8b4d81ece92?auto=format&fit=crop&w=800&q=80',
    alt: 'Magnified view of small mites on a surface',
    karl: 'Information section: Image — pest identification aid',
  },
  pigeonInfo: {
    src: 'https://images.unsplash.com/photo-1552728089-57bdde30beb3?auto=format&fit=crop&w=800&q=80',
    alt: 'Pigeons roosting on a building ledge',
    karl: 'Information section: Image — pest identification aid',
  },
  raccoonInfo: {
    src: 'https://images.unsplash.com/photo-1530595467537-0b5996c41f2d?auto=format&fit=crop&w=800&q=80',
    alt: 'Raccoon near residential trash bins at night',
    karl: 'Information section: Image — wildlife identification aid',
  },
}

function loadPage(filePath) {
  const code = fs.readFileSync(filePath, 'utf8')
  const sandbox = { window: { HHVC_PAGES: {} } }
  vm.runInNewContext(code, sandbox, { filename: filePath })
  const key = Object.keys(sandbox.window.HHVC_PAGES)[0]
  return { key, page: sandbox.window.HHVC_PAGES[key], code }
}

function serializeValue(v, indent = 2) {
  if (typeof v === 'string') return JSON.stringify(v)
  if (Array.isArray(v)) {
    if (!v.length) return '[]'
    const inner = v
      .map((item) => `${' '.repeat(indent + 2)}${serializeValue(item, indent + 2)}`)
      .join(',\n')
    return `[\n${inner},\n${' '.repeat(indent)}]`
  }
  if (v && typeof v === 'object') {
    const entries = Object.entries(v)
    const inner = entries
      .map(([k, val]) => `${' '.repeat(indent + 2)}${k}: ${serializeValue(val, indent + 2)}`)
      .join(',\n')
    return `{\n${inner},\n${' '.repeat(indent)}}`
  }
  return String(v)
}

function insertAfterReading(code, inserts) {
  const block = inserts.map(([k, v]) => `  ${k}: ${serializeValue(v, 2)},`).join('\n')
  if (code.includes('primaryCta:') || code.includes('topicTag:') || code.includes('contact:')) {
    return code
  }
  return code.replace(/(reading: '[^']+',)\n/, `$1\n${block}\n`)
}

function insertFieldAfterReading(code, field, value) {
  if (code.includes(`${field}:`)) return code
  return code.replace(/(reading: '[^']+',)\n/, `$1\n  ${field}: ${serializeValue(value, 2)},\n`)
}

function addComponentRelated(code) {
  return code.replace(/(heading: 'Related pages',\n)(\s+)(karl:)/g, (match, h, sp, karl) => {
    if (match.includes("component: 'related'")) return match
    return `${h}${sp}component: 'related',\n${sp}${karl}`
  })
}

function addComponentResources(code) {
  return code.replace(
    /(heading: '(?:Report a housing health problem|Prevention guides|Owner resources|Records and lookups|Report the bird to CDPH|More mosquito resources)'[\s\S]*?\n)(\s+)(karl:)/g,
    (match, h, sp, karl) => {
      if (match.includes("component: 'resources'")) return match
      return `${h}${sp}component: 'resources',\n${sp}${karl}`
    }
  )
}

function markSupportingSections(code, headings) {
  let next = code
  for (const heading of headings) {
    const re = new RegExp(
      `(heading: '${heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}',\\n)(\\s+)(karl:)`
    )
    next = next.replace(re, (m, h, sp, karl) => {
      if (m.includes("component: 'supporting'")) return m
      return `${h}${sp}component: 'supporting',\n${sp}${karl}`
    })
  }
  return next
}

function addImageToFirstSection(code, image) {
  if (code.includes('image:')) return code
  const imgBlock = `      image: ${serializeValue(image, 6)},\n`
  return code.replace(
    /(sections: \[\n\s+\{\n\s+heading: '[^']+',\n\s+karl: '[^']*',\n\s+kind: 'body',\n)/,
    `$1${imgBlock}`
  )
}

function addCalloutVariant(code, variant = 'warning') {
  if (code.includes('variant:')) return code
  return code.replace(
    /(callout: \{\n\s+karl:)/,
    `callout: {\n        variant: '${variant}',\n        karl:`
  )
}

const files = glob.sync('*.js', { cwd: PAGES_DIR })
let changed = 0

for (const file of files) {
  const filePath = path.join(PAGES_DIR, file)
  let { key, page, code } = loadPage(filePath)
  let next = code
  const type = String(page.type || '').toLowerCase()

  if (type.includes('transaction') && file.startsWith('report-') && key !== 'wnvBirdReport') {
    next = insertFieldAfterReading(next, 'primaryCta', 'Report through 311')
    next = insertFieldAfterReading(next, 'topicTag', TOPIC_TAG)
  }

  if (type.includes('transaction') && file.startsWith('lookup-')) {
    next = insertFieldAfterReading(next, 'primaryCta', page.primaryCta || 'Start lookup')
    next = insertFieldAfterReading(next, 'topicTag', TOPIC_TAG)
  }

  if (type.includes('information') || type.includes('transaction')) {
    if (!next.includes('contact:') && !file.includes('public-records')) {
      next = insertFieldAfterReading(next, 'contact', HHVC_CONTACT)
    }
    next = insertFieldAfterReading(next, 'topicTag', TOPIC_TAG)
  }

  if (type.includes('resource collection')) {
    next = addComponentResources(next)
  }

  next = addComponentRelated(next)

  if (key === 'ownerGuidance') {
    next = markSupportingSections(next, [
      '2. Set policies, plans, and lease expectations',
      '3. Prevent pests and seal entry points',
      '4. Track pest activity and coordinate treatments',
      '5. Communicate with residents and staff',
      '6. Partner with licensed pest control operators',
    ])
  }

  if (key === 'noticeOfViolation') {
    next = markSupportingSections(next, [
      'If you are a property owner or manager',
      'If you are a tenant',
    ])
    next = addCalloutVariant(next, 'warning')
  }

  if (key === 'tenantRights') {
    next = addCalloutVariant(next, 'warning')
  }

  if (key === 'afterReport') {
    next = markSupportingSections(next, ['What this page does not promise'])
  }

  if (key === 'mosquitoWorkshop') {
    if (!next.includes('spotlight:')) {
      const spotlight = {
        title: 'Bring mosquito science to your students',
        paragraphs: [
          'Healthy Housing and Vector Control offers a free mosquito education workshop for youth audiences in San Francisco.',
          'Our team sets up interactive science stations where students can explore mosquito biology, breeding habitats, and disease prevention through hands-on learning.',
        ],
        image: {
          src: 'https://images.unsplash.com/photo-1582719471384-894fbb16e074?auto=format&fit=crop&w=800&q=80',
          alt: 'Students at a science education workshop with microscopes',
          karl: 'Campaign Spotlight: image',
        },
        button: 'Request a workshop',
        buttonUrl: '/forms/mosquito-workshop-request/',
        karl: 'Campaign Spotlight 1',
      }
      next = next.replace(
        /(editorStatus: 'placeholder',\n)/,
        `$1  spotlight: ${serializeValue(spotlight, 2)},\n  contact: ${serializeValue(HHVC_CONTACT, 2)},\n`
      )
    }
    next = markSupportingSections(next, [
      'Who can request a workshop',
      'What students experience',
      'Aligned with California education standards',
    ])
  }

  if (key === 'mosquitoControl') {
    if (!next.includes('alertPreview:')) {
      const alertPreview = {
        title: 'Dead bird reporting season',
        text: 'Report dead crows, jays, ravens, and other priority species to help track West Nile virus. This mockup banner previews an Agency/Location alert — not native on Information pages.',
        variant: 'info',
        karl: 'Mockup preview: Agency/Location alert (not native on Information page type)',
        editorLabel: 'Mockup preview: Agency/Location alert',
      }
      next = insertFieldAfterReading(next, 'alertPreview', alertPreview)
      next = insertFieldAfterReading(next, 'contact', {
        phone: ['415-252-3806', '311 (call or text)'],
        email: ['ehb@sfdph.org'],
        other: ['Environmental Health — Mosquito Control Program'],
      })
      next = insertFieldAfterReading(next, 'topicTag', 'Topic: Mosquito and vector control')
    }
  }

  if (VECTOR_IMAGES[key]) {
    next = addImageToFirstSection(next, VECTOR_IMAGES[key])
    if (!next.includes('variant:')) {
      next = addCalloutVariant(next, 'note')
    }
  }

  if (key === 'payFee' && !next.includes('primaryCta')) {
    next = insertFieldAfterReading(next, 'primaryCta', 'Pay your fee')
    next = insertFieldAfterReading(next, 'topicTag', TOPIC_TAG)
    next = insertFieldAfterReading(next, 'contact', HHVC_CONTACT)
  }

  if (next !== code) {
    fs.writeFileSync(filePath, next)
    changed++
    console.log('updated', file)
  }
}

console.log(`backfill complete: ${changed} files updated`)

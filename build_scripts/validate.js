// Validate the HHVC page data model before inventory exports or single-file builds.
// This loads the browser-style page modules in a Node VM context, then enforces
// required fields and shape constraints with Zod so bad page data fails fast.
const fs = require('fs')
const path = require('path')
const vm = require('vm')
const { z } = require('zod')

const root = path.resolve(__dirname, '..')
const ctx = { window: {} }
ctx.window.HHVC_PAGES = {}
vm.createContext(ctx)

// Page modules to execute in the shared VM context. `js/app.js` is intentionally
// excluded because it expects the full DOM and runtime globals.
const files = [
  'pages/agency-service-grouping.js',
  'pages/report-rats-or-mice.js',
  'pages/report-cockroaches.js',
  'pages/report-bed-bugs.js',
  'pages/bed-bug-rules-prevention.js',
  'pages/report-mosquitoes.js',
  'pages/report-garbage-clutter.js',
  'pages/report-overgrown-vegetation.js',
  'pages/report-mold-humidity-condensation.js',
  'pages/hhvc-inspection-scope.js',
  'pages/integrated-pest-management-property-managers.js',
  'pages/what-happens-after-report.js',
  'pages/tenant-rights-reporting.js',
  'pages/keep-rats-and-mice-out.js',
  'pages/prevent-cockroaches.js',
  'pages/prevent-mosquitoes.js',
  'pages/pay-healthy-housing-fee.js',
  'pages/reduce-indoor-moisture.js',
  'js/page-data.js',
  'js/app.js',
]
for (const f of files.filter((f) => f !== 'js/app.js')) {
  vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f })
}

const cardSchema = z.object({
  title: z.string().min(1),
  text: z.string().min(1),
  target: z.string().optional(),
  karl: z.string().optional(),
})

const stepSchema = z.object({
  title: z.string().min(1),
  text: z.array(z.string()).optional(),
  button: z.string().optional(),
  karl: z.string().optional(),
  callout: z
    .object({
      text: z.string().min(1),
      karl: z.string().optional(),
    })
    .optional(),
})

const sectionSchema = z.object({
  heading: z.string().min(1),
  kind: z.string().optional(),
  karl: z.string().min(1),
  paragraphs: z.array(z.string()).optional(),
  steps: z.array(stepSchema).optional(),
  bullets: z.array(z.string()).optional(),
  table: z.array(z.array(z.string())).optional(),
  cards: z.array(cardSchema).optional(),
  button: z.string().optional(),
  buttonTarget: z.string().optional(),
  buttonStyle: z.string().optional(),
  callout: z
    .object({
      text: z.string().min(1),
      karl: z.string().optional(),
    })
    .optional(),
})

const pageSchema = z.object({
  slug: z.string().min(1),
  type: z.string().min(1),
  title: z.string().min(1),
  summary: z.string().min(1),
  audience: z.array(z.string()).min(1),
  reading: z.string().min(1),
  seoTitle: z.string().optional(),
  metaDescription: z.string().optional(),
  primaryCta: z.string().optional(),
  editorNote: z.string().optional(),
  sections: z.array(sectionSchema).optional(),
})

const dataSchema = z.object({
  pages: z.record(pageSchema),
  order: z.array(z.tuple([z.string(), z.string()])),
})

const data = ctx.window.HHVC_DATA
const parsed = dataSchema.safeParse(data)
if (!parsed.success) {
  console.error('Validation errors:')
  for (const issue of parsed.success === false ? parsed.error.issues : []) {
    console.error(`- ${issue.path.join('.') || 'root'}: ${issue.message}`)
  }
  process.exit(1)
}

const keys = new Set(Object.keys(parsed.data.pages))
if (!keys.has('pestsTopic')) throw new Error('pestsTopic missing')
if (keys.has('agency')) throw new Error('old agency key still present')
if (parsed.data.order[0][0] !== 'pestsTopic') throw new Error('Topic page not first')

for (const [key] of parsed.data.order) {
  if (!keys.has(key)) throw new Error('order key missing: ' + key)
}

for (const [key, p] of Object.entries(parsed.data.pages)) {
  for (const s of p.sections || []) {
    for (const c of s.cards || []) {
      if (c.target && !keys.has(c.target)) {
        throw new Error(`${key} links to missing target ${c.target}`)
      }
    }
  }
}

const topicText = JSON.stringify(parsed.data.pages.pestsTopic).toLowerCase()
for (const banned of [
  'plumbing',
  'dbi',
  'roof leak',
  'sewer',
  'permit issue',
  'construction defect',
]) {
  if (topicText.includes(banned)) throw new Error('Topic page banned term: ' + banned)
}

console.log('validated', Object.keys(parsed.data.pages).length, 'pages')

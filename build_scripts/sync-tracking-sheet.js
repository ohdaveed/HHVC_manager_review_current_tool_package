// Regenerate Google Sheets–ready tracking CSVs from current mockup page data.
// Run after page mockup edits: bun run sync-tracking
const fs = require('fs')
const vm = require('vm')
const path = require('path')
const { execSync } = require('child_process')

const root = path.resolve(__dirname, '..')
const reviewDir = path.join(root, 'review')
const auditMatrixPath = path.join(
  root,
  'docs/superpowers/specs/2026-07-02-hhvc-policy-content-audit-matrix.md'
)

const PAGE_FILES = [
  'pages/agency-service-grouping.js',
  'pages/prevent-problems.js',
  'pages/report-a-problem.js',
  'pages/lookup-building-records.js',
  'pages/lookup-complaints-inspections.js',
  'pages/lookup-residential-violations.js',
  'pages/lookup-residential-hotel-records.js',
  'pages/find-district-inspector.js',
  'pages/public-records-request.js',
  'pages/property-owner-responsibilities.js',
  'pages/respond-to-notice-of-violation.js',
  'pages/report-rats-or-mice.js',
  'pages/report-cockroaches.js',
  'pages/report-bed-bugs.js',
  'pages/bed-bug-rules-prevention.js',
  'pages/report-mosquitoes.js',
  'pages/report-dead-bird.js',
  'pages/report-pigeons.js',
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
  'pages/prevent-overgrown-vegetation.js',
  'pages/prevent-garbage-clutter.js',
  'pages/mosquito-control-program.js',
  'pages/mosquito-education-workshop.js',
  'pages/raccoon-information.js',
  'pages/pigeon-information.js',
  'pages/mite-information.js',
  'pages/ground-wasp-information.js',
  'pages/fly-information.js',
  'pages/pay-healthy-housing-fee.js',
  'pages/reduce-indoor-moisture.js',
  'js/page-data.js',
]

const TOPIC_CHECKS = [
  'Topic page uses Report / Prevent / Inspect / Tenant help clusters',
  'Topic page does not use a standalone primary CTA',
  'Topic page does not route users to non-HHVC issue paths',
]

const COMMON_CHECKS = [
  'Page type and Karl tags match the intended page role',
  'Title and summary are plain language',
  'Audience section is clear',
  'Related links support the user task',
  'SEO title and meta description are within target length',
  'Content stays within HHVC / Article 11 scope',
]

const CONTENT_REVIEW_FLAGS = {
  wnvBirdReport:
    'SME-blocked: confirm HHVC/CDPH dead bird collection workflow and seasonal operating details',
  ownerGuidance:
    'Use rodent-proof materials as enforceable concept; examples may include steel wool with sealant, hardware cloth, copper mesh, sheet metal, mortar, or concrete',
}

const POLICY_PHASE_1 = new Set([
  'pestsTopic',
  'ratsReport',
  'cockroachesReport',
  'bedBugsReport',
  'mosquitoesReport',
  'vegetationReport',
  'moldReport',
  'payFee',
])

const POLICY_PHASE_2 = new Set([
  'scopeInfo',
  'ownerGuidance',
  'afterReport',
  'tenantRights',
  'ratsPrevent',
  'cockroachesPrevent',
  'mosquitoesPrevent',
  'reduceMoisture',
  'bedBugsInfo',
])

function loadPageData() {
  const ctx = { window: {} }
  ctx.window.HHVC_PAGES = {}
  vm.createContext(ctx)
  for (const file of PAGE_FILES) {
    vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), ctx, { filename: file })
  }
  return ctx.window.HHVC_DATA
}

function buildPageKeyToSourceFile() {
  const map = {}
  for (const file of PAGE_FILES) {
    if (!file.startsWith('pages/')) continue
    const content = fs.readFileSync(path.join(root, file), 'utf8')
    const match = content.match(/window\.HHVC_PAGES\['([^']+)'\]/)
    if (match) map[match[1]] = file
  }
  return map
}

function csvEscape(value) {
  const text = String(value ?? '')
  const trimmed = text.trimStart()
  const needsProtection =
    trimmed.startsWith('=') ||
    trimmed.startsWith('+') ||
    trimmed.startsWith('-') ||
    trimmed.startsWith('@') ||
    trimmed.startsWith('\t') ||
    trimmed.startsWith('\r')
  const protectedText = needsProtection ? `'${text}` : text
  return /[",\n\r]/.test(protectedText) ? `"${protectedText.replace(/"/g, '""')}"` : protectedText
}

function toCsv(rows) {
  return rows.map((row) => row.map(csvEscape).join(',')).join('\n') + '\n'
}

function primaryCta(page) {
  for (const section of page.sections || []) {
    for (const step of section.steps || []) {
      if (step.button) return step.button
    }
  }
  return page.primaryCta || ''
}

function defaultSeoTitle(page) {
  return page.seoTitle || `${page.title || ''} | San Francisco`
}

function defaultMetaDescription(page) {
  return page.metaDescription || page.summary || ''
}

function gitLastChanged(relativePath) {
  if (!relativePath) return ''
  try {
    return execSync(`git log -1 --format=%cs -- "${relativePath}"`, {
      cwd: root,
      encoding: 'utf8',
    }).trim()
  } catch {
    return ''
  }
}

function gitChangedSinceMain(relativePath) {
  if (!relativePath) return false
  try {
    const diff = execSync(`git diff origin/main --name-only -- "${relativePath}"`, {
      cwd: root,
      encoding: 'utf8',
    }).trim()
    return Boolean(diff)
  } catch {
    return false
  }
}

function gitHasLocalChanges(relativePath) {
  if (!relativePath) return false
  try {
    const diff = execSync(`git diff --name-only -- "${relativePath}"`, {
      cwd: root,
      encoding: 'utf8',
    }).trim()
    return Boolean(diff)
  } catch {
    return false
  }
}

function loadPolicyAuditByPage() {
  const byPage = {}
  if (!fs.existsSync(auditMatrixPath)) return byPage
  const lines = fs.readFileSync(auditMatrixPath, 'utf8').split('\n')
  for (const line of lines) {
    if (!line.startsWith('|') || line.includes('page_key |')) continue
    const cells = line
      .split('|')
      .slice(1, -1)
      .map((cell) => cell.trim())
    if (cells.length < 7) continue
    const [pageKey, , , , , , status] = cells
    if (!pageKey || pageKey === '---') continue
    if (!byPage[pageKey]) byPage[pageKey] = []
    byPage[pageKey].push(status)
  }
  return byPage
}

function summarizePolicyStatus(statuses) {
  if (!statuses || !statuses.length) return 'not_audited'
  const unique = new Set(statuses)
  if (unique.has('conflict')) return 'conflict'
  if (unique.has('missing_source')) return 'missing_source'
  if ([...unique].every((s) => s === 'verified' || s === 'editorial_only')) return 'verified'
  return 'mixed'
}

function policyPhaseForKey(pageKey) {
  if (POLICY_PHASE_1.has(pageKey)) return 'Phase 1'
  if (POLICY_PHASE_2.has(pageKey)) return 'Phase 2'
  return 'Not in policy audit scope'
}

function mockupChangeStatus(sourceFile) {
  if (gitHasLocalChanges(sourceFile)) return 'Uncommitted changes'
  if (gitChangedSinceMain(sourceFile)) return 'Changed since main'
  return 'Current'
}

function checklistItemsForPage(pageKey, pageType) {
  if (pageKey === 'pestsTopic') return [...TOPIC_CHECKS, ...COMMON_CHECKS]
  return COMMON_CHECKS
}

function writeTrackingSheet(data, pageKeyToFile, policyAuditByPage, generatedAt) {
  const headers = [
    'sync_generated_at',
    'page_key',
    'page_title',
    'page_type',
    'url_slug',
    'mockup_source_file',
    'mockup_validation',
    'mockup_last_changed',
    'mockup_change_status',
    'policy_phase',
    'policy_audit_status',
    'policy_audit_claim_count',
    'content_review_flag',
    'manager_decision',
    'mockup_status',
    'notes',
  ]

  const rows = [headers]
  for (const [key] of data.order) {
    const page = data.pages[key] || {}
    const sourceFile = pageKeyToFile[key] || ''
    const auditStatuses = policyAuditByPage[key] || []
    const changeStatus = mockupChangeStatus(sourceFile)
    const contentFlag = CONTENT_REVIEW_FLAGS[key] || ''
    const mockupStatus =
      changeStatus === 'Current' && summarizePolicyStatus(auditStatuses) === 'verified'
        ? 'Ready for manager review'
        : changeStatus !== 'Current'
          ? 'Mockup updated — refresh manager review'
          : contentFlag
            ? 'Blocked pending SME/legal review'
            : 'Needs review'

    rows.push([
      generatedAt,
      key,
      page.title || '',
      page.type || '',
      page.slug || '',
      sourceFile,
      'pass',
      gitLastChanged(sourceFile),
      changeStatus,
      policyPhaseForKey(key),
      summarizePolicyStatus(auditStatuses),
      String(auditStatuses.length),
      contentFlag,
      'Needs review',
      mockupStatus,
      contentFlag ? contentFlag : '',
    ])
  }

  const outPath = path.join(reviewDir, 'mockup_tracking_sheet.csv')
  fs.writeFileSync(outPath, toCsv(rows))
  return outPath
}

function writeManagerDecisionLog(data) {
  const headers = [
    'review_date',
    'reviewer',
    'page_key',
    'page_title',
    'page_type',
    'url_slug',
    'decision',
    'notes',
    'risks_or_blockers',
    'follow_up_owner',
    'seo_title',
    'meta_description',
    'primary_cta',
    'reading_target',
  ]

  const rows = [headers]
  for (const [key] of data.order) {
    const page = data.pages[key] || {}
    rows.push([
      '',
      '',
      key,
      page.title || '',
      page.type || '',
      page.slug || '',
      'Needs review',
      '',
      CONTENT_REVIEW_FLAGS[key] || '',
      '',
      defaultSeoTitle(page),
      defaultMetaDescription(page),
      primaryCta(page),
      page.reading || '',
    ])
  }

  const outPath = path.join(reviewDir, 'manager_decision_log.csv')
  fs.writeFileSync(outPath, toCsv(rows))
  return outPath
}

function writePageApprovalChecklist(data) {
  const headers = ['page_key', 'page_title', 'page_type', 'check_item', 'status', 'notes']
  const rows = [headers]

  for (const [key] of data.order) {
    const page = data.pages[key] || {}
    for (const item of checklistItemsForPage(key, page.type || '')) {
      rows.push([key, page.title || '', page.type || '', item, '', ''])
    }
  }

  const outPath = path.join(reviewDir, 'page_approval_checklist.csv')
  fs.writeFileSync(outPath, toCsv(rows))
  return outPath
}

function main() {
  const data = loadPageData()
  const pageKeyToFile = buildPageKeyToSourceFile()
  const policyAuditByPage = loadPolicyAuditByPage()
  const generatedAt = new Date().toISOString()

  fs.mkdirSync(reviewDir, { recursive: true })

  const trackingPath = writeTrackingSheet(data, pageKeyToFile, policyAuditByPage, generatedAt)
  const decisionPath = writeManagerDecisionLog(data)
  const checklistPath = writePageApprovalChecklist(data)

  const changedCount = data.order.filter(([key]) => {
    const sourceFile = pageKeyToFile[key]
    return mockupChangeStatus(sourceFile) !== 'Current'
  }).length

  console.log(`wrote ${path.relative(root, trackingPath)} (${data.order.length} pages)`)
  console.log(`wrote ${path.relative(root, decisionPath)}`)
  console.log(`wrote ${path.relative(root, checklistPath)}`)
  if (changedCount) {
    console.log(
      `${changedCount} page(s) flagged with mockup changes since main or uncommitted edits`
    )
  }
}

main()

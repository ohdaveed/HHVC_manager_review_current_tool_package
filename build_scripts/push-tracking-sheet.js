// Push mockup tracking status into the Google Master Control workbook.
// Reads the live sheet via public CSV export, merges review/mockup_tracking_sheet.csv,
// writes review/page_inventory_sheet_update.csv, and optionally pushes via Sheets API.
const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const root = path.resolve(__dirname, '..')
const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'sheet-config.json'), 'utf8'))
const trackingPath = path.join(root, 'review/mockup_tracking_sheet.csv')
const updateOutPath = path.join(root, 'review/page_inventory_sheet_update.csv')

function parseCsv(text) {
  const rows = []
  let row = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i += 1) {
    const ch = text.charAt(i)
    const next = text.charAt(i + 1)

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"'
        i += 1
      } else if (ch === '"') {
        inQuotes = false
      } else {
        field += ch
      }
      continue
    }

    if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      row.push(field)
      field = ''
    } else if (ch === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else if (ch === '\r') {
      // ignore
    } else {
      field += ch
    }
  }

  if (field.length || row.length) {
    row.push(field)
    rows.push(row)
  }

  return rows
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
  return /[",\n\r]/.test(protectedText)
    ? `"${protectedText.replace(/"/g, '""')}"`
    : protectedText
}

function toCsv(rows) {
  return rows.map((row) => row.map(csvEscape).join(',')).join('\n') + '\n'
}

function rowsToObjects(rows) {
  const [header, ...body] = rows
  return body.filter((row) => row.some((cell) => String(cell || '').trim())).map((row) => {
    const obj = {}
    header.forEach((key, index) => {
      obj[key] = row[index] ?? ''
    })
    return obj
  })
}

function objectsToRows(objects, header) {
  return [header, ...objects.map((obj) => header.map((key) => obj[key] ?? ''))]
}

function loadTrackingByKey() {
  const text = fs.readFileSync(trackingPath, 'utf8')
  const rows = rowsToObjects(parseCsv(text))
  const map = new Map()
  for (const row of rows) map.set(row.page_key, row)
  return map
}

function fetchSheetInventoryCsv() {
  const url = `https://docs.google.com/spreadsheets/d/${config.spreadsheetId}/export?format=csv&gid=${config.tabs.pageInventory.gid}`
  return execSync(`curl -sL --max-time 30 ${JSON.stringify(url)}`, {
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  })
}

function mapMockupStatus(status) {
  switch (status) {
    case 'Ready for manager review':
      return 'Ready for manager review'
    case 'Mockup updated — refresh manager review':
      return 'Mockup updated — refresh review'
    case 'Blocked pending SME/legal review':
      return 'Blocked — SME/legal review'
    default:
      return 'In GitHub mockup'
  }
}

function buildScopeNotes(existing, tracking) {
  const syncParts = []
  if (tracking.mockup_change_status && tracking.mockup_change_status !== 'Current') {
    syncParts.push(`change=${tracking.mockup_change_status}`)
  }
  if (tracking.policy_audit_status && tracking.policy_audit_status !== 'not_audited') {
    syncParts.push(`policy=${tracking.policy_audit_status}`)
  }
  if (tracking.content_review_flag) syncParts.push(tracking.content_review_flag)

  const syncLine = syncParts.length
    ? `Mockup sync (${new Date().toISOString().slice(0, 10)}): ${syncParts.join('; ')}`
    : ''

  const preserved = String(existing || '').trim()
  if (!syncLine) return preserved
  if (!preserved) return syncLine
  if (preserved.includes(syncLine)) return preserved
  return `${preserved} | ${syncLine}`
}

function buildSourceBasis(existing, tracking) {
  const basis = String(existing || '').trim() || 'GitHub repo main'
  const extras = []
  if (tracking.mockup_validation) extras.push(`validation=${tracking.mockup_validation}`)
  if (tracking.policy_audit_status) extras.push(`policy=${tracking.policy_audit_status}`)
  if (tracking.policy_phase && tracking.policy_phase !== 'Not in policy audit scope') {
    extras.push(tracking.policy_phase)
  }
  const suffix = extras.join('; ')
  if (!suffix) return basis
  return basis.includes(suffix) ? basis : `${basis}; ${suffix}`
}

function resolveStatus(existing, tracking) {
  const current = String(existing || '').trim()
  const next = mapMockupStatus(tracking.mockup_status)

  if (next === 'Blocked — SME/legal review') return next
  if (next === 'Ready for manager review' && current === 'In GitHub mockup') return next
  if (next === 'Mockup updated — refresh review') return next
  if (current.startsWith('Blocked')) return current
  return current || next
}

function mergeInventoryRows(sheetRows, trackingByKey) {
  const [header, ...body] = sheetRows
  const keyIndex = header.indexOf(config.matchColumn)
  if (keyIndex < 0) throw new Error(`Missing match column: ${config.matchColumn}`)

  const today = new Date().toISOString().slice(0, 10)
  let updatedCount = 0

  const mergedBody = body.map((row) => {
    const next = [...row]
    const pageKey = next[keyIndex]
    const tracking = trackingByKey.get(pageKey)
    if (!tracking) return next

    const col = (name) => header.indexOf(name)
    const set = (name, value) => {
      const index = col(name)
      if (index >= 0) next[index] = value
    }

    set('Source File', tracking.mockup_source_file || next[col('Source File')] || '')
    set('Status', resolveStatus(next[col('Status')], tracking))
    set('Scope / Review Notes', buildScopeNotes(next[col('Scope / Review Notes')], tracking))
    set('Source Basis', buildSourceBasis(next[col('Source Basis')], tracking))
    set('Last Repo Sync', today)
    updatedCount += 1
    return next
  })

  return { rows: [header, ...mergedBody], updatedCount, today }
}

async function pushWithServiceAccount(rows) {
  const credsJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  if (!credsJson) return false

  let google
  try {
    ;({ google } = require('googleapis'))
  } catch {
    throw new Error(
      'googleapis is required for API push. Run: npm install --no-save googleapis'
    )
  }

  const credentials = JSON.parse(credsJson)
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  })
  const sheets = google.sheets({ version: 'v4', auth })
  const range = `'${config.tabs.pageInventory.name}'!A1:ZZ${rows.length}`

  await sheets.spreadsheets.values.update({
    spreadsheetId: config.spreadsheetId,
    range,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: rows },
  })

  return true
}

async function appendAutomationLog(summary) {
  const credsJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  if (!credsJson) return

  let google
  try {
    ;({ google } = require('googleapis'))
  } catch {
    return
  }

  const credentials = JSON.parse(credsJson)
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  })
  const sheets = google.sheets({ version: 'v4', auth })
  const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 16)

  await sheets.spreadsheets.values.append({
    spreadsheetId: config.spreadsheetId,
    range: `'${config.tabs.automationLog.name}'!A:K`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: {
      values: [
        [
          timestamp,
          'Cloud Agent',
          'Sync mockup tracking status',
          'GitHub HHVC manager review tool',
          config.tabs.pageInventory.name,
          'Complete',
          summary,
          '',
          `https://github.com/ohdaveed/HHVC_manager_review_current_tool_package`,
          '',
          'Generated by bun run push-tracking',
        ],
      ],
    },
  })
}

async function main() {
  if (!fs.existsSync(trackingPath)) {
    execSync('bun build_scripts/sync-tracking-sheet.js', { cwd: root, stdio: 'inherit' })
  }

  const trackingByKey = loadTrackingByKey()
  const sheetCsv = fetchSheetInventoryCsv()
  if (sheetCsv.startsWith('<!DOCTYPE html')) {
    throw new Error('Could not export the Google Sheet inventory tab. Check sharing/export settings.')
  }

  const sheetRows = parseCsv(sheetCsv)
  const { rows, updatedCount, today } = mergeInventoryRows(sheetRows, trackingByKey)
  fs.writeFileSync(updateOutPath, toCsv(rows))

  console.log(`wrote ${path.relative(root, updateOutPath)} (${updatedCount} rows merged)`)

  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    await pushWithServiceAccount(rows)
    await appendAutomationLog(`Updated ${updatedCount} page inventory rows; Last Repo Sync=${today}`)
    console.log('pushed updates to Google Sheet via service account')
    return
  }

  console.log('')
  console.log('Google Sheet is view/export only from this environment (edit requires sign-in).')
  console.log('Next steps:')
  console.log('  1. Open the workbook → 004 Page Inventory & IA → File → Import → Upload')
  console.log(`  2. Select review/page_inventory_sheet_update.csv → Replace current sheet`)
  console.log('  Or set GOOGLE_SERVICE_ACCOUNT_JSON and share the sheet with that service account email.')
}

main().catch((err) => {
  console.error(err.message || err)
  process.exit(1)
})

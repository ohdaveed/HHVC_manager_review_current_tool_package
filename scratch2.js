const fs = require('fs')
const path = require('path')
const dir = '/home/ohdaveed/HHVC_manager_review_current_tool_package/pages'
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.js'))
for (const f of files) {
  const content = fs.readFileSync(path.join(dir, f), 'utf8')
  const lines = content.split('\n')
  lines.forEach((line, i) => {
    if (
      line.includes('unconfirmed') ||
      line.includes('single-item') ||
      line.includes('single item') ||
      line.includes('field name') ||
      line.includes('uninspected') ||
      line.match(/not yet inspected/i)
    ) {
      console.log(`${f}:${i + 1} - ${line.trim()}`)
    }
  })
}

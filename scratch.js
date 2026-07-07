const fs = require('fs')
const path = require('path')
const dir = '/home/ohdaveed/HHVC_manager_review_current_tool_package/pages'
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.js'))
for (const f of files) {
  const content = fs.readFileSync(path.join(dir, f), 'utf8')
  if (
    content.includes('field name not yet inspected') ||
    content.includes('unconfirmed') ||
    content.includes('single-item') ||
    content.includes('single item')
  ) {
    console.log(f)
  }
}

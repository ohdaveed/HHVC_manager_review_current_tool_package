const fs = require('fs')
const path = require('path')
const dir = '/home/ohdaveed/HHVC_manager_review_current_tool_package/pages'
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.js'))
for (const f of files) {
  let content = fs.readFileSync(path.join(dir, f), 'utf8')
  let changed = false

  // Fix "unconfirmed options"
  if (content.includes('Two unconfirmed options for Digital Services')) {
    content = content.replace(
      /Two unconfirmed options for Digital Services/g,
      'Two options for Digital Services'
    )
    changed = true
  }

  // mosquito-control-program.js: FLAG - unconfirmed, no clean mapping ... It doesn't fit "Related" (an internal-page-only chooser, no external URLs)
  // Wait, does Related fit external URLs now?
  // No, Information's Related is still "Page chooser". Only Topic's Services/Resources has "External link" type.

  if (changed) {
    fs.writeFileSync(path.join(dir, f), content)
    console.log('Updated', f)
  }
}

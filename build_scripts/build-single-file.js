// Regenerate the self-contained single-file exports from index.html.
// Uses cheerio to inline local CSS/JS reliably while leaving external URLs alone.
const fs = require('fs')
const path = require('path')
const cheerio = require('cheerio')

const root = path.resolve(__dirname, '..')
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8')

let html = read('index.html')
const $ = cheerio.load(html, { decodeEntities: false })

$('link[rel="stylesheet"]').each((_i, el) => {
  const href = $(el).attr('href')
  if (!href || /^https?:\/\//.test(href)) return
  const style = $('<style></style>').text(read(href))
  $(el).replaceWith(style)
})

$('script[src]').each((_i, el) => {
  const src = $(el).attr('src')
  if (!src || /^https?:\/\//.test(src)) return
  const script = $('<script></script>').text(read(src))
  $(el).replaceWith(script)
})

html = $.html()

const outputs = ['manager-review-single-file.html', 'single-file-export-current-source.html']
for (const out of outputs) {
  fs.writeFileSync(path.join(root, out), html)
  console.log(`wrote ${out} (${html.length} bytes)`)
}

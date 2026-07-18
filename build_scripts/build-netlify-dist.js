// Assemble the static deploy bundle in dist/ for Netlify.
// Copies only what the browser needs at runtime: index.html, css/, js/,
// pages/, and the three @sfgov/design-system stylesheets that index.html
// references via their node_modules paths (kept at the same relative path
// so index.html works unmodified). Plain Node APIs so it runs under either
// node or bun.
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const dist = path.join(root, 'dist')

fs.rmSync(dist, { recursive: true, force: true })
fs.mkdirSync(dist, { recursive: true })

const copies = [
  'index.html',
  'css',
  'js',
  'pages',
  'node_modules/papaparse/papaparse.min.js',
  'node_modules/@sfgov/design-system/dist/css/base.css',
  'node_modules/@sfgov/design-system/dist/css/typography.css',
  'node_modules/@sfgov/design-system/dist/css/components.css',
]

for (const rel of copies) {
  const src = path.join(root, rel)
  if (!fs.existsSync(src)) {
    console.error(
      'Error: Source path "' +
        rel +
        '" does not exist.' +
        (rel.startsWith('node_modules') ? ' Did you run "npm install" or "bun install"?' : '')
    )
    process.exit(1)
  }
  const dest = path.join(dist, rel)
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  fs.cpSync(src, dest, { recursive: true })
  console.log('copied ' + rel)
}

// The mosquito workshop form is a Vite sub-app whose committed build output
// (forms/mosquito-workshop-request/dist) is compiled with
// base '/forms/mosquito-workshop-request/', so publish it at that path.
const formSrc = path.join(root, 'forms/mosquito-workshop-request/dist')
const formDest = path.join(dist, 'forms/mosquito-workshop-request')

// Guard against shipping a broken form. This step copies whatever is checked
// in under the sub-app's dist/ — it does NOT run Vite — so if the committed
// index.html references a hashed asset that was never committed (a real
// regression: an unanchored "dist/" gitignore rule once swallowed the rebuilt
// JS bundle, deploying a form shell that loaded CSS but never hydrated), the
// deploy would silently ship a dead form. Parse the asset references out of
// the HTML and fail loudly when any are missing so the fix ("bun run
// build:workshop-form", then commit dist/) happens before deploy, not after.
const formHtmlPath = path.join(formSrc, 'index.html')
if (!fs.existsSync(formHtmlPath)) {
  console.error(
    'Error: forms/mosquito-workshop-request/dist/index.html is missing. ' +
      'Run "bun run build:workshop-form" and commit the dist/ output.'
  )
  process.exit(1)
}
const formHtml = fs.readFileSync(formHtmlPath, 'utf8')
// Vite emits absolute URLs under the sub-app's base path, e.g.
// src="/forms/mosquito-workshop-request/assets/index-<hash>.js". Each one must
// resolve to a real file inside the committed dist/ directory.
const assetRefs = [...formHtml.matchAll(/\/forms\/mosquito-workshop-request\/(assets\/[^"']+)/g)]
const missingAssets = assetRefs
  .map((match) => match[1])
  .filter((relAsset) => !fs.existsSync(path.join(formSrc, relAsset)))
if (missingAssets.length > 0) {
  console.error(
    'Error: forms/mosquito-workshop-request/dist/index.html references assets that are not on disk:\n' +
      missingAssets.map((asset) => '  - ' + asset).join('\n') +
      '\nThe committed form build is incomplete (the deployed form would never hydrate). ' +
      'Run "bun run build:workshop-form" and commit everything under forms/mosquito-workshop-request/dist/.'
  )
  process.exit(1)
}

fs.mkdirSync(path.dirname(formDest), { recursive: true })
fs.cpSync(formSrc, formDest, { recursive: true })
console.log('copied forms/mosquito-workshop-request/dist -> forms/mosquito-workshop-request')

console.log(`dist ready at ${dist}`)

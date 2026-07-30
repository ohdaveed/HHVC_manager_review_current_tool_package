// Publish the mosquito workshop form into the main app's dist/ bundle.
//
// This is the surviving half of the old build_scripts/build-netlify-dist.js.
// That script used to assemble the whole deploy bundle by hand — copying
// index.html, css/, js/, pages/ and three @sfgov/design-system stylesheets out
// of node_modules — because there was no bundler to do it. `vite build` now
// produces dist/ directly, so all of that copying is gone.
//
// What could not go is the integrity check below. forms/mosquito-workshop-request
// is a separate Vite sub-app whose build output is COMMITTED, and this step
// copies whatever is checked in rather than rebuilding it. That gap is a real
// regression that has shipped before: an unanchored "dist/" gitignore rule
// once swallowed the sub-app's rebuilt JS bundle, and the deploy went out with
// a form shell that loaded its CSS and never hydrated. Parsing the asset
// references out of the committed HTML and failing loudly turns that into a
// build failure instead of a silently dead form in production.
//
// Plain Node APIs so it runs under either node or bun.
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const dist = path.join(root, 'dist')

// The sub-app is built with base '/forms/mosquito-workshop-request/', so it
// has to be published at exactly that path for its asset URLs to resolve.
const formSrc = path.join(root, 'forms/mosquito-workshop-request/dist')
const formDest = path.join(dist, 'forms/mosquito-workshop-request')

if (!fs.existsSync(dist)) {
  console.error('Error: dist/ does not exist. Run "bun run build:app" first.')
  process.exit(1)
}

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
console.log('copied forms/mosquito-workshop-request/dist -> dist/forms/mosquito-workshop-request')

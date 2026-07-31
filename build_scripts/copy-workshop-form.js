// Publish the mosquito workshop form, and the stylesheets it shares with the
// main app, into the built dist/ bundle.
//
// This is the surviving half of the old build_scripts/build-netlify-dist.js.
// That script assembled the whole deploy bundle by hand — index.html, css/,
// js/, pages/, and three @sfgov/design-system stylesheets out of node_modules —
// because there was no bundler. `vite build` now produces dist/ directly, so
// almost all of that copying is gone.
//
// Two things could not go:
//
// 1. forms/mosquito-workshop-request is a separate Vite sub-app whose build
//    output is COMMITTED, and this step copies what is checked in rather than
//    rebuilding it.
// 2. That sub-app's index.html links /css/styles.css and /css/ux-improvements.css
//    at the site root. Vite hashes the main app's CSS into dist/assets/ instead,
//    so nothing would serve those paths — the form would hydrate but render
//    completely unstyled. The old script copied css/ wholesale, which is why
//    this worked before; copying it here restores exactly that behaviour.
//
// The integrity check below is why this script fails loudly instead of shipping
// a broken form. It has caught two distinct regressions now: an unanchored
// "dist/" gitignore rule once swallowed the sub-app's rebuilt JS bundle and the
// deploy went out with a shell that loaded CSS and never hydrated; and the css/
// copy above went missing during the Vite migration, 404ing both stylesheets in
// production. The first was caught because the check looked at assets/ paths.
// The second was NOT, because it only looked at assets/ paths — so the check now
// validates EVERY root-absolute reference in the committed HTML, against the
// fully assembled dist/ rather than against the source directories. That is the
// state the browser actually sees.
//
// Plain Node APIs so it runs under either node or bun.
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const dist = path.join(root, 'dist')

// The sub-app is built with base '/forms/mosquito-workshop-request/', so it has
// to be published at exactly that path for its asset URLs to resolve.
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

// --- Copy the shared stylesheets the form links by absolute path ------------
const cssSrc = path.join(root, 'css')
if (!fs.existsSync(cssSrc)) {
  console.error('Error: css/ is missing from the repository.')
  process.exit(1)
}
fs.cpSync(cssSrc, path.join(dist, 'css'), { recursive: true })
console.log('copied css/ -> dist/css')

// --- Copy the committed sub-app build ---------------------------------------
fs.mkdirSync(path.dirname(formDest), { recursive: true })
fs.cpSync(formSrc, formDest, { recursive: true })
console.log('copied forms/mosquito-workshop-request/dist -> dist/forms/mosquito-workshop-request')

// --- Verify every root-absolute reference resolves inside the bundle --------
const formHtml = fs.readFileSync(formHtmlPath, 'utf8')
// Vite emits absolute URLs under the sub-app's base path, e.g.
// src="/forms/mosquito-workshop-request/assets/index-<hash>.js", and the
// hand-written <link>s point at /css/*.css. Both are relative to the deployed
// site root, which is dist/.
const referenced = [...formHtml.matchAll(/(?:href|src)="(\/[^"#?]+)/g)].map((match) => match[1])
const missing = [...new Set(referenced)].filter(
  (ref) => !fs.existsSync(path.join(dist, ref.replace(/^\//, '')))
)
if (missing.length > 0) {
  console.error(
    'Error: forms/mosquito-workshop-request/dist/index.html references paths that are ' +
      'not present in the assembled dist/ bundle:\n' +
      missing.map((ref) => '  - ' + ref).join('\n') +
      '\nThe deployed form would request these and get a 404. If they are hashed ' +
      'assets under /forms/, the committed form build is incomplete — run ' +
      '"bun run build:workshop-form" and commit everything under ' +
      'forms/mosquito-workshop-request/dist/. If they are shared files such as ' +
      '/css/*.css, this script needs to publish them.'
  )
  process.exit(1)
}
console.log(`verified ${new Set(referenced).size} referenced path(s) resolve inside dist/`)

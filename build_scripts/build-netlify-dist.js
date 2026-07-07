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
fs.mkdirSync(path.dirname(formDest), { recursive: true })
fs.cpSync(formSrc, formDest, { recursive: true })
console.log('copied forms/mosquito-workshop-request/dist -> forms/mosquito-workshop-request')

console.log(`dist ready at ${dist}`)

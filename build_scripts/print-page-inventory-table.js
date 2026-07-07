#!/usr/bin/env node
const fs = require('fs')
const vm = require('vm')
const path = require('path')
const { PAGE_MODULE_FILES, PAGE_DATA_FILE } = require('./page-files')

const root = path.resolve(__dirname, '..')

const ctx = { window: { HHVC_PAGES: {} } }
vm.createContext(ctx)
for (const f of PAGE_MODULE_FILES) {
  vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f })
}
vm.runInContext(fs.readFileSync(path.join(root, PAGE_DATA_FILE), 'utf8'), ctx)

let n = 0
for (const [key] of ctx.window.HHVC_DATA.order) {
  const p = ctx.window.HHVC_PAGES[key]
  if (!p) {
    console.error('missing page:', key)
    process.exit(1)
  }
  n++
  console.log(`| ${n} | \`${key}\` | ${p.title.replace(/\|/g, '\\|')} | ${p.type} |`)
}

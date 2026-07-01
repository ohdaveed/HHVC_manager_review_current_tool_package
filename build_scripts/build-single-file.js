// Regenerate the self-contained single-file exports from index.html.
// Inlines css/styles.css and every <script src="..."> referenced by index.html,
// so the exports always reflect the current pages/*.js, js/*.js, and css.
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');

const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

let html = read('index.html');

// Inline the stylesheet.
const css = read('css/styles.css');
html = html.replace(
  /[ \t]*<link rel="stylesheet" href="css\/styles\.css"[^>]*>\s*/,
  `  <style>\n${css}\n  </style>\n`
);

// Inline each external script in place, preserving order.
html = html.replace(
  /[ \t]*<script src="([^"]+)"><\/script>/g,
  (_match, src) => `  <script>\n${read(src)}\n  </script>`
);

const outputs = [
  'manager-review-single-file.html',
  'single-file-export-current-source.html',
];
for (const out of outputs) {
  fs.writeFileSync(path.join(root, out), html);
  console.log(`wrote ${out} (${html.length} bytes)`);
}

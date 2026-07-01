const fs = require('fs');
const vm = require('vm');
const path = require('path');
const root = path.resolve(__dirname, '..');
const ctx = { window: {} };
ctx.window.HHVC_PAGES = {};
vm.createContext(ctx);
const files = [
  'pages/agency-service-grouping.js','pages/report-rats-or-mice.js','pages/report-cockroaches.js','pages/report-bed-bugs.js',
  'pages/bed-bug-rules-prevention.js','pages/report-mosquitoes.js','pages/report-vegetation-garbage.js','pages/report-mold-humidity-condensation.js','pages/hhvc-inspection-scope.js',
  'pages/integrated-pest-management-property-managers.js','pages/what-happens-after-report.js','pages/tenant-rights-reporting.js',
  'pages/keep-rats-and-mice-out.js','pages/prevent-cockroaches.js','pages/prevent-mosquitoes.js','js/page-data.js'
];
for (const f of files) {
  const code = fs.readFileSync(path.join(root, f), 'utf8');
  vm.runInContext(code, ctx, { filename: f });
}
const data = ctx.window.HHVC_DATA;
fs.writeFileSync(path.join(root, 'data/page_inventory.json'), JSON.stringify(data, null, 2));
const rows = [['Page Key','Menu Label','Page Title','Page Type','URL Slug','Audience Count','Section Count','Reading Target','SEO Title','Meta Description','Primary CTA']];
function primaryCta(page) {
  for (const section of (page.sections || [])) for (const step of (section.steps || [])) if (step.button) return step.button;
  return page.primaryCta || '';
}
function defaultSeoTitle(page) { return page.seoTitle || `${page.title} | San Francisco`; }
function defaultMetaDescription(page) { return page.metaDescription || page.summary || ''; }
for (const [key, label] of data.order) {
  const p = data.pages[key];
  rows.push([key,label,p.title,p.type,p.slug,String((p.audience||[]).length),String((p.sections||[]).length),p.reading||'',defaultSeoTitle(p),defaultMetaDescription(p),primaryCta(p)]);
}
function esc(v) { const s = String(v ?? ''); return /[",\n\r]/.test(s) ? '"' + s.replaceAll('"', '""') + '"' : s; }
fs.writeFileSync(path.join(root, 'data/page_inventory.csv'), rows.map(r => r.map(esc).join(',')).join('\n') + '\n');

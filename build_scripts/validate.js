
const fs = require('fs'); const path = require('path'); const vm = require('vm');
const root = path.resolve(__dirname, '..'); const ctx = { window: {} }; ctx.window.HHVC_PAGES = {}; vm.createContext(ctx);
const files = ["pages/agency-service-grouping.js", "pages/report-rats-or-mice.js", "pages/report-cockroaches.js", "pages/report-bed-bugs.js", "pages/bed-bug-rules-prevention.js", "pages/report-mosquitoes.js", "pages/report-vegetation-garbage.js", "pages/report-mold-humidity-condensation.js", "pages/hhvc-inspection-scope.js", "pages/integrated-pest-management-property-managers.js", "pages/what-happens-after-report.js", "pages/tenant-rights-reporting.js", "pages/keep-rats-and-mice-out.js", "pages/prevent-cockroaches.js", "pages/prevent-mosquitoes.js", "pages/pay-healthy-housing-fee.js", "pages/reduce-indoor-moisture.js", "js/page-data.js", "js/app.js"];
for (const f of files.filter(f => f !== 'js/app.js')) vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'), ctx, {filename:f});
const data = ctx.window.HHVC_DATA; if (!data.pages.pestsTopic) throw new Error('pestsTopic missing'); if (data.pages.agency) throw new Error('old agency key still present'); if (data.order[0][0] !== 'pestsTopic') throw new Error('Topic page not first');
const keys = new Set(Object.keys(data.pages));
for (const [key] of data.order) { if (!keys.has(key)) throw new Error('order key missing: '+key); }
for (const [key, p] of Object.entries(data.pages)) for (const s of p.sections || []) for (const c of s.cards || []) if (c.target && !keys.has(c.target)) throw new Error(`${key} links to missing target ${c.target}`);
const topicText = JSON.stringify(data.pages.pestsTopic).toLowerCase();
for (const banned of ['plumbing','dbi','roof leak','sewer','permit issue','construction defect']) if (topicText.includes(banned)) throw new Error('Topic page banned term: '+banned);
console.log('validated', Object.keys(data.pages).length, 'pages');

window.HHVC_PAGES = window.HHVC_PAGES || {}
window.HHVC_DATA = {
  pages: window.HHVC_PAGES,
  order: [
    ['pestsTopic', 'Agency page: Healthy Housing and Vector Control'],
    ['rodentsReport', 'Transaction: Report rats, mice, and other four-legged problems'],
    ['filthReport', 'Transaction: Report garbage, filth, and overgrown vegetation'],
    ['insectsReport', 'Transaction: Report cockroaches, mosquitoes, and other insects'],
    ['recordsHub', 'Resource collection: Look up building records'],
    ['findRecords', 'Transaction: Find complaints and inspection records'],
    ['findViolations', 'Transaction: Look up residential health code violations'],
    ['findHotelRecords', 'Transaction: Find residential hotel and shelter records'],
    ['publicRecords', 'Transaction: Make a public records request'],
    ['ownerHub', 'Resource collection: Property owner responsibilities'],
    ['noticeOfViolation', 'Information: How to respond to a notice of violation'],
    ['payFee', 'Transaction: Pay your Healthy Housing fee'],
    ['scopeInfo', 'Information: Learn what HHVC can inspect'],
    ['article11Guide', 'Report: Health Code Article 11 in plain language'],
    ['ownerGuidance', 'Information: Integrated pest management for property owners and managers'],
    ['afterReport', 'Information: What happens after you report'],
    ['tenantRights', 'Information: Tenant rights and reporting'],
    ['mosquitoControl', 'Information: Mosquito Control Program'],
    ['mosquitoWorkshop', 'Campaign: Free mosquito education workshop'],
  ],
}

// Old page keys retired by content consolidations, mapped to the current
// page that covers the same scope, so a saved/shared ?page=<oldKey> link
// redirects instead of leaving the viewer stuck on the loading placeholder
// (renderPage() no-ops on an unknown key). See js/app.js's init() and
// popstate handler for where this is consulted.
window.HHVC_DELETED_PAGE_ALIASES = {
  // Retired pre-2026-07-15 (report-transaction-only consolidation, #62)
  reportHub: 'pestsTopic',
  wnvBirdReport: 'insectsReport',
  moldReport: 'filthReport',
  vegetationReport: 'filthReport',
  // Retired 2026-07-15 (40-to-19-page consolidation, #60)
  ratsReport: 'rodentsReport',
  garbageReport: 'filthReport',
  bedBugsReport: 'insectsReport',
  cockroachesReport: 'insectsReport',
  mosquitoesReport: 'insectsReport',
  pigeonsReport: 'filthReport',
  bedBugsInfo: 'insectsReport',
  flyInfo: 'insectsReport',
  waspInfo: 'insectsReport',
  miteInfo: 'insectsReport',
  raccoonInfo: 'rodentsReport',
  pigeonInfo: 'filthReport',
  garbageInfo: 'filthReport',
  vegetationInfo: 'filthReport',
  reduceMoisture: 'filthReport',
  ratsPrevent: 'rodentsReport',
  cockroachesPrevent: 'insectsReport',
  mosquitoesPrevent: 'mosquitoControl',
  preventHub: 'pestsTopic',
  findInspector: 'scopeInfo',
}

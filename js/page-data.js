/* Assembles window.HHVC_DATA from the individual page modules.

   The imports below are for their side effects: each pages/*.js file
   registers its own page object onto window.HHVC_PAGES, and this module
   then wraps that registry with the `order` array that drives navigation
   and menu order. Listing them here — rather than in a hand-maintained
   block of <script> tags in index.html — is what makes the old
   "tag missing / tag points at a deleted file" drift class impossible;
   a bad path is now a build error. Adding a page means adding an import
   here plus an `order` entry below. */

import '../pages/agency-service-grouping.js'
import '../pages/report-rats-mice-four-legged-problems.js'
import '../pages/report-garbage-filth-vegetation.js'
import '../pages/report-cockroaches-mosquitoes-insects.js'
import '../pages/lookup-building-records.js'
import '../pages/lookup-complaints-inspections.js'
import '../pages/lookup-residential-violations.js'
import '../pages/lookup-residential-hotel-records.js'
import '../pages/public-records-request.js'
import '../pages/property-owner-responsibilities.js'
import '../pages/respond-to-notice-of-violation.js'
import '../pages/hhvc-inspection-scope.js'
import '../pages/integrated-pest-management-property-managers.js'
import '../pages/what-happens-after-report.js'
import '../pages/tenant-rights-reporting.js'
import '../pages/mosquito-control-program.js'
import '../pages/mosquito-education-workshop.js'
import '../pages/pay-healthy-housing-fee.js'
import '../pages/article-11-compliance-for-property-owners.js'
import '../pages/health-code-article-11.js'

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
    ['article11Compliance', 'Information: Article 11 compliance for property owners'],
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

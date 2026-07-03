window.HHVC_PAGES = window.HHVC_PAGES || {}
window.HHVC_PAGES['ownerHub'] = {
  slug: 'sf.gov/property-owner-responsibilities-hhvc',
  type: 'Resource collection',
  title: 'Property owner responsibilities',
  summary:
    'What property owners and managers must do under Health Code Article 11 for pests, vectors, and housing health conditions.',
  audience: [
    'A property owner responsible for a residential building',
    'A property manager handling pest prevention and violation response',
    'A building operator for an SRO or residential hotel',
  ],
  reading: 'Grade 6–7',
  editorNote:
    'Resource collection hub for property owners. Reuses existing Transaction and Information pages instead of duplicating content.',
  sections: [
    {
      heading: 'About this collection',
      karl: 'Resource collection body: Introductory text',
      kind: 'body',
      paragraphs: [
        'Property owners and managers must keep buildings free of pests, vectors, garbage, and other housing health nuisances covered by Article 11.',
        'Use these pages to meet program requirements, respond to enforcement, and prevent problems before they spread.',
      ],
    },
    {
      heading: 'Owner obligations',
      karl: 'Resource collection: Owner obligations subsection',
      kind: 'body',
      cards: [
        {
          title: 'Pay your Healthy Housing fee',
          text: 'Pay the program fee for residential buildings with 3 or more units.',
          target: 'payFee',
          karl: 'Resource collection item cross-link to existing Transaction page',
        },
        {
          title: 'Respond to a notice of violation',
          text: 'Learn what tenants and owners each need to do when HHVC issues a notice of violation.',
          target: 'noticeOfViolation',
          karl: 'Resource collection item linking to NOV Information page',
        },
        {
          title: 'Integrated pest management for property owners and managers',
          text: 'Use UC IPM templates for prevention, monitoring, and resident outreach.',
          target: 'ownerGuidance',
          karl: 'Resource collection item cross-link to existing Information page',
        },
        {
          title: 'Look up building records',
          text: 'Find complaints, violations, inspector assignment, and public records for a building.',
          target: 'recordsHub',
          karl: 'Resource collection item cross-link to records hub Resource collection page',
        },
      ],
    },
    {
      heading: 'Related pages',
      karl: 'Related section: right-panel linked pages',
      kind: 'placement',
      cards: [
        {
          title: 'Pests and housing problems',
          text: 'Return to the main Topic page for HHVC pest and housing health issues.',
          target: 'pestsTopic',
          karl: 'Related section: right-panel linked page',
        },
        {
          title: 'Look up residential health code violations',
          text: 'Search violation history for a building address.',
          target: 'findViolations',
          karl: 'Related section: right-panel linked page',
        },
        {
          title: 'What happens after you report',
          text: 'Learn how complaints are reviewed and when inspections may occur.',
          target: 'afterReport',
          karl: 'Related section: right-panel linked page',
        },
      ],
    },
  ],
  seoTitle: 'Property owner responsibilities | SF.gov',
  metaDescription:
    'Owner and manager duties for pests, vectors, and housing health under San Francisco Health Code Article 11.',
}

window.HHVC_PAGES = window.HHVC_PAGES || {}
window.HHVC_PAGES['recordsHub'] = {
  slug: 'sf.gov/look-up-building-records',
  type: 'Resource collection',
  title: 'Look up building records',
  summary:
    'Find past inspection reports, search violations, look up your assigned inspector, or request public records for a building.',
  audience: [
    'A tenant checking complaint or inspection history for a building',
    'A property owner or manager reviewing past violations or inspections',
    'A resident of an SRO, residential hotel, or shelter',
    'A neighbor or advocate researching building health records',
  ],
  reading: 'Grade 6–7',
  editorNote:
    'Resource collection hub. Groups building lookup tools and formal requests. Three child pages link to external tools on xnet.sfdph.org or citywide services.',
  sections: [
    {
      heading: 'About this collection',
      karl: 'Resource collection body: Introductory text',
      kind: 'body',
      paragraphs: [
        'Use these resources to look up Environmental Health records for a building or address.',
        'Some tools live on SF.gov. Others open on external City systems that HHVC already uses for public record searches.',
      ],
    },
    {
      heading: 'Building lookups',
      karl: 'Resource collection: Building lookups subsection',
      kind: 'body',
      cards: [
        {
          title: 'Find complaints and inspection records',
          text: 'Search by street address, complaint ID, or location ID. Shows investigated complaints and inspections from the last five years.',
          target: 'findRecords',
          karl: 'Resource collection item linking to SF.gov landing page with external xnet lookup',
        },
        {
          title: 'Look up residential health code violations',
          text: 'Search violation and inspection history for residential buildings.',
          target: 'findViolations',
          karl: 'Resource collection item linking to violation-focused external lookup page',
        },
        {
          title: 'Find residential hotel and shelter records',
          text: 'Look up inspection and program records for SROs, residential hotels, and shelters.',
          target: 'findHotelRecords',
          karl: 'Resource collection item linking to SF.gov landing page with external hotel-program lookup',
        },
        {
          title: 'Find your district inspector',
          text: 'See which HHVC inspector covers your area.',
          target: 'findInspector',
          karl: 'Resource collection item linking to internal Information page',
        },
      ],
    },
    {
      heading: 'Formal requests and payments',
      karl: 'Resource collection: Formal requests subsection',
      kind: 'body',
      cards: [
        {
          title: 'Make a public records request',
          text: 'Request copies of City records through the citywide public records service.',
          target: 'publicRecords',
          karl: 'Resource collection item linking to SF.gov landing page with external NextRequest tool',
        },
        {
          title: 'Pay your Healthy Housing fee',
          text: 'Pay the program fee for residential buildings with 3 or more units.',
          target: 'payFee',
          karl: 'Resource collection item cross-link to existing Transaction page',
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
          text: 'Return to the main Topic page for HHVC pest, vector, and housing health issues.',
          target: 'pestsTopic',
          karl: 'Related section: right-panel linked page',
        },
        {
          title: 'What happens after you report',
          text: 'Learn how reports are reviewed and when an inspector may contact you.',
          target: 'afterReport',
          karl: 'Related section: right-panel linked page',
        },
        {
          title: 'Property owner responsibilities',
          text: 'See owner obligations under Health Code Article 11.',
          target: 'ownerHub',
          karl: 'Related section: right-panel linked page',
        },
      ],
    },
  ],
  seoTitle: 'Look up building records | SF.gov',
  metaDescription:
    'Find HHVC inspection records, violations, district inspectors, and public records for San Francisco buildings.',
}

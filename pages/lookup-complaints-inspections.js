window.HHVC_PAGES = window.HHVC_PAGES || {}
window.HHVC_PAGES['findRecords'] = {
  slug: 'sf.gov/find-complaints-and-inspection-records',
  type: 'Transaction',
  title: 'Find complaints and inspection records',
  summary:
    'Search Environmental Health complaint and inspection history for a San Francisco address or location.',
  audience: [
    'A tenant checking whether a building has prior complaints or inspections',
    'A property owner or manager reviewing violation history',
    'A neighbor or advocate researching a building address',
  ],
  reading: 'Grade 7',
  whatToKnow: {
    cost: 'Free',
    thingsToKnow: [
      'Search investigated complaints and inspections by street address, complaint ID, or location ID.',
      'The lookup tool opens on an external DPH site — you will leave SF.gov.',
    ],
  },
  editorNote:
    'SF.gov landing page for an external lookup tool. Primary CTA opens xnet.sfdph.org (Residential Health Code Violations). Verify the external URL before publication.',
  sections: [
    {
      heading: 'What you can look up',
      karl: 'Body: What you can look up',
      kind: 'body',
      paragraphs: [
        'Use the Environmental Health lookup tool to search investigated complaints and inspections tied to a street address, complaint ID, or location ID.',
        'The tool shows about five years of investigated complaint and inspection activity for residential health code enforcement.',
      ],
      bullets: [
        'Street address searches',
        'Complaint ID or location ID searches',
        'Past inspections and violation history',
        'Complaint status for investigated cases',
      ],
    },
    {
      heading: 'Open the lookup tool',
      karl: 'Body: Primary CTA to external xnet lookup tool',
      kind: 'body',
      paragraphs: [
        'The search tool opens on the Department of Public Health external records site. You will leave SF.gov.',
      ],
      callout: {
        karl: 'Body note: External tool disclaimer',
        text: 'Complaint records are public records. Environmental Health generally does not share the name of a person who filed a complaint.',
      },
      button: 'Open lookup tool',
      buttonUrl: 'https://xnet.sfdph.org:8443/ords/eeop/f?p=119:1',
    },
    {
      heading: 'If you need to report a new problem',
      karl: 'Body: Pointer back to reporting flow',
      kind: 'placement',
      cards: [
        {
          title: 'Pests and housing problems',
          text: 'Report a new pest, vector, mold, or housing health problem through the main Topic page.',
          target: 'pestsTopic',
          karl: 'Related section: right-panel linked page',
        },
        {
          title: 'Report rats or mice',
          text: 'Report an active rat or mouse problem in San Francisco.',
          target: 'ratsReport',
          karl: 'Related section: right-panel linked page',
        },
        {
          title: 'What happens after you report',
          text: 'Learn how 311 reports are routed to Environmental Health.',
          target: 'afterReport',
          karl: 'Related section: right-panel linked page',
        },
      ],
    },
    {
      heading: 'Related pages',
      karl: 'Related section: right-panel linked pages',
      kind: 'placement',
      cards: [
        {
          title: 'Look up building records',
          text: 'Return to the records hub for hotel records, inspector lookup, and public records.',
          target: 'recordsHub',
          karl: 'Related section: right-panel linked page',
        },
        {
          title: 'Find residential hotel and shelter records',
          text: 'Use the separate lookup for SROs, residential hotels, and shelters.',
          target: 'findHotelRecords',
          karl: 'Related section: right-panel linked page',
        },
      ],
    },
  ],
  contactSection: {
    phone: 'Environmental Health: 415-252-3800',
    email: 'eh@sf.gov',
    karl: 'Contact section: Environmental Health (standardized footer)',
  },
  seoTitle: 'Find complaints and inspection records | SF.gov',
  metaDescription:
    'Search Environmental Health complaint and inspection records for a San Francisco building address.',
}

window.HHVC_PAGES = window.HHVC_PAGES || {}
window.HHVC_PAGES['publicRecords'] = {
  slug: 'sf.gov/make-a-public-records-request-environmental-health',
  type: 'Transaction',
  title: 'Make a public records request',
  summary:
    'Request copies of City records related to Environmental Health inspections, complaints, or enforcement.',
  audience: [
    'A tenant or advocate requesting formal copies of inspection records',
    'A property owner requesting records for a building they manage',
    'A journalist or researcher requesting public records',
  ],
  reading: 'Grade 7',
  whatToKnow: {
    thingsToKnow: [
      'Many complaint and inspection records are already available through the online lookup tools.',
      'Have the property address, complaint number, or date range ready for your request.',
    ],
  },
  editorNote:
    'SF.gov landing page for the citywide public records service (NextRequest). Primary CTA is external. Verify whether HHVC needs a program-specific intro or routes entirely to the citywide portal.',
  sections: [
    {
      heading: 'Before you request records',
      karl: 'Body: Before you request records',
      kind: 'body',
      paragraphs: [
        'Many complaint and inspection records are already available through the online lookup tools.',
        'Use a formal public records request when you need certified copies, a broader record set, or records not available in the public lookup tools.',
      ],
      bullets: [
        'Property address or complaint number',
        'Date range for the records you need',
        'A clear description of the records you are requesting',
      ],
    },
    {
      heading: 'Submit your request',
      karl: 'Body: Primary CTA to external NextRequest portal',
      kind: 'body',
      paragraphs: [
        'Public records requests are handled through the citywide San Francisco NextRequest portal. You will leave SF.gov.',
      ],
      button: 'Request records',
      buttonUrl: 'https://sanfrancisco.nextrequest.com/requests/new',
    },
    {
      heading: 'Related pages',
      karl: 'Related section: right-panel linked pages',
      kind: 'placement',
      cards: [
        {
          title: 'Find complaints and inspection records',
          text: 'Search public complaint and inspection history online before filing a formal request.',
          target: 'findRecords',
          karl: 'Related section: right-panel linked page',
        },
        {
          title: 'Look up building records',
          text: 'Return to the records hub for all lookup and request options.',
          target: 'recordsHub',
          karl: 'Related section: right-panel linked page',
        },
      ],
    },
  ],
  seoTitle: 'Make a public records request | SF.gov',
  metaDescription:
    'Request Environmental Health public records through the citywide San Francisco public records portal.',
}

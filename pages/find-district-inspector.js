window.HHVC_PAGES = window.HHVC_PAGES || {}
window.HHVC_PAGES['findInspector'] = {
  slug: 'sf.gov/find-your-district-inspector',
  type: 'Information',
  title: 'Find your district inspector',
  summary: 'See which Healthy Housing and Vector Control inspector covers your area.',
  audience: [
    'A tenant waiting for follow-up after a report',
    'A property owner or manager coordinating with Environmental Health',
    'A building worker who needs the assigned inspector contact',
  ],
  reading: 'Grade 7',
  editorNote:
    'Information page placeholder. A verified district map/staff directory lookup is still BLOCKED pending HHVC confirmation, so the page CTA routes to 311 (the confirmed public contact route) instead of shipping without any working link. Do not publish staff phone numbers until HHVC confirms the public contact route.',
  sections: [
    {
      heading: 'How inspector assignment works',
      karl: 'Body: Inspector assignment overview',
      kind: 'body',
      paragraphs: [
        'Healthy Housing and Vector Control assigns inspectors by district or service area.',
        'After 311 routes a complaint to Environmental Health, the assigned inspector may contact you if you provided contact information.',
      ],
      callout: {
        karl: 'Body note: Weekday processing expectation',
        text: 'Complaints are processed on weekdays. It can take a few days for a report to be assigned.',
      },
    },
    {
      heading: 'Find your inspector',
      karl: 'Body: Inspector lookup placeholder — CTA routes to 311 until a district lookup is confirmed',
      kind: 'body',
      paragraphs: [
        'The district inspector lookup is not published yet. Until then, wait for inspector contact after you report, or contact 311 if you need status on an open complaint.',
      ],
      bullets: [
        'Have the property address ready',
        'Use your 311 tracking number if you already filed a report',
        'Do not share another tenant’s personal information when asking for status',
      ],
      cards: [
        {
          title: 'Contact 311',
          text: 'Open the external service form.',
          url: 'https://www.sf311.org/',
          karl: 'Links: Body external resource',
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
          text: 'Return to the records hub for complaint history and violation searches.',
          target: 'recordsHub',
          karl: 'Related section: right-panel linked page',
        },
        {
          title: 'What happens after you report',
          text: 'Learn how reports move from 311 to Environmental Health.',
          target: 'afterReport',
          karl: 'Related section: right-panel linked page',
        },
        {
          title: 'Find complaints and inspection records',
          text: 'Search past complaints and inspections for a building address.',
          target: 'findRecords',
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
  seoTitle: 'Find your district inspector | SF.gov',
  metaDescription:
    'Find which Healthy Housing and Vector Control inspector covers your San Francisco area.',
}

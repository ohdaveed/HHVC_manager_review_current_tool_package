window.HHVC_PAGES = window.HHVC_PAGES || {}
window.HHVC_PAGES['findViolations'] = {
  slug: 'sf.gov/lookup-residential-health-code-violations',
  type: 'Transaction',
  title: 'Look up residential health code violations',
  summary:
    'Search violation and inspection history for residential buildings enforced under the San Francisco Health Code.',
  audience: [
    'A tenant researching prior violations at a building',
    'A property owner reviewing open or past notices of violation',
    'A housing advocate checking enforcement history for an address',
  ],
  reading: 'Grade 6–7',
  editorNote:
    'Alias-style lookup page focused on violations language. Primary CTA uses the same verified xnet Residential Health Code Violations tool as findRecords. Consider merging with findRecords if editors prefer one combined lookup page.',
  sections: [
    {
      heading: 'What you can search',
      karl: 'Body: Violation lookup scope',
      kind: 'body',
      paragraphs: [
        'Search by address or record ID to see investigated complaints, inspections, and health code violations tied to a residential property.',
        'This is the same Environmental Health lookup tool used for complaint and inspection history.',
      ],
    },
    {
      heading: 'Open the violation lookup',
      karl: 'Body: Primary CTA to external xnet violation search',
      kind: 'body',
      paragraphs: ['You will leave SF.gov to use the Department of Public Health records site.'],
      button: 'Search residential violations',
      buttonUrl: 'https://xnet.sfdph.org:8443/ords/eeop/f?p=119:1',
    },
    {
      heading: 'Related pages',
      karl: 'Related section: right-panel linked pages',
      kind: 'placement',
      cards: [
        {
          title: 'Find complaints and inspection records',
          text: 'Same lookup tool with complaint-focused wording and reporting pointers.',
          target: 'findRecords',
        },
        {
          title: 'How to respond to a notice of violation',
          text: 'Learn what tenants and property owners each need to do after HHVC issues a notice.',
          target: 'noticeOfViolation',
        },
        {
          title: 'Look up building records',
          text: 'Return to the records hub for hotel records and public records requests.',
          target: 'recordsHub',
        },
      ],
    },
  ],
  seoTitle: 'Look up residential health code violations | SF.gov',
  metaDescription:
    'Search residential health code violations and inspection history for San Francisco buildings.',
}

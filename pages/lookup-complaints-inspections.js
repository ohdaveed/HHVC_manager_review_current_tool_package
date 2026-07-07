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
  editorNote:
    'SF.gov landing page for an external lookup tool. Primary CTA opens xnet.sfdph.org (Residential Health Code Violations). Verify the external URL before publication.',
  sections: [
    {
      heading: 'What you can look up',
      karl: 'Best real-schema fit: a things_to_know entry (Title = this heading, Text = the two paragraphs plus the bulleted list below).',
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
      karl: 'what_to_do -> Section. Section title: "Open the lookup tool". Section specifics: Text block (this paragraph) + Button link block (External URL radio, target = the xnet URL) + Callout block below.',
      kind: 'body',
      paragraphs: [
        'The search tool opens on the Department of Public Health external records site. You will leave SF.gov.',
      ],
      callout: {
        karl: 'Callout block inside the "Open the lookup tool" Section specifics: single rich text field only, no separate title — this mockup callout already has none, so no mismatch.',
        text: 'Complaint records are public records. Environmental Health generally does not share the name of a person who filed a complaint.',
      },
      button: 'Open lookup tool',
      buttonUrl: 'https://xnet.sfdph.org:8443/ords/eeop/f?p=119:1',
    },
    {
      heading: 'If you need to report a new problem',
      karl: 'Maps to the same repeatable `related` field as the "Related pages" section below — Transaction\'s related panel has no observed max and no sub-heading/grouping support, so in real Karl these 3 cards and the 2 below would become one flat list without this section break. Digital Services should decide ordering if the two-heading grouping matters editorially.',
      kind: 'placement',
      cards: [
        {
          title: 'Pests and housing problems',
          target: 'pestsTopic',
          karl: 'related panel entry — page chooser only; this description text is not supported in the real schema (see section-level karl note above).',
        },
        {
          title: 'Report rats or mice',
          target: 'ratsReport',
          karl: 'related panel entry — page chooser only; this description text is not supported in the real schema (see section-level karl note above).',
        },
        {
          title: 'What happens after you report',
          target: 'afterReport',
          karl: 'related panel entry — page chooser only; this description text is not supported in the real schema (see section-level karl note above).',
        },
      ],
    },
    {
      heading: 'Related pages',
      karl: 'Maps to the related panel: repeatable field "Page *" with a "Choose a page" button. Resolved schema gap: related has no custom title/text per item.',
      kind: 'placement',
      cards: [
        {
          title: 'Look up building records',
          target: 'recordsHub',
          karl: 'related panel entry — page chooser only; this description text is not supported in the real schema (see section-level karl note above).',
        },
        {
          title: 'Find residential hotel and shelter records',
          target: 'findHotelRecords',
          karl: 'related panel entry — page chooser only; this description text is not supported in the real schema (see section-level karl note above).',
        },
      ],
    },
  ],
  seoTitle: 'Find complaints and inspection records | SF.gov',
  metaDescription:
    'Search Environmental Health complaint and inspection records for a San Francisco building address.',
}

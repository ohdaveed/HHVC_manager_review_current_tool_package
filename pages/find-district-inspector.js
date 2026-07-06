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
  reading: 'Grade 6–7',
  editorNote:
    'Information page placeholder. A verified district map/staff directory lookup is still BLOCKED pending HHVC confirmation, so the page CTA routes to 311 (the confirmed public contact route) instead of shipping without any working link. Do not publish staff phone numbers until HHVC confirms the public contact route.',
  editorStatus: 'blocked',
  sections: [
    {
      heading: 'How inspector assignment works',
      karl: 'Maps to an "Information section" → Title and text block: Title = this heading, Text = the two paragraphs below.',
      kind: 'body',
      paragraphs: [
        'Healthy Housing and Vector Control assigns inspectors by district or service area.',
        'After 311 routes a complaint to Environmental Health, the assigned inspector may contact you if you provided contact information.',
      ],
      callout: {
        karl: "Maps to its own Callout stream item (a sibling of the Title and text item above, not nested inside it — Information section's three block types are top-level stream siblings). Single rich text field only, no separate title field, which this mockup callout already lacks, so no mismatch here.",
        text: 'Complaints are processed on weekdays. It can take a few days for a report to be assigned.',
      },
    },
    {
      heading: 'Find your inspector',
      karl: 'Maps to a second Title and text block: Title = this heading, Text = the paragraph plus the bulleted list below. Real-schema gap: the verified Information form has no confirmed button/CTA block type (only Title and text/Image/Callout were observed) — this "Contact SF311 for complaint status" button has no confirmed home. Because its target is an external URL (not an internal page), the "Part of" field (restricted to Transaction pages) does not apply here; the more plausible fit is a Link-tool "External link" inside the Title and text block\'s rich text, but flag this for Digital Services rather than assuming a dedicated button block exists. Placeholder pending a confirmed district inspector lookup — see editorNote.',
      kind: 'body',
      paragraphs: [
        'The district inspector lookup is not published yet. Until then, wait for inspector contact after you report, or contact 311 if you need status on an open complaint.',
      ],
      bullets: [
        'Have the property address ready',
        'Use your 311 tracking number if you already filed a report',
        'Do not share another tenant’s personal information when asking for status',
      ],
      button: 'Contact SF311 for complaint status',
      buttonUrl: 'https://www.sf311.org/',
    },
    {
      heading: 'Related pages',
      karl: 'Maps to the Related field: a generic unrestricted "Page" chooser, repeatable. Real-schema gap: Related has no custom title/text per item, only a page reference — the descriptions on these 3 cards have no home unless Digital Services adds one.',
      kind: 'placement',
      cards: [
        {
          title: 'Look up building records',
          text: 'Return to the records hub for complaint history and violation searches.',
          target: 'recordsHub',
          karl: 'Related field entry — page chooser only; this description text is not supported in the real schema (see section-level karl note above).',
        },
        {
          title: 'What happens after you report',
          text: 'Learn how reports move from 311 to Environmental Health.',
          target: 'afterReport',
          karl: 'Related field entry — page chooser only; this description text is not supported in the real schema (see section-level karl note above).',
        },
        {
          title: 'Find complaints and inspection records',
          text: 'Search past complaints and inspections for a building address.',
          target: 'findRecords',
          karl: 'Related field entry — page chooser only; this description text is not supported in the real schema (see section-level karl note above).',
        },
      ],
    },
  ],
  seoTitle: 'Find your district inspector | SF.gov',
  metaDescription:
    'Find which Healthy Housing and Vector Control inspector covers your San Francisco area.',
}

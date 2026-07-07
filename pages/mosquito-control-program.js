window.HHVC_PAGES = window.HHVC_PAGES || {}
window.HHVC_PAGES['mosquitoControl'] = {
  slug: 'sf.gov/mosquito-control-program',
  type: 'Information',
  title: 'Mosquito Control Program',
  summary:
    'Learn about mosquito surveillance, catch-basin treatment, and how to report standing water.',
  audience: [
    'A resident reporting standing water or unusual mosquito activity',
    'A property owner or manager maintaining yards, gutters, or catch basins',
    'A building worker who can remove standing water around a property',
  ],
  reading: 'Grade 7',
  editorNote:
    'SF.gov landing page for Vector Control / Mosquito Control Program resources. Primary CTA opens SFMosquito.org. Verify phone numbers and external URLs before publication.',
  sections: [
    {
      heading: 'What the program does',
      karl: 'Maps to an "Information section" → Title and text block: Title = this heading, Text = the two paragraphs below.',
      kind: 'body',
      paragraphs: [
        'The San Francisco Mosquito Control Program is part of Healthy Housing and Vector Control. The program monitors mosquito activity, treats catch basins and standing water when appropriate, and responds to reports that may affect public health.',
        'Mosquitoes can spread diseases such as West Nile virus. Reducing standing water around homes and buildings is the most effective way to prevent breeding.',
      ],
    },
    {
      heading: 'Report mosquitoes or standing water',
      karl: 'Paragraphs and bullets map to a second Title and text block (Title = this heading, Text = the paragraph plus the bulleted list). Resolved schema gap: the verified Information form has no confirmed button/CTA block type (button converted to inline link) — folded into this block’s rich text as a Link-tool link (Internal link → the mosquitoesReport Transaction page), or via the "Part of" repeatable field (a page chooser restricted to Transaction pages) if this Information page is marked as supporting that Transaction — flag both options for Digital Services rather than assuming either.',
      kind: 'body',
      paragraphs: [
        'You can report standing water or mosquito concerns through 311 or by contacting the Mosquito Control Program directly.',
        '[Report mosquitoes through 311](mosquitoesReport)',
      ],
      bullets: [
        'Call 311 within San Francisco or (415) 701-2311 from outside the city',
        'Contact the Mosquito Control Program at 415-252-3806 for unusual mosquito activity',
      ],
    },
    {
      heading: 'More mosquito resources',
      karl: 'FLAG — unconfirmed, no clean mapping: this section has no paragraph/rich-text content of its own, only 2 external-URL cards. It doesn\'t fit "Related" (an internal-page-only chooser, no external URLs), and unlike other external-link cards on other pages there\'s no accompanying Title and text block whose rich text these could be folded into as Link-tool External links, since this section has nothing but a heading and cards. Raise this shape with Digital Services rather than assuming either a Title and text block (with no paragraph content to justify one) or a Related-field entry (wrong link type) applies.',
      kind: 'placement',
      cards: [
        {
          title: 'San Francisco Mosquito Control Program (SFMosquito.org)',
          text: 'Find program information, surveillance updates, and West Nile virus resources.',
          url: 'https://www.sfmosquito.org/',
          karl: 'External-URL card with no clean mapping in the verified Information schema — see section-level karl note above. Do not force this into "Related" (internal pages only) or invent a link block; flag for Digital Services.',
        },
        {
          title: 'West Nile virus information (California)',
          text: 'State guidance on West Nile virus risk, dead bird reporting, and prevention.',
          url: 'https://www.westnile.ca.gov/',
          karl: 'External-URL card with no clean mapping in the verified Information schema — same gap as the sibling card above; flag for Digital Services rather than forcing a "Related" or Title and text home.',
        },
      ],
    },
    {
      heading: 'Prevent mosquitoes on your property',
      karl: 'This card-only section (no paragraph content, just internal-page cards) maps most cleanly to the Related field: a generic unrestricted "Page" chooser, repeatable, that accepts any page type (Information, Transaction, or Campaign, matching this section\'s mixed targets). Resolved schema gap: Related has no custom title/text per item.',
      kind: 'placement',
      cards: [
        {
          title: 'Free mosquito education workshop',
          target: 'mosquitoWorkshop',
        },
        {
          title: 'Prevent mosquitoes',
          target: 'mosquitoesPrevent',
        },
        {
          title: 'Report a dead bird',
          target: 'wnvBirdReport',
        },
        {
          title: 'Report mosquitoes',
          target: 'mosquitoesReport',
        },
      ],
    },
  ],
  seoTitle: 'Mosquito Control Program | SF.gov',
  metaDescription:
    'San Francisco mosquito control, catch-basin treatment, and how to report standing water or mosquito activity.',
}

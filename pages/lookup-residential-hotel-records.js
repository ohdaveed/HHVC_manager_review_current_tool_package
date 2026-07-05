window.HHVC_PAGES = window.HHVC_PAGES || {}
window.HHVC_PAGES['findHotelRecords'] = {
  slug: 'sf.gov/find-residential-hotel-and-shelter-records',
  type: 'Transaction',
  title: 'Find residential hotel and shelter records',
  summary:
    'Look up inspection and program records for SROs, residential hotels, and emergency shelters.',
  audience: [
    'A resident of an SRO or residential hotel',
    'A shelter resident or advocate',
    'A property owner or operator of a residential hotel or shelter',
    'A tenant representative researching program inspection history',
  ],
  reading: 'Grade 6–7',
  editorNote:
    'SF.gov landing page for a separate external lookup from the general complaint search. SME placeholder — the button below links to the public Residential Hotel Program context page as an illustrative interim destination for mockup review; confirm the final xnet lookup entry point with HHVC before publication.',
  sections: [
    {
      heading: 'What this tool covers',
      karl: 'Body: Scope for hotel and shelter records',
      kind: 'body',
      paragraphs: [
        'Environmental Health inspects residential hotels, SROs, shelters, and related housing programs under separate datasets from the general residential complaint search.',
        'Use this page when you need records for a residential hotel, SRO, or shelter rather than a standard apartment or mixed-use building.',
      ],
      callout: {
        karl: 'Body note: Audience guidance for SRO vs. regular hotel',
        text: 'If you are staying at a regular tourist hotel, you may still use the general complaints and inspection lookup. Residential hotel and shelter records use a different program dataset.',
      },
    },
    {
      heading: 'Open the lookup tool',
      karl: 'Body: Primary CTA to external hotel-program lookup',
      kind: 'body',
      paragraphs: [
        'The lookup opens on the Department of Public Health external site. You will leave SF.gov.',
      ],
      button: 'Open residential hotel and shelter lookup',
      buttonUrl: 'https://sfdph.org/dph/EH/ResidentialHotels/default.asp',
    },
    {
      heading: 'Related pages',
      karl: 'Related section: right-panel linked pages',
      kind: 'placement',
      cards: [
        {
          title: 'Find complaints and inspection records',
          text: 'Search general residential complaint and inspection history by address.',
          target: 'findRecords',
          karl: 'Related section: right-panel linked page',
        },
        {
          title: 'Look up building records',
          text: 'Return to the records hub for all lookup options.',
          target: 'recordsHub',
          karl: 'Related section: right-panel linked page',
        },
        {
          title: 'Tenant rights when reporting housing conditions',
          text: 'Learn about tenant protections when reporting a housing condition.',
          target: 'tenantRights',
          karl: 'Related section: right-panel linked page',
        },
        {
          title: 'Report bed bugs',
          text: 'Report an active bed bug problem in rental housing, an SRO, or a residential hotel.',
          target: 'bedBugsReport',
          karl: 'Related section: right-panel linked page',
        },
      ],
    },
  ],
  seoTitle: 'Find residential hotel and shelter records | SF.gov',
  metaDescription:
    'Look up Environmental Health records for San Francisco residential hotels, SROs, and shelters.',
}

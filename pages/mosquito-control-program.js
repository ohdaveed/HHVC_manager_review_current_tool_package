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
      karl: 'Body: Mosquito Control Program overview',
      kind: 'body',
      paragraphs: [
        'The San Francisco Mosquito Control Program is part of Healthy Housing and Vector Control. The program monitors mosquito activity, treats catch basins and standing water when appropriate, and responds to reports that may affect public health.',
        'Mosquitoes can spread diseases such as West Nile virus. Reducing standing water around homes and buildings is the most effective way to prevent breeding.',
      ],
    },
    {
      heading: 'Report mosquitoes or standing water',
      karl: 'Body: Reporting routes',
      kind: 'body',
      paragraphs: [
        'You can report standing water or mosquito concerns through 311 or by contacting the Mosquito Control Program directly.',
      ],
      bullets: [
        'Call 311 within San Francisco or (415) 701-2311 from outside the city',
        'Contact the Mosquito Control Program at 415-252-3806 for unusual mosquito activity',
      ],
      cards: [
        {
          title: 'Report mosquitoes',
          text: 'Open the related HHVC service page.',
          target: 'mosquitoesReport',
          karl: 'Links: Related Transaction page',
        },
      ],
    },
    {
      heading: 'More mosquito resources',
      karl: 'Body: External vector program links',
      kind: 'placement',
      cards: [
        {
          title: 'San Francisco Mosquito Control Program (SFMosquito.org)',
          text: 'Find program information, surveillance updates, and West Nile virus resources.',
          url: 'https://www.sfmosquito.org/',
          karl: 'Body external link: SFMosquito.org program site',
        },
        {
          title: 'West Nile virus information (California)',
          text: 'State guidance on West Nile virus risk, dead bird reporting, and prevention.',
          url: 'https://www.westnile.ca.gov/',
          karl: 'Body external link: WestNile.ca.gov',
        },
      ],
    },
    {
      heading: 'Prevent mosquitoes on your property',
      karl: 'Body: Pointer to prevention Information page',
      kind: 'placement',
      cards: [
        {
          title: 'Free mosquito education workshop',
          text: 'Request a free workshop with microscopes, live larvae, and science stations for youth groups.',
          target: 'mosquitoWorkshop',
          karl: 'Related section: right-panel linked page',
        },
        {
          title: 'Prevent mosquitoes',
          text: 'Learn how to remove standing water and reduce mosquito breeding around your home.',
          target: 'mosquitoesPrevent',
          karl: 'Related section: right-panel linked page',
        },
        {
          title: 'Report a dead bird',
          text: 'Report a dead bird for West Nile virus surveillance through CDPH. HHVC may collect and test the bird.',
          target: 'wnvBirdReport',
          karl: 'Related section: right-panel linked page',
        },
        {
          title: 'Report mosquitoes',
          text: 'Report mosquitoes or standing water around a home, yard, building, or shared area.',
          target: 'mosquitoesReport',
          karl: 'Related section: right-panel linked page',
        },
      ],
    },
  ],
  contactSection: {
    phone: 'Mosquito Control Program: 415-252-3806',
    email: 'mosquito@sf.gov',
    karl: 'Contact section: Mosquito Control Program',
  },
  seoTitle: 'Mosquito Control Program | SF.gov',
  metaDescription:
    'San Francisco mosquito control, catch-basin treatment, and how to report standing water or mosquito activity.',
}

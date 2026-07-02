window.HHVC_PAGES = window.HHVC_PAGES || {}
window.HHVC_PAGES['wnvBirdReport'] = {
  slug: 'sf.gov/report-a-dead-bird',
  type: 'Transaction',
  title: 'Report a dead bird',
  summary:
    'Report a dead bird to help track West Nile virus. HHVC may collect the bird and test it for West Nile virus.',
  audience: [
    'A resident who found a dead bird on their property or near their building',
    'A property owner or manager who needs guidance on dead bird reporting',
    'A neighbor or worker who sees a dead crow, jay, raven, sparrow, finch, or hawk',
  ],
  reading: 'Grade 6–7',
  editorNote:
    'Transaction page for West Nile dead bird surveillance. Primary CTA: CDPH westnile.ca.gov (external). In Karl: set Button screenreader label to “Go to California dead bird report form.” SME BLOCKED — confirm current HHVC collection criteria, priority species list, seasonal call-center hours, and whether SF routes all reports through CDPH before publication.',
  sections: [
    {
      heading: 'Why report a dead bird',
      karl: 'Body: West Nile surveillance purpose',
      kind: 'body',
      paragraphs: [
        'Dead bird reports help track West Nile virus in California. Mosquitoes can spread West Nile virus to birds and people. Birds—especially crows, jays, magpies, ravens, sparrows, finches, and hawks—are often the first sign that the virus may be active in an area.',
        'Reporting a dead bird helps public health agencies monitor West Nile virus activity and focus mosquito control where it is needed.',
      ],
    },
    {
      heading: 'Report the bird to CDPH',
      karl: 'Body: Primary CTA to CDPH dead bird reporting',
      kind: 'body',
      paragraphs: [
        'Start your report through the California Department of Public Health (CDPH) dead bird reporting system. You will leave SF.gov.',
        'From April through October, you can also call the West Nile virus call center at 1-877-WNV-BIRD (1-877-968-2473). Online reporting is available year-round.',
      ],
      button: 'Report a dead bird to CDPH',
      buttonUrl: 'https://westnile.ca.gov/report',
    },
    {
      heading: 'Birds HHVC may collect for testing',
      karl: 'Body: HHVC collection criteria — SME verify against current CDPH/HHVC protocol before publication',
      kind: 'body',
      paragraphs: [
        'After you report through CDPH, Healthy Housing and Vector Control decides whether to collect the bird for West Nile virus testing. Not every bird is suitable.',
      ],
      bullets: [
        'Priority species often include crows, jays, magpies, ravens, and birds of prey such as hawks',
        'The bird is usually more likely to be tested if it died recently and the body is intact',
        'Birds that are heavily decomposed, damaged, buried, or unsafe to reach may not be collected',
        'Sparrows and finches may be reported for surveillance, but collection depends on program needs',
      ],
      callout: {
        karl: 'Body note: Collection criteria',
        text: 'HHVC staff or CDPH will tell you whether the bird can be picked up for testing or should be disposed of safely. Do not wait for pickup if you are told to dispose of the bird.',
      },
    },
    {
      heading: 'What HHVC does after you report',
      karl: 'Body: HHVC collection and West Nile testing',
      kind: 'body',
      paragraphs: [
        'After you file a report, Healthy Housing and Vector Control may collect the bird if it is suitable for testing.',
        'HHVC tests collected birds for West Nile virus. Test results help the Mosquito Control Program track virus activity in San Francisco and guide prevention work.',
      ],
      bullets: [
        'Note the exact location where you found the bird',
        'Estimate how long the bird has been dead if you can',
        'Keep children and pets away from the bird until pickup or disposal instructions are given',
      ],
    },
    {
      heading: 'Handle the bird safely',
      karl: 'Body: Safe handling before pickup',
      kind: 'body',
      paragraphs: [
        'You cannot get West Nile virus from touching a dead bird, but you should never touch any dead animal with bare hands.',
      ],
      bullets: [
        'Do not touch the bird with bare hands',
        'If asked to prepare the bird for pickup, use gloves and place it in a plastic bag',
        'Label the bag “Dead bird” and keep it out of direct sun until HHVC collects it',
        'If the bird will not be collected, follow CDPH disposal instructions—usually double-bagging and placing it in an outdoor garbage bin',
      ],
    },
    {
      heading: 'Related pages',
      karl: 'Related section: right-panel linked pages',
      kind: 'placement',
      cards: [
        {
          title: 'Mosquito Control Program',
          text: 'Learn about mosquito surveillance, catch-basin treatment, and West Nile virus resources.',
          target: 'mosquitoControl',
          karl: 'Related section: right-panel linked page',
        },
        {
          title: 'Prevent mosquitoes',
          text: 'Learn how to remove standing water and reduce mosquito breeding around your home.',
          target: 'mosquitoesPrevent',
          karl: 'Related section: right-panel linked page',
        },
        {
          title: 'Report mosquitoes',
          text: 'Report mosquitoes or standing water around a home, yard, building, or shared area.',
          target: 'mosquitoesReport',
          karl: 'Related section: right-panel linked page',
        },
        {
          title: 'Pigeons and housing health',
          text: 'Learn about bird-related housing health concerns separate from West Nile surveillance.',
          target: 'pigeonInfo',
          karl: 'Related section: right-panel linked page',
        },
      ],
    },
  ],
  seoTitle: 'Report a dead bird | SF.gov',
  metaDescription:
    'Report a dead bird for West Nile surveillance. HHVC may collect and test birds to track virus activity.',
}

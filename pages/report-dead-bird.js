window.HHVC_PAGES = window.HHVC_PAGES || {}
window.HHVC_PAGES['wnvBirdReport'] = {
  slug: 'sf.gov/report-a-dead-bird',
  type: 'Transaction',
  title: 'Report a dead bird',
  summary:
    'Report a dead bird to help track West Nile virus. CDPH or HHVC will decide if the bird can be collected for testing.',
  audience: [
    'A resident who found a dead bird on their property or near their building',
    'A property owner or manager who needs guidance on dead bird reporting',
    'A neighbor or worker who sees a dead crow, jay, raven, sparrow, finch, or hawk',
  ],
  reading: 'Grade 6–7',
  editorNote:
    'Transaction page for West Nile dead bird surveillance. Primary CTA: CDPH westnile.ca.gov (external). In Karl: set Button screenreader label to “Go to California dead bird report form.” SME placeholder — pickup criteria, priority species list, seasonal workflow, and CDPH routing below are illustrative example content for mockup review; confirm actual current HHVC protocol with SME before publication.',
  editorStatus: 'placeholder',
  sections: [
    {
      heading: 'Why report a dead bird',
      karl: 'Best real-schema fit: one things_to_know entry (confirmed repeatable, no max). Title: "Why report a dead bird". Text: the 2 paragraphs below (West Nile surveillance purpose, birds as early-warning indicator).',
      kind: 'body',
      paragraphs: [
        'Dead bird reports help track West Nile virus in California. Mosquitoes can spread West Nile virus to birds and people. Birds—especially crows, jays, magpies, ravens, sparrows, finches, and hawks—are often the first sign that the virus may be active in an area.',
        'Reporting a dead bird helps public health agencies monitor West Nile virus activity and focus mosquito control where it is needed.',
      ],
    },
    {
      heading: 'Report the bird to CDPH',
      karl: 'Judgment call, flagged for review: this page has no steps[] array (unlike the other report-*.js pages), but this section carries the page\'s primary action (button + buttonUrl). things_to_know/custom_section/supporting_information only offer plain title_and_text — no Button link block — so a button can only live inside what_to_do -> Section specifics. Best real-schema fit: what_to_do -> Section. Section title: "Report the bird to CDPH". Section specifics: Text block (these 2 paragraphs) + Button link block ("Report a dead bird to CDPH", Button link radio = External URL, target https://westnile.ca.gov/report, per the SF.gov page/External URL/None choice). The embedded call-center phone number (1-877-WNV-BIRD) in the second paragraph could alternatively be split out to get_help -> Phone number (Owner/Phone number/Extension/Details fields) if Digital Services wants a discrete contact block instead of inline prose — flagging as an open question, not assumed here.',
      kind: 'body',
      paragraphs: [
        'Start your report through the California Department of Public Health (CDPH) dead bird reporting system. You will leave SF.gov.',
        'You can report online year-round. From April through October, you can also call the West Nile virus call center at 1-877-WNV-BIRD (1-877-968-2473). San Francisco residents use this same statewide CDPH system — HHVC does not run a separate local intake. HHVC’s Mosquito Control Program receives the surveillance data and follows up locally when a pattern needs attention (illustrative — confirm current routing with HHVC before publication).',
      ],
      button: 'Report a dead bird to CDPH',
      buttonUrl: 'https://westnile.ca.gov/report',
    },
    {
      heading: 'Birds that may be collected for testing',
      karl: 'Best real-schema fit: a second things_to_know entry. Title: "Birds that may be collected for testing". Text: the intro paragraph + bulleted collection-criteria list below. SME verify content against current CDPH/HHVC protocol before publication.',
      kind: 'body',
      paragraphs: [
        'After you report through CDPH, public health staff decide whether the bird can be collected for West Nile virus testing. Not every bird is suitable.',
      ],
      bullets: [
        'Priority species often include crows, jays, magpies, ravens, and birds of prey such as hawks',
        'The bird is usually more likely to be tested if it died recently and the body is intact',
        'Birds that are heavily decomposed, damaged, buried, or unsafe to reach may not be collected',
        'Sparrows and finches may be reported for surveillance, but collection depends on program needs',
      ],
      callout: {
        karl: "Schema gap: things_to_know is Title + Text only — no nested callout block (same gap as report-rats-or-mice.js). Fold this pickup/disposal guidance into the entry's Text field (e.g. as a bolded closing line), or flag for Digital Services if a distinct callout is needed here. This mockup callout has no title key, so no heading-fold issue on that front.",
        text: 'CDPH, HHVC, or the local mosquito control program will tell you whether the bird can be picked up for testing or should be disposed of safely. Do not wait for pickup if you are told to dispose of the bird.',
      },
    },
    {
      heading: 'What happens after you report',
      karl: 'Best real-schema fit: a third things_to_know entry. Title: "What happens after you report". Text: the 2 paragraphs + bulleted list below (note the location, estimate time of death, keep children/pets away).',
      kind: 'body',
      paragraphs: [
        'After you file a report, the bird may be collected if it is suitable for testing and can be safely picked up.',
        'Dead bird reports and test results help the Mosquito Control Program track West Nile virus activity in San Francisco and guide prevention work.',
      ],
      bullets: [
        'Note the exact location where you found the bird',
        'Estimate how long the bird has been dead if you can',
        'Keep children and pets away from the bird until pickup or disposal instructions are given',
      ],
    },
    {
      heading: 'Handle the bird safely',
      karl: 'Best real-schema fit: a fourth things_to_know entry. Title: "Handle the bird safely". Text: the intro paragraph + bulleted safe-handling/disposal checklist below.',
      kind: 'body',
      paragraphs: [
        'You cannot get West Nile virus from touching a dead bird, but you should never touch any dead animal with bare hands.',
      ],
      bullets: [
        'Do not touch the bird with bare hands',
        'If asked to prepare the bird for pickup, use gloves and place it in a plastic bag',
        'Label the bag “Dead bird” and keep it out of direct sun until pickup',
        'If the bird will not be collected, follow CDPH disposal instructions—usually double-bagging and placing it in an outdoor garbage bin',
      ],
    },
    {
      heading: 'Related pages',
      karl: 'Maps to the related panel: repeatable field "Page *" with a "Choose a page" button. Real-schema gap: related has NO custom title/text per item, only a page reference — the descriptions on these cards have no home unless Digital Services adds one. Confirm before publishing. 4 cards below = 4 related "Page" entries.',
      kind: 'placement',
      cards: [
        {
          title: 'Mosquito Control Program',
          text: 'Learn about mosquito surveillance, catch-basin treatment, and West Nile virus resources.',
          target: 'mosquitoControl',
          karl: 'related panel entry — page chooser only; this description text is not supported in the real schema (see section-level karl note above).',
        },
        {
          title: 'Prevent mosquitoes',
          text: 'Learn how to remove standing water and reduce mosquito breeding around your home.',
          target: 'mosquitoesPrevent',
          karl: 'related panel entry — page chooser only; this description text is not supported in the real schema (see section-level karl note above).',
        },
        {
          title: 'Report mosquitoes',
          text: 'Report mosquitoes or standing water around a home, yard, building, or shared area.',
          target: 'mosquitoesReport',
          karl: 'related panel entry — page chooser only; this description text is not supported in the real schema (see section-level karl note above).',
        },
        {
          title: 'Pigeons and housing health',
          text: 'Learn about bird-related housing health concerns separate from West Nile surveillance.',
          target: 'pigeonInfo',
          karl: 'related panel entry — page chooser only; same schema gap as the other cards above (no custom description field in the real related panel).',
        },
      ],
    },
  ],
  seoTitle: 'Report a dead bird | SF.gov',
  metaDescription:
    'Report a dead bird for West Nile surveillance. CDPH or HHVC will decide if the bird can be collected.',
}

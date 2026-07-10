window.HHVC_PAGES = window.HHVC_PAGES || {}
window.HHVC_PAGES['recordsHub'] = {
  slug: 'sf.gov/look-up-building-records',
  type: 'Resource Collection',
  title: 'Look up building records',
  summary: 'Find inspection reports and violations for a building, or request public records.',
  audience: [
    'A tenant checking complaint or inspection history for a building',
    'A property owner or manager reviewing past violations or inspections',
    'A resident of an SRO, residential hotel, or shelter',
    'A neighbor or advocate researching building health records',
  ],
  reading: 'Grade 7',
  editorNote:
    'Resource collection hub. Groups building lookup tools and formal requests. Three child pages link to external tools on xnet.sfdph.org or citywide services.',
  sections: [
    {
      heading: 'About this collection',
      karl: 'Maps to the top-level "Introductory text" field (Title + rich-text Text) — a repeatable field separate from the Body stream. Heading → Title, paragraphs → Text.',
      kind: 'body',
      paragraphs: [
        'Use these resources to look up Environmental Health records for a building or address.',
        'Some tools live on SF.gov. Others open on external City systems that HHVC already uses for public record searches.',
      ],
    },
    {
      heading: 'Building lookups',
      karl: 'Maps to Body → Resources → one "Resource section" item (Title = "Building lookups"). Each card below becomes an SF.gov page block in that section\'s Links stream.',
      kind: 'body',
      cards: [
        {
          title: 'Find complaints and inspection records',
          text: 'Search by street address, complaint ID, or location ID. Shows investigated complaints and inspections from the last five years.',
          target: 'findRecords',
          karl: "SF.gov page link block, links to an existing Transaction page (an SF.gov landing page that itself CTAs out to an external xnet lookup). This block is just an unrestricted page reference — it has no custom title/text field, so this card's `text` description has no home in Karl; flag for Digital Services if the description must survive.",
        },
        {
          title: 'Look up residential health code violations',
          text: 'Search violation and inspection history for residential buildings.',
          target: 'findViolations',
          karl: "SF.gov page link block, links to another existing Transaction page (violation-focused external lookup landing page). This block is just an unrestricted page reference — it has no custom title/text field, so this card's `text` description has no home in Karl; flag for Digital Services if the description must survive.",
        },
        {
          title: 'Find residential hotel and shelter records',
          text: 'Look up inspection and program records for SROs, residential hotels, and shelters.',
          target: 'findHotelRecords',
          karl: "SF.gov page link block, links to an existing Transaction page (an SF.gov landing page that itself CTAs out to an external hotel-program lookup). This block is just an unrestricted page reference — it has no custom title/text field, so this card's `text` description has no home in Karl; flag for Digital Services if the description must survive.",
        },
      ],
    },
    {
      heading: 'Formal requests and payments',
      karl: 'Maps to a second Body → Resources → "Resource section" item (Title = "Formal requests and payments"). Each card below becomes an SF.gov page block in that section\'s Links stream.',
      kind: 'body',
      cards: [
        {
          title: 'Make a public records request',
          text: 'Request copies of City records through the citywide public records service.',
          target: 'publicRecords',
          karl: "SF.gov page link block, links to an existing Transaction page (an SF.gov landing page that itself CTAs out to the external NextRequest tool). This block is just an unrestricted page reference — it has no custom title/text field, so this card's `text` description has no home in Karl; flag for Digital Services if the description must survive.",
        },
        {
          title: 'Pay your Healthy Housing fee',
          text: 'Pay the program fee for residential buildings with 3 or more units.',
          target: 'payFee',
          karl: "SF.gov page link block, links to an existing Transaction page. This block is just an unrestricted page reference — it has no custom title/text field, so this card's `text` description has no home in Karl; flag for Digital Services if the description must survive.",
        },
      ],
    },
    {
      heading: 'Related pages',
      karl: 'Resource Collection has no dedicated Related field (confirmed live) — maps to a third Body → Resources → "Resource section" item (Title = "Related pages"), using the same SF.gov page link blocks as the two sections above rather than a separate right-panel field.',
      kind: 'placement',
      cards: [
        {
          title: 'Healthy Housing and Vector Control',
          text: 'Return to the HHVC agency page for pest, vector, and housing health issues.',
          target: 'pestsTopic',
          karl: 'SF.gov page link block within the "Related pages" Resource section (Body → Resources). No custom title/text field, so this card\'s `text` description has no home in Karl.',
        },
        {
          title: 'What happens after you report',
          text: 'Learn how reports are reviewed and when an inspector may contact you.',
          target: 'afterReport',
          karl: 'SF.gov page link block within the "Related pages" Resource section (Body → Resources). No custom title/text field, so this card\'s `text` description has no home in Karl.',
        },
        {
          title: 'Property owner responsibilities',
          text: 'See owner obligations under Health Code Article 11.',
          target: 'ownerHub',
          karl: 'SF.gov page link block within the "Related pages" Resource section (Body → Resources). No custom title/text field, so this card\'s `text` description has no home in Karl.',
        },
      ],
    },
  ],
  seoTitle: 'Look up building records | SF.gov',
  metaDescription:
    'Find HHVC inspection records, violations, and public records for San Francisco buildings.',
}

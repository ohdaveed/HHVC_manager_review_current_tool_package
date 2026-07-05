window.HHVC_PAGES = window.HHVC_PAGES || {}
window.HHVC_PAGES['ownerHub'] = {
  slug: 'sf.gov/property-owner-responsibilities-hhvc',
  type: 'Resource Collection',
  title: 'Property owner responsibilities',
  summary:
    'What property owners and managers must do under Health Code Article 11 for pests, vectors, and housing health conditions.',
  audience: [
    'A property owner responsible for a residential building',
    'A property manager handling pest prevention and violation response',
    'A building operator for an SRO or residential hotel',
  ],
  reading: 'Grade 6–7',
  editorNote:
    'Resource collection hub for property owners. Reuses existing Transaction and Information pages instead of duplicating content.',
  sections: [
    {
      heading: 'About this collection',
      karl: 'Maps to the top-level "Introductory text" field (Title + rich-text Text) — a repeatable field separate from the Body stream. Heading → Title, paragraphs → Text.',
      kind: 'body',
      paragraphs: [
        'Property owners and managers must keep buildings free of pests, vectors, garbage, and other housing health nuisances covered by Article 11.',
        'Use these pages to meet program requirements, respond to enforcement, and prevent problems before they spread.',
      ],
    },
    {
      heading: 'Owner obligations',
      karl: 'Maps to Body → Resources → one "Resource section" item (Title = "Owner obligations"). Each card below becomes an SF.gov page block in that section\'s Links stream.',
      kind: 'body',
      cards: [
        {
          title: 'Pay your Healthy Housing fee',
          text: 'Pay the program fee for residential buildings with 3 or more units.',
          target: 'payFee',
          karl: "SF.gov page link block, links to an existing Transaction page. This block is just an unrestricted page reference — it has no custom title/text field, so this card's `text` description has no home in Karl; flag for Digital Services if the description must survive.",
        },
        {
          title: 'Respond to a notice of violation',
          text: 'Learn what tenants and owners each need to do when HHVC issues a notice of violation.',
          target: 'noticeOfViolation',
          karl: "SF.gov page link block, links to an existing Information page. This block is just an unrestricted page reference — it has no custom title/text field, so this card's `text` description has no home in Karl; flag for Digital Services if the description must survive.",
        },
        {
          title: 'Integrated pest management for property owners and managers',
          text: 'Use UC IPM templates for prevention, monitoring, and resident outreach.',
          target: 'ownerGuidance',
          karl: "SF.gov page link block, links to an existing Information page. This block is just an unrestricted page reference — it has no custom title/text field, so this card's `text` description has no home in Karl; flag for Digital Services if the description must survive.",
        },
        {
          title: 'Look up building records',
          text: 'Find complaints, violations, inspector assignment, and public records for a building.',
          target: 'recordsHub',
          karl: "SF.gov page link block, links to another Resource Collection page (recordsHub). This block is just an unrestricted page reference — it has no custom title/text field, so this card's `text` description has no home in Karl; flag for Digital Services if the description must survive.",
        },
      ],
    },
    {
      heading: 'Related pages',
      karl: 'Resource Collection has no dedicated Related field (confirmed live) — maps to a second Body → Resources → "Resource section" item (Title = "Related pages"), using the same SF.gov page link blocks as the section above rather than a separate right-panel field.',
      kind: 'placement',
      cards: [
        {
          title: 'Pests and housing problems',
          text: 'Return to the main Topic page for HHVC pest and housing health issues.',
          target: 'pestsTopic',
          karl: 'SF.gov page link block within the "Related pages" Resource section (Body → Resources). No custom title/text field, so this card\'s `text` description has no home in Karl.',
        },
        {
          title: 'Look up residential health code violations',
          text: 'Search violation history for a building address.',
          target: 'findViolations',
          karl: 'SF.gov page link block within the "Related pages" Resource section (Body → Resources). No custom title/text field, so this card\'s `text` description has no home in Karl.',
        },
        {
          title: 'What happens after you report',
          text: 'Learn how complaints are reviewed and when inspections may occur.',
          target: 'afterReport',
          karl: 'SF.gov page link block within the "Related pages" Resource section (Body → Resources). No custom title/text field, so this card\'s `text` description has no home in Karl.',
        },
      ],
    },
  ],
  seoTitle: 'Property owner responsibilities | SF.gov',
  metaDescription:
    'Owner and manager duties for pests, vectors, and housing health under San Francisco Health Code Article 11.',
}

window.HHVC_PAGES = window.HHVC_PAGES || {}
window.HHVC_PAGES['ownerHub'] = {
  slug: 'sf.gov/property-owner-responsibilities-hhvc',
  type: 'Resource Collection',
  title: 'Property owner responsibilities',
  summary:
    'What owners and managers must do under Health Code Article 11 for pests and housing health.',
  audience: [
    'A property owner responsible for a residential building',
    'A property manager handling pest prevention and violation response',
    'A building operator for an SRO or residential hotel',
  ],
  reading: 'Grade 7',
  editorNote:
    'Resource collection hub for property owners. Reuses existing Transaction and Information pages instead of duplicating content.',
  sections: [
    {
      heading: 'About this collection',
      karl: 'Maps to the top-level "Introductory text" field (Title + rich-text Text) — a repeatable field separate from the Body stream. Heading → Title, paragraphs → Text.',
      kind: 'body',
      paragraphs: [
        "Property owners and managers are responsible for keeping buildings free of pests, vectors, garbage, and other housing health nuisances covered by Article 11. Under the Director's Rules and the Article 11 Interpretation Guide, owners and managers must respond quickly to pest reports, document actions, use qualified professionals when needed, keep garbage areas clean, and prevent conditions that support pests.",
        'Use these pages to meet program requirements, respond to enforcement, and prevent problems before they spread.',
      ],
    },
    {
      heading: 'Owner obligations',
      karl: 'Maps to Body → Resources → one "Resource section" item (Title = "Owner obligations"). Each card below becomes an SF.gov page block in that section\'s Links stream.',
      kind: 'body',
      cards: [
        {
          title: 'Pay your annual Healthy Housing fee for apartment buildings',
          target: 'payFee',
          karl: "SF.gov page link block, links to an existing Transaction page. This block is just an unrestricted page reference — it has no custom title/text field, so this card's `text` description has no home in Karl; flag for Digital Services if the description must survive.",
        },
        {
          title: 'Fix your Healthy Housing and Vector Control violation',
          target: 'noticeOfViolation',
          karl: "SF.gov page link block, links to an existing Information page. This block is just an unrestricted page reference — it has no custom title/text field, so this card's `text` description has no home in Karl; flag for Digital Services if the description must survive.",
        },
        {
          title: 'Integrated pest management for property owners and managers',
          target: 'ownerGuidance',
          karl: "SF.gov page link block, links to an existing Information page. This block is just an unrestricted page reference — it has no custom title/text field, so this card's `text` description has no home in Karl; flag for Digital Services if the description must survive.",
        },
        {
          title: 'Look up building records',
          target: 'recordsHub',
          karl: "SF.gov page link block, links to another Resource Collection page (recordsHub). This block is just an unrestricted page reference — it has no custom title/text field, so this card's `text` description has no home in Karl; flag for Digital Services if the description must survive.",
        },
      ],
    },
    {
      heading: 'Fee schedule',
      karl: 'Maps to Body → Documents → one "Document section" item (Title = "Fee schedule"), the block type distinct from the "Resources" (SF.gov page link) sections above — Documents is for downloadable PDF files via the Document Picker (docs/wagtail-content-mapping.md item 5), not a page reference. In the real CMS this card would be uploaded through the Document Picker rather than linked by raw URL; the external `url` here is a mockup stand-in for that upload.',
      kind: 'body',
      cards: [
        {
          title: 'SFDPH Environmental Health Branch fee schedule (current)',
          text: 'Official fee schedule, including the Healthy Housing apartment-building fee tiers and hourly reinspection rates. Rates effective 7/1/26-6/30/27 — check for a newer schedule before relying on it for a specific billing year.',
          url: 'https://media.api.sf.gov/documents/Website_Fees_FY25-26_1M8m5aT.pdf',
          karl: "Document Picker upload in the real CMS (see section-level karl note); content now sourced from docs/source/hhvc-policy/2026-07-06-dph-ehb-fee-schedule-fy26-27.md (current fiscal year). NOTE: the `url` above still points to the FY25-26 PDF's live SF.gov location — the FY26-27 PDF was obtained directly and has no confirmed public URL yet; do not publish this card until a live FY26-27 URL is confirmed.",
        },
      ],
    },
    {
      heading: 'Related pages',
      karl: 'Resource Collection has no dedicated Related field (confirmed live) — maps to a second Body → Resources → "Resource section" item (Title = "Related pages"), using the same SF.gov page link blocks as the section above rather than a separate right-panel field.',
      kind: 'placement',
      cards: [
        {
          title: 'Healthy Housing and Vector Control',
          target: 'pestsTopic',
          karl: 'SF.gov page link block within the "Related pages" Resource section (Body → Resources). No custom title/text field, so this card\'s `text` description has no home in Karl.',
        },
        {
          title: 'Look up residential health code violations',
          target: 'findViolations',
          karl: 'SF.gov page link block within the "Related pages" Resource section (Body → Resources). No custom title/text field, so this card\'s `text` description has no home in Karl.',
        },
        {
          title: 'What happens after you report a housing or pest problem',
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

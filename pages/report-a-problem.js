window.HHVC_PAGES = window.HHVC_PAGES || {}
window.HHVC_PAGES['reportHub'] = {
  slug: 'sf.gov/report-a-problem',
  type: 'Resource Collection',
  title: 'Report a problem',
  summary:
    'Choose the right page to report pests, mold, garbage, clutter, or other HHVC housing problems.',
  audience: [
    'A tenant with a pest or housing health problem',
    'A friend, family member, advocate, or helper reporting for a tenant',
    'A neighbor reporting a housing health nuisance',
    'A building worker who handles pest or housing health issues',
  ],
  reading: 'Grade 6',
  editorNote:
    'Resource collection hub for report Transaction pages. Reuses existing Transaction pages instead of duplicating content.',
  sections: [
    {
      heading: 'About this collection',
      karl: 'Maps to the top-level "Introductory text" field (Title + rich-text Text) — a repeatable field separate from the Body stream. Heading → Title, paragraphs → Text.',
      kind: 'body',
      paragraphs: [
        'Use these pages if you are affected by a pest or housing health problem that Healthy Housing and Vector Control may review under Article 11.',
        'On the next pages, you can report the specific problem you are dealing with. You can ask 311 for help in your language when you report.',
      ],
    },
    {
      heading: 'Report a housing health problem',
      component: 'resources',
      karl: 'Maps to Body → Resources → one "Resource section" item (Title = "Report a housing health problem"). Each card below becomes an SF.gov page block in that section\'s Links stream.',
      kind: 'placement',
      cards: [
        {
          title: 'Report rats or mice',
          text: 'Report rat or mouse activity in a home, building, yard, or shared area.',
          target: 'ratsReport',
          karl: "SF.gov page link block, links to an existing Transaction page. This block is just an unrestricted page reference — it has no custom title/text field, so this card's `text` description has no home in Karl; flag for Digital Services if the description must survive.",
        },
        {
          title: 'Report cockroaches',
          text: 'Report cockroaches in a unit, shared area, SRO, hotel, or workplace.',
          target: 'cockroachesReport',
          karl: "SF.gov page link block, links to an existing Transaction page. This block is just an unrestricted page reference — it has no custom title/text field, so this card's `text` description has no home in Karl; flag for Digital Services if the description must survive.",
        },
        {
          title: 'Report bed bugs',
          text: 'Report an active bed bug problem in rental housing, an SRO, or a residential hotel.',
          target: 'bedBugsReport',
          karl: "SF.gov page link block, links to an existing Transaction page. This block is just an unrestricted page reference — it has no custom title/text field, so this card's `text` description has no home in Karl; flag for Digital Services if the description must survive.",
        },
        {
          title: 'Report mosquitoes',
          text: 'Report mosquitoes or standing water around a home, yard, building, or shared area.',
          target: 'mosquitoesReport',
          karl: "SF.gov page link block, links to an existing Transaction page. This block is just an unrestricted page reference — it has no custom title/text field, so this card's `text` description has no home in Karl; flag for Digital Services if the description must survive.",
        },
        {
          title: 'Report a dead bird',
          text: 'Report a dead bird for West Nile virus surveillance. HHVC may collect and test the bird.',
          target: 'wnvBirdReport',
          karl: "SF.gov page link block, links to an existing Transaction page. This block is just an unrestricted page reference — it has no custom title/text field, so this card's `text` description has no home in Karl; flag for Digital Services if the description must survive.",
        },
        {
          title: 'Report pigeons',
          text: 'Report pigeon roosting, nesting, droppings, or feeding around a home, building, or shared area.',
          target: 'pigeonsReport',
          karl: "SF.gov page link block, links to an existing Transaction page. This block is just an unrestricted page reference — it has no custom title/text field, so this card's `text` description has no home in Karl; flag for Digital Services if the description must survive.",
        },
        {
          title: 'Report garbage or clutter',
          text: 'Report garbage, clutter, or animal waste that may attract pests or vectors.',
          target: 'garbageReport',
          karl: "SF.gov page link block, links to an existing Transaction page. This block is just an unrestricted page reference — it has no custom title/text field, so this card's `text` description has no home in Karl; flag for Digital Services if the description must survive.",
        },
        {
          title: 'Report overgrown vegetation',
          text: 'Report overgrown plants, weeds, or brush that may attract or shelter pests or vectors.',
          target: 'vegetationReport',
          karl: "SF.gov page link block, links to an existing Transaction page. This block is just an unrestricted page reference — it has no custom title/text field, so this card's `text` description has no home in Karl; flag for Digital Services if the description must survive.",
        },
        {
          title: 'Report mold from humidity or condensation',
          text: 'Report mold or moisture caused by humidity, condensation, or poor ventilation.',
          target: 'moldReport',
          karl: "SF.gov page link block, links to an existing Transaction page. This block is just an unrestricted page reference — it has no custom title/text field, so this card's `text` description has no home in Karl; flag for Digital Services if the description must survive.",
        },
      ],
    },
    {
      heading: 'Related pages',
      component: 'related',
      karl: 'Resource Collection has no dedicated Related field (confirmed live) — maps to a second Body → Resources → "Resource section" item (Title = "Related pages"), using the same SF.gov page link blocks as the section above rather than a separate right-panel field.',
      kind: 'placement',
      cards: [
        {
          title: 'Pests and housing problems',
          text: 'Return to the main Topic page for HHVC pest, vector, and housing health issues.',
          target: 'pestsTopic',
          karl: 'SF.gov page link block within the "Related pages" Resource section (Body → Resources). No custom title/text field, so this card\'s `text` description has no home in Karl.',
        },
        {
          title: 'Learn what Healthy Housing and Vector Control can inspect',
          text: 'Check if Environmental Health may review your pest or housing health problem.',
          target: 'scopeInfo',
          karl: 'SF.gov page link block within the "Related pages" Resource section (Body → Resources). No custom title/text field, so this card\'s `text` description has no home in Karl.',
        },
        {
          title: 'What happens after you report',
          text: 'Learn how reports are reviewed, assigned on weekdays, and when an inspector may contact you.',
          target: 'afterReport',
          karl: 'SF.gov page link block within the "Related pages" Resource section (Body → Resources). No custom title/text field, so this card\'s `text` description has no home in Karl.',
        },
        {
          title: 'Tenant rights when reporting housing conditions',
          text: 'Learn about tenant protections and where to get help.',
          target: 'tenantRights',
          karl: 'SF.gov page link block within the "Related pages" Resource section (Body → Resources). No custom title/text field, so this card\'s `text` description has no home in Karl.',
        },
      ],
    },
  ],
  seoTitle: 'Report a problem | SF.gov',
  metaDescription:
    'Report pests, mold, garbage, clutter, and other housing health problems to Healthy Housing and Vector Control',
}

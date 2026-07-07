window.HHVC_PAGES = window.HHVC_PAGES || {}
window.HHVC_PAGES['preventHub'] = {
  slug: 'sf.gov/prevent-problems',
  type: 'Resource Collection',
  title: 'Prevent problems',
  summary: 'Guides to help tenants, owners, and staff prevent pests and housing health problems.',
  audience: [
    'A tenant trying to prevent pests or moisture problems',
    'A property owner or manager responsible for building maintenance',
    'A building worker who handles pest or housing health issues',
    'A resident in an SRO, residential hotel, or shelter',
  ],
  reading: 'Grade 6',
  editorNote:
    'Resource collection hub for prevention Information pages. Reuses existing Information pages instead of duplicating content.',
  sections: [
    {
      heading: 'About this collection',
      karl: 'Maps to the top-level "Introductory text" field (Title + rich-text Text) — a repeatable field separate from the Body stream. Heading → Title, paragraphs → Text.',
      kind: 'body',
      paragraphs: [
        'Use these pages to stop pest, vector, and housing health problems before they spread.',
        'Prevention guidance covers sanitation, exclusion, moisture control, and resident outreach for buildings covered by Article 11.',
      ],
    },
    {
      heading: 'Prevention guides',
      component: 'resources',
      karl: 'Maps to Body → Resources → one "Resource section" item (Title = "Prevention guides"). Each card below becomes an SF.gov page block in that section\'s Links stream.',
      kind: 'placement',
      cards: [
        {
          title: 'Keep rats and mice out',
          text: 'Learn how to reduce food, water, shelter, and entry points.',
          target: 'ratsPrevent',
          karl: "SF.gov page link block, links to an existing Information page. This block is just an unrestricted page reference — it has no custom title/text field, so this card's `text` description has no home in Karl; flag for Digital Services if the description must survive.",
        },
        {
          title: 'Prevent cockroaches',
          text: 'Learn how to reduce food, water, and hiding places for cockroaches.',
          target: 'cockroachesPrevent',
          karl: "SF.gov page link block, links to an existing Information page. This block is just an unrestricted page reference — it has no custom title/text field, so this card's `text` description has no home in Karl; flag for Digital Services if the description must survive.",
        },
        {
          title: 'Prevent mosquitoes',
          text: 'Learn how to remove standing water and reduce mosquito breeding.',
          target: 'mosquitoesPrevent',
          karl: "SF.gov page link block, links to an existing Information page. This block is just an unrestricted page reference — it has no custom title/text field, so this card's `text` description has no home in Karl; flag for Digital Services if the description must survive.",
        },
        {
          title: 'Prevent overgrown vegetation',
          text: 'Learn how overgrown plants, weeds, and brush shelter pests, and how to keep vegetation trimmed.',
          target: 'vegetationInfo',
          karl: "SF.gov page link block, links to a new Information page. This block is just an unrestricted page reference — it has no custom title/text field, so this card's `text` description has no home in Karl; flag for Digital Services if the description must survive.",
        },
        {
          title: 'Prevent garbage and clutter problems',
          text: 'Learn how uncovered garbage and clutter attract pests, and how to manage waste areas safely.',
          target: 'garbageInfo',
          karl: "SF.gov page link block, links to a new Information page. This block is just an unrestricted page reference — it has no custom title/text field, so this card's `text` description has no home in Karl; flag for Digital Services if the description must survive.",
        },
        {
          title: 'Bed bug rules and prevention',
          text: 'Learn about bed bug rules, treatment preparation, and prevention.',
          target: 'bedBugsInfo',
          karl: "SF.gov page link block, links to an existing Information page. This block is just an unrestricted page reference — it has no custom title/text field, so this card's `text` description has no home in Karl; flag for Digital Services if the description must survive.",
        },
        {
          title: 'Integrated pest management for property owners and managers',
          text: 'Use prevention, monitoring, and resident outreach. UC IPM is the primary source for templates and checklists.',
          target: 'ownerGuidance',
          karl: "SF.gov page link block, links to an existing Information page. This block is just an unrestricted page reference — it has no custom title/text field, so this card's `text` description has no home in Karl; flag for Digital Services if the description must survive.",
        },
        {
          title: 'Reduce indoor moisture, condensation, and humidity',
          text: 'Learn how to reduce moisture and humidity to prevent mold growth.',
          target: 'reduceMoisture',
          karl: "SF.gov page link block, links to an existing Information page. This block is just an unrestricted page reference — it has no custom title/text field, so this card's `text` description has no home in Karl; flag for Digital Services if the description must survive.",
        },
        {
          title: 'Mosquito Control Program',
          text: 'Learn about mosquito surveillance, catch-basin treatment, and West Nile virus resources.',
          target: 'mosquitoControl',
          karl: "SF.gov page link block, links to an existing Information page. This block is just an unrestricted page reference — it has no custom title/text field, so this card's `text` description has no home in Karl; flag for Digital Services if the description must survive.",
        },
        {
          title: 'Free mosquito education workshop',
          text: 'Request a free hands-on workshop for schools, camps, museums, and science fairs.',
          target: 'mosquitoWorkshop',
          karl: "SF.gov page link block, links to an existing Information page. This block is just an unrestricted page reference — it has no custom title/text field, so this card's `text` description has no home in Karl; flag for Digital Services if the description must survive.",
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
          title: 'Report a problem',
          text: 'Choose the right page to report an active pest or housing health problem.',
          target: 'reportHub',
          karl: 'SF.gov page link block within the "Related pages" Resource section (Body → Resources). No custom title/text field, so this card\'s `text` description has no home in Karl.',
        },
        {
          title: 'Property owner responsibilities',
          text: 'See fees, violation response, and pest prevention obligations under Article 11.',
          target: 'ownerHub',
          karl: 'SF.gov page link block within the "Related pages" Resource section (Body → Resources). No custom title/text field, so this card\'s `text` description has no home in Karl.',
        },
      ],
    },
  ],
  seoTitle: 'Prevent problems | SF.gov',
  metaDescription:
    'Prevent pests, mold, and housing health problems with HHVC guidance for tenants, owners, and building staff',
}

window.HHVC_PAGES = window.HHVC_PAGES || {}
window.HHVC_PAGES['scopeInfo'] = {
  slug: 'sf.gov/information/learn-what-hhvc-can-inspect',
  type: 'Information',
  title: 'Learn what Healthy Housing and Vector Control can inspect',
  summary:
    'Check whether Environmental Health may review a pest, vector, or housing health condition.',
  audience: [
    'A tenant or tenant representative deciding whether to report a problem',
    'An employee deciding whether to report a pest or vector concern at work',
    'A person unsure whether HHVC may review a pest or housing health problem',
    'A property owner, property manager, or building staff member looking for prevention guidance or best practices',
  ],
  reading: 'Grade 6–7',
  seoTitle: 'Learn what HHVC can inspect',
  metaDescription: 'Check whether HHVC may review a pest, vector, or housing health condition.',
  sections: [
    {
      heading: 'Use this page before you report',
      karl: 'Maps to an "Information section" → Title and text block: Title = this heading, Text = the two paragraphs plus the bulleted list below (bullets render as a bulleted list inside the same rich text field).',
      kind: 'body',
      paragraphs: [
        'This page helps you understand whether Healthy Housing and Vector Control may review a pest, vector, or housing health issue.',
        'Healthy Housing and Vector Control (HHVC) is part of the Environmental Health division of the San Francisco Department of Public Health (DPH). You may see any of these names used across this site — they refer to the same program.',
      ],
      bullets: [
        'Tenants, tenant representatives, friends, family members, and employees usually use reporting pages to report active pest or vector problems.',
        'Property owners and managers may use this page to understand HHVC scope before asking for prevention guidance or best-practice assistance.',
      ],
    },
    {
      heading: 'Problems HHVC may inspect',
      karl: 'Maps to a second Title and text block: Title = this heading, Text = the bulleted list below (bullets render as a bulleted list inside the rich text field; no paragraphs precede it here).',
      kind: 'body',
      bullets: [
        'Rats or mice',
        'Cockroaches',
        'Bed bugs',
        'Mosquitoes or standing water',
        'Birds, pigeons, or bird-related nuisances tied to unsanitary conditions',
        'Mite concerns linked to rodents, birds, or other pest sources in housing',
        'Garbage, clutter, or animal waste that may attract pests',
        'Overgrown vegetation that may support pests or vectors',
        'House flies breeding in garbage or organic waste',
        'Ground wasp nests on or near residential property',
        'Mold from humidity, condensation, or poor ventilation when the affected area is about 10 square feet or more',
        'Shared SRO kitchens, bathrooms, garbage areas, or other shared spaces',
      ],
    },
    {
      heading: 'How to choose the right page',
      karl: 'Real-schema gap, doc-confirmed: the Information form has no block type for tabular content — only Title and text, Image, and Callout were confirmed in the "Information section" stream field, and Karl\'s "How a Report page works" Help Center page states "It is the only content type that supports tables," an affirmative exclusivity claim (not just silence on Information). This two-column issue-matching table has no home on this page type at all; flattening it into a bulleted list inside a Title and text block would lose the "Problem → Start here" pairing. Flag for Digital Services — the only real-schema options are reshaping this page as a Report (where the table is supported) or dropping the tabular format.',
      kind: 'body',
      table: [
        ['Problem', 'Start here'],
        ['Rats or mice', 'Report rats or mice'],
        ['Cockroaches', 'Report cockroaches'],
        ['Bed bugs', 'Report bed bugs'],
        ['Mosquitoes or standing water', 'Report mosquitoes'],
        [
          'Bird or pigeon nuisances tied to droppings or unsanitary conditions',
          'Pigeons and housing health',
        ],
        ['Mite concerns linked to pests in housing', 'Mites and housing health'],
        ['Garbage, clutter, or animal waste', 'Report garbage or clutter'],
        ['Overgrown plants or brush', 'Report overgrown vegetation'],
        ['Active pigeon roosting or feeding problems', 'Report pigeons'],
        ['House flies breeding in garbage or organic waste', 'Flies and housing health'],
        ['Ground wasp nests', 'Ground wasps and housing health'],
        ['Mold from humidity or condensation', 'Report mold from humidity or condensation'],
      ],
    },
    {
      heading: 'If your problem is not listed',
      karl: 'Maps to a third Title and text block: Title = this heading, Text = the three paragraphs below.',
      kind: 'body',
      paragraphs: [
        'Some housing problems are handled by other City programs. For example, structural water intrusion, leaks, and major heating or utility failures are routed to the Department of Building Inspection (DBI) under the San Francisco Housing Code (2025).',
        'If your problem is not on this list, you can still start with 311, which can help send your report to the right place.',
        'If you are not sure whether HHVC can review your problem, it is still okay to report it. HHVC will review whether it may involve a housing or pest-related public health concern.',
      ],
    },
    {
      heading: 'Related pages',
      karl: 'Maps to the Related field: a generic unrestricted "Page" chooser, repeatable. Real-schema gap: Related has no custom title/text per item, only a page reference — the descriptions on these 3 cards have no home unless Digital Services adds one.',
      kind: 'placement',
      cards: [
        {
          title: 'Pests and housing problems',
          text: 'Return to the Topic page for HHVC pest, vector, and housing health issues.',
          target: 'pestsTopic',
          karl: 'Related field entry — page chooser only; this description text is not supported in the real schema (see section-level karl note above).',
        },
        {
          title: 'What happens after you report',
          text: 'Learn how reports are reviewed, assigned on weekdays, and when an inspector may contact you.',
          target: 'afterReport',
          karl: 'Related field entry — page chooser only; this description text is not supported in the real schema (see section-level karl note above).',
        },
        {
          title: 'Tenant rights and reporting',
          text: "Find help if you are worried about retaliation. Reporter identities are only shared with the City Attorney's Office and are not shared in response to public records requests.",
          target: 'tenantRights',
          karl: 'Related field entry — page chooser only; this description text is not supported in the real schema (see section-level karl note above).',
        },
      ],
    },
  ],
}

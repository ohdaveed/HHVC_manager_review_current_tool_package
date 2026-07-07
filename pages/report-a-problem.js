window.HHVC_PAGES = window.HHVC_PAGES || {}
window.HHVC_PAGES['reportHub'] = {
  slug: 'sf.gov/report-a-problem',
  type: 'Resource collection',
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
      karl: 'Resource collection body: Introductory text',
      kind: 'body',
      paragraphs: [
        'Use these pages if you are affected by a pest or housing health problem that Healthy Housing and Vector Control may review under Article 11.',
        'On the next pages, you can report the specific problem you are dealing with. You can ask 311 for help in your language when you report.',
      ],
    },
    {
      heading: 'Report a housing health problem',
      karl: 'Resource collection: Report transactions subsection',
      kind: 'placement',
      cards: [
        {
          title: 'Report rats or mice',
          text: 'Report rat or mouse activity in a home, building, yard, or shared area.',
          target: 'ratsReport',
          karl: 'Resource collection item cross-link to existing Transaction page',
        },
        {
          title: 'Report cockroaches',
          text: 'Report cockroaches in a unit, shared area, SRO, hotel, or workplace.',
          target: 'cockroachesReport',
          karl: 'Resource collection item cross-link to existing Transaction page',
        },
        {
          title: 'Report bed bugs',
          text: 'Report an active bed bug problem in rental housing, an SRO, or a residential hotel.',
          target: 'bedBugsReport',
          karl: 'Resource collection item cross-link to existing Transaction page',
        },
        {
          title: 'Report mosquitoes',
          text: 'Report mosquitoes or standing water around a home, yard, building, or shared area.',
          target: 'mosquitoesReport',
          karl: 'Resource collection item cross-link to existing Transaction page',
        },
        {
          title: 'Report a dead bird',
          text: 'Report a dead bird for West Nile virus surveillance. HHVC may collect and test the bird.',
          target: 'wnvBirdReport',
          karl: 'Resource collection item cross-link to existing Transaction page',
        },
        {
          title: 'Report pigeons',
          text: 'Report pigeon roosting, nesting, droppings, or feeding around a home, building, or shared area.',
          target: 'pigeonsReport',
          karl: 'Resource collection item cross-link to existing Transaction page',
        },
        {
          title: 'Report garbage or clutter',
          text: 'Report garbage, clutter, or animal waste that may attract pests or vectors.',
          target: 'garbageReport',
          karl: 'Resource collection item cross-link to existing Transaction page',
        },
        {
          title: 'Report overgrown vegetation',
          text: 'Report overgrown plants, weeds, or brush that may attract or shelter pests or vectors.',
          target: 'vegetationReport',
          karl: 'Resource collection item cross-link to existing Transaction page',
        },
        {
          title: 'Report mold from humidity or condensation',
          text: 'Report mold or moisture caused by humidity, condensation, or poor ventilation.',
          target: 'moldReport',
          karl: 'Resource collection item cross-link to existing Transaction page',
        },
      ],
    },
    {
      heading: 'Related pages',
      karl: 'Related section: right-panel linked pages',
      kind: 'placement',
      cards: [
        {
          title: 'Pests and housing problems',
          text: 'Return to the main Topic page for HHVC pest, vector, and housing health issues.',
          target: 'pestsTopic',
          karl: 'Related section: right-panel linked page',
        },
        {
          title: 'Learn what Healthy Housing and Vector Control can inspect',
          text: 'Check if Environmental Health may review your pest or housing health problem.',
          target: 'scopeInfo',
          karl: 'Related section: right-panel linked page',
        },
        {
          title: 'What happens after you report',
          text: 'Learn how reports are reviewed, assigned on weekdays, and when an inspector may contact you.',
          target: 'afterReport',
          karl: 'Related section: right-panel linked page',
        },
        {
          title: 'Tenant rights when reporting housing conditions',
          text: 'Learn about tenant protections and where to get help.',
          target: 'tenantRights',
          karl: 'Related section: right-panel linked page',
        },
      ],
    },
  ],
  seoTitle: 'Report a problem | SF.gov',
  metaDescription:
    'Report pests, mold, garbage, clutter, and other housing health problems to Healthy Housing and Vector Control',
}

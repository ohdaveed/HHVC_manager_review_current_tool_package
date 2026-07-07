window.HHVC_PAGES = window.HHVC_PAGES || {}
window.HHVC_PAGES['vegetationInfo'] = {
  slug: 'sf.gov/information/prevent-overgrown-vegetation',
  type: 'Information',
  title: 'Prevent overgrown vegetation',
  summary:
    'Learn how overgrown plants shelter pests and how to keep vegetation trimmed near buildings.',
  audience: [
    'A tenant or resident concerned about overgrown plants, weeds, or brush',
    'A property owner or manager responsible for landscaping and grounds',
    'A building employee or maintenance worker who trims vegetation or clears yards',
  ],
  reading: 'Grade 7',
  editorNote:
    'New Information page — pairs with the existing report-overgrown-vegetation.js Transaction page. Illustrative mockup content for manager review; verify against current HHVC/DPH vegetation guidance before publication.',
  sections: [
    {
      heading: 'Why it matters',
      karl: 'Body: Why it matters — overgrown vegetation health-harm framing, placed first to motivate prevention.',
      kind: 'body',
      paragraphs: [
        'Overgrown grass, weeds, and brush give rats and other pests places to hide, nest, and move between buildings without being seen. Dense vegetation can also trap standing water after rain or irrigation, creating breeding sites for mosquitoes.',
        'Vegetation that grows against a building can hide entry points, holes, and cracks that pests use to get inside — and dry, overgrown brush close to structures adds a fire risk that can also block sight lines and safe access to exits.',
      ],
      callout: {
        karl: 'Body note: Key harm takeaway',
        text: 'Vegetation problems rarely stay contained to a yard — overgrown brush against a building often shows up later as a rodent or mosquito problem inside.',
      },
    },
    {
      heading: 'Reduce vegetation problems',
      karl: 'Body: Prevention and maintenance',
      kind: 'body',
      bullets: [
        'Clear brush, grass, and clutter at least 2 feet around building foundations.',
        'Trim tree branches and vegetation at least 4 feet away from roofs and balconies — overhanging branches can give pests a path onto a building.',
        'Remove dead plants, leaf piles, and yard debris regularly instead of letting them build up.',
        'Keep vines and dense groundcover from covering vents, foundation openings, or utility access points.',
        'Check for and empty standing water that collects in dense plantings after rain or watering.',
      ],
    },
    {
      heading: 'When someone should report',
      karl: 'Body: Reporting threshold + body link to related Transaction page',
      kind: 'body',
      paragraphs: [
        'A tenant, tenant helper, affected resident, or employee can report through 311 if the problem continues after 72 hours, affects a shared area, or the property owner or manager does not respond.',
        'Property owners and managers can use this page for prevention best practices or to prepare questions before asking for guidance.',
      ],
      cards: [
        {
          title: 'Report overgrown vegetati',
          text: 'Open the related HHVC service page.',
          target: 'vegetationReport',
          karl: 'Links: Related Transaction page',
        },
      ],
    },
    {
      heading: 'Related pages',
      karl: 'Related section: right-panel linked pages',
      kind: 'placement',
      cards: [
        {
          title: 'Report overgrown vegetation',
          text: 'Report overgrown plants, weeds, or brush that may attract or shelter pests or vectors.',
          target: 'vegetationReport',
          karl: 'Related section: right-panel linked page',
        },
        {
          title: 'Keep rats and mice out',
          text: 'Learn how to reduce food, water, shelter, and entry points that can attract rats or mice.',
          target: 'ratsPrevent',
          karl: 'Related section: right-panel linked page',
        },
        {
          title: 'Learn what HHVC can inspect',
          text: 'Check whether Environmental Health may review the issue.',
          target: 'scopeInfo',
          karl: 'Related section: right-panel linked page',
        },
      ],
    },
  ],
  seoTitle: 'Prevent overgrown vegetation | SF.gov',
  metaDescription:
    'How overgrown plants, weeds, and brush shelter pests and vectors, and how to keep vegetation trimmed and',
}

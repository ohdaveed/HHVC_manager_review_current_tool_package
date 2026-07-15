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
      karl: 'Maps to an "Information section" → Title and text block: Title = this heading, Text = the two paragraphs below. Pest-harborage and fire-risk framing (not a direct disease claim), placed first to motivate prevention.',
      kind: 'body',
      paragraphs: [
        'Overgrown grass, weeds, and brush give rats and other pests places to hide, nest, and move between buildings without being seen. Dense vegetation can also trap standing water after rain or irrigation, creating breeding sites for mosquitoes.',
        'Vegetation that grows against a building can hide entry points, holes, and cracks that pests use to get inside — and dry, overgrown brush close to structures adds a fire risk that can also block sight lines and safe access to exits.',
      ],
      callout: {
        karl: "Maps to its own Callout stream item (a sibling of the Title and text item above, not nested inside it — Information section's three block types are top-level stream siblings). Single rich text field only, no separate title field, which this mockup callout already lacks, so no mismatch here.",
        text: 'Vegetation problems rarely stay contained to a yard — overgrown brush against a building often shows up later as a rodent or mosquito problem inside.',
      },
    },
    {
      heading: 'Reduce vegetation problems',
      karl: 'Maps to a second Title and text block: Title = this heading, Text = the bulleted list below (no paragraphs on this section — Text holds only the bulleted list).',
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
      karl: 'Paragraphs map to a third Title and text block (Title = this heading, Text = the two paragraphs). Resolved schema gap: the verified Information form has no confirmed button/CTA block type (button converted to inline link) — folded into this block’s rich text as a Link-tool link (Internal link → the vegetationReport Transaction page), or via the "Part of" repeatable field (a page chooser restricted to Transaction pages) if this Information page is marked as supporting that Transaction — flag both options for Digital Services rather than assuming either.',
      kind: 'body',
      paragraphs: [
        'A tenant, tenant helper, affected resident, or employee can report through 311 if the problem continues after 72 hours, affects a shared area, or the property owner or manager does not respond.',
        '[Report overgrown vegetation](vegetationReport)',
      ],
    },
    {
      heading: 'Related pages',
      karl: 'Maps to the Related field: a generic unrestricted "Page" chooser, repeatable.',
      kind: 'placement',
      cards: [
        {
          title: 'Report overgrown vegetation',
          target: 'vegetationReport',
        },
        {
          title: 'Keep rats and mice out',
          target: 'ratsPrevent',
        },
        {
          title: 'Learn what HHVC can inspect',
          target: 'scopeInfo',
        },
      ],
    },
  ],
  seoTitle: 'Prevent overgrown vegetation | SF.gov',
  metaDescription:
    'How overgrown plants shelter pests and how to keep vegetation trimmed near buildings.',
}

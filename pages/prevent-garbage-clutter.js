window.HHVC_PAGES = window.HHVC_PAGES || {}
window.HHVC_PAGES['garbageInfo'] = {
  slug: 'sf.gov/information/prevent-garbage-and-clutter',
  type: 'Information',
  title: 'Prevent garbage and clutter problems',
  summary:
    'Learn how uncovered garbage, debris, and clutter attract pests, and how to manage waste and storage areas safely.',
  audience: [
    'A tenant or resident concerned about garbage, debris, or clutter',
    'A property owner or manager responsible for waste and storage areas',
    'A building employee or maintenance worker who services garbage areas',
  ],
  reading: 'Grade 6',
  editorNote:
    'New Information page — pairs with the existing report-garbage-clutter.js Transaction page. Illustrative mockup content for manager review; verify against current HHVC/DPH sanitation guidance before publication.',
  sections: [
    {
      heading: 'Why it matters',
      karl: 'Maps to an "Information section" → Title and text block: Title = this heading, Text = the two paragraphs below (garbage and clutter health-harm framing, placed first to motivate prevention).',
      kind: 'body',
      paragraphs: [
        'Uncovered or overflowing garbage gives rats, mice, cockroaches, and other pests an easy food source. Once pests find a reliable food supply, they multiply quickly and spread from garbage areas into nearby units and shared spaces.',
        'Heavy clutter — stacked boxes, unused furniture, or stored materials — creates hiding places that are hard to inspect or treat, and animal waste or rotting food left in shared areas can spread bacteria and attract flies as well as rodents.',
      ],
      callout: {
        karl: "Maps to its own Callout stream item (a sibling of the Title and text item above, not nested inside it — Information section's three block types are top-level stream siblings). Single rich text field only, no separate title field, which this mockup callout already lacks, so no mismatch here.",
        text: 'A single uncovered garbage can left out overnight is often enough to draw rats into a building that otherwise has no rodent problem.',
      },
    },
    {
      heading: 'Reduce garbage and clutter problems',
      karl: 'Maps to a second Title and text block: Title = this heading, Text = the bulleted list below (bullets render as a bulleted list inside the same rich text field; this section has no paragraphs, only bullets).',
      kind: 'body',
      bullets: [
        'Use rigid, lidded garbage and compost containers, and keep the lids closed at all times.',
        'Have garbage and recycling areas serviced often enough that containers do not overflow.',
        'Store boxes, furniture, and other materials off the floor and away from walls so pests cannot hide underneath or behind them.',
        'Remove cardboard, newspaper piles, and other paper clutter — pests use it for shelter and nesting material.',
        'Clean up animal waste and food spills in shared areas promptly.',
      ],
    },
    {
      heading: 'When someone should report',
      karl: 'Paragraphs map to a Title and text block (Title = this heading, Text = the two paragraphs). Resolved schema gap: the verified Information form has no confirmed button/CTA block type (button converted to inline link) — folded into this block’s rich text as a Link-tool link (Internal link → the garbageReport Transaction page), or via the "Part of" repeatable field (a page chooser restricted to Transaction pages) if this Information page is marked as supporting that Transaction — flag both options for Digital Services rather than assuming either.',
      kind: 'body',
      paragraphs: [
        'A tenant, tenant helper, affected resident, or employee can report through 311 if the problem continues after 72 hours, affects a shared area, or the property owner or manager does not respond.',
        '[Report garbage or clutter](garbageReport)',
      ],
    },
    {
      heading: 'Related pages',
      karl: 'Maps to the Related field: a generic unrestricted "Page" chooser, repeatable.',
      kind: 'placement',
      cards: [
        {
          title: 'Report garbage or clutter',
          target: 'garbageReport',
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
  seoTitle: 'Prevent garbage and clutter problems | SF.gov',
  metaDescription:
    'How uncovered garbage, debris, and clutter attract pests, and how to manage waste and storage areas safely.',
}

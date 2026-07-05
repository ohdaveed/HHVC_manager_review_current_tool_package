window.HHVC_PAGES = window.HHVC_PAGES || {}
window.HHVC_PAGES['pigeonInfo'] = {
  slug: 'sf.gov/information/pigeons-and-housing-health',
  type: 'Information',
  title: 'Pigeons and housing health',
  summary:
    'Learn how pigeon roosting and droppings can affect housing health and when Environmental Health may review the problem.',
  audience: [
    'A tenant affected by pigeon roosting, droppings, or odor',
    'A property owner or manager maintaining roofs, balconies, or courtyards',
    'A building worker cleaning shared exterior areas with bird activity',
  ],
  reading: 'Grade 6–7',
  editorNote:
    'Information page for bird-related vector and nuisance conditions. Verify HHVC scope for bird complaints vs. referrals to other agencies before publication. DPH public complaint scope includes birds as disease vectors.',
  sections: [
    {
      heading: 'Why it matters',
      karl: 'Maps to an "Information section" → Title and text block: Title = this heading, Text = the two paragraphs below. Health-harm framing, placed first to motivate prevention — verify disease-risk specifics with SFDPH vector program before publication.',
      kind: 'body',
      paragraphs: [
        'Pigeon droppings that dry out and turn to dust can carry fungal spores and bacteria. Breathing in that dust — especially in enclosed spaces like attics, vents, or storage rooms — can cause respiratory illnesses such as histoplasmosis or psittacosis.',
        'People with weakened immune systems, older adults, and young children face the highest risk of getting seriously sick from prolonged exposure to accumulated droppings and nesting material.',
      ],
      callout: {
        karl: "Maps to its own Callout stream item (a sibling of the Title and text item above, not nested inside it — Information section's three block types are top-level stream siblings). Single rich text field only, no separate title field, which this mockup callout already lacks, so no mismatch here.",
        text: 'Never dry-sweep or vacuum accumulated pigeon droppings — this can release spores into the air. Use wet cleaning methods and protective equipment, or hire a professional.',
      },
    },
    {
      heading: 'Why pigeons can be a housing health concern',
      karl: 'Maps to a second Title and text block: Title = this heading, Text = the two paragraphs below.',
      kind: 'body',
      paragraphs: [
        'Pigeons can roost on ledges, roofs, balconies, fire escapes, and other building surfaces. Accumulated droppings, feathers, and nesting material can create odor, attract insects, and contribute to unsanitary conditions in shared or exterior areas.',
        'Environmental Health may review bird-related nuisances when they contribute to a housing health problem covered by Article 11, especially when droppings or nesting material affect shared spaces, ventilation areas, or building cleanliness.',
      ],
      callout: {
        karl: 'Maps to its own Callout stream item (sibling of the Title and text item above, not nested inside it). Single rich text field, no title — this callout has no title already, so no mismatch.',
        text: 'Birds can be involved in disease vectors such as West Nile virus in the broader mosquito surveillance context. Report unusual dead bird activity through West Nile virus resources linked from the Mosquito Control Program page.',
      },
    },
    {
      heading: 'Reduce pigeon problems',
      karl: 'Maps to a third Title and text block: Title = this heading, Text = the bulleted list below (no paragraphs on this section — Text holds only the bulleted list).',
      kind: 'body',
      bullets: [
        'Remove food sources such as open garbage, spilled grain, and accessible pet food.',
        'Install bird-proofing such as netting, spikes, or blocking access to roosting ledges where appropriate and allowed.',
        'Clean droppings safely using wet methods and appropriate protective equipment — do not dry-sweep droppings.',
        'Keep courtyards, garbage areas, and roof drains clear of nesting material and waste buildup.',
        'Repair screens, vents, and openings that allow birds or pests into building cavities.',
      ],
    },
    {
      heading: 'When to report',
      karl: 'Paragraph maps to a fourth Title and text block (Title = this heading, Text = the paragraph). Unresolved schema gap: the 4 linked cards embedded in this section have no confirmed home — the verified Information schema only exposes page links via the page-level Related field (unrestricted "Page" chooser, repeatable, no per-item title/text, and it lives once, typically at the end of the page, rather than inline mid-section). There is no observed block type for an inline linked-card list within a body section. Flag for Digital Services: options might include moving these links into the Related field (losing the per-item description) or embedding them as Link-tool links inside this block\'s rich text (losing the card visual treatment) — neither is confirmed.',
      kind: 'body',
      paragraphs: [
        'Report through 311 when pigeon activity is tied to ongoing unsanitary conditions, accumulated waste, or other housing-health nuisances HHVC may review.',
      ],
      cards: [
        {
          title: 'Report pigeons',
          text: 'Report pigeon roosting, nesting, droppings, or feeding around a building or shared area.',
          target: 'pigeonsReport',
          karl: 'Embedded inline link card — no confirmed block type in the Information schema for a card with title/text/target at this position (see section-level karl note above); closest analog is the page-level Related field, which does not support per-item title/text or mid-page placement.',
        },
        {
          title: 'Report garbage or clutter',
          text: 'Report unsanitary exterior conditions that may involve bird droppings or nesting material.',
          target: 'garbageReport',
          karl: 'Embedded inline link card — no confirmed block type in the Information schema for a card with title/text/target at this position (see section-level karl note above); closest analog is the page-level Related field, which does not support per-item title/text or mid-page placement.',
        },
        {
          title: 'Mosquito Control Program',
          text: 'Find West Nile virus resources and dead bird reporting information.',
          target: 'mosquitoControl',
          karl: 'Embedded inline link card — no confirmed block type in the Information schema for a card with title/text/target at this position (see section-level karl note above); closest analog is the page-level Related field, which does not support per-item title/text or mid-page placement.',
        },
        {
          title: 'Report a dead bird',
          text: 'Help track West Nile virus. HHVC may collect the bird and test it.',
          target: 'wnvBirdReport',
          karl: 'Embedded inline link card — no confirmed block type in the Information schema for a card with title/text/target at this position (see section-level karl note above); closest analog is the page-level Related field, which does not support per-item title/text or mid-page placement.',
        },
      ],
    },
    {
      heading: 'Related pages',
      karl: 'Maps to the Related field: a generic unrestricted "Page" chooser, repeatable. Real-schema gap: Related has no custom title/text per item, only a page reference — the descriptions on these 2 cards have no home unless Digital Services adds one.',
      kind: 'placement',
      cards: [
        {
          title: 'Prevent mosquitoes',
          text: 'Learn about standing water, West Nile virus precautions, and mosquito reporting.',
          target: 'mosquitoesPrevent',
          karl: 'Related field entry — page chooser only; this description text is not supported in the real schema (see section-level karl note above).',
        },
        {
          title: 'Learn what HHVC can inspect',
          text: 'Check whether Environmental Health may review the issue.',
          target: 'scopeInfo',
          karl: 'Related field entry — page chooser only; this description text is not supported in the real schema (see section-level karl note above).',
        },
      ],
    },
  ],
  seoTitle: 'Pigeons and housing health | SF.gov',
  metaDescription:
    'How pigeon roosting and droppings affect housing health and when to report the problem to Environmental Health.',
}

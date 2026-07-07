window.HHVC_PAGES = window.HHVC_PAGES || {}
window.HHVC_PAGES['pigeonInfo'] = {
  slug: 'sf.gov/information/pigeons-and-housing-health',
  type: 'Information',
  title: 'Pigeons and housing health',
  summary:
    'Learn how pigeon roosting and droppings affect housing health and when to report to HHVC.',
  audience: [
    'A tenant affected by pigeon roosting, droppings, or odor',
    'A property owner or manager maintaining roofs, balconies, or courtyards',
    'A building worker cleaning shared exterior areas with bird activity',
  ],
  reading: 'Grade 7',
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
      karl: "Maps to a second Title and text block: Title = this heading, Text = the two paragraphs below (second paragraph now ends with the Health Code Article 11 property-owner-obligation summary required by HHVC content standards Ch. 8.7.1). New: a secondary Button link block ('View Health Code Article 11') citing the municipal code per Ch. 8.7.2 — flag for Digital Services to confirm this is the SF.gov-preferred municode URL before publication.",
      kind: 'body',
      paragraphs: [
        'Pigeons can roost on ledges, roofs, balconies, fire escapes, and other building surfaces. Accumulated droppings, feathers, and nesting material can create odor, attract insects, and contribute to unsanitary conditions in shared or exterior areas.',
        'Environmental Health may review bird-related nuisances when they contribute to a housing health problem covered by Article 11, especially when droppings or nesting material affect shared spaces, ventilation areas, or building cleanliness. Under San Francisco Health Code Article 11, property owners are legally required to keep their buildings clean, watertight, and completely free of rodent and insect infestations.',
      ],
      callout: {
        karl: 'Maps to its own Callout stream item (sibling of the Title and text item above, not nested inside it). Single rich text field, no title — this callout has no title already, so no mismatch.',
        text: 'Birds can be involved in disease vectors such as West Nile virus in the broader mosquito surveillance context. Report unusual dead bird activity through West Nile virus resources linked from the Mosquito Control Program page.',
      },
      button: 'View Health Code Article 11',
      buttonUrl: 'https://codelibrary.amlegal.com/codes/san_francisco/latest/sf_health/0-0-0-1890',
      buttonStyle: 'secondary',
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
      karl: 'Paragraph maps to a fourth Title and text block (Title = this heading, Text = the paragraph). Resolved schema gap: converted inline linked cards to paragraph links.',
      kind: 'body',
      paragraphs: [
        'Report through 311 when pigeon activity is tied to ongoing unsanitary conditions, accumulated waste, or other housing-health nuisances HHVC may review.',
      ],
      bullets: [
        '[Report pigeons](pigeonsReport)',
        '[Report garbage or clutter](garbageReport)',
        '[Mosquito Control Program](mosquitoControl)',
        '[Report a dead bird](deadBirdReport)',
      ],
    },
    {
      heading: 'Related pages',
      karl: 'Maps to the Related field: a generic unrestricted "Page" chooser, repeatable.',
      kind: 'placement',
      cards: [
        {
          title: 'Prevent mosquitoes',
          target: 'mosquitoesPrevent',
        },
        {
          title: 'Learn what HHVC can inspect',
          target: 'scopeInfo',
        },
      ],
    },
  ],
  seoTitle: 'Pigeons and housing health | SF.gov',
  metaDescription:
    'How pigeon roosting and droppings affect housing health and when to report the problem to SFDPH.',
}

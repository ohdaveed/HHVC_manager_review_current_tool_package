window.HHVC_PAGES = window.HHVC_PAGES || {}
window.HHVC_PAGES['cockroachesPrevent'] = {
  slug: 'sf.gov/information/prevent-cockroaches',
  type: 'Information',
  title: 'Prevent cockroaches',
  summary: 'Learn how to reduce food, water, and shelter that can attract cockroaches.',
  audience: [
    'A tenant or resident trying to reduce cockroach activity',
    'A property owner or manager looking for best practices',
    'A building employee or maintenance worker supporting pest prevention',
  ],
  reading: 'Grade 7',
  topicTag: 'Topic: Pests and housing problems',
  contact: {
    phone: ['311 (call or text)'],
    email: ['ehb@sfdph.org'],
    other: ['Environmental Health — Healthy Housing and Vector Control'],
  },
  editorNote:
    'Information page. New "Why it matters" health-harm section added — verify asthma/allergen and bacteria-transfer claims against current CDC/SFDPH guidance before publication.',
  sections: [
    {
      heading: 'Why it matters',
      karl: 'Maps to an "Information section" → Title and text block: Title = this heading, Text = the two paragraphs below. Health-harm framing, placed first to motivate prevention — verify disease-risk specifics with SFDPH vector program before publication.',
      kind: 'body',
      paragraphs: [
        'Cockroach droppings, shed skin, and saliva contain allergens that can trigger or worsen asthma and allergic reactions — this risk is especially serious for children in homes with heavy infestations.',
        'Cockroaches can also pick up bacteria such as salmonella and E. coli while moving through drains, garbage, and food waste, then spread it onto kitchen counters and stored food.',
      ],
      callout: {
        karl: "Maps to its own Callout stream item (a sibling of the Title and text item above, not nested inside it — Information section's three block types are top-level stream siblings). Single rich text field only, no separate title field, which this mockup callout already lacks, so no mismatch here.",
        text: 'Homes with ongoing cockroach activity often see an increase in asthma symptoms among children — reducing food, water, and shelter sources helps protect respiratory health, not just cleanliness.',
      },
    },
    {
      heading: 'Know the signs of cockroaches',
      karl: 'Maps to a second Title and text block: Title = this heading, Text = the paragraph plus the bulleted list below (bullets render as a bulleted list inside the same rich text field). Added for depth — helps residents confirm a problem early.',
      kind: 'body',
      paragraphs: [
        'Finding cockroaches early makes them easier to control. Look for these common signs.',
      ],
      bullets: [
        'Droppings that look like ground pepper, coffee grounds, or small dark smears.',
        'A musty or oily smell in areas with heavy activity.',
        'Egg cases, which are small brown capsules, near cracks and hidden corners.',
        'Seeing cockroaches during the day, which can mean a large infestation.',
      ],
    },
    {
      heading: 'Starve them of food and water',
      karl: 'Maps to a third Title and text block: Title = this heading, Text = the paragraph plus the bulleted list below.',
      kind: 'body',
      paragraphs: [
        'Cockroaches need food, water, and shelter to survive. Removing their food and moisture is the most effective way to prevent cockroaches from nesting in your home.',
      ],
      bullets: [
        'Clean grease and crumbs daily from countertops, stoves, sinks, and under kitchen appliances.',
        'Store all food in sealed plastic, glass, or metal containers.',
        'Keep kitchen sinks dry and fix any plumbing leaks immediately. For structural plumbing leaks, the issue should be routed to the Department of Building Inspection (DBI) under the San Francisco Housing Code (2025). Cockroaches need daily access to water.',
        'Keep trash bins clean and covered, and empty garbage containers every night.',
        'Do not leave pet food or water bowls out overnight.',
      ],
    },
    {
      heading: 'Eliminate cockroach hiding spots',
      karl: 'Maps to a fourth Title and text block: Title = this heading, Text = the paragraph plus the bulleted list below.',
      kind: 'body',
      paragraphs: [
        'Cockroaches hide in dark, tight spaces during the day. Reducing clutter and sealing openings prevents them from establishing nests.',
      ],
      bullets: [
        'Seal gaps and cracks in cabinets, baseboards, walls, and where pipes or conduits enter walls.',
        'Remove cardboard boxes, paper bags, and piles of newspapers. Cockroaches feed on glue and use paper for shelter and breeding.',
        'Keep storage areas clean, organized, and elevated off the floor.',
      ],
    },
    {
      heading: 'Use safe treatment methods',
      karl: 'Maps to a fifth Title and text block: Title = this heading, Text = the two paragraphs plus the bulleted list below.',
      kind: 'body',
      paragraphs: [
        'Prioritize non-chemical or low-toxic treatments. Standard chemical sprays often scatter cockroaches to other units instead of eliminating them.',
        'Gel baits are generally safer than sprays if chemicals must be used.',
      ],
      bullets: [
        'Use sticky traps (glue traps) to monitor cockroach activity and identify high-activity areas.',
        'Use cockroach gel baits or bait stations. Baits are highly targeted and safer than aerosol sprays, especially around children and pets.',
        'Avoid using chemical bug bombs or aerosol sprays, which can spread pesticides into living spaces and irritate breathing.',
      ],
    },
    {
      heading: 'When someone should report',
      karl: 'Paragraphs map to a sixth Title and text block (Title = this heading, Text = the two paragraphs). Resolved schema gap: the verified Information form has no confirmed button/CTA block type (button converted to inline link) — folded into this block’s rich text as a Link-tool link (Internal link → the cockroachesReport Transaction page), or via the "Part of" repeatable field (a page chooser restricted to Transaction pages) if this Information page is marked as supporting that Transaction — flag both options for Digital Services rather than assuming either.',
      kind: 'body',
      paragraphs: [
        'A tenant, tenant helper, affected resident, or employee can report through 311 if the problem continues after 72 hours, affects a shared area, or the property owner or manager does not respond.',
        '[Report cockroaches](cockroachesReport)',
      ],
    },
    {
      heading: 'Related pages',
      component: 'related',
      karl: 'Maps to the Related field: a generic unrestricted "Page" chooser, repeatable.',
      kind: 'placement',
      cards: [
        {
          title: 'Learn what HHVC can inspect',
          target: 'scopeInfo',
        },
        {
          title: 'What happens after you report',
          target: 'afterReport',
        },
      ],
    },
  ],
}

window.HHVC_PAGES = window.HHVC_PAGES || {}
window.HHVC_PAGES['ownerGuidance'] = {
  slug: 'sf.gov/information/integrated-pest-management-for-property-owners-and-managers',
  type: 'Information',
  title: 'Integrated pest management for property owners and managers',
  summary:
    'Use prevention, monitoring, and resident outreach to reduce pests in buildings. UC IPM is the primary source for templates and checklists.',
  audience: [
    'A property owner responsible for a residential building',
    'A property manager or building operator',
    'Building maintenance staff or janitorial staff',
    'A housing provider looking for pest prevention best practices',
  ],
  reading: 'Grade 6–7',
  editorNote:
    'Information page for property owners and managers. UC ANR IPM guide is the primary external source — verify link stability and whether HHVC wants additional SFDPH Director’s Rules citations before publication.',
  sections: [
    {
      heading: 'Why it matters',
      karl: 'Maps to an "Information section" → Title and text block: Title = this heading, Text = the two paragraphs below (cross-vector health-harm framing for owners/managers, placed first to motivate prevention). Verify disease-risk specifics with SFDPH vector program before publication.',
      kind: 'body',
      paragraphs: [
        "Unmanaged pests don't just damage a building — they put residents' health at risk. Rodents can spread Hantavirus and Leptospirosis, cockroach allergens can trigger asthma, bed bug and mite bites cause skin irritation and stress, and bird droppings can carry fungal spores that affect breathing.",
        "These risks tend to compound the longer they go unaddressed — a small rodent problem can turn into a mite outbreak, and untreated moisture or clutter can support multiple pests at once. Prevention protects both residents' health and the owner's ability to meet Article 11 requirements.",
      ],
      callout: {
        karl: "Maps to its own Callout stream item (a sibling of the Title and text item above, not nested inside it — Information section's three block types are top-level stream siblings). Single rich text field only, no separate title field, which this mockup callout already lacks, so no mismatch here.",
        text: 'The residents most at risk from unmanaged pests are often children, older adults, and people with existing health conditions or weakened immune systems.',
      },
    },
    {
      heading: 'Use IPM to prevent pests',
      karl: 'Maps to a second Title and text block: Title = this heading, Text = the two paragraphs plus the bulleted list below (bullets render as a bulleted list inside the same rich text field).',
      kind: 'body',
      paragraphs: [
        'Property owners, managers, and building operators must keep buildings free of vermin under San Francisco health and housing rules.',
        'Integrated Pest Management (IPM) is a prevention-first approach. It uses inspection, maintenance, sanitation, exclusion, monitoring, and targeted treatment to reduce pests and limit heavy pesticide use under Article 11 of the San Francisco Health Code.',
      ],
      bullets: [
        'Prevent pests before infestations spread',
        'Fix building conditions that attract or shelter pests',
        'Use records and monitoring to find repeated problems',
        'Share clear instructions with residents and staff',
      ],
    },
    {
      heading: 'Primary source: UC IPM guide for property managers',
      karl: 'Maps to a third Title and text block: Title = this heading, Text = the two paragraphs below.',
      kind: 'placement',
      paragraphs: [
        'The University of California Statewide IPM Program (UC IPM) publishes the main reference guide used on this page. Use it for policies, checklists, monitoring forms, and resident handouts.',
        'HHVC recommends UC IPM as a practical source for property owners and managers operating multi-unit housing in San Francisco.',
      ],
      cards: [
        {
          title: 'UC IPM: Guide for property managers',
          text: 'Start here for the full UC ANR integrated pest management guide for multi-unit housing, including policies, prevention, monitoring, and resident outreach.',
          url: 'https://ipm.ucanr.edu/home-and-landscape/guide-for-property-managers/',
          karl: 'This card links to an external URL, not an internal page — it does not fit the verified "Related" field (an unrestricted but internal-only Page chooser; no external-URL support observed). No block type in the verified Information schema holds a card-style external link with its own title/description. Best option: fold this in as a Link-tool External link within this block\'s own Title and text rich text — flag for Digital Services rather than assuming a dedicated field.',
        },
      ],
      callout: {
        karl: 'Maps to its own Callout stream item (a second Callout sibling, alongside the "Why it matters" Callout above — not nested inside any Title and text block). Single rich text field, no title field; this callout has none, so no mismatch.',
        text: 'Sections below summarize HHVC expectations and point to specific UC IPM chapters. When details differ, follow San Francisco Health Code requirements and SFDPH Director’s Rules.',
      },
    },
    {
      heading: 'Common building conditions that attract pests',
      karl: 'Maps to a fourth Title and text block: Title = this heading, Text = the paragraph plus the bulleted list below. Frames the prevention steps that follow.',
      kind: 'body',
      paragraphs: [
        'Most pest problems in buildings start with a few common conditions. Fixing them early prevents infestations.',
      ],
      bullets: [
        'Unsealed gaps, cracks, and utility openings that let pests enter',
        'Overflowing, uncovered, or poorly serviced garbage areas',
        'Standing water, leaks, and damp spaces',
        'Clutter, cardboard storage, and unused materials that offer shelter',
        'Overgrown landscaping and debris close to walls and foundations',
      ],
    },
    {
      heading: '1. Follow San Francisco owner responsibilities',
      karl: "Maps to a fifth Title and text block: Title = this heading, Text = the paragraph plus the bulleted list below (SFDPH Director's Rules and Regulations requirements).",
      kind: 'body',
      paragraphs: [
        "The San Francisco Department of Public Health (SFDPH) Director's Rules and Regulations set specific legal requirements for rental property owners and managers to prevent and control rodents and other vectors.",
      ],
      bullets: [
        'Investigate reports: Investigate any tenant reports of pest activity within 72 hours.',
        'Recordkeeping: Keep accurate records of pest complaints, inspections, and pest control services for at least 2 years. Make these records available to DPH on request.',
        'Hire licensed professionals: Hire only licensed Pest Control Operators (PCOs) to apply pesticides or conduct rat trapping.',
        'Garbage management: Provide enough rigid plastic or metal containers with tight-fitting lids. Ensure the garbage area is clean and serviced regularly to prevent overflow.',
        'Staff training: Train building staff on pest recognition, sanitation, exclusion, and safe disposal of infested items.',
      ],
      cards: [
        {
          title: 'Property owner responsibilities',
          text: 'See fees, violation response, and other Article 11 obligations on SF.gov.',
          target: 'ownerHub',
          karl: 'This card links to an internal page inline, mid-body — not in the final Related section. Two unconfirmed options for Digital Services: fold it in as an internal Link-tool link within this block\'s own Title and text rich text (preserves its inline placement), or move it to the page-level "Related" field (an unrestricted page chooser) — but Related has no custom title/text per item, so this card\'s description would have no home there either way.',
        },
      ],
    },
    {
      heading: '2. Set policies, plans, and lease expectations',
      karl: 'Maps to a sixth Title and text block: Title = this heading, Text = the paragraph plus the bulleted list below.',
      kind: 'placement',
      paragraphs: [
        'Put pest prevention expectations in building policies, written plans, staff procedures, and lease materials. Clear expectations help residents, managers, maintenance staff, and pest control contractors respond consistently.',
      ],
      bullets: [
        'Set a clear way for residents to report pest activity',
        'Explain how residents should prepare for inspections or treatment',
        'Define staff roles for sanitation, repairs, monitoring, and follow-up',
        'Keep pest prevention language consistent across leases, notices, and house rules',
      ],
      cards: [
        {
          title: 'UC IPM: Policies, plans, and templates',
          text: 'Use UC ANR policy, IPM plan, and pest-related lease language resources.',
          url: 'https://ipm.ucanr.edu/home-and-landscape/guide-for-property-managers/policies-plans-and-templates/',
          karl: 'External-URL card — same real-schema gap as the UC IPM card above: doesn\'t fit the internal-only "Related" field; best option is folding this in as a Link-tool External link within this block\'s Title and text rich text, flagged for Digital Services.',
        },
      ],
    },
    {
      heading: '3. Prevent pests and seal entry points',
      karl: 'Maps to a seventh Title and text block: Title = this heading, Text = the paragraph plus the bulleted list below.',
      kind: 'placement',
      paragraphs: [
        'Prevent pest problems by fixing the conditions that let pests enter, hide, feed, or breed. Maintenance, landscape management, and sanitation are core parts of IPM.',
      ],
      bullets: [
        'Seal gaps larger than 1/4 inch around doors, windows, pipes, vents, and utility openings with rodent-proof materials. Examples include hardware cloth, copper mesh, sheet metal, concrete, mortar, or steel wool backed by sealant.',
        'Maintain tree and shrub branches at least 3 feet away from walls or roofs to prevent rodents from climbing onto structures.',
        'Keep a 24-inch clear space along fences and exterior walls to reduce rodent movement and allow visibility.',
        'Apply gravel around foundations to prevent burrowing, and stack wood piles or lumber at least 6 inches off the ground.',
        'Build pest-proofing into repair, remodeling, and construction work.',
      ],
      cards: [
        {
          title: 'UC IPM: Pest prevention',
          text: 'Use UC ANR prevention tips and pest prevention checklists for multi-unit housing.',
          url: 'https://ipm.ucanr.edu/home-and-landscape/guide-for-property-managers/pest-prevention/',
          karl: "External-URL card — same real-schema gap: no dedicated block for a card-style external link; fold in as a Link-tool External link within this block's Title and text rich text, flagged for Digital Services.",
        },
        {
          title: 'SF Environment: Pest Prevention by Design',
          text: 'Use SF Environment guidance for pest-proofing design, construction, and renovation work.',
          url: 'https://sfenvironment.org/download/pest-prevention-by-design-guidelines',
          karl: "External-URL card — same real-schema gap as the sibling card above; fold in as a Link-tool External link within this block's Title and text rich text, flagged for Digital Services.",
        },
      ],
    },
    {
      heading: '4. Track pest activity and coordinate treatments',
      karl: 'Maps to an eighth Title and text block: Title = this heading, Text = the paragraph plus the bulleted list below.',
      kind: 'placement',
      paragraphs: [
        'Track pest activity so you can see patterns and respond before problems spread. Coordinated pest control services are required to handle infestations effectively.',
      ],
      bullets: [
        'Use one system to log complaints, repairs, sanitation work, and contractor visits.',
        'Ensure the PCO conducts a complete inspection and identifies the type and level of infestation.',
        'Inspect adjacent units: When an infestation is reported, the PCO must inspect all adjacent units (and treat them if necessary).',
        'Use least-toxic methods: Prioritize non-chemical methods (vacuuming, heat, steam, freezing) and gel baits over chemical sprays.',
        'Review records regularly to find repeated or building-wide problems.',
      ],
      cards: [
        {
          title: 'UC IPM: Pest monitoring and recordkeeping',
          text: 'Use UC ANR monitoring guidance, sample logs, reports, and recordkeeping tools.',
          url: 'https://ipm.ucanr.edu/home-and-landscape/guide-for-property-managers/pest-monitoring-and-recordkeeping/',
          karl: "External-URL card — same real-schema gap as prior external-link cards on this page; fold in as a Link-tool External link within this block's Title and text rich text, flagged for Digital Services.",
        },
      ],
    },
    {
      heading: '5. Share clear instructions and support residents',
      karl: 'Maps to a ninth Title and text block: Title = this heading, Text = the paragraph plus the bulleted list below.',
      kind: 'placement',
      paragraphs: [
        'Tenant cooperation is important, but pest prevention cannot depend on tenants alone. Give residents clear instructions, advance notification, and help those who need it.',
      ],
      bullets: [
        'Explain how residents should report pest activity in writing.',
        'Give proper written notice before pesticide treatments, following state laws.',
        'Provide assistance to tenants who cannot safely prepare their unit for treatment due to a disability or medical need by contacting support services.',
        'Use translated materials to share simple food storage, garbage, and clutter prevention steps.',
      ],
      cards: [
        {
          title: 'UC IPM: Outreach to residents',
          text: 'Find UC ANR resident handouts, notices, and pest information resources, including materials in multiple languages.',
          url: 'https://ipm.ucanr.edu/home-and-landscape/guide-for-property-managers/outreach-to-residents/',
          karl: "External-URL card — same real-schema gap as prior external-link cards on this page; fold in as a Link-tool External link within this block's Title and text rich text, flagged for Digital Services.",
        },
      ],
    },
    {
      heading: 'Related pages',
      karl: 'Maps to the Related field: a generic unrestricted "Page" chooser, repeatable. Real-schema gap: Related has no custom title/text per item, only a page reference — the descriptions on these 5 cards have no home unless Digital Services adds one.',
      kind: 'placement',
      cards: [
        {
          title: 'Property owner responsibilities',
          text: 'See fees, violation response, and prevention obligations under Article 11.',
          target: 'ownerHub',
          karl: 'Related field entry — page chooser only; this description text is not supported in the real schema (see section-level karl note above).',
        },
        {
          title: 'How to respond to a notice of violation',
          text: 'Learn what owners and tenants each need to do when HHVC issues corrective actions.',
          target: 'noticeOfViolation',
          karl: 'Related field entry — page chooser only; this description text is not supported in the real schema (see section-level karl note above).',
        },
        {
          title: 'Keep rats and mice out of your home',
          text: 'Learn how to reduce food, water, shelter, and entry points that can attract rats or mice.',
          target: 'ratsPrevent',
          karl: 'Related field entry — page chooser only; this description text is not supported in the real schema (see section-level karl note above).',
        },
        {
          title: 'Mites and housing health',
          text: 'Learn why rat nests should be treated for mites before using rodenticides.',
          target: 'miteInfo',
          karl: 'Related field entry — page chooser only; this description text is not supported in the real schema (see section-level karl note above).',
        },
        {
          title: 'Learn what HHVC can inspect',
          text: 'Check when Environmental Health may review a housing or pest condition.',
          target: 'scopeInfo',
          karl: 'Related field entry — page chooser only; this description text is not supported in the real schema (see section-level karl note above).',
        },
      ],
    },
  ],
  seoTitle: 'IPM for property owners and managers | SF.gov',
  metaDescription:
    'IPM for SF property owners and managers. UC ANR templates for prevention, monitoring, and resident outreach.',
}

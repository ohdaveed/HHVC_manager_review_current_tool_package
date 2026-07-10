window.HHVC_PAGES = window.HHVC_PAGES || {}
window.HHVC_PAGES['tenantRights'] = {
  slug: 'sf.gov/information/tenant-rights-and-reporting-housing-conditions',
  type: 'Information',
  title: 'Tenant rights when reporting housing conditions',
  summary:
    'Learn about tenant protections and where to get help if you are worried about retaliation.',
  audience: [
    'A tenant worried about reporting a housing, pest, or vector problem',
    'A friend, family member, advocate, or helper reporting for a tenant',
    'A person living in an SRO or residential hotel who is worried about retaliation',
  ],
  reading: 'Grade 7',
  sections: [
    {
      heading: 'You can ask the City for help',
      karl: 'Maps to an "Information section" → Title and text block: Title = this heading, Text = the two paragraphs below.',
      kind: 'body',
      paragraphs: [
        'Tenants have rights when they ask for repairs or report housing conditions to the City.',
        'Retaliation can include trying to evict you, raising rent, reducing services, or threatening you because you reported a condition.',
      ],
      callout: {
        karl: "Maps to its own Callout stream item (a sibling of the Title and text item above, not nested inside it — Information section's three block types are top-level stream siblings). Single rich text field only, no separate title field, which this mockup callout already lacks, so no mismatch here. Verify wording before publication.",
        text: 'This page gives general information, not legal advice. Contact the Rent Board or a tenant support organization for help with your situation.',
      },
    },
    {
      heading: 'Tenant responsibilities',
      karl: 'Added from the Article 11 Interpretation Guide v1.0. Maps to a Title and text block with bulleted list.',
      kind: 'body',
      paragraphs: [
        "Tenants also have responsibilities under Article 11 and the Director's Rules for keeping their home free of pests.",
      ],
      bullets: [
        '**Keep your home clean:** Regular cleaning, taking out trash, and not letting food or garbage build up helps prevent pests.',
        '**Report pest signs early:** Tell your landlord in writing as soon as you see droppings, gnaw marks, live pests, or damage.',
        '**Cooperate with inspections and treatments:** Allow reasonable access for pest control professionals, inspectors, and maintenance workers when scheduled.',
        '**Prepare for treatment:** Follow preparation instructions from the pest control operator before treatment — move furniture, cover food, and clear access areas.',
        '**Reduce clutter:** Clutter gives pests places to hide and makes inspections and treatments less effective.',
      ],
      callout: {
        title: '72-hour reporting pattern',
        text: 'Notify your property owner or manager first. Allow at least 72 hours for them to begin addressing the issue. If the problem continues or the owner does not respond, report the issue through 311. Do not delay reporting immediate health or safety hazards.',
        karl: 'Callout block: standard 72-hour tenant notification and reporting pattern for tenant-facing pages.',
      },
    },
    {
      heading: 'What retaliation can look like',
      karl: 'Maps to a second Title and text block: Title = this heading, Text = the paragraph plus the bulleted list below. General information, not legal advice.',
      kind: 'body',
      paragraphs: [
        'Retaliation is when a property owner or manager punishes you for reporting a condition. It can take different forms.',
      ],
      bullets: [
        'Trying to evict you or threatening eviction',
        'Raising your rent after you report a problem',
        'Reducing or removing services you normally have',
        'Refusing to make repairs because you reported a condition',
        'Threats, harassment, or pressure to drop a complaint',
      ],
    },
    {
      heading: 'What you can do',
      karl: 'Maps to a third Title and text block: Title = this heading, Text = the paragraph plus the bulleted list below. General information, not legal advice.',
      kind: 'body',
      paragraphs: [
        'These steps can help protect you if you are worried about reporting a housing condition.',
      ],
      bullets: [
        'Keep copies of repair requests, messages, and any reports you make.',
        'Report unsafe conditions to 311 so there is a record.',
        'Contact the Rent Board or a tenant support organization for help with your situation.',
        'You can ask 311 for help in your language.',
        'Ask for help if a disability or medical need makes it hard to report or prepare for an inspection.',
      ],
    },
    {
      heading: 'Where to get tenant help',
      karl: 'Maps to a fourth Title and text block: Title = this heading, Text = the two card descriptions below, each written as a Link-tool "External link" (a confirmed link type in the rich text "/" menu) rather than as separate blocks — this section has no paragraphs of its own, only the two link cards. Verify active URLs before publication.',
      kind: 'placement',
      cards: [
        {
          title: 'SF Rent Board',
          text: 'Get information about tenant rights, landlord rules, and rent-related questions.',
          url: 'https://www.sf.gov/departments/rent-board',
          karl: 'Maps to a Link-tool "External link" inside the Title and text block\'s rich text above (link text = this card\'s title, target = the sf.gov/departments/rent-board URL) — External link is a confirmed Link-tool type, not a gap like the page-only Related field.',
        },
        {
          title: 'Get tenant help',
          text: 'Use tenant support resources if you are worried about retaliation or eviction.',
          url: 'https://www.sf.gov/topics/housing',
          karl: 'Maps to a Link-tool "External link" inside the same Title and text block\'s rich text (link text = this card\'s title, target = the URL below) — External link is a confirmed Link-tool type. Verify the final SF.gov destination before publication.',
        },
      ],
    },
    {
      heading: 'Related pages',
      karl: 'Maps to the Related field: a generic unrestricted "Page" chooser, repeatable.',
      kind: 'placement',
      cards: [
        {
          title: 'What happens after you report',
          target: 'afterReport',
        },
        {
          title: 'How to respond to a notice of violation',
          target: 'noticeOfViolation',
        },
        {
          title: 'Learn what HHVC can inspect',
          target: 'scopeInfo',
        },
      ],
    },
  ],
  seoTitle: 'Tenant rights when reporting housing conditions | SF.gov',
  metaDescription:
    'Tenant protections and help if you are worried about retaliation after reporting housing conditions.',
}

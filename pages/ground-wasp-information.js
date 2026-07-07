window.HHVC_PAGES = window.HHVC_PAGES || {}
window.HHVC_PAGES['waspInfo'] = {
  slug: 'sf.gov/information/ground-wasps-and-housing-health',
  type: 'Information',
  title: 'Ground wasps and housing health',
  summary:
    'Learn about ground-nesting wasps, sting risks, and how to reduce food and shelter that attract them.',
  audience: [
    'A tenant or resident dealing with wasp activity or stings near a building',
    'A property owner or manager maintaining yards, garbage areas, or shared outdoor space',
    'A building worker or maintenance staff working outdoors where wasps may nest',
  ],
  reading: 'Grade 7',
  editorNote:
    'New Information page. Content sourced from UC IPM Pest Notes 7450 (docs/source/hhvc-policy/2026-07-02-ipm-pests-yellowjackets.md). Verify HHVC scope for stinging-insect complaints vs. referral to a PCO or local mosquito and vector control district before publication.',
  sections: [
    {
      heading: 'Why it matters',
      karl: 'Maps to an "Information section" → Title and text block: Title = this heading, Text = the two paragraphs below. Health-harm framing, placed first to motivate prevention — verify injury-risk specifics with SFDPH vector program before publication.',
      kind: 'body',
      paragraphs: [
        'Ground-nesting yellowjackets defend their colony aggressively when it is disturbed, and stinging incidents are most common right at the nest site. Reactions to a sting range from short-term pain and swelling to a serious, life-threatening allergic reaction.',
        'Being stung many times in one encounter is a separate, more serious risk: the volume of venom injected can damage red blood cells and other tissue, and in rare cases the breakdown products can overwhelm the kidneys and require emergency medical treatment.',
      ],
      callout: {
        karl: "Maps to its own Callout stream item (a sibling of the Title and text item above, not nested inside it — Information section's three block types are top-level stream siblings). Single rich text field only, no separate title field, which this mockup callout already lacks, so no mismatch here.",
        text: 'Get medical help right away for trouble breathing, swelling of the face or throat, dizziness, or a large number of stings in one encounter.',
      },
    },
    {
      heading: 'Where ground wasps nest and what attracts them',
      karl: 'Maps to a second Title and text block: Title = this heading, Text = the two paragraphs plus the bulleted list below (bullets render as a bulleted list inside the same rich text field). Sourced from UC IPM Pest Notes 7450.',
      kind: 'body',
      paragraphs: [
        'Western yellowjackets — the most common ground-nesting wasp in California — often build their nest in an old rodent burrow. A steady line of wasps flying in and out of a single hole in the ground usually means a nest is nearby.',
        'By late summer and fall, yellowjackets spend more time scavenging for food and are drawn to garbage cans, pet food left outside, and sugary food or drinks.',
      ],
      bullets: [
        'Keep garbage in tightly sealed containers.',
        'Bring pet food inside instead of leaving it out.',
        'Keep sweet drinks and food covered or indoors, especially outdoors in late summer and fall.',
      ],
    },
    {
      heading: 'If you find a wasp nest',
      karl: 'Maps to a third Title and text block: Title = this heading, Text = the paragraph plus the bulleted list below. Sourced from UC IPM Pest Notes 7450.',
      kind: 'body',
      paragraphs: [
        'Do not try to spray or destroy a ground wasp nest yourself. Underground nests can be deep and hard to reach, and disturbed wasps will defend the nest aggressively — including wasps encountered well away from the entrance.',
      ],
      bullets: [
        'Keep children and pets away from the nest area.',
        'Avoid mowing, digging, or working near a known nest entrance.',
        'Hire a licensed pest control operator to remove the nest safely.',
      ],
    },
    {
      heading: 'When to report',
      karl: 'Maps to a fourth Title and text block: Title = this heading, Text = the two paragraphs below (reporting threshold and dual-track routing — city vs. private-property referral). Resolved schema gap: converted card-as-CTA to an inline link folded into this block\'s rich text (Internal link → vegetationReport), or via the "Part of" repeatable field (a page chooser restricted to Transaction pages) if this Information page is marked as supporting that Transaction — flag both options for Digital Services rather than assuming either.',
      kind: 'body',
      paragraphs: [
        'HHVC inspects suspected ground wasp nests to verify safety hazards. If you are a tenant, notify your landlord or property manager in writing immediately so they can address this safety hazard. If they do not respond or fail to hire a professional, report the nest to 311 to request an HHVC inspection.',
        'If an HHVC inspector finds a ground wasp nest on city or public property, we will refer the issue to the appropriate sister agency for safe removal. If the nest is on private residential property, HHVC will require the property owner to contract a licensed Pest Control Operator (PCO) to eliminate the nest. [Report a ground wasp nest](vegetationReport)',
      ],
    },
    {
      heading: 'Related pages',
      karl: 'Maps to the Related field: a generic unrestricted "Page" chooser, repeatable.',
      kind: 'placement',
      cards: [
        {
          title: 'Prevent garbage and clutter problems',
          target: 'garbageInfo',
        },
        {
          title: 'Prevent overgrown vegetation',
          target: 'vegetationInfo',
        },
        {
          title: 'Learn what HHVC can inspect',
          target: 'scopeInfo',
        },
      ],
    },
  ],
  contactSection: {
    phone: 'Environmental Health: 415-252-3800',
    email: 'healthyhousing@sf.gov',
    karl: 'Contact section: Environmental Health (standardized footer)',
  },
  seoTitle: 'Ground wasps and housing health | SF.gov',
  metaDescription:
    'Ground-nesting yellowjacket sting risks, nest identification, and how to reduce conditions that attract wasps',
}

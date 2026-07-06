window.HHVC_PAGES = window.HHVC_PAGES || {}
window.HHVC_PAGES['mosquitoesPrevent'] = {
  slug: 'sf.gov/information/prevent-mosquitoes',
  type: 'Information',
  title: 'Prevent mosquitoes',
  summary: 'Learn how to remove standing water and reduce mosquito breeding around your home.',
  audience: [
    'A tenant or resident trying to reduce mosquitoes',
    'A property owner or manager looking for best practices',
    'A building employee or maintenance worker who can remove standing water',
  ],
  reading: 'Grade 6',
  editorNote:
    'Information page. New "Why it matters" health-harm section added — verify West Nile virus claims against current CDC/SFDPH guidance before publication.',
  sections: [
    {
      heading: 'Why it matters',
      karl: 'Maps to an "Information section" → Title and text block: Title = this heading, Text = the two paragraphs below. Health-harm framing, placed first to motivate prevention — verify disease-risk specifics with SFDPH vector program before publication.',
      kind: 'body',
      paragraphs: [
        "Mosquitoes can spread West Nile virus to people through a bite after feeding on an infected bird. Most people who are infected don't feel sick, but some develop a fever, and in rare cases the virus can cause serious, long-lasting neurological illness.",
        'Because mosquitoes can travel between properties, standing water left on one lot can affect the health of an entire block — which is why removing breeding sites is a shared responsibility, not just a personal one.',
      ],
      callout: {
        karl: "Maps to its own Callout stream item (a sibling of the Title and text item above, not nested inside it — Information section's three block types are top-level stream siblings). Single rich text field only, no separate title field, which this mockup callout already lacks, so no mismatch here.",
        text: 'Even a small amount of standing water — like an inch in a bottle cap or saucer — is enough for mosquitoes to breed.',
      },
    },
    {
      heading: 'Eliminate standing water',
      karl: 'Maps to a second Title and text block: Title = this heading, Text = the two paragraphs plus the bulleted list below (bullets render as a bulleted list inside the same rich text field).',
      kind: 'body',
      paragraphs: [
        'Mosquitoes must have standing water to develop and breed. Mosquito eggs hatch into active, wiggling larvae that live at the water surface. Eliminating standing water helps prevent mosquitoes and reduce pests around your property.',
        'Standing water under houses or in basements is a major source of mosquitoes in urban areas.',
      ],
      bullets: [
        'Containers: Empty, invert, cover, or throw away buckets, drums, plant saucers, and other outdoor containers that hold water.',
        'Rainwater: Clean gutters and drains regularly, and cover items that collect rainwater.',
        'Pools and Spas: Keep them chlorinated and covered tightly when not in use. Drain water off the covers.',
        'Backyard Ponds: Stock fishponds with mosquito fish, remove excess weeds, and maintain proper water flow.',
        'Bird Baths: Change the water at least once a week.',
        'Basements and Crawls: Keep areas under houses dry. Repair leaking pipes, dripping faucets, and condensation lines. Major structural plumbing leaks are routed to the Department of Building Inspection (DBI) under the San Francisco Housing Code (2025).',
        'Tires: Store tires indoors, cover them, or dispose of them properly so they do not collect water.',
      ],
    },
    {
      heading: 'Check your property after rain',
      karl: 'Maps to a third Title and text block: Title = this heading, Text = the paragraph plus the bulleted list below. Added for depth — reinforces standing-water removal.',
      kind: 'body',
      paragraphs: [
        'Standing water can collect quickly after rain. Walk your property and empty water from these common spots each week.',
      ],
      bullets: [
        'Buckets, cans, jars, and other open containers',
        'Plant saucers, pots, and wheelbarrows',
        'Clogged gutters and downspouts',
        'Tarps, trash and recycling bins, and their lids',
        'Old tires and play equipment',
      ],
    },
    {
      heading: 'Follow West Nile virus precautions',
      karl: 'Maps to a fourth Title and text block: Title = this heading, Text = the paragraph plus the bulleted list below.',
      kind: 'body',
      paragraphs: [
        'West Nile virus is spread to humans through the bite of an infected mosquito. Mosquitoes become infected when they feed on infected birds. Protect yourself and your property with these simple steps:',
      ],
      bullets: [
        'Install window screens: Repair or install screens on windows and doors. Keep windows closed before dusk.',
        'Avoid overwatering: Do not overwater gardens or lawns. Allow the soil to dry between watering sessions.',
        'Trim plants: Thin dense shrubs, vines, and groundcover where adult mosquitoes hide and rest.',
        'Protect skin: Wear insect repellent and long clothing when mosquitoes are active.',
      ],
    },
    {
      heading: 'Report standing water and mosquitoes',
      karl: 'Maps to a fifth Title and text block: Title = this heading, Text = the paragraph plus the bulleted list below.',
      kind: 'body',
      paragraphs: [
        'You can report standing water or mosquito concerns to the City. DPH will investigate complaints and can treat catch basins and standing water to prevent breeding.',
      ],
      bullets: [
        'Report unusual mosquito activity or standing water to the SFDPH Mosquito Control Program at 415-252-3806 or by calling 311.',
        'For additional information, visit SFMosquito.org, WestNile.ca.gov, or call 1-877-WNV-BIRD.',
      ],
    },
    {
      heading: 'When someone should report',
      karl: 'Paragraphs map to a sixth Title and text block (Title = this heading, Text = the two paragraphs). Real-schema gap: the verified Information form has no confirmed button/CTA block type (only Title and text/Image/Callout were observed) — this "Report mosquitoes" button has no confirmed home. It may fit inside the Title and text block\'s rich text as a Link-tool link (Internal link → the mosquitoesReport Transaction page), or via the "Part of" repeatable field (a page chooser restricted to Transaction pages) if this Information page is marked as supporting that Transaction — flag both options for Digital Services rather than assuming either.',
      kind: 'body',
      paragraphs: [
        'A tenant, tenant helper, affected resident, or employee can report through 311 if the problem continues after 72 hours, affects a shared area, or the property owner or manager does not respond.',
      ],
      button: 'Report mosquitoes',
      buttonStyle: 'secondary',
      buttonTarget: 'mosquitoesReport',
    },
    {
      heading: 'Related pages',
      karl: 'Maps to the Related field: a generic unrestricted "Page" chooser, repeatable. Real-schema gap: Related has no custom title/text per item, only a page reference — the descriptions on these 4 cards have no home unless Digital Services adds one.',
      kind: 'placement',
      cards: [
        {
          title: 'Learn what HHVC can inspect',
          text: 'Check whether Environmental Health may review the issue.',
          target: 'scopeInfo',
          karl: 'Related field entry — page chooser only; this description text is not supported in the real schema (see section-level karl note above).',
        },
        {
          title: 'What happens after you report',
          text: 'Learn how reports are reviewed, assigned on weekdays, and when an inspector may contact you.',
          target: 'afterReport',
          karl: 'Related field entry — page chooser only; this description text is not supported in the real schema (see section-level karl note above).',
        },
        {
          title: 'Mosquito Control Program',
          text: 'Find program information, surveillance updates, and West Nile virus resources.',
          target: 'mosquitoControl',
          karl: 'Related field entry — page chooser only; this description text is not supported in the real schema (see section-level karl note above).',
        },
        {
          title: 'Free mosquito education workshop',
          text: 'Bring hands-on mosquito science to your school, camp, museum, or science fair.',
          target: 'mosquitoWorkshop',
          karl: 'Related field entry — page chooser only; this description text is not supported in the real schema (see section-level karl note above).',
        },
      ],
    },
  ],
}

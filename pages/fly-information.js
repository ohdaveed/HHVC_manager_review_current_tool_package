window.HHVC_PAGES = window.HHVC_PAGES || {}
window.HHVC_PAGES['flyInfo'] = {
  slug: 'sf.gov/information/flies-and-housing-health',
  type: 'Information',
  title: 'Flies and housing health',
  summary:
    'Learn how flies breed in garbage and waste, disease risks, and steps to reduce fly problems.',
  audience: [
    'A tenant or resident dealing with flies in or around a building',
    'A property owner or manager responsible for garbage and waste areas',
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
    'New Information page. Content sourced from UC IPM Pest Notes 7457 (docs/source/hhvc-policy/2026-07-02-ipm-pests-flies.md), focused on house flies as the species HHVC enforces on in San Francisco housing. Verify against current SFDPH vector program guidance before publication.',
  sections: [
    {
      heading: 'Why it matters',
      karl: 'Maps to an "Information section" → Title and text block: Title = this heading, Text = the two paragraphs below (fly disease-transmission health-harm framing, placed first to motivate prevention). Verify disease-risk specifics with SFDPH vector program before publication.',
      kind: 'body',
      image: {
        src: 'https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?auto=format&fit=crop&w=800&q=80',
        alt: 'House fly on a surface near food waste',
        karl: 'Information section: Image — pest identification aid',
      },
      paragraphs: [
        'House flies breed in garbage, animal waste, and other decaying organic material. While feeding on this waste, they can pick up bacteria and viruses and later deposit them on human food or kitchen surfaces — flies are known to carry organisms linked to diarrhea, food poisoning, dysentery, and eye infections.',
        'Fly populations can grow quickly: under warm conditions a fly can develop from egg to adult in about a week, and each female can lay several batches of 100 or more eggs. A garbage or sanitation problem left unaddressed for even a short time can turn into a much larger fly problem.',
      ],
      callout: {
        variant: 'note',
        karl: "Maps to its own Callout stream item (a sibling of the Title and text item above, not nested inside it — Information section's three block types are top-level stream siblings). Single rich text field only, no separate title field, which this mockup callout already lacks, so no mismatch here.",
        text: 'Seeing flies indoors almost always means there is a breeding source nearby — usually uncollected garbage, animal waste, or decaying food — not just an isolated nuisance.',
      },
    },
    {
      heading: 'Where flies breed and how to reduce them',
      karl: 'Maps to a second Title and text block: Title = this heading, Text = the paragraph plus the bulleted list below (bullets render as a bulleted list inside the same rich text field). Sourced from UC IPM Pest Notes 7457.',
      kind: 'body',
      paragraphs: [
        'Eliminating the places where flies breed is far more effective than trying to kill adult flies after the fact.',
      ],
      bullets: [
        'Remove garbage, food waste, and animal waste at least once a week — waste left longer than a week is likely to produce adult flies.',
        'Keep garbage sealed in plastic bags inside containers with tight-fitting lids, and place containers as far from building entrances as practical.',
        'Clean up pet waste promptly and do not let it accumulate in yards or shared outdoor areas.',
        'Seal cracks around windows and doors, and repair or install window screens — most indoor flies entered from outside.',
        'Wash garbage containers regularly to remove residue that attracts flies.',
      ],
    },
    {
      heading: 'When to report',
      karl: 'Maps to a third Title and text block: Title = this heading, Text = the two paragraphs below (reporting threshold and active enforcement routing under the San Francisco Health Code).',
      kind: 'body',
      paragraphs: [
        'HHVC inspects active fly infestations and enforces fly control requirements under the San Francisco Health Code. If you rent your home, tell your landlord or property manager about the fly problem in writing first. Give them 72 hours to respond and start fixing the breeding source.',
        'You should report the issue to 311 if the fly infestation continues, if flies are breeding in shared areas (like communal kitchens, garbage rooms, or courtyards), or if your landlord does not respond.',
      ],
      cards: [
        {
          title: 'Report flies or breeding conditions',
          text: 'Report active fly infestations or unsanitary conditions breeding flies through 311 for HHVC inspection.',
          target: 'garbageReport',
          karl: 'This card links to an internal page (garbageReport, a Transaction page) inline, mid-body — not in the final Related section. Two options for Digital Services: fold it in as an internal Link-tool link within this block\'s own Title and text rich text (preserves its inline placement), or move it to the page-level "Related" field (an unrestricted page chooser) — but Related has no custom title/text per item, so this card\'s description would have no home there either way.',
        },
      ],
    },
    {
      heading: 'Related pages',
      component: 'related',
      karl: 'Maps to the Related field: a generic unrestricted "Page" chooser, repeatable.',
      kind: 'placement',
      cards: [
        {
          title: 'Prevent garbage and clutter problems',
          target: 'garbageInfo',
        },
        {
          title: 'Learn what HHVC can inspect',
          target: 'scopeInfo',
        },
      ],
    },
  ],
  seoTitle: 'Flies and housing health | SF.gov',
  metaDescription:
    'How house flies breed in garbage and waste, the disease risk they carry, and how to reduce fly problems',
}

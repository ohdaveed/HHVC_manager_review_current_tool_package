window.HHVC_PAGES = window.HHVC_PAGES || {}
window.HHVC_PAGES['raccoonInfo'] = {
  slug: 'sf.gov/information/raccoons-and-housing-health',
  type: 'Information',
  title: 'Raccoons and housing health',
  summary:
    'Learn about raccoon roundworm risks, how to clean up raccoon latrines safely, and when to report housing-health conditions.',
  audience: [
    'A tenant or resident dealing with raccoons near a building',
    'A property owner or manager trying to reduce wildlife attractants',
    'A neighbor reporting garbage, animal waste, or entry points caused by raccoon activity',
  ],
  reading: 'Grade 6–7',
  editorNote:
    'Information page. Wildlife trapping is outside HHVC scope — route injured/trapped animals to Animal Care & Control. Latrine cleanup steps follow CDC Baylisascaris guidance; SME must verify against current CDC/DPH protocols before publication. In Karl: add CDC external link in Information section; do not publish until vector program signs off.',
  editorStatus: 'blocked',
  sections: [
    {
      heading: 'Why it matters',
      karl: 'Maps to an "Information section" → Title and text block: Title = this heading, Text = the two paragraphs below (raccoon roundworm health-harm framing, placed first to motivate prevention). Verify disease-risk specifics with SFDPH vector program before publication.',
      kind: 'body',
      paragraphs: [
        'Raccoon feces can contain Baylisascaris procyonis, a roundworm that causes a serious illness in people if its eggs are accidentally swallowed. In rare but severe cases, the infection can affect the brain and nervous system, especially in young children who put contaminated soil or objects in their mouths.',
        'Because raccoons often return to the same latrine site again and again, contamination can build up in play areas, gardens, and building surfaces without anyone realizing it — making early identification and safe cleanup essential to preventing exposure.',
      ],
      callout: {
        karl: "Maps to its own Callout stream item (a sibling of the Title and text item above, not nested inside it — Information section's three block types are top-level stream siblings). Single rich text field only, no separate title field, which this mockup callout already lacks, so no mismatch here.",
        text: "Treat any suspected raccoon latrine as a health hazard right away — don't wait to clean it up, and keep children and pets away until it's handled safely.",
      },
    },
    {
      heading: 'Raccoons and your building',
      karl: 'Maps to a second Title and text block: Title = this heading, Text = the two paragraphs below.',
      kind: 'body',
      paragraphs: [
        'Raccoons are common in San Francisco. They are attracted to food, water, shelter, and easy access to garbage or compost.',
        'Healthy Housing and Vector Control does not trap or remove wildlife. HHVC may review housing-health conditions that attract raccoons or that raccoons worsen, such as exposed garbage, animal waste, or openings that let pests enter a building.',
      ],
      callout: {
        karl: 'Maps to its own Callout stream item (a second Callout sibling, alongside the "Why it matters" Callout above — not nested inside any Title and text block). No title field; this callout has none, so no mismatch.',
        text: 'For injured, sick, or trapped wildlife, contact San Francisco Animal Care & Control. For active housing-health nuisances tied to garbage, waste, or pest entry, use the reporting pages on this topic.',
      },
    },
    {
      heading: 'Raccoon roundworm and latrines',
      karl: 'Maps to a third Title and text block: Title = this heading, Text = the two paragraphs below.',
      kind: 'body',
      paragraphs: [
        'Raccoons can carry a roundworm called Baylisascaris procyonis. The worm’s eggs are passed in raccoon feces and can make people sick if swallowed. Young children are at higher risk because they may put contaminated soil, wood chips, or objects in their mouths.',
        'Raccoons often leave feces in the same spot again and again. These repeated piles are sometimes called latrines. Latrines may be found on roofs, decks, patios, attics, crawl spaces, sandboxes, woodpiles, or raised surfaces near a building.',
      ],
      callout: {
        karl: 'Maps to its own Callout stream item (a third Callout sibling on this page — not nested inside any Title and text block). No title field; this callout has none, so no mismatch.',
        text: 'Treat raccoon feces and latrine sites as a health hazard. Keep children and pets away from latrines until the area is cleaned or professionally handled.',
      },
    },
    {
      heading: 'How to clean up a raccoon latrine safely',
      karl: 'Maps to a fourth Title and text block: Title = this heading, Text = the two paragraphs below. Real-schema gap: the 4 steps that follow have no Section/step container to live in — unlike Transaction, the verified Information schema has only Title and text/Image/Callout as top-level blocks, with no Section-style step wrapper. Each step below becomes its own separate sibling Title and text block instead; the step grouping/numbering itself has no native home in Information. Verify latrine cleanup content against CDC/DPH guidance before publication.',
      kind: 'body',
      paragraphs: [
        'Do not sweep or vacuum dry raccoon droppings. Dry dust can spread roundworm eggs into the air.',
        'If you are not trained or equipped to clean a latrine safely, hire a licensed pest control operator or other qualified professional.',
      ],
      steps: [
        {
          title: 'Protect yourself',
          text: [
            'Before you start, put on disposable gloves, protective clothing, and shoes or boots you can clean afterward.',
          ],
          bullets: [
            'Wear disposable gloves and shoe covers or boots that can be washed',
            'Wear long sleeves and old clothes you can wash or throw away',
            'Consider a dust mask if you cannot avoid creating dust',
          ],
          karl: 'Maps to a fifth Title and text block (a sibling of the "How to clean up..." block above, not nested inside it — see the section-level karl note on the no-Section gap): Title = this step title, Text = the text item plus the bulleted list below (bullets render as a bulleted list inside the same rich text field).',
        },
        {
          title: 'Lightly wet the droppings',
          text: [
            'Lightly spray the latrine with water or a mild soap-and-water mix. This helps keep eggs from becoming airborne while you clean.',
          ],
          karl: 'Maps to a sixth Title and text block (sibling step block, same no-Section gap as above): Title = this step title, Text = the text item below.',
        },
        {
          title: 'Remove and bag the waste',
          text: [
            'Use a shovel or disposable tools to place droppings and nearby contaminated material into heavy plastic bags.',
          ],
          bullets: [
            'Double-bag the waste and tie the bags closed',
            'Place the bags in an outdoor garbage container with a tight lid',
            'Do not put raccoon waste in compost',
          ],
          karl: 'Maps to a seventh Title and text block (sibling step block, same no-Section gap as above): Title = this step title, Text = the text item plus the bulleted list below.',
        },
        {
          title: 'Clean the area and your hands',
          text: ['After removal, clean the surface and wash up thoroughly.'],
          bullets: [
            'Scrub the area with hot water and soap, or use boiling water on hard surfaces when safe to do so',
            'Wash gloves, tools, clothes, and boots after use',
            'Wash your hands with soap and water for at least 20 seconds, even if you wore gloves',
          ],
          karl: 'Maps to an eighth Title and text block (sibling step block, same no-Section gap as above): Title = this step title, Text = the text item plus the bulleted list below.',
        },
      ],
      callout: {
        karl: 'Maps to its own Callout stream item (a fourth Callout sibling on this page, sitting after the 4 step Title and text blocks above — not nested inside any of them). No title field; this callout has none, so no mismatch.',
        text: 'If a latrine is in or near a child play area, sandbox, or shared courtyard, keep the area closed until cleanup is complete and consider replacing heavily contaminated material such as sand or mulch.',
      },
      cards: [
        {
          title: 'CDC: Raccoon roundworm (Baylisascaris) prevention',
          text: 'Read CDC guidance on raccoon latrines, roundworm risks, and safe cleanup before handling droppings.',
          url: 'https://www.cdc.gov/parasites/baylisascaris/prevention.html',
          karl: 'This card links to an external URL, not an internal page — it does not fit the verified "Related" field (an unrestricted but internal-only Page chooser; no external-URL support observed). No block type in the verified Information schema holds a card-style external link with its own title/description. Best option: fold this in as a Link-tool External link within one of this section\'s own Title and text rich text blocks (e.g. the intro block or a step block) — flag for Digital Services rather than assuming a dedicated field. SME-verified latrine cleanup source.',
        },
      ],
    },
    {
      heading: 'Reduce raccoon attractants',
      karl: 'Maps to a ninth Title and text block: Title = this heading, Text = the bulleted list below (bullets render as a bulleted list inside the same rich text field; this section has no paragraphs, only bullets).',
      kind: 'body',
      bullets: [
        'Store garbage and compost in secure, animal-resistant containers with tight lids.',
        'Do not leave pet food outdoors overnight.',
        'Pick up fallen fruit and clean up food waste in yards and shared areas.',
        'Close access holes around foundations, vents, and crawl spaces that rodents or other pests may also use.',
        'Keep shared garbage rooms and exterior storage areas clean and dry.',
      ],
    },
    {
      heading: 'When to report to the City',
      karl: 'Maps to a tenth Title and text block: Title = this heading, Text = the paragraph below.',
      kind: 'body',
      paragraphs: [
        'Report through 311 when raccoon activity is tied to a housing-health condition HHVC may inspect, such as persistent garbage, animal waste, or overgrown vegetation that supports pests or vectors.',
      ],
      cards: [
        {
          title: 'Report pigeons',
          text: 'Report pigeon roosting, nesting, droppings, or feeding around a building or shared area.',
          target: 'pigeonsReport',
          karl: 'This card links to an internal Transaction page inline, mid-body — not in the final Related section. Two unconfirmed options for Digital Services: fold it in as an internal Link-tool link within this block\'s own Title and text rich text (preserves its inline placement), or move it to the page-level "Related" field (an unrestricted page chooser) — but Related has no custom title/text per item, so this card\'s description would have no home there either way.',
        },
        {
          title: 'Report garbage or clutter',
          text: 'Report garbage, clutter, or animal waste that may attract pests, vectors, or wildlife.',
          target: 'garbageReport',
          karl: 'This card links to an internal Transaction page inline, mid-body — not in the final Related section. Two unconfirmed options for Digital Services: fold it in as an internal Link-tool link within this block\'s own Title and text rich text (preserves its inline placement), or move it to the page-level "Related" field (an unrestricted page chooser) — but Related has no custom title/text per item, so this card\'s description would have no home there either way.',
        },
        {
          title: 'Report overgrown vegetation',
          text: 'Report overgrown plants or brush that may shelter pests or vectors.',
          target: 'vegetationReport',
          karl: 'This card links to an internal Transaction page inline, mid-body — not in the final Related section. Two unconfirmed options for Digital Services: fold it in as an internal Link-tool link within this block\'s own Title and text rich text (preserves its inline placement), or move it to the page-level "Related" field (an unrestricted page chooser) — but Related has no custom title/text per item, so this card\'s description would have no home there either way.',
        },
        {
          title: 'Report rats or mice',
          text: 'Report rat or mouse activity if raccoons have damaged entry points or waste has attracted rodents.',
          target: 'ratsReport',
          karl: 'This card links to an internal Transaction page inline, mid-body — not in the final Related section. Two unconfirmed options for Digital Services: fold it in as an internal Link-tool link within this block\'s own Title and text rich text (preserves its inline placement), or move it to the page-level "Related" field (an unrestricted page chooser) — but Related has no custom title/text per item, so this card\'s description would have no home there either way.',
        },
      ],
    },
    {
      heading: 'Related pages',
      karl: 'Maps to the Related field: a generic unrestricted "Page" chooser, repeatable. Real-schema gap: Related has no custom title/text per item, only a page reference — the descriptions on these 2 cards have no home unless Digital Services adds one.',
      kind: 'placement',
      cards: [
        {
          title: 'Keep rats and mice out',
          text: 'Learn how to reduce food, water, shelter, and entry points.',
          target: 'ratsPrevent',
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
  seoTitle: 'Raccoons and housing health | SF.gov',
  metaDescription:
    'Raccoon roundworm risks, safe latrine cleanup, and when to report housing-health conditions HHVC may review.',
}

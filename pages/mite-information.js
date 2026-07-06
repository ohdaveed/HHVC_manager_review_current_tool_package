window.HHVC_PAGES = window.HHVC_PAGES || {}
window.HHVC_PAGES['miteInfo'] = {
  slug: 'sf.gov/information/mites-and-housing-health',
  type: 'Information',
  title: 'Mites and housing health',
  summary:
    'Learn about tropical rat mites, why rodent nests must be treated before rodenticides, and how mite concerns differ from bed bugs.',
  audience: [
    'A tenant with bites, itching, or small insects they think may be mites',
    'A property owner or manager planning rodent control or responding to bites after rodent activity',
    'A resident after bird or rodent activity in or near the building',
  ],
  reading: 'Grade 6–8',
  editorNote:
    'Information page. Do not provide medical diagnosis. Verify HHVC scope and PCO treatment sequencing guidance before publication. Must stay cross-linked with Keep rats and mice out for tropical rat mite / rodenticide order-of-operations.',
  sections: [
    {
      heading: 'Why it matters',
      karl: 'Maps to an "Information section" → Title and text block: Title = this heading, Text = the two paragraphs below (tropical rat mite health-harm framing, placed first to motivate prevention). Verify disease-risk specifics with SFDPH vector program before publication.',
      kind: 'body',
      paragraphs: [
        'Tropical rat mite bites cause itching and skin irritation, and repeated scratching can lead to secondary skin infections. When rodenticides kill rats without first treating the nest, surviving mites scatter in search of a new host — which can trigger a sudden spike in bites among residents in the building.',
        "Because mite outbreaks often follow rodent activity, delaying nest treatment doesn't just risk continued rat problems — it can actively make things worse for tenants living nearby.",
      ],
      callout: {
        karl: "Maps to its own Callout stream item (a sibling of the Title and text item above, not nested inside it — Information section's three block types are top-level stream siblings). Single rich text field only, no separate title field, which this mockup callout already lacks, so no mismatch here.",
        text: 'If bites appear soon after rodenticide use, treat it as a sign the rat nest was not properly treated for mites.',
      },
    },
    {
      heading: 'Mites in housing settings',
      karl: 'Maps to a second Title and text block: Title = this heading, Text = the two paragraphs below.',
      kind: 'body',
      paragraphs: [
        'People often use the word “mites” when they see small insects, feel bites, or notice skin irritation. In housing, one common concern is the tropical rat mite, which is linked to active or recent rat nests.',
        'Mites are not the same as bed bugs. Bed bugs are a separate pest with different signs, treatment rules, and reporting paths.',
      ],
      callout: {
        karl: 'Maps to its own Callout stream item (a second Callout sibling, alongside the "Why it matters" Callout above — not nested inside any Title and text block). No title field; this callout has none, so no mismatch.',
        text: 'This page gives general housing-health information, not medical advice. Contact a health care provider if you have symptoms that need medical evaluation.',
      },
    },
    {
      heading: 'Tropical rat mites and rodent nests',
      karl: 'Maps to a third Title and text block: Title = this heading, Text = the two paragraphs below.',
      kind: 'body',
      paragraphs: [
        'Tropical rat mites live in and around rat nests. When rats are present, mites may bite people while searching for a host.',
        'If rats are killed with rodenticides before the nest and mites are treated, surviving mites can leave the nest and bite residents, workers, or pets. Bites often increase right after rodent poison is used without proper nest and mite treatment.',
      ],
      callout: {
        karl: 'Maps to its own Callout stream item (a third Callout sibling on this page — not nested inside any Title and text block). No title field; this callout has none, so no mismatch.',
        text: 'Treat rat nests for mites and remove nesting material before relying on rodenticides, or use a licensed pest control operator (PCO) who will handle mites and rodents in the right order.',
      },
      cards: [
        {
          title: 'Keep rats and mice out of your home',
          text: 'Learn exclusion, sanitation, trapping, and safe nest cleanup before using poison baits.',
          target: 'ratsPrevent',
          karl: 'This card links to an internal Information page inline, mid-body — not in the final Related section. Two options for Digital Services: fold it in as an internal Link-tool link within this block\'s own Title and text rich text (preserves its inline placement), or move it to the page-level "Related" field (an unrestricted page chooser) — but Related has no custom title/text per item, so this card\'s description would have no home there either way.',
        },
        {
          title: 'Report rats or mice',
          text: 'Report active rat or mouse activity in a home, building, yard, or shared area.',
          target: 'ratsReport',
          karl: 'This card links to an internal Transaction page inline, mid-body — not in the final Related section. Two options for Digital Services: fold it in as an internal Link-tool link within this block\'s own Title and text rich text (preserves its inline placement), or move it to the page-level "Related" field (an unrestricted page chooser) — but Related has no custom title/text per item, so this card\'s description would have no home there either way.',
        },
      ],
    },
    {
      heading: 'Treat nests for mites before rodenticides',
      karl: 'Maps to a fourth Title and text block: Title = this heading, Text = the paragraph below. Real-schema gap: the 3 steps that follow have no Section/step container to live in — unlike Transaction, the verified Information schema has only Title and text/Image/Callout as top-level blocks, with no Section-style step wrapper. Each step below becomes its own separate sibling Title and text block instead; the step grouping/numbering itself has no native home in Information.',
      kind: 'body',
      paragraphs: [
        'Rodent control should not start with poison alone when a rat nest may be feeding tropical rat mites. Property owners and PCOs should address the nest, mites, and rodents together.',
      ],
      steps: [
        {
          title: 'Find and treat the nest site',
          text: [
            'Look for nests in attics, crawl spaces, wall voids, basements, storage areas, and cluttered zones where droppings or rub marks are present.',
            'A PCO can treat the nest area for mites using methods appropriate to the site.',
          ],
          karl: 'Maps to a fifth Title and text block (a sibling of the "Treat nests..." block above, not nested inside it — see the section-level karl note on the no-Section gap): Title = this step title, Text = the two text items below.',
        },
        {
          title: 'Remove nesting material safely',
          text: [
            'After mite treatment, remove nesting material using wet cleanup methods. Do not dry-sweep or vacuum rodent nests.',
            'Follow safe rodent cleanup steps on the rats and mice prevention page.',
          ],
          button: 'Keep rats and mice out of your home',
          buttonTarget: 'ratsPrevent',
          karl: 'Maps to a sixth Title and text block (sibling step block, same no-Section gap as above): Title = this step title, Text = the two text items below. Real-schema gap: this step\'s button has no confirmed home (only Title and text/Image/Callout are confirmed Information blocks). Because buttonTarget (ratsPrevent) is an Information page, not a Transaction, the "Part of" field does NOT apply here (Part of is restricted to Transaction pages only) — the only option to flag for Digital Services is folding this in as a Link-tool Internal link within this block\'s own rich text.',
        },
        {
          title: 'Control rodents without worsening mite bites',
          text: [
            'Use traps and exclusion first when possible.',
            'If rodenticides are used, do not skip mite treatment at the nest. A PCO should coordinate both steps so mites do not scatter after rats die.',
          ],
          karl: 'Maps to a seventh Title and text block (sibling step block, same no-Section gap as above): Title = this step title, Text = the two text items below.',
        },
      ],
    },
    {
      heading: 'Signs that may suggest mites',
      karl: 'Maps to an eighth Title and text block: Title = this heading, Text = the bulleted list plus the paragraph below (bullets render as a bulleted list inside the same rich text field; order in the mockup is bullets-then-paragraph, but both land in the one Text field regardless).',
      kind: 'body',
      bullets: [
        'Itchy bites, often around ankles, waist, or arms, after rat activity in the building',
        'Small moving specks on bedding, furniture, or walls near a known or recent rat nest',
        'Bites that get worse soon after rodent poison was placed without nest cleanup',
        'Recent bird nesting, pigeon roosting, or rodent activity in or near the unit',
      ],
      paragraphs: [
        'A licensed pest control professional can help identify the pest. Property owners must address underlying conditions that support pests.',
      ],
    },
    {
      heading: 'What to do',
      karl: "This heading has no accompanying paragraph text of its own — its content lives entirely in the 3 steps below. Real-schema gap: the verified Information schema has no Section/step container (unlike Transaction), so there is no single block to anchor this heading to; each step below becomes its own separate Title and text block instead, and this heading itself has no confirmed home unless folded into the first step's Title.",
      kind: 'body',
      steps: [
        {
          title: 'Check whether the problem may be bed bugs',
          text: [
            'Look for bed bug signs such as live insects, shed skins, dark spots on bedding, or bites in rows.',
            'Use the bed bug pages if bed bugs are present or suspected.',
          ],
          button: 'Bed bug rules and prevention',
          buttonTarget: 'bedBugsInfo',
          karl: 'Maps to a ninth Title and text block (sibling step block, same no-Section gap noted above): Title = this step title, Text = the two text items below. Real-schema gap: this step\'s button has no confirmed home. Because buttonTarget (bedBugsInfo) is an Information page, not a Transaction, the "Part of" field does NOT apply here (Part of is restricted to Transaction pages only) — the only option to flag for Digital Services is folding this in as a Link-tool Internal link within this block\'s own rich text.',
        },
        {
          title: 'Remove pest sources',
          text: [
            'Address rodent nests, bird droppings, or sanitation conditions that may be supporting mites.',
            'Do not use rodenticides alone when tropical rat mites may be present — treat the nest first or hire a PCO.',
          ],
          karl: 'Maps to a tenth Title and text block (sibling step block, same no-Section gap noted above): Title = this step title, Text = the two text items below.',
        },
        {
          title: 'Report active pest or housing-health conditions',
          text: [
            'If the problem continues, report the underlying pest or housing-health condition through 311.',
          ],
          karl: 'Maps to an eleventh Title and text block (sibling step block, same no-Section gap noted above): Title = this step title, Text = the one text item below.',
        },
      ],
    },
    {
      heading: 'Related pages',
      karl: 'Maps to the Related field: a generic unrestricted "Page" chooser, repeatable. Real-schema gap: Related has no custom title/text per item, only a page reference — the descriptions on these 5 cards have no home unless Digital Services adds one.',
      kind: 'placement',
      cards: [
        {
          title: 'Keep rats and mice out of your home',
          text: 'Learn trapping, exclusion, safe nest cleanup, and why traps are preferred over poison.',
          target: 'ratsPrevent',
          karl: 'Related field entry — page chooser only; this description text is not supported in the real schema (see section-level karl note above).',
        },
        {
          title: 'Report rats or mice',
          text: 'Report rat or mouse activity that may be linked to tropical rat mites.',
          target: 'ratsReport',
          karl: 'Related field entry — page chooser only; this description text is not supported in the real schema (see section-level karl note above).',
        },
        {
          title: 'Report bed bugs',
          text: 'Report an active bed bug problem in rental housing, an SRO, or a residential hotel.',
          target: 'bedBugsReport',
          karl: 'Related field entry — page chooser only; this description text is not supported in the real schema (see section-level karl note above).',
        },
        {
          title: 'Pigeons and housing health',
          text: 'Learn about bird roosting, droppings, and related housing-health concerns.',
          target: 'pigeonInfo',
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
  seoTitle: 'Mites and housing health | SF.gov',
  metaDescription:
    'Tropical rat mites, nest treatment before rodenticides, and when to report rodent or housing-health problems.',
}

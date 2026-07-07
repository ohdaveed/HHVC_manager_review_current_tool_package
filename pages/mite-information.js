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
      karl: 'Maps to a fourth Title and text block: Title = this heading, Text = the paragraphs below. Resolved schema gap: unstructured steps converted to numbered paragraphs. Also resolved schema gap: converted button to inline link to satisfy block type limits.',
      kind: 'body',
      paragraphs: [
        'Rodent control should not start with poison alone when a rat nest may be feeding tropical rat mites. Property owners and PCOs should address the nest, mites, and rodents together.',
      ],
      bullets: [
        '**1. Find and treat the nest site:** Look for nests in attics, crawl spaces, wall voids, basements, storage areas, and cluttered zones where droppings or rub marks are present. A PCO can treat the nest area for mites using methods appropriate to the site.',
        '**2. Remove nesting material safely:** After mite treatment, remove nesting material using wet cleanup methods. Do not dry-sweep or vacuum rodent nests. Follow safe rodent cleanup steps on the rats and mice prevention page: [Keep rats and mice out of your home](ratsPrevent)',
        '**3. Control rodents without worsening mite bites:** Use traps and exclusion first when possible. If rodenticides are used, do not skip mite treatment at the nest. A PCO should coordinate both steps so mites do not scatter after rats die.',
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
      karl: 'Resolved schema gap: unstructured steps converted to numbered paragraphs. Also resolved schema gap: converted button to inline link.',
      kind: 'body',
      bullets: [
        '**1. Check whether the problem may be bed bugs:** Look for bed bug signs such as live insects, shed skins, dark spots on bedding, or bites in rows. Use the bed bug pages if bed bugs are present or suspected: [Bed bug rules and prevention](bedBugsInfo)',
        '**2. Remove pest sources:** Address rodent nests, bird droppings, or sanitation conditions that may be supporting mites. Do not use rodenticides alone when tropical rat mites may be present — treat the nest first or hire a PCO.',
        '**3. Report active pest or housing-health conditions:** If the problem continues, report the underlying pest or housing-health condition through 311.',
      ],
    },
    {
      heading: 'Related pages',
      karl: 'Maps to the Related field: a generic unrestricted "Page" chooser, repeatable.',
      kind: 'placement',
      cards: [
        {
          title: 'Keep rats and mice out of your home',
          target: 'ratsPrevent',
        },
        {
          title: 'Report rats or mice',
          target: 'ratsReport',
        },
        {
          title: 'Report bed bugs',
          target: 'bedBugsReport',
        },
        {
          title: 'Pigeons and housing health',
          target: 'pigeonInfo',
        },
        {
          title: 'Learn what HHVC can inspect',
          target: 'scopeInfo',
        },
      ],
    },
  ],
  seoTitle: 'Mites and housing health | SF.gov',
  metaDescription:
    'Tropical rat mites, nest treatment before rodenticides, and when to report rodent or housing-health problems.',
}

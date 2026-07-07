window.HHVC_PAGES = window.HHVC_PAGES || {}
window.HHVC_PAGES['raccoonInfo'] = {
  slug: 'sf.gov/information/raccoons-and-housing-health',
  type: 'Information',
  title: 'Raccoons and housing health',
  summary:
    'Learn about raccoon roundworm risks, safe latrine cleanup, and when to report housing concerns.',
  audience: [
    'A tenant or resident dealing with raccoons near a building',
    'A property owner or manager trying to reduce wildlife attractants',
    'A neighbor reporting garbage, animal waste, or entry points caused by raccoon activity',
  ],
  reading: 'Grade 7',
  editorNote:
    'Information page. Wildlife trapping is outside HHVC scope — route injured/trapped animals to Animal Care & Control. Latrine cleanup steps follow CDC Baylisascaris guidance; SME must verify against current CDC/DPH protocols before publication. In Karl: add CDC external link in Information section; do not publish until vector program signs off.',
  sections: [
    {
      heading: 'Why it matters',
      karl: 'Body: Why it matters — raccoon roundworm health-harm framing, placed first to motivate prevention. Verify disease-risk specifics with SFDPH vector program before publication.',
      kind: 'body',
      paragraphs: [
        'Raccoon feces can contain Baylisascaris procyonis, a roundworm that causes a serious illness in people if its eggs are accidentally swallowed. In rare but severe cases, the infection can affect the brain and nervous system, especially in young children who put contaminated soil or objects in their mouths.',
        'Because raccoons often return to the same latrine site again and again, contamination can build up in play areas, gardens, and building surfaces without anyone realizing it — making early identification and safe cleanup essential to preventing exposure.',
      ],
      callout: {
        karl: 'Body note: Key harm takeaway',
        text: "Treat any suspected raccoon latrine as a health hazard right away — don't wait to clean it up, and keep children and pets away until it's handled safely.",
      },
    },
    {
      heading: 'Raccoons and your building',
      karl: 'Body: Raccoon activity and housing health',
      kind: 'body',
      paragraphs: [
        'Raccoons are common in San Francisco. They are attracted to food, water, shelter, and easy access to garbage or compost.',
        'Healthy Housing and Vector Control does not trap or remove wildlife. HHVC may review housing-health conditions that attract raccoons or that raccoons worsen, such as exposed garbage, animal waste, or openings that let pests enter a building.',
      ],
      callout: {
        karl: 'Body note: Scope boundary for wildlife vs. housing conditions',
        text: 'For injured, sick, or trapped wildlife, contact San Francisco Animal Care & Control. For active housing-health nuisances tied to garbage, waste, or pest entry, use the reporting pages on this topic.',
      },
    },
    {
      heading: 'Raccoon roundworm and latrines',
      karl: 'Body: Raccoon roundworm health risk and latrine identification',
      kind: 'body',
      paragraphs: [
        'Raccoons can carry a roundworm called Baylisascaris procyonis. The worm’s eggs are passed in raccoon feces and can make people sick if swallowed. Young children are at higher risk because they may put contaminated soil, wood chips, or objects in their mouths.',
        'Raccoons often leave feces in the same spot again and again. These repeated piles are sometimes called latrines. Latrines may be found on roofs, decks, patios, attics, crawl spaces, sandboxes, woodpiles, or raised surfaces near a building.',
      ],
      callout: {
        karl: 'Body note: Serious health risk warning',
        text: 'Treat raccoon feces and latrine sites as a health hazard. Keep children and pets away from latrines until the area is cleaned or professionally handled.',
      },
    },
    {
      heading: 'How to clean up a raccoon latrine safely',
      karl: 'Body: Link to Step-by-step cleanup guide',
      kind: 'body',
      paragraphs: [
        'Do not sweep or vacuum dry raccoon droppings. Dry dust can spread roundworm eggs into the air.',
        'If you are not trained or equipped to clean a latrine safely, hire a licensed pest control operator or other qualified professional.',
      ],
      cards: [
        {
          title: 'Clean up a raccoon latrine safely',
          text: 'Follow the step-by-step guide for PPE, wet cleanup, disposal, and handwashing.',
          target: 'raccoonLatrineCleanup',
          karl: 'Links: Related Step-by-step page',
        },
        {
          title: 'CDC: Raccoon roundworm (Baylisascaris) prevention',
          text: 'Read CDC guidance on raccoon latrines, roundworm risks, and safe cleanup before handling droppings.',
          url: 'https://www.cdc.gov/parasites/baylisascaris/prevention.html',
          karl: 'Body external link: CDC Baylisascaris prevention reference for SME-verified latrine cleanup',
        },
      ],
    },
    {
      heading: 'Reduce raccoon attractants',
      karl: 'Body: Prevention steps',
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
      karl: 'Body: Reporting guidance',
      kind: 'body',
      paragraphs: [
        'Report through 311 when raccoon activity is tied to a housing-health condition HHVC may inspect, such as persistent garbage, animal waste, or overgrown vegetation that supports pests or vectors.',
      ],
      cards: [
        {
          title: 'Report pigeons',
          text: 'Report pigeon roosting, nesting, droppings, or feeding around a building or shared area.',
          target: 'pigeonsReport',
          karl: 'Body link to related Transaction page',
        },
        {
          title: 'Report garbage or clutter',
          text: 'Report garbage, clutter, or animal waste that may attract pests, vectors, or wildlife.',
          target: 'garbageReport',
          karl: 'Body link to related Transaction page',
        },
        {
          title: 'Report overgrown vegetation',
          text: 'Report overgrown plants or brush that may shelter pests or vectors.',
          target: 'vegetationReport',
          karl: 'Body link to related Transaction page',
        },
        {
          title: 'Report rats or mice',
          text: 'Report rat or mouse activity if raccoons have damaged entry points or waste has attracted rodents.',
          target: 'ratsReport',
          karl: 'Body link to related Transaction page',
        },
      ],
    },
    {
      heading: 'Related pages',
      karl: 'Related section: right-panel linked pages',
      kind: 'placement',
      cards: [
        {
          title: 'Clean up a raccoon latrine safely',
          text: 'Follow the step-by-step cleanup guide.',
          target: 'raccoonLatrineCleanup',
          karl: 'Related section: right-panel linked page',
        },
        {
          title: 'Keep rats and mice out',
          text: 'Learn how to reduce food, water, shelter, and entry points.',
          target: 'ratsPrevent',
          karl: 'Related section: right-panel linked page',
        },
        {
          title: 'Learn what HHVC can inspect',
          text: 'Check whether Environmental Health may review the issue.',
          target: 'scopeInfo',
          karl: 'Related section: right-panel linked page',
        },
      ],
    },
  ],
  contactSection: {
    phone: 'Environmental Health: 415-252-3800',
    email: 'eh@sf.gov',
    karl: 'Contact section: Environmental Health (standardized footer)',
  },
  seoTitle: 'Raccoons and housing health | SF.gov',
  metaDescription:
    'Raccoon roundworm risks, safe latrine cleanup, and when to report housing-health conditions HHVC may review.',
}

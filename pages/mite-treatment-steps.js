window.HHVC_PAGES = window.HHVC_PAGES || {}
window.HHVC_PAGES['miteTreatmentSteps'] = {
  slug: 'sf.gov/treat-mite-sources-before-rodenticides',
  type: 'Step-by-step',
  title: 'Treat mite sources before rodenticides',
  summary: 'Coordinate nest treatment, cleanup, and rodent control to prevent mite bite spikes.',
  intro:
    'Tropical rat mites can scatter after rodenticides kill rats without nest treatment. Follow these steps with a licensed PCO when mites may be present.',
  partOf: {
    title: 'Mites and housing health',
    target: 'miteInfo',
  },
  audience: [
    'A property owner or manager planning rodent control',
    'A building operator responding to bites after rodent activity',
    'A PCO coordinating mites and rodents together',
  ],
  reading: 'Grade 8',
  editorNote:
    'Step-by-step child page split from miteInfo. Do not provide medical diagnosis. Verify PCO sequencing with HHVC SME before publication.',
  sections: [
    {
      heading: 'Treat nests before poison',
      karl: 'Body: Mite treatment before rodenticide use',
      kind: 'body',
      steps: [
        {
          title: 'Find and treat the nest site',
          text: [
            'Look for nests in attics, crawl spaces, wall voids, basements, storage areas, and cluttered zones where droppings or rub marks are present.',
            'A PCO can treat the nest area for mites using methods appropriate to the site.',
          ],
          karl: 'Body step 1: Nest identification and mite treatment',
        },
        {
          title: 'Remove nesting material safely',
          text: [
            'After mite treatment, remove nesting material using wet cleanup methods. Do not dry-sweep or vacuum rodent nests.',
          ],
          cards: [
            {
              title: 'Keep rats and mice out',
              text: 'Learn safe rodent cleanup and exclusion before using poison baits.',
              target: 'ratsPrevent',
              karl: 'Links: Related Information page',
            },
          ],
          karl: 'Body step 2 with link to rodent cleanup guidance',
        },
        {
          title: 'Control rodents without worsening mite bites',
          text: [
            'Use traps and exclusion first when possible.',
            'If rodenticides are used, do not skip mite treatment at the nest. A PCO should coordinate both steps so mites do not scatter after rats die.',
          ],
          karl: 'Body step 3: Integrated rodent and mite control',
        },
      ],
    },
    {
      heading: 'If bites continue',
      karl: 'Body: Follow-up actions',
      kind: 'body',
      steps: [
        {
          title: 'Rule out bed bugs',
          text: [
            'Look for bed bug signs such as live insects, shed skins, or bites in rows before assuming mites.',
          ],
          cards: [
            {
              title: 'Bed bug rules and prevention',
              text: 'Read bed bug prevention and treatment preparation rules.',
              target: 'bedBugsInfo',
              karl: 'Links: Related Information page',
            },
          ],
          karl: 'Body step: Bed bug cross-check',
        },
        {
          title: 'Report active pest conditions',
          text: [
            'If the problem continues, report the underlying pest or housing-health condition through 311.',
          ],
          karl: 'Body step: Reporting threshold',
        },
      ],
    },
    {
      heading: 'Related pages',
      karl: 'Related section: right-panel linked pages',
      kind: 'placement',
      cards: [
        {
          title: 'Mites and housing health',
          text: 'Learn how tropical rat mites link to rodent nests.',
          target: 'miteInfo',
          karl: 'Related section: right-panel linked page',
        },
        {
          title: 'Report rats or mice',
          text: 'Report active rat or mouse activity in housing.',
          target: 'ratsReport',
          karl: 'Related section: right-panel linked page',
        },
      ],
    },
  ],
}

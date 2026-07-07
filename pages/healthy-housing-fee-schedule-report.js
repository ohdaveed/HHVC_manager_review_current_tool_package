window.HHVC_PAGES = window.HHVC_PAGES || {}
window.HHVC_PAGES['feeReport'] = {
  slug: 'sf.gov/healthy-housing-fee-schedule-fy27',
  type: 'Report',
  title: 'Healthy Housing fee schedule FY27',
  summary: 'Certified fee tiers for apartment buildings, hotels, and reinspections.',
  audience: [
    'A property owner verifying invoice amounts',
    'A property manager reviewing program fees and penalties',
    'An HHVC reviewer previewing Report table layout',
  ],
  reading: 'Grade 8',
  topicTag: 'Topic: Pests and housing problems',
  printVersionUrl: 'https://www.sfdph.org/dph/files/EHSdocs/EHBFees/FY27FeeSchedule.pdf',
  editorNote:
    'Report content type preview for fee tier tables. Production should match the certified PDF in feeSchedule Resource Collection. Rates from docs/source/hhvc-policy/2026-07-07-fy27-website-fees.md.',
  sections: [
    {
      heading: 'Apartment building annual fees',
      karl: 'Report body: Apartment tier table',
      kind: 'body',
      paragraphs: ['Rates effective 7/1/26–6/30/27 for buildings with 3 or more rental units.'],
      table: [
        ['Rental units', 'Annual fee'],
        ['3', '$103'],
        ['4–6', '$129'],
        ['7–10', '$174'],
        ['11–15', '$350'],
        ['16–20', '$485'],
        ['21–30', '$688'],
        ['Over 30', '$808'],
      ],
    },
    {
      heading: 'Reinspection hourly rates',
      karl: 'Report body: Reinspection fee table',
      kind: 'body',
      table: [
        ['Role', 'Per hour', 'Each addl. half hour'],
        ['Environmental health inspector', '$256', '$128'],
        ['Environmental health technician', '$234', '$115'],
      ],
    },
    {
      heading: 'Late payment penalties',
      karl: 'Report body: Penalty summary',
      kind: 'body',
      bullets: [
        '$10 after 30 days',
        '$30 after 60 days',
        'Liens may accrue 1.5% monthly interest (Health Code Section 609)',
      ],
    },
    {
      heading: 'Related pages',
      karl: 'Related section: right-panel linked pages',
      kind: 'placement',
      cards: [
        {
          title: 'Healthy Housing fee schedule documents',
          text: 'Download the certified PDF from the Resource Collection.',
          target: 'feeSchedule',
          karl: 'Related section: right-panel linked page',
        },
        {
          title: 'Pay your Healthy Housing fee',
          text: 'Pay or learn about the annual apartment building fee.',
          target: 'payFee',
          karl: 'Related section: right-panel linked page',
        },
      ],
    },
  ],
  seoTitle: 'Healthy Housing fee schedule FY27 report | SF.gov',
  metaDescription:
    'FY27 Healthy Housing apartment fee tiers, reinspection rates, and late penalties in table form.',
}

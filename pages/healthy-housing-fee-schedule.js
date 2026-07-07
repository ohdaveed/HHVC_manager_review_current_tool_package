window.HHVC_PAGES = window.HHVC_PAGES || {}
window.HHVC_PAGES['feeSchedule'] = {
  slug: 'sf.gov/resource/2026/healthy-housing-fee-schedule',
  type: 'Resource collection',
  title: 'Healthy Housing fee schedule FY27',
  summary:
    'Official Environmental Health fee tiers for apartment buildings, hotels, and reinspections.',
  audience: [
    'A property owner paying the annual Healthy Housing fee',
    'A property manager reviewing invoice amounts or late penalties',
    'A tenant representative researching reinspection fee policy',
  ],
  reading: 'Grade 8',
  topicTag: 'Topic: Pests and housing problems',
  editorNote:
    'Document-library Resource Collection for certified fee schedules. Rates effective 7/1/26–6/30/27 per docs/source/hhvc-policy/2026-07-07-fy27-website-fees.md. Link from payFee and ownerHub — do not embed fee tables on Transaction pages.',
  customSection:
    'Fee amounts change when the Controller certifies a new schedule. Always use the amount on your invoice or the current PDF for billing decisions.',
  sections: [
    {
      heading: 'About this collection',
      karl: 'Resource collection body: Introductory text',
      kind: 'body',
      paragraphs: [
        'This library hosts the certified Healthy Housing program fee schedule for apartment buildings, residential hotels, and reinspection hourly rates.',
        'Use the PDF for exact dollar amounts. Transaction pages such as Pay your fee explain how to pay without listing every tier on the page.',
      ],
    },
    {
      heading: 'Documents',
      karl: 'Resource collection body: Documents',
      kind: 'body',
      documents: [
        {
          title: 'DPH Environmental Health Branch fee schedule (FY27)',
          description:
            'Apartment tiers, hotel license fees, reinspection hourly rates, and late penalties.',
          date: 'Effective 7/1/26–6/30/27',
          url: 'https://www.sfdph.org/dph/files/EHSdocs/EHBFees/FY27FeeSchedule.pdf',
          karl: 'Body: Documents — certified FY27 fee schedule PDF (verify live URL)',
        },
        {
          title: 'Health Code Section 609 — Healthy Housing fee authority',
          description: 'Statutory basis for annual fees, late penalties, and lien authority.',
          date: 'Reference',
          url: 'https://www.sfdph.org/dph/files/EHSdocs/EHBFees/HealthCode609.pdf',
          karl: 'Body: Documents — statutory reference (verify URL)',
        },
      ],
      resources: [
        {
          title: 'Healthy Housing fee schedule tables (mockup)',
          text: 'Open the in-mockup Report page with FY27 tier tables for reviewer preview.',
          target: 'feeReport',
          karl: 'Resource collection body: Resources — link to Report preview page',
        },
      ],
    },
    {
      heading: 'Related pages',
      karl: 'Related section: right-panel linked pages',
      kind: 'placement',
      cards: [
        {
          title: 'Pay your Healthy Housing fee',
          text: 'Pay or learn about the annual fee for apartment buildings with 3 or more units.',
          target: 'payFee',
          karl: 'Resource collection item cross-link to Transaction page',
        },
        {
          title: 'Property owner responsibilities',
          text: 'See fees, violation response, and prevention obligations.',
          target: 'ownerHub',
          karl: 'Resource collection item cross-link to owner hub',
        },
        {
          title: 'Respond to a notice of violation',
          text: 'Learn compliance steps and when reinspection fees may apply.',
          target: 'noticeOfViolation',
          karl: 'Resource collection item cross-link to Step-by-step page',
        },
      ],
    },
  ],
  seoTitle: 'Healthy Housing fee schedule FY27 | SF.gov',
  metaDescription:
    'Download the certified FY27 Healthy Housing fee schedule for apartments, hotels, and reinspections.',
}

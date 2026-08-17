window.HHVC_PAGES = window.HHVC_PAGES || {}
window.HHVC_PAGES['tenantNoticeSteps'] = {
  slug: 'sf.gov/step-by-step--tenant-steps-after-notice-of-violation',
  type: 'Transaction',
  title: 'What tenants need to do after a Notice of Violation',
  summary:
    'Learn what to do if a Notice of Violation lists corrective actions for your unit or building.',
  audience: [
    'A tenant with corrective actions listed on a Notice of Violation',
    'A tenant representative helping someone understand their next steps',
  ],
  reading: 'Grade 6',
  editorStatus: 'placeholder',
  editorNote:
    'New page expanding the tenant half of noticeOfViolation\'s shared "Make a plan to correct the conditions" step into dedicated depth, per docs/superpowers/specs/2026-08-11-hhvc-page-gap-additions-design.md. Reuses noticeOfViolation\'s already-verified statements (the notice does not change tenant habitability rights; contact the investigator named on the notice) rather than restating unsourced enforcement-timeline figures, which stay on afterReport. Unit-prep and access-notice specifics below are unconfirmed and flagged unverified.',
  whatToKnow: {
    cost: 'Free',
    thingsToKnow: [
      'Your Notice of Violation lists which actions apply to your unit.',
      'A property owner or manager cannot retaliate against you for reporting a condition.',
    ],
  },
  sections: [
    {
      heading: 'Prepare your unit',
      karl: 'what_to_do. The panel\'s "+" offers two block types, Callout and Section; each step below is one Section. Inside a Section, the Section specifics "+" offers Address, Callout, Document, Email, Button link, Phone number and Text. Mirrors noticeOfViolation\'s numbered-step shape.',
      kind: 'body',
      steps: [
        {
          title: 'Check what applies to you',
          text: [
            'Read your Notice of Violation to see which corrective actions are listed for your unit or a shared area.',
          ],
          karl: 'what_to_do -> Section. Section title: "Check what applies to you". Section specifics: one Text block.',
        },
        {
          title: 'Get your unit ready',
          bullets: [
            {
              text: 'Clear the area that needs treatment or repair so the work can be completed.',
              unverified: true,
              unverifiedReason:
                'What "ready" specifically requires (e.g. removing furniture, bagging belongings) has no tier-1 source. Confirm with HHVC before publication.',
            },
            {
              text: 'Follow any preparation instructions from your property owner, manager, or HHVC.',
              unverified: true,
              unverifiedReason:
                'No tier-1 source confirms who is responsible for issuing unit-prep instructions in every case. Confirm with HHVC before publication.',
            },
          ],
          karl: 'what_to_do -> Section. Section title: "Get your unit ready". Section specifics: one Text block (bulleted list).',
        },
        {
          title: 'Allow access for treatment or inspection',
          text: [
            {
              text: 'Allow properly noticed access to your unit for scheduled treatment, repair work, or a follow-up inspection.',
              unverified: true,
              unverifiedReason:
                'The specific notice period a property owner must give a tenant before entry has no tier-1 source in this design pass. Confirm with HHVC before publication.',
            },
          ],
          karl: 'what_to_do -> Section. Section title: "Allow access for treatment or inspection". Section specifics: one Text block.',
        },
      ],
    },
    {
      heading: 'Know your rights during this process',
      karl: 'Maps to an "Information section" -> Title and text block. Reuses noticeOfViolation\'s already-verified habitability statement rather than restating it as new unverified content.',
      kind: 'body',
      paragraphs: [
        'A Notice of Violation does not change your right to safe and habitable housing.',
      ],
      bullets: ['[Tenant rights when reporting housing conditions](tenantRights)'],
    },
    {
      heading: 'If nothing happens by the deadline',
      karl: "Maps to a Title and text block. Links forward to afterReport's enforcement chain instead of restating its unverified fee/hearing figures, per the design spec's explicit link-forward instruction.",
      kind: 'body',
      paragraphs: [
        'Contact the investigator named on your notice if the property owner or manager has not started the corrective work.',
      ],
      bullets: [
        '[What happens after you report a housing or pest problem](afterReport)',
        '[Fix your Healthy Housing and Vector Control violation](noticeOfViolation)',
      ],
    },
    {
      heading: 'Related pages',
      karl: 'Maps to the Related field: a generic unrestricted "Page" chooser, repeatable.',
      kind: 'placement',
      cards: [
        {
          title: 'Fix your Healthy Housing and Vector Control violation',
          target: 'noticeOfViolation',
        },
        {
          title: 'Tenant rights when reporting housing conditions',
          target: 'tenantRights',
        },
        {
          title: 'What happens after you report a housing or pest problem',
          target: 'afterReport',
        },
      ],
    },
  ],
  seoTitle: 'What tenants need to do after a Notice of Violation | SF.gov',
  metaDescription:
    'Learn what to do as a tenant after a Healthy Housing and Vector Control Notice of Violation.',
}

window.HHVC_PAGES = window.HHVC_PAGES || {}
window.HHVC_PAGES['inspectionPrepInitial'] = {
  slug: 'sf.gov/step-by-step--get-ready-for-a-housing-inspection',
  type: 'Transaction',
  title: 'Get ready for a housing inspection after you report',
  summary:
    'Prepare for a Healthy Housing and Vector Control inspection after you file a 311 report.',
  audience: [
    'A person who filed a 311 report',
    'A tenant or tenant representative waiting for follow-up',
    'An employee who reported a pest or vector concern',
    'A property owner or manager responding to a reported condition',
  ],
  reading: 'Grade 6',
  editorStatus: 'placeholder',
  editorNote:
    'New page giving reviewers the actionable checklist afterReport gestures at but does not contain ("An inspector may contact you" / "An inspection may happen") without turning afterReport itself into a how-to page, per docs/superpowers/specs/2026-08-11-hhvc-page-gap-additions-design.md. Reuses afterReport\'s already-verified no-advance-notice sentence rather than restating it as new unverified content.',
  whatToKnow: {
    cost: 'Free',
    thingsToKnow: [
      'If you gave contact information, an inspector may contact you to ask questions or schedule a visit.',
      'An inspection may happen without advance notice when areas can be accessed.',
    ],
  },
  sections: [
    {
      heading: 'Before the inspector arrives',
      karl: 'what_to_do. The panel\'s "+" offers two block types, Callout and Section; each step below is one Section. Inside a Section, the Section specifics "+" offers Address, Callout, Document, Email, Button link, Phone number and Text. Mirrors noticeOfViolation\'s numbered-step shape.',
      kind: 'body',
      steps: [
        {
          title: 'Clear access to the reported area',
          text: [
            {
              text: 'Clear a path to the area you reported so an inspector can see the condition.',
              unverified: true,
              unverifiedReason:
                'What specifically an inspector needs access to has no tier-1 source. Confirm with HHVC before publication.',
            },
          ],
          karl: 'what_to_do -> Section. Section title: "Clear access to the reported area". Section specifics: one Text block.',
        },
        {
          title: 'Be ready to answer questions or provide access',
          text: [
            'If you gave contact information, an inspector may contact you to ask questions or schedule a visit.',
          ],
          karl: 'what_to_do -> Section. Section title: "Be ready to answer questions or provide access". Section specifics: one Text block. Reuses afterReport\'s already-verified sentence.',
        },
        {
          title: 'Gather anything relevant',
          bullets: [
            {
              text: 'Photos of the condition, dated if possible.',
              unverified: true,
              unverifiedReason:
                'Whether photos help an inspection, and any specific format HHVC prefers, has no tier-1 source. Confirm with HHVC before publication.',
            },
            {
              text: 'Any prior communication with a property owner or manager about the problem.',
              unverified: true,
              unverifiedReason:
                'Whether HHVC uses prior tenant-to-owner communication during an inspection has no tier-1 source. Confirm with HHVC before publication.',
            },
          ],
          karl: 'what_to_do -> Section. Section title: "Gather anything relevant". Section specifics: one Text block (bulleted list).',
        },
      ],
    },
    {
      heading: 'What to expect during the visit',
      karl: "what_to_do. A second run of Section blocks in the same panel — Karl has no separate container per heading, so this mockup section and the one above share one what_to_do stream. Mirrors afterReport's inspection-narrative shape.",
      kind: 'body',
      steps: [
        {
          title: 'An inspector may check the reported area and nearby spaces',
          text: [
            {
              text: 'An inspector may look at the specific condition you reported as well as nearby areas that could be related.',
              unverified: true,
              unverifiedReason:
                'The scope of what an inspector checks beyond the reported condition has no tier-1 source. Confirm with HHVC before publication.',
            },
          ],
          karl: 'what_to_do -> Section. Section title: "An inspector may check the reported area and nearby spaces". Section specifics: one Text block.',
        },
        {
          title: 'You may not get advance notice for every visit',
          text: [
            'If you did not give contact information, an inspection may still happen without notice.',
            'This can happen when areas can be accessed, for example if the report describes an urgent health or safety risk.',
          ],
          karl: 'what_to_do -> Section. Section title: "You may not get advance notice for every visit". Section specifics: one Text block holding both paragraphs. Reuses afterReport\'s already-verified sentence, split into two for sentence length.',
        },
      ],
    },
    {
      heading: 'Related pages',
      karl: 'Maps to the Related field: a generic unrestricted "Page" chooser, repeatable.',
      kind: 'placement',
      cards: [
        {
          title: 'What happens after you report a housing or pest problem',
          target: 'afterReport',
        },
        {
          title: 'Learn what Healthy Housing and Vector Control can inspect',
          target: 'scopeInfo',
        },
        {
          title: 'Tenant rights when reporting housing conditions',
          target: 'tenantRights',
        },
      ],
    },
  ],
  seoTitle: 'Get ready for a housing inspection after you report | SF.gov',
  metaDescription:
    'Prepare for a Healthy Housing and Vector Control inspection after you file a 311 report.',
}

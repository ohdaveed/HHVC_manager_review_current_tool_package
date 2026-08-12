window.HHVC_PAGES = window.HHVC_PAGES || {}
window.HHVC_PAGES['inspectionPrepFollowup'] = {
  slug: 'sf.gov/step-by-step--get-ready-for-a-follow-up-inspection',
  type: 'Transaction',
  title: 'Get ready for a follow-up inspection',
  summary:
    'Prepare for a Healthy Housing and Vector Control follow-up inspection after a Notice of Violation.',
  audience: [
    'A property owner or manager who received a Notice of Violation',
    'A tenant with corrective actions listed on a Notice of Violation',
    'A building operator coordinating repairs, pest treatment, or cleanup',
    'A tenant representative helping someone understand their next steps',
  ],
  reading: 'Grade 6',
  editorStatus: 'placeholder',
  editorNote:
    "New page expanding noticeOfViolation's existing \"Prepare for follow-up inspection\" step (currently two sentences) into a full checklist, per docs/superpowers/specs/2026-08-11-hhvc-page-gap-additions-design.md. Reuses noticeOfViolation's already-verified record-keeping language; links forward to afterReport's enforcement chain rather than restating its unverified fee/hearing figures.",
  whatToKnow: {
    cost: 'Free',
    thingsToKnow: [
      'A follow-up inspection checks whether the conditions on your Notice of Violation were corrected.',
      'If the reinspection finds the conditions were not corrected, HHVC may take further enforcement action.',
    ],
  },
  sections: [
    {
      heading: 'Document your work',
      karl: "Transaction -> Steps -> Step, mirroring noticeOfViolation's numbered-step shape.",
      kind: 'body',
      steps: [
        {
          title: 'Keep records of what you completed',
          text: [
            'Keep records of the work you complete, such as photos, receipts, or pest treatment reports.',
          ],
          karl: 'Transaction -> Steps -> Step. Step type: number. Title: "Keep records of what you completed". Reuses noticeOfViolation\'s existing, already-verified record-keeping sentence.',
        },
        {
          title: 'Make sure the cited conditions are fully corrected',
          text: [
            {
              text: 'Confirm every condition listed on the notice has been addressed, not only the ones that were easiest to fix.',
              unverified: true,
              unverifiedReason:
                'No tier-1 source confirms whether a partial correction can close part of a multi-condition notice. Confirm with HHVC before publication.',
            },
          ],
          karl: 'Transaction -> Steps -> Step. Step type: number. Title: "Make sure the cited conditions are fully corrected".',
        },
      ],
    },
    {
      heading: 'What to expect at the follow-up visit',
      karl: "Transaction -> Steps -> Step, mirroring afterReport's inspection-narrative shape.",
      kind: 'body',
      steps: [
        {
          title: 'An inspector checks the cited conditions',
          text: [
            {
              text: 'An inspector reviews the specific conditions listed on your Notice of Violation to confirm whether they were corrected.',
              unverified: true,
              unverifiedReason:
                "What exactly a follow-up inspection checks beyond the notice's cited conditions has no tier-1 source. Confirm with HHVC before publication.",
            },
          ],
          karl: 'Transaction -> Steps -> Step. Step type: number. Title: "An inspector checks the cited conditions".',
        },
        {
          title: 'If something is still not fixed',
          text: ['HHVC may take further enforcement action, which can include a reinspection fee.'],
          bullets: ['[What happens after you report a housing or pest problem](afterReport)'],
          karl: 'Transaction -> Steps -> Step. Step type: number. Title: "If something is still not fixed". Links forward to afterReport\'s enforcement chain rather than restating its unverified fee/hearing figures — matches the sentence already published, unpilled, in noticeOfViolation\'s own whatToKnow.thingsToKnow.',
        },
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
          title: 'What happens after you report a housing or pest problem',
          target: 'afterReport',
        },
        {
          title: 'Tenant rights when reporting housing conditions',
          target: 'tenantRights',
        },
      ],
    },
  ],
  seoTitle: 'Get ready for a follow-up inspection | SF.gov',
  metaDescription:
    'Prepare for a Healthy Housing and Vector Control follow-up inspection after a Notice of Violation.',
}

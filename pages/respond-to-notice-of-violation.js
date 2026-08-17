window.HHVC_PAGES = window.HHVC_PAGES || {}
window.HHVC_PAGES['noticeOfViolation'] = {
  slug: 'sf.gov/step-by-step--fix-healthy-housing-and-vector-control-violation',
  type: 'Transaction',
  title: 'Fix your Healthy Housing and Vector Control violation',
  summary:
    'Follow your Notice of Violation and work with Healthy Housing and Vector Control to correct a housing or pest problem.',
  audience: [
    'A property owner or manager who received a Notice of Violation',
    'A tenant with corrective actions listed on a Notice of Violation',
    'A building operator coordinating repairs, pest treatment, or cleanup',
    'A tenant representative helping someone understand their next steps',
  ],
  reading: 'Grade 7',
  editorNote:
    'Transaction page modeled on the live Karl Transaction editor: Primary agency, Description, Intro, then repeatable Steps. Each Step has a number/or type, title, optional flag, cost, time, rich-text description, and optional Transaction link. This HHVC page uses sequential numbered steps and deliberately leaves the optional, cost, time, and Transaction-link fields blank. The workflow is supported by the Article 11 Interpretation Guide v1.0 and the Vegetation Overgrowth Notice. Do not add DBI permit, appeal, or abatement-order requirements here without HHVC and legal review; those processes belong to DBI and are not established for this HHVC flow.',
  editorStatus: 'needs-review',
  whatToKnow: {
    cost: 'Free',
    // Reorganized into ~2 named subsections (Karl's own "no more than 2, if
    // you can" guidance) to match how real sf.gov Things to know entries
    // render — each with its own H3, not one joined bullet list. The
    // enforcement-consequence fact that used to be a third bullet here is
    // dropped as a duplicate: Step 5 ("Finish the work or respond to further
    // enforcement") already covers it.
    thingsToKnow: [
      {
        label: 'What your notice covers',
        text: 'Your Notice of Violation lists the specific conditions to correct and the deadline for completing the work.',
      },
      {
        label: 'If you need help or more time',
        text: 'Contact the investigator named on your notice before the deadline if you have questions or need more time.',
      },
    ],
  },
  sections: [
    {
      heading: 'What to do',
      karl: 'Maps to the Transaction editor’s repeatable Steps field, not an Information-section stream. Each mockup step below becomes one Step with type "number", a Title, and a rich-text Step description. Optional, Cost, Time, and Transaction link remain blank unless HHVC supplies case-independent values or a confirmed related Transaction.',
      kind: 'body',
      steps: [
        {
          title: 'Read your Notice of Violation',
          text: [
            'Read the full notice as soon as you receive it. It identifies the conditions that must be corrected and gives a deadline for completing the work.',
            'Check which actions apply to the building, shared areas, or a specific unit. A notice may list actions for an owner, manager, tenant, or more than one responsible party.',
          ],
          karl: 'what_to_do -> Section. Section title: "Read your Notice of Violation". Section specifics: one Text block holding both paragraphs. This is first because the notice controls the scope and deadline for the specific case.',
        },
        {
          title: 'Make a plan to correct the conditions',
          text: ['Complete the actions assigned to you before the deadline on the notice.'],
          bullets: [
            'Owners and managers may need to arrange repairs, pest treatment, garbage removal, or corrections in shared areas.',
            'Tenants may need to clean or prepare a unit for treatment and allow access for scheduled inspections or work.',
            'If professional pest treatment is required, use a licensed pest control operator.',
            'One person finishing their work does not close the violation if other cited conditions remain.',
            'Owners and managers should not wait for tenant actions before starting work they control.',
            'Tenants should follow unit-preparation instructions and allow properly noticed access for treatment or inspection.',
          ],
          karl: 'what_to_do -> Section. Section title: "Make a plan to correct the conditions". Section specifics: one Text block (lead paragraph and six bullets). Responsibilities stay conditional because the notice, rather than this page, assigns the work for each case.',
        },
        {
          title: 'Contact the investigator if you need help',
          text: [
            'Contact the investigator named on the notice if you have questions about the cited conditions, the deadline, or what proof of correction is needed.',
            'Ask before the deadline if you need clarification or more time. Do not assume that work by another person closes the violation.',
          ],
          bullets: [
            'A Notice of Violation does not change a tenant’s right to safe and habitable housing.',
            '[What tenants need to do after a Notice of Violation](tenantNoticeSteps)',
            '[Tenant rights and reporting](tenantRights)',
            '[Property owner responsibilities](ownerHub)',
            '[Integrated pest management for property owners and managers](ownerGuidance)',
          ],
          karl: 'what_to_do -> Section. Section title: "Contact the investigator if you need help". Section specifics: one Text block (the two paragraphs plus the five bullets), whose rich-text Link tool carries the four related HHVC pages as Internal links (a tenantNoticeSteps link added 2026-08-11). The contact direction is supported by the HHVC Vegetation Overgrowth Notice; the language avoids promising an extension.',
        },
        {
          title: 'Prepare for follow-up inspection',
          text: [
            'Keep records of the work you complete, such as photos, receipts, or pest treatment reports.',
            'Be ready for HHVC to check whether the cited conditions were corrected. Follow-up inspection may be needed before the case can close.',
          ],
          bullets: ['[Get ready for a follow-up inspection](inspectionPrepFollowup)'],
          karl: 'what_to_do -> Section. Section title: "Prepare for follow-up inspection". Section specifics: one Text block (the two paragraphs), whose rich-text Link tool carries an Internal link (added 2026-08-11) to the new follow-up-inspection checklist. The Article 11 workflow explicitly includes follow-up inspection after the compliance period; this does not promise a particular inspection date.',
        },
        {
          title: 'Finish the work or respond to further enforcement',
          text: [
            'If the violation is not corrected, HHVC may take additional enforcement action. This can include a reinspection fee when applicable, a citation, or a Director’s Hearing.',
            'Follow the instructions and deadlines in any later notice you receive.',
          ],
          karl: 'what_to_do -> Section. Section title: "Finish the work or respond to further enforcement". Section specifics: one Text block holding both paragraphs. This uses the Article 11 Interpretation Guide’s high-level enforcement workflow only; it intentionally omits unverified fee timing, hearing, appeal, and abatement details.',
        },
      ],
    },
  ],
  // Karl's Partner agencies field (distinct from Primary Agency, which the
  // parent-program link above already represents). No 311 routing here —
  // this is a post-violation compliance page, not an initial report.
  partnerAgencies: [
    {
      title: 'Environmental Health',
      url: 'https://www.sf.gov/departments--department-public-health--environmental-health',
    },
  ],
  seoTitle: 'Fix your Healthy Housing and Vector Control violation | SF.gov',
  metaDescription:
    'Follow a Healthy Housing and Vector Control Notice of Violation to correct housing or pest conditions.',
}

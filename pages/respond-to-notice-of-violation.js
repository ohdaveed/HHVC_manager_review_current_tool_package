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
          karl: 'Transaction -> Steps -> Step. Step type: number. Title: "Read your Notice of Violation". Step description: the two paragraphs. Optional, Cost, Time, and Transaction link: blank. This is first because the notice controls the scope and deadline for the specific case.',
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
          karl: 'Transaction -> Steps -> Step. Step type: number. Title: "Make a plan to correct the conditions". Step description: the lead paragraph and six bullets. Optional, Cost, Time, and Transaction link: blank. Responsibilities stay conditional because the notice, rather than this page, assigns the work for each case.',
        },
        {
          title: 'Contact the investigator if you need help',
          text: [
            'Contact the investigator named on the notice if you have questions about the cited conditions, the deadline, or what proof of correction is needed.',
            'Ask before the deadline if you need clarification or more time. Do not assume that work by another person closes the violation.',
          ],
          bullets: [
            'A Notice of Violation does not change a tenant’s right to safe and habitable housing.',
            '[Tenant rights and reporting](tenantRights)',
            '[Property owner responsibilities](ownerHub)',
            '[Integrated pest management for property owners and managers](ownerGuidance)',
          ],
          karl: 'Transaction -> Steps -> Step. Step type: number. Title: "Contact the investigator if you need help". Step description: the two paragraphs plus the four bullets, including rich-text links to the three related HHVC pages. Optional, Cost, Time, and Transaction link: blank. The contact direction is supported by the HHVC Vegetation Overgrowth Notice; the language avoids promising an extension.',
        },
        {
          title: 'Prepare for follow-up inspection',
          text: [
            'Keep records of the work you complete, such as photos, receipts, or pest treatment reports.',
            'Be ready for HHVC to check whether the cited conditions were corrected. Follow-up inspection may be needed before the case can close.',
          ],
          karl: 'Transaction -> Steps -> Step. Step type: number. Title: "Prepare for follow-up inspection". Step description: the two paragraphs. Optional, Cost, Time, and Transaction link: blank. The Article 11 workflow explicitly includes follow-up inspection after the compliance period; this does not promise a particular inspection date.',
        },
        {
          title: 'Finish the work or respond to further enforcement',
          text: [
            'If the violation is not corrected, HHVC may take additional enforcement action. This can include a reinspection fee when applicable, a citation, or a Director’s Hearing.',
            'Follow the instructions and deadlines in any later notice you receive.',
          ],
          karl: 'Transaction -> Steps -> Step. Step type: number. Title: "Finish the work or respond to further enforcement". Step description: the two paragraphs. Optional, Cost, Time, and Transaction link: blank. This uses the Article 11 Interpretation Guide’s high-level enforcement workflow only; it intentionally omits unverified fee timing, hearing, appeal, and abatement details.',
        },
      ],
    },
  ],
  seoTitle: 'Fix your Healthy Housing and Vector Control violation | SF.gov',
  metaDescription:
    'Follow a Healthy Housing and Vector Control Notice of Violation to correct housing or pest conditions.',
}

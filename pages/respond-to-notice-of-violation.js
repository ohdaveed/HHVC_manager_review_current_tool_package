window.HHVC_PAGES = window.HHVC_PAGES || {}
window.HHVC_PAGES['noticeOfViolation'] = {
  slug: 'sf.gov/information/how-to-respond-to-notice-of-violation',
  type: 'Information',
  title: 'How to respond to a notice of violation',
  summary:
    'Learn what a notice of violation means and what tenants and property owners or managers each need to do to correct cited conditions.',
  audience: [
    'A tenant who received or is affected by a notice of violation',
    'A property owner or manager responsible for building-wide corrections',
    'A building operator coordinating repairs, pest treatment, or cleanup',
    'A tenant representative helping someone understand their responsibilities',
  ],
  reading: 'Grade 6–7',
  editorNote:
    'Information page for tenants and property owners/managers. BLOCKED — confirm NOV templates, tenant-specific orders, appeal windows, and contact routes before publication. The initial notice itself carries no fee — it states which health code violations were observed and what must be abated by the compliance deadline. The first reinspection is also free; a fee applies only starting with the third visit (the second reinspection), per reviewer-supplied sequencing — confirm this sequencing with HHVC before publication (still open). Fee amounts below are now verified against the SFDPH Environmental Health Branch Fee Schedule, "Rates effective 7/1/25-6/30/26," revised 7/3/2025 (docs/source/hhvc-policy/2026-07-06-dph-ehb-fee-schedule-fy25-26.md) — the most recent certified schedule published as of this edit; re-check for a newer certification before publishing. Verify that examples of split responsibilities match current HHVC enforcement practice.',
  editorStatus: 'blocked',
  sections: [
    {
      heading: 'What a notice of violation means',
      karl: 'Maps to an "Information section" → Title and text block: Title = this heading, Text = the two paragraphs below.',
      kind: 'body',
      paragraphs: [
        'A notice of violation (NOV) means Environmental Health found a housing or pest-related health condition that must be corrected.',
        'The notice lists the cited problems, required corrections, responsible parties when known, and a compliance deadline based on the severity of the violation.',
      ],
      callout: {
        karl: 'Maps to its own Callout stream item (a sibling of the Title and text item above, not nested inside it — Information section\'s three block types are top-level stream siblings). Single rich text field only, no separate title field, which this mockup callout already lacks, so no mismatch here. Enforcement escalation — reinspection fee figures verified against the SFDPH EHB Fee Schedule, "Rates effective 7/1/25-6/30/26," revised 7/3/2025 (docs/source/hhvc-policy/2026-07-06-dph-ehb-fee-schedule-fy25-26.md); free-visit sequencing (initial inspection + first reinspection free, fee starts at the third visit) supplied by reviewer — confirm the sequencing with HHVC before publication (fee amounts are now confirmed; sequencing is still open).',
        text: 'The initial notice does not charge a fee — it states which health code violations were observed and what must be abated by the compliance deadline. The first reinspection is also free. If a second reinspection is needed because the violation still is not corrected, a per-hour fee can apply starting with that third visit (SFDPH bills $251/hour for an inspector and $229/hour for a technician, plus a per-half-hour rate beyond the first hour). Payments are due within 30 days, with $10 or $30 late penalties and 1.5% interest added for late payments. Persistent violations can also lead to citations, administrative fines, or a Director’s Hearing. Meet the deadline listed on your notice unless HHVC approves another plan.',
      },
    },
    {
      heading: 'Both tenants and owners may need to take action',
      karl: 'Maps to a second Title and text block: Title = this heading, Text = the two paragraphs plus the bulleted list below (bullets render as a bulleted list inside the same rich text field).',
      kind: 'body',
      paragraphs: [
        'It is common for both a property owner or manager and one or more tenants to receive corrective actions on the same notice, or on related notices for the same building.',
        'Owners are usually responsible for building systems, common areas, and conditions they control. Tenants are usually responsible for conditions inside their unit when those conditions are tied to tenant duties under Article 11, such as keeping the unit reasonably clean and cooperating with inspections and treatment. When both parties have corrective actions, progress depends on everyone completing their part before the compliance deadline.',
      ],
      bullets: [
        'Owner or manager actions may include repairs, pest treatment, garbage removal, or fixing shared-area conditions',
        'Tenant actions may include cleaning, preparing a unit for treatment, removing clutter, or allowing access for inspection',
        'One party finishing their work does not automatically close the notice if the other cited conditions remain',
      ],
    },
    {
      heading: 'If you are a property owner or manager',
      karl: 'Maps to a third Title and text block: Title = this heading, Text = the paragraph plus the bulleted list below. Resolved schema gap: converted inline linked cards to paragraph links.',
      kind: 'body',
      paragraphs: [
        'Read the notice for every condition assigned to the owner, manager, or building.',
      ],
      bullets: [
        'Start repairs, pest treatment, cleaning, or other building corrections right away',
        'Hire a licensed pest control operator when the notice requires professional treatment',
        'Communicate access needs and treatment dates to affected tenants',
        'Document completed work in case Environmental Health requests proof of correction',
        'Contact HHVC using the information on the notice if you need clarification about deadlines or scope',
        '[Property owner responsibilities](ownerHub)',
        '[Integrated pest management for property owners and managers](ownerGuidance)',
      ],
    },
    {
      heading: 'If you are a tenant',
      karl: 'Maps to a fourth Title and text block: Title = this heading, Text = the paragraph plus the bulleted list below. Resolved schema gap: the verified Information form has no confirmed button/CTA block type (button converted to inline link) — folded into this block’s rich text (Internal link → the tenantRights page); flag for Digital Services rather than assuming it.',
      kind: 'body',
      paragraphs: [
        'Tenants have rights to safe and habitable housing. A notice of violation does not mean you lose those rights.',
      ],
      bullets: [
        'If the notice lists tenant corrective actions, you are responsible for completing the parts assigned to your unit unless HHVC or the owner tells you otherwise.',
        '[Tenant rights when reporting housing conditions](tenantRights)',
        'Keep your unit reasonably clean and orderly to help prevent pests from spreading',
        'Prepare for bed bug or pest treatment when required, including laundering, bagging items, or clearing access paths as instructed',
        'Allow scheduled inspections and treatment access when HHVC or the owner gives proper notice',
        'Report new or worsening conditions if the owner does not correct building-wide problems by the deadline',
        'Get tenant help if you are worried about retaliation, eviction, or an unfair share of the work',
      ],
      callout: {
        karl: 'Maps to its own Callout stream item (sibling of the Title and text item above, not nested inside it). Single rich text field, no title — this callout has no title already, so no mismatch.',
        text: 'This page gives general information, not legal advice. Contact the Rent Board or a tenant support organization if you need help with your situation.',
      },
    },
    {
      heading: 'How to work together to fix the violation',
      karl: 'Resolved schema gap: unstructured steps converted to a numbered bulleted list (Title and text block: Title = this heading, Text = the intro paragraph plus the numbered bullets below).',
      kind: 'body',
      paragraphs: [
        'Often, a notice of violation requires cooperation between the owner and the tenant to resolve.',
      ],
      bullets: [
        '1. **Read the full notice**: Check which conditions apply to the building, common areas, and individual units. Note the compliance deadline and any reinspection date.',
        '2. **Confirm who is responsible for each item**: Owners and tenants should compare the notice with the actual conditions in the unit and building. If responsibility is unclear, contact Environmental Health using the information on the notice.',
        '3. **Complete your corrective actions on time**: Owners should not wait for tenant actions before starting building repairs they control. Tenants should complete unit-level actions needed for treatment or reinspection to succeed.',
        '4. **Keep records and prepare for reinspection**: Save photos, receipts, treatment reports, or other proof of completed work when possible. Be ready for HHVC to verify that all cited conditions were corrected.',
      ],
    },
    {
      heading: 'Related pages',
      karl: 'Maps to the Related field: a generic unrestricted "Page" chooser, repeatable.',
      kind: 'placement',
      cards: [
        {
          title: 'What happens after you report',
          target: 'afterReport',
        },
        {
          title: 'Look up residential health code violations',
          target: 'findViolations',
        },
        {
          title: 'Tenant rights when reporting housing conditions',
          target: 'tenantRights',
        },
        {
          title: 'Property owner responsibilities',
          target: 'ownerHub',
        },
        {
          title: 'Bed bug rules and prevention',
          target: 'bedBugsInfo',
        },
      ],
    },
  ],
  seoTitle: 'How to respond to a notice of violation | SF.gov',
  metaDescription:
    'How tenants and owners respond to an Environmental Health notice of violation when both may have corrective actions.',
}

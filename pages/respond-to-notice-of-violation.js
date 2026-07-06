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
      karl: 'Maps to a third Title and text block: Title = this heading, Text = the paragraph plus the bulleted list below. Unresolved schema gap: the 2 linked cards embedded in this section have no confirmed home — the verified Information schema only exposes page links via the page-level Related field (unrestricted "Page" chooser, repeatable, no per-item title/text, and it lives once, typically at the end of the page, rather than inline mid-section). There is no observed block type for an inline linked-card list within a body section. Flag for Digital Services: options might include moving these links into the Related field (losing the per-item description) or embedding them as Link-tool links inside this block\'s rich text (losing the card visual treatment) — neither is confirmed.',
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
      ],
      cards: [
        {
          title: 'Property owner responsibilities',
          text: 'See fees, violation response, and prevention obligations under Article 11.',
          target: 'ownerHub',
          karl: 'Embedded inline link card — no confirmed block type in the Information schema for a card with title/text/target at this position (see section-level karl note above); closest analog is the page-level Related field, which does not support per-item title/text or mid-page placement.',
        },
        {
          title: 'Integrated pest management for property owners and managers',
          text: 'Use prevention, monitoring, and resident outreach to reduce future violations.',
          target: 'ownerGuidance',
          karl: 'Embedded inline link card — no confirmed block type in the Information schema for a card with title/text/target at this position (see section-level karl note above); closest analog is the page-level Related field, which does not support per-item title/text or mid-page placement.',
        },
      ],
    },
    {
      heading: 'If you are a tenant',
      karl: 'Maps to a fourth Title and text block: Title = this heading, Text = the two paragraphs plus the bulleted list below. Real-schema gap: the verified Information form has no confirmed button/CTA block type (only Title and text/Image/Callout were observed) — the "Tenant rights when reporting housing conditions" button has no confirmed home. Note the button target (tenantRights) is itself an Information page, not a Transaction, so the "Part of" field (restricted to Transaction pages) does not apply here — the only plausible fit is a Link-tool link inside this Title and text block\'s rich text (Internal link → the tenantRights page); flag for Digital Services rather than assuming it.',
      kind: 'body',
      paragraphs: [
        'Tenants have rights to safe and habitable housing. A notice of violation does not mean you lose those rights.',
        'If the notice lists tenant corrective actions, you are responsible for completing the parts assigned to your unit unless HHVC or the owner tells you otherwise.',
      ],
      bullets: [
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
      button: 'Tenant rights when reporting housing conditions',
      buttonStyle: 'secondary',
      buttonTarget: 'tenantRights',
    },
    {
      heading: 'Steps everyone should follow',
      karl: "Unresolved schema gap — the verified Information form offers only Title and text / Image / Callout block types; there is no observed sequential/numbered-steps block analogous to Transaction's \"What to do\" Section blocks. This mockup's steps[] shape (4 numbered steps, each with its own title and text) has no confirmed home in Information's schema. Flag for Digital Services: either restructure as a single Title and text block using a numbered list in the rich text (losing the separate step titles as a visual affordance), or confirm whether Information has an unobserved steps/Section-equivalent block type before publication.",
      kind: 'body',
      steps: [
        {
          title: 'Read the full notice',
          text: [
            'Check which conditions apply to the building, common areas, and individual units.',
            'Note the compliance deadline and any reinspection date.',
          ],
          karl: "No confirmed block type for a discrete numbered step in the Information schema (see section-level karl note above) — this step's title and text would have to be flattened into the parent Title and text block's rich text as a numbered list item.",
        },
        {
          title: 'Confirm who is responsible for each item',
          text: [
            'Owners and tenants should compare the notice with the actual conditions in the unit and building.',
            'If responsibility is unclear, contact Environmental Health using the information on the notice.',
          ],
          karl: "No confirmed block type for a discrete numbered step in the Information schema (see section-level karl note above) — this step's title and text would have to be flattened into the parent Title and text block's rich text as a numbered list item.",
        },
        {
          title: 'Complete your corrective actions on time',
          text: [
            'Owners should not wait for tenant actions before starting building repairs they control.',
            'Tenants should complete unit-level actions needed for treatment or reinspection to succeed.',
          ],
          karl: "No confirmed block type for a discrete numbered step in the Information schema (see section-level karl note above) — this step's title and text would have to be flattened into the parent Title and text block's rich text as a numbered list item.",
        },
        {
          title: 'Keep records and prepare for reinspection',
          text: [
            'Save photos, receipts, treatment reports, or other proof of completed work when possible.',
            'Be ready for HHVC to verify that all cited conditions were corrected.',
          ],
          karl: "No confirmed block type for a discrete numbered step in the Information schema (see section-level karl note above) — this step's title and text would have to be flattened into the parent Title and text block's rich text as a numbered list item.",
        },
      ],
    },
    {
      heading: 'Related pages',
      karl: 'Maps to the Related field: a generic unrestricted "Page" chooser, repeatable. Real-schema gap: Related has no custom title/text per item, only a page reference — the descriptions on these 5 cards have no home unless Digital Services adds one.',
      kind: 'placement',
      cards: [
        {
          title: 'What happens after you report',
          text: 'Learn how inspections can lead to a notice of violation and compliance deadlines.',
          target: 'afterReport',
          karl: 'Related field entry — page chooser only; this description text is not supported in the real schema (see section-level karl note above).',
        },
        {
          title: 'Look up residential health code violations',
          text: 'Search violation and inspection history for a building.',
          target: 'findViolations',
          karl: 'Related field entry — page chooser only; this description text is not supported in the real schema (see section-level karl note above).',
        },
        {
          title: 'Tenant rights when reporting housing conditions',
          text: 'Learn about tenant protections and where to get help.',
          target: 'tenantRights',
          karl: 'Related field entry — page chooser only; this description text is not supported in the real schema (see section-level karl note above).',
        },
        {
          title: 'Property owner responsibilities',
          text: 'Return to the owner hub for fees, IPM, and other obligations.',
          target: 'ownerHub',
          karl: 'Related field entry — page chooser only; this description text is not supported in the real schema (see section-level karl note above).',
        },
        {
          title: 'Bed bug rules and prevention',
          text: 'Learn tenant cooperation and treatment preparation rules for bed bugs.',
          target: 'bedBugsInfo',
          karl: 'Related field entry — page chooser only; this description text is not supported in the real schema (see section-level karl note above).',
        },
      ],
    },
  ],
  seoTitle: 'How to respond to a notice of violation | SF.gov',
  metaDescription:
    'How tenants and owners respond to an Environmental Health notice of violation when both may have corrective actions.',
}

window.HHVC_PAGES = window.HHVC_PAGES || {}
window.HHVC_PAGES['afterReport'] = {
  slug: 'sf.gov/information/what-happens-after-you-report-housing-pest-problem',
  type: 'Information',
  title: 'What happens after you report a housing or pest problem',
  summary: 'Learn what may happen after a 311 report is sent to Environmental Health.',
  audience: [
    'A person who filed a 311 report',
    'A tenant or tenant representative waiting for follow-up',
    'An employee who reported a pest or vector concern',
    'A property owner or manager responding to a reported condition',
  ],
  reading: 'Grade 7',
  sections: [
    {
      heading: 'How a report moves through the City',
      karl: 'This section\'s steps[] don\'t match a single "Title and text/Image/Callout" block directly — but since the "Information section" stream field is repeatable, each step below maps to its own separate Title and text block (Title = step title, Text = step paragraph(s)), not one combined block. Note: the mockup\'s numbered "you report / HHVC reviews / inspector contacts / inspection happens" sequence and step-by-step visual styling has no confirmed equivalent in the Information page template — Karl\'s Title and text blocks are plain sequential stream items with no built-in step-numbering, so if that visual sequencing matters, flag it as a separate presentation gap for Digital Services.',
      kind: 'body',
      steps: [
        {
          title: 'You report through 311',
          text: [
            '311 receives the report and sends it to the right City department when possible.',
          ],
          karl: 'Maps to an "Information section" → Title and text block: Title = this step title, Text = the paragraph below (first of four sequential Title and text blocks for this section — see section-level karl note).',
        },
        {
          title: 'Environmental Health reviews the report',
          text: [
            'HHVC may review the complaint if it may involve a housing or pest-related public health concern.',
            'It can take a few days for 311 to route the complaint to Environmental Health and for HHVC to assign it to an inspector. Complaints are processed on weekdays.',
          ],
          karl: 'Maps to a second Title and text block: Title = this step title, Text = the two paragraphs below (weekday processing expectation).',
        },
        {
          title: 'Agency Hand-off (If applicable)',
          text: [
            {
              text: 'If your complaint involves structural water-intrusion (such as leaking roof frames, structural plumbing leaks, or broken water heaters), HHVC will route your concern to our sister agency, the Department of Building Inspection (DBI) under the San Francisco Housing Code (2025).',
              unverified: true,
              unverifiedReason:
                'The "San Francisco Housing Code (2025)" citation has zero tier-1 support (source-of-truth audit 2026-07-06, cross-cutting finding #1) — the DBI routing split looks intentional, but the statutory citation and "(2025)" edition tag trace only to tier-3 NotebookLM material. Source a real Housing Code citation or soften to "may be routed to DBI" before publication.',
            },
            'HHVC focuses strictly on condensation, humidity, and ventilation-related moisture issues.',
          ],
          karl: 'Maps to a Title and text block: Explains routing for structural issues to DBI. FLAG: the Housing Code (2025) citation in the first paragraph is unverified — see the Unverified pill and source-of-truth audit finding #1.',
        },
        {
          title: 'An inspector may contact you',
          text: [
            'If you gave contact information, an inspector may contact you to ask questions or schedule a visit.',
          ],
          karl: 'Maps to a third Title and text block: Title = this step title, Text = the paragraph below.',
        },
        {
          title: 'An inspection may happen',
          text: [
            'If you did not give contact information, an inspection may still happen without notice when areas can be accessed, for example if the report describes an urgent health or safety risk.',
          ],
          karl: 'Maps to a fourth Title and text block: Title = this step title, Text = the paragraph below.',
        },
      ],
    },
    {
      heading: 'How to follow up on your report',
      karl: 'Maps to a fifth Title and text block: Title = this heading, Text = the paragraph plus the bulleted list below. Generic, safe steps only.',
      kind: 'body',
      paragraphs: [
        'You can check on a report you already made. It helps to keep a few details handy.',
      ],
      bullets: [
        'Keep your 311 service request number if you have one.',
        'Note the date you made the report.',
        'Contact 311 to ask about the status of your request.',
        'Tell 311 if the problem gets worse or becomes urgent.',
      ],
    },
    {
      heading: 'Tenant rights and retaliation',
      karl: 'Paragraphs map to a sixth Title and text block (Title = this heading, Text = the two paragraphs). Resolved schema gap: the verified Information form has no confirmed button/CTA block type (button converted to inline link) — folded into this block’s rich text (Internal link → tenantRights) — flag this gap for Digital Services rather than assuming a dedicated button block exists.',
      kind: 'body',
      paragraphs: [
        "Tenants have rights when they ask for repairs or report housing conditions to the City. Reporter identities are only shared with the City Attorney's Office and are not shared in response to public records requests.",
        'A property owner or manager cannot retaliate because a tenant reports a housing condition to 311 or a health department.',
      ],
      bullets: ['[Tenant rights and reporting](tenantRights)'],
    },
    {
      heading: 'If a problem is found',
      karl: 'Maps to a seventh Title and text block: Title = this heading, Text = the paragraph plus the bulleted list below. Reinspection rate bullet ($256/hour inspector, $234/hour technician) verified against the SFDPH Environmental Health Branch Fee Schedule, "Rates effective 7/1/26-6/30/27" (docs/source/hhvc-policy/2026-07-06-dph-ehb-fee-schedule-fy26-27.md), the current fiscal year\'s certified schedule -- these are the correct current rates, not a fabricated NotebookLM figure (an earlier same-day FY25-26 export had mistakenly flagged them as unsourced before the FY26-27 schedule was obtained). Enforcement workflow updated from the Article 11 Interpretation Guide v1.0. FLAG: four bullets in this section carry Unverified pills per the 2026-07-06 source-of-truth audit — the sewage 48-72h window, the generic 30-day correction window, the "compounded monthly" interest wording, and the Director\'s Hearing / attorneys\'-fees enforcement chain all lack tier-1 support and need SME/legal confirmation before any of this section is entered into Karl.',
      kind: 'body',
      paragraphs: [
        'If an inspection identifies a violation, Environmental Health will issue a Notice of Violation (NOV) to the responsible parties. The NOV will outline required corrections and set a specific compliance deadline based on severity.',
      ],
      bullets: [
        "**Complaint → Inspection → Notice of Violation → Compliance period → Follow-up inspection → Reinspection fee → Citation or Director's Hearing if unresolved.**",
        {
          text: 'Sewage Backups (48 to 72 hours): Raw sewage backups require immediate correction and do not receive the standard 30-day compliance window.',
          unverified: true,
          unverifiedReason:
            'No tier-1 doc mentions sewage backups or a 48-to-72-hour window (source-of-truth audit 2026-07-06 — High). Traces only to tier-3 chapter drafts and NotebookLM material. Confirm with HHVC/legal before publication.',
        },
        {
          text: 'All Other Violations (30 days): Overgrown vegetation, trash piles, rodent harborages, general sanitation problems, minor gaps/cracks, mold remediation, and other cited conditions must be corrected within 30 days.',
          unverified: true,
          unverifiedReason:
            'No tier-1 doc establishes a generic 30-day correction window (source-of-truth audit 2026-07-06 — Medium-high); the only tier-1 "30 days" figures govern the fee late-payment deadline, a different thing. Traces to tier-3 material that itself cites SF Building Code, not Health Code Article 11. Confirm with HHVC/legal before publication.',
        },
        'These timelines represent general enforcement standards. Actual correction deadlines are established on the official Notice of Violation based on the severity of the health hazard.',
        'Extensions: HHVC may offer an extension to the compliance deadline if the property owner contacts the inspector before the deadline.',
        'Bed Bug Treatment: A property owner or manager must initiate professional treatment within 2 working days of confirmation.',
        {
          text: 'If a property owner does not correct the problem by the deadline, HHVC may charge reinspection fees ($256/hour for inspectors and $234/hour for technicians). Invoices must be paid within 30 days. Unpaid bills will incur $10 or $30 late penalties and 1.5% compounded monthly interest.',
          unverified: true,
          unverifiedReason:
            'The fee rates themselves are verified against the FY26-27 EHB fee schedule, but "1.5% compounded monthly interest" is not: tier-1 says interest "accrues at 1.5% per month," not compounded, and the parallel sentence on the notice-of-violation page says "1.5% interest" with no compounding (source-of-truth audit 2026-07-06 — Medium). Align the interest wording with the source before publication.',
        },
        {
          text: "Persistent violations can result in citations, civil liabilities, or a Director's Hearing to recover attorneys' fees and administrative abatement costs.",
          unverified: true,
          unverifiedReason:
            "No tier-1 corroboration for this enforcement mechanism — the Director's Hearing / attorneys' fees / administrative abatement chain traces only to tier-3 material (source-of-truth audit 2026-07-06 — High). Confirm with HHVC/legal before publication.",
        },
      ],
    },
    {
      heading: 'What this page does not promise',
      karl: 'Maps to an eighth Title and text block: Title = this heading, Text = the bulleted list below (no paragraphs precede it here).',
      kind: 'body',
      bullets: [
        'HHVC cannot promise an exact time or date when an inspector will call you or arrive at your building.',
        'We cannot promise a specific inspection finding or guarantee that a Notice of Violation will be issued.',
        'It does not replace a notice, citation, or legal document.',
        'Complaints are not assigned instantly. 311 routing and HHVC inspector assignment can take a few days and are processed on weekdays.',
      ],
    },
    {
      heading: 'Related pages',
      karl: 'Maps to the Related field: a generic unrestricted "Page" chooser, repeatable.',
      kind: 'placement',
      cards: [
        {
          title: 'How to respond to a notice of violation',
          target: 'noticeOfViolation',
        },
        {
          title: 'Learn what HHVC can inspect',
          target: 'scopeInfo',
        },
        {
          title: 'Tenant rights and reporting',
          target: 'tenantRights',
        },
      ],
    },
  ],
  seoTitle: 'What happens after you report | SF.gov',
  metaDescription:
    'Learn what may happen after a 311 report about a housing or pest problem is sent to Environmental Health.',
}

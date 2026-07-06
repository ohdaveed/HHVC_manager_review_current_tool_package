window.HHVC_PAGES = window.HHVC_PAGES || {}
window.HHVC_PAGES['payFee'] = {
  slug: 'sf.gov/pay-your-annual-healthy-housing-fee-apartment-buildings',
  type: 'Transaction',
  title: 'Pay your annual Healthy Housing fee for apartment buildings',
  summary:
    'Pay or learn about the annual Healthy Housing program fee for San Francisco apartment buildings with 3 or more rental units.',
  audience: [
    'People who own a residential building in San Francisco',
    'Property managers and billing contacts helping an owner pay or understand the fee',
  ],
  reading: 'Grade 6 to 8',
  sections: [
    {
      heading: 'Before you pay',
      karl: 'Best real-schema fit: a things_to_know entry (Title = this heading, Text = the two paragraphs plus the bulleted list below).',
      kind: 'body',
      paragraphs: [
        'Have your invoice, property address, or account information ready before you start.',
        'Use the payment method listed on your annual invoice when one is provided.',
      ],
      bullets: [
        'Your invoice or account information, if you received one',
        'The property address',
        'The name and contact information for the billing contact',
        'The payment method allowed on your invoice',
      ],
    },
    {
      heading: 'Who may need to pay',
      karl: 'Best real-schema fit: a second things_to_know entry (Title = this heading, Text = the bulleted list below). Table removed — Transaction pages do not support a table block in Karl (only Report does; see docs/karl-help-center-research-2026-07-06.md item 2), so the fee tiers are listed as bullets instead. Amounts verified against the SFDPH Environmental Health Branch Fee Schedule, "Rates effective 7/1/25-6/30/26," revised 7/3/2025 (docs/source/hhvc-policy/2026-07-06-dph-ehb-fee-schedule-fy25-26.md) — the most recent certified schedule published as of this edit. Re-verify against a newer certification before publishing if one has since been issued.',
      kind: 'body',
      bullets: [
        'You need to pay this fee if you own an apartment building with 3 or more rental units.',
        'If fewer than 3 units are rented during the billing year, you do not need to pay the fee.',
        'The number of rental units determines your fee. Current certified rates (effective through June 30, 2026):',
        '3 units: $101',
        '4-6 units: $127',
        '7-10 units: $171',
        '11-15 units: $343',
        '16-20 units: $475',
        '21-30 units: $673',
        'Over 30 units: $791',
        'See the full fee schedule, including reinspection hourly rates, in the property owner resource collection.',
      ],
      paragraphs: [
        'Reinspections are billed hourly (Sec. 609 cost recovery): $251/hour for an Environmental Health Inspector ($125 per additional half hour) and $229/hour for an Environmental Health Technician ($113 per additional half hour).',
      ],
    },
    {
      heading: 'Pay your fee',
      karl: 'what_to_do -> Section. Section title: "Pay your fee". Section specifics: Text block (this paragraph) + Button link block — target still pending a confirmed SF.gov online payment URL, so the CTA is non-functional until added. Separately: this page\'s fee tiers are listed in the "Who may need to pay" section above rather than the dedicated `cost` panel (radio Free/Flat fee/Range/Minimum and up/None + a 120-char-capped Cost description), since the cost radio has no "varies by unit count, see the fee schedule" option. Flag for Digital Services which radio option (likely Range or Minimum and up) best represents that.',
      kind: 'body',
      paragraphs: [
        'Pay online, in person at City Hall Room 1401, or by mail using the instructions on your invoice.',
      ],
      button: 'Pay your Healthy Housing fee',
    },
    {
      heading: 'If you need help',
      karl: 'Best real-schema fit: get_help panel\'s Phone number block (Owner = "Environmental Health" or left blank, Phone number = "415-252-3800"). This mockup embeds the phone number in prose rather than a structured field — recommend extracting it to the real Phone number fields rather than keeping it as free text.',
      kind: 'body',
      paragraphs: [
        'Use the contact information on your invoice or call Environmental Health at 415-252-3800.',
      ],
    },
    {
      heading: 'Questions about your fee and late payments',
      karl: 'Best real-schema fit: a second get_help entry — "Additional info" block (Title = this heading, Text = the bulleted list below). Updated per Master Guidelines Chapter 8.3 to include penalties.',
      kind: 'body',
      bullets: [
        'If you are not sure whether the fee applies to your building, use the contact information on your invoice or call Environmental Health at 415-252-3800.',
        'Keep your invoice or account information in case you need to ask a question or confirm a payment.',
        'Invoice payments are due within 30 days. Late payments trigger a standard penalty progression: a $10 late penalty applies for payments up to 30 days overdue, and a $30 late penalty applies for payments up to 60 days overdue.',
        'For continued non-payment, a special assessment property lien is recorded, and interest accrues at a rate of 1.5% per month (compounded monthly) until the balance is paid in full.',
      ],
    },
    {
      heading: 'Related pages',
      karl: 'Maps to the related panel: repeatable field "Page *" with a "Choose a page" button. Real-schema gap: related has no custom title/text per item, only a page reference — the descriptions on these 4 cards have no home unless Digital Services adds one.',
      kind: 'placement',
      cards: [
        {
          title: 'Learn what Healthy Housing and Vector Control can inspect',
          text: 'Check whether Environmental Health may review a pest, vector, or housing health condition.',
          target: 'scopeInfo',
          karl: 'related panel entry — page chooser only; this description text is not supported in the real schema (see section-level karl note above).',
        },
        {
          title: 'What happens after you report a housing or pest problem',
          text: 'Learn how reports are reviewed, assigned on weekdays, and when an inspector may contact you.',
          target: 'afterReport',
          karl: 'related panel entry — page chooser only; this description text is not supported in the real schema (see section-level karl note above).',
        },
        {
          title: 'Pests and housing problems',
          text: 'Return to the main Topic page for HHVC pest, vector, and housing health issues.',
          target: 'pestsTopic',
          karl: 'related panel entry — page chooser only; this description text is not supported in the real schema (see section-level karl note above).',
        },
        {
          title: 'Integrated pest management for property owners and managers',
          text: 'Use prevention, monitoring, and resident outreach. UC IPM is the primary source for templates and checklists.',
          target: 'ownerGuidance',
          karl: 'related panel entry — page chooser only; this description text is not supported in the real schema (see section-level karl note above).',
        },
        {
          title: 'Property owner responsibilities',
          text: 'Find the full fee schedule PDF, reinspection rates, and other owner resources.',
          target: 'ownerHub',
          karl: 'related panel entry — page chooser only; this description text is not supported in the real schema (see section-level karl note above). Links to the Resource Collection page hosting the fee schedule document.',
        },
      ],
    },
  ],
  seoTitle: 'Pay your Healthy Housing fee | SF.gov',
  metaDescription:
    'Pay or learn about the Healthy Housing fee for San Francisco apartment buildings with 3 or more rental units.',
}

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
      karl: 'Best real-schema fit: a second things_to_know entry (Title = this heading, Text = the bulleted list below). Table removed — Transaction pages do not support a table block in Karl (only Report does; see docs/karl-help-center-research-2026-07-06.md item 2), so the fee tiers are listed as bullets instead. Amounts verified against the SFDPH Environmental Health Branch Fee Schedule, "Rates effective 7/1/26-6/30/27" (docs/source/hhvc-policy/2026-07-06-dph-ehb-fee-schedule-fy26-27.md) — the current fiscal year\'s certified schedule. Re-verify against a newer certification before publishing if one has since been issued.',
      kind: 'body',
      bullets: [
        'You need to pay this fee if you own an apartment building with 3 or more rental units.',
        'If fewer than 3 units are rented during the billing year, you do not need to pay the fee.',
        'The number of rental units determines your fee. Current certified rates (effective 7/1/26-6/30/27):',
        '3 units: $103',
        '4-6 units: $129',
        '7-10 units: $174',
        '11-15 units: $350',
        '16-20 units: $485',
        '21-30 units: $688',
        'Over 30 units: $808',
        'See the full fee schedule, including reinspection hourly rates, in the property owner resource collection.',
      ],
      paragraphs: [
        'Reinspections are billed hourly (Sec. 609 cost recovery): $256/hour for an Environmental Health Inspector ($128 per additional half hour) and $234/hour for an Environmental Health Technician ($115 per additional half hour).',
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
      karl: 'Best real-schema fit: a second get_help entry — "Additional info" block (Title = this heading, Text = the bulleted list below). Late-payment penalty and lien-interest figures verified against San Francisco Health Code Sec. 609(d)-(e) (docs/source/hhvc-policy/2026-07-02-health-code-sec-609-healthy-housing-fee.md) -- corrected from a prior karl note that miscited an AI-drafted "Master Guidelines Chapter 8.3," which does not exist as a numbered section in either notebooklm source doc and does not cover fee penalties in the latter.',
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
      karl: 'Maps to the related panel: repeatable field "Page *" with a "Choose a page" button. Resolved schema gap: related has no custom title/text per item.',
      kind: 'placement',
      cards: [
        {
          title: 'Learn what Healthy Housing and Vector Control can inspect',
          target: 'scopeInfo',
          karl: 'related panel entry — page chooser only; this description text is not supported in the real schema (see section-level karl note above).',
        },
        {
          title: 'What happens after you report a housing or pest problem',
          target: 'afterReport',
          karl: 'related panel entry — page chooser only; this description text is not supported in the real schema (see section-level karl note above).',
        },
        {
          title: 'Pests and housing problems',
          target: 'pestsTopic',
          karl: 'related panel entry — page chooser only; this description text is not supported in the real schema (see section-level karl note above).',
        },
        {
          title: 'Integrated pest management for property owners and managers',
          target: 'ownerGuidance',
          karl: 'related panel entry — page chooser only; this description text is not supported in the real schema (see section-level karl note above).',
        },
        {
          title: 'Property owner responsibilities',
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

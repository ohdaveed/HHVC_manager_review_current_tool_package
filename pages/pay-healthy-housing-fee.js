window.HHVC_PAGES = window.HHVC_PAGES || {}
window.HHVC_PAGES['payFee'] = {
  slug: 'sf.gov/pay-your-annual-healthy-housing-fee-apartment-buildings',
  type: 'Transaction',
  title: 'Pay your annual Healthy Housing fee for apartment buildings',
  summary:
    'Pay your annual Healthy Housing fee if you own an apartment building with 3 or more rental units.',
  audience: [
    'A property owner responsible for an apartment building',
    'A property manager or billing contact paying or reviewing an invoice',
  ],
  reading: 'Grade 7',
  karlGuide: {
    path: 'Content → What to Do → Section → Section specifics',
    panel: 'What to Do',
    block: 'Section',
    field: 'Section specifics',
    rawField: 'what_to_do',
    linkShape: 'button-link',
    steps: [
      'Open Karl admin → Pages → Add child page → Transaction.',
      'Open Content → What to Do and add a Section for each visible step.',
      'Enter the visible step title, place copy in Section specifics → Text, and add Button link only where the visible action is supported.',
    ],
    evidence: 'E1',
    status: 'confirmed',
  },
  editorNote:
    'Transaction redesign based on the live FY 2026-27 payment page and fee schedule. It puts the payment action first, then separates eligibility, annual fee tiers, invoice corrections, and late-payment consequences. The annual apartment-building fee and a reinspection fee are distinct charges; do not present reinspection rates as part of the annual bill.',
  whatToKnow: {
    cost: 'Annual fee based on rental unit count — $103 (3 units) up to $808 (more than 30 units). Check your invoice for the exact amount.',
    // Reorganized into ~2 named subsections (Karl's own "no more than 2, if
    // you can" guidance) to match how real sf.gov Things to know entries
    // render — each with its own H3, not one joined bullet list. The
    // late-penalty fact that used to be a third bullet here is dropped as a
    // duplicate: Step 5 ("Pay by the due date or contact us") already states
    // it, and none of these dollar figures are touched/reworded.
    thingsToKnow: [
      {
        label: 'Who must pay',
        text: 'You must pay if you own an apartment building with 3 or more rental units, even if you also live there.',
      },
      {
        label: 'Annual fee vs. reinspection fees',
        text: 'The annual fee is separate from reinspection fees, which only apply if an inspection finds an uncorrected violation.',
      },
    ],
  },
  sections: [
    {
      heading: 'What to do',
      karl: 'Maps to the Transaction editor’s repeatable Steps field. Each mockup step becomes one Step with type "number", a Title, and a rich-text Step description. Optional, Cost, Time, and Transaction link remain blank unless Environmental Health supplies a case-independent value. The confirmed external payment URL is carried by the mockup button; confirm the production Transaction editor’s external-link treatment before publishing.',
      kind: 'body',
      steps: [
        {
          title: 'Check your invoice and whether the fee applies',
          text: [
            'Environmental Health mails an invoice each year. Check the property address, the number of rental units, the amount due, and the due date.',
            'You need to pay if you own an apartment building with 3 or more rental units during the billing year.',
          ],
          bullets: [
            'If you own and live in the building, count the rental units. If you rent 3 or more units, you still need to pay.',
            'If you rent fewer than 3 units, complete, sign, and return the certification on your invoice.',
            'Vacant units and units occupied by relatives still count as rental units.',
            'Condominium, commercial, and tenancy-in-common buildings do not pay this fee. Send the proof requested on your invoice.',
          ],
          karl: 'what_to_do -> Section. Section title: "Check your invoice and whether the fee applies". Section specifics: one Text block (two paragraphs plus four bullets). Leads with the decision that prevents an owner from starting a payment before knowing whether the annual program fee applies.',
        },
        {
          title: 'Confirm your annual fee',
          text: [
            'Your annual fee is based on the number of rental units. Check your invoice for the exact amount and due date.',
          ],
          bullets: [
            '3 units: $103',
            '4-6 units: $129',
            {
              text: '7-10 units: $175',
              unverified: true,
              unverifiedReason:
                "DPH-EHB's own posted fee worksheet (docs/source/hhvc-policy/2026-07-06-dph-ehb-fee-schedule-fy26-27.pdf / 2026-07-07-fy27-website-fees.pdf, same file exported twice) states $174 for this tier. A Controller's Office FY26-27 fee-adjustment table (docs/source/hhvc-policy/2026-08-07-controllers-office-fy26-27-fee-adjustment-healthy-housing.png) shows unrounded $174.50 rounding to $175, consistent with the same-series FY25-26 Controller certification this repo already trusts. $175 is kept here as the better-supported figure, but confirm with HHVC/DPH-EHB before publication — the worksheet PDF may simply not yet reflect this cycle's Controller adjustment.",
            },
            '11-15 units: $350',
            '16-20 units: $485',
            '21-30 units: $688',
            'More than 30 units: $808',
          ],
          callout: {
            title: 'Annual fee and reinspection fees are different',
            text: 'The annual fee supports Healthy Housing inspections. If an inspection finds an uncorrected violation, a separate reinspection fee may apply: $256 per hour for an Environmental Health Inspector or $234 per hour for an Environmental Health Technician. Additional half-hours cost $128 and $115.',
            karl: 'Callout inside the Transaction Step rich-text description. Keep the reinspection rates separate from the annual tier list so a reviewer does not mistake a potential enforcement cost for the amount due on the annual invoice. Rates are from the FY 2026-27 Environmental Health Branch fee schedule.',
          },
          karl: 'what_to_do -> Section. Section title: "Confirm your annual fee". Section specifics: one Text block (intro plus seven fee-tier bullets) + one Callout block. The Callout is a single rich text field with no separate title field like this mockup callout has, so fold "Annual fee and reinspection fees are different" in as a bolded lead-in within the callout text, or flag for Digital Services if a distinct heading is required. The tier rates are from the FY 2026-27 Environmental Health Branch fee schedule; recheck against a newly certified schedule before publication.',
        },
        {
          title: 'Pay online, in person, or by mail',
          text: [
            'Pay online with your invoice information, or use the payment instructions on your invoice.',
          ],
          bullets: [
            'In person: pay by check, cash, or money order at City Hall, Room 140, 1 Dr. Carlton B. Goodlett Place.',
            'By mail: make a check or money order payable to "Department of Public Health." Write your invoice number on it and mail it to P.O. Box 7429, San Francisco, CA 94120.',
          ],
          button: 'Pay your fee online',
          buttonUrl: 'https://services.paysf.co/service/healthy-housing-fee',
          karl: 'what_to_do -> Section. Section title: "Pay online, in person, or by mail". Section specifics: one Text block (intro plus two payment-method bullets) + one Button link block set to External URL, pointing at the live PaySF Healthy Housing fee service. Link text shortened from "Pay your Healthy Housing fee online" (35 characters) to follow the SF.gov button-text guidance of 25 characters and its verb-first button library. That 25 is editorial rather than schema: the live Button link field carries maxlength 255 (measured 2026-08-15), so a longer label would save — it would just read poorly and contradict published guidance. Payment is the primary action, so it follows eligibility and amount confirmation without burying the live payment route.',
        },
        {
          title: 'Correct an invoice or update your information',
          text: [
            'Contact Environmental Health before you pay if the property address, mailing address, owner, building type, or number of rental units on your invoice is wrong.',
          ],
          bullets: [
            'For a unit-count correction, tell us the correct number of rental units and pay the fee for that number.',
            'If the count is wrong because you live in a unit, include a copy of your most recent PG&E bill.',
            'For an ownership change, provide the escrow date and the new owner’s name and mailing address.',
            'For a mailing-address change, include the property address and block and lot number, or the invoice number.',
            'Email healthyhousing@sfdph.org or call 415-252-3800. Also report ownership changes to the Assessor-Recorder’s Office.',
          ],
          karl: 'what_to_do -> Section. Section title: "Correct an invoice or update your information". Section specifics: one Text block (one intro paragraph and five bullets). Consolidates the live page’s scattered owner-occupied, unit-count, building-type, ownership, and mailing-address exceptions into one correction path.',
        },
        {
          title: 'Pay by the due date or contact us',
          text: [
            'Pay within 30 days of the invoice due date. Keep your invoice number or property address if you need help with your account.',
          ],
          bullets: [
            'A $10 late penalty applies after 30 days.',
            'A $30 late penalty applies after 60 days.',
            'Unpaid balances may accrue 1.5% interest per month and may become a property lien.',
          ],
          callout: {
            title: 'What the annual fee supports',
            text: 'Healthy Housing uses these fees to support inspections of apartment buildings. Inspectors look at common areas, yards, garbage storage areas, and lobbies for conditions that may support pests or create housing health hazards.',
            karl: 'Callout inside the Transaction Step rich-text description. This is the live page’s program-context copy, moved to the end so it explains the fee without delaying the payment decision.',
          },
          karl: 'what_to_do -> Section. Section title: "Pay by the due date or contact us". Section specifics: one Text block (intro plus late-payment bullets) + one Callout block. Same title gap as the fee-tier callout above: fold "What the annual fee supports" in as a bolded lead-in, or flag for Digital Services. Penalty timing is presented after the normal payment path rather than competing with it at the top of the page.',
        },
      ],
    },
    {
      heading: 'Related pages',
      karl: 'Maps to the related panel: repeatable "Page" chooser entries. Related pages give owners a next step without reprinting compliance or enforcement guidance on this payment Transaction.',
      kind: 'placement',
      cards: [
        {
          title: 'Property owner responsibilities',
          target: 'ownerHub',
          karl: 'Related panel page chooser entry.',
        },
        {
          title: 'Fix your Healthy Housing and Vector Control violation',
          target: 'noticeOfViolation',
          karl: 'Related panel page chooser entry. This is the appropriate route for a Notice of Violation, not the annual-fee payment path.',
        },
        {
          title: 'Look up building records',
          target: 'recordsHub',
          karl: 'Related panel page chooser entry.',
        },
        {
          title: 'Healthy housing and pest resources',
          target: 'verminResources',
          karl: 'Related panel page chooser entry.',
        },
      ],
    },
  ],
  // Karl's Partner agencies field (distinct from Primary Agency, which the
  // parent-program link above already represents) — Environmental Health
  // issues the invoice this page's payment action settles.
  partnerAgencies: [
    {
      title: 'Environmental Health',
      url: 'https://www.sf.gov/departments--department-public-health--environmental-health',
    },
  ],
  seoTitle: 'Pay your Healthy Housing fee | SF.gov',
  metaDescription:
    'Pay your annual Healthy Housing fee for a San Francisco apartment building with 3 or more rental units.',
}

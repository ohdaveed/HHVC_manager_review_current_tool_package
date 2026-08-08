window.HHVC_PAGES = window.HHVC_PAGES || {}
window.HHVC_PAGES['article11Compliance'] = {
  slug: 'sf.gov/information--article-11-compliance-for-property-owners',
  type: 'Information',
  title: 'Article 11 compliance for property owners',
  summary:
    'A compliance-first front door for Health Code Article 11: what owners and managers must do, the fee, and who to call — modeled on the SF.gov minimum wage ordinance page.',
  audience: [
    'A property owner responsible for a residential building with 3 or more units',
    'A property manager or building operator handling compliance',
    'A tenant or advocate who wants the short version of owner requirements',
  ],
  reading: 'Grade 7',
  editorNote:
    'Information page modeled on the SF.gov minimum wage ordinance pattern (sf.gov/information--minimum-wage-ordinance): a short compliance-first front door, not a replacement for the deep-dive `article11Guide` Report page it links out to. Every fact here (fee tiers, 72-hour window, 2-year records, PCO licensing, pesticide notice, training) is pulled from `article11Guide` and `payFee`, not re-derived — see each section\'s karl note for which source page to cross-check. Two open questions carried from the design spec, not blocking: (1) whether Karl\'s Information content type has a distinct checklist/callout-with-list block, or whether the bulleted list used below (see "What Article 11 requires" section) is the closest real-schema fit; (2) the same `cost` panel radio-option gap already flagged on `payFee` — no "varies by unit count" option, so Range or Minimum-and-up is Digital Services\' call.',
  editorStatus: 'needs-review',
  topicTag: 'Agency: Healthy Housing and Vector Control',
  whatToKnow: {
    cost: 'Annual fee for buildings with 3 or more rental units — current certified rates range $103–$808+ depending on unit count',
    thingsToKnow: [
      'See the full fee schedule for exact tier amounts and reinspection rates.',
      'This page summarizes requirements — see the full Article 11 guide for the complete section-by-section mapping.',
    ],
  },
  contact: {
    phone: ['311 (call or text)', '415-252-3805'],
    email: ['ehb@sfdph.org'],
    other: ['Environmental Health — Healthy Housing and Vector Control'],
  },
  sections: [
    {
      heading: 'What Article 11 requires',
      karl: 'Maps to an "Information section" → Title and text block: Title = this heading, Text = the opening paragraph plus the six-item bulleted list below (bullets render inside the same rich text field). The list is the page\'s front-loaded "Quick compliance checklist," mirroring the wage-ordinance page\'s prominent dollar figure — it is rendered as a bulleted list rather than a separate Callout because Callout is a single rich-text field with no verified list support (see the page-level editorNote\'s open question #1). Flag for Digital Services if a distinct checklist block exists in the real schema.',
      kind: 'body',
      paragraphs: [
        'Property owners and managers must keep buildings free of public health nuisances under San Francisco Health Code Article 11 — including pests, garbage, mold, and rodent problems.',
      ],
      bullets: [
        'Pay your annual Healthy Housing fee if your building has 3 or more rental units',
        'Investigate tenant pest reports within 72 hours',
        'Hire a licensed pest control operator (PCO) for treatment — never unlicensed staff',
        'Keep records of complaints, inspections, and treatments for at least 2 years',
        'Notify tenants in writing before pesticide application',
        'Complete pest-management training if you have repeat violations',
      ],
    },
    {
      heading: 'If you get a report or notice',
      karl: 'Maps to a second Title and text block: Title = this heading, Text = the two paragraphs plus the two-item linked bullet list below. 72-hour figure and NOV description verified against `article11Guide` and `respond-to-notice-of-violation.js` (`noticeOfViolation`).',
      kind: 'body',
      paragraphs: [
        'When a tenant reports a pest or housing health problem, owners and managers must start investigating within 72 hours.',
        'If Environmental Health finds a violation, they issue a notice of violation (NOV) listing the required corrections and a compliance deadline.',
      ],
      bullets: [
        '[Fix your Healthy Housing and Vector Control violation](noticeOfViolation)',
        '[What happens after you report](afterReport)',
      ],
    },
    {
      heading: "What you're required to do",
      karl: "Maps to a third Title and text block: Title = this heading, Text = the intro paragraph plus the bulleted list below. Condensed from the owner-responsibility and PCO-requirement content in `article11Guide` (Director's Rules §V.2 and related citations) — not a full restatement; links out to the complete table.",
      kind: 'body',
      paragraphs: [
        "These requirements come from Article 11 and the SFDPH Director's Rules and Regulations.",
      ],
      bullets: [
        'Investigate tenant pest reports within 72 hours of receiving them.',
        'Keep records of complaints, inspections, and pest control services for at least 2 years, and make them available to DPH on request.',
        'Hire only licensed pest control operators (PCOs) to apply pesticides or trap rats — never unlicensed staff or over-the-counter treatments for significant infestations.',
        'Give tenants written notice before pesticide application, including the product name, date, and safety information.',
        'Complete pest-management training if the Director requires it after repeat violations.',
        '[See the full owner-responsibility table](article11Guide)',
      ],
    },
    {
      heading: 'Legal authority',
      karl: 'Maps to a fourth Title and text block: Title = this heading, Text = the intro paragraph plus the bulleted list below, mirroring the citation pattern and municode URL already used in `health-code-article-11.js`\'s "Enforcement" section and Spotlight button.',
      kind: 'body',
      paragraphs: ['Article 11 defines these requirements and how HHVC enforces them.'],
      bullets: [
        '**Sec. 581:** Defines the public health nuisances covered by this article, including pest, garbage, mold, and rodent conditions.',
        '**Sec. 596:** Sets the complaint, inspection, and Notice of Violation (NOV) process.',
        '**Sec. 600:** Authorizes criminal, civil, and administrative penalties of up to $1,000 per violation per day.',
        '[View Health Code Article 11 on municode](https://codelibrary.amlegal.com/codes/san_francisco/latest/sf_health/0-0-0-1890)',
        '[See the full section-by-section mapping](article11Guide)',
      ],
    },
    {
      heading: 'Resources',
      component: 'related',
      karl: 'Maps to the Related field: a generic unrestricted "Page" chooser, repeatable.',
      kind: 'placement',
      cards: [
        {
          title: 'Property owner responsibilities',
          target: 'ownerHub',
        },
        {
          title: 'Integrated pest management for property owners and managers',
          target: 'ownerGuidance',
        },
        {
          title: 'Learn what HHVC can inspect',
          target: 'scopeInfo',
        },
        {
          title: 'Pay your Healthy Housing fee',
          target: 'payFee',
        },
      ],
    },
  ],
  seoTitle: 'Article 11 compliance for property owners | SF.gov',
  metaDescription:
    'What property owners and managers must do to comply with Health Code Article 11 — fees, response times, and required actions.',
}

window.HHVC_PAGES = window.HHVC_PAGES || {}
window.HHVC_PAGES['verminResources'] = {
  slug: 'sf.gov/resource--healthy-housing-and-vermin-information',
  type: 'Resource Collection',
  title: 'Healthy housing and pest resources',
  summary:
    'Find guides, forms, and videos for reporting, preventing, and managing pests in a home or building.',
  audience: [
    'This page is for tenants, property owners and managers, and anyone looking for pest and healthy-home resources.',
  ],
  reading: 'Grade 6',
  editorNote:
    'Redesign of the live "Healthy housing and vermin information" Resource Collection previewed 2026-08-07. The source page is a long document dump that combines reporting, tenant preparation, owner compliance, forms, regulations, translated materials, and videos. This mockup routes people by task and audience first, retains the most useful source documents as explicit links, and routes remaining specialized material to focused City or trusted partner pages. Verify document titles, language versions, and replacement URLs before publication.',
  sections: [
    {
      heading: 'Start with the problem',
      karl: 'Resource Collection -> Body -> Resources -> Resource section. Title = this heading. Each card becomes an SF.gov page link. Reporting routes come first so a resident does not need to identify the correct document before getting help.',
      kind: 'body',
      paragraphs: [
        'Report an active problem first. Use the guides below when you need more detail or are preparing for treatment.',
      ],
      cards: [
        {
          title: 'Report rats, mice, and other four-legged problems',
          target: 'rodentsReport',
          karl: 'Resource section -> SF.gov page link to the rodents-report Transaction.',
        },
        {
          title: 'Report cockroaches, mosquitoes, and other insects',
          target: 'insectsReport',
          karl: 'Resource section -> SF.gov page link to the insects-report Transaction.',
        },
        {
          title: 'Report garbage, filth, and overgrown vegetation',
          target: 'filthReport',
          karl: 'Resource section -> SF.gov page link to the filth-report Transaction.',
        },
      ],
    },
    {
      heading: 'If you rent',
      karl: 'Resource Collection -> Body -> Resources -> Resource section. Title = this heading. The bed-bug preparation guide is a Document Picker upload in Karl; its live URL is a mockup stand-in until the document is attached in the CMS.',
      kind: 'body',
      paragraphs: [
        'Use these resources to understand your rights, prepare for pest treatment, and keep a record of the problem.',
      ],
      cards: [
        {
          title: 'Tenant rights when reporting housing conditions',
          target: 'tenantRights',
          karl: 'Resource section -> SF.gov page link to the tenant-rights Information page.',
        },
        {
          title: 'Prepare your unit for bed bug treatment',
          url: 'https://api.sf.gov/documents/23140/GuidelinesforUnitPreparation_dP56n7G.pdf',
          karl: 'Resource section -> Document Picker upload. Source-page document: "Tenant guidelines for unit preparation prior to bed bug treatment - English." Confirm the current document and linked language versions before publication.',
        },
        {
          title: 'What happens after you report a housing or pest problem',
          target: 'afterReport',
          karl: 'Resource section -> SF.gov page link to the after-report Information page.',
        },
      ],
    },
    {
      heading: 'If you own or manage a building',
      karl: 'Resource Collection -> Body -> Resources -> Resource section. Title = this heading. The owner-operator guide is a Document Picker upload in Karl; its live URL is a mockup stand-in until attached in the CMS.',
      kind: 'body',
      paragraphs: [
        'Use these resources to prevent pests, document your work, and meet Article 11 responsibilities.',
      ],
      cards: [
        {
          title: 'Property owner responsibilities',
          target: 'ownerHub',
          karl: 'Resource section -> SF.gov page link to the owner Resource Collection.',
        },
        {
          title: 'Integrated pest management for property owners and managers',
          target: 'ownerGuidance',
          karl: 'Resource section -> SF.gov page link to the owner-guidance Information page.',
        },
        {
          title: 'Residential building owner-operator guidelines for vector control',
          url: 'https://api.sf.gov/documents/52936/R_Residential_Bldg_Owner-Operator_Guidelines_for_Vector_Control_2026_0SYmmSc.html',
          karl: 'Resource section -> Document Picker upload. Source-page document published March 25, 2026; confirm the file, title, and publication date before attaching it in Karl.',
        },
      ],
    },
    {
      heading: 'Find forms, records, and rules',
      karl: 'Resource Collection -> Body -> Resources -> Resource section. Title = this heading. Put occasional reference tasks after active reporting and audience-specific guidance.',
      kind: 'body',
      cards: [
        {
          title: 'Look up building records',
          target: 'recordsHub',
          karl: 'Resource section -> SF.gov page link to the records Resource Collection.',
        },
        {
          title: 'Health Code Article 11 in plain language',
          target: 'article11Guide',
          karl: 'Resource section -> SF.gov page link to the Article 11 Report page.',
        },
        {
          title: 'Pest control reporting form',
          url: 'https://api.sf.gov/documents/23712/PCOReportingForm_2.xls',
          karl: 'Resource section -> Document Picker upload. Source-page document: "Pest Control Reporting Form." Confirm whether an accessible web or spreadsheet version should replace this legacy XLS file.',
        },
      ],
    },
    {
      heading: 'Learn and share healthy-home information',
      karl: 'Resource Collection -> Body -> Resources -> Resource section. Title = this heading. These materials support prevention and education after the visitor has found an action route.',
      kind: 'body',
      cards: [
        {
          title: '16 Steps to a Healthy Home',
          url: 'https://api.sf.gov/documents/52246/16_Steps_to_a_Healthy_Home.html',
          karl: 'Resource section -> Document Picker upload. Source-page document published March 12, 2026; confirm the document and publication date before attaching it in Karl.',
        },
        {
          title: 'Mosquito Control Program',
          target: 'mosquitoControl',
          karl: 'Resource section -> SF.gov page link to the mosquito-control Information page.',
        },
        {
          title: 'Watch a roach-prevention video',
          url: 'https://www.youtube.com/watch?v=S-aJzCk-rNQ',
          karl: 'Resource section -> External link. Source-page video: "Video: Roach Prevention - English." Add translated versions only after confirming their active media links.',
        },
      ],
    },
    {
      heading: 'More trusted pest guidance',
      karl: 'Resource Collection -> Body -> Resources -> Resource section. Title = this heading. Use partner guidance instead of recreating a long, difficult-to-maintain species-by-species document catalog.',
      kind: 'body',
      cards: [
        {
          title: 'UC IPM resources for homes and buildings',
          url: 'https://ipm.ucanr.edu/home-and-landscape/',
          karl: 'Resource section -> External link to the University of California Statewide IPM Program.',
        },
        {
          title: 'Environmental health branch fee schedule',
          url: 'https://api.sf.gov/documents/17453/Website_Fees_FY25-26_fgM2WjX.pdf',
          karl: 'Resource section -> Document Picker upload. The source-page file is FY25-26; do not publish it as current without checking for a newer certified schedule.',
        },
        {
          title: 'Healthy Housing and Vector Control',
          target: 'pestsTopic',
          karl: 'Resource section -> SF.gov page link to the HHVC Agency page.',
        },
      ],
    },
  ],
  seoTitle: 'Healthy housing and pest resources | SF.gov',
  metaDescription:
    'Find healthy-home guides, pest-treatment resources, forms, and prevention information for San Francisco homes and buildings.',
}

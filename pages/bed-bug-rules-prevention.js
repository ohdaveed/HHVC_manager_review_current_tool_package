window.HHVC_PAGES = window.HHVC_PAGES || {}
window.HHVC_PAGES['bedBugsInfo'] = {
  slug: 'sf.gov/information/bed-bug-rules-and-prevention',
  type: 'Information',
  title: 'Bed bug rules and prevention',
  summary:
    'Learn about bed bug prevention, treatment preparation, and rules for San Francisco rental housing.',
  audience: [
    'A tenant preparing for bed bug treatment',
    'A friend, family member, advocate, or helper supporting a tenant',
    'A property owner or manager looking for bed bug prevention and control requirements',
    'Building staff or maintenance staff supporting bed bug prevention',
  ],
  reading: 'Grade 6',
  editorNote:
    'Information page. Official Director’s Rules PDF is on sfdph.org (not Google Drive). PDF accessibility: consider an HTML summary on SF.gov if Karl editors require a non-PDF primary source. Tenant guidelines PDF is internal reference in docs/source/hhvc-policy/.',
  sections: [
    {
      heading: 'Use the official bed bug rules',
      karl: 'Body: External reference link to official bed bug Director’s Rules PDF on sfdph.org',
      kind: 'placement',
      paragraphs: [
        'SFDPH has Director’s Rules and Regulations for preventing and controlling bed bugs in San Francisco. Use them as the detailed reference for requirements.',
        'The PDF opens on the SFDPH website. You will leave SF.gov.',
      ],
      cards: [
        {
          title: 'SFDPH Director’s Rules for bed bug prevention and control',
          text: 'Open the official PDF for bed bug prevention, control, owner responsibilities, and treatment preparation standards.',
          url: 'https://www.sfdph.org/dph/files/EHSdocs/Vector/BedBug/BedBugRegs_070112.pdf',
          karl: 'Body external link: official SFDPH bed bug Director’s Rules PDF (replaces interim Google Drive link)',
        },
      ],
    },
    {
      heading: 'How to spot bed bugs',
      karl: 'Body: Signs of bed bugs (added for depth). Helps tenants and staff detect early.',
      kind: 'body',
      paragraphs: [
        'Bed bugs are small and hide well. Knowing what to look for helps you find a problem before it spreads.',
      ],
      bullets: [
        'Small reddish-brown insects about the size of an apple seed.',
        'Itchy bites, often in a line or small cluster.',
        'Small blood spots or dark specks on sheets, mattress seams, and box springs.',
        'Shed skins or tiny eggs near seams, cracks, and headboards.',
      ],
    },
    {
      heading: 'Owner and manager responsibilities',
      karl: 'Body: Landlord responsibilities',
      kind: 'body',
      paragraphs: [
        'San Francisco Health Code Article 11A and DPH regulations outline clear requirements for property owners and managers to control bed bugs professionally:',
      ],
      bullets: [
        'Hire licensed professionals: Owners cannot use uncertified building staff to treat bed bugs. They must hire a licensed Pest Control Operator (PCO).',
        'Investigate early: Investigate any tenant reports of suspected bed bugs within 72 hours.',
        'Inspect adjacent units: Upon confirming bed bug activity, owners must direct a PCO to inspect all adjacent units (above, below, and on both sides of the infested unit).',
        'Pre-tenancy disclosure: Before a new tenant moves in, the landlord must provide a written history of any bed bug infestations and treatments in the unit over the last 24 months.',
        'Provide mattress encasements: Furnished units must be supplied with breathable, bed bug-proof encasements for all mattresses and box springs at move-in.',
      ],
    },
    {
      heading: 'Tenant responsibilities and preparation',
      karl: 'Body: Tenant responsibilities',
      kind: 'body',
      paragraphs: [
        'Tenants are required to cooperate with inspections and treatments under San Francisco rules. Failure to cooperate can result in a Notice of Violation.',
      ],
      bullets: [
        'Report quickly: Report any signs of suspected bed bugs to the owner or manager in writing within two working days of detecting them.',
        'Grant access: Allow reasonable access for inspections and PCO treatment visits.',
        'Wash and dry clothing: Launder all clothes, bedding, and fabrics in hot water, and dry them on the hottest setting for at least 30 minutes.',
        'Store in sealed bags: Keep laundered items in durable, sealed plastic bags outside the unit or in a designated area until the PCO clears the unit.',
        'Clear furniture space: Move all furniture at least 12 inches away from walls to give the PCO access to baseboards.',
      ],
    },
    {
      heading: 'Safe disposal of infested items',
      karl: 'Body: Infested item disposal',
      kind: 'body',
      paragraphs: [
        'To prevent sidewalk scavenging and stop the spread of bed bugs, discarded items must be labeled and disposed of correctly.',
      ],
      bullets: [
        'Items must be treated by the PCO, double-bagged in durable plastic, and sealed.',
        "Label bags in English, Spanish, and Chinese: 'INFESTED MATERIAL - DO NOT TAKE' | 'CHINCHES DE CAMA' | '床 蝨'.",
      ],
    },
    {
      heading: 'Eradication and abatement timeline',
      karl: 'Body: Abatement monitoring timeline',
      kind: 'body',
      paragraphs: [
        'Legally, a bed bug infestation is not considered resolved (abated) immediately after treatment.',
      ],
      bullets: [
        '4-Week Monitoring Period: Abatement is achieved only after a 28-day period of zero bed bug activity, verified by a PCO using monitoring devices (interceptors).',
        "Abatement Notice: Landlords must provide a written 'Abatement Achieved' notice to the tenant after the 28-day clear period.",
        'DPH Re-inspection: DPH will conduct a final re-inspection within 45 days of the last treatment to verify the closure of a Notice of Violation.',
      ],
    },
    {
      heading: 'When someone should report',
      karl: 'Body: Reporting threshold + body link to related Transaction page',
      kind: 'body',
      paragraphs: [
        'A tenant, tenant helper, affected resident, or employee can report through 311 if there is an active bed bug problem and the property owner or manager does not respond. Do not wait 72 hours for urgent health or safety concerns.',
      ],
      button: 'Report bed bugs',
      buttonStyle: 'secondary',
      buttonTarget: 'bedBugsReport',
    },
    {
      heading: 'Related pages',
      karl: 'Related section: right-panel linked pages',
      kind: 'placement',
      cards: [
        {
          title: 'Report bed bugs',
          text: 'Report an active bed bug problem through 311.',
          target: 'bedBugsReport',
          karl: 'Related section: right-panel linked page',
        },
        {
          title: 'Tenant rights and reporting',
          text: "Find help if you are worried about retaliation. Reporter identities are only shared with the City Attorney's Office and are not shared in response to public records requests.",
          target: 'tenantRights',
          karl: 'Related section: right-panel linked page',
        },
        {
          title: 'What happens after you report',
          text: 'Learn how reports are reviewed, assigned on weekdays, and when an inspector may contact you.',
          target: 'afterReport',
          karl: 'Related section: right-panel linked page',
        },
      ],
    },
  ],
}

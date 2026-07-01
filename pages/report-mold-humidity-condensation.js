window.HHVC_PAGES = window.HHVC_PAGES || {}
window.HHVC_PAGES['moldReport'] = {
  slug: 'sf.gov/report-mold-humidity-condensation',
  type: 'Transaction',
  title: 'Report mold from humidity or condensation',
  summary: 'Report mold or moisture caused by humidity, condensation, or poor ventilation.',
  audience: [
    'A tenant affected by mold or moisture',
    'A friend, family member, advocate, or helper reporting for a tenant',
    'A person reporting mold in an SRO, residential hotel, or shared residential area',
  ],
  reading: 'Grade 5–6',
  seoTitle: 'Report mold from humidity or condensation',
  metaDescription: 'Report mold or moisture caused by humidity, condensation, or poor ventilation.',
  sections: [
    {
      heading: 'What to do',
      karl: 'Body: Ordered step list / What to do. Primary 311 action appears first; report details are consolidated in Step 3.',
      kind: 'body',
      steps: [
        {
          title: 'Start your report',
          text: [
            'Use 311 to report an active problem to the City.',
            'If the problem is urgent, report now.',
          ],
          button: 'Report through 311',
          karl: 'Body step 1 + Primary action button. Keep the 311 action first.',
        },
        {
          title: 'If you rent, give 72 hours when possible',
          text: [
            'Tell the property owner or manager about the mold or moisture problem.',
            'If they do not respond or start fixing it within 72 hours, submit your report right away so it can be assigned for review.',
            'Do not wait 72 hours if there is an urgent health or safety concern.',
          ],
          karl: 'Body step 2: Conditional 72-hour tenant notice + timeline expectation',
        },
        {
          title: 'Tell us where the problem is',
          text: ['Include only the details that apply:'],
          bullets: [
            'The address or location',
            'Where you see mold or moisture',
            'About how large the mold area is',
            'Whether the problem may be from humidity, condensation, or poor ventilation',
            'How long it has been happening',
            'Whether you told the property owner or manager, if you rent',
            'Your contact information, if you want an inspector to contact you',
          ],
          callout: {
            karl: 'Body note: Mold kit guidance',
            text: 'Do not buy a mold test kit. HHVC does not accept or use third-party mold kits for review.',
          },
          karl: 'Body step 3: Report details checklist',
        },
      ],
    },
    {
      heading: 'When HHVC may review mold',
      karl: 'Body: Article 11 mold threshold and HHVC scope',
      kind: 'body',
      paragraphs: [
        'HHVC may review mold when the affected area is about 10 square feet or more and may be linked to humidity, condensation, or poor ventilation.',
        'For mold smaller than 10 square feet, clean hard surfaces with soap and water. Reduce humidity and condensation so it does not come back.',
      ],
    },
    {
      heading: 'What happens next',
      karl: 'Body: After-report expectations, weekday processing note, and concise enforcement statement',
      kind: 'body',
      paragraphs: [
        'Environmental Health may review the report. If you gave contact information, an inspector may contact you to ask questions or schedule a visit.',
        'It can take a few days for 311 to route the complaint to Environmental Health and for HHVC to assign it to an inspector. Complaints are processed on weekdays.',
        'If you did not give contact information, an inspection may still happen without notice, for example if the report describes an urgent health or safety risk.',
        'If HHVC finds a violation, the City may require the property owner or responsible party to correct it.',
      ],
      callout: {
        karl: 'Body note: Tenant rights / anti-retaliation reassurance',
        text: 'Tenants have rights to safe and habitable housing. A property owner or manager cannot retaliate because a tenant reports housing conditions to the City.',
      },
    },
    {
      heading: 'Related pages',
      karl: 'Related section: right-panel linked pages',
      kind: 'placement',
      cards: [
        {
          title: 'Learn what HHVC can inspect',
          text: 'Check whether Environmental Health may review this type of issue.',
          target: 'scopeInfo',
        },
        {
          title: 'What happens after you report',
          text: 'Learn how reports are reviewed, assigned on weekdays, and when an inspector may contact you.',
          target: 'afterReport',
        },
        {
          title: 'Tenant rights and reporting',
          text: 'Find help if you are worried about retaliation. HHVC does not share the reporter’s identity with the property owner or manager.',
          target: 'tenantRights',
          karl: 'Related section link to tenant support / rights information',
        },
        {
          title: 'Integrated pest management for property managers',
          text: 'Use prevention, monitoring, repairs, and resident outreach to reduce pests and housing health problems.',
          target: 'ownerGuidance',
        },
      ],
    },
  ],
}

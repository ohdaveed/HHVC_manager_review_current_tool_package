window.HHVC_PAGES = window.HHVC_PAGES || {}
window.HHVC_PAGES['bedBugsReport'] = {
  slug: 'sf.gov/report-bed-bugs',
  type: 'Transaction',
  title: 'Report bed bugs',
  summary: 'Report an active bed bug problem in San Francisco rental housing.',
  audience: [
    'A tenant affected by bed bugs',
    'A friend, family member, advocate, or helper reporting for a tenant',
    'A person reporting bed bugs in rental housing, an SRO, or a residential hotel',
  ],
  reading: 'Grade 5–6',
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
            'Tell the property owner or manager about the bed bug problem.',
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
            'Where bed bugs were seen or where bites happened',
            'Whether the problem is in a unit, room, or shared residential area',
            'How long it has been happening',
            'Whether you told the property owner or manager, if you rent',
            'Any treatment, inspection, or response that has already happened',
            'Your contact information, if you want an inspector to contact you',
          ],
          callout: {
            karl: 'Body note: Photo guidance',
            text: "Photos are not required. Describe the location and condition clearly. Reporter identities are only shared with the City Attorney's Office and are not shared in response to public records requests.",
          },
          karl: 'Body step 3: Report details checklist',
        },
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
        'Violations must be corrected and may require follow-up inspection.',
      ],
      callout: {
        karl: 'Body note: Tenant rights / anti-retaliation reassurance',
        text: 'Tenants have rights to safe and habitable housing. A property owner or manager cannot retaliate because a tenant reports housing conditions to the City.',
      },
    },
    {
      heading: 'Bed bug rules',
      karl: "Body: Pointer to the Info page's own Director's Rules reference, instead of duplicating the external PDF link on both the Report and Info pages.",
      kind: 'placement',
      paragraphs: [
        'For detailed bed bug prevention and control rules, see the bed bug rules and prevention page.',
      ],
      cards: [
        {
          title: 'Bed bug rules and prevention',
          text: "Learn about bed bug rules, treatment preparation, and prevention, including the official Director's Rules reference.",
          target: 'bedBugsInfo',
        },
      ],
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
          title: 'Bed bug rules and prevention',
          text: 'Learn what tenants and property owners should know about bed bug prevention and control.',
          target: 'bedBugsInfo',
          karl: 'Related section link to Information page',
        },
        {
          title: 'Tenant rights and reporting',
          text: "Find help if you are worried about retaliation. Reporter identities are only shared with the City Attorney's Office and are not shared in response to public records requests.",
          target: 'tenantRights',
          karl: 'Related section link to tenant support / rights information',
        },
      ],
    },
  ],
}

window.HHVC_PAGES = window.HHVC_PAGES || {}
window.HHVC_PAGES['vegetationReport'] = {
  slug: 'sf.gov/report-overgrown-vegetation-garbage',
  type: 'Transaction',
  title: 'Report overgrown vegetation or garbage',
  summary: 'Report garbage, clutter, or overgrown plants that may attract pests or vectors.',
  audience: [
    'A tenant or resident affected by garbage, clutter, animal waste, or overgrown vegetation',
    'A friend, family member, advocate, or helper reporting for a tenant',
    'A person reporting conditions in a shared area',
    'An employee reporting a pest or vector concern at work',
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
            'Tell the property owner or manager about the vegetation, garbage, or pest-attracting condition.',
            'If they do not respond or start fixing it within 72 hours, submit your report right away so it can be assigned for review.',
            'Do not wait 72 hours if there is an urgent health or safety concern.',
          ],
          karl: 'Body step 2: Conditional 72-hour tenant notice + timeline expectation',
        },
        {
          title: 'Describe the condition',
          text: ['Include only the details that apply:'],
          bullets: [
            'The address or location',
            'Whether the condition is garbage, debris, clutter, storage, overgrown plants, standing water, or animal waste',
            'Whether it is inside, outside, or in a shared area',
            'How long it has been happening',
            'Whether you told the property owner or manager, if you rent',
            'Whether you saw pests, mosquitoes, or other vectors nearby',
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
      heading: 'Get help making your report',
      karl: 'Body: Help and access section (added for depth) — third-party reporting, language access, privacy.',
      kind: 'body',
      paragraphs: [
        'You can make a report even if you are not the tenant. A friend, family member, advocate, or helper can report for someone else.',
      ],
      bullets: [
        'You can ask 311 for help in your language.',
        'You do not have to give your name to make a report.',
        'HHVC does not share the reporter’s identity with the property owner or manager.',
        'You can ask 311 for a service request number so you can follow up later.',
      ],
    },
    {
      heading: 'What happens next',
      karl: 'Body: After-report expectations, weekday processing note, and concise enforcement statement (added for depth to match sibling report pages).',
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
          title: 'Report rats or mice',
          text: 'Use this page for rat or mouse activity.',
          target: 'ratsReport',
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

window.HHVC_PAGES = window.HHVC_PAGES || {}
window.HHVC_PAGES['vegetationReport'] = {
  slug: 'sf.gov/report-overgrown-vegetation',
  type: 'Transaction',
  title: 'Report overgrown vegetation',
  summary: 'Report overgrown plants, weeds, or brush that may attract or shelter pests or vectors.',
  audience: [
    'A tenant or resident affected by overgrown vegetation',
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
          callout: {
            title: 'Your report is confidential',
            text: 'The City will never share your name or contact information with your landlord or property manager.',
            karl: 'Body step 1 callout: Privacy and confidentiality reassurance',
          },
        },
        {
          title: 'If you rent, give 72 hours when possible',
          text: ['Tell the property owner or manager about the overgrown vegetation.'],
          bullets: [
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
            'Whether the condition is overgrown plants, weeds, brush, or dead vegetation',
            'Whether it is in a yard, along the property edge, or in a shared area',
            'How long it has been happening',
            'Whether you told the property owner or manager, if you rent',
            'Whether you saw pests, mosquitoes, standing water, or other vectors nearby',
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
      heading: 'How your report is processed',
      karl: 'Body: After-report expectations, weekday processing note, and concise enforcement statement (added for depth to match sibling report pages).',
      kind: 'body',
      bullets: [
        'Review time: It can take a few weekdays for 311 to send your report to Environmental Health and assign an inspector.',
        'If you gave contact information: An inspector may reach out to ask questions or schedule a visit.',
        'If you reported anonymously: An inspector may still visit the property without notice—especially if there is an urgent safety or health risk.',
        'If we find a problem: The City can order the property owner or responsible party to fix the violation.',
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
          karl: 'Related section: right-panel linked page',
        },
        {
          title: 'What happens after you report',
          text: 'Learn how reports are reviewed, assigned on weekdays, and when an inspector may contact you.',
          target: 'afterReport',
          karl: 'Related section: right-panel linked page',
        },
        {
          title: 'Report garbage or clutter',
          text: 'Use this page for garbage, clutter, debris, or animal waste.',
          target: 'garbageReport',
          karl: 'Related section link to the sibling single-task report page',
        },
        {
          title: 'Report rats or mice',
          text: 'Use this page for rat or mouse activity.',
          target: 'ratsReport',
          karl: 'Related section: right-panel linked page',
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
  seoTitle: 'Report overgrown vegetation | SF.gov',
  metaDescription:
    'Report overgrown plants, weeds, or brush that may attract or shelter pests or vectors.',
}

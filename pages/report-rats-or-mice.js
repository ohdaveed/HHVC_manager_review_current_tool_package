window.HHVC_PAGES = window.HHVC_PAGES || {}
window.HHVC_PAGES['ratsReport'] = {
  slug: 'sf.gov/report-rats-or-mice',
  type: 'Transaction',
  title: 'Report rats or mice',
  summary: 'Report an active rat or mouse problem in San Francisco.',
  audience: [
    'A tenant affected by rats or mice',
    'A friend, family member, advocate, or helper reporting for a tenant',
    'A person reporting rats or mice in a shared area',
    'An employee reporting rats or mice at work',
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
          title: 'Notify your landlord before reporting',
          bullets: [
            '**Notify your landlord:** Tell the property owner or manager about the rats or mice.',
            '**Give them 72 hours:** If they do not start fixing the problem within 3 days, report it to the City.',
            '**Urgent problems:** If there is a serious danger to health or safety, report it right away without waiting.',
          ],
          karl: 'Body step 2: Conditional 72-hour tenant notice + timeline expectation',
        },
        {
          title: 'Tell us where the problem is',
          text: ['Only share the details that apply to your situation:'],
          bullets: [
            '**Where it is:** The address or location, and where you saw the rats or mice (inside, outside, or in a shared area).',
            '**When it started:** How long this has been happening.',
            '**Landlord notice:** If you rent, tell us if you already notified the property owner or manager.',
            '**Other issues:** Any garbage, clutter, holes, or overgrown plants nearby.',
            '**Your contact info:** Leave your name and phone number or email if you want an inspector to reach out to you.',
          ],
          callout: {
            karl: 'Body note: Photo guidance',
            text: 'Note: You do not need to send photos. Just describe the problem clearly.',
            title: false,
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
      karl: 'Body: After-report expectations, weekday processing note, and concise enforcement statement',
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
          title: 'Keep rats and mice out of your home',
          text: 'Learn how to reduce food, water, shelter, and entry points that can attract rats or mice.',
          target: 'ratsPrevent',
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
}

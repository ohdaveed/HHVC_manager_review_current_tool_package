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
  reading: 'Grade 6',
  primaryCta: 'Report through 311',
  topicTag: 'Topic: Pests and housing problems',
  sections: [
    {
      heading: 'What to do',
      karl: 'Karl: what_to_do StreamField. Each step below = one Section block (section_title + section_specifics). Primary 311 action appears first; report details are consolidated in Step 3.',
      kind: 'body',
      steps: [
        {
          title: 'Start your report',
          text: [
            'Use 311 to report an active problem to the City.',
            'If the problem is urgent, report now.',
          ],
          button: 'Report through 311',
          karl: 'what_to_do -> Section. Section title: "Start your report". Section specifics: Text block (these 2 sentences) + Button link block ("Report through 311") + Callout block below. Keep the 311 action first.',
          callout: {
            title: 'Your report is confidential',
            text: 'The City will never share your name or contact information with your landlord or property manager.',
            karl: 'Callout block inside the "Start your report" Section specifics: single rich text field only, no separate title field like this mockup callout has. Fold "Your report is confidential" in as a bolded lead-in within the callout text, or flag for Digital Services if a distinct heading is actually needed.',
          },
        },
        {
          title: 'Notify your landlord before reporting',
          bullets: [
            '**Notify your landlord:** Tell the property owner or manager about the rats or mice.',
            '**Give them 72 hours:** If they do not start fixing the problem within 3 days, report it to the City.',
            '**Urgent problems:** If there is a serious danger to health or safety, report it right away without waiting.',
          ],
          karl: 'what_to_do -> Section. Section title: "Notify your landlord before reporting". Section specifics: one Text block (bulleted list). Conditional 72-hour tenant notice + timeline expectation.',
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
            karl: 'Callout block inside the "Tell us where the problem is" Section specifics: single rich text field, no separate title (this mockup callout already uses title: false, so no heading mismatch here). Text: photo guidance note.',
            text: 'Note: You do not need to send photos. Just describe the problem clearly.',
            title: false,
          },
          karl: 'what_to_do -> Section. Section title: "Tell us where the problem is". Section specifics: Text block (intro sentence + bulleted checklist) + Callout block below. Report details checklist.',
        },
      ],
    },
    {
      heading: 'Get help making your report',
      karl: 'Best real-schema fit: one things_to_know entry (confirmed repeatable, no max). Title: "Get help making your report". Text: the paragraph + bulleted list below (third-party reporting, language access, privacy). Open question for Digital Services: things_to_know renders ABOVE what_to_do on the real form, so this content may need to move earlier on the live page even though it stays here in this mockup draft.',
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
      karl: 'Best real-schema fit: a second things_to_know entry. Title: "How your report is processed". Text: the bulleted list below (after-report expectations, weekday processing note, enforcement statement, tenant rights note, and the Health Code Article 11 property-owner-obligation summary required by HHVC content standards Ch. 8.7.1). Same ordering caveat as the section above — things_to_know sits before what_to_do on the real form. New: a secondary Button link block (\'View Health Code Article 11\') citing the municipal code per Ch. 8.7.2 — flag for Digital Services to confirm this is the SF.gov-preferred municode URL before publication.',
      kind: 'body',
      bullets: [
        '**Review time:** It can take a few weekdays for 311 to send your report to Environmental Health and assign an inspector.',
        '**If you gave contact information:** An inspector may reach out to ask questions or schedule a visit.',
        '**If you reported anonymously:** An inspector may still visit the property without notice—especially if there is an urgent safety or health risk.',
        '**If we find a problem:** The City can order the property owner or responsible party to fix the violation.',
        '**Note:** Tenants have rights to safe and habitable housing. A property owner or manager cannot retaliate because a tenant reports housing conditions to the City.',
        'Under San Francisco Health Code Article 11, property owners are legally required to keep their buildings clean, watertight, and completely free of rodent and insect infestations.',
      ],
      button: 'View Health Code Article 11',
      buttonUrl: 'https://codelibrary.amlegal.com/codes/san_francisco/latest/sf_health/0-0-0-1890',
      buttonStyle: 'secondary',
    },
    {
      heading: 'Related pages',
      component: 'related',
      karl: 'Maps to the related panel: repeatable field "Page *" with a "Choose a page" button. 4 cards below = 4 related "Page" entries.',
      kind: 'placement',
      cards: [
        {
          title: 'Learn what HHVC can inspect',
          target: 'scopeInfo',
        },
        {
          title: 'What happens after you report',
          target: 'afterReport',
        },
        {
          title: 'Keep rats and mice out of your home',
          target: 'ratsPrevent',
        },
        {
          title: 'Tenant rights and reporting',
          target: 'tenantRights',
        },
      ],
    },
  ],
  seoTitle: 'Report rats or mice | SF.gov',
  metaDescription: 'Report an active rat or mouse problem in San Francisco.',
}

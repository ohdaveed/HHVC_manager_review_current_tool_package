window.HHVC_PAGES = window.HHVC_PAGES || {}
window.HHVC_PAGES['rodentsReport'] = {
  slug: 'sf.gov/report-rats-mice-four-legged-problems',
  type: 'Transaction',
  title: 'Report rats, mice, and other four-legged problems',
  summary:
    'Report rats, mice, raccoons, bats, or other four-legged pest problems in a home, building, yard, or shared area.',
  audience: [
    'A tenant affected by rats, mice, bats, or other four-legged pests',
    'A friend, family member, advocate, or helper reporting for a tenant',
    'A person reporting a problem in a shared area',
    'An employee reporting a four-legged pest problem at work',
  ],
  reading: 'Grade 6',
  editorNote:
    'Consolidated Transaction page. Replaces the separate "Report rats or mice" page and absorbs the raccoon reporting path from the deleted raccoon Information page. Bats are in scope too — Article 11 policy source groups bats with raccoons/skunks/squirrels under "Wildlife (Public Health Importance)" and applies the same exclusion/prevention rules (docs/source/hhvc-policy/2026-07-07-directors-rules-ai-export-DRAFT-NOT-FOR-PUBLICATION.md). One primary 311 CTA. The "While you wait" section is the Supporting information block requested by the manager: set expectations on response time, then give simple IPM tips so people can start addressing the problem themselves.',
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
            '**Notify your landlord:** Tell the property owner or manager about the problem.',
            '**Give them 72 hours:** If they do not start fixing the problem within 3 days, report it to the City.',
            '**Urgent problems:** If there is a serious danger to health or safety, report it right away without waiting.',
          ],
          karl: 'what_to_do -> Section. Section title: "Notify your landlord before reporting". Section specifics: one Text block (bulleted list). Conditional 72-hour tenant notice + timeline expectation.',
        },
        {
          title: 'Tell us where the problem is',
          text: ['Only share the details that apply to your situation:'],
          bullets: [
            '**What you saw:** Rats, mice, raccoons, bats, or another four-legged animal causing a problem.',
            '**Where it is:** The address or location, and where you saw the animals (inside, outside, or in a shared area).',
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
          karl: 'what_to_do -> Section. Section title: "Tell us where the problem is". Section specifics: Text block (intro sentence + bulleted checklist) + Callout block below. Report details checklist now names the four-legged pests this consolidated page covers.',
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
      karl: 'Best real-schema fit: a second things_to_know entry. Title: "How your report is processed". Text: the bulleted list below (after-report expectations, weekday processing note, enforcement statement, tenant rights note, and the Health Code Article 11 property-owner-obligation summary required by HHVC content standards Ch. 8.7.1). Same ordering caveat as the section above — things_to_know sits before what_to_do on the real form. Secondary Button link block ("View Health Code Article 11") citing the municipal code per Ch. 8.7.2.',
      kind: 'body',
      bullets: [
        '**Review time:** It can take a few weekdays for 311 to send your report to Environmental Health and assign an inspector.',
        '**If you gave contact information:** An inspector may reach out to ask questions or schedule a visit.',
        '**If you reported anonymously:** An inspector may still visit the property without notice—especially if there is an urgent safety or health risk.',
        '**If we find a problem:** The City can order the property owner or responsible party to fix the violation.',
        '**Note:** Tenants have rights to safe and habitable housing. A property owner or manager cannot retaliate because a tenant reports housing conditions to the City.',
        'Under San Francisco Health Code Article 11, property owners are legally required to keep their buildings clean, watertight, and completely free of rodent infestations.',
      ],
      button: 'View Health Code Article 11',
      buttonUrl: 'https://codelibrary.amlegal.com/codes/san_francisco/latest/sf_health/0-0-0-1890',
      buttonStyle: 'secondary',
    },
    {
      heading: 'While you wait: tips to help with the problem',
      karl: 'Maps to supporting_information (Accordions). This accordion uses the mockup-only open flag so the tips are visible without a click — flag for Digital Services that the real accordion renders collapsed. Contents: one Text block (lead paragraph + IPM bullets) + a Resources-style external links list (CDC, UC IPM pest notes, NEHA). Manager directive: set the response-time expectation, then give simple integrated pest management steps people can start on their own.',
      kind: 'body',
      component: 'supporting',
      open: true,
      paragraphs: [
        'It may take us a few weekdays to get back to you. In the meantime, here are a few things you can do to help with the problem.',
      ],
      bullets: [
        '**Close off entry points:** Seal any gap bigger than a pencil with rodent-proof materials like hardware cloth, copper mesh, or sheet metal.',
        '**Cut off food:** Store food and garbage in bins with tight-fitting lids. Do not leave pet food out overnight.',
        '**Remove hiding places:** Clear clutter and trim overgrown plants where rats, mice, and raccoons hide or nest.',
        '**Trap safely:** Use snap traps indoors. Do not scatter loose poison — it can harm children, pets, and wildlife.',
        '**Clean up safely:** Wet down droppings with a disinfectant and wear gloves. Never dry-sweep or vacuum droppings.',
      ],
      cards: [
        {
          title: 'UC IPM Pest Notes: Rats',
          text: 'University of California guidance on identifying and managing rats.',
          url: 'https://ipm.ucanr.edu/home-and-landscape/rats/pest-notes/',
          karl: 'External link inside the supporting_information accordion. Third-party UC IPM reference in place of a City-maintained prevention page (manager directive: do not reinvent the wheel).',
        },
        {
          title: 'UC IPM Pest Notes: House mouse',
          text: 'University of California guidance on managing house mice.',
          url: 'https://ipm.ucanr.edu/home-and-landscape/house-mouse/pest-notes/',
          karl: 'External link inside the supporting_information accordion. Third-party UC IPM reference.',
        },
        {
          title: 'UC IPM Pest Notes: Raccoons',
          text: 'University of California guidance on managing raccoons around buildings.',
          url: 'https://ipm.ucanr.edu/home-and-landscape/raccoon/pest-notes/',
          karl: 'External link inside the supporting_information accordion. Third-party UC IPM reference covering the raccoon scope folded into this page.',
        },
        {
          title: 'CDC: Preventing rodent infestations',
          text: 'Federal guidance on keeping rodents out of your home.',
          url: 'https://www.cdc.gov/rodents/prevention/index.html',
          karl: 'External link inside the supporting_information accordion. Third-party CDC reference.',
        },
        {
          title: 'NEHA: Vector control resources',
          text: 'National Environmental Health Association vector control resources.',
          url: 'https://www.neha.org/vector-control',
          karl: 'External link inside the supporting_information accordion. Third-party NEHA reference.',
        },
      ],
    },
    {
      heading: 'Related pages',
      karl: 'Maps to the related panel: repeatable field "Page *" with a "Choose a page" button. 4 cards below = 4 related "Page" entries. All internal SF.gov pages — Karl Related is a page chooser and cannot hold external links.',
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
          title: 'Report garbage, filth, and overgrown vegetation',
          target: 'filthReport',
        },
        {
          title: 'Tenant rights and reporting',
          target: 'tenantRights',
        },
      ],
    },
  ],
  seoTitle: 'Report rats, mice, and other four-legged problems | SF.gov',
  metaDescription:
    'Report rats, mice, raccoons, bats, or other four-legged pest problems in San Francisco.',
}

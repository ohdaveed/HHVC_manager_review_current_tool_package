window.HHVC_PAGES = window.HHVC_PAGES || {}
window.HHVC_PAGES['insectsReport'] = {
  slug: 'sf.gov/report-cockroaches-mosquitoes-insects',
  type: 'Transaction',
  title: 'Report cockroaches, mosquitoes, and other insects',
  summary:
    'Report cockroaches, bed bugs, mosquitoes, flies, wasps, or other insect problems in a home, building, yard, or shared area.',
  audience: [
    'A tenant affected by cockroaches, bed bugs, mosquitoes, or other insects',
    'A friend, family member, advocate, or helper reporting for a tenant',
    'A person reporting a problem in a shared area, SRO, hotel, or workplace',
    'An employee reporting an insect problem at work',
  ],
  reading: 'Grade 6',
  editorNote:
    'Consolidated Transaction page. Replaces the separate "Report cockroaches", "Report bed bugs", and "Report mosquitoes" pages, absorbs the fly, wasp, and mite reporting paths from the deleted species Information pages, and routes dead-bird reports to the State West Nile virus program (manager decision at plan review). One primary 311 CTA. The "While you wait" section is the Supporting information block requested by the manager.',
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
            '**Notify your landlord:** Tell the property owner or manager about the insects. For bed bugs, owners must investigate complaints promptly and coordinate treatment.',
            '**Give them 72 hours:** If they do not start fixing the problem within 3 days, report it to the City.',
            '**Urgent problems:** If there is a serious danger to health or safety, report it right away without waiting.',
          ],
          karl: 'what_to_do -> Section. Section title: "Notify your landlord before reporting". Section specifics: one Text block (bulleted list). Conditional 72-hour tenant notice + the bed-bug owner-obligation line carried from the deleted bed bug pages.',
        },
        {
          title: 'Tell us where the problem is',
          text: ['Only share the details that apply to your situation:'],
          bullets: [
            '**What you saw:** Cockroaches, bed bugs, mosquitoes, flies, wasps, mites, or another insect problem.',
            '**Where it is:** The address or location, and where you saw the insects (inside, outside, or in a shared area).',
            '**Standing water:** For mosquitoes, tell us about any standing water — buckets, planters, clogged gutters, or fountains.',
            '**When it started:** How long this has been happening.',
            '**Landlord notice:** If you rent, tell us if you already notified the property owner or manager.',
            '**Your contact info:** Leave your name and phone number or email if you want an inspector to reach out to you.',
          ],
          callout: {
            karl: 'Callout block inside the "Tell us where the problem is" Section specifics: single rich text field, no separate title. Text: dead-bird routing note — the State West Nile virus program collects those reports, so this page links out instead of keeping a separate City dead-bird transaction (manager decision at plan review).',
            text: 'See a dead bird? Report it to the State West Nile virus program instead — dead birds help track West Nile virus.',
            title: false,
          },
          button: 'Report a dead bird to the State',
          buttonUrl: 'https://westnile.ca.gov/report',
          karl: 'what_to_do -> Section. Section title: "Tell us where the problem is". Section specifics: Text block (intro sentence + bulleted checklist) + Callout block + secondary Button link block (external State WNV reporting site). Checklist names the insect scope this consolidated page covers.',
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
        'Under San Francisco Health Code Article 11, property owners are legally required to keep their buildings clean, watertight, and completely free of insect infestations, and to eliminate places where flies and mosquitoes breed.',
      ],
      button: 'View Health Code Article 11',
      buttonUrl: 'https://codelibrary.amlegal.com/codes/san_francisco/latest/sf_health/0-0-0-1890',
      buttonStyle: 'secondary',
    },
    {
      heading: 'While you wait: tips to help with the problem',
      karl: 'Maps to supporting_information (Accordions). This accordion uses the mockup-only open flag so the tips are visible without a click — flag for Digital Services that the real accordion renders collapsed. Contents: one Text block (lead paragraph + IPM bullets grouped per pest) + a Resources-style external links list (UC IPM, CDC, EPA). Manager directive: set the response-time expectation, then give simple integrated pest management steps people can start on their own.',
      kind: 'body',
      component: 'supporting',
      open: true,
      paragraphs: [
        'It may take us a few weekdays to get back to you. In the meantime, here are a few things you can do to help with the problem.',
      ],
      bullets: [
        '**Cockroaches:** Clean up crumbs and grease, fix dripping faucets and leaks, and seal cracks near pipes. Use bait stations instead of sprays.',
        '**Bed bugs:** Do not throw out furniture before treatment — it can spread the bugs. Wash and dry bedding on high heat, and tell your landlord right away.',
        '**Mosquitoes:** Dump standing water at least once a week — buckets, planters, saucers, and clogged gutters. Fix holes in window screens.',
        '**Flies:** Bag garbage tightly and keep bin lids closed so flies cannot breed in it.',
        '**Wasps:** Do not disturb a ground nest — mark the spot and keep people and pets away until it is treated.',
      ],
      cards: [
        {
          title: 'UC IPM Pest Notes: Cockroaches',
          text: 'University of California guidance on managing cockroaches.',
          url: 'https://ipm.ucanr.edu/home-and-landscape/cockroaches/pest-notes/',
          karl: 'External link inside the supporting_information accordion. Third-party UC IPM reference in place of a City-maintained prevention page (manager directive: do not reinvent the wheel).',
        },
        {
          title: 'UC IPM Pest Notes: Bed bugs',
          text: 'University of California guidance on identifying and treating bed bugs.',
          url: 'https://ipm.ucanr.edu/home-and-landscape/bed-bugs/pest-notes/',
          karl: 'External link inside the supporting_information accordion. Third-party UC IPM reference.',
        },
        {
          title: 'UC IPM Pest Notes: Mosquitoes',
          text: 'University of California guidance on reducing mosquitoes around the home.',
          url: 'https://ipm.ucanr.edu/home-and-landscape/mosquitoes/pest-notes/',
          karl: 'External link inside the supporting_information accordion. Third-party UC IPM reference.',
        },
        {
          title: 'CDC: Preventing mosquito bites',
          text: 'Federal guidance on avoiding mosquito bites and mosquito-borne illness.',
          url: 'https://www.cdc.gov/mosquitoes/prevention/index.html',
          karl: 'External link inside the supporting_information accordion. Third-party CDC reference.',
        },
        {
          title: 'EPA: Bed bugs',
          text: 'Federal guidance on finding and treating bed bugs.',
          url: 'https://www.epa.gov/bedbugs',
          karl: 'External link inside the supporting_information accordion. Third-party EPA reference.',
        },
        {
          title: 'California West Nile virus: Report a dead bird',
          text: 'Report dead birds to the State to help track West Nile virus.',
          url: 'https://westnile.ca.gov/report',
          karl: 'External link inside the supporting_information accordion. Replaces the deleted standalone dead-bird transaction — the State runs this reporting line.',
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
          title: 'Mosquito Control Program',
          target: 'mosquitoControl',
        },
        {
          title: 'Tenant rights and reporting',
          target: 'tenantRights',
        },
      ],
    },
  ],
  seoTitle: 'Report cockroaches, mosquitoes, and other insects | SF.gov',
  metaDescription:
    'Report cockroaches, bed bugs, mosquitoes, flies, wasps, or other insect problems in San Francisco.',
}

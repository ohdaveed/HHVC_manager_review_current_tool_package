window.HHVC_PAGES = window.HHVC_PAGES || {}
window.HHVC_PAGES['filthReport'] = {
  slug: 'sf.gov/report-garbage-filth-vegetation',
  type: 'Transaction',
  title: 'Report garbage, filth, and overgrown vegetation',
  summary:
    'Report garbage, clutter, animal waste, pigeon droppings, or overgrown plants that may attract pests or vectors.',
  audience: [
    'A tenant or resident affected by garbage, clutter, filth, or overgrown plants',
    'A friend, family member, advocate, or helper reporting for a tenant',
    'A person reporting conditions in a shared area',
    'An employee reporting a pest or vector concern at work',
  ],
  reading: 'Grade 6',
  editorNote:
    'Consolidated Transaction page. Replaces the separate "Report garbage or clutter", "Report overgrown vegetation", and "Report pigeons" pages, and carries the mold-from-humidity 311 pointer from the deleted mold report page. One primary 311 CTA. The "While you wait" section is the Supporting information block requested by the manager.',
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
          title: 'If you rent, give 72 hours when possible',
          text: ['Tell the property owner or manager about the condition.'],
          bullets: [
            'If they do not respond or start fixing it within 72 hours, submit your report right away so it can be assigned for review.',
            'Do not wait 72 hours if there is an urgent health or safety concern.',
          ],
          karl: 'what_to_do -> Section. Section title: "If you rent, give 72 hours when possible". Section specifics: one Text block containing the intro sentence plus the bulleted list below. Conditional 72-hour tenant notice + timeline expectation.',
        },
        {
          title: 'Describe the condition',
          text: ['Include only the details that apply:'],
          bullets: [
            'The address or location',
            'Whether the condition is garbage, debris, clutter, stored items, animal waste, pigeon droppings or roosting, or overgrown plants and brush',
            'Whether it is inside, outside, or in a shared area',
            'How long it has been happening',
            'Whether you told the property owner or manager, if you rent',
            'Whether you saw rats, mice, mosquitoes, or other pests nearby',
            'Your contact information, if you want an inspector to contact you',
          ],
          callout: {
            karl: 'Callout block inside the "Describe the condition" Section specifics: single rich text field, no separate title field. Text: photo guidance plus the reporter-identity disclosure note.',
            text: "Photos are not required. Describe the location and condition clearly. Reporter identities are only shared with the City Attorney's Office and are not shared in response to public records requests.",
          },
          karl: 'what_to_do -> Section. Section title: "Describe the condition". Section specifics: Text block (intro sentence + bulleted checklist) + Callout block below. Checklist names the garbage, filth, pigeon, and vegetation scope this consolidated page covers.',
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
      callout: {
        title: 'Mold from humidity or condensation',
        text: 'You can also use 311 to report mold caused by humidity or condensation inside a building. Describe where the mold is and how large the area is.',
        karl: 'Callout block. Carries the mold-reporting path from the deleted standalone mold report page — mold from humidity or condensation stays reportable through the same 311 flow (manager decision at plan review).',
      },
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
        'Under San Francisco Health Code Article 11, property owners must not let trash, filth, animal waste, or overgrown plants build up in a way that shelters pests or creates a health hazard.',
      ],
      button: 'View Health Code Article 11',
      buttonUrl: 'https://codelibrary.amlegal.com/codes/san_francisco/latest/sf_health/0-0-0-1890',
      buttonStyle: 'secondary',
    },
    {
      heading: 'While you wait: tips to help with the problem',
      karl: 'Maps to supporting_information (Accordions). This accordion uses the mockup-only open flag so the tips are visible without a click — flag for Digital Services that the real accordion renders collapsed. Contents: one Text block (lead paragraph + IPM bullets) + a Resources-style external links list (UC IPM, EPA, CDC, NEHA). Manager directive: set the response-time expectation, then give simple integrated pest management steps people can start on their own.',
      kind: 'body',
      component: 'supporting',
      open: true,
      paragraphs: [
        'It may take us a few weekdays to get back to you. In the meantime, here are a few things you can do to help with the problem.',
      ],
      bullets: [
        '**Contain garbage:** Bag garbage before you toss it, and keep bin lids fully closed.',
        '**Do not feed pigeons:** Feeding attracts droppings, roosting, and other pests.',
        '**Clean up droppings safely:** Wet down droppings with a disinfectant and wear gloves. Never dry-sweep them.',
        '**Trim plants:** Cut back overgrown plants and brush, especially where they touch buildings or fences.',
        '**Store items off the ground:** Keep stored items on shelves or pallets so pests cannot hide under them.',
        '**Reduce indoor moisture:** Open windows or run fans in kitchens and bathrooms to slow mold growth.',
      ],
      cards: [
        {
          title: 'UC IPM Pest Notes: Pigeons',
          text: 'University of California guidance on managing pigeons around buildings.',
          url: 'https://ipm.ucanr.edu/home-and-landscape/pigeons/pest-notes/',
          karl: 'External link inside the supporting_information accordion. Third-party UC IPM reference in place of a City-maintained pigeon page (manager directive: do not reinvent the wheel).',
        },
        {
          title: 'EPA: Mold cleanup in your home',
          text: 'Federal guidance on cleaning up mold and controlling moisture.',
          url: 'https://www.epa.gov/mold',
          karl: 'External link inside the supporting_information accordion. Third-party EPA reference supporting the mold-from-humidity 311 pointer above.',
        },
        {
          title: 'CDC: Mold and your health',
          text: 'Federal guidance on health effects of mold and how to reduce exposure.',
          url: 'https://www.cdc.gov/mold-health-issues/about/index.html',
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
          title: 'Report rats, mice, and other four-legged problems',
          target: 'rodentsReport',
        },
        {
          title: 'Tenant rights and reporting',
          target: 'tenantRights',
        },
      ],
    },
  ],
  seoTitle: 'Report garbage, filth, and overgrown vegetation | SF.gov',
  metaDescription:
    'Report garbage, clutter, animal waste, pigeon problems, or overgrown vegetation in San Francisco.',
}

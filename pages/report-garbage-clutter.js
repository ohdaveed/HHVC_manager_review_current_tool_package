window.HHVC_PAGES = window.HHVC_PAGES || {}
window.HHVC_PAGES['garbageReport'] = {
  slug: 'sf.gov/report-garbage-clutter-mold-or-unsanitary-conditions',
  type: 'Transaction',
  title: 'Report garbage, clutter, mold, or unsanitary conditions',
  summary:
    'Report garbage, clutter, animal or human waste, overgrown vegetation, mold, or other unsanitary housing conditions.',
  audience: [
    'A tenant or resident affected by garbage, clutter, waste, vegetation, mold, or unsanitary conditions',
    'A friend, family member, advocate, or helper reporting for a tenant',
    'A person reporting conditions in a shared area',
    'An employee reporting a pest, vector, or sanitation concern at work',
  ],
  reading: 'Grade 6',
  sections: [
    {
      heading: 'What to report here',
      karl: 'Best real-schema fit: a things_to_know entry listing the sanitation and garbage-area conditions this one report covers, so 311/HHVC can route each to the right reviewer. Maps the internal Sanitation rows (Garbage/Refuse/Waste/Debris, Human/Animal Waste, Overgrown Vegetation, Unsanitary Bathroom/Kitchen/Hallways/Floors-Walls-Ceiling, Accumulation of Paper Materials, Mold Growth, Excessive Materials) and Garbage Area rows (Inadequate Garbage Containers/Lids, Uncontainerized Garbage) onto one public page. Poison oak folds in with overgrown vegetation.',
      kind: 'body',
      paragraphs: ['Use this page to report any of these to Healthy Housing and Vector Control:'],
      bullets: [
        'Garbage, refuse, waste, or debris',
        'Uncontainerized garbage, or inadequate garbage containers or lids',
        'Human or animal waste',
        'Overgrown plants, weeds, brush, or poison oak',
        'Mold from humidity, condensation, or poor ventilation',
        'Unsanitary bathrooms, kitchens, hallways, floors, walls, or ceilings',
        'Excessive stored materials or clutter, including accumulated paper (hoarding)',
      ],
    },
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
          karl: 'what_to_do -> Section. Section title: "If you rent, give 72 hours when possible". Section specifics: one Text block containing the intro sentence plus the bulleted list below (bullets render as a bulleted list inside the same Draftail Text field, same as any other rich text). Conditional 72-hour tenant notice + timeline expectation.',
        },
        {
          title: 'Describe the condition',
          text: ['Include only the details that apply:'],
          bullets: [
            'The address or location',
            'What the condition is — garbage or debris, uncontainerized garbage or bad containers, human or animal waste, overgrown vegetation or poison oak, mold, an unsanitary room, or excessive clutter or stored materials',
            'Whether it is inside, outside, or in a shared area',
            'How long it has been happening',
            'Whether you told the property owner or manager, if you rent',
            'Whether you saw pests, mosquitoes, or other vectors nearby',
            'Your contact information, if you want an inspector to contact you',
          ],
          callout: {
            karl: 'Callout block inside the "Describe the condition" Section specifics: single rich text field, no separate title field — this mockup callout has no title key either, so there is no heading to reconcile. Text: photo guidance plus the reporter-identity disclosure note.',
            text: "Photos are not required. Describe the location and condition clearly. Reporter identities are only shared with the City Attorney's Office and are not shared in response to public records requests.",
          },
          karl: 'what_to_do -> Section. Section title: "Describe the condition". Section specifics: Text block (intro sentence + bulleted checklist) + Callout block below. Report details checklist.',
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
      heading: 'When HHVC may review mold',
      karl: 'Best real-schema fit: a things_to_know entry specific to mold, carried over from the retired standalone mold report. Title: "When HHVC may review mold". Text: the bulleted list below (Article 11 10-square-foot threshold, self-clean guidance, DBI routing) plus the mold-test-kit callout. SME: confirm thresholds against current protocol before publication.',
      kind: 'body',
      bullets: [
        'Environmental Health may act when mold is growing on walls or ceilings and the affected area totals at least 10 square feet. That is about the size of 10 sheets of paper placed together.',
        'For mold smaller than 10 square feet, clean hard surfaces with soap and water. Reduce humidity and condensation so it does not come back.',
        'If your complaint involves structural water intrusion (such as leaking roof frames, structural plumbing leaks, or broken water heaters), this will be routed to the Department of Building Inspection (DBI) under the San Francisco Housing Code (2025). HHVC focuses strictly on condensation, humidity, and ventilation-related moisture issues.',
      ],
      callout: {
        karl: 'Callout block inside the "When HHVC may review mold" Section specifics: single rich text field. Text: mold-test-kit guidance note, carried over from the retired mold report.',
        text: 'Do not buy a mold test kit. HHVC does not accept or use third-party mold kits for review.',
      },
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
      karl: 'Maps to the related panel: repeatable field "Page *" with a "Choose a page" button. Each card below = one related "Page" entry.',
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
          title: 'Prevent garbage and clutter problems',
          target: 'garbageInfo',
        },
        {
          title: 'Prevent overgrown vegetation',
          target: 'vegetationInfo',
        },
        {
          title: 'Reduce indoor moisture, condensation, and humidity',
          target: 'reduceMoisture',
        },
        {
          title: 'Report rats or mice',
          target: 'ratsReport',
        },
        {
          title: 'Tenant rights and reporting',
          target: 'tenantRights',
        },
      ],
    },
  ],
  seoTitle: 'Report garbage, clutter, mold, or unsanitary conditions | SF.gov',
  metaDescription:
    'Report garbage, clutter, waste, overgrown vegetation, mold, or unsanitary conditions to Healthy Housing and Vector Control.',
}

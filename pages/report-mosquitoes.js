window.HHVC_PAGES = window.HHVC_PAGES || {}
window.HHVC_PAGES['mosquitoesReport'] = {
  slug: 'sf.gov/report-mosquitoes-or-a-dead-bird',
  type: 'Transaction',
  title: 'Report mosquitoes or a dead bird',
  summary:
    'Report mosquitoes or standing water to the City, or a dead bird for West Nile virus surveillance.',
  audience: [
    'A tenant or resident affected by mosquitoes',
    'A friend, family member, advocate, or helper reporting for a tenant',
    'A person reporting standing water around a home, yard, building, or shared area',
    'A resident who found a dead bird on their property or near their building',
    'An employee reporting mosquitoes or standing water at work',
  ],
  reading: 'Grade 6',
  editorNote:
    'Consolidated report page. Mosquito/standing-water reporting goes to the City through 311. Dead bird reporting goes to the state (CDPH) for West Nile virus surveillance — the "Reporting a dead bird" sections below are SME placeholder content carried over from the retired dead-bird page; confirm current pickup criteria, priority species, seasonal workflow, and CDPH routing with SME before publication.',
  sections: [
    {
      heading: 'What to report here',
      karl: 'Best real-schema fit: a things_to_know entry naming the two things this report covers and where each goes (mosquitoes/standing water to 311; a dead bird to CDPH). Maps the internal Vector Survey "Mosquitoes" row plus the West Nile dead-bird surveillance workflow onto one public page.',
      kind: 'body',
      paragraphs: [
        'Use this page to report either of these. Mosquitoes and standing water go to the City through 311. A dead bird goes to the state (CDPH) for West Nile virus surveillance.',
      ],
      bullets: ['Mosquitoes or standing water', 'A dead bird (for West Nile virus surveillance)'],
    },
    {
      heading: 'What to do',
      karl: 'Karl: what_to_do StreamField. Each step below = one Section block (section_title + section_specifics). Primary 311 action appears first; report details are consolidated in Step 3. This flow is for mosquitoes or standing water; the dead-bird flow is in its own sections below.',
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
          text: [
            'Tell the property owner or manager about the mosquito or standing water problem.',
          ],
          bullets: [
            'If they do not respond or start fixing it within 72 hours, submit your report right away so it can be assigned for review.',
            'Do not wait 72 hours if there is an urgent health or safety concern.',
          ],
          karl: 'what_to_do -> Section. Section title: "If you rent, give 72 hours when possible". Section specifics: one Text block (intro sentence + bulleted list). Conditional 72-hour tenant notice + timeline expectation.',
        },
        {
          title: 'Tell us where mosquitoes or standing water are',
          text: ['Include only the details that apply:'],
          bullets: [
            'The address or location',
            'Where you saw mosquitoes or standing water',
            'Whether the water is in a yard, drain, basement, container, fountain, pool, or shared area',
            'How long the water or mosquito activity has been there',
            'Whether you told the property owner or manager, if you rent',
            'Whether you can safely remove the standing water yourself',
            'Your contact information, if you want an inspector to contact you',
          ],
          callout: {
            karl: 'Callout block inside the "Tell us where mosquitoes or standing water are" Section specifics: single rich text field, no separate title (this mockup callout has no title key, so no heading mismatch here). Text: photo guidance note + reporter-identity confidentiality note.',
            text: "Photos are not required. Describe the location and condition clearly. Reporter identities are only shared with the City Attorney's Office and are not shared in response to public records requests.",
          },
          karl: 'what_to_do -> Section. Section title: "Tell us where mosquitoes or standing water are". Section specifics: Text block (intro sentence + bulleted checklist) + Callout block below. Report details checklist.',
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
      karl: 'Best real-schema fit: a second things_to_know entry. Title: "How your report is processed". Text: the bulleted list below (after-report expectations, weekday processing note, enforcement statement, tenant rights note, and the Health Code Article 11 property-owner-obligation summary required by HHVC content standards Ch. 8.7.1). This applies to the 311 mosquito/standing-water report. New: a secondary Button link block (\'View Health Code Article 11\') citing the municipal code per Ch. 8.7.2 — flag for Digital Services to confirm this is the SF.gov-preferred municode URL before publication.',
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
      heading: 'Reporting a dead bird (West Nile virus)',
      karl: 'Judgment call, flagged for review: dead-bird reporting carries a primary action (button + external buttonUrl) and does not go through 311, so it maps to its own what_to_do -> Section. Section title: "Reporting a dead bird (West Nile virus)". Section specifics: Text block (the 3 paragraphs) + Button link block ("Report dead bird", External URL https://westnile.ca.gov/report). The embedded call-center phone number (1-877-WNV-BIRD) could alternatively be split out to get_help -> Phone number if Digital Services wants a discrete contact block. SME placeholder — confirm CDPH routing before publication.',
      kind: 'body',
      paragraphs: [
        'Dead bird reports help track West Nile virus in California. Mosquitoes can spread West Nile virus to birds and people, and birds—especially crows, jays, magpies, ravens, sparrows, finches, and hawks—are often the first sign that the virus may be active in an area.',
        'Report a dead bird through the California Department of Public Health (CDPH) dead bird reporting system (you will leave SF.gov). You can report online year-round; from April through October, you can also call the West Nile virus call center at 1-877-WNV-BIRD (1-877-968-2473). San Francisco residents use this same statewide CDPH system — HHVC’s Mosquito Control Program receives the surveillance data and follows up locally when a pattern needs attention (illustrative — confirm current routing with HHVC before publication).',
      ],
      button: 'Report dead bird',
      buttonUrl: 'https://westnile.ca.gov/report',
    },
    {
      heading: 'Birds that may be collected for testing',
      karl: 'Best real-schema fit: a things_to_know entry. Title: "Birds that may be collected for testing". Text: the intro paragraph + bulleted collection-criteria list below (pickup/disposal guidance folded into bullets). SME verify content against current CDPH/HHVC protocol before publication.',
      kind: 'body',
      paragraphs: [
        'After you report through CDPH, public health staff decide whether the bird can be collected for West Nile virus testing. Not every bird is suitable.',
      ],
      bullets: [
        'Priority species often include crows, jays, magpies, ravens, and birds of prey such as hawks',
        'The bird is usually more likely to be tested if it died recently and the body is intact',
        'Birds that are heavily decomposed, damaged, buried, or unsafe to reach may not be collected',
        'Sparrows and finches may be reported for surveillance, but collection depends on program needs',
        '**Note:** CDPH, HHVC, or the local mosquito control program will tell you whether the bird can be picked up for testing or should be disposed of safely. Do not wait for pickup if you are told to dispose of the bird.',
      ],
    },
    {
      heading: 'After you report a dead bird',
      karl: 'Best real-schema fit: a things_to_know entry. Title: "After you report a dead bird". Text: the 2 paragraphs + bulleted list below (note the location, estimate time of death, keep children/pets away).',
      kind: 'body',
      paragraphs: [
        'After you file a report, the bird may be collected if it is suitable for testing and can be safely picked up.',
        'Dead bird reports and test results help the Mosquito Control Program track West Nile virus activity in San Francisco and guide prevention work.',
      ],
      bullets: [
        'Note the exact location where you found the bird',
        'Estimate how long the bird has been dead if you can',
        'Keep children and pets away from the bird until pickup or disposal instructions are given',
      ],
    },
    {
      heading: 'Handle the bird safely',
      karl: 'Best real-schema fit: a things_to_know entry. Title: "Handle the bird safely". Text: the intro paragraph + bulleted safe-handling/disposal checklist below.',
      kind: 'body',
      paragraphs: [
        'You cannot get West Nile virus from touching a dead bird, but you should never touch any dead animal with bare hands.',
      ],
      bullets: [
        'Do not touch the bird with bare hands',
        'If asked to prepare the bird for pickup, use gloves and place it in a plastic bag',
        'Label the bag “Dead bird” and keep it out of direct sun until pickup',
        'If the bird will not be collected, follow CDPH disposal instructions—usually double-bagging and placing it in an outdoor garbage bin',
      ],
    },
    {
      heading: 'Related pages',
      karl: 'Maps to the related panel: repeatable field "Page *" with a "Choose a page" button. Each card below = one related "Page" entry.',
      kind: 'placement',
      cards: [
        {
          title: 'Mosquito Control Program',
          target: 'mosquitoControl',
        },
        {
          title: 'Prevent mosquitoes',
          target: 'mosquitoesPrevent',
        },
        {
          title: 'Learn what HHVC can inspect',
          target: 'scopeInfo',
        },
        {
          title: 'What happens after you report',
          target: 'afterReport',
        },
        {
          title: 'Tenant rights and reporting',
          target: 'tenantRights',
        },
      ],
    },
  ],
  seoTitle: 'Report mosquitoes or a dead bird | SF.gov',
  metaDescription:
    'Report mosquitoes or standing water to the City, or a dead bird for West Nile virus surveillance.',
}
